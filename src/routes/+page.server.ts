import type { PageServerLoad } from './$types';
import { getPortfolioSnapshot, getStrategies, getAllSnapshots, addContribution } from '$lib/server/portfolio';
import { getMarketOverview, getSectorPerformance, getStrategyMarketData } from '$lib/server/market';
import { computeMarketValue, getValuations, getValuationStats, getValuationsByStrategy } from '$lib/server/valuation';

export const load: PageServerLoad = async ({ url }) => {
	// Strategy selector from URL query (?strategy=value|trader|funds)
	const strategyId = url.searchParams.get('strategy') || 'value';

	// Wrap each data fetch independently so one failure doesn't crash the page
	let portfolio: any;
	let strategies: any[] = [];
	let allSnapshots: any[] = [];
	let market: any[] = [];
	let sectors: any[] = [];
	let marketValue: any = null;
	let valuations: any[] = [];
	let stats: any = null;
	let comparison: any[] = [];
	let allValuations: Record<string, any[]> = {};

	try {
		portfolio = getPortfolioSnapshot(strategyId);
	} catch (e) {
		console.error('Portfolio snapshot failed:', e);
		portfolio = { positions: [], trades: [], invested_eur: 0, cash_eur: 10000, position_count: 0, strategy: null };
	}

	try {
		strategies = getStrategies();
	} catch (e) {
		console.error('Strategies load failed:', e);
	}

	try {
		allSnapshots = getAllSnapshots();
	} catch (e) {
		console.error('All snapshots failed:', e);
	}

	try {
		// For trader/funds, show their universe instead of generic indices
		if (strategyId === 'trader' || strategyId === 'funds') {
			const stratMarket = await getStrategyMarketData(strategyId);
			market = stratMarket || [];
			sectors = [];
		} else {
			[market, sectors] = await Promise.all([getMarketOverview(), getSectorPerformance()]);
		}
	} catch (e) {
		console.error('Market data failed:', e);
	}

	try {
		marketValue = await computeMarketValue(strategyId);
	} catch (e) {
		console.error('Market valuation failed:', e);
	}

	try {
		valuations = getValuations(strategyId, 365);
		const baseline = portfolio?.strategy?.initial_capital_eur || 10000;
		stats = getValuationStats(valuations, baseline);
	} catch (e) {
		console.error('Valuations failed:', e);
		valuations = [];
		stats = getValuationStats([], 10000);
	}

	try {
		allValuations = getValuationsByStrategy(365);
	} catch (e) {
		console.error('All valuations failed:', e);
	}

	// Summary KPIs for each strategy
	try {
		comparison = allSnapshots.map((snap) => {
			const mv = allValuations[snap.strategy_id] || [];
			const latest = mv[mv.length - 1];
			const baseline = snap.strategy?.initial_capital_eur || 0;
			const contributions = (snap.strategy?.monthly_contribution_eur || 0) * Math.max(0, mv.length);
			const totalInvested = baseline + contributions;
			return {
				strategy_id: snap.strategy_id,
				name: snap.strategy?.name || snap.strategy_id,
				color: snap.strategy?.color || '#3b82f6',
				icon: snap.strategy?.icon || 'P',
				type: snap.strategy?.type || 'value',
				total_eur: latest?.total_eur ?? snap.cash_eur,
				total_invested: totalInvested,
				return_pct: totalInvested > 0 ? ((latest?.total_eur ?? snap.cash_eur) - totalInvested) / totalInvested : 0,
				positions: snap.position_count,
				monthly_contribution: snap.strategy?.monthly_contribution_eur || 0,
				initial_capital: snap.strategy?.initial_capital_eur || 0,
				description: snap.strategy?.description || ''
			};
		});
	} catch (e) {
		console.error('Comparison build failed:', e);
	}

	return {
		strategyId,
		portfolio,
		strategies,
		market,
		sectors,
		marketValue,
		valuations,
		stats,
		comparison,
		allValuations
	};
};
