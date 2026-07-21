import type { PageServerLoad } from './$types';
import { getPortfolioSnapshot } from '$lib/server/portfolio';
import { getMarketOverview, getSectorPerformance } from '$lib/server/market';
import { computeMarketValue, getValuations, getValuationStats } from '$lib/server/valuation';

export const load: PageServerLoad = async () => {
	const portfolio = await getPortfolioSnapshot();

	// Market data (indices/commodities/rates + S&P sectors) — best-effort.
	let market: Awaited<ReturnType<typeof getMarketOverview>> = [];
	let sectors: Awaited<ReturnType<typeof getSectorPerformance>> = [];
	try {
		[market, sectors] = await Promise.all([getMarketOverview(), getSectorPerformance()]);
	} catch (e) {
		console.error('Market data failed:', e);
	}

	// Live mark-to-market valuation (for the Patrimonio KPI + position upside).
	// Best-effort: falls back to cost basis if Yahoo fails.
	let marketValue: Awaited<ReturnType<typeof computeMarketValue>> | null = null;
	try {
		marketValue = await computeMarketValue();
	} catch (e) {
		console.error('Market valuation failed:', e);
	}

	// Historical series + stats (never throw — empty series degrades gracefully).
	const valuations = getValuations(180);
	const stats = getValuationStats(valuations);

	return { portfolio, market, sectors, marketValue, valuations, stats };
};
