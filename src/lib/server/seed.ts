// Seed: bootstrap the database with initial settings
import { getDb } from './db.js';
import { INITIAL_CAPITAL_EUR, BENCHMARK, DB_PATH } from './config.js';
import fs from 'node:fs';
import path from 'node:path';

// ensure data dir exists
const dataDir = path.dirname(DB_PATH);
fs.mkdirSync(dataDir, { recursive: true });

console.log('Initializing PacoInvestor DB at:', DB_PATH);
const db = getDb();

// Default settings
const now = Date.now();
const defaults = {
	initial_capital: String(INITIAL_CAPITAL_EUR),
	benchmark: BENCHMARK,
	start_date: new Date().toISOString().slice(0, 10),
	benchmark_currency: 'USD'
};

const upsert = db.prepare(
	`INSERT INTO settings (key, value, updated_at) VALUES (?,?,?)
	 ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
);
for (const [k, v] of Object.entries(defaults)) {
	upsert.run(k, v, now);
}

console.log('Settings:', defaults);
console.log('Done. DB ready at', DB_PATH);
