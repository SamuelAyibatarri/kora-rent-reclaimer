import { Connection, PublicKey, ParsedTransactionWithMeta } from "@solana/web3.js";
import { HeliusTxSchema, type HeliusTx } from "../zod";
import { z } from "zod";

export class HeliusClient {
    private apiKey: string;
    private network: 'mainnet' | 'devnet';
    private connection: Connection;

    constructor(apiKey: string, network: 'mainnet' | 'devnet' = 'mainnet') {
        this.apiKey = apiKey;
        this.network = network;
        this.connection = new Connection(`https://${network}.helius-rpc.com/?api-key=${apiKey}`, { commitment: 'confirmed' });
    }

    // 1. Keep the API method (It's good for Mainnet later)
    async getRecentTransactions(address: string): Promise<HeliusTx[]> {
        const domain = this.network === 'mainnet' ? 'api-mainnet' : 'api-devnet';
        const url = `https://${domain}.helius-rpc.com/v0/addresses/${address}/transactions?api-key=${this.apiKey}`;
        
        try {
            const response = await fetch(url, { method: 'GET' });
            const data = await response.json();
            if (!Array.isArray(data)) return [];
            return z.array(HeliusTxSchema).parse(data);
        } catch (e) {
            console.error("API failed, falling back to 0 results", e);
            return [];
        }
    }

    // 2. THE NEW METHOD: Uses standard RPC (Instant on Devnet)
    async getStandardHistory(address: string, limit = 10) {
        const pubkey = new PublicKey(address);
        
        // A. Get Signatures (The list of Receipt IDs)
        const signatures = await this.connection.getSignaturesForAddress(pubkey, { limit });
        
        // B. Fetch the full details for each signature
        const txs = await Promise.all(
            signatures.map(sig => 
                this.connection.getParsedTransaction(sig.signature, { 
                    maxSupportedTransactionVersion: 0,
                    commitment: 'confirmed'
                })
            )
        );

        // Filter out nulls (failed lookups)
        return txs.filter((tx): tx is ParsedTransactionWithMeta => tx !== null);
    }

    getConnection() {
        return this.connection;
    }
}