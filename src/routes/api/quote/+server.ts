import type { RequestHandler } from './$types';
import { json, error } from '@sveltejs/kit';
import { getQuote, getQuoteDetails, getFxRate } from '$lib/server/yahoo';

export const GET: RequestHandler = async ({ url }) => {
	const ticker = url.searchParams.get('ticker');
	const details = url.searchParams.get('details') === 'true';

	if (!ticker) throw error(400, 'ticker required');

	try {
		const quote = await getQuote(ticker);
		let fx = 1;
		if (quote.currency !== 'EUR') {
			try {
				fx = await getFxRate(`${quote.currency}EUR`);
			} catch {
				fx = 1;
			}
		}

		let fundamentals: any = null;
		if (details) {
			try {
				fundamentals = await getQuoteDetails(ticker);
			} catch (e) {
				// fundamentals are optional
			}
		}

		return json({
			ticker: ticker.toUpperCase(),
			price: quote.price,
			previous_close: quote.previousClose,
			currency: quote.currency,
			exchange: quote.exchange,
			change: quote.change,
			change_percent: quote.changePercent,
			price_eur: quote.price * fx,
			fx_rate: fx,
			fundamentals
		});
	} catch (e: any) {
		throw error(502, `Yahoo API error: ${e?.message || 'unknown'}`);
	}
};
