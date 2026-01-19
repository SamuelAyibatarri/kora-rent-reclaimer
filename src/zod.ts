import { z } from 'zod';

export const AccountSchema = z.object({
  address: z.string(),
  owner_program: z.string().optional(),
  balance_lamports: z.number().int().nonnegative(),
  last_active_at: z.number().int(), // Unix Timestamp
  tx_count: z.number().int().nonnegative().default(0),
  status: z.enum(['MONITORING', 'MARKED_FOR_DEATH', 'RECLAIMED', 'ERROR', 'PROBATION']).default('MONITORING'),
  retry_count: z.number().int().default(0),
});

export const ConfigSchema = z.object({
  min_rent_balance: z.number().describe("Minimum balance (lamports) to consider 'empty'"),
  max_inactive_days: z.number().describe("Days of silence before we kill it"),
  min_tx_count_safety: z.number().describe("If tx_count > this, we use a script to calculate a safe time estimate to kill it"), 
  dry_run: z.boolean().describe("If true, we only log, never send transactions"),
  max_retries: z.number(),
  tg_alert: z.boolean().default(false).describe("Decide whether or not to receive telegram alerts."),
  email_alert: z.boolean().default(false).describe("Decide whether or not to receive email alerts."),
  run_local: z.boolean().default(false).describe("Whether or not the bot runs locally or on cloudflare workers")
});

export const HeliusTxSchema = z.object({
    signature: z.string(),
    timestamp: z.number(),
    type: z.string(),     
    source: z.string(),
    feePayer: z.string(),
    instructions: z.array(
        z.object({
            type: z.string(),
            programId: z.string(),
        })
    ),
    accountData: z.array(
        z.object({
            account: z.string(),
            nativeBalanceChange: z.number(),
            tokenBalanceChange: z.number(),
        })
    ).optional(),
});

export type HeliusTx = z.infer<typeof HeliusTxSchema>;
export type Account = z.infer<typeof AccountSchema>;
export type AppConfig = z.infer<typeof ConfigSchema>;