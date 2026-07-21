// Portfolio valuation engine: market value, snapshots, performance stats.
//
// Snapshots are taken at two points:
//   1. After every trade (trade-triggered, see executeTrade in portfolio.ts)
//   2. On demand via POST /api/snapshot (for crons / agent calls between trades)
//
// Each snapshot persists both the cost basis (invested_eur) and the live market
// value (positions_market_eur) so the equity curve reflects real mark-to-market,
// not just the cash spent. The benchmark (S&P 500, USD) is stored in its native
// currency and converted to EUR for apples-to-apples comparison.

import { getDb } from './db';
import { getQuote, getFxRate } from './yahoo';
import { BENCHMARK, BENCHMARK_CURRENCY, INITIAL_CAPITAL_EUR } from './config';
import type { Position, Valuation } from './db';

export interface MarketValuation {
	/** Sum of shares * avg_price_eur (cost basis of open positions). */
	invested_eur: number;
	/** Sum of shares * current_price_eur (mark-to-market of open positions). */
	positions_market_eur: number;
	/** Live cash position: initial capital + sell proceeds - buy costs. */
	cash_eur: number;
	/** cash_eur + positions_market_eur. */
	total_eur: number;
	/** Benchmark quote in native currency (e.g. S&P 500 points). */
	benchmark_value: number | null;
	/** Benchmark converted to EUR. */
	benchmark_eur: number | null;
	/** Per-position live prices, for upside calculations in the UI. */
	positions: Array<Position & { current_price_eur: number; market_value_eur: number }>;
}

/**
 * Compute the live mark-to-market value of the portfolio by fetching current
 * quotes for every open position and the benchmark. Falls back gracefully:
 * a failed quote for one ticker is treated as market_value = cost basis for
 * that position so the whole computation never throws on a single Yahoo hiccup.
 */
export async function computeMarketValue(): Promise<MarketValuation> {
	const db = getDb();
	const positions = db
		.prepare(`SELECT * FROM positions WHERE status = 'open' ORDER BY (shares * avg_price_eur) DESC`)
		.all() as Position[];
	const trades = db.prepare('SELECT * FROM trades').all() as Array<{
		side: 'buy' | 'sell';
		shares: number;
		price_eur: number;
		fee_eur: number;
	}>;

	const settingsRow = db.prepare('SELECT * FROM settings').all() as Array<{
		key: string;
		value: string;
	}>;
	const settings: Record<string, string> = {};
	for (const s of settingsRow) settings[s.key] = s.value;
	const initialCapital = parseFloat(settings.initial_capital || String(INITIAL_CAPITAL_EUR));

	const cash_eur = Math.max(
		0,
		initialCapital +
			trades.filter((t) => t.side === 'sell').reduce((s, t) => s + t.shares * t.price_eur - t.fee_eur, 0) -
			trades.filter((t) => t.side === 'buy').reduce((s, t) => s + t.shares * t.price_eur + t.fee_eur, 0)
	);

	// Fetch all position quotes in parallel. allSettled so one failure doesn't abort.
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
				// Fallback: use cost basis so portfolio total stays sensible.
				return { ...pos, current_price_eur: pos.avg_price_eur, market_value_eur: pos.shares * pos.avg_price_eur };
			}
		})
	);

	const positions_market_eur = enriched.reduce((s, p) => s + p.market_value_eur, 0);
	const invested_eur = positions.reduce((s, p) => s + p.shares * p.avg_price_eur, 0);

	// Benchmark (S&P 500) — native + EUR.
	let benchmark_value: number | null = null;
	let benchmark_eur: number | null = null;
	try {
		const bq = await getQuote(BENCHMARK);
		benchmark_value = bq.price;
		let bfx = 1;
		if (bq.currency !== 'EUR') bfx = await getFxRate(`${bq.currency}EUR`);
		benchmark_eur = bq.price * bfx;
	} catch {
		// Leave null — stats will degrade gracefully.
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

/**
 * Persist a valuation snapshot. Idempotent per-day via the UNIQUE(timestamp)
 * constraint: the timestamp is truncated to date (YYYY-MM-DD), so multiple
 * trades or snapshot calls on the same day upsert the same row.
 */
export async function saveValuation(): Promise<Valuation> {
	const db = getDb();
	const mv = await computeMarketValue();
	// Truncate to day granularity for the UNIQUE constraint.
	const timestamp = new Date().toISOString().slice(0, 10);

	db.prepare(
		`INSERT INTO valuations
		 (timestamp, cash_eur, positions_eur, positions_market_eur, total_eur, invested_eur, benchmark_value, benchmark_eur)
		 VALUES (?,?,?,?,?,?,?,?)
		 ON CONFLICT(timestamp) DO UPDATE SET
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
		mv.benchmark_eur
	);

	const row = db.prepare('SELECT * FROM valuations WHERE timestamp = ?').get(timestamp) as Valuation;
	return row;
}

/**
 * Read the historical valuation series for charting. Returns ascending by time.
 * `days` limits to the last N days (default 6 months).
 */
export function getValuations(days = 180): Valuation[] {
	const db = getDb();
	return db
		.prepare(
			`SELECT * FROM valuations
			 WHERE timestamp >= date('now', ?)
			 ORDER BY timestamp ASC`
		)
		.all(`-${days} days`) as Valuation[];
}

export interface ValuationStats {
	/** Total return vs initial capital, based on latest mark-to-market total. */
	total_return_pct: number;
	/** Compound annual growth rate from first to last snapshot. Null if < 1 year of data. */
	cagr_pct: number | null;
	/** Maximum peak-to-trough drawdown observed in the series. Null if <2 snapshots. */
	max_drawdown_pct: number | null;
	/** Latest total minus initial capital, in EUR. */
	abs_gain_eur: number;
	/** Benchmark return over the same window, normalized to the initial capital. */
	benchmark_return_pct: number | null;
	/** Alpha = portfolio return - benchmark return. Null if benchmark unavailable. */
	alpha_pct: number | null;
	/** Number of snapshots in the series. */
	snapshots: number;
}

/**
 * Compute performance statistics over the valuation series. All returns are
 * relative to INITIAL_CAPITAL_EUR so the curve and the stats share the same
 * baseline. With < 2 snapshots, returns degrade to 0/null gracefully.
 */
export function getValuationStats(series: Valuation[] | null | undefined): ValuationStats {
	const s = Array.isArray(series) ? series : [];
	const n = s.length;
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
	const baseline = INITIAL_CAPITAL_EUR;

	const total_return_pct = (latest.total_eur - baseline) / baseline;
	const abs_gain_eur = latest.total_eur - baseline;

	// CAGR — only meaningful across >= 1 year.
	let cagr_pct: number | null = null;
	if (n >= 2) {
		const first = s[0];
		const days =
			(new Date(latest.timestamp).getTime() - new Date(first.timestamp).getTime()) /
			(1000 * 60 * 60 * 24);
		if (days >= 365 && first.total_eur > 0) {
			const years = days / 365;
			cagr_pct = Math.pow(latest.total_eur / first.total_eur, 1 / years) - 1;
		}
	}

	// Max drawdown: largest peak-to-trough drop in total_eur.
	// With <2 snapshots there is no series to measure a drawdown over, so we
	// return null (not 0) — the UI then shows "—" consistently with alpha.
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

	// Benchmark return over the same window, using its EUR series normalized
	// to the initial capital (so it's directly comparable to total_return_pct).
	// Requires >=2 snapshots: without an entry point there's no benchmark return
	// to compare against, and we'd rather show "—" than fabricate a misleading 0.
	let benchmark_return_pct: number | null = null;
	let alpha_pct: number | null = null;
	if (n >= 2 && s[0].benchmark_eur != null && s[n - 1].benchmark_eur != null && s[0].benchmark_eur > 0) {
		// Revalue the benchmark as if the initial capital had been invested in it.
		const first = s[0];
		const last = s[n - 1];
		const benchmarkStart = baseline; // hypothetical €10k in the benchmark
		const ratio = last.benchmark_eur! / first.benchmark_eur!;
		const benchmarkEnd = benchmarkStart * ratio;
		benchmark_return_pct = (benchmarkEnd - benchmarkStart) / benchmarkStart;
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
