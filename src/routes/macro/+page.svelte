<script lang="ts">
	let { data } = $props();
	const m = $derived(data.macro);

	const fmtPct = (n: number | null, digits = 2) =>
		n == null ? '—' : `${n.toFixed(digits)}%`;
	const fmtNum = (n: number | null, digits = 2) =>
		n == null ? '—' : n.toFixed(digits);

	// Regime badge color/text.
	const regimeInfo = $derived.by(() => {
		switch (m.regime) {
			case 'restrictive':
				return { label: 'Restrictivo', color: 'warn', hint: 'Tipos reales por encima de la inflación — frenando la economía' };
			case 'neutral':
				return { label: 'Neutral', color: 'accent', hint: 'Política monetaria ni muy laxa ni muy estricta' };
			case 'expansive':
				return { label: 'Expansivo', color: 'up', hint: 'Tipos bajos — estímulo monetario activo' };
			default:
				return { label: '—', color: 'default', hint: 'Dato no disponible' };
		}
	});

	// Curve slope interpretation: inverted (<0) = recession risk signal.
	const curveInfo = $derived.by(() => {
		if (m.curve_slope == null) return { label: '—', color: 'default', hint: '' };
		if (m.curve_slope < -0.2) return { label: 'Invertida', color: 'down', hint: `${m.curve_slope.toFixed(2)} pp · señal histórica de recesión` };
		if (m.curve_slope < 0.3) return { label: 'Plana', color: 'warn', hint: `${m.curve_slope.toFixed(2)} pp · curva normalizándose` };
		return { label: 'Normal', color: 'up', hint: `${m.curve_slope.toFixed(2)} pp · pendiente positiva sana` };
	});

	// VIX regime.
	const vixInfo = $derived.by(() => {
		if (m.vix == null) return { label: '—', color: 'default', hint: '' };
		if (m.vix < 15) return { label: 'Complaciente', color: 'up', hint: 'Volatilidad muy baja — posible exceso de optimismo' };
		if (m.vix < 20) return { label: 'Moderada', color: 'up', hint: 'Condiciones normales de mercado' };
		if (m.vix < 30) return { label: 'Elevada', color: 'warn', hint: 'Incertidumbre creciente' };
		return { label: 'Pánico', color: 'down', hint: 'Volatilidad alta — estrés en los mercados' };
	});

	const accentText = (c: string) =>
		c === 'up' ? 'text-[var(--color-up)]'
		: c === 'down' ? 'text-[var(--color-down)]'
		: c === 'warn' ? 'text-[var(--color-warn)]'
		: c === 'accent' ? 'text-[var(--color-accent)]'
		: 'text-[var(--color-text-muted)]';
</script>

<div class="p-6 space-y-6">
	<header>
		<div class="text-[11px] uppercase tracking-widest text-[var(--color-text-muted)] font-medium">Contexto</div>
		<h1 class="text-3xl font-bold text-[var(--color-text-primary)] mt-1">Cuadro macroeconómico</h1>
		<p class="text-[var(--color-text-muted)] text-sm mt-1">Datos en vivo para ajustar el riesgo de la cartera. No para predecir movimientos diarios.</p>
	</header>

	<!-- Live indicators -->
	<section>
		<div class="flex items-center gap-2 mb-3">
			<span class="w-1.5 h-1.5 rounded-full bg-[var(--color-up)] pulse-dot"></span>
			<span class="text-[10px] uppercase tracking-widest text-[var(--color-text-muted)]">Datos en vivo · Yahoo Finance</span>
		</div>
		<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
			<!-- US 10Y -->
			<div class="border border-[var(--color-border)] rounded-lg bg-[var(--color-surface)] p-4">
				<div class="text-[10px] uppercase tracking-widest text-[var(--color-text-muted)]">US Treasury 10Y</div>
				<div class="text-2xl font-bold tabular text-[var(--color-text-primary)] mt-1">{fmtPct(m.us_10y)}</div>
				<div class="text-[11px] text-[var(--color-text-muted)] mt-1">Activo refugio · tipo sin riesgo USD</div>
			</div>
			<!-- US 13W / Regime -->
			<div class="border border-[var(--color-border)] rounded-lg bg-[var(--color-surface)] p-4">
				<div class="text-[10px] uppercase tracking-widest text-[var(--color-text-muted)]">US 13W · Régimen</div>
				<div class="text-2xl font-bold tabular text-[var(--color-text-primary)] mt-1">{fmtPct(m.us_13w)}</div>
				<div class="text-[11px] mt-1 {accentText(regimeInfo.color)}">{regimeInfo.label} · {regimeInfo.hint}</div>
			</div>
			<!-- Curve slope -->
			<div class="border border-[var(--color-border)] rounded-lg bg-[var(--color-surface)] p-4">
				<div class="text-[10px] uppercase tracking-widest text-[var(--color-text-muted)]">Curva 10Y−13W</div>
				<div class="text-2xl font-bold tabular text-[var(--color-text-primary)] mt-1">{m.curve_slope == null ? '—' : `${m.curve_slope >= 0 ? '+' : ''}${m.curve_slope.toFixed(2)} pp`}</div>
				<div class="text-[11px] mt-1 {accentText(curveInfo.color)}">{curveInfo.label} · {curveInfo.hint}</div>
			</div>
			<!-- VIX -->
			<div class="border border-[var(--color-border)] rounded-lg bg-[var(--color-surface)] p-4">
				<div class="text-[10px] uppercase tracking-widest text-[var(--color-text-muted)]">VIX</div>
				<div class="text-2xl font-bold tabular text-[var(--color-text-primary)] mt-1">{fmtNum(m.vix)}</div>
				<div class="text-[11px] mt-1 {accentText(vixInfo.color)}">{vixInfo.label} · {vixInfo.hint}</div>
			</div>
		</div>

		<!-- Bund (eurozone proxy) shown separately as it sometimes fails -->
		<div class="mt-3 border border-[var(--color-border)] rounded-lg bg-[var(--color-surface)] p-4 max-w-sm">
			<div class="text-[10px] uppercase tracking-widest text-[var(--color-text-muted)]">Bund alemán 10Y</div>
			<div class="text-xl font-bold tabular text-[var(--color-text-primary)] mt-1">{fmtPct(m.bund_10y)}</div>
			<div class="text-[11px] text-[var(--color-text-muted)] mt-1">Tipo sin riesgo EUR · proxy BCE</div>
		</div>
	</section>

	<!-- Methodology framework (static — interpretive lens, not live data) -->
	<section class="grid grid-cols-1 lg:grid-cols-2 gap-4">
		<div class="border border-[var(--color-border)] rounded-lg bg-[var(--color-surface)] p-5">
			<div class="flex items-center gap-2 mb-3">
				<span class="text-[10px] uppercase tracking-widest text-[var(--color-text-muted)]">Marco</span>
				<h2 class="text-sm font-semibold text-[var(--color-text-primary)]">Lectura del entorno</h2>
			</div>
			<ul class="space-y-2 text-sm text-[var(--color-text-secondary)] list-disc list-inside">
				<li>Tipos en zona restrictiva (EE.UU. y eurozona), política monetaria aún firme</li>
				<li>Inflación moderándose pero no controlada del todo; riesgo de repunte en commodities</li>
				<li>Curva de tipos normalizándose tras inversiones prolongadas — recesión no inminente pero no descartable</li>
				<li>VIX en rango normal, sin pánico; condiciones para entrar gradualmente</li>
				<li>Bolsas en máximos históricos → exigir mayor margen de seguridad en nuevas entradas</li>
			</ul>
		</div>
		<div class="border border-[var(--color-border)] rounded-lg bg-[var(--color-surface)] p-5">
			<div class="flex items-center gap-2 mb-3">
				<span class="text-[10px] uppercase tracking-widest text-[var(--color-text-muted)]">Marco</span>
				<h2 class="text-sm font-semibold text-[var(--color-text-primary)]">Implicaciones para la cartera</h2>
			</div>
			<ul class="space-y-2 text-sm text-[var(--color-text-secondary)] list-disc list-inside">
				<li>Mantener liquidez elevada inicial (30-50%) hasta encontrar value con margen real</li>
				<li>No perseguir tecnológicas en máximos sin descuento &gt;20% frente a valor razonable</li>
				<li>Vigilar sector financiero (sensible a tipos) y energético (sensible a geopolítica)</li>
				<li>Diversificación geográfica útil: Europa/Japón ofrecen value fuera del S&P caro</li>
			</ul>
		</div>
	</section>
</div>
