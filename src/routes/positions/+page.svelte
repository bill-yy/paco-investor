<script lang="ts">
	let { data } = $props();
	const p = $derived(data.portfolio);

	const fmtEur = (n: number) =>
		new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 }).format(n || 0);
	const fmtPct = (n: number) =>
		new Intl.NumberFormat('es-ES', { style: 'percent', maximumFractionDigits: 2 }).format(n || 0);

	const totalCapital = $derived((data.marketValue?.total_eur ?? p.cash_eur + (p.invested_eur || 0)));

	// Map ticker -> live market data (current price, market value) for upside calc.
	const liveMap = $derived.by(() => {
		const m = new Map<string, { current_price_eur: number; market_value_eur: number }>();
		for (const lp of data.marketValue?.positions ?? []) m.set(lp.ticker, lp);
		return m;
	});

	// Group by sector
	const bySector = $derived.by(() => {
		const map: Record<string, number> = {};
		for (const pos of p.positions) {
			// Use live market value when available for the sector breakdown.
			const val = liveMap.get(pos.ticker)?.market_value_eur ?? pos.shares * pos.avg_price_eur;
			map[pos.sector] = (map[pos.sector] || 0) + val;
		}
		return Object.entries(map).map(([sector, value]) => ({ sector, value })).sort((a, b) => b.value - a.value);
	});

	// Live upside vs fair value (from the position record).
	function liveUpside(pos: any): number | null {
		const live = liveMap.get(pos.ticker);
		if (!pos.fair_value_eur || !live?.current_price_eur || live.current_price_eur === 0) return null;
		return (pos.fair_value_eur - live.current_price_eur) / live.current_price_eur;
	}

	// Unrealized P&L vs cost basis.
	function unrealizedPnl(pos: any): { eur: number; pct: number } | null {
		const live = liveMap.get(pos.ticker);
		if (!live) return null;
		const cost = pos.shares * pos.avg_price_eur;
		const market = live.market_value_eur;
		if (cost === 0) return null;
		return { eur: market - cost, pct: (market - cost) / cost };
	}

	const scoreColor = (s: number | null) =>
		s == null ? '' : s >= 75 ? 'text-[var(--color-up)]' : s >= 60 ? 'text-[var(--color-warn)]' : 'text-[var(--color-down)]';

	const hasThesis = $derived(p.positions.some((pos) => pos.thesis || pos.bear_case || pos.catalysts || pos.risks));
</script>

<div class="p-6 space-y-6">
	<header>
		<div class="text-[11px] uppercase tracking-widest text-[var(--color-text-muted)] font-medium">Cartera</div>
		<h1 class="text-3xl font-bold text-[var(--color-text-primary)] mt-1">Posiciones</h1>
		<p class="text-[var(--color-text-muted)] text-sm mt-1">{data.marketValue ? 'Valoración a precio de mercado en vivo' : 'Valoración a coste (Yahoo no disponible)'}</p>
	</header>

	{#if p.position_count === 0}
		<div class="border border-dashed border-[var(--color-border-strong)] rounded-xl p-12 text-center">
			<p class="text-[var(--color-text-muted)]">Sin posiciones abiertas todavía.</p>
		</div>
	{:else}
		<div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
			<!-- Sector breakdown -->
			<div class="border border-[var(--color-border)] rounded-lg bg-[var(--color-surface)] p-4">
				<h2 class="text-sm font-semibold mb-3 text-[var(--color-text-primary)]">Por sector</h2>
				<div class="space-y-2">
					{#each bySector as s}
						<div>
							<div class="flex justify-between text-xs mb-1">
								<span class="text-[var(--color-text-secondary)]">{s.sector}</span>
								<span class="tabular text-[var(--color-text-muted)]">{fmtPct(totalCapital > 0 ? s.value / totalCapital : 0)}</span>
							</div>
							<div class="h-1.5 bg-[var(--color-bg-elevated)] rounded overflow-hidden">
								<div class="h-full bg-gradient-to-r from-[var(--color-accent)] to-[var(--color-up)]" style="width: {Math.min(100, (totalCapital > 0 ? s.value / totalCapital : 0) * 100)}%"></div>
							</div>
						</div>
					{/each}
				</div>
			</div>

			<!-- Positions -->
			<div class="lg:col-span-2 border border-[var(--color-border)] rounded-lg bg-[var(--color-surface)] overflow-hidden overflow-x-auto">
				<table class="w-full text-sm">
					<thead>
						<tr class="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] border-b border-[var(--color-border)]">
							<th class="px-4 py-2 text-left">Empresa</th>
							<th class="px-4 py-2 text-right">Acciones</th>
							<th class="px-4 py-2 text-right">P. medio</th>
							<th class="px-4 py-2 text-right">P. actual</th>
							<th class="px-4 py-2 text-right">P&amp;L</th>
							<th class="px-4 py-2 text-right">Valor</th>
							<th class="px-4 py-2 text-right">Peso</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-[var(--color-border)]">
						{#each p.positions as pos}
							{@const pnl = unrealizedPnl(pos)}
							{@const live = liveMap.get(pos.ticker)}
							<tr class="hover:bg-[var(--color-surface-hover)]">
								<td class="px-4 py-3">
									<div class="font-medium text-[var(--color-text-primary)]">{pos.company_name}</div>
									<div class="text-[10px] font-mono text-[var(--color-text-muted)]">{pos.ticker} · {pos.market}</div>
								</td>
								<td class="px-4 py-3 text-right tabular text-[var(--color-text-secondary)]">{pos.shares}</td>
								<td class="px-4 py-3 text-right tabular text-[var(--color-text-secondary)]">{fmtEur(pos.avg_price_eur)}</td>
								<td class="px-4 py-3 text-right tabular text-[var(--color-text-secondary)]">
									{live ? fmtEur(live.current_price_eur) : '—'}
								</td>
								<td class="px-4 py-3 text-right tabular">
									{#if pnl}
										<div class="{pnl.pct >= 0 ? 'text-[var(--color-up)]' : 'text-[var(--color-down)]'}">
											{fmtPct(pnl.pct)}
											<div class="text-[10px] text-[var(--color-text-muted)]">{pnl.eur >= 0 ? '+' : ''}{fmtEur(pnl.eur)}</div>
										</div>
									{:else}
										<span class="text-[var(--color-text-muted)]">—</span>
									{/if}
								</td>
								<td class="px-4 py-3 text-right tabular font-medium text-[var(--color-text-primary)]">
									{fmtEur(live?.market_value_eur ?? pos.shares * pos.avg_price_eur)}
								</td>
								<td class="px-4 py-3 text-right tabular text-[var(--color-text-secondary)]">{fmtPct(totalCapital > 0 ? (live?.market_value_eur ?? pos.shares * pos.avg_price_eur) / totalCapital : 0)}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</div>

		<!-- Thesis cards (enriched: catalysts, risks, fair value, live upside) -->
		{#if hasThesis}
			<div class="border border-[var(--color-border)] rounded-lg bg-[var(--color-surface)] p-4">
				<h2 class="text-sm font-semibold mb-3 text-[var(--color-text-primary)]">Tesis, argumentos y valoración</h2>
				<div class="grid grid-cols-1 md:grid-cols-2 gap-3">
					{#each p.positions.filter((pos) => pos.thesis || pos.bear_case || pos.catalysts || pos.risks || pos.fair_value_eur) as pos}
						{@const upside = liveUpside(pos)}
						<div class="border border-[var(--color-border)] rounded p-3 space-y-2">
							<div class="flex items-center justify-between">
								<div>
									<span class="font-mono text-xs text-[var(--color-accent)]">{pos.ticker}</span>
									<span class="text-xs text-[var(--color-text-muted)] ml-2">{pos.company_name}</span>
								</div>
								<div class="flex gap-2">
									{#if pos.score}
										<span class="text-[10px] tabular {scoreColor(pos.score)}" title="Score del agente">{pos.score}/100</span>
									{/if}
									{#if upside != null}
										<span class="text-[10px] tabular {upside >= 0 ? 'text-[var(--color-up)]' : 'text-[var(--color-down)]'}" title="Upside actual vs valor razonable">
											{upside >= 0 ? '+' : ''}{(upside * 100).toFixed(1)}%
										</span>
									{/if}
								</div>
							</div>
							{#if pos.thesis}
								<p class="text-xs text-[var(--color-text-secondary)] leading-relaxed">{pos.thesis}</p>
							{/if}
							{#if pos.bear_case}
								<div class="text-[11px] text-[var(--color-down)]/80 border-l-2 border-[var(--color-down)] pl-2 leading-relaxed">{pos.bear_case}</div>
							{/if}
							{#if pos.catalysts}
								<div>
									<div class="text-[9px] uppercase tracking-widest text-[var(--color-up)] mb-0.5">Catalizadores</div>
									<p class="text-[11px] text-[var(--color-text-muted)] leading-relaxed">{pos.catalysts}</p>
								</div>
							{/if}
							{#if pos.risks}
								<div>
									<div class="text-[9px] uppercase tracking-widest text-[var(--color-warn)] mb-0.5">Riesgos</div>
									<p class="text-[11px] text-[var(--color-text-muted)] leading-relaxed">{pos.risks}</p>
								</div>
							{/if}
							{#if pos.fair_value_eur}
								<div class="pt-1 border-t border-[var(--color-border)] flex justify-between items-center text-[10px]">
									<span class="text-[var(--color-text-muted)]">Valor razonable: <span class="tabular text-[var(--color-text-secondary)]">{fmtEur(pos.fair_value_eur)}</span></span>
									{#if upside != null}
										<span class="tabular {upside >= 0 ? 'text-[var(--color-up)]' : 'text-[var(--color-down)]'}">{upside >= 0 ? '+' : ''}{(upside * 100).toFixed(1)}% upside</span>
									{/if}
								</div>
							{/if}
						</div>
					{/each}
				</div>
			</div>
		{/if}
	{/if}
</div>
