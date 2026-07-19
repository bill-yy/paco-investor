import type { RequestHandler } from './$types';
import { json, error } from '@sveltejs/kit';
import { executeTrade } from '$lib/server/portfolio';

export const POST: RequestHandler = async ({ request }) => {
	let body: any;
	try {
		body = await request.json();
	} catch {
		throw error(400, 'Invalid JSON');
	}

	const required = ['ticker', 'company_name', 'market', 'sector', 'side', 'shares'];
	for (const f of required) {
		if (!body[f]) throw error(400, `Missing field: ${f}`);
	}
	if (!['buy', 'sell'].includes(body.side)) throw error(400, 'side must be buy or sell');
	if (typeof body.shares !== 'number' || body.shares <= 0) throw error(400, 'shares must be > 0');

	const result = await executeTrade({
		ticker: body.ticker,
		isin: body.isin,
		company_name: body.company_name,
		market: body.market,
		sector: body.sector,
		side: body.side,
		shares: body.shares,
		fair_value_eur: body.fair_value_eur,
		thesis: body.thesis,
		bear_case: body.bear_case,
		score: body.score,
		catalysts: body.catalysts,
		risks: body.risks
	});

	return json(result, { status: 201 });
};
