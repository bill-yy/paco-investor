// Portfolio operations: open, close, buy, sell
import { getDb } from './db';
import { getQuote, getFxRate } from './yahoo';
import { saveValuation } from './valuation';
import type { Position, Trade } from './db';

export interface TradeInput {
	executed_at?: string;
	ticker: string;
	isin?: string;
	company_name: string;
	market: string;
	sector: string;
	side: 'buy' | 'sell';
	shares: number;
	fair_value_eur?: number;
	thesis?: string;
	bear_case?: string;
	score?: number;
	catalysts?: string;
	risks?: string;
}

export interface TradeResult {
	trade: Trade;
	avg_price_local: number;
	avg_price_eur: number;
	fx_rate: number;
	price_local: number;
	price_eur: number;
	fee_eur: number;
}

export async function executeTrade(input: TradeInput): Promise<TradeResult> {
	const db = getDb();
	const ticker = input.ticker.toUpperCase();

	// Live price
	const q = await getQuote(ticker);
	const price_local = q.price;

	// FX to EUR
	let fx_rate = 1;
	if (q.currency !== 'EUR') {
		fx_rate = await getFxRate(`${q.currency}EUR`);
	}
	const price_eur = price_local * fx_rate;

	// Default no fee (Yahoo doesn't expose commission; assume 0)
	const fee_eur = 0;

	const executed_at = input.executed_at || new Date().toISOString();

	const tx = db.transaction(() => {
		// Upsert position
		const existing = db
			.prepare('SELECT * FROM positions WHERE ticker = ?')
			.get(ticker) as Position | undefined;

		if (input.side === 'buy') {
				if (existing) {
					const newShares = existing.shares + input.shares;
					const newAvgLocal =
						(existing.shares * existing.avg_price_local + input.shares * price_local) /
						newShares;
					const newAvgEur =
						(existing.shares * existing.avg_price_eur + input.shares * price_eur) / newShares;
					db.prepare(
						`UPDATE positions
						 SET shares = ?, avg_price_local = ?, avg_price_eur = ?, status = 'open',
						     isin = COALESCE(?, isin),
						     fair_value_eur = ?, thesis = ?, bear_case = ?, score = ?, catalysts = ?, risks = ?
						 WHERE ticker = ?`
					).run(
						newShares,
						newAvgLocal,
						newAvgEur,
						input.isin ?? null,
						input.fair_value_eur ?? existing.fair_value_eur,
						input.thesis ?? existing.thesis,
						input.bear_case ?? existing.bear_case,
						input.score ?? existing.score,
						input.catalysts ?? existing.catalysts,
						input.risks ?? existing.risks,
						ticker
					);
				} else {
					db.prepare(
						`INSERT INTO positions
						 (ticker, isin, company_name, market, sector, currency, shares, avg_price_local, avg_price_eur,
						  opened_at, fair_value_eur, thesis, bear_case, score, catalysts, risks, status)
						 VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?, ?, 'open')`
					).run(
						ticker,
						input.isin ?? null,
						input.company_name,
						input.market,
						input.sector,
						q.currency,
						input.shares,
						price_local,
						price_eur,
						executed_at.slice(0, 10),
						input.fair_value_eur ?? null,
						input.thesis ?? null,
						input.bear_case ?? null,
						input.score ?? null,
						input.catalysts ?? null,
						input.risks ?? null
					);
				}
		} else {
			// SELL
			if (!existing) throw new Error(`Cannot sell ${ticker}: no open position`);
			const newShares = existing.shares - input.shares;
			if (newShares < -0.0001) throw new Error(`Cannot sell more shares than held for ${ticker}`);
			db.prepare(
				`UPDATE positions
				 SET shares = ?, status = CASE WHEN ? <= 0 THEN 'closed' ELSE 'open' END
				 WHERE ticker = ?`
			).run(Math.max(0, newShares), newShares, ticker);
		}

		// Record trade (with full decision context)
		const info = db
			.prepare(
				`INSERT INTO trades
				 (executed_at, ticker, isin, company_name, side, shares, price_local, price_eur, fx_rate, fee_eur,
				  thesis, catalysts, risks, fair_value_eur, score, bear_case)
				 VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
			)
			.run(
				executed_at,
				ticker,
				input.isin ?? null,
				input.company_name,
				input.side,
				input.shares,
				price_local,
				price_eur,
				fx_rate,
				fee_eur,
				input.thesis ?? null,
				input.catalysts ?? null,
				input.risks ?? null,
				input.fair_value_eur ?? null,
				input.score ?? null,
				input.bear_case ?? null
			);
		const trade = db.prepare('SELECT * FROM trades WHERE id = ?').get(info.lastInsertRowid) as Trade;
		return { existing, trade };
	});

	const { trade } = tx();

	const finalPos = db.prepare('SELECT * FROM positions WHERE ticker = ?').get(ticker) as Position;

	// Trade-triggered valuation snapshot. Wrapped so a Yahoo failure during
	// snapshot never aborts the committed trade.
	try {
		await saveValuation();
	} catch (e) {
		console.error('[snapshot] post-trade valuation failed:', e);
	}

	return {
		trade,
		avg_price_local: finalPos.avg_price_local,
		avg_price_eur: finalPos.avg_price_eur,
		fx_rate,
		price_local,
		price_eur,
		fee_eur
	};
}

export async function getPortfolioSnapshot() {
	const db = getDb();
	const positions = db
		.prepare(`SELECT * FROM positions WHERE status = 'open' ORDER BY (shares * avg_price_eur) DESC`)
		.all() as Position[];

	const trades = db.prepare('SELECT * FROM trades ORDER BY executed_at DESC').all() as Trade[];

	const invested_eur = positions.reduce(
		(sum, p) => sum + p.shares * p.avg_price_eur,
		0
	);

	// Settings
	const settingsRow = db.prepare('SELECT * FROM settings').all() as any[];
	const settings: Record<string, any> = {};
	for (const s of settingsRow) settings[s.key] = s.value;

	const cash_eur =
		parseFloat(settings.initial_capital || '10000') +
		trades
			.filter((t) => t.side === 'sell')
			.reduce((s, t) => s + t.shares * t.price_eur - t.fee_eur, 0) -
		trades
			.filter((t) => t.side === 'buy')
			.reduce((s, t) => s + t.shares * t.price_eur + t.fee_eur, 0);

	return {
		positions,
		trades,
		invested_eur,
		cash_eur: Math.max(0, cash_eur),
		settings,
		position_count: positions.length
	};
}
