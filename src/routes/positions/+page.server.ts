import type { PageServerLoad } from './$types';
import { getPortfolioSnapshot } from '$lib/server/portfolio';
import { computeMarketValue } from '$lib/server/valuation';

export const load: PageServerLoad = async ({ url }) => {
	const strategyId = url.searchParams.get('strategy') || 'value';
	const portfolio = getPortfolioSnapshot(strategyId);

	let marketValue: Awaited<ReturnType<typeof computeMarketValue>> | null = null;
	try {
		marketValue = await computeMarketValue(strategyId);
	} catch (e) {
		console.error('Position market valuation failed:', e);
	}

	return { portfolio, marketValue, strategyId };
};
