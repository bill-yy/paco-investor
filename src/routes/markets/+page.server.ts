import type { PageServerLoad } from './$types';
import { getMarketOverview, getSectorPerformance } from '$lib/server/market';

export const load: PageServerLoad = async () => {
	const [market, sectors] = await Promise.all([
		getMarketOverview(),
		getSectorPerformance()
	]);
	return { market, sectors };
};
