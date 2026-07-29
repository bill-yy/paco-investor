<script lang="ts">
	import Chart from 'chart.js/auto';

	type Valuation = {
		timestamp: string;
		total_eur: number;
		benchmark_eur: number | null;
	};

	let {
		allValuations,
		strategies
	}: {
		allValuations: Record<string, Valuation[]>;
		strategies: Array<{ id: string; name: string; color: string }>;
	} = $props();

	let canvas: HTMLCanvasElement | undefined = $state();
	let chart: Chart | null = null;

	// Collect all unique timestamps across strategies
	const allDates = $derived.by(() => {
		const dates = new Set<string>();
		for (const sid of Object.keys(allValuations || {})) {
			for (const v of allValuations[sid] || []) dates.add(v.timestamp);
		}
		return Array.from(dates).sort();
	});

	function buildChart(): Chart {
		if (!canvas) throw new Error('canvas not ready');
		const labels = allDates;

		const datasets = (strategies || []).map((s) => {
			const series = allValuations[s.id] || [];
			const seriesMap = new Map(series.map((v) => [v.timestamp, v.total_eur]));
			return {
				label: s.name,
				data: labels.map((d) => seriesMap.get(d) ?? null),
				borderColor: s.color,
				backgroundColor: s.color + '15',
				fill: false,
				tension: 0.25,
				borderWidth: 2,
				pointRadius: 0,
				pointHoverRadius: 4,
				spanGaps: true
			};
		});

		return new Chart(canvas, {
			type: 'line',
			data: { labels, datasets },
			options: {
				responsive: true,
				maintainAspectRatio: false,
				interaction: { mode: 'index', intersect: false },
				plugins: {
					legend: {
						display: true,
						position: 'top',
						align: 'end',
						labels: { color: '#9ca3af', font: { size: 11 }, boxWidth: 12, boxHeight: 2 }
					},
					tooltip: {
						backgroundColor: '#0f141c',
						borderColor: '#1f2937',
						borderWidth: 1,
						titleColor: '#e5e7eb',
						bodyColor: '#9ca3af',
						padding: 10,
						callbacks: {
							label: (ctx) => {
								const v = ctx.parsed.y;
								if (v == null) return `${ctx.dataset.label}: —`;
								const eur = new Intl.NumberFormat('es-ES', {
									style: 'currency',
									currency: 'EUR',
									maximumFractionDigits: 0
								}).format(v);
								return `${ctx.dataset.label}: ${eur}`;
							}
						}
					}
				},
				scales: {
					x: {
						grid: { color: 'rgba(31, 41, 55, 0.4)' },
						ticks: { color: '#6b7280', font: { size: 10 }, maxRotation: 0, autoSkipPadding: 20 }
					},
					y: {
						grid: { color: 'rgba(31, 41, 55, 0.4)' },
						ticks: {
							color: '#6b7280',
							font: { size: 10 },
							callback: (v) =>
								new Intl.NumberFormat('es-ES', {
									style: 'currency',
									currency: 'EUR',
									maximumFractionDigits: 0
								}).format(Number(v))
						}
					}
				}
			}
		});
	}

	$effect(() => {
		void allValuations;
		void strategies;
		if (!canvas || allDates.length === 0) return;
		chart?.destroy();
		chart = buildChart();
	});
</script>

{#if allDates.length <= 1}
	<div class="flex items-center justify-center h-32 text-[var(--color-text-muted)] text-sm">
		<p>Las curvas aparecerán cuando las estrategias comiencen a operar.</p>
	</div>
{:else}
	<div class="relative h-56 md:h-72">
		<canvas bind:this={canvas}></canvas>
	</div>
{/if}
