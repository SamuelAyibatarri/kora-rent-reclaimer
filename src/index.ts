import { Context, Hono } from 'hono';
import { HeliusClient } from './lib/helius';
import { Keypair, PublicKey } from "@solana/web3.js";
import { syncRecentAccounts } from './services/sync';
import { processReclaims } from './services/reclaim';
import { cors } from 'hono/cors';
import { CONFIG } from './config';

type Bindings = {
  kora_db: D1Database;
  HELIUS_API_KEY: string;
  KORA_OPERATOR_ADDRESS: string;
  KORA_OPERATOR_PRIVATE_KEY: string;
  TELEGRAM_BOT_TOKEN: string;
  TELEGRAM_CHAT_ID: string;   
}

type Variables = { operatorKeypair: Keypair; }

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

app.use('/*', cors({ origin: '*', allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'] }));

app.use('*', async (c, next) => {
  try {
    let operatorKeypair: Keypair;
    if (c.env.KORA_OPERATOR_PRIVATE_KEY) {
      const secretKey = JSON.parse(c.env.KORA_OPERATOR_PRIVATE_KEY);
      operatorKeypair = Keypair.fromSecretKey(new Uint8Array(secretKey));
    } else {
      const fs = await import('fs');
      const secretKey = JSON.parse(fs.readFileSync('operator-keypair.json', 'utf-8'));
      operatorKeypair = Keypair.fromSecretKey(new Uint8Array(secretKey));
    }
    if (operatorKeypair.publicKey.toBase58() !== c.env.KORA_OPERATOR_ADDRESS) throw new Error("Keypair mismatch");
    c.set('operatorKeypair', operatorKeypair);
    await next();
  } catch (err: any) {
    if (!c.req.path.startsWith('/health')) return c.json({ error: err.message }, 500);
    await next();
  }
});

const startLocalHeartbeat = (env: Bindings, ctx: ExecutionContext) => {
  if (!CONFIG.run_local) return;
  setTimeout(async () => {
    console.log("Heartbeat Trigger");
    const mockEvent = { cron: "local", scheduledTime: Date.now(), waitUntil: (p: Promise<any>) => ctx.waitUntil(p) } as ScheduledEvent;
    await workerHandler.scheduled(mockEvent, env, ctx);
    startLocalHeartbeat(env, ctx);
  }, 60000);
};

const workerHandler = {
  async fetch(request: Request, env: Bindings, ctx: ExecutionContext) {
    if (CONFIG.run_local) startLocalHeartbeat(env, ctx);
    return app.fetch(request, env, ctx);
  },

  async scheduled(event: ScheduledEvent, env: Bindings, ctx: ExecutionContext) {
    console.log('Cron Start', new Date(event.scheduledTime).toISOString());
    try {
      const secretKey = JSON.parse(env.KORA_OPERATOR_PRIVATE_KEY);
      const operatorKeypair = Keypair.fromSecretKey(new Uint8Array(secretKey));
      const helius = new HeliusClient(env.HELIUS_API_KEY, 'devnet');

      const syncResult = await syncRecentAccounts(env.kora_db, helius, env.KORA_OPERATOR_ADDRESS);
      const reclaimLogs = await processReclaims(env.kora_db, helius.getConnection(), operatorKeypair, { env } as Context);

      await env.kora_db.prepare("INSERT INTO event_logs (level, message, meta, timestamp) VALUES (?, ?, ?, ?)")
        .bind('INFO', 'Cron job complete', JSON.stringify({ sync: syncResult, reclaim: reclaimLogs }), Date.now()).run();
    } catch (err: any) {
      console.error('Cron Error:', err);
    }
  }
};

export default workerHandler;

/// Dashboard Routes
app.get('/accounts', async (c) => c.json((await c.env.kora_db.prepare('SELECT * FROM accounts').all()).results));
app.get('/logs', async (c) => c.json((await c.env.kora_db.prepare("SELECT * FROM event_logs ORDER BY timestamp DESC LIMIT 50").all()).results));
app.get('/stats', async (c) => {
  const [mon, rec, err] = await Promise.all([
    c.env.kora_db.prepare("SELECT COUNT(*) as count FROM accounts WHERE status IN ('MONITORING', 'PROBATION')").first(),
    c.env.kora_db.prepare("SELECT COUNT(*) as count FROM accounts WHERE status = 'RECLAIMED'").first(),
    c.env.kora_db.prepare("SELECT COUNT(*) as count FROM accounts WHERE status = 'ERROR'").first()
  ]);
  return c.json({ monitoring: mon?.count || 0, reclaimed: rec?.count || 0, errors: err?.count || 0 });
});
app.get('/health', async (c) => c.json({ status: 'healthy', timestamp: Date.now() }));


/// Telegram Webhook

app.post('/telegram-webhook', async (c) => {
  const update: any = await c.req.json();

  if (update.message?.text === '/stats') {
    const db = c.env.kora_db;

    const stats = await db.prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'RECLAIMED' THEN 1 ELSE 0 END) as reclaimed,
        SUM(CASE WHEN status = 'PROBATION' THEN 1 ELSE 0 END) as probation,
        SUM(CASE WHEN status = 'MONITORING' THEN 1 ELSE 0 END) as monitoring,
        SUM(CASE WHEN status = 'ERROR' THEN 1 ELSE 0 END) as errors,
        SUM(CASE WHEN status = 'RECLAIMED' THEN balance_lamports ELSE 0 END) as recovered_lamports
      FROM accounts
    `).first();

    const recoveredSol = ((stats?.recovered_lamports || 0) as number) / 1e9;

    const report = `
📊 *Kora Rent Reclaimer Statistics*
Total Accounts Tracked: ${stats?.total}

✅ Reclaimed: ${stats?.reclaimed}
⏳ Probation: ${stats?.probation}
🔍 Monitoring: ${stats?.monitoring}
❌ Errors: ${stats?.errors}

💰 *Total Recovered:* ${recoveredSol.toFixed(4)} SOL
    `;

    await fetch(`https://api.telegram.org/bot${c.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: update.message.chat.id,
        text: report,
        parse_mode: "Markdown"
      })
    });
  }

  if (update.message?.text === '/sync') {
  const helius = new HeliusClient(c.env.HELIUS_API_KEY, 'devnet');
  
  await fetch(`https://api.telegram.org/bot${c.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ 
      chat_id: update.message.chat.id, 
      text: "🔍 *Manual Sync Started...*\nScanning Helius for recent Kora transactions.", 
      parse_mode: "Markdown" 
    })
  });

  try {
    const syncResult = await syncRecentAccounts(
      c.env.kora_db,
      helius,
      c.env.KORA_OPERATOR_ADDRESS
    );

    const dbStats: any = await c.env.kora_db.prepare(
      "SELECT COUNT(*) as total FROM accounts"
    ).first();

    const reply = `✅ *Sync Complete*\n` +
      `New Accounts Found: ${syncResult.added}\n` +
      `Total Accounts in DB: ${dbStats?.total || 0}\n\n` +
      `Type /stats to see the state breakdown.`;

    await fetch(`https://api.telegram.org/bot${c.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        chat_id: update.message.chat.id, 
        text: reply, 
        parse_mode: "Markdown" 
      })
    });
  } catch (err: any) {
    console.error("Manual Sync Command Failed:", err);
  }
}
  return c.json({ ok: true });
});