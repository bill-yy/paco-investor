<script lang="ts">
	import Kpi from '$lib/components/Kpi.svelte';
	import MarketTicker from '$lib/components/MarketTicker.svelte';

	let { data } = $props();
	const p = $derived(data.portfolio);

	const fmtEur = (n: number) =>
		new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 }).format(n || 0);

	const fmtPct = (n: number) =>
		new Intl.NumberFormat('es-ES', { style: 'percent', maximumFractionDigits: 2 }).format(n || 0);

	const fmtDate = (s: string) => new Date(s).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });

	const totalInvested = $derived(p.invested_eur || 0);
	const totalCapital = $derived(p.cash_eur + totalInvested);

	// Sectors from data
	const sectors = $derived((data.sectors || []).slice().sort((a, b) => b.change_pct - a.change_pct));

	// Movers from market data
	const indices = $derived((data.market || []).filter((m) => m.category === 'Índices'));
	const commodities = $derived((data.market || []).filter((m) => m.category === 'Commodities'));
	const rates = $derived((data.market || []).filter((m) => m.category === 'Tipos' || m.category === 'Divisas'));

	// Risk mood: count indices up vs down
	const moodIdx = $derived(indices.filter((i) => i.change_pct > 0).length);
	const moodTotal = $derived(indices.length || 1);
	const mood = $derived(
		moodIdx / moodTotal > 0.65 ? { label: 'Risk-On', color: 'up', pct: moodIdx / moodTotal }
		: moodIdx / moodTotal < 0.35 ? { label: 'Risk-Off', color: 'down', pct: moodIdx / moodTotal }
		: { label: 'Neutral', color: 'warn', pct: moodIdx / moodTotal }
	);
</script>

<div class="p-6 space-y-6">
	<!-- Header -->
	<header class="flex items-end justify-between">
		<div>
			<div class="text-[11px] uppercase tracking-widest text-[var(--color-text-muted)] font-medium">Dashboard</div>
			<h1 class="text-3xl font-bold text-[var(--color-text-primary)] mt-1">Cartera · Resumen ejecutivo</h1>
		</div>
		<div class="text-right">
			<div class="text-xs text-[var(--color-text-muted)]">{new Date().toLocaleDateString('es-ES', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}</div>
			<div class="flex items-center gap-1.5 justify-end mt-1">
				<span class="w-1.5 h-1.5 rounded-full bg-[var(--color-{mood.color})] pulse-dot"></span>
				<span class="text-xs font-medium text-[var(--color-{mood.color})]">Sentimiento: {mood.label}</span>
			</div>
		</div>
	</header>

	<!-- KPI row -->
	<div class="grid grid-cols-2 md:grid-cols-5 gap-3">
		<Kpi label="Patrimonio" value={fmtEur(totalCapital)} hint="Invertido + liquidez" />
		<Kpi label="Invertido" value={fmtEur(totalInvested)} hint="{fmtPct(totalCapital > 0 ? totalInvested / totalCapital : 0)} del capital" />
		<Kpi label="Liquidez" value={fmtEur(p.cash_eur)} hint="{fmtPct(totalCapital > 0 ? p.cash_eur / totalCapital : 0)} disponible" accent={p.cash_eur / (totalCapital || 1) > 0.4 ? 'warn' : 'default'} />
		<Kpi label="Posiciones" value={String(p.position_count)} hint="Objetivo 12-25" />
		<Kpi label="Rentabilidad" value={fmtPct(totalCapital > 0 ? (totalCapital - 10000) / 10000 : 0)} change={(totalCapital - 10000) / 10000 * 100} accent={totalCapital >= 10000 ? 'up' : 'down'} />
	</div>

	<div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
		<!-- Left: Positions / Status -->
		<div class="lg:col-span-2 space-y-6">
			{#if p.position_count === 0}
				<div class="border border-dashed border-[var(--color-border-strong)] rounded-xl p-10 text-center bg-[var(--color-surface)]">
					<div class="text-[var(--color-text-secondary)] font-medium">Cartera recién inicializada</div>
					<p class="text-[var(--color-text-muted)] text-sm mt-2">10.000 € en liquidez · Pendiente de primera compra</p>
					<div class="mt-4 inline-flex items-center gap-2 text-xs text-[var(--color-warn)] bg-[var(--color-warn)]/10 px-3 py-1.5 rounded-md">
						<svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M10 2a8 8 0 100 16 8 8 0 000-16zm0 4a1 1 0 011 1v3a1 1 0 11-2 0V7a1 1 0 011-1zm0 8a1 1 0 100-2 1 1 0 000 2z" /></svg>
						Próxima sesión analítica: macro + screening
					</div>
				</div>
			{:else}
				<!-- Positions table -->
				<div class="border border-[var(--color-border)] rounded-lg overflow-hidden bg-[var(--color-surface)]">
					<div class="px-4 py-3 border-b border-[var(--color-border)] flex items-center justify-between">
						<h2 class="text-sm font-semibold text-[var(--color-text-primary)]">Posiciones abiertas</h2>
						<span class="text-xs text-[var(--color-text-muted)]">{p.position_count} activas</span>
					</div>
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
										<div class="text-[10px] text-[var(--color-text-muted)] font-mono">{pos.ticker} · {pos.sector}</div>
									</td>
									<td class="px-4 py-3 text-right tabular text-[var(--color-text-secondary)]">{pos.shares}</td>
									<td class="px-4 py-3 text-right tabular text-[var(--color-text-secondary)]">{fmtEur(pos.avg_price_eur)}</td>
									<td class="px-4 py-3 text-right tabular font-medium text-[var(--color-text-primary)]">{fmtEur(pos.shares * pos.avg_price_eur)}</td>
									<td class="px-4 py-3 text-right tabular text-[var(--color-text-secondary)]">{fmtPct(totalCapital > 0 ? (pos.shares * pos.avg_price_eur) / totalCapital : 0)}</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{/if}

			<!-- Sector heatmap -->
			<div class="border border-[var(--color-border)] rounded-lg bg-[var(--color-surface)] p-4">
				<div class="flex items-center justify-between mb-3">
					<h2 class="text-sm font-semibold text-[var(--color-text-primary)]">Sectores S&P (hoy)</h2>
					<span class="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)]">Rotación sectorial</span>
				</div>
				<div class="grid grid-cols-4 md:grid-cols-6 gap-1.5">
					{#each sectors as s}
						<div
							class="p-2.5 rounded text-center border"
							style="background-color: {s.change_pct >= 0 ? `rgba(16, 185, 129, ${Math.min(0.5, 0.15 + Math.abs(s.change_pct) * 8)})` : `rgba(239, 68, 68, ${Math.min(0.5, 0.15 + Math.abs(s.change_pct) * 8)})`}; border-color: {s.change_pct >= 0 ? 'rgba(16, 185, 129, 0.4)' : 'rgba(239, 68, 68, 0.4)'}"
						>
							<div class="text-[10px] text-white/80 truncate">{s.name}</div>
							<div class="text-sm font-semibold tabular text-white">{(s.change_pct * 100).toFixed(2)}%</div>
						</div>
					{/each}
				</div>
			</div>
		</div>

		<!-- Right: live market -->
		<div class="space-y-4">
			<MarketTicker items={indices} maxItems={10} />
			<MarketTicker items={commodities} maxItems={6} />
			<MarketTicker items={rates} maxItems={5} />
		</div>
	</div>

	<!-- Recent trades -->
	{#if p.trades.length > 0}
		<div class="border border-[var(--color-border)] rounded-lg overflow-hidden bg-[var(--color-surface)]">
			<div class="px-4 py-3 border-b border-[var(--color-border)]">
				<h2 class="text-sm font-semibold text-[var(--color-text-primary)]">Operaciones recientes</h2>
			</div>
			<table class="w-full text-sm">
				<thead>
					<tr class="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] border-b border-[var(--color-border)]">
						<th class="px-4 py-2 text-left">Fecha</th>
						<th class="px-4 py-2 text-left">Ticker</th>
						<th class="px-4 py-2 text-left">Tipo</th>
						<th class="px-4 py-2 text-right">Acciones</th>
						<th class="px-4 py-2 text-right">Precio</th>
						<th class="px-4 py-2 text-right">Importe</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-[var(--color-border)]">
					{#each p.trades.slice(0, 8) as t}
						<tr>
							<td class="px-4 py-2 text-[var(--color-text-muted)]">{fmtDate(t.executed_at)}</td>
							<td class="px-4 py-2 font-mono text-[var(--color-text-primary)]">{t.ticker}</td>
							<td class="px-4 py-2">
								<span class="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium {t.side === 'buy' ? 'bg-[var(--color-up)]/20 text-[var(--color-up)]' : 'bg-[var(--color-down)]/20 text-[var(--color-down)]'}">
									{t.side === 'buy' ? 'BUY' : 'SELL'}
								</span>
							</td>
							<td class="px-4 py-2 text-right tabular text-[var(--color-text-secondary)]">{t.shares}</td>
							<td class="px-4 py-2 text-right tabular text-[var(--color-text-secondary)]">{fmtEur(t.price_eur)}</td>
							<td class="px-4 py-2 text-right tabular font-medium text-[var(--color-text-primary)]">{fmtEur(t.shares * t.price_eur)}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</div>
