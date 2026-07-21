<script lang="ts">
	let { data } = $props();
	const watchlist = $derived(data.watchlist || []);
</script>

<div class="p-4 md:p-6 space-y-5 md:space-y-6">
	<header>
		<div class="text-[11px] uppercase tracking-widest text-[var(--color-text-muted)] font-medium">Vigilancia</div>
		<h1 class="text-2xl md:text-3xl font-bold text-[var(--color-text-primary)] mt-1">Watchlist</h1>
		<p class="text-[var(--color-text-muted)] text-sm mt-1">Candidatas en espera de margen de seguridad suficiente.</p>
	</header>

	{#if watchlist.length === 0}
		<div class="border border-dashed border-[var(--color-border-strong)] rounded-xl p-12 text-center">
			<p class="text-[var(--color-text-muted)]">Watchlist vacía. Añade candidatas desde Research.</p>
		</div>
	{:else}
		<div class="border border-[var(--color-border)] rounded-lg bg-[var(--color-surface)] overflow-hidden overflow-x-auto">
			<table class="w-full text-sm">
				<thead>
					<tr class="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] border-b border-[var(--color-border)]">
						<th class="px-4 py-2 text-left">Ticker</th>
						<th class="px-4 py-2 text-left">Empresa</th>
						<th class="px-4 py-2 text-right">Target entrada</th>
						<th class="px-4 py-2 text-right">Valor razonable</th>
						<th class="px-4 py-2 text-right">Score</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-[var(--color-border)]">
					{#each watchlist as w}
						<tr class="hover:bg-[var(--color-surface-hover)]">
							<td class="px-4 py-2 font-mono text-[var(--color-accent)]">{w.ticker}</td>
							<td class="px-4 py-2 text-[var(--color-text-primary)]">{w.company_name}</td>
							<td class="px-4 py-2 text-right tabular text-[var(--color-text-secondary)]">{w.target_entry_eur ? `${w.target_entry_eur.toFixed(2)} €` : '—'}</td>
							<td class="px-4 py-2 text-right tabular text-[var(--color-text-secondary)]">{w.fair_value_eur ? `${w.fair_value_eur.toFixed(2)} €` : '—'}</td>
							<td class="px-4 py-2 text-right tabular {w.score == null ? 'text-[var(--color-text-muted)]' : w.score >= 75 ? 'text-[var(--color-up)]' : w.score >= 60 ? 'text-[var(--color-warn)]' : 'text-[var(--color-down)]'}">{w.score ?? '—'}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</div>
