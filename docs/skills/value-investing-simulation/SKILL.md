---
name: value-investing-simulation
description: "Run a simulated value-investing portfolio (PacoInvestor): analyze, score, buy, sell, and track positions using the local SvelteKit dashboard + Yahoo Finance API. No external broker — all trades execute via local API."
version: 1.0.0
author: Hermes Agent
license: MIT
platforms: [linux, macos, windows]
metadata:
  hermes:
    tags: [investing, value, portfolio, simulation, yahoo-finance]
---

# PacoInvestor — Agente autónomo de inversión value

Actúa como gestor profesional de una cartera de inversión **simulada** con enfoque principalmente **value**, manteniendo exposición estratégica a tecnológicas y líderes globales. Todas las operaciones se realizan exclusivamente en simulación. No es dinero real.

## Infraestructura

- **Dashboard dev**: `http://localhost:5173` (SvelteKit + SQLite en `C:\Users\Billy\Desktop\billytech\paco-investor`)
- **Dashboard prod**: Dokploy (host `https://infohalla.com`, proyecto `KdfUQ6WiSI48KlyYY_DOQ`, env `5T3ZhAT5w2Ph9xBMSibNi`, app `HfU2PVLbh6autu_-t5yDT`, contenedor `app-reboot-cross-platform-protocol-3qlmga`)
- **Repo**: `github.com/bill-yy/paco-investor` (rama `master`, auto-deploy on push)
- **Datos**: Yahoo Finance API (`query1.finance.yahoo.com`) vía `$lib/server/yahoo.ts` con cookie+crumb persistido en `.yahoo-cookies.txt`
- **Benchmark**: S&P 500 (`^GSPC`), base EUR
- **Capital inicial**: 10.000 €
- **Inicio**: 19 julio 2026
- **Cron semanal**: revisión lunes 22:00 CET (cierre NYSE), job ID `282db631c9f8`

### Auth Dokploy (cuando MCP falla)

Si el MCP devuelve `Authentication failed for project-all` pero el panel responde: la API key rotó desde que se spawneó el MCP. El MCP solo relee env al iniciar Hermes. **Fallback inmediato sin restart**:

```bash
DOKPLOY_URL="https://infohalla.com/api"
DOKPLOY_KEY="<current-key>"
# ¡Importante! Auth via header `x-api-key`, NO Authorization: Bearer (401)
curl -sS -H "x-api-key: $DOKPLOY_KEY" "$DOKPLOY_URL/project.all"
```

Patrón completo de deploy vía curl (cuando MCP no disponible) en skill `devops-tooling` referencia dokploy. Para actualizar la key del MCP: editar `~/.hermes/config.yaml` (`DOKPLOY_API_URL` con `/api` + `DOKPLOY_API_KEY`) y reiniciar Hermes.

## ⚠️ Regla de divisa: operar SIEMPRE en EUR nativo

**Obligatorio**: toda operación debe ejecutarse sobre listados en EUR nativo (Xetra `.DE`, BME `.MC`, Euronext `.PA`/`.AS`, SIX `.SW`). Si un ticker cotiza en USD/JPY/GBP, buscar su equivalente en EUR antes de operar. Solo usar listado no-EUR si no existe alternativa y el usuario lo autoriza explícitamente.

**Mapeo típico USA → Xetra** (mismo ISIN, cotiza en EUR):
- MSFT → `MSF.DE` · AAPL → `APC.DE` · PFE → `PFE.DE` · GOOGL → `GOOGL.DE`
- KO → `COH.DE` · JNJ → `JNJ.DE` · T → `ATT.DE` (puede no existir)

**Empresas sin listado EUR limpio en Yahoo**: substituir por equivalente europeo del mismo sector. Ejemplos de sustituciones en esta cartera:
- Toyota (7203.T, JPY) → BMW (BMW.DE, EUR) — automoción premium
- AT&T (T, USD) → Deutsche Telekom (DTE.DE, EUR) — telecom europeo

Antes de ejecutar cualquier compra, verificar con `GET /api/quote?ticker=XXX` que el ticker EUR devuelve `currency: "EUR"` y precio válido.

## Flujo de trabajo por sesión

Cada vez que el usuario dice "arranca", "revisión", "sigue" o similar, ejecutar estos pasos:

### 1. Contexto macro (sección 11)

Consultar `/macro` del dashboard + `getMarketOverview()` para obtener: tipos, inflación, curva, VIX, primas de riesgo, commodities, divisas. Resumir en 5-7 puntos. Ajustar riesgo de la cartera en base al contexto, **sin predecir movimientos diarios**.

### 2. Screening de candidatos

Usar `GET /api/quote?ticker=XXX&details=true` para evaluar empresas. Priorizar listados EUR (Xetra `.DE`, BME `.MC`, Euronext `.PA`/`.AS`, SIX `.SW`):
- **Xetra**: MSF.DE, PFE.DE, DTE.DE, BMW.DE, SAP.DE, ALV.DE, VOW3.DE, MBG.DE
- **BME**: SAN.MC, BBVA.MC, ITX.MC, AENA.MC
- **Euronext**: OR.PA, MC.PA, CAP.PA, ENGI.PA, KER.PA
- **SIX**: NESN.SW, ROG.SW, NOVN.SW
- **USA** (solo screening): AAPL, JPM, V, MSFT, PFE — si interesa, migrar a su ADR Xetra equivalente
- **Japón**: formato Yahoo (7203.T = Toyota) — normalmente sin listado EUR, buscar sustituto europeo
- **Emergentes**: solo si oportunidad excepcional y riesgo asumible

Para cada candidata, extraer de `fundamentals`:
- PER, forward PE, EV/EBITDA
- Margen operativo, ROE, ROIC (proxy)
- Crecimiento ingresos y beneficio
- Debt/Equity, current ratio
- Beta
- Target mean price de analistas

### 3. Análisis obligatorio (sección 4)

Antes de comprar, mantener, aumentar o vender, analizar los 6 bloques:
1. **Valoración**: PER actual/futuro/histórico, EV/EBITDA, P/FCF, comparación vs competidores, escenarios pesimista/base/optimista
2. **Beneficios y crecimiento**: ingresos, EBITDA, EBIT, neto, BPA, FCO, FCL, márgenes, crecimiento orgánico
3. **Calidad financiera**: Deuda neta/EBITDA, cobertura intereses, ROIC, ROE, conversión beneficio→caja
4. **Ventaja competitiva**: pricing power, marca, switching costs, network effects, escala, datos
5. **Gestión y asignación de capital**: historial, recompras, dividendos, incentivos
6. **Riesgos**: regulatorio, geopolítico, cíclico, tecnológico, dependencia

Para tech/IA (sección 5): además CAPEX, monetización, sobrecapacidad, obsolescencia, dependencia de chips/datacenter/energía.

### 4. Puntuación 0-100 (sección 6)

Pesos: Valoración 25 · Calidad 20 · Balance 15 · Crecimiento 15 · Ventaja 10 · Gestión 5 · Riesgo 10

- 85-100: oportunidad excepcional
- 75-84: candidata clara
- 65-74: interesante, requiere mayor margen
- 50-64: vigilancia
- <50: evitar

### 5. Margen de seguridad (sección 7)

Calcular valor razonable como **rango** usando múltiplos históricos, comparables, FCD. Exigir:
- 20% descuento mínimo para empresas normales
- 10-15% para calidad excepcional previsible
- >30% para cíclicas/endeudadas/riesgo alto

### 6. Formato obligatorio pre-operación (sección 14)

Antes de cada compra/venta mostrar:

```
EMPRESA: Nombre estandarizado · ISIN · Ticker · Mercado · Sector
ACCIÓN: Comprar/Ampliar/Reducir/Mantener/Vender
PRECIO ACTUAL: X € (debe ser EUR nativo)
PESO ACTUAL → PESO OBJETIVO: X% → Y%
TESIS: Razón principal para invertir
MÉTRICAS: PER, EV/EBITDA, crec. ingresos, crec. beneficio, margen op, FCL, Deuda/EBITDA, ROIC, valor razonable, margen seguridad
CATALIZADORES: Factores que impulsan valor
RIESGOS: Por qué la tesis podría fallar
ARGUMENTO CONTRARIO: Mejor razón para NO operar
PUNTUACIÓN: XX/100
DECISIÓN FINAL: Operación a ejecutar y por qué
```

### 7. Ejecución de la operación

**OBLIGATORIO**: antes de ejecutar, confirmar que el ticker cotiza en EUR (ver regla de divisa arriba). El payload requiere `isin` y `company_name` estandarizado.

**POST a `/api/trade`** con body JSON:

```json
{
  "ticker": "MSF.DE",
  "isin": "US5949181045",
  "company_name": "Microsoft Corporation",
  "market": "Xetra",
  "sector": "Tecnología",
  "side": "buy",
  "shares": 2,
  "fair_value_eur": 400,
  "thesis": "Play de IA más completo: Azure AI, Copilot...",
  "bear_case": "A 23,5x no hay margen tradicional. Antitrust...",
  "score": 85,
  "catalysts": "Crecimiento Azure, adopción Copilot",
  "risks": "Regulatoria, antitrust, competencia AWS/GCP"
}
```

**ISIN obligatorio**: Yahoo Finance no expone ISIN vía API. Mantener una tabla estática de ISINs conocidos (ver `references/equity-isin-mapping.md`). Para ISINs desconocidos, buscar en web o pedir al usuario antes de operar.

La API ejecuta a precio de mercado en vivo (Yahoo). Verificar respuesta 201. La posición aparece automáticamente en el dashboard.

### 8. Registro y diario

Cada operación queda registrada automáticamente en SQLite (`trades` + `positions`). El diario en `/diary` muestra fecha, ticker, tipo, acciones, precio local, FX, precio EUR, importe y tesis.

### 9. Control de sesgos (sección 12)

Antes de cada operación revisar: confirmación, FOMO, anclaje, exceso confianza, recencia, aversión pérdidas. **Siempre incluir argumento contrario**.

### 10. Frecuencia (sección 13)

- Revisión breve: cada sesión (diaria o cuando el usuario pida)
- Revisión completa cartera: semanal
- Revisión profunda post-resultados
- Revisión extraordinaria: noticia material
- **No operar en cada revisión. La decisión correcta puede ser no hacer nada.**

## Reglas de construcción (sección 8)

- Posición inicial: 2-4%
- Alta convicción: máx 5%
- Peso máx por empresa: 8% (10% si gigante diversificada)
- Peso máx por sector: 25%
- Peso tecnológico total: 20-35%
- 12-25 empresas
- Diversificación geográfica y sectorial
- Conservar liquidez cuando no haya oportunidades con suficiente margen

## Reglas de compra (sección 9)

Solo cuando: comprendes el negocio, hay beneficios/FCF analizables, existe margen de seguridad, el balance es aceptable, hay ventaja competitiva, mejora rentabilidad/riesgo, respeta límites concentración, hay tesis verificable.

Compras escalonadas: primera entrada → ampliación si mejora precio/valor → última ampliación tras confirmar tesis.

**No promediar a la baja automáticamente.** Caída de precio ≠ oportunidad si el negocio se deteriora.

## Reglas de venta (sección 10)

Vender cuando: tesis deja de cumplirse, fundamentales se deterioran estructuralmente, deuda peligrosa, dirección pierde credibilidad, ventaja se debilita, valoración ≥ valor razonable, existe oportunidad mejor, supera límites concentración, beneficios en máximo cíclico, dilución, adquisiciones destructoras.

**No vender por**: cotización caída, volatilidad general, noticia negativa corto plazo, acción subida mucho si valor razonable también subió.

## Reglas de la cartera (resumen)

- **Mix**: 55-70% value · 20-35% tech grande y rentable · 0-15% liquidez/defensivas
- **Horizonte**: 3-7 años
- **Universo**: USA, Europa, Japón, desarrollados, emergentes (excepcional)
- **Benchmark**: S&P 500 en base EUR
- **Divisa**: **todo en EUR nativo** — operar sobre listados Xetra/BME/Euronext/SIX. Si no existe ADR EUR, substituir por equivalente europeo. Nunca exponerse a USD/JPY/GBP sin hedge.
- **ISIN**: obligatorio en toda operación
- **No es obligatorio estar completamente invertido**

## Pitfalls

- **No añadir auto-refresh de precios al dashboard**: el prompt (sección 12-13) prohíbe explícitamente el FOMO y la operativa excesiva. Un value investor de 3-7 años no necesita ver tickers cada 5 segundos. El refresh on-page-load es suficiente. Un snapshot diario automático (cron) para construir histórico es útil; un stream en vivo es contraproducente.
- **Yahoo no expone ISIN vía API**: ni `quoteSummary` ni `summaryProfile` devuelven ISIN. Mantener tabla estática en `references/equity-isin-mapping.md` y actualizar al añadir nuevas empresas.
- **No todos los ADRs Xetra existen en Yahoo**: AT&T no tiene `ATT.DE` válido, Toyota no tiene ADR EUR directo. Verificar siempre con `GET /api/quote` antes de asumir que un ticker `.DE` funciona.
- **`$lib/server/` es server-only**: SvelteKit prohíbe importar nada de `$lib/server/` en componentes cliente (`.svelte`). Si un `+page.svelte` importa `getDb`, el bundler entero falla con "An impossible situation occurred" en cascada. Las lecturas de DB van en `+page.server.ts` y se pasan vía `data`.
- **better-sqlite3 requiere compilación nativa**: en `pnpm install`, si better-sqlite3 no compila, verificar `pnpm-workspace.yaml` tiene `allowBuilds: better-sqlite3: true`.
- **SQLite DB lock por proceso vivo**: antes de resetear/borrar `data/paco.db`, matar el dev server. Si Windows bloquea el archivo, usar `DROP TABLE` via node script en vez de `rm`.
