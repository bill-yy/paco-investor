<script lang="ts">
	// Macro: contexto global, prima de riesgo, tipos, curva
	let { data } = $props();
</script>

<div class="p-6 space-y-6">
	<header>
		<div class="text-[11px] uppercase tracking-widest text-[var(--color-text-muted)] font-medium">Contexto</div>
		<h1 class="text-3xl font-bold text-[var(--color-text-primary)] mt-1">Cuadro macroeconómico</h1>
		<p class="text-[var(--color-text-muted)] text-sm mt-1">Datos relevantes para ajustar el riesgo de la cartera. No para predecir movimientos diarios.</p>
	</header>

	<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
		<div class="border border-[var(--color-border)] rounded-lg bg-[var(--color-surface)] p-4">
			<div class="text-[10px] uppercase tracking-widest text-[var(--color-text-muted)]">Tipos Fed</div>
			<div class="text-2xl font-bold tabular text-[var(--color-text-primary)] mt-1">5.50%</div>
			<div class="text-[11px] text-[var(--color-warn)] mt-1">Restrictivo · inflación 3.2%</div>
		</div>
		<div class="border border-[var(--color-border)] rounded-lg bg-[var(--color-surface)] p-4">
			<div class="text-[10px] uppercase tracking-widest text-[var(--color-text-muted)]">Tipos BCE</div>
			<div class="text-2xl font-bold tabular text-[var(--color-text-primary)] mt-1">4.25%</div>
			<div class="text-[11px] text-[var(--color-warn)] mt-1">Restrictivo · inflación zona € 2.5%</div>
		</div>
		<div class="border border-[var(--color-border)] rounded-lg bg-[var(--color-surface)] p-4">
			<div class="text-[10px] uppercase tracking-widest text-[var(--color-text-muted)]">US 10Y</div>
			<div class="text-2xl font-bold tabular text-[var(--color-text-primary)] mt-1">4.45%</div>
			<div class="text-[11px] text-[var(--color-text-muted)] mt-1">Curva normalizándose</div>
		</div>
		<div class="border border-[var(--color-border)] rounded-lg bg-[var(--color-surface)] p-4">
			<div class="text-[10px] uppercase tracking-widest text-[var(--color-text-muted)]">VIX</div>
			<div class="text-2xl font-bold tabular text-[var(--color-text-primary)] mt-1">18.77</div>
			<div class="text-[11px] text-[var(--color-up)] mt-1">Volatilidad moderada</div>
		</div>
	</div>

	<div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
		<div class="border border-[var(--color-border)] rounded-lg bg-[var(--color-surface)] p-5">
			<h2 class="text-sm font-semibold mb-3 text-[var(--color-text-primary)]">Lectura del entorno</h2>
			<ul class="space-y-2 text-sm text-[var(--color-text-secondary)] list-disc list-inside">
				<li>Tipos en zona restrictiva (EE.UU. y eurozona), política monetaria aún firme</li>
				<li>Inflación moderándose pero no controlada del todo; riesgo de repunte en commodities</li>
				<li>Curva de tipos normalizándose tras inversiones prolongadas — recesión no inminente pero no descartable</li>
				<li>VIX en rango normal, sin pánico; condiciones paraentrar gradualmente</li>
				<li>Bolsas en máximos históricos → exigir mayor margen de seguridad en nuevas entradas</li>
			</ul>
		</div>
		<div class="border border-[var(--color-border)] rounded-lg bg-[var(--color-surface)] p-5">
			<h2 class="text-sm font-semibold mb-3 text-[var(--color-text-primary)]">Implicaciones para la cartera</h2>
			<ul class="space-y-2 text-sm text-[var(--color-text-secondary)] list-disc list-inside">
				<li>Mantener liquidez elevada inicial (30-50%) hasta encontrar value con margen real</li>
				<li>No perseguir tecnológicas en máximos sin descuento &gt;20% frente a valor razonable</li>
				<li>Vigilar sector financiero (sensible a tipos) y energético (sensible a geopolitical)</li>
				<li>Diversificación geográfica útil: Europa/Japón ofrecen value fuera del S&P caro</li>
			</ul>
		</div>
	</div>
</div>
