<script lang="ts">
	// Trade journal: each operation is a row that expands to reveal the full
	// decision context the agent recorded (thesis, bear case, catalysts, risks,
	// score, fair-value upside). Lets you audit *why* the agent traded, not just what.
	let { data } = $props();
	const p = $derived(data.portfolio);

	const fmtEur = (n: number) =>
		new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(n || 0);
	const fmtPct = (n: number) =>
		new Intl.NumberFormat('es-ES', { style: 'percent', maximumFractionDigits: 1 }).format(n || 0);
	const fmtDate = (s: string) =>
		new Date(s).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });

	// Which trade id is currently expanded. Null = all collapsed.
	let expanded: number | null = $state(null);
	function toggle(id: number) {
		expanded = expanded === id ? null : id;
	}

	// Fair-value upside at the moment of the trade (only meaningful for buys).
	function tradeUpside(t: any): number | null {
		if (!t.fair_value_eur || !t.price_eur || t.price_eur === 0) return null;
		return (t.fair_value_eur - t.price_eur) / t.price_eur;
	}

	// fmtPct doesn't accept null; this wrapper short-circuits.
	const fmtPctOrDash = (n: number | null) => (n == null ? '—' : fmtPct(n));

	const scoreColor = (s: number | null) =>
		s == null ? '' : s >= 75 ? 'text-[var(--color-up)]' : s >= 60 ? 'text-[var(--color-warn)]' : 'text-[var(--color-down)]';

	// Has any trade got extended context beyond the basic fields?
	const hasContext = $derived(p.trades.some((t: any) => t.catalysts || t.risks || t.score || t.bear_case || t.fair_value_eur));
</script>

<div class="p-6 space-y-6">
	<header class="flex items-end justify-between">
		<div>
			<div class="text-[11px] uppercase tracking-widest text-[var(--color-text-muted)] font-medium">Operacional</div>
			<h1 class="text-3xl font-bold text-[var(--color-text-primary)] mt-1">Diario de operaciones</h1>
			<p class="text-[var(--color-text-muted)] text-sm mt-1">{p.trades.length} operaciones · click en una fila para ver el razonamiento completo del agente</p>
		</div>
	</header>

	{#if p.trades.length === 0}
		<div class="border border-dashed border-[var(--color-border-strong)] rounded-xl p-12 text-center">
			<p class="text-[var(--color-text-muted)]">Sin operaciones registradas todavía.</p>
		</div>
	{:else}
		<div class="border border-[var(--color-border)] rounded-lg bg-[var(--color-surface)] overflow-hidden">
			<table class="w-full text-sm">
				<thead>
					<tr class="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] border-b border-[var(--color-border)]">
						<th class="px-4 py-2 text-left w-8"></th>
						<th class="px-4 py-2 text-left">Fecha</th>
						<th class="px-4 py-2 text-left">Ticker</th>
						<th class="px-4 py-2 text-left">Tipo</th>
						<th class="px-4 py-2 text-right">Acciones</th>
						<th class="px-4 py-2 text-right">Precio local</th>
						<th class="px-4 py-2 text-right">FX</th>
						<th class="px-4 py-2 text-right">Precio €</th>
						<th class="px-4 py-2 text-right">Importe</th>
						{#if hasContext}
							<th class="px-4 py-2 text-right">Score</th>
							<th class="px-4 py-2 text-right">Upside</th>
						{/if}
					</tr>
				</thead>
				<tbody class="divide-y divide-[var(--color-border)]">
					{#each p.trades as t (t.id)}
						<tr
							class="hover:bg-[var(--color-surface-hover)] cursor-pointer {expanded === t.id ? 'bg-[var(--color-surface-hover)]' : ''}"
							onclick={() => toggle(t.id)}
						>
							<td class="px-4 py-2 text-[var(--color-text-muted)] text-center">
								<span class="inline-block transition-transform {expanded === t.id ? 'rotate-90' : ''}">▶</span>
							</td>
							<td class="px-4 py-2 text-[var(--color-text-muted)]">{fmtDate(t.executed_at)}</td>
							<td class="px-4 py-2 font-mono text-[var(--color-text-primary)]">{t.ticker}</td>
							<td class="px-4 py-2">
								<span class="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium {t.side === 'buy' ? 'bg-[var(--color-up)]/20 text-[var(--color-up)]' : 'bg-[var(--color-down)]/20 text-[var(--color-down)]'}">{t.side === 'buy' ? 'BUY' : 'SELL'}</span>
							</td>
							<td class="px-4 py-2 text-right tabular">{t.shares}</td>
							<td class="px-4 py-2 text-right tabular text-[var(--color-text-muted)]">{t.price_local.toFixed(2)}</td>
							<td class="px-4 py-2 text-right tabular text-[var(--color-text-muted)]">{t.fx_rate.toFixed(4)}</td>
							<td class="px-4 py-2 text-right tabular">{fmtEur(t.price_eur)}</td>
							<td class="px-4 py-2 text-right tabular font-medium">{fmtEur(t.shares * t.price_eur)}</td>
							{#if hasContext}
								<td class="px-4 py-2 text-right tabular {scoreColor(t.score)}">{t.score ?? '—'}</td>
								<td class="px-4 py-2 text-right tabular">
									{#if tradeUpside(t) != null}
										<span class="{tradeUpside(t)! >= 0 ? 'text-[var(--color-up)]' : 'text-[var(--color-down)]'}">{fmtPctOrDash(tradeUpside(t))}</span>
									{:else}
										<span class="text-[var(--color-text-muted)]">—</span>
									{/if}
								</td>
							{/if}
						</tr>
						{#if expanded === t.id}
							<tr class="bg-[var(--color-bg-elevated)]">
								<td colspan={hasContext ? 11 : 9} class="px-8 py-4">
									<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
										<!-- Thesis -->
										{#if t.thesis}
											<div>
												<div class="text-[10px] uppercase tracking-widest text-[var(--color-accent)] mb-1">Tesis</div>
												<p class="text-xs text-[var(--color-text-secondary)] leading-relaxed">{t.thesis}</p>
											</div>
										{/if}
										<!-- Bear case -->
										{#if t.bear_case}
											<div>
												<div class="text-[10px] uppercase tracking-widest text-[var(--color-down)] mb-1">Caso contrario (bear)</div>
												<p class="text-xs text-[var(--color-down)]/80 leading-relaxed border-l-2 border-[var(--color-down)] pl-2">{t.bear_case}</p>
											</div>
										{/if}
										<!-- Catalysts -->
										{#if t.catalysts}
											<div>
												<div class="text-[10px] uppercase tracking-widest text-[var(--color-up)] mb-1">Catalizadores</div>
												<p class="text-xs text-[var(--color-text-secondary)] leading-relaxed">{t.catalysts}</p>
											</div>
										{/if}
										<!-- Risks -->
										{#if t.risks}
											<div>
												<div class="text-[10px] uppercase tracking-widest text-[var(--color-warn)] mb-1">Riesgos</div>
												<p class="text-xs text-[var(--color-text-secondary)] leading-relaxed">{t.risks}</p>
											</div>
										{/if}
										<!-- Fair value reference -->
										{#if t.fair_value_eur}
											<div>
												<div class="text-[10px] uppercase tracking-widest text-[var(--color-text-muted)] mb-1">Valor razonable</div>
												<p class="text-xs text-[var(--color-text-secondary)] tabular">
													{fmtEur(t.fair_value_eur)} por acción
													{#if tradeUpside(t) != null}
														<span class="ml-2 {tradeUpside(t)! >= 0 ? 'text-[var(--color-up)]' : 'text-[var(--color-down)]'}">({fmtPctOrDash(tradeUpside(t))} vs precio pagado)</span>
													{/if}
												</p>
											</div>
										{/if}
									</div>
									{#if !t.thesis && !t.bear_case && !t.catalysts && !t.risks && !t.fair_value_eur}
										<p class="text-xs text-[var(--color-text-muted)] italic">El agente no registró contexto adicional para esta operación.</p>
									{/if}
								</td>
							</tr>
						{/if}
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</div>
