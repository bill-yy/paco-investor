// Server config: paths and constants
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Project root (3 levels up from src/lib/server)
export const PROJECT_ROOT = path.resolve(__dirname, '..', '..', '..');

// SQLite database path
export const DB_PATH = process.env.PACO_DB_PATH || path.join(PROJECT_ROOT, 'data', 'paco.db');

// Portfolio initial settings
export const INITIAL_CAPITAL_EUR = 10000;
export const BENCHMARK = '^GSPC'; // S&P 500
export const BENCHMARK_CURRENCY = 'USD';

// Yahoo Finance API base
export const YAHOO_BASE = 'https://query1.finance.yahoo.com';
export const YAHOO_BASE_2 = 'https://query2.finance.yahoo.com';
