<script lang="ts">
	import Kpi from '$lib/components/Kpi.svelte';
	import EquityCurve from '$lib/components/EquityCurve.svelte';
	import StrategyComparison from '$lib/components/StrategyComparison.svelte';
	import ComparisonChart from '$lib/components/ComparisonChart.svelte';
	import MarketPanel from '$lib/components/MarketPanel.svelte';

	let { data } = $props();
	const p = $derived(data.portfolio);
	const strategyId = $derived(data.strategyId || 'value');

	const fmtEur = (n: number) =>
		new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 }).format(n || 0);
	const fmtEurShort = (n: number) => {
		if (Math.abs(n) >= 1000) return new Intl.NumberFormat('es-ES', { maximumFractionDigits: 1 }).format(n / 1000) + 'k €';
		return fmtEur(n);
	};
	const fmtPct = (n: number) =>
		new Intl.NumberFormat('es-ES', { style: 'percent', maximumFractionDigits: 2 }).format(n || 0);
	const fmtDate = (s: string) => new Date(s).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });

	const totalInvested = $derived(p.invested_eur || 0);
	const totalCapital = $derived(data.marketValue?.total_eur ?? p.cash_eur + totalInvested);
	const baselineCapital = $derived(p.strategy?.initial_capital_eur || 0);

	const sectors = $derived((data.sectors || []).slice().sort((a, b) => b.change_pct - a.change_pct));
	const marketItems = $derived(data.market || []);

	const moodIdx = $derived(marketItems.filter((i) => i.category === 'Índices' && i.change_pct > 0).length);
	const moodTotal = $derived(marketItems.filter((i) => i.category === 'Índices').length || 1);
	const mood = $derived(
		moodIdx / moodTotal > 0.65 ? { label: 'Risk-On', color: 'up' }
		: moodIdx / moodTotal < 0.35 ? { label: 'Risk-Off', color: 'down' }
		: { label: 'Neutral', color: 'warn' }
	);

	const strategiesForChart = $derived(
		(data.strategies || []).map((s) => ({ id: s.id, name: s.name, color: s.color }))
	);

	// Strategy-specific labels
	const strategyDesc = $derived(
		strategyId === 'value' ? 'Análisis fundamental · 3-7 años'
		: strategyId === 'trader' ? 'Swing trading técnico · 5-30 días'
		: 'ETFs pasivos · rebalanceo trimestral'
	);
</script>

<div class="p-4 md:p-6 space-y-5 md:space-y-6">
	<!-- Header -->
	<header class="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
		<div>
			<div class="text-[11px] uppercase tracking-widest text-[var(--color-text-muted)] font-medium">
				{p.strategy?.name ?? 'Dashboard'}
			</div>
			<h1 class="text-2xl md:text-3xl font-bold text-[var(--color-text-primary)] mt-1">{strategyDesc}</h1>
		</div>
		<div class="sm:text-right">
			<div class="text-xs text-[var(--color-text-muted)] capitalize">{new Date().toLocaleDateString('es-ES', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}</div>
			<div class="flex items-center gap-1.5 sm:justify-end mt-1">
				<span class="w-1.5 h-1.5 rounded-full bg-[var(--color-{mood.color})] pulse-dot"></span>
				<span class="text-xs font-medium text-[var(--color-{mood.color})]">Sentimiento: {mood.label}</span>
			</div>
		</div>
	</header>

	<!-- Strategy comparison cards -->
	<StrategyComparison comparison={data.comparison} allValuations={data.allValuations} />

	<!-- KPI row -->
	<div class="grid grid-cols-2 md:grid-cols-5 gap-2 md:gap-3">
		<Kpi label="Patrimonio" value={fmtEur(totalCapital)} hint={data.marketValue ? 'A precio de mercado' : 'Invertido + liquidez'} />
		<Kpi label="Invertido" value={fmtEur(totalInvested)} hint="{fmtPct(totalCapital > 0 ? totalInvested / totalCapital : 0)} del capital" />
		<Kpi label="Liquidez" value={fmtEur(p.cash_eur)} hint="{fmtPct(totalCapital > 0 ? p.cash_eur / totalCapital : 0)} disponible" accent={p.cash_eur / (totalCapital || 1) > 0.4 ? 'warn' : 'default'} />
		<Kpi
			label="Rentabilidad"
			value={baselineCapital > 0 ? fmtPct((totalCapital - baselineCapital) / baselineCapital) : '—'}
			change={baselineCapital > 0 ? ((totalCapital - baselineCapital) / baselineCapital) * 100 : 0}
			accent={totalCapital >= baselineCapital ? 'up' : 'down'}
		/>
		<Kpi
			label="vs S&P 500"
			value={data.stats?.alpha_pct != null ? fmtPct(data.stats.alpha_pct) : '—'}
			hint={data.stats?.max_drawdown_pct != null ? `DD máx ${fmtPct(data.stats.max_drawdown_pct)}` : 'Sin histórico'}
			accent={data.stats?.alpha_pct == null ? 'default' : data.stats.alpha_pct >= 0 ? 'up' : 'down'}
		/>
	</div>

	<!-- Two-column: equity curve + market panel -->
	<div class="grid grid-cols-1 lg:grid-cols-3 gap-5 md:gap-6">
		<!-- Left: equity curves (2/3 width) -->
		<div class="lg:col-span-2 space-y-5 md:space-y-6">
			{#if (data.strategies?.length ?? 0) > 1 && (data.allValuations ?? Object.keys(data.allValuations ?? {}).length) > 0}
				<div class="border border-[var(--color-border)] rounded-lg bg-[var(--color-surface)] p-3 md:p-4">
					<div class="flex items-center justify-between mb-3">
						<h2 class="text-sm font-semibold text-[var(--color-text-primary)]">Comparativa de estrategias</h2>
						<span class="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)]">Patrimonio total</span>
					</div>
					<ComparisonChart allValuations={data.allValuations} strategies={strategiesForChart} />
				</div>
			{/if}

			{#if data.valuations?.length > 0}
				<div class="border border-[var(--color-border)] rounded-lg bg-[var(--color-surface)] p-3 md:p-4">
					<div class="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-3 gap-1">
						<div>
							<h2 class="text-sm font-semibold text-[var(--color-text-primary)]">{p.strategy?.name} — Evolución</h2>
							<p class="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] mt-0.5">{data.valuations.length} snapshots</p>
						</div>
						{#if data.stats?.cagr_pct != null}
							<span class="text-[10px] text-[var(--color-text-muted)]">CAGR <span class="tabular text-[var(--color-text-secondary)]">{fmtPct(data.stats.cagr_pct)}</span></span>
						{/if}
					</div>
					<EquityCurve valuations={data.valuations} />
				</div>
			{/if}

			<!-- Positions -->
			{#if p.position_count === 0}
				<div class="border border-dashed border-[var(--color-border-strong)] rounded-xl p-8 md:p-10 text-center bg-[var(--color-surface)]">
					<div class="text-[var(--color-text-secondary)] font-medium">
						{strategyId === 'trader' ? 'Estrategia Trader en fase de acumulación' : strategyId === 'funds' ? 'Pendiente de primer aporte DCA' : 'Cartera recién inicializada'}
					</div>
					<p class="text-[var(--color-text-muted)] text-sm mt-2">
						{strategyId === 'trader' ? '100 €/mes hasta acumular capital operable · Próximo: 3 ago' : strategyId === 'funds' ? '100 €/mes DCA · Próximo aporte: 2 ago' : '10.000 € en liquidez · Pendiente de primera compra'}
					</p>
				</div>
			{:else}
				<div class="border border-[var(--color-border)] rounded-lg overflow-hidden bg-[var(--color-surface)]">
					<div class="px-4 py-3 border-b border-[var(--color-border)] flex items-center justify-between">
						<h2 class="text-sm font-semibold text-[var(--color-text-primary)]">Posiciones abiertas</h2>
						<span class="text-xs text-[var(--color-text-muted)]">{p.position_count} activas</span>
					</div>

					<!-- Desktop table -->
					<table class="hidden sm:table w-full text-sm">
						<thead>
							<tr class="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] border-b border-[var(--color-border)]">
								<th class="px-4 py-2 text-left">Empresa</th>
								<th class="px-4 py-2 text-right">Acciones</th>
								<th class="px-4 py-2 text-right">P. medio</th>
								{#if data.marketValue?.positions?.length}
									<th class="px-4 py-2 text-right">P. actual</th>
									<th class="px-4 py-2 text-right">P&L</th>
								{/if}
								<th class="px-4 py-2 text-right">Valor</th>
							</tr>
						</thead>
						<tbody class="divide-y divide-[var(--color-border)]">
							{#each p.positions as pos, i}
								{@const live = data.marketValue?.positions?.find((mp) => mp.ticker === pos.ticker)}
								<tr class="hover:bg-[var(--color-surface-hover)]">
									<td class="px-4 py-3">
										<div class="font-medium text-[var(--color-text-primary)]">{pos.company_name}</div>
										<div class="text-[10px] text-[var(--color-text-muted)] font-mono">{pos.ticker} · {pos.sector}</div>
									</td>
									<td class="px-4 py-3 text-right tabular text-[var(--color-text-secondary)]">{pos.shares}</td>
									<td class="px-4 py-3 text-right tabular text-[var(--color-text-secondary)]">{fmtEur(pos.avg_price_eur)}</td>
									{#if data.marketValue?.positions?.length}
										<td class="px-4 py-3 text-right tabular text-[var(--color-text-secondary)]">{live ? fmtEur(live.current_price_eur) : '—'}</td>
										<td class="px-4 py-3 text-right tabular {live && live.current_price_eur >= pos.avg_price_eur ? 'text-[var(--color-up)]' : 'text-[var(--color-down)]'}">
											{#if live}
												{fmtPct((live.current_price_eur - pos.avg_price_eur) / pos.avg_price_eur)}
											{:else}
												—
											{/if}
										</td>
									{/if}
									<td class="px-4 py-3 text-right tabular font-medium text-[var(--color-text-primary)]">
										{live ? fmtEur(live.market_value_eur) : fmtEur(pos.shares * pos.avg_price_eur)}
									</td>
								</tr>
							{/each}
						</tbody>
					</table>

					<!-- Mobile cards -->
					<div class="sm:hidden divide-y divide-[var(--color-border)]">
						{#each p.positions as pos}
							{@const live = data.marketValue?.positions?.find((mp) => mp.ticker === pos.ticker)}
							<div class="p-3">
								<div class="flex items-start justify-between gap-2">
									<div class="min-w-0 flex-1">
										<div class="font-medium text-[var(--color-text-primary)] truncate">{pos.company_name}</div>
										<div class="text-[10px] text-[var(--color-text-muted)] font-mono truncate">{pos.ticker} · {pos.sector}</div>
									</div>
									<div class="text-right shrink-0">
										<div class="font-medium tabular text-[var(--color-text-primary)]">{live ? fmtEurShort(live.market_value_eur) : fmtEurShort(pos.shares * pos.avg_price_eur)}</div>
										{#if live}
											<div class="text-[10px] tabular {live.current_price_eur >= pos.avg_price_eur ? 'text-[var(--color-up)]' : 'text-[var(--color-down)]'}">
												{fmtPct((live.current_price_eur - pos.avg_price_eur) / pos.avg_price_eur)}
											</div>
										{/if}
									</div>
								</div>
							</div>
						{/each}
					</div>
				</div>
			{/if}
		</div>

		<!-- Right column: market + sectors -->
		<div class="space-y-4">
			<MarketPanel items={marketItems} />

			<!-- Sector heatmap -->
			<div class="border border-[var(--color-border)] rounded-lg bg-[var(--color-surface)] p-3">
				<div class="flex items-center justify-between mb-2">
					<h2 class="text-xs font-semibold text-[var(--color-text-primary)]">Sectores S&P</h2>
					<span class="text-[9px] uppercase tracking-wider text-[var(--color-text-muted)]">Hoy</span>
				</div>
				<div class="grid grid-cols-3 gap-1">
					{#each sectors as s}
						<div
							class="p-1.5 rounded text-center border"
							style="background-color: {s.change_pct >= 0 ? `rgba(16, 185, 129, ${Math.min(0.5, 0.15 + Math.abs(s.change_pct) * 8)})` : `rgba(239, 68, 68, ${Math.min(0.5, 0.15 + Math.abs(s.change_pct) * 8)})`}; border-color: {s.change_pct >= 0 ? 'rgba(16, 185, 129, 0.4)' : 'rgba(239, 68, 68, 0.4)'}"
						>
							<div class="text-[8px] text-white/80 truncate">{s.name}</div>
							<div class="text-[10px] font-semibold tabular text-white">{(s.change_pct * 100).toFixed(1)}%</div>
						</div>
					{/each}
				</div>
			</div>
		</div>
	</div>

	<!-- Recent trades -->
	{#if p.trades.length > 0}
		<div class="border border-[var(--color-border)] rounded-lg overflow-hidden bg-[var(--color-surface)]">
			<div class="px-4 py-3 border-b border-[var(--color-border)]">
				<h2 class="text-sm font-semibold text-[var(--color-text-primary)]">Operaciones recientes · {p.strategy?.name}</h2>
			</div>

			<table class="hidden sm:table w-full text-sm">
				<thead>
					<tr class="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] border-b border-[var(--color-border)]">
						<th class="px-4 py-2 text-left">Fecha</th>
						<th class="px-4 py-2 text-left">Ticker</th>
						<th class="px-4 py-2 text-left">Tipo</th>
						<th class="px-4 py-2 text-right">Acciones</th>
						<th class="px-4 py-2 text-right">Precio</th>
						<th class="px-4 py-2 text-right">Importe</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-[var(--color-border)]">
					{#each p.trades.slice(0, 10) as t}
						<tr>
							<td class="px-4 py-2 text-[var(--color-text-muted)]">{fmtDate(t.executed_at)}</td>
							<td class="px-4 py-2 font-mono text-[var(--color-text-primary)]">{t.ticker}</td>
							<td class="px-4 py-2">
								<span class="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium {t.side === 'buy' ? 'bg-[var(--color-up)]/20 text-[var(--color-up)]' : 'bg-[var(--color-down)]/20 text-[var(--color-down)]'}">
									{t.side === 'buy' ? 'BUY' : 'SELL'}
								</span>
							</td>
							<td class="px-4 py-2 text-right tabular text-[var(--color-text-secondary)]">{t.shares}</td>
							<td class="px-4 py-2 text-right tabular text-[var(--color-text-secondary)]">{fmtEur(t.price_eur)}</td>
							<td class="px-4 py-2 text-right tabular font-medium text-[var(--color-text-primary)]">{fmtEur(t.shares * t.price_eur)}</td>
						</tr>
					{/each}
				</tbody>
			</table>

			<div class="sm:hidden divide-y divide-[var(--color-border)]">
				{#each p.trades.slice(0, 10) as t}
					<div class="p-3 flex items-center gap-3">
						<span class="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium shrink-0 {t.side === 'buy' ? 'bg-[var(--color-up)]/20 text-[var(--color-up)]' : 'bg-[var(--color-down)]/20 text-[var(--color-down)]'}">
							{t.side === 'buy' ? 'BUY' : 'SELL'}
						</span>
						<div class="min-w-0 flex-1">
							<div class="font-mono text-sm text-[var(--color-text-primary)]">{t.ticker}</div>
							<div class="text-[10px] text-[var(--color-text-muted)]">{fmtDate(t.executed_at)} · {t.shares} acc. × {fmtEur(t.price_eur)}</div>
						</div>
						<div class="text-right shrink-0">
							<div class="font-medium tabular text-[var(--color-text-primary)] text-sm">{fmtEurShort(t.shares * t.price_eur)}</div>
						</div>
					</div>
				{/each}
			</div>
		</div>
	{/if}
</div>
