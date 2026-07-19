import type { PageServerLoad } from './$types';
import { getPortfolioSnapshot } from '$lib/server/portfolio';

export const load: PageServerLoad = async () => {
	const portfolio = await getPortfolioSnapshot();
	return { portfolio };
};
