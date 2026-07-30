import type { PageServerLoad } from './$types';
import { getPortfolioSnapshot } from '$lib/server/portfolio';

export const load: PageServerLoad = async ({ url }) => {
	const strategyId = url.searchParams.get('strategy') || 'value';
	const portfolio = getPortfolioSnapshot(strategyId);
	return { portfolio, strategyId };
};
