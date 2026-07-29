<script lang="ts">
	import { page } from '$app/state';

	let { data } = $props();
	let comparison = $derived(data?.comparison ?? []);
	let allValuations = $derived(data?.allValuations ?? {});

	const fmtEur = (n: number) =>
		new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n || 0);
	const fmtPct = (n: number) =>
		new Intl.NumberFormat('es-ES', { style: 'percent', maximumFractionDigits: 2, signDisplay: 'always' }).format(n || 0);

	const currentStrategy = $derived(page.url.searchParams.get('strategy') || 'value');
</script>

<div class="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
	{#each comparison as s}
		<a
			href="/?strategy={s.strategy_id}"
			class="block border rounded-lg p-3 md:p-4 transition-all {currentStrategy === s.strategy_id
				? 'border-[var(--color-border-strong)] bg-[var(--color-surface-hover)]'
				: 'border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--color-border-strong)]'}"
		>
			<div class="flex items-center justify-between mb-2">
				<div class="flex items-center gap-2">
					<div
						class="w-7 h-7 rounded-md flex items-center justify-center text-xs font-bold text-white"
						style="background: linear-gradient(135deg, {s.color}, {s.color}dd)"
					>
						{s.icon}
					</div>
					<div>
						<div class="text-sm font-semibold text-[var(--color-text-primary)]">{s.name}</div>
						<div class="text-[9px] uppercase tracking-wider text-[var(--color-text-muted)]">{s.type}</div>
					</div>
				</div>
				{#if currentStrategy === s.strategy_id}
					<span class="text-[10px] text-[var(--color-accent)] font-medium">● ACTIVA</span>
				{/if}
			</div>

			<div class="space-y-1.5">
				<div class="flex items-baseline justify-between">
					<span class="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)]">Patrimonio</span>
					<span class="text-lg font-semibold tabular text-[var(--color-text-primary)]">{fmtEur(s.total_eur)}</span>
				</div>
				<div class="flex items-baseline justify-between">
					<span class="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)]">Invertido</span>
					<span class="text-xs tabular text-[var(--color-text-secondary)]">{fmtEur(s.total_invested)}</span>
				</div>
				<div class="flex items-baseline justify-between">
					<span class="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)]">Rentabilidad</span>
					<span class="text-xs tabular font-medium {s.return_pct >= 0 ? 'text-[var(--color-up)]' : 'text-[var(--color-down)]'}">
						{s.return_pct >= 0 ? '▲' : '▼'} {fmtPct(s.return_pct)}
					</span>
				</div>
				<div class="flex items-baseline justify-between pt-1 border-t border-[var(--color-border)]">
					<span class="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)]">Posiciones</span>
					<span class="text-xs tabular text-[var(--color-text-secondary)]">{s.positions}</span>
				</div>
				{#if s.monthly_contribution > 0}
					<div class="flex items-baseline justify-between">
						<span class="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)]">Aporte/mes</span>
						<span class="text-xs tabular text-[var(--color-accent)]">{fmtEur(s.monthly_contribution)}</span>
					</div>
				{/if}
			</div>
		</a>
	{/each}
</div>
