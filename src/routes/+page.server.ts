import type { PageServerLoad } from './$types';
import { getPortfolioSnapshot } from '$lib/server/portfolio';
import { getMarketOverview, getSectorPerformance } from '$lib/server/market';

export const load: PageServerLoad = async () => {
	const portfolio = await getPortfolioSnapshot();

	let market: Awaited<ReturnType<typeof getMarketOverview>> = [];
	let sectors: Awaited<ReturnType<typeof getSectorPerformance>> = [];

	try {
		[market, sectors] = await Promise.all([getMarketOverview(), getSectorPerformance()]);
	} catch (e) {
		console.error('Market data failed:', e);
	}

	return { portfolio, market, sectors };
};
