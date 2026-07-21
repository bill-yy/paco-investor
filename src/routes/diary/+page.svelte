<script lang="ts">
	let { data } = $props();
	const p = $derived(data.portfolio);

	const fmtEur = (n: number) =>
		new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(n || 0);
	const fmtPct = (n: number) =>
		new Intl.NumberFormat('es-ES', { style: 'percent', maximumFractionDigits: 1 }).format(n || 0);
	const fmtDate = (s: string) =>
		new Date(s).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });

	let expanded: number | null = $state(null);
	function toggle(id: number) {
		expanded = expanded === id ? null : id;
	}

	function tradeUpside(t: any): number | null {
		if (!t.fair_value_eur || !t.price_eur || t.price_eur === 0) return null;
		return (t.fair_value_eur - t.price_eur) / t.price_eur;
	}

	const fmtPctOrDash = (n: number | null) => (n == null ? '—' : fmtPct(n));

	const scoreColor = (s: number | null) =>
		s == null ? '' : s >= 75 ? 'text-[var(--color-up)]' : s >= 60 ? 'text-[var(--color-warn)]' : 'text-[var(--color-down)]';

	const hasContext = $derived(p.trades.some((t: any) => t.catalysts || t.risks || t.score || t.bear_case || t.fair_value_eur));
</script>

<div class="p-4 md:p-6 space-y-5 md:space-y-6">
	<header>
		<div class="text-[11px] uppercase tracking-widest text-[var(--color-text-muted)] font-medium">Operacional</div>
		<h1 class="text-2xl md:text-3xl font-bold text-[var(--color-text-primary)] mt-1">Diario de operaciones</h1>
		<p class="text-[var(--color-text-muted)] text-sm mt-1">{p.trades.length} operaciones · tap una fila para ver el razonamiento completo</p>
	</header>

	{#if p.trades.length === 0}
		<div class="border border-dashed border-[var(--color-border-strong)] rounded-xl p-8 md:p-12 text-center">
			<p class="text-[var(--color-text-muted)]">Sin operaciones registradas todavía.</p>
		</div>
	{:else}
		<!-- Desktop table -->
		<div class="hidden md:block border border-[var(--color-border)] rounded-lg bg-[var(--color-surface)] overflow-hidden overflow-x-auto">
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
										{#if t.thesis}
											<div>
												<div class="text-[10px] uppercase tracking-widest text-[var(--color-accent)] mb-1">Tesis</div>
												<p class="text-xs text-[var(--color-text-secondary)] leading-relaxed">{t.thesis}</p>
											</div>
										{/if}
										{#if t.bear_case}
											<div>
												<div class="text-[10px] uppercase tracking-widest text-[var(--color-down)] mb-1">Caso contrario (bear)</div>
												<p class="text-xs text-[var(--color-down)]/80 leading-relaxed border-l-2 border-[var(--color-down)] pl-2">{t.bear_case}</p>
											</div>
										{/if}
										{#if t.catalysts}
											<div>
												<div class="text-[10px] uppercase tracking-widest text-[var(--color-up)] mb-1">Catalizadores</div>
												<p class="text-xs text-[var(--color-text-secondary)] leading-relaxed">{t.catalysts}</p>
											</div>
										{/if}
										{#if t.risks}
											<div>
												<div class="text-[10px] uppercase tracking-widest text-[var(--color-warn)] mb-1">Riesgos</div>
												<p class="text-xs text-[var(--color-text-secondary)] leading-relaxed">{t.risks}</p>
											</div>
										{/if}
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

		<!-- Mobile cards -->
		<div class="md:hidden border border-[var(--color-border)] rounded-lg bg-[var(--color-surface)] overflow-hidden divide-y divide-[var(--color-border)]">
			{#each p.trades as t (t.id)}
				<div>
					<button
						class="w-full text-left p-3 flex items-center gap-3 hover:bg-[var(--color-surface-hover)] {expanded === t.id ? 'bg-[var(--color-surface-hover)]' : ''}"
						onclick={() => toggle(t.id)}
					>
						<span class="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium shrink-0 {t.side === 'buy' ? 'bg-[var(--color-up)]/20 text-[var(--color-up)]' : 'bg-[var(--color-down)]/20 text-[var(--color-down)]'}">{t.side === 'buy' ? 'BUY' : 'SELL'}</span>
						<div class="min-w-0 flex-1">
							<div class="font-mono text-sm text-[var(--color-text-primary)]">{t.ticker}</div>
							<div class="text-[10px] text-[var(--color-text-muted)]">{fmtDate(t.executed_at)} · {t.shares} acc.</div>
						</div>
						<div class="text-right shrink-0">
							<div class="font-medium tabular text-sm text-[var(--color-text-primary)]">{fmtEur(t.shares * t.price_eur)}</div>
							{#if t.score}
								<div class="text-[10px] tabular {scoreColor(t.score)}">{t.score}/100</div>
							{/if}
						</div>
						<svg class="w-3 h-3 text-[var(--color-text-muted)] shrink-0 transition-transform {expanded === t.id ? 'rotate-90' : ''}" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" /></svg>
					</button>
					{#if expanded === t.id}
						<div class="bg-[var(--color-bg-elevated)] p-3 space-y-3">
							<div class="grid grid-cols-3 gap-2 text-[10px]">
								<div>
									<span class="block uppercase tracking-wider text-[var(--color-text-muted)]">P. local</span>
									<span class="tabular text-[var(--color-text-secondary)]">{t.price_local.toFixed(2)}</span>
								</div>
								<div>
									<span class="block uppercase tracking-wider text-[var(--color-text-muted)]">FX</span>
									<span class="tabular text-[var(--color-text-secondary)]">{t.fx_rate.toFixed(4)}</span>
								</div>
								<div>
									<span class="block uppercase tracking-wider text-[var(--color-text-muted)]">P. €</span>
									<span class="tabular text-[var(--color-text-secondary)]">{fmtEur(t.price_eur)}</span>
								</div>
							</div>
							{#if t.thesis}
								<div>
									<div class="text-[10px] uppercase tracking-widest text-[var(--color-accent)] mb-1">Tesis</div>
									<p class="text-xs text-[var(--color-text-secondary)] leading-relaxed">{t.thesis}</p>
								</div>
							{/if}
							{#if t.bear_case}
								<div>
									<div class="text-[10px] uppercase tracking-widest text-[var(--color-down)] mb-1">Bear case</div>
									<p class="text-xs text-[var(--color-down)]/80 leading-relaxed border-l-2 border-[var(--color-down)] pl-2">{t.bear_case}</p>
								</div>
							{/if}
							{#if t.catalysts}
								<div>
									<div class="text-[10px] uppercase tracking-widest text-[var(--color-up)] mb-1">Catalizadores</div>
									<p class="text-xs text-[var(--color-text-secondary)] leading-relaxed">{t.catalysts}</p>
								</div>
							{/if}
							{#if t.risks}
								<div>
									<div class="text-[10px] uppercase tracking-widest text-[var(--color-warn)] mb-1">Riesgos</div>
									<p class="text-xs text-[var(--color-text-secondary)] leading-relaxed">{t.risks}</p>
								</div>
							{/if}
							{#if t.fair_value_eur}
								<div class="text-xs text-[var(--color-text-secondary)] tabular pt-2 border-t border-[var(--color-border)]">
									Valor razonable: {fmtEur(t.fair_value_eur)} / acc.
									{#if tradeUpside(t) != null}
										<span class="ml-2 {tradeUpside(t)! >= 0 ? 'text-[var(--color-up)]' : 'text-[var(--color-down)]'}">({fmtPctOrDash(tradeUpside(t))} upside)</span>
									{/if}
								</div>
							{/if}
						</div>
					{/if}
				</div>
			{/each}
		</div>
	{/if}
</div>
