import type { PageServerLoad } from './$types';
import { getPortfolioSnapshot } from '$lib/server/portfolio';
import { computeMarketValue } from '$lib/server/valuation';

export const load: PageServerLoad = async () => {
	const portfolio = await getPortfolioSnapshot();

	// Live mark-to-market: gives current price per position so we can show
	// unrealized P&L and live upside vs fair value. Best-effort.
	let marketValue: Awaited<ReturnType<typeof computeMarketValue>> | null = null;
	try {
		marketValue = await computeMarketValue();
	} catch (e) {
		console.error('Position market valuation failed:', e);
	}

	return { portfolio, marketValue };
};
