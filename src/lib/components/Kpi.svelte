<script lang="ts">
	let {
		label,
		value,
		change,
		changeSuffix = '%',
		hint,
		accent = 'default'
	}: {
		label: string;
		value: string;
		change?: number;
		changeSuffix?: string;
		hint?: string;
		accent?: 'default' | 'up' | 'down' | 'accent' | 'warn';
	} = $props();

	const accentClass = $derived(
		accent === 'up' ? 'text-[var(--color-up)]'
		: accent === 'down' ? 'text-[var(--color-down)]'
		: accent === 'accent' ? 'text-[var(--color-accent)]'
		: accent === 'warn' ? 'text-[var(--color-warn)]'
		: 'text-[var(--color-text-primary)]'
	);
</script>

<div class="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg p-4 transition-colors hover:border-[var(--color-border-strong)]">
	<div class="text-[10px] uppercase tracking-widest text-[var(--color-text-muted)] font-medium">{label}</div>
	<div class="mt-2 flex items-baseline gap-2">
		<span class="text-2xl font-semibold tabular {accentClass}">{value}</span>
		{#if change !== undefined}
			<span class="text-xs tabular {change >= 0 ? 'text-[var(--color-up)]' : 'text-[var(--color-down)]'}">
				{change >= 0 ? '▲' : '▼'} {Math.abs(change).toFixed(2)}{changeSuffix}
			</span>
		{/if}
	</div>
	{#if hint}
		<div class="mt-1 text-xs text-[var(--color-text-muted)]">{hint}</div>
	{/if}
</div>
