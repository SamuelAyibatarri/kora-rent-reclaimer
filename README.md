# Kora Rent Reclaimer

**Solana | Hono | Cloudflare Workers | SQLite (D1)**

An automated, serverless management system that helps **Kora Protocol operators recover rent SOL locked in abandoned or inactive sponsored accounts.** Designed for 2026-standard operational efficiency with strong safety guarantees and full auditability.


## The Problem: "The Rent Leak"

Kora allows operators to sponsor transactions and account creation to improve user onboarding. While this is great for UX, it creates a silent financial overhead:

1.  **Locked Capital:** When an operator sponsors account creation, the rent SOL is locked inside that account.
    
2.  **Abandonment:** If a user becomes inactive or drains their tokens, the rent remains "stranded" on-chain.
    
3.  **Manual Overhead:** Solana does not automatically return rent to the original payer; accounts must be manually closed.
    

**Kora Rent Reclaimer** automates this lifecycle, turning stranded rent back into liquid capital for the operator.


## What This Tool Does

This system continuously monitors accounts created via a Kora operator, tracks their activity lifecycle, and **safely reclaims rent SOL** when accounts are provably eligible for closure.

It prioritizes **safety over speed**, ensuring no user assets are ever put at risk.


## Core Features

-   **Zero Infrastructure Cost:** Runs entirely on Cloudflare Workers and D1 (Free Tier compatible).
    
-   **Intelligent Probation System:** Accounts with remaining balances are moved to a `PROBATION` state and re-checked every 60 days, preventing notification spam while ensuring eventual recovery.
    
-   **Interactive Telegram Management:** Full C2 (Command & Control) via Telegram bot. Sync, monitor, and audit your reaper from your phone.
    
-   **Stateful Tracking:** Uses Cloudflare D1 (SQLite) to persist account states, preventing duplicate transactions and ensuring auditability.
    
-   **Safety-First Eligibility:** Strict rules ensure only empty token accounts owned by the operator are closed.
    


## Management & Control (Telegram Bot)

The worker includes a Telegram Webhook for real-time interaction. Use these commands to manage your reaper:

-   `/stats` – Get a global breakdown of all accounts (Monitoring, Reclaimed, Probation) and total SOL recovered.
    
-   `/sync` – Manually trigger a Helius scan to discover new sponsored accounts.
    
-   `/run` – (Optional) Trigger a full Sync + Reclaim cycle on demand.
    


## How It Works

### 1. Ingest (Discovery)

A scheduled Cron trigger (or manual `/sync`) scans recent transactions from the operator address using Helius Enhanced APIs. It identifies every `createAccount` instruction where the operator was the fee payer.

### 2. Monitor & Analyze

Discovered accounts are stored in D1. Each cycle, the bot classifies the account:

-   **Token Account:** Checks balance and owner.
    
-   **System Wallet:** Flagged for manual review.
    
-   **Closed:** Updated as reclaimed.
    

### 3. Reclaim (Execution)

If an account is a **Token Account**, has **Zero Balance**, and is **Operator-Owned**, the bot submits a `CloseAccount` transaction. The rent SOL is returned directly to the operator's wallet.


## Reclaim Eligibility Policy

The bot follows a **Fail-Safe** policy. An account is only closed if:

-   The account exists and is not already closed.
    
-   The account is a **Token Account**.
    
-   The token balance is **exactly zero**.
    
-   The account owner is **the operator**.
    

**The bot will never:**

-   Close accounts with non-zero balances.
    
-   Close system wallets or accounts not owned by the operator.
    
-   Close accounts based on inactivity alone if they still hold assets.
    

----------

## Setup and Deployment

### 1. Installation

Bash

```
bun install
```

### 2. Configuration

Create a `.dev.vars` file for local development:

Code snippet

```
HELIUS_API_KEY=your_key
KORA_OPERATOR_ADDRESS=your_address
KORA_OPERATOR_PRIVATE_KEY=[...your_key_array]
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_CHAT_ID=your_chat_id
RESEND_API_KEY=xxxx
ALERT_EMAIL=operator@email.com
```

### 3. Database Migration

Bash

```
npx wrangler d1 create kora-db
npx wrangler d1 execute kora-db --local --file=./schema.sql
```

### 4. Local Testing

Run the worker locally:

Bash

```
bun dev
```

To test Telegram commands locally, use a tunnel:

Bash

```
cloudflared tunnel --url http://localhost:8787
```

### 5. Deployment

Bash

```
npx wrangler deploy
```


## Tech Stack

-   **Runtime:** Cloudflare Workers
    
-   **Database:** Cloudflare D1 (SQLite)
    
-   **Framework:** Hono (TypeScript)
    
-   **Blockchain:** @solana/web3.js & Helius
    
-   **Notifications:** Telegram Bot API
    

## License

MIT