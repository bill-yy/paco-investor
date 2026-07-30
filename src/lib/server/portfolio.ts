// Portfolio operations: open, close, buy, sell — multi-strategy
import { getDb } from './db';
import { getQuote, getFxRate } from './yahoo';
import { saveValuation } from './valuation';
import type { Position, Trade, Strategy } from './db';

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
	strategy_id?: string;
	stop_loss_eur?: number;
	take_profit_eur?: number;
	entry_signal?: string;
	trade_plan?: string;
	exit_reason?: string;
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
	const strategyId = input.strategy_id || 'value';

	// Live price
	const q = await getQuote(ticker);
	const price_local = q.price;

	// FX to EUR
	let fx_rate = 1;
	if (q.currency !== 'EUR') {
		fx_rate = await getFxRate(`${q.currency}EUR`);
	}
	const price_eur = price_local * fx_rate;
	const fee_eur = 0;
	const executed_at = input.executed_at || new Date().toISOString();

	const tx = db.transaction(() => {
		// Find existing position for this strategy + ticker
		const existing = db
			.prepare('SELECT * FROM positions WHERE ticker = ? AND strategy_id = ? AND status = ?')
			.get(ticker, strategyId, 'open') as Position | undefined;

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
					     fair_value_eur = ?, thesis = ?, bear_case = ?, score = ?, catalysts = ?, risks = ?,
					     stop_loss_eur = ?, take_profit_eur = ?, entry_signal = ?, trade_plan = ?
					 WHERE id = ?`
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
					input.stop_loss_eur ?? existing.stop_loss_eur,
					input.take_profit_eur ?? existing.take_profit_eur,
					input.entry_signal ?? existing.entry_signal,
					input.trade_plan ?? existing.trade_plan,
					existing.id
				);
			} else {
				db.prepare(
					`INSERT INTO positions
					 (ticker, isin, company_name, market, sector, currency, shares, avg_price_local, avg_price_eur,
					  opened_at, fair_value_eur, thesis, bear_case, score, catalysts, risks, status, strategy_id,
					  stop_loss_eur, take_profit_eur, entry_signal, trade_plan)
					 VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?, ?, 'open', ?, ?, ?, ?, ?)`
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
					input.risks ?? null,
					strategyId,
					input.stop_loss_eur ?? null,
					input.take_profit_eur ?? null,
					input.entry_signal ?? null,
					input.trade_plan ?? null
				);
			}
		} else {
			// SELL
			if (!existing) throw new Error(`Cannot sell ${ticker}: no open position in strategy ${strategyId}`);
			const newShares = existing.shares - input.shares;
			if (newShares < -0.0001) throw new Error(`Cannot sell more shares than held for ${ticker}`);
			db.prepare(
				`UPDATE positions
				 SET shares = ?, status = CASE WHEN ? <= 0 THEN 'closed' ELSE 'open' END
				 WHERE id = ?`
			).run(Math.max(0, newShares), newShares, existing.id);
		}

		// Record trade (with full decision context + strategy)
		const info = db
			.prepare(
				`INSERT INTO trades
				 (executed_at, ticker, isin, company_name, side, shares, price_local, price_eur, fx_rate, fee_eur,
				  thesis, catalysts, risks, fair_value_eur, score, bear_case, strategy_id, exit_reason)
				 VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?, ?, ?)`
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
				input.bear_case ?? null,
				strategyId,
				input.exit_reason ?? null
			);
		const trade = db.prepare('SELECT * FROM trades WHERE id = ?').get(info.lastInsertRowid) as Trade;
		return { existing, trade };
	});

	const { trade } = tx();

	const finalPos = db
		.prepare('SELECT * FROM positions WHERE ticker = ? AND strategy_id = ? ORDER BY id DESC LIMIT 1')
		.get(ticker, strategyId) as Position;

	try {
		await saveValuation(strategyId);
	} catch (e) {
		console.error('[snapshot] post-trade valuation failed:', e);
	}

	return {
		trade,
		avg_price_local: finalPos?.avg_price_local ?? price_local,
		avg_price_eur: finalPos?.avg_price_eur ?? price_eur,
		fx_rate,
		price_local,
		price_eur,
		fee_eur
	};
}

export function getStrategies(): Strategy[] {
	const db = getDb();
	return db.prepare('SELECT * FROM strategies ORDER BY id').all() as Strategy[];
}

export function getStrategy(id: string): Strategy | undefined {
	const db = getDb();
	return db.prepare('SELECT * FROM strategies WHERE id = ?').get(id) as Strategy | undefined;
}

export function getPortfolioSnapshot(strategyId?: string) {
	const db = getDb();
	const sid = strategyId || 'value';

	const positions = db
		.prepare(
			`SELECT * FROM positions WHERE status = 'open' AND strategy_id = ? ORDER BY (shares * avg_price_eur) DESC`
		)
		.all(sid) as Position[];

	const trades = db
		.prepare('SELECT * FROM trades WHERE strategy_id = ? ORDER BY executed_at DESC')
		.all(sid) as Trade[];

	const strategy = getStrategy(sid);

	const invested_eur = positions.reduce(
		(sum, p) => sum + p.shares * p.avg_price_eur,
		0
	);

	// Calculate cash for this strategy
	const initialCapital = strategy?.initial_capital_eur ?? 0;
	const contributions = (
		db
			.prepare('SELECT COALESCE(SUM(amount_eur), 0) as total FROM contributions WHERE strategy_id = ?')
			.get(sid) as { total: number }
	).total;

	const buys = trades
		.filter((t) => t.side === 'buy')
		.reduce((s, t) => s + t.shares * t.price_eur + t.fee_eur, 0);
	const sells = trades
		.filter((t) => t.side === 'sell')
		.reduce((s, t) => s + t.shares * t.price_eur - t.fee_eur, 0);

	const cash_eur = initialCapital + contributions + sells - buys;

	return {
		strategy,
		positions,
		trades,
		invested_eur,
		cash_eur: Math.max(0, cash_eur),
		position_count: positions.length,
		// Total capital put into this strategy (initial + DCA contributions)
		capital_invested: initialCapital + contributions
	};
}

export function getAllSnapshots() {
	return ['value', 'trader', 'funds'].map((id) => {
		const snap = getPortfolioSnapshot(id);
		return {
			strategy_id: id,
			...snap
		};
	});
}

export function addContribution(strategyId: string, amountEur: number, date?: string) {
	const db = getDb();
	const d = date || new Date().toISOString().slice(0, 7) + '-01'; // YYYY-MM-01
	db.prepare(
		'INSERT OR REPLACE INTO contributions (strategy_id, date, amount_eur) VALUES (?, ?, ?)'
	).run(strategyId, d, amountEur);
	return { strategy_id: strategyId, date: d, amount_eur: amountEur };
}
