<script lang="ts">
	let { data } = $props();
	const p = $derived(data.portfolio);

	const fmtEur = (n: number) =>
		new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 }).format(n || 0);

	const fmtPct = (n: number) =>
		new Intl.NumberFormat('es-ES', { style: 'percent', maximumFractionDigits: 2 }).format(n || 0);

	const totalCapital = $derived(p.cash_eur + (p.invested_eur || 0));

	// Group by sector
	const bySector = $derived.by(() => {
		const map: Record<string, number> = {};
		for (const pos of p.positions) {
			map[pos.sector] = (map[pos.sector] || 0) + pos.shares * pos.avg_price_eur;
		}
		return Object.entries(map).map(([sector, value]) => ({ sector, value })).sort((a, b) => b.value - a.value);
	});
</script>

<div class="p-6 space-y-6">
	<header>
		<div class="text-[11px] uppercase tracking-widest text-[var(--color-text-muted)] font-medium">Cartera</div>
		<h1 class="text-3xl font-bold text-[var(--color-text-primary)] mt-1">Posiciones</h1>
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
			<div class="lg:col-span-2 border border-[var(--color-border)] rounded-lg bg-[var(--color-surface)] overflow-hidden">
				<table class="w-full text-sm">
					<thead>
						<tr class="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] border-b border-[var(--color-border)]">
							<th class="px-4 py-2 text-left">Empresa</th>
							<th class="px-4 py-2 text-right">Acciones</th>
							<th class="px-4 py-2 text-right">P. medio</th>
							<th class="px-4 py-2 text-right">Invertido</th>
							<th class="px-4 py-2 text-right">Peso</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-[var(--color-border)]">
						{#each p.positions as pos}
							<tr class="hover:bg-[var(--color-surface-hover)]">
								<td class="px-4 py-3">
									<div class="font-medium text-[var(--color-text-primary)]">{pos.company_name}</div>
									<div class="text-[10px] font-mono text-[var(--color-text-muted)]">{pos.ticker} · {pos.market}</div>
								</td>
								<td class="px-4 py-3 text-right tabular text-[var(--color-text-secondary)]">{pos.shares}</td>
								<td class="px-4 py-3 text-right tabular text-[var(--color-text-secondary)]">{fmtEur(pos.avg_price_eur)}</td>
								<td class="px-4 py-3 text-right tabular text-[var(--color-text-primary)]">{fmtEur(pos.shares * pos.avg_price_eur)}</td>
								<td class="px-4 py-3 text-right tabular text-[var(--color-text-secondary)]">{fmtPct(totalCapital > 0 ? (pos.shares * pos.avg_price_eur) / totalCapital : 0)}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</div>

		<!-- Tesis -->
		{#if p.positions.some((pos) => pos.thesis)}
			<div class="border border-[var(--color-border)] rounded-lg bg-[var(--color-surface)] p-4">
				<h2 class="text-sm font-semibold mb-3 text-[var(--color-text-primary)]">Tesis y argumentos contrarios</h2>
				<div class="grid grid-cols-1 md:grid-cols-2 gap-3">
					{#each p.positions.filter((pos) => pos.thesis) as pos}
						<div class="border border-[var(--color-border)] rounded p-3">
							<div class="flex items-center justify-between mb-1">
								<div class="font-mono text-xs text-[var(--color-accent)]">{pos.ticker}</div>
								{#if pos.score}
									<span class="text-[10px] tabular {pos.score >= 75 ? 'text-[var(--color-up)]' : pos.score >= 60 ? 'text-[var(--color-warn)]' : 'text-[var(--color-down)]'}">{pos.score}/100</span>
								{/if}
							</div>
							<div class="text-xs text-[var(--color-text-secondary)]">{pos.thesis}</div>
							{#if pos.bear_case}
								<div class="mt-2 text-[11px] text-[var(--color-down)]/80 border-l-2 border-[var(--color-down)] pl-2">{pos.bear_case}</div>
							{/if}
						</div>
					{/each}
				</div>
			</div>
		{/if}
	{/if}
</div>
