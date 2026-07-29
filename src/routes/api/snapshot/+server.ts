// POST /api/snapshot — force a portfolio valuation snapshot on demand.
// Accepts optional ?strategy=value|trader|funds|all in the body or query.
// Default: snapshot ALL strategies.
import { json } from '@sveltejs/kit';
import { saveValuation } from '$lib/server/valuation';
import type { RequestHandler } from './$types';

const ALL_STRATEGIES = ['value', 'trader', 'funds'];

export const POST: RequestHandler = async ({ request, url }) => {
	let body: any = {};
	try {
		body = await request.json();
	} catch {
		// No body or invalid JSON — that's fine, use query param or default
	}

	const requested = body.strategy || url.searchParams.get('strategy') || 'all';
	const strategies = requested === 'all' ? ALL_STRATEGIES : [requested];

	const results: Record<string, any> = {};
	const errors: Record<string, string> = {};

	for (const sid of strategies) {
		try {
			results[sid] = await saveValuation(sid);
		} catch (e: any) {
			console.error(`[snapshot] strategy ${sid} failed:`, e);
			errors[sid] = e?.message ?? 'failed';
		}
	}

	const hasErrors = Object.keys(errors).length > 0;
	return json(
		{ ok: !hasErrors, snapshots: results, errors: hasErrors ? errors : undefined },
		{ status: 201 }
	);
};

// GET convenience alias
export const GET: RequestHandler = async ({ url }) => {
	const requested = url.searchParams.get('strategy') || 'all';
	const strategies = requested === 'all' ? ALL_STRATEGIES : [requested];

	const results: Record<string, any> = {};
	for (const sid of strategies) {
		try {
			results[sid] = await saveValuation(sid);
		} catch (e: any) {
			console.error(`[snapshot] strategy ${sid} failed:`, e);
		}
	}
	return json({ ok: true, snapshots: results }, { status: 201 });
};
