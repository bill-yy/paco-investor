<script lang="ts">
	let { items, maxItems = 24 }: {
		items: Array<{ ticker: string; name: string; price: number; change_pct: number; currency?: string }>;
		maxItems?: number;
	} = $props();

	const fmt = (n: number, currency?: string) => {
		const digits = n > 1000 ? 0 : n > 10 ? 2 : 4;
		const v = new Intl.NumberFormat('es-ES', { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(n);
		return currency === 'USD' ? `$${v}` : currency === 'EUR' ? `€${v}` : v;
	};
</script>

<div class="overflow-hidden border border-[var(--color-border)] rounded-lg bg-[var(--color-bg-elevated)]">
	<div class="flex items-center gap-2 px-3 py-2 border-b border-[var(--color-border)]">
		<span class="w-1.5 h-1.5 rounded-full bg-[var(--color-up)] pulse-dot"></span>
		<span class="text-[10px] uppercase tracking-widest text-[var(--color-text-muted)] font-medium">Mercado en vivo</span>
	</div>
	<div class="divide-y divide-[var(--color-border)]">
		{#each items.slice(0, maxItems) as it}
			<div class="flex items-center justify-between px-3 py-2 hover:bg-[var(--color-surface-hover)]">
				<div class="flex-1 min-w-0">
					<div class="text-sm font-medium text-[var(--color-text-primary)] truncate">{it.name}</div>
					<div class="text-[10px] text-[var(--color-text-muted)] font-mono">{it.ticker}</div>
				</div>
				<div class="text-right">
					<div class="text-sm tabular text-[var(--color-text-primary)]">{fmt(it.price, it.currency)}</div>
					<div class="text-[11px] tabular {it.change_pct >= 0 ? 'text-[var(--color-up)]' : 'text-[var(--color-down)]'}">
						{it.change_pct >= 0 ? '+' : ''}{(it.change_pct * 100).toFixed(2)}%
					</div>
				</div>
			</div>
		{/each}
	</div>
</div>
