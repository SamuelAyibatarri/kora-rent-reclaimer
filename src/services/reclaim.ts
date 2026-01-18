import { Buffer } from 'node:buffer';
import { 
  Connection, 
  PublicKey, 
  Keypair, 
  Transaction, 
  TransactionInstruction, 
  SendTransactionError,
  TransactionExpiredBlockheightExceededError
} from "@solana/web3.js";
import { Account } from "../zod";
import { Context } from "hono";
import { Logger } from "./logger";
import { CONFIG } from "../config";
import { sendTelegramAlert } from "./notify/telegram";
// import { sendEmailAlert } from "./notify/email";

const TOKEN_PROGRAM_ID = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
const PROBATION_PERIOD_MS = 60 * 24 * 60 * 60 * 1000;

function classifyAccount(info: any) {
  if (!info) return "CLOSED";
  const owner = info.owner.toBase58();
  const dataSize = info.data.length;
  if (owner === '11111111111111111111111111111111' && dataSize === 0) return "SYSTEM_WALLET";
  if (owner === TOKEN_PROGRAM_ID.toBase58()) return "TOKEN_ACCOUNT";
  return `OTHER (${owner})`;
}

function getTokenBalance(data: Buffer): bigint {
  return data.readBigUInt64LE(64);
}

function getTokenAccountOwner(data: Buffer): PublicKey {
  const ownerBytes = data.slice(32, 64);
  return new PublicKey(ownerBytes);
}

async function sendTransactionWithRetry(
  connection: Connection,
  transaction: Transaction,
  signers: Keypair[],
  maxRetries: number = 3
): Promise<string> {
  let lastError: Error | null = null;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
      transaction.recentBlockhash = blockhash;
      transaction.lastValidBlockHeight = lastValidBlockHeight;
      transaction.feePayer = signers[0].publicKey;
      transaction.sign(...signers);

      const signature = await connection.sendRawTransaction(transaction.serialize(), {
        skipPreflight: false,
        preflightCommitment: 'confirmed',
        maxRetries: 2
      });

      const confirmation = await connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, 'confirmed');
      if (confirmation.value.err) throw new Error(`Transaction failed: ${JSON.stringify(confirmation.value.err)}`);
      return signature;
    } catch (err: any) {
      lastError = err;
      if (err instanceof TransactionExpiredBlockheightExceededError) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        continue;
      }
      throw err;
    }
  }
  throw lastError || new Error('Transaction failed after retries');
}

export async function processReclaims(db: D1Database, connection: Connection, operatorKeypair: Keypair, ctx?: Context) {
  let reclaimedCount = 0;
  let probationCount = 0;
  let errorCount = 0;
  let recoveredSol = 0;

  const logger = new Logger(db, ctx);
  await logger.info("Reclaim Process Started");

  const { results } = await db.prepare(`
    SELECT * FROM accounts 
    WHERE status = 'MONITORING' 
    OR (status = 'PROBATION' AND last_checked < ?)
    LIMIT 5
  `).bind(Date.now() - PROBATION_PERIOD_MS).all();

  const targets = results as unknown as Account[];
  const processingLogs: string[] = [];

  for (const account of targets) {
    try {
      const pubkey = new PublicKey(account.address);
      const info = await connection.getAccountInfo(pubkey);
      const type = classifyAccount(info);

      await logger.info("Inspecting target", { address: account.address });

      switch (type) {
        case "CLOSED":
           await db.prepare("UPDATE accounts SET status = 'RECLAIMED', reclaimed_at = ? WHERE address = ?")
             .bind(Date.now(), account.address).run();
           processingLogs.push(`${account.address}: Already Closed`);
           break;

        case "SYSTEM_WALLET":
           await db.prepare("UPDATE accounts SET status = 'MARKED_FOR_DEATH', last_checked = ? WHERE address = ?")
             .bind(Date.now(), account.address).run();
           processingLogs.push(`${account.address}: System Wallet flagged`);
           break;

        case "TOKEN_ACCOUNT":
           if (!info) break;
           const balance = getTokenBalance(info.data);
           
           if (balance > 0n) {
             await db.prepare("UPDATE accounts SET status = 'PROBATION', last_checked = ? WHERE address = ?")
               .bind(Date.now(), account.address).run();
             processingLogs.push(`${account.address}: Probation (Funded)`);
             probationCount++;
             break;
           }

           const accountOwner = getTokenAccountOwner(info.data);
           if (!accountOwner.equals(operatorKeypair.publicKey)) {
             processingLogs.push(`${account.address}: Not operator-owned`);
             break;
           }

           if (CONFIG.dry_run) {
             processingLogs.push(`${account.address}: Dry Run (Skipped)`);
             break;
           }

           const closeIx = new TransactionInstruction({
             keys: [
               { pubkey, isSigner: false, isWritable: true },
               { pubkey: operatorKeypair.publicKey, isSigner: false, isWritable: true },
               { pubkey: operatorKeypair.publicKey, isSigner: true, isWritable: false }
             ],
             programId: TOKEN_PROGRAM_ID,
             data: Buffer.from([9])
           });

           try {
             const sig = await sendTransactionWithRetry(connection, new Transaction().add(closeIx), [operatorKeypair], CONFIG.max_retries);
             recoveredSol += info.lamports;
             await db.prepare("UPDATE accounts SET status = 'RECLAIMED', reclaimed_at = ?, reclaim_tx_signature = ? WHERE address = ?")
               .bind(Date.now(), sig, account.address).run();
             reclaimedCount++;
           } catch (txErr: any) {
             if (txErr instanceof SendTransactionError) {
               const logs = await txErr.getLogs(connection);
               if (logs.join(' ').includes('InvalidAccountData')) {
                 const checkInfo = await connection.getAccountInfo(pubkey);
                 if (!checkInfo) {
                   recoveredSol += info.lamports;
                   await db.prepare("UPDATE accounts SET status = 'RECLAIMED', reclaimed_at = ? WHERE address = ?").bind(Date.now(), account.address).run();
                   reclaimedCount++;
                 }
               }
             }
             errorCount++;
           }
           break;

        default:
           processingLogs.push(`${account.address}: Skipped (${type})`);
           break;
      }
    } catch (err: any) {
      errorCount++;
      await db.prepare("UPDATE accounts SET status = 'ERROR', error_log = ? WHERE address = ?").bind(err.message, account.address).run();
    }
  }
  
  const summary = `🧹 *Kora Rent Reclaim Summary*\nProcessed: ${targets.length}\nReclaimed: ${reclaimedCount}\nProbation: ${probationCount}\nRecovered: ${(recoveredSol / 1e9).toFixed(4)} SOL\nMode: ${CONFIG.dry_run ? "DRY RUN" : "LIVE"}`;

  if (CONFIG.tg_alert && targets.length > 0) {
    await sendTelegramAlert(ctx?.env?.TELEGRAM_BOT_TOKEN, ctx?.env?.TELEGRAM_CHAT_ID, summary);
  }

  return processingLogs;
}