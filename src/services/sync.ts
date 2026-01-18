import { HeliusClient } from "../lib/helius";
import { ParsedInstruction} from "@solana/web3.js";

export async function syncRecentAccounts(
  db: D1Database, 
  helius: HeliusClient, 
  operatorAddress: string
) {
  console.log("🔄 Starting Sync Process (RPC Mode)...");

  const transactions = await helius.getStandardHistory(operatorAddress);
  console.log(`📡 Fetched ${transactions.length} raw transactions.`);

  let newAccountsCount = 0;

  for (const tx of transactions) {
    if (!tx.meta || !tx.transaction) continue;

    const feePayer = tx.transaction.message.accountKeys[0].pubkey.toBase58();

    if (feePayer !== operatorAddress) continue;

    const instructions = tx.transaction.message.instructions;
    
    for (const ix of instructions) {
      if (!('parsed' in ix)) continue;
      
      const parsedIx = ix as ParsedInstruction;

      if (parsedIx.program === 'system' && parsedIx.parsed.type === 'createAccount') {
        const info = parsedIx.parsed.info;
        const newAccount = info.newAccount;

        console.log(`Found Creation: ${newAccount}`);

        const result = await db.prepare(`
          INSERT OR IGNORE INTO accounts (
            address, 
            owner_program, 
            balance_lamports, 
            last_active_at, 
            status, 
            created_at
          ) VALUES (?, ?, ?, ?, ?, ?)
        `).bind(
          newAccount,
          "SystemProgram",
          info.lamports,
          tx.blockTime ? tx.blockTime * 1000 : Date.now(),
          "MONITORING",
          Date.now()
        ).run();

        if (result.meta.changes > 0) {
          console.log(`✅ Database Updated: ${newAccount}`);
          newAccountsCount++;
        }
      }
    }
  }

  return {
    scanned: transactions.length,
    added: newAccountsCount
  };
}