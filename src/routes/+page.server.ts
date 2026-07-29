import type { PageServerLoad } from './$types';
import { getPortfolioSnapshot, getStrategies, getAllSnapshots, addContribution } from '$lib/server/portfolio';
import { getMarketOverview, getSectorPerformance } from '$lib/server/market';
import { computeMarketValue, getValuations, getValuationStats, getValuationsByStrategy } from '$lib/server/valuation';

export const load: PageServerLoad = async ({ url }) => {
	// Strategy selector from URL query (?strategy=value|trader|funds)
	const strategyId = url.searchParams.get('strategy') || 'value';

	const portfolio = getPortfolioSnapshot(strategyId);
	const strategies = getStrategies();
	const allSnapshots = getAllSnapshots();

	// Market data
	let market: Awaited<ReturnType<typeof getMarketOverview>> = [];
	let sectors: Awaited<ReturnType<typeof getSectorPerformance>> = [];
	try {
		[market, sectors] = await Promise.all([getMarketOverview(), getSectorPerformance()]);
	} catch (e) {
		console.error('Market data failed:', e);
	}

	// Live mark-to-market for selected strategy
	let marketValue: Awaited<ReturnType<typeof computeMarketValue>> | null = null;
	try {
		marketValue = await computeMarketValue(strategyId);
	} catch (e) {
		console.error('Market valuation failed:', e);
	}

	// Historical series for selected strategy
	const valuations = getValuations(strategyId, 365);
	const baseline = portfolio.strategy?.initial_capital_eur || 0;
	const stats = getValuationStats(valuations, baseline);

	// Comparative data: all 3 strategies' valuations for the comparison chart
	const allValuations = getValuationsByStrategy(365);

	// Summary KPIs for each strategy (for the comparison cards)
	const comparison = allSnapshots.map((snap) => {
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
