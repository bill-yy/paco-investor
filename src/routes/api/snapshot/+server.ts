// POST /api/snapshot — force a portfolio valuation snapshot on demand.
//
// Trades already capture a snapshot automatically (see executeTrade). This
// endpoint lets the agent or an external cron capture a snapshot between trades
// (e.g. weekly close with no activity). No body required.
import { json } from '@sveltejs/kit';
import { saveValuation } from '$lib/server/valuation';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async () => {
	try {
		const snapshot = await saveValuation();
		return json({ ok: true, snapshot }, { status: 201 });
	} catch (e: any) {
		console.error('[snapshot] failed:', e);
		return json({ ok: false, error: e?.message ?? 'snapshot failed' }, { status: 502 });
	}
};

// GET convenience alias — so the dashboard or a browser can trigger it too.
export const GET: RequestHandler = POST;
