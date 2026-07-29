// Portfolio valuation engine: market value, snapshots, performance stats.
// Multi-strategy: every function accepts an optional strategyId parameter.

import { getDb } from './db';
import { getQuote, getFxRate } from './yahoo';
import { BENCHMARK, BENCHMARK_CURRENCY } from './config';
import { getStrategy } from './portfolio';
import type { Position, Valuation } from './db';

export interface MarketValuation {
	invested_eur: number;
	positions_market_eur: number;
	cash_eur: number;
	total_eur: number;
	benchmark_value: number | null;
	benchmark_eur: number | null;
	positions: Array<Position & { current_price_eur: number; market_value_eur: number }>;
}

export async function computeMarketValue(strategyId = 'value'): Promise<MarketValuation> {
	const db = getDb();
	const sid = strategyId;

	const positions = db
		.prepare(
			`SELECT * FROM positions WHERE status = 'open' AND strategy_id = ? ORDER BY (shares * avg_price_eur) DESC`
		)
		.all(sid) as Position[];

	const trades = db
		.prepare('SELECT * FROM trades WHERE strategy_id = ?')
		.all(sid) as Array<{
			side: 'buy' | 'sell';
			shares: number;
			price_eur: number;
			fee_eur: number;
		}>;

	const strategy = getStrategy(sid);
	const initialCapital = strategy?.initial_capital_eur ?? 0;

	// Contributions (monthly DCA)
	const contributions =
		(
			db
				.prepare('SELECT COALESCE(SUM(amount_eur), 0) as total FROM contributions WHERE strategy_id = ?')
				.get(sid) as { total: number }
		).total ?? 0;

	const cash_eur = Math.max(
		0,
		initialCapital +
			contributions +
			trades.filter((t) => t.side === 'sell').reduce((s, t) => s + t.shares * t.price_eur - t.fee_eur, 0) -
			trades.filter((t) => t.side === 'buy').reduce((s, t) => s + t.shares * t.price_eur + t.fee_eur, 0)
	);

	// Fetch all position quotes in parallel.
	const enriched = await Promise.all(
		positions.map(async (pos) => {
			try {
				const q = await getQuote(pos.ticker);
				let fx = 1;
				if (q.currency !== 'EUR') fx = await getFxRate(`${q.currency}EUR`);
				const current_price_eur = q.price * fx;
				return {
					...pos,
					current_price_eur,
					market_value_eur: pos.shares * current_price_eur
				};
			} catch {
				return { ...pos, current_price_eur: pos.avg_price_eur, market_value_eur: pos.shares * pos.avg_price_eur };
			}
		})
	);

	const positions_market_eur = enriched.reduce((s, p) => s + p.market_value_eur, 0);
	const invested_eur = positions.reduce((s, p) => s + p.shares * p.avg_price_eur, 0);

	// Benchmark
	let benchmark_value: number | null = null;
	let benchmark_eur: number | null = null;
	try {
		const bq = await getQuote(BENCHMARK);
		benchmark_value = bq.price;
		let bfx = 1;
		if (bq.currency !== 'EUR') bfx = await getFxRate(`${bq.currency}EUR`);
		benchmark_eur = bq.price * bfx;
	} catch {
		// Leave null
	}

	return {
		invested_eur,
		positions_market_eur,
		cash_eur,
		total_eur: cash_eur + positions_market_eur,
		benchmark_value,
		benchmark_eur,
		positions: enriched
	};
}

export async function saveValuation(strategyId = 'value'): Promise<Valuation> {
	const db = getDb();
	const mv = await computeMarketValue(strategyId);
	const timestamp = new Date().toISOString().slice(0, 10);
	const sid = strategyId;

	db.prepare(
		`INSERT INTO valuations
		 (timestamp, cash_eur, positions_eur, positions_market_eur, total_eur, invested_eur, benchmark_value, benchmark_eur, strategy_id)
		 VALUES (?,?,?,?,?,?,?,?,?)
		 ON CONFLICT(timestamp, strategy_id) DO UPDATE SET
		   cash_eur = excluded.cash_eur,
		   positions_eur = excluded.positions_eur,
		   positions_market_eur = excluded.positions_market_eur,
		   total_eur = excluded.total_eur,
		   invested_eur = excluded.invested_eur,
		   benchmark_value = excluded.benchmark_value,
		   benchmark_eur = excluded.benchmark_eur`
	).run(
		timestamp,
		mv.cash_eur,
		mv.invested_eur,
		mv.positions_market_eur,
		mv.total_eur,
		mv.invested_eur,
		mv.benchmark_value,
		mv.benchmark_eur,
		sid
	);

	const row = db
		.prepare('SELECT * FROM valuations WHERE timestamp = ? AND strategy_id = ?')
		.get(timestamp, sid) as Valuation;
	return row;
}

export function getValuations(strategyId = 'value', days = 365): Valuation[] {
	const db = getDb();
	return db
		.prepare(
			`SELECT * FROM valuations
			 WHERE strategy_id = ? AND timestamp >= date('now', ?)
			 ORDER BY timestamp ASC`
		)
		.all(strategyId, `-${days} days`) as Valuation[];
}

export function getValuationsByStrategy(days = 365): Record<string, Valuation[]> {
	const db = getDb();
	const strategies = ['value', 'trader', 'funds'];
	const result: Record<string, Valuation[]> = {};
	for (const sid of strategies) {
		result[sid] = db
			.prepare(
				`SELECT * FROM valuations
				 WHERE strategy_id = ? AND timestamp >= date('now', ?)
				 ORDER BY timestamp ASC`
			)
			.all(sid, `-${days} days`) as Valuation[];
	}
	return result;
}

export interface ValuationStats {
	total_return_pct: number;
	cagr_pct: number | null;
	max_drawdown_pct: number | null;
	abs_gain_eur: number;
	benchmark_return_pct: number | null;
	alpha_pct: number | null;
	snapshots: number;
}

export function getValuationStats(
	series: Valuation[] | null | undefined,
	baselineCapital?: number
): ValuationStats {
	const s = Array.isArray(series) ? series : [];
	const n = s.length;
	const baseline = baselineCapital ?? 10000;

	if (n === 0) {
		return {
			total_return_pct: 0,
			cagr_pct: null,
			max_drawdown_pct: null,
			abs_gain_eur: 0,
			benchmark_return_pct: null,
			alpha_pct: null,
			snapshots: 0
		};
	}

	const latest = s[n - 1];
	const totalCapital = baseline + s.reduce((_, _v, i) => 0, 0); // contributions handled elsewhere

	const total_return_pct = (latest.total_eur - baseline) / baseline;
	const abs_gain_eur = latest.total_eur - baseline;

	let cagr_pct: number | null = null;
	if (n >= 2) {
		const first = s[0];
		const days =
			(new Date(latest.timestamp).getTime() - new Date(first.timestamp).getTime()) /
			(1000 * 60 * 60 * 24);
		if (days >= 30 && first.total_eur > 0) {
			const years = days / 365;
			cagr_pct = Math.pow(latest.total_eur / first.total_eur, 1 / years) - 1;
		}
	}

	let max_drawdown_pct: number | null = null;
	if (n >= 2) {
		let peak = s[0].total_eur;
		let worst = 0;
		for (const v of s) {
			if (v.total_eur > peak) peak = v.total_eur;
			if (peak > 0) {
				const dd = (v.total_eur - peak) / peak;
				if (dd < worst) worst = dd;
			}
		}
		max_drawdown_pct = worst;
	}

	let benchmark_return_pct: number | null = null;
	let alpha_pct: number | null = null;
	if (n >= 2 && s[0].benchmark_eur != null && s[n - 1].benchmark_eur != null && s[0].benchmark_eur > 0) {
		const ratio = s[n - 1].benchmark_eur! / s[0].benchmark_eur!;
		benchmark_return_pct = ratio - 1;
		alpha_pct = total_return_pct - benchmark_return_pct;
	}

	return {
		total_return_pct,
		cagr_pct,
		max_drawdown_pct,
		abs_gain_eur,
		benchmark_return_pct,
		alpha_pct,
		snapshots: n
	};
}
