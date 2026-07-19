<script lang="ts">
	let { data } = $props();
	const p = $derived(data.portfolio);
	const fmtEur = (n: number) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(n || 0);
	const fmtDate = (s: string) => new Date(s).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
</script>

<div class="p-6 space-y-6">
	<header>
		<div class="text-[11px] uppercase tracking-widest text-[var(--color-text-muted)] font-medium">Operacional</div>
		<h1 class="text-3xl font-bold text-[var(--color-text-primary)] mt-1">Diario de operaciones</h1>
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
						<th class="px-4 py-2 text-left">Fecha</th>
						<th class="px-4 py-2 text-left">Ticker</th>
						<th class="px-4 py-2 text-left">Tipo</th>
						<th class="px-4 py-2 text-right">Acciones</th>
						<th class="px-4 py-2 text-right">Precio local</th>
						<th class="px-4 py-2 text-right">FX</th>
						<th class="px-4 py-2 text-right">Precio €</th>
						<th class="px-4 py-2 text-right">Importe</th>
						<th class="px-4 py-2 text-left">Tesis</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-[var(--color-border)]">
					{#each p.trades as t}
						<tr class="hover:bg-[var(--color-surface-hover)]">
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
							<td class="px-4 py-2 text-[var(--color-text-muted)] text-xs max-w-[200px] truncate">{t.thesis || '—'}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</div>
