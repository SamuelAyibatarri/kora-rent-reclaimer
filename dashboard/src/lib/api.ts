// src/lib/api.ts
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8787';

export const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export interface Account {
  address: string;
  status: string;
  balance_lamports: number;
  last_active_at: number;
  created_at: number;
  reclaimed_at?: number;
  reclaim_tx_signature?: string;
}

export interface Stats {
  monitoring: number;
  reclaimed: number;
  errors: number;
  last_run: string;
}

export const getStats = () => api.get<Stats>('/stats');
export const getAccounts = () => api.get<Account[]>('/accounts');
export const getLogs = () => api.get('/logs');
export const runSync = () => api.get('/run-sync');
export const runReclaim = () => api.get('/run-reclaim');