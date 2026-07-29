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

	// Multi-strategy support (v2): each table gets strategy_id column.
	// Default 'value' for existing rows so nothing breaks.
	createStrategiesTable(db);

	// Create contributions table BEFORE anything else (it's needed by portfolio logic)
	db.exec(`
		CREATE TABLE IF NOT EXISTS contributions (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			strategy_id TEXT NOT NULL,
			date TEXT NOT NULL,
			amount_eur REAL NOT NULL,
			UNIQUE(strategy_id, date)
		);
		CREATE INDEX IF NOT EXISTS idx_contributions_strategy ON contributions(strategy_id);
	`);

	addColumnIfMissingWithDefault(db, 'positions', 'strategy_id', 'TEXT', "'value'");
	addColumnIfMissingWithDefault(db, 'trades', 'strategy_id', 'TEXT', "'value'");
	addColumnIfMissingWithDefault(db, 'valuations', 'strategy_id', 'TEXT', "'value'");

	// Drop the old UNIQUE(ticker) constraint on positions and replace with
	// UNIQUE(ticker, strategy_id) so the same stock can exist in multiple strategies.
	dropPositionsUniqueConstraint(db);

	// Update valuations UNIQUE to be (timestamp, strategy_id) instead of just (timestamp)
	dropValuationsUniqueConstraint(db);

	// Trading-specific fields on positions (stop-loss, take-profit, entry signals)
	addColumnIfMissing(db, 'positions', 'stop_loss_eur', 'REAL');
	addColumnIfMissing(db, 'positions', 'take_profit_eur', 'REAL');
	addColumnIfMissing(db, 'positions', 'entry_signal', 'TEXT');
	addColumnIfMissing(db, 'positions', 'trade_plan', 'TEXT');

	// Trading-specific fields on trades
	addColumnIfMissing(db, 'trades', 'exit_reason', 'TEXT');
}

function addColumnIfMissing(db: Database.Database, table: string, column: string, type: string) {
	const cols = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
	if (!cols.some((c) => c.name === column)) {
		db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${type};`);
	}
}

function addColumnIfMissingWithDefault(db: Database.Database, table: string, column: string, type: string, defaultValue: string) {
	const cols = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
	if (!cols.some((c) => c.name === column)) {
		db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${type} DEFAULT ${defaultValue};`);
	}
}

/**
 * SQLite doesn't support ALTER TABLE DROP CONSTRAINT. To remove the old
 * UNIQUE(ticker) constraint, we recreate the table with the new schema.
 * This is a one-time migration: it checks if the old constraint exists
 * by inspecting the CREATE TABLE SQL, and only runs if needed.
 */
function dropPositionsUniqueConstraint(db: Database.Database) {
	const sql = (db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='positions'").get() as { sql: string })?.sql || '';
	// The original schema has UNIQUE on ticker column definition.
	// If we see "ticker TEXT NOT NULL UNIQUE" and no unique index, migrate.
	if (!sql.includes('UNIQUE')) return;

	// Check if already migrated (has strategy_id and no inline UNIQUE)
	const cols = db.prepare('PRAGMA table_info(positions)').all() as Array<{ name: string }>;
	if (!cols.some((c) => c.name === 'strategy_id')) return; // column not added yet

	console.log('[migration] Recreating positions table to remove UNIQUE(ticker) constraint...');

	db.exec(`
		CREATE TABLE IF NOT EXISTS positions_new (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			ticker TEXT NOT NULL,
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
			created_at INTEGER NOT NULL DEFAULT (unixepoch()),
			strategy_id TEXT NOT NULL DEFAULT 'value',
			stop_loss_eur REAL,
			take_profit_eur REAL,
			entry_signal TEXT,
			trade_plan TEXT,
			UNIQUE(ticker, strategy_id)
		);

		INSERT INTO positions_new (id, ticker, isin, company_name, market, sector, currency, shares, avg_price_local, avg_price_eur, opened_at, fair_value_eur, thesis, bear_case, score, catalysts, risks, status, created_at, strategy_id, stop_loss_eur, take_profit_eur, entry_signal, trade_plan)
		SELECT id, ticker, isin, company_name, market, sector, currency, shares, avg_price_local, avg_price_eur, opened_at, fair_value_eur, thesis, bear_case, score, catalysts, risks, status, created_at,
			COALESCE(strategy_id, 'value'),
			NULL, NULL, NULL, NULL
		FROM positions;

		DROP TABLE positions;
		ALTER TABLE positions_new RENAME TO positions;
		CREATE INDEX IF NOT EXISTS idx_positions_strategy ON positions(strategy_id);
	`);
}

function dropValuationsUniqueConstraint(db: Database.Database) {
	const sql = (db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='valuations'").get() as { sql: string })?.sql || '';
	// The original has UNIQUE(timestamp). New schema needs UNIQUE(timestamp, strategy_id).
	if (!sql.includes('UNIQUE(timestamp)')) return; // already migrated or doesn't have it

	console.log('[migration] Recreating valuations table to update UNIQUE constraint...');

	db.exec(`
		CREATE TABLE IF NOT EXISTS valuations_new (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			timestamp TEXT NOT NULL,
			cash_eur REAL NOT NULL,
			positions_eur REAL NOT NULL,
			total_eur REAL NOT NULL,
			invested_eur REAL NOT NULL,
			benchmark_value REAL,
			benchmark_eur REAL,
			positions_market_eur REAL,
			strategy_id TEXT NOT NULL DEFAULT 'value',
			UNIQUE(timestamp, strategy_id)
		);

		INSERT INTO valuations_new (id, timestamp, cash_eur, positions_eur, total_eur, invested_eur, benchmark_value, benchmark_eur, positions_market_eur, strategy_id)
		SELECT id, timestamp, cash_eur, positions_eur, total_eur, invested_eur, benchmark_value, benchmark_eur, positions_market_eur,
			COALESCE(strategy_id, 'value')
		FROM valuations;

		DROP TABLE valuations;
		ALTER TABLE valuations_new RENAME TO valuations;
		CREATE INDEX IF NOT EXISTS idx_valuations_strategy ON valuations(strategy_id);
	`);
}

function createStrategiesTable(db: Database.Database) {
	db.exec(`
		CREATE TABLE IF NOT EXISTS strategies (
			id TEXT PRIMARY KEY,
			name TEXT NOT NULL,
			type TEXT NOT NULL,
			description TEXT,
			initial_capital_eur REAL NOT NULL DEFAULT 0,
			monthly_contribution_eur REAL NOT NULL DEFAULT 0,
			start_date TEXT NOT NULL,
			ter_annual REAL NOT NULL DEFAULT 0,
			color TEXT NOT NULL DEFAULT '#3b82f6',
			icon TEXT NOT NULL DEFAULT 'P',
			created_at INTEGER NOT NULL DEFAULT (unixepoch())
		);
	`);

	// Seed default strategies if table is empty
	const count = (db.prepare('SELECT COUNT(*) as n FROM strategies').get() as { n: number }).n;
	if (count === 0) {
		const stmt = db.prepare(`
			INSERT INTO strategies (id, name, type, description, initial_capital_eur, monthly_contribution_eur, start_date, ter_annual, color, icon)
			VALUES (@id, @name, @type, @description, @initial_capital_eur, @monthly_contribution_eur, @start_date, @ter_annual, @color, @icon)
		`);
		stmt.run({
			id: 'value',
			name: 'Paco Value',
			type: 'value',
			description: 'Inversión value: análisis fundamental, horizonte 3-7 años, margen de seguridad',
			initial_capital_eur: 10000,
			monthly_contribution_eur: 0,
			start_date: '2026-07-19',
			ter_annual: 0,
			color: '#3b82f6',
			icon: 'V'
		});
		stmt.run({
			id: 'trader',
			name: 'Paco Trader',
			type: 'trading',
			description: 'Swing trading: análisis técnico (RSI, MACD, EMAs), posiciones 5-30 días, stop-loss/take-profit',
			initial_capital_eur: 0,
			monthly_contribution_eur: 100,
			start_date: '2026-01-01',
			ter_annual: 0,
			color: '#f59e0b',
			icon: 'T'
		});
		stmt.run({
			id: 'funds',
			name: 'Paco Funds',
			type: 'passive',
			description: 'Fondos pasivos: portfolio de ETFs UCITS, rebalanceo trimestral, TER simulado',
			initial_capital_eur: 0,
			monthly_contribution_eur: 100,
			start_date: '2026-01-01',
			ter_annual: 0.0022,
			color: '#10b981',
			icon: 'F'
		});
	}
}

export type Strategy = {
	id: string;
	name: string;
	type: string;
	description: string | null;
	initial_capital_eur: number;
	monthly_contribution_eur: number;
	start_date: string;
	ter_annual: number;
	color: string;
	icon: string;
	created_at: number;
};

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
	strategy_id: string;
	stop_loss_eur: number | null;
	take_profit_eur: number | null;
	entry_signal: string | null;
	trade_plan: string | null;
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
