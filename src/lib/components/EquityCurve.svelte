<script lang="ts">
	// Dual-line equity curve: portfolio total vs benchmark (S&P 500), both
	// normalized to the initial €10,000 baseline so they're directly comparable.
	// Uses Chart.js (already a dependency, previously unused).
	import Chart from 'chart.js/auto';

	// Shape mirrors the Valuation row from $lib/server/db. Inlined (rather than
	// imported) so this client component has no server-module dependency.
	type Valuation = {
		timestamp: string;
		total_eur: number;
		benchmark_eur: number | null;
	};

	let { valuations, initialCapital = 10000 }: { valuations: Valuation[]; initialCapital?: number } = $props();

	const fmtEur = (n: number) =>
		new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n || 0);
	const fmtDate = (s: string) =>
		new Date(s).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });

	let canvas: HTMLCanvasElement | undefined = $state();
	let chart: Chart | null = null;

	function buildSeries() {
		// Portfolio series is total_eur as-is (already mark-to-market from snapshots).
		const portfolio = valuations.map((v) => v.total_eur);
		// Benchmark revalued as if initialCapital had been invested in S&P at the first snapshot.
		const first = valuations[0];
		const benchmark = valuations.map((v) => {
			if (!first?.benchmark_eur || !v.benchmark_eur || first.benchmark_eur === 0) return null;
			return initialCapital * (v.benchmark_eur / first.benchmark_eur);
		});
		const labels = valuations.map((v) => fmtDate(v.timestamp));
		return { labels, portfolio, benchmark };
	}

	function buildChart(): Chart {
		if (!canvas) throw new Error('canvas not ready');
		const { labels, portfolio, benchmark } = buildSeries();
		return new Chart(canvas, {
			type: 'line',
			data: {
				labels,
				datasets: [
					{
						label: 'Cartera',
						data: portfolio,
						borderColor: '#3b82f6',
						backgroundColor: 'rgba(59, 130, 246, 0.12)',
						fill: true,
						tension: 0.25,
						borderWidth: 2,
						pointRadius: 0,
						pointHoverRadius: 4
					},
					{
						label: 'S&P 500',
						data: benchmark,
						borderColor: '#9ca3af',
						fill: false,
						tension: 0.25,
						borderWidth: 1.5,
						borderDash: [4, 4],
						pointRadius: 0,
						pointHoverRadius: 4,
						spanGaps: true
					}
				]
			},
			options: {
				responsive: true,
				maintainAspectRatio: false,
				interaction: { mode: 'index', intersect: false },
				plugins: {
					legend: { display: true, position: 'top', align: 'end', labels: { color: '#9ca3af', font: { size: 11 }, boxWidth: 12, boxHeight: 2 } },
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
								const ret = (v - initialCapital) / initialCapital;
								const retStr = new Intl.NumberFormat('es-ES', { style: 'percent', maximumFractionDigits: 2 }).format(ret);
								return `${ctx.dataset.label}: ${fmtEur(v)} (${retStr})`;
							}
						}
					}
				},
				scales: {
					x: { grid: { color: 'rgba(31, 41, 55, 0.4)' }, ticks: { color: '#6b7280', font: { size: 10 }, maxRotation: 0, autoSkipPadding: 20 } },
					y: { grid: { color: 'rgba(31, 41, 55, 0.4)' }, ticks: { color: '#6b7280', font: { size: 10 }, callback: (v) => fmtEur(Number(v)) } }
				}
			}
		});
	}

	// (Re)build the chart whenever the data prop changes. In Svelte 5 the $effect
	// also runs on mount, so it replaces the need for onMount.
	$effect(() => {
		void valuations;
		if (!canvas || valuations.length === 0) return;
		chart?.destroy();
		chart = buildChart();
	});
</script>

{#if valuations.length === 0}
	<div class="border border-dashed border-[var(--color-border-strong)] rounded-lg p-8 text-center bg-[var(--color-surface)]">
		<p class="text-[var(--color-text-muted)] text-sm">Sin histórico todavía.</p>
		<p class="text-[var(--color-text-muted)] text-xs mt-1">La curva aparecerá cuando el agente ejecute operaciones o se invoque <code class="text-[var(--color-accent)]">/api/snapshot</code>.</p>
	</div>
{:else}
	<div class="relative h-56 md:h-72">
		<canvas bind:this={canvas}></canvas>
	</div>
{/if}
