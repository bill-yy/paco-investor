<script lang="ts">
	type MarketItem = {
		ticker: string;
		name: string;
		category: string;
		price: number;
		currency: string;
		change_pct: number;
	};

	let { items }: { items: MarketItem[] } = $props();

	let activeTab = $state<'indices' | 'commodities' | 'forex'>('indices');

	const indices = $derived(items.filter((m) => m.category === 'Índices'));
	const commodities = $derived(items.filter((m) => m.category === 'Commodities' || m.category === 'Cripto'));
	const forex = $derived(items.filter((m) => m.category === 'Tipos' || m.category === 'Divisas'));

	const tabs = [
		{ id: 'indices' as const, label: 'Índices', data: indices },
		{ id: 'commodities' as const, label: 'Commodities', data: commodities },
		{ id: 'forex' as const, label: 'Divisas/Tipos', data: forex }
	];

	const activeData = $derived(tabs.find((t) => t.id === activeTab)?.data ?? []);

	const fmtPrice = (item: MarketItem) => {
		const sym = item.currency === 'EUR' ? '€' : item.currency === 'USD' ? '$' : '';
		if (item.currency === 'JPY' || item.currency === 'HKD') {
			return new Intl.NumberFormat('es-ES', { maximumFractionDigits: 0 }).format(item.price);
		}
		return new Intl.NumberFormat('es-ES', { maximumFractionDigits: 2 }).format(item.price) + (sym ? ' ' + sym : '');
	};
</script>

<div class="overflow-hidden border border-[var(--color-border)] rounded-lg bg-[var(--color-bg-elevated)]">
	<!-- Tab bar -->
	<div class="flex border-b border-[var(--color-border)]">
		{#each tabs as tab}
			<button
				onclick={() => (activeTab = tab.id)}
				class="flex-1 px-2 py-1.5 text-[10px] uppercase tracking-wider font-medium transition-colors {activeTab === tab.id
					? 'bg-[var(--color-surface-hover)] text-[var(--color-accent)] border-b-2 border-[var(--color-accent)]'
					: 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]'}"
			>
				{tab.label} <span class="opacity-50">({tab.data.length})</span>
			</button>
		{/each}
	</div>
	<!-- Ticker list -->
	<div class="divide-y divide-[var(--color-border)] max-h-72 overflow-y-auto">
		{#each activeData as item}
			<div class="flex items-center justify-between px-3 py-1.5 hover:bg-[var(--color-surface-hover)]">
				<div class="flex-1 min-w-0">
					<div class="text-xs font-medium text-[var(--color-text-primary)] truncate">{item.name}</div>
					<div class="text-[9px] text-[var(--color-text-muted)] font-mono">{item.ticker}</div>
				</div>
				<div class="text-right">
					<div class="text-xs tabular text-[var(--color-text-primary)]">{fmtPrice(item)}</div>
					<div class="text-[10px] tabular {item.change_pct >= 0 ? 'text-[var(--color-up)]' : 'text-[var(--color-down)]'}">
						{item.change_pct >= 0 ? '+' : ''}{(item.change_pct * 100).toFixed(2)}%
					</div>
				</div>
			</div>
		{/each}
	</div>
</div>
