<script lang="ts">
	// Mini line chart sin dependencias — SVG nativo
	let { values, width = 100, height = 28, color = 'auto' }: {
		values: number[];
		width?: number;
		height?: number;
		color?: 'auto' | 'up' | 'down' | 'accent';
	} = $props();

	const path = $derived.by(() => {
		if (!values || values.length < 2) return '';
		const min = Math.min(...values);
		const max = Math.max(...values);
		const range = max - min || 1;
		const step = width / (values.length - 1);
		return values
			.map((v, i) => {
				const x = i * step;
				const y = height - ((v - min) / range) * height;
				return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
			})
			.join(' ');
	});

	const fillColor = $derived(
		color === 'accent' ? '#3b82f6'
		: color === 'up' ? '#10b981'
		: color === 'down' ? '#ef4444'
		: (values && values[values.length - 1] >= values[0]) ? '#10b981' : '#ef4444'
	);

	const areaPath = $derived.by(() => {
		if (!path) return '';
		return `${path} L${width},${height} L0,${height} Z`;
	});
</script>

<svg {width} {height} viewBox="0 0 {width} {height}" class="overflow-visible">
	<defs>
		<linearGradient id="spark-{fillColor.slice(1)}" x1="0" y1="0" x2="0" y2="1">
			<stop offset="0%" stop-color={fillColor} stop-opacity="0.3" />
			<stop offset="100%" stop-color={fillColor} stop-opacity="0" />
		</linearGradient>
	</defs>
	{#if path}
		<path d={areaPath} fill="url(#spark-{fillColor.slice(1)})" />
		<path d={path} fill="none" stroke={fillColor} stroke-width="1.4" stroke-linejoin="round" />
	{/if}
</svg>
