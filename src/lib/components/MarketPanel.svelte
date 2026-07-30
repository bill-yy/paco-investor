<script lang="ts">
	type MarketItem = {
		ticker: string;
		name: string;
		category: string;
		price: number;
		currency: string;
		change_pct: number;
		target_pct?: number;
	};

	let { items, strategyId = 'value' }: { items: MarketItem[]; strategyId?: string } = $props();

	// Generic market (value): tabs by category
	// Trader: tabs = Cripto / Acciones
	// Funds: single list with target weight

	const isGeneric = $derived(strategyId === 'value' || !strategyId);
	const isTrader = $derived(strategyId === 'trader');
	const isFunds = $derived(strategyId === 'funds');

	// Generic tabs
	let activeTab = $state<'indices' | 'commodities' | 'forex'>('indices');

	const indices = $derived(items.filter((m) => m.category === 'Índices'));
	const commoditiesGen = $derived(items.filter((m) => m.category === 'Commodities' || m.category === 'Cripto'));
	const forex = $derived(items.filter((m) => m.category === 'Tipos' || m.category === 'Divisas'));

	const tabsGeneric = [
		{ id: 'indices' as const, label: 'Índices', data: indices },
		{ id: 'commodities' as const, label: 'Commodities', data: commoditiesGen },
		{ id: 'forex' as const, label: 'Divisas/Tipos', data: forex }
	];

	// Trader tabs
	let traderTab = $state<'Cripto' | 'Acciones'>('Cripto');
	const traderTabs = $derived([
		{ id: 'Cripto' as const, label: 'Cripto', data: items.filter((m) => m.category === 'Cripto') },
		{ id: 'Acciones' as const, label: 'Acciones', data: items.filter((m) => m.category === 'Acciones') }
	]);

	const fmtPrice = (item: MarketItem) => {
		const sym = item.currency === 'EUR' ? '€' : item.currency === 'USD' ? '$' : '';
		if (item.currency === 'JPY' || item.currency === 'HKD') {
			return new Intl.NumberFormat('es-ES', { maximumFractionDigits: 0 }).format(item.price);
		}
		return new Intl.NumberFormat('es-ES', { maximumFractionDigits: 2 }).format(item.price) + (sym ? ' ' + sym : '');
	};
</script>

<div class="overflow-hidden border border-[var(--color-border)] rounded-lg bg-[var(--color-bg-elevated)]">
	{#if isFunds}
		<!-- Funds: ETFs with target weight -->
		<div class="flex items-center gap-2 px-3 py-2 border-b border-[var(--color-border)]">
			<span class="text-[10px] uppercase tracking-widest text-[var(--color-text-muted)] font-medium">ETFs del portfolio</span>
		</div>
		<div class="divide-y divide-[var(--color-border)] max-h-96 overflow-y-auto">
			{#each items as item}
				<div class="flex items-center justify-between px-3 py-2 hover:bg-[var(--color-surface-hover)]">
					<div class="flex-1 min-w-0">
						<div class="text-xs font-medium text-[var(--color-text-primary)] truncate">{item.name}</div>
						<div class="text-[9px] text-[var(--color-text-muted)] font-mono">{item.ticker} · {item.category}</div>
					</div>
					<div class="text-right shrink-0">
						{#if item.target_pct}
							<div class="text-[10px] text-[var(--color-accent)] font-medium tabular">{item.target_pct}% objetivo</div>
						{/if}
						<div class="text-xs tabular text-[var(--color-text-primary)]">{fmtPrice(item)}</div>
						<div class="text-[10px] tabular {item.change_pct >= 0 ? 'text-[var(--color-up)]' : 'text-[var(--color-down)]'}">
							{item.change_pct >= 0 ? '+' : ''}{(item.change_pct * 100).toFixed(2)}%
						</div>
					</div>
				</div>
			{/each}
		</div>
	{:else if isTrader}
		<!-- Trader: Cripto / Acciones tabs -->
		<div class="flex border-b border-[var(--color-border)]">
			{#each traderTabs as tab}
				<button
					onclick={() => (traderTab = tab.id)}
					class="flex-1 px-2 py-1.5 text-[10px] uppercase tracking-wider font-medium transition-colors {traderTab === tab.id
						? 'bg-[var(--color-surface-hover)] text-[var(--color-accent)] border-b-2 border-[var(--color-accent)]'
						: 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]'}"
				>
					{tab.label} <span class="opacity-50">({tab.data.length})</span>
				</button>
			{/each}
		</div>
		<div class="divide-y divide-[var(--color-border)] max-h-96 overflow-y-auto">
			{#each traderTabs.find((t) => t.id === traderTab)?.data ?? [] as item}
				<div class="flex items-center justify-between px-3 py-1.5 hover:bg-[var(--color-surface-hover)]">
					<div class="flex-1 min-w-0">
						<div class="text-xs font-medium text-[var(--color-text-primary)] truncate">{item.name}</div>
						<div class="text-[9px] text-[var(--color-text-muted)] font-mono">{item.ticker}</div>
					</div>
					<div class="text-right shrink-0">
						<div class="text-xs tabular text-[var(--color-text-primary)]">{fmtPrice(item)}</div>
						<div class="text-[10px] tabular {item.change_pct >= 0 ? 'text-[var(--color-up)]' : 'text-[var(--color-down)]'}">
							{item.change_pct >= 0 ? '+' : ''}{(item.change_pct * 100).toFixed(2)}%
						</div>
					</div>
				</div>
			{/each}
		</div>
	{:else}
		<!-- Generic market (Value): Índices / Commodities / Divisas tabs -->
		<div class="flex border-b border-[var(--color-border)]">
			{#each tabsGeneric as tab}
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
		<div class="divide-y divide-[var(--color-border)] max-h-72 overflow-y-auto">
			{#each tabsGeneric.find((t) => t.id === activeTab)?.data ?? [] as item}
				<div class="flex items-center justify-between px-3 py-1.5 hover:bg-[var(--color-surface-hover)]">
					<div class="flex-1 min-w-0">
						<div class="text-xs font-medium text-[var(--color-text-primary)] truncate">{item.name}</div>
						<div class="text-[9px] text-[var(--color-text-muted)] font-mono">{item.ticker}</div>
					</div>
					<div class="text-right shrink-0">
						<div class="text-xs tabular text-[var(--color-text-primary)]">{fmtPrice(item)}</div>
						<div class="text-[10px] tabular {item.change_pct >= 0 ? 'text-[var(--color-up)]' : 'text-[var(--color-down)]'}">
							{item.change_pct >= 0 ? '+' : ''}{(item.change_pct * 100).toFixed(2)}%
						</div>
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>
