CREATE TABLE IF NOT EXISTS "accounts" (
	"address"	TEXT,
	"owner_program"	TEXT,
	"balance_lamports"	INTEGER,
	"last_active_at"	INTEGER,
	"tx_count"	INTEGER DEFAULT 0,
	"status"	TEXT DEFAULT 'MONITORING',
	"error_log"	TEXT,
	"retry_count"	INTEGER DEFAULT 0,
	"created_at"	INTEGER,
	"reclaimed_at"	INTEGER,
	"reclaim_tx_signature"	TEXT,
	"last_checked"	INTEGER,
	PRIMARY KEY("address")
);
CREATE TABLE IF NOT EXISTS "event_logs" (
	"id"	INTEGER,
	"level"	TEXT,
	"message"	TEXT,
	"meta"	TEXT,
	"timestamp"	INTEGER,
	PRIMARY KEY("id" AUTOINCREMENT)
);

CREATE INDEX IF NOT EXISTS idx_accounts_status ON accounts(status);
CREATE INDEX IF NOT EXISTS idx_logs_timestamp ON event_logs(timestamp);
