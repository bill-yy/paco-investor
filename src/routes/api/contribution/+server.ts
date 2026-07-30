import type { RequestHandler } from './$types';
import { json, error } from '@sveltejs/kit';
import { addContribution } from '$lib/server/portfolio';
import { getDb } from '$lib/server/db';

// POST /api/contribution
// Registers a monthly DCA contribution for a strategy.
// Body: { "strategy_id": "trader", "date": "2026-01-01", "amount_eur": 100 }
// Idempotent via UNIQUE(strategy_id, date) constraint.
export const POST: RequestHandler = async ({ request }) => {
	let body: any;
	try {
		body = await request.json();
	} catch {
		throw error(400, 'Invalid JSON');
	}

	if (!body.strategy_id) throw error(400, 'strategy_id required');
	if (!body.amount_eur || typeof body.amount_eur !== 'number') throw error(400, 'amount_eur must be a number');
	if (!body.date) throw error(400, 'date required (YYYY-MM-DD)');

	const result = addContribution(body.strategy_id, body.amount_eur, body.date);
	return json(result, { status: 201 });
};

// DELETE /api/contribution?strategy_id=funds&date=2026-07-01
export const DELETE: RequestHandler = async ({ url }) => {
	const strategyId = url.searchParams.get('strategy_id');
	const date = url.searchParams.get('date');
	if (!strategyId || !date) throw error(400, 'strategy_id and date required');

	const db = getDb();
	const info = db.prepare('DELETE FROM contributions WHERE strategy_id = ? AND date = ?').run(strategyId, date);
	return json({ deleted: info.changes, strategy_id: strategyId, date });
};
