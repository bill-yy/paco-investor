// Schema for PacoInvestor portfolio tracker
// SQLite database initialization

import Database from 'better-sqlite3';
import { DB_PATH } from './config';
import fs from 'node:fs';
import path from 'node:path';

let db: Database.Database | null = null;

export function getDb(): Database.Database {
	if (db) return db;
	// Ensure data dir exists
	const dataDir = path.dirname(DB_PATH);
	fs.mkdirSync(dataDir, { recursive: true });
	db = new Database(DB_PATH);
	db.pragma('journal_mode = WAL');
	db.pragma('foreign_keys = ON');
	migrate(db);
	return db;
}

function migrate(db: Database.Database) {
	db.exec(`
		CREATE TABLE IF NOT EXISTS schema_version (
			version INTEGER PRIMARY KEY
		);

		CREATE TABLE IF NOT EXISTS settings (
			key TEXT PRIMARY KEY,
			value TEXT NOT NULL,
			updated_at INTEGER NOT NULL
		);

		CREATE TABLE IF NOT EXISTS positions (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			ticker TEXT NOT NULL UNIQUE,
			isin TEXT,
			company_name TEXT NOT NULL,
			market TEXT NOT NULL,
			sector TEXT NOT NULL,
			currency TEXT NOT NULL,
			shares REAL NOT NULL DEFAULT 0,
			avg_price_local REAL NOT NULL DEFAULT 0,
			avg_price_eur REAL NOT NULL DEFAULT 0,
			opened_at TEXT NOT NULL,
			fair_value_eur REAL,
			thesis TEXT,
			bear_case TEXT,
			score INTEGER,
			catalysts TEXT,
			risks TEXT,
			status TEXT NOT NULL DEFAULT 'open',
			created_at INTEGER NOT NULL DEFAULT (unixepoch())
		);

		CREATE TABLE IF NOT EXISTS trades (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			executed_at TEXT NOT NULL,
			ticker TEXT NOT NULL,
			isin TEXT,
			company_name TEXT NOT NULL,
			side TEXT NOT NULL CHECK (side IN ('buy','sell')),
			shares REAL NOT NULL,
			price_local REAL NOT NULL,
			price_eur REAL NOT NULL,
			fx_rate REAL NOT NULL,
			fee_eur REAL NOT NULL DEFAULT 0,
			thesis TEXT,
			created_at INTEGER NOT NULL DEFAULT (unixepoch()),
			FOREIGN KEY (ticker) REFERENCES positions(ticker)
		);

		CREATE INDEX IF NOT EXISTS idx_trades_ticker ON trades(ticker);
		CREATE INDEX IF NOT EXISTS idx_trades_date ON trades(executed_at);

		CREATE TABLE IF NOT EXISTS valuations (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			timestamp TEXT NOT NULL,
			cash_eur REAL NOT NULL,
			positions_eur REAL NOT NULL,
			total_eur REAL NOT NULL,
			invested_eur REAL NOT NULL,
			benchmark_value REAL,
			benchmark_eur REAL,
			UNIQUE(timestamp)
		);

		CREATE TABLE IF NOT EXISTS dividends (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			ticker TEXT NOT NULL,
			ex_date TEXT NOT NULL,
			pay_date TEXT,
			amount_local REAL NOT NULL,
			amount_eur REAL NOT NULL,
			fx_rate REAL,
			FOREIGN KEY (ticker) REFERENCES positions(ticker)
		);

		CREATE TABLE IF NOT EXISTS fx_rates (
			pair TEXT NOT NULL,
			date TEXT NOT NULL,
			rate REAL NOT NULL,
			PRIMARY KEY (pair, date)
		);

		CREATE TABLE IF NOT EXISTS notes (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			created_at TEXT NOT NULL,
			ticker TEXT,
			type TEXT NOT NULL CHECK (type IN ('thesis','risk','review','macro','earnings','other')),
			title TEXT NOT NULL,
			content TEXT NOT NULL
		);

		CREATE TABLE IF NOT EXISTS reports (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			created_at TEXT NOT NULL,
			period TEXT NOT NULL,
			type TEXT NOT NULL CHECK (type IN ('weekly','monthly','quarterly')),
			content_markdown TEXT NOT NULL
		);

		CREATE TABLE IF NOT EXISTS macro_snapshots (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			created_at TEXT NOT NULL,
			context TEXT NOT NULL
		);

		CREATE TABLE IF NOT EXISTS market_snapshots (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			created_at TEXT NOT NULL,
			ticker TEXT NOT NULL,
			price REAL NOT NULL,
			currency TEXT NOT NULL,
			change_pct REAL NOT NULL,
			category TEXT NOT NULL,
			UNIQUE(created_at, ticker)
		);

		CREATE INDEX IF NOT EXISTS idx_market_snaps_date ON market_snapshots(created_at);
		CREATE INDEX IF NOT EXISTS idx_market_snaps_ticker ON market_snapshots(ticker);

		CREATE TABLE IF NOT EXISTS watchlist (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			ticker TEXT NOT NULL UNIQUE,
			company_name TEXT NOT NULL,
			added_at TEXT NOT NULL,
			notes TEXT,
			target_entry_eur REAL,
			fair_value_eur REAL,
			score INTEGER
		);

		CREATE TABLE IF NOT EXISTS sector_allocations (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			created_at TEXT NOT NULL,
			sector TEXT NOT NULL,
			weight REAL NOT NULL,
			value_eur REAL NOT NULL,
			UNIQUE(created_at, sector)
		);
	`);

	// Lightweight column migrations: add columns if missing (safe on existing DBs).
	// valuations.positions_market_eur: market value of positions (vs invested cost)
	addColumnIfMissing(db, 'valuations', 'positions_market_eur', 'REAL');
	// trades: extend journal with full decision context (was only storing thesis)
	addColumnIfMissing(db, 'trades', 'catalysts', 'TEXT');
	addColumnIfMissing(db, 'trades', 'risks', 'TEXT');
	addColumnIfMissing(db, 'trades', 'fair_value_eur', 'REAL');
	addColumnIfMissing(db, 'trades', 'score', 'INTEGER');
	addColumnIfMissing(db, 'trades', 'bear_case', 'TEXT');
}

function addColumnIfMissing(db: Database.Database, table: string, column: string, type: string) {
	const cols = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
	if (!cols.some((c) => c.name === column)) {
		db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${type};`);
	}
}

export type Position = {
	id: number;
	ticker: string;
	isin: string | null;
	company_name: string;
	market: string;
	sector: string;
	currency: string;
	shares: number;
	avg_price_local: number;
	avg_price_eur: number;
	opened_at: string;
	fair_value_eur: number | null;
	thesis: string | null;
	bear_case: string | null;
	score: number | null;
	catalysts: string | null;
	risks: string | null;
	status: string;
	created_at: number;
};

export type Trade = {
	id: number;
	executed_at: string;
	ticker: string;
	isin: string | null;
	company_name: string;
	side: 'buy' | 'sell';
	shares: number;
	price_local: number;
	price_eur: number;
	fx_rate: number;
	fee_eur: number;
	thesis: string | null;
	catalysts: string | null;
	risks: string | null;
	fair_value_eur: number | null;
	score: number | null;
	bear_case: string | null;
	created_at: number;
};

export type Valuation = {
	id: number;
	timestamp: string;
	cash_eur: number;
	positions_eur: number;
	positions_market_eur: number | null;
	total_eur: number;
	invested_eur: number;
	benchmark_value: number | null;
	benchmark_eur: number | null;
};

export type Watchlist = {
	id: number;
	ticker: string;
	company_name: string;
	added_at: string;
	notes: string | null;
	target_entry_eur: number | null;
	fair_value_eur: number | null;
	score: number | null;
};
