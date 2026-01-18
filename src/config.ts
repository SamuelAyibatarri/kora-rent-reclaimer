import { ConfigSchema, type AppConfig } from './zod';

const configData: AppConfig = {
  min_rent_balance: 2_500_000, 
  max_inactive_days: 30,
  min_tx_count_safety: 10,
  dry_run: false, 
  max_retries: 3,
  tg_alert: true,
  email_alert: false,
  run_local: false
};

export const CONFIG = ConfigSchema.parse(configData);