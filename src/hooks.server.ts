// Server lifecycle hooks for PacoInvestor.
//
// Internal snapshot scheduler: runs entirely inside the Node process (no
// external deps, no Hermes cron). Takes a mark-to-market valuation snapshot
// of ALL strategies every SNAPSHOT_INTERVAL_MS so the equity curve has high
// granularity without manual triggers.
//
// Schedule:
//   - Market hours check (Mon–Fri 9:00–22:00 CET / 07:00–20:00 UTC)
//   - Snapshot every 4 hours during market hours (3x/day: ~11:00, 15:00, 19:00 UTC)
//   - Outside market hours or weekends: skip
//
// This is a best-effort background task. Failures are logged but never crash
// the server. The Hermes weekly/daily crons remain the authoritative sources
// for trading decisions; this cron only enriches the equity curve.

import type { Handle } from '@sveltejs/kit';
import { saveValuation } from '$lib/server/valuation';

const SNAPSHOT_INTERVAL_MS = 4 * 60 * 60 * 1000; // check every 4 hours
const ALL_STRATEGIES = ['value', 'trader', 'funds'] as const;

function isMarketOpen(): boolean {
	// Use UTC to avoid timezone config issues in Docker.
	// CET = UTC+1 (winter) / UTC+2 (summer). We use a wide window
	// (7:00–20:00 UTC) that covers 9:00–22:00 CET in both cases.
	const now = new Date();
	const utcHours = now.getUTCHours();
	const utcDay = now.getUTCDay(); // 0=Sun, 6=Sat
	// Monday–Friday only (skip weekends)
	if (utcDay === 0 || utcDay === 6) return false;
	// 9:00–22:00 CET ≈ 7:00–20:00 UTC (covers both CET/CEST)
	return utcHours >= 7 && utcHours < 20;
}

async function takeSnapshots() {
	if (!isMarketOpen()) return;
	console.log('[snapshot-cron] Taking periodic snapshots for all strategies...');
	for (const sid of ALL_STRATEGIES) {
		try {
			await saveValuation(sid);
			console.log(`[snapshot-cron] ✓ ${sid} snapshot saved`);
		} catch (e) {
			console.error(`[snapshot-cron] ✗ ${sid} snapshot failed:`, e);
		}
	}
}

// Start the scheduler once per process (module-level singleton).
// SvelteKit may import this module multiple times during dev HMR, so guard
// with a global flag to prevent duplicate intervals.
declare global {
	// eslint-disable-next-line no-var
	var __paco_snapshot_interval: ReturnType<typeof setInterval> | undefined;
}

if (!globalThis.__paco_snapshot_interval) {
	// Initial snapshot after 30s (let server fully boot + DB migrate)
	setTimeout(() => {
		takeSnapshots().catch((e) => console.error('[snapshot-cron] initial run failed:', e));
	}, 30_000);

	globalThis.__paco_snapshot_interval = setInterval(() => {
		takeSnapshots().catch((e) => console.error('[snapshot-cron] periodic run failed:', e));
	}, SNAPSHOT_INTERVAL_MS);

	console.log(`[snapshot-cron] Started — interval=${SNAPSHOT_INTERVAL_MS / 3600000}h, market window Mon–Fri 7:00–20:00 UTC`);
}

export const handle: Handle = async ({ event, resolve }) => {
	return resolve(event);
};
