<script lang="ts">
	// Research: búsqueda y análisis de empresas
	let ticker = $state('');
	let loading = $state(false);
	let result: any = $state(null);
	let error: string = $state('');

	async function search() {
		if (!ticker.trim()) return;
		loading = true;
		error = '';
		result = null;
		try {
			const r = await fetch(`/api/quote?ticker=${encodeURIComponent(ticker.toUpperCase())}&details=true`);
			if (!r.ok) {
				const e = await r.json().catch(() => ({}));
				throw new Error(e.message || `HTTP ${r.status}`);
			}
			result = await r.json();
		} catch (e: any) {
			error = e.message || 'Error desconocido';
		} finally {
			loading = false;
		}
	}

	const fmt = (n: number, suffix = '') => {
		if (n === undefined || n === null || isNaN(n)) return '—';
		return new Intl.NumberFormat('es-ES', { maximumFractionDigits: 2 }).format(n) + suffix;
	};

	const fmtPct = (n: number) => {
		if (n === undefined || n === null || isNaN(n)) return '—';
		return new Intl.NumberFormat('es-ES', { style: 'percent', maximumFractionDigits: 2 }).format(n);
	};

	const fmtBig = (n: number) => {
		if (n === undefined || n === null || isNaN(n)) return '—';
		if (n >= 1e12) return (n / 1e12).toFixed(2) + 'T';
		if (n >= 1e9) return (n / 1e9).toFixed(2) + 'B';
		if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M';
		return n.toFixed(0);
	};

	function onKey(e: KeyboardEvent) {
		if (e.key === 'Enter') search();
	}

	// Quick suggestions
	const suggestions = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'META', 'NVDA', 'JPM', 'V', 'JNJ', 'BRK-B', 'SAN.MC', 'ITX.MC', 'BBVA.MC', 'NESN.SW', 'OR.PA', 'SAP.DE', 'ASML.AS', 'MC.PA', '7203.T', '7267.T'];
</script>

<div class="p-4 md:p-6 space-y-5 md:space-y-6">
	<header>
		<div class="text-[11px] uppercase tracking-widest text-[var(--color-text-muted)] font-medium">Análisis</div>
		<h1 class="text-2xl md:text-3xl font-bold text-[var(--color-text-primary)] mt-1">Research</h1>
		<p class="text-[var(--color-text-muted)] text-sm mt-1">Consulta de empresas y fundamentales vía Yahoo Finance.</p>
	</header>

	<div class="flex gap-2">
		<input
			type="text"
			bind:value={ticker}
			onkeydown={onKey}
			placeholder="Ticker (ej. AAPL, SAN.MC, OR.PA)"
			class="flex-1 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-md px-3 py-2 text-sm font-mono text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-accent)]"
		/>
		<button
			onclick={search}
			disabled={loading || !ticker.trim()}
			class="px-4 py-2 bg-[var(--color-accent)] text-white rounded-md text-sm font-medium hover:bg-[var(--color-accent-hover)] disabled:opacity-40 disabled:cursor-not-allowed"
		>
			{loading ? 'Buscando...' : 'Analizar'}
		</button>
	</div>

	<div class="flex flex-wrap gap-1.5">
		{#each suggestions as s}
			<button
				onclick={() => { ticker = s; search(); }}
				class="px-2 py-1 text-[11px] font-mono bg-[var(--color-surface)] border border-[var(--color-border)] rounded text-[var(--color-text-secondary)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]"
			>{s}</button>
		{/each}
	</div>

	{#if error}
		<div class="border border-[var(--color-down)]/50 bg-[var(--color-down)]/10 rounded-md p-3 text-sm text-[var(--color-down)]">{error}</div>
	{/if}

	{#if result}
		<div class="space-y-4">
			<!-- Header -->
			<div class="border border-[var(--color-border)] rounded-lg bg-[var(--color-surface)] p-5">
				<div class="flex items-center justify-between flex-wrap gap-3">
					<div>
						<div class="text-[11px] font-mono text-[var(--color-text-muted)]">{result.ticker} · {result.exchange}</div>
						<div class="text-2xl md:text-3xl font-bold tabular text-[var(--color-text-primary)] mt-1">
							{fmt(result.price, ' ' + result.currency)}
							<span class="text-base text-[var(--color-text-muted)] ml-2">≈ {fmt(result.price_eur, ' €')}</span>
						</div>
					</div>
					<div class="text-right">
						<div class="text-2xl font-semibold tabular {result.change_percent >= 0 ? 'text-[var(--color-up)]' : 'text-[var(--color-down)]'}">
							{result.change_percent >= 0 ? '+' : ''}{(result.change_percent * 100).toFixed(2)}%
						</div>
						<div class="text-xs text-[var(--color-text-muted)]">vs cierre anterior</div>
					</div>
				</div>
			</div>

			{#if result.fundamentals}
				<div class="grid grid-cols-2 md:grid-cols-4 gap-3">
					<div class="border border-[var(--color-border)] rounded-lg bg-[var(--color-surface)] p-3">
						<div class="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)]">PER</div>
						<div class="text-xl font-bold tabular text-[var(--color-text-primary)] mt-1">{fmt(result.fundamentals.peRatio)}</div>
						{#if result.fundamentals.forwardPe}
							<div class="text-[10px] text-[var(--color-text-muted)]">Fwd: {fmt(result.fundamentals.forwardPe)}</div>
						{/if}
					</div>
					<div class="border border-[var(--color-border)] rounded-lg bg-[var(--color-surface)] p-3">
						<div class="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)]">EV/EBITDA</div>
						<div class="text-xl font-bold tabular text-[var(--color-text-primary)] mt-1">{fmt(result.fundamentals.evToEbitda)}</div>
						{#if result.fundamentals.evToRevenue}
							<div class="text-[10px] text-[var(--color-text-muted)]">EV/Rev: {fmt(result.fundamentals.evToRevenue)}</div>
						{/if}
					</div>
					<div class="border border-[var(--color-border)] rounded-lg bg-[var(--color-surface)] p-3">
						<div class="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)]">Margen operativo</div>
						<div class="text-xl font-bold tabular text-[var(--color-text-primary)] mt-1">{fmtPct(result.fundamentals.operatingMargins)}</div>
						{#if result.fundamentals.profitMargins}
							<div class="text-[10px] text-[var(--color-text-muted)]">Neto: {fmtPct(result.fundamentals.profitMargins)}</div>
						{/if}
					</div>
					<div class="border border-[var(--color-border)] rounded-lg bg-[var(--color-surface)] p-3">
						<div class="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)]">ROE</div>
						<div class="text-xl font-bold tabular text-[var(--color-text-primary)] mt-1">{fmtPct(result.fundamentals.returnOnEquity)}</div>
						{#if result.fundamentals.returnOnAssets}
							<div class="text-[10px] text-[var(--color-text-muted)]">ROA: {fmtPct(result.fundamentals.returnOnAssets)}</div>
						{/if}
					</div>
					<div class="border border-[var(--color-border)] rounded-lg bg-[var(--color-surface)] p-3">
						<div class="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)]">Crec. ingresos</div>
						<div class="text-xl font-bold tabular text-[var(--color-text-primary)] mt-1">{fmtPct(result.fundamentals.revenueGrowth)}</div>
					</div>
					<div class="border border-[var(--color-border)] rounded-lg bg-[var(--color-surface)] p-3">
						<div class="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)]">Crec. beneficio</div>
						<div class="text-xl font-bold tabular text-[var(--color-text-primary)] mt-1">{fmtPct(result.fundamentals.earningsGrowth)}</div>
					</div>
					<div class="border border-[var(--color-border)] rounded-lg bg-[var(--color-surface)] p-3">
						<div class="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)]">Deuda/Eq</div>
						<div class="text-xl font-bold tabular text-[var(--color-text-primary)] mt-1">{fmt(result.fundamentals.debtToEquity, 'x')}</div>
					</div>
					<div class="border border-[var(--color-border)] rounded-lg bg-[var(--color-surface)] p-3">
						<div class="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)]">Beta</div>
						<div class="text-xl font-bold tabular text-[var(--color-text-primary)] mt-1">{fmt(result.fundamentals.beta)}</div>
					</div>
				</div>

				<!-- Price targets -->
				{#if result.fundamentals.targetMeanPrice}
					{@const tgtMin = result.fundamentals.targetLowPrice || result.price * 0.7}
					{@const tgtMax = result.fundamentals.targetHighPrice || result.price * 1.3}
					{@const tgtRange = tgtMax - tgtMin || 1}
					<div class="border border-[var(--color-border)] rounded-lg bg-[var(--color-surface)] p-4">
						<h3 class="text-sm font-semibold mb-3 text-[var(--color-text-primary)]">Objetivos de los analistas</h3>
						<div class="space-y-2">
							<div>
								<div class="flex justify-between text-xs mb-1">
									<span class="text-[var(--color-text-muted)]">Precio actual: {fmt(result.price, ' ' + result.currency)}</span>
									<span class="text-[var(--color-text-secondary)]">Target medio: {fmt(result.fundamentals.targetMeanPrice, ' ' + result.currency)}</span>
								</div>
								<div class="relative h-2 bg-[var(--color-bg-elevated)] rounded">
									<div class="absolute h-full bg-gradient-to-r from-[var(--color-down)] via-[var(--color-warn)] to-[var(--color-up)] rounded opacity-30"
										style="left: 0%; width: 100%"></div>
									<div class="absolute w-0.5 h-3 bg-white -top-0.5"
										style="left: {Math.min(100, Math.max(0, ((result.price - tgtMin) / tgtRange) * 100))}%"></div>
									<div class="absolute w-2 h-2 bg-[var(--color-accent)] rounded-full -top-0"
										style="left: {Math.min(100, Math.max(0, ((result.fundamentals.targetMeanPrice - tgtMin) / tgtRange) * 100))}%; transform: translateX(-50%)"></div>
								</div>
								<div class="flex justify-between text-[10px] text-[var(--color-text-muted)] mt-1">
									<span>Bajo: {fmt(result.fundamentals.targetLowPrice)}</span>
									<span>Alto: {fmt(result.fundamentals.targetHighPrice)}</span>
								</div>
							</div>
						</div>
					</div>
				{/if}
			{/if}
		</div>
	{/if}
</div>
