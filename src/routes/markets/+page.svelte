<script lang="ts">
	import MarketTicker from '$lib/components/MarketTicker.svelte';
	import Sparkline from '$lib/components/Sparkline.svelte';

	let { data } = $props();

	const cats = [
		{ key: 'Índices', label: 'Índices globales' },
		{ key: 'Commodities', label: 'Materias primas' },
		{ key: 'Divisas', label: 'Divisas' },
		{ key: 'Tipos', label: 'Tipos de interés' },
		{ key: 'Cripto', label: 'Cripto' },
		{ key: 'Volatilidad', label: 'Volatilidad' }
	];

	const fmt = (n: number, c?: string) => {
		const d = n > 1000 ? 0 : n > 10 ? 2 : 4;
		const v = new Intl.NumberFormat('es-ES', { minimumFractionDigits: d, maximumFractionDigits: d }).format(n);
		return c === 'USD' ? `$${v}` : c === 'EUR' ? `€${v}` : v;
	};

	const sectors = $derived((data.sectors || []).slice().sort((a, b) => b.change_pct - a.change_pct));
</script>

<div class="p-4 md:p-6 space-y-5 md:space-y-6">
	<header>
		<div class="text-[11px] uppercase tracking-widest text-[var(--color-text-muted)] font-medium">Mercados</div>
		<h1 class="text-2xl md:text-3xl font-bold text-[var(--color-text-primary)] mt-1">Mercados globales</h1>
	</header>

	<!-- Sector heatmap -->
	<div class="border border-[var(--color-border)] rounded-lg bg-[var(--color-surface)] p-3 md:p-4">
		<h2 class="text-sm font-semibold mb-3 text-[var(--color-text-primary)]">Heatmap sectorial · S&amp;P 500</h2>
		<div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
			{#each sectors as s}
				<div
					class="p-2 md:p-3 rounded border"
					style="background-color: {s.change_pct >= 0 ? `rgba(16, 185, 129, ${Math.min(0.6, 0.2 + Math.abs(s.change_pct) * 10)})` : `rgba(239, 68, 68, ${Math.min(0.6, 0.2 + Math.abs(s.change_pct) * 10)})`}; border-color: rgba(255,255,255,0.1)"
				>
					<div class="text-[10px] md:text-[11px] text-white/80 truncate">{s.name}</div>
					<div class="text-base md:text-lg font-bold tabular text-white">{(s.change_pct * 100).toFixed(2)}%</div>
				</div>
			{/each}
		</div>
	</div>

	<!-- Categorized -->
	<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
		{#each cats as cat}
			{@const items = (data.market || []).filter((m) => m.category === cat.key)}
			{#if items.length > 0}
				<MarketTicker items={items} maxItems={20} />
			{/if}
		{/each}
	</div>
</div>
