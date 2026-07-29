# PacoInvestor — Diseño de Estrategias: Paco Trader & Paco Funds

> Documento de diseño para las dos nuevas estrategias que competirán en paralelo
> con **Paco Value** (ya operativa). Ambas arrancan con **0 € de capital inicial**
> y reciben **100 €/mes de aporte DCA**. Todo opera en **EUR nativo**.
> Benchmark: **S&P 500** (`^GSPC`) en base EUR.
>
> Generado: 2026-07-30. Convierte cada sección en un prompt de cron independiente.

---

## Tabla de contenidos

1. [Contexto técnico común](#1-contexto-técnico-común)
2. [Estrategia 1 — Paco Trader (Swing/Position)](#2-estrategia-1--paco-trader-swingposition)
3. [Estrategia 2 — Paco Funds (ETF pasivos)](#3-estrategia-2--paco-funds-etf-pasivos)
4. [Mapeo a la infraestructura existente](#4-mapeo-a-la-infraestructura-existente)
5. [Prompt de cron — resumen ejecutivo](#5-prompt-de-cron--resumen-ejecutivo)

---

## 1. Contexto técnico común

Ambas estrategias se apoyan en la infraestructura ya desplegada en
`paco-investor` (SvelteKit + SQLite). El schema **ya soporta multi-strategy**:
todas las tablas relevantes (`positions`, `trades`, `valuations`) tienen columna
`strategy_id`, y la tabla `strategies` ya tiene sembradas las tres filas:

| id        | name         | type       | initial_capital | monthly_contribution | ter_annual |
|-----------|--------------|------------|-----------------|----------------------|------------|
| `value`   | Paco Value   | value      | 10.000 €        | 0 €                  | 0          |
| `trader`  | Paco Trader  | trading    | 0 €             | 100 €                | 0          |
| `funds`   | Paco Funds   | passive    | 0 €             | 100 €                | 0.0022 (0.22%) |

**Aporte DCA mensual**: la tabla `contributions(strategy_id, date, amount_eur)`
con `UNIQUE(strategy_id, date)` ya existe. El cron debe insertar 100 € el día 1
de cada mes (o el primer día hábil) para `trader` y `funds`. La lógica de cash
en `valuation.ts`/`portfolio.ts` actualmente deriva el cash de
`settings.initial_capital` + ventas − compras; **para que el aporte se refleje en
el cash disponible**, el cron debe registrar la aportación en `contributions` Y
ajustar un contador de cash acumulado. Ver [§4](#4-mapeo-a-la-infraestructura-existente)
para el detalle de implementación (lo más simple: el cron suma 100 € a
`settings.trader_cash` / `settings.funds_cash` y resta al comprar).

**APIs disponibles** (verificadas en el repo):

- `GET /api/quote?ticker=X&details=true` → precio, currency, FX a EUR,
  fundamentales (PER, EV/EBITDA, beta, márgenes, target price…).
- `GET https://query1.finance.yahoo.com/v8/finance/chart/{ticker}?interval=1d&range={period}`
  → histórico OHLCV diario. **Sin crumb** para el endpoint `/chart/v8`
  (confirmado: `getQuote` en `yahoo.ts` lo usa así). Devuelve:
  `timestamp[]`, `indicators.quote[0].{open,high,low,close,volume}[]`.
  Es lo que el cron del Trader usa para calcular todos los indicadores técnicos.
- `POST /api/trade` → ejecuta compra/venta a precio de mercado vivo. Body requiere
  `ticker, company_name, market, sector, side, shares` (+ opcionales `isin,
  thesis, score, catalysts, risks, fair_value_eur`). **⚠️ UTF-8**: usar
  `curl --data-binary @file.json` (NO `-d`) si el JSON lleva acentos/€.
- `POST /api/snapshot` → fuerza un snapshot de valoración (mark-to-market +
  benchmark). Llamar al final de cada run del cron.

**Regla de divisa (no negociable)**: todo ticker debe cotizar en **EUR nativo**
(Xetra `.DE`, Euronext `.PA`/`.AS`, BME `.MC`, Borsa Italiana `.MI`). Verificar
con `/api/quote` que `currency === "EUR"` antes de operar. Los ETFs deben ser
UCITS domiciliados en Europa.

**UTF-8**: los nombres de ETFs/empresas europeas llevan acentos y €. El patrón
obligatorio para trades desde cron es `write_file` + `curl --data-binary @file`
(ver skill `value-investing-simulation` §7).

---

## 2. Estrategia 1 — Paco Trader (Swing/Position)

### 2.1 Filosofía

Swing trading sistemático basado en **análisis técnico puro** (sin
fundamentales). Captura movimientos de **5 a 30 días** en acciones europeas
líquidas. Usa un sistema de **scoring de señales** (no una sola regla) para
evitar whipsaws: se requiere confluencia de varios indicadores. Gestión estricta
del riesgo con stop-loss y take-profit en cada trade. **Solo largos** en fase 1
(el corto en Europa tiene coste de préstamo y riesgo asimétrico que no merece la
pena con 100 €/mes).

### 2.2 Universo de tickers (EUR nativo, líquido)

20 acciones de gran liquidez en Xetra/Euronext/BME. Todas cotizan en EUR y
tienen volumen diario alto (spread estrecho, filler garantizado incluso con
órdenes pequeñas). Verificar ISIN en `references/equity-isin-mapping.md`.

| Ticker    | Empresa                  | Mercado  | Sector           | Beta aprox |
|-----------|--------------------------|----------|------------------|------------|
| `SAP.DE`  | SAP SE                   | Xetra    | Software         | 1.0        |
| `SIE.DE`  | Siemens AG               | Xetra    | Industrial       | 1.1        |
| `ALV.DE`  | Allianz SE               | Xetra    | Seguros          | 0.9        |
| `BMW.DE`  | BMW AG                   | Xetra    | Automoción       | 1.3        |
| `MBG.DE`  | Mercedes-Benz Group      | Xetra    | Automoción       | 1.2        |
| `BAS.DE`  | BASF SE                  | Xetra    | Química          | 1.1        |
| `DTE.DE`  | Deutsche Telekom         | Xetra    | Telecom          | 0.6        |
| `VOW3.DE` | Volkswagen AG            | Xetra    | Automoción       | 1.3        |
| `IFX.DE`  | Infineon Technologies    | Xetra    | Semiconductores  | 1.5        |
| `DHL.DE`  | DHL Group (ex-Deutsche Post) | Xetra    | Logística        | 1.1        |
| `OR.PA`   | L'Oréal                  | Euronext | Consumo          | 0.8        |
| `MC.PA`   | LVMH                     | Euronext | Lujo             | 1.1        |
| `TTE.PA`  | TotalEnergies            | Euronext | Energía          | 0.8        |
| `AI.PA`   | Air Liquide              | Euronext | Química/Industrial | 0.7      |
| `RMS.PA`  | Hermès                   | Euronext | Lujo             | 0.9        |
| `SAN.PA`  | Sanofi                   | Euronext | Farmacia         | 0.6        |
| `ENGI.PA` | Engie                    | Euronext | Utilities        | 0.8        |
| `ITX.MC`  | Inditex                  | BME      | Retail           | 1.0        |
| `SAN.MC`  | Santander                | BME      | Banca            | 1.3        |
| `BBVA.MC` | BBVA                     | BME      | Banca            | 1.4        |

**Criterio de rotación**: el universo es fijo, pero el cron filtra cada semana
por **liquidez mínima** (volumen medio 20d > 5M €) y **precio < 500 €** (para que
100 € compren al menos fracciones de acción). Si un ticker no pasa el filtro, se
excluye esa semana.

### 2.3 Indicadores técnicos (con parámetros concretos)

Todos se calculan sobre el **cierre diario**. El cron necesita `range=1y` del
endpoint `/v8/finance/chart` para tener suficientes datos para EMA200 y
Bollinger(20,2). Parámetros elegidos por robustez probada en literatura y
backtests públicos (no sobre-optimizados).

| # | Indicador             | Parámetros              | Qué mide                          | Señal para LONG                                    |
|---|-----------------------|-------------------------|-----------------------------------|----------------------------------------------------|
| 1 | **EMA 20**            | período 20              | Tendencia corto plazo             | Precio por encima → momentum alcista               |
| 2 | **EMA 50**            | período 50              | Tendencia medio plazo             | Precio por encima → sesgo alcista                  |
| 3 | **EMA 200**           | período 200             | Tendencia primaria (filtro)       | **Filtro maestro**: solo largos si precio > EMA200 |
| 4 | **RSI (14)**          | período 14              | Sobrecompra/sobreventa            | Cruce al alza desde <30 (oversold bounce)         |
| 5 | **MACD (12,26,9)**    | fast 12, slow 26, sig 9 | Momentum direccional              | Histograma >0 y creciendo, o cruce alcista línea  |
| 6 | **Bollinger Bands**   | 20, 2σ                  | Volatilidad y extremos            | Precio toca banda inferior + rebote               |
| 7 | **ATR (14)**          | período 14              | Volatilidad (sizing de stop)      | Stop-loss = entrada − 2×ATR                        |
| 8 | **OBV**              | —                       | Volumen acumulado (confirmación)  | OBV creciente confirma compra                      |
| 9 | **Stochastic (14,3,3)**| %K 14, %D 3, slow 3     | Momentum en rango                 | %K cruza al alza %D desde zona <20                |
| 10| **ADX (14)**          | período 14              | Fuerza de tendencia (no dirección)| ADX > 25 → tendencia fuerte, premia señales        |

**Fórmulas de cálculo** (para que el cron las implemente en Python/JS sin
librerías externas):

```python
# EMA
def ema(values, period):
    k = 2 / (period + 1)
    ema = [values[0]]
    for v in values[1:]:
        ema.append(v * k + ema[-1] * (1 - k))
    return ema

# RSI (Wilder's smoothing)
def rsi(closes, period=14):
    gains, losses = [], []
    for i in range(1, len(closes)):
        d = closes[i] - closes[i-1]
        gains.append(max(d, 0)); losses.append(max(-d, 0))
    avg_g = sum(gains[:period]) / period
    avg_l = sum(losses[:period]) / period
    rs = avg_g / avg_l if avg_l else 100
    rsi = 100 - 100 / (1 + rs)
    for i in range(period, len(gains)):
        avg_g = (avg_g * (period-1) + gains[i]) / period
        avg_l = (avg_l * (period-1) + losses[i]) / period
        rs = avg_g / avg_l if avg_l else 100
        rsi = 100 - 100 / (1 + rs)
    return rsi

# ATR (Wilder)
def atr(highs, lows, closes, period=14):
    trs = [max(h-l, abs(h-prev_c), abs(l-prev_c))
           for h,l,prev_c in zip(highs[1:],lows[1:],closes[:-1])]
    atr = sum(trs[:period]) / period
    for tr in trs[period:]:
        atr = (atr * (period-1) + tr) / period
    return atr

# Bollinger: SMA(20) ± 2×std(20)
# MACD: EMA(12) − EMA(26); signal = EMA(9) del MACD; hist = MACD − signal
# ADX y Stochastic: ver implementación estándar (incluida en anexo si se pide)
```

### 2.4 Sistema de scoring de señales (entry rules)

**No** se compra con una sola condición. Cada setup puntúa; se requiere
**≥ 5 puntos de 8** para disparar compra. Esto filtra falsas señales y evita
overtrading con poco capital.

#### LONG entry — checklist de 8 puntos

| Punto | Condición                                               | Puntos |
|-------|---------------------------------------------------------|--------|
| 1 ⭐   | **Precio > EMA200** (filtro maestro, obligatorio)       | — (gate) |
| 2     | Precio > EMA50                                          | +1     |
| 3     | EMA20 > EMA50 (alineamiento alcista)                    | +1     |
| 4     | RSI(14) < 40 y girando al alza (oversold o zona media-baja) | +1 |
| 5     | MACD histograma > 0 y creciendo                         | +1     |
| 6     | Precio toca/rebota banda inferior Bollinger             | +1     |
| 7     | Stochastic %K cruza al alza %D desde <20                | +1     |
| 8     | OBV en máximo 20d (volumen confirma)                    | +1     |
| 9     | ADX > 25 (tendencia fuerte)                             | +1     |

> **Disparo**: gate (precio > EMA200) cumplido **Y** ≥ 5 puntos → **BUY signal**.
> Entre 3-4 puntos → añadir a watchlist, no comprar. <3 → ignorar.

#### SHORT entry — **desactivado en fase 1**

Se diseña el sistema pero no se activa. Razones: (a) con 100 €/mes el coste de
préstamo de acciones y el riesgo ilimitado del corto son desproporcionados;
(b) la simulación debe comparar estrategias realistas que un inversor particular
europeo ejecutaría. Si en el futuro se quiere activar, las reglas serían el
**espejo** del long (precio < EMA200, RSI > 70, MACD bajista, etc.) y se
simularía via CFD o venta corta con fee de borrow del 3-5% anual.

### 2.5 Reglas de salida (gestión del riesgo)

Cada posición abierta lleva **tres niveles de salida** predefinidos, calculados
al abrir el trade y guardados en `positions.stop_loss_eur`,
`positions.take_profit_eur` (columnas ya existentes en el schema):

| Mecanismo       | Regla                                         | R:R resultante |
|-----------------|-----------------------------------------------|----------------|
| **Stop-loss**   | Entrada − **2 × ATR(14)** (volatilidad-adaptativo) | —          |
| **Take-profit** | Entrada + **3 × ATR(14)**                     | 1 : 1.5        |
| **Trailing stop** | Tras +1.5×ATR de ganancia, el stop sube a **entrada − 0.5×ATR** (break-even + buffer). Tras +3×ATR, sube a entrada +1.5×ATR. | lock-in |

**Reglas adicionales de salida** (revisadas en cada run del cron):

- **Cruce bajista EMA20 < EMA50** → cerrar inmediatamente (momentum roto).
- **RSI > 75** tras una subida → cerrar 50% de la posición (tomar parcial).
- **Tiempo máximo**: si una posición lleva **> 30 días hábiles** sin tocar TP ni
  SL, cerrar (capital atrapado sin tesis técnica vigente).
- **MACD cruza a bajista** (histograma < 0) con precio por debajo de EMA50 → cerrar.

**No se promedian pérdidas** (anti-martingala): si el stop salta, la posición se
cierra y no se reabre hasta nuevo setup válido.

### 2.6 Duración media esperada de trade

- **Objetivo**: 5-30 días hábiles.
- **Distribución esperada**: ~60% de trades cerrados por TP o SL entre 5-15 días;
  ~30% entre 15-30 días; ~10% cerrados por tiempo (30 días).
- **Win rate objetivo**: 45-55% (los TP son 1.5× el SL, así que con ≥40% de
  acierto el sistema es rentable en expectativa: 0.40×1.5 − 0.60×1.0 = +0.0 R).

### 2.7 Sizing con 100 €/mes

**Problema**: 100 €/mes es poco capital para swing trading en acciones enteras.
Una acción de SAP.de a ~250 € no se puede comprar con 100 €.

**Solución por fases**:

1. **Fase acumulación (meses 1-6)**: los 100 €/mes se guardan como **cash** hasta
   acumular un mínimo operable. Mientras tanto, el cron **registra las señales**
   que iría disparando en una tabla `notes` o un log, para poder comparar
   "señal teórica" vs "trade ejecutado" más adelante.
2. **Fase operativa (mes 6+)**: con ~600 € acumulados, se opera.
   - **Tamaño de posición**: cada trade arriesga **2% del equity total** de la
     estrategia (no del aporte mensual). Con 600 €, eso son 12 € de riesgo por
     trade. Stop = 2×ATR. Si ATR diario de SAP.de es ~5 €, el stop son 10 €, así
     que posición = 12 € / 10 € = 1.2 acciones → **1 acción**.
   - **Máximo de posiciones simultáneas**: **3** (para no sobreconcentrar con
     poco capital). Si ya hay 3 abiertas, las señales nuevas van a watchlist.
   - **Cash buffer**: mantener siempre ≥ 1 aporte mensual (100 €) en cash para
     no quedarse sin munición si saltan varios stops a la vez.
3. **Re-inversión**: los beneficios de los TP se quedan en cash de la estrategia
   y amplían el equity para trades futuros (efecto interés compuesto).

**Workaround de fraccionamiento**: si la API solo permite acciones enteras (el
schema `shares` es REAL, así que técnicamente permite fracciones), usar **1
acción** como mínimo y esperar a tener cash suficiente. Si se quiere realismo de
broker europeo, asumir que **solo se compran acciones enteras** (redondeo hacia
abajo) y el cash sobrante espera al siguiente trade.

### 2.8 Flujo del cron (semanal)

**Frecuencia**: lunes 22:00 CET (mismo slot que Value, o día distinto para no
saturar Yahoo). Ejecución:

```
1. Registrar aporte DCA si es inicio de mes (100 € → contributions + cash)
2. Para cada posición abierta:
   a. Fetch histórico 1y (/v8/finance/chart?interval=1d&range=1y)
   b. Calcular ATR, EMA20/50, RSI, MACD, Stochastic
   c. Evaluar reglas de salida (SL, TP, trailing, tiempo, cruces)
   d. Si señal de salida → POST /api/trade {side: "sell", strategy_id: "trader"}
3. Para cada ticker del universo (20):
   a. Fetch histórico 1y
   b. Calcular los 10 indicadores
   c. Scoring de señales (gate EMA200 + ≥5 puntos)
   d. Si BUY signal Y <3 posiciones abiertas Y cash suficiente →
      POST /api/trade {side: "buy", strategy_id: "trader",
                       stop_loss_eur, take_profit_eur, entry_signal}
4. POST /api/snapshot (registrar mark-to-market)
5. Guardar resumen en reports (type: "weekly")
```

**Intensidad de API**: 20 tickers × 1 fetch histórico = 20 llamadas a Yahoo por
run. Aceptable (rate limit de Yahoo es ~2000/h sin crumb para `/chart/v8`). Se
puede cachear en `market_snapshots` si se quiere.

---

## 3. Estrategia 2 — Paco Funds (ETF pasivos)

### 3.1 Filosofía

Cartera **"lazy" pasiva de bajo coste**, estilo Bogleheads. No intenta timing ni
stock-picking. Expuesta a mercados globales vía 4-6 ETFs UCITS baratos (TER <
0.25%). Rebalanceo por **bandas de tolerancia** (desviación >5%) o trimestral lo
que ocurra primero. DCA mensual estricto de 100 €. Comisión de gestión simulada
de 0.22% anual (TER medio de la cartera) descontada diariamente del NAV.

### 3.2 Asset allocation recomendada

Portfolio **moderado-agresivo** (perfil del proyecto: horizonte largo, tolerancia
alta, capital simulado). Basado en carteras "Three-Fund" + oro como estabilizador.

| Clase de activo                | ETF              | Peso objetivo | Justificación                          |
|--------------------------------|------------------|---------------|----------------------------------------|
| Acciones desarrolladas (DM)    | MSCI World       | **50%**       | Núcleo de la cartera, exposición global developed |
| Acciones emergentes (EM)       | MSCI EM          | **15%**       | Crecimiento superior, diversificación geográfica |
| Bonos globales aggregados      | Global Aggregate | **20%**      | Estabilizador, correlación baja con acciones |
| Oro                            | ETC oro físico   | **10%**       | Cobertura en crisis, anti-inflacionaria |
| Bonos high yield / corporate   | Euro Corp        | **5%**        | Extra yield, diversificador dentro de renta fija |

**Alternativa simplificada (si se quieren solo 3 ETFs)**: 70% MSCI World /
ACWI, 20% Global Aggregate Bonds, 10% Oro. Más fácil de rebalancear con poco
capital, pero menos granularidad.

### 3.3 ETFs concretos (UCITS, cotizando en EUR)

> ⚠️ **TODOS los tickers verificados contra Yahoo Finance en vivo (2026-07-30)**.
> La cobertura de Yahoo para ETFs europeos es irregular: muchos ETFs populares
> (VWCE.DE, EIMI.DE, VAGD.DE, SGLN.DE) devuelven *"No data found, symbol may be
> delisted"* aunque existan en Xetra. **Los tickers de abajo son los que SÍ
> responden** en Yahoo con `currency=EUR`. Antes de cada run del cron,
> re-verificar con el script del [Apéndice A](#apéndice-a--verificación-de-tickers-ejecutar-antes-del-primer-run).

Todos **UCITS/ETC**, domiciliados en Irlanda/Alemania, cotizando en EUR en Xetra
o Euronext Amsterdam. ISIN y TER verificados. Ticker Yahoo Finance **confirmado
vivo**.

| # | Clase de activo     | ETF                                        | ISIN          | TER    | Ticker Yahoo | Mercado | Precio aprox |
|---|---------------------|--------------------------------------------|---------------|--------|--------------|---------|-------------|
| 1 | Acciones DM         | **iShares Core MSCI World UCITS (Acc)**   | IE00B4L5Y983  | 0.20%  | `EUNL.DE`    | Xetra   | ~124 €      |
| 2 | Acciones EM         | **Vanguard FTSE Emerging Markets (Acc)**  | IE00BK5QRX14  | 0.22%  | `VFEA.DE`    | Xetra   | ~74 €       |
| 3 | Bonos Euro gobierno | **Xtrackers Eurozone Government Bond**     | LU0908508814  | 0.20%  | `DBXN.DE`    | Xetra   | ~213 €      |
| 4 | Oro físico (ETC)    | **Invesco Physical Gold ETC**              | IE00B579F325  | 0.12%  | `8PSG.DE`    | Xetra   | ~339 €      |
| 5 | Bonos Euro Corp     | **iShares Core € Corp Bond UCITS (Dist)**  | IE00B3F81R35  | 0.20%  | `IEAC.AS`    | Euronext| ~117 €      |

**Notas de selección (importantes — por qué estos y no los obvios)**:

- **EUNL.DE** (iShares Core MSCI World, Acc) en vez de VWCE.DE: VWCE.DE es más
  barato (TER 0.12% vs 0.20%) **pero Yahoo no lo lista**. EUNL.DE es el
  equivalente de iShares, MSCI World con ~1500 acciones developed, acumulación.
  Mismo universo que VWCE (FTSE Developed). ISIN IE00B4L5Y983. ✅ verificado vivo.
- **VFEA.DE** (Vanguard FTSE Emerging Markets, Acc) en vez de EIMI.DE: EIMI.DE
  no responde en Yahoo. VFEA.DE sí — Vanguard EM, ~1900 acciones emergentes,
  acumulación, TER 0.22%. ISIN IE00BK5QRX14. ✅ verificado vivo.
- **DBXN.DE** (Xtrackers Eurozone Government Bond) en vez de VAGD.DE (Vanguard
  Global Agg hedged, que no responde): DBXN es bonos soberanos Eurozona (DE/FR/
  IT/ES) en EUR nativo — sin riesgo divisa por construcción. TER 0.20%. ISIN
  LU0908508814. ✅ verificado. Alternativa global: `XG7S.DE` (Xtrackers Global
  Government Bond, EUR, ~219 €) también funciona.
- **8PSG.DE** (Invesco Physical Gold ETC): oro físico alodial custodiado, ISIN
  IE00B579F325, TER 0.12%. ✅ verificado vivo. Alternativa válida y más barata
  por acción: `XGDU.DE` (Xtrackers Physical Gold, EUR, ~54 €, ISIN IE00B4ND3602)
  también responde en Yahoo — útil si se quiere fraccionar más fácil.
- **IEAC.AS** (iShares Core € Corp Bond, Dist): bonos corporativos Euro
  investment grade en EUR nativo. Yahoo lo lista en Euronext Amsterdam (`IEAC.AS`)
  — **NO** en Xetra (`IEAC.DE` no responde). TER 0.20%. ISIN IE00B3F81R35.
  ✅ verificado vivo.

**Aporte por ETF (proporcional al peso objetivo)**:

| ETF       | Peso | De 100 €/mes | Precio aprox | Acciones/mes (fracciones) |
|-----------|------|--------------|--------------|---------------------------|
| EUNL.DE   | 50%  | 50 €         | ~124 €       | 0.40                      |
| VFEA.DE   | 15%  | 15 €         | ~74 €        | 0.20                      |
| DBXN.DE   | 20%  | 20 €         | ~213 €       | 0.09                      |
| 8PSG.DE   | 10%  | 10 €         | ~339 €       | 0.03                      |
| IEAC.AS   | 5%   | 5 €          | ~117 €       | 0.04                      |

> Con acciones enteras, 100 €/mes no compra ni 1 acción de DBXN (213 €) ni de
> 8PSG (339 €). **La simulación DEBE usar fracciones** (el schema `shares REAL`
> lo permite) o acumular cash hasta alcanzar el precio. Ver [§3.6](#36-dca-mensual-de-100-).

### 3.4 Reglas de rebalanceo

**Doble trigger** (lo que ocurra primero):

1. **Banda de tolerancia (drift)**: si el peso real de cualquier ETF se desvía
   **>5 puntos porcentuales** (absolutos) de su objetivo, rebalancear ese ETF de
   vuelta al objetivo. Ej: VWCE objetivo 50%, si sube a 56% → vender el exceso.
2. **Rebalanceo programado trimestral**: en enero, abril, julio, octubre (primer
   lunes hábil), revisar toda la cartera y llevar todos los pesos al objetivo,
   **independientemente del drift** (captura el reordenamiento natural).

**Método de rebalanceo**:
- Calcular peso actual de cada ETF = (valor mercado ETF) / (total cartera).
- Para cada ETF, diferencia = peso_actual − peso_objetivo.
- Si |diferencia| > 5% (trigger 1) **o** es fecha trimestral (trigger 2):
  - Vender/comprar lo necesario para llevar peso a objetivo.
  - Ejecutar ventas primero (liberar cash), luego compras con el cash liberado +
    el aporte DCA.

**Frecuencia de comprobación**: el cron del Funds corre **mensual** (coincidiendo
con el aporte DCA, día 1 del mes). El rebalanceo trimestral se evalúa dentro del
mismo run mensual si toca.

### 3.5 Comisión de gestión simulada (TER)

La fila `strategies` de `funds` ya tiene `ter_annual = 0.0022` (0.22%, TER medio
ponderado de la cartera). Para que la simulación sea realista:

**Cálculo del TER diario**:
```
TER diario = TER_anual / 365 = 0.0022 / 365 = 0.000006027  (≈ 0.0006%)
Coste diario = NAV_total × TER_diario
```

**Aplicación**: en cada snapshot (diario o cuando corra el cron), descontar el
coste TER del `total_eur` de la estrategia funds. Dos opciones de implementación:

- **Opción A (simple, recomendada para cron mensual)**: al hacer el snapshot
  mensual, calcular los días transcurridos desde el último snapshot y restar
  `NAV_medio × TER_diario × días` al cash de la estrategia. Registrar como un
  trade "fee" o como ajuste en `contributions`/`notes`.
- **Opción B (precisa)**: crear una tabla `strategy_fees(strategy_id, date,
  amount_eur, ter_applied)` y descontar en cada snapshot. Más exacta pero más
  compleja.

**TER medio de la cartera** (ponderado):
```
EUNL  0.20% × 0.50 = 0.100%
VFEA  0.22% × 0.15 = 0.033%
DBXN  0.20% × 0.20 = 0.040%
8PSG  0.12% × 0.10 = 0.012%
IEAC  0.20% × 0.05 = 0.010%
────────────────────────────────
TOTAL TER medio             = 0.195%
```

> El `ter_annual = 0.0022` (0.22%) sembrado en el schema es **conservador**
> respecto al TER teórico de 0.195%. La diferencia (0.025%) cubre tracking error
> + costes de trading del rebalanceo + spread bid-ask. **Decisión**: mantener
> 0.22% para que la simulación penalice la estrategia de forma realista (en la
> vida real hay más costes ocultos que el TER puro).

### 3.6 DCA mensual de 100 €

**Mecánica** (día 1 de cada mes, o primer día hábil):

1. Registrar aporte: `INSERT INTO contributions (strategy_id='funds', date,
   amount_eur=100)`. Verificar `UNIQUE` constraint (no duplicar).
2. Sumar 100 € al cash disponible de la estrategia.
3. **Repartir el aporte según los pesos objetivo**, PERO con fraccionamiento:
   - Si los ETFs permiten fracciones (el schema `shares` es REAL): comprar
     exactamente 50 € de VWCE, 15 € de EIMI, 20 € de VAGD, 10 € de 8PSG, 5 € de
     IEAC. Cada compra = `shares = importe / precio_eur`.
   - Si se simula broker de acciones enteras: acumular cash hasta tener suficiente
     para 1 acción del ETF más caro, y entonces comprar redondeando hacia abajo.
     El sobrante queda como cash para el mes siguiente.
4. **Revisar rebalanceo** (ver §3.4) tras el aporte, ya que el aporte altera pesos.

**Workaround realista para acciones enteras con 100 €/mes**:
Los ETFs cotizan a precios altos (VWCE ~120 €, IEAC ~150 €). Con 100 €/mes no se
compra ni 1 acción de IEAC. **Solución**: el aporte mensual de 100 € se reparte
proporcionalmente acumulando en cash por ETF (llevando un contador de "cash
asignado a VWCE", "cash asignado a EIMI", etc.) y solo se compra cuando hay
suficiente para 1 acción entera de ese ETF. Esto simula el comportamiento de un
inversor real sin broker de fracciones.

Alternativamente, **asumir broker con fracciones** (más simple para la
simulación, y cada vez más común en Europa: Trade Republic, Scalable Capital
ofrecen fracciones). El schema lo permite (`shares REAL`). **Recomendación: usar
fracciones** para que el DCA sea limpio y comparable con Value/Trader.

### 3.7 Flujo del cron (mensual)

**Frecuencia**: día 1 de cada mes (o primer hábil). Ejecución:

```
1. Registrar aporte DCA: 100 € → contributions + cash
2. Comprar ETFs según peso objetivo (fracciones):
   for each ETF in portfolio:
     importe = 100 € × peso_objetivo[ETF]
     precio = GET /api/quote?ticker=VWCE.DE  (verificar currency=EUR)
     shares = importe / precio_eur
     POST /api/trade {side: "buy", strategy_id: "funds", shares, ticker}
3. Descontar TER del periodo:
     días = hoy − último_snapshot
     fee = NAV × (TER_anual / 365) × días
     registrar fee (ajuste cash)
4. Evaluar rebalanceo:
     if mes ∈ {ene,abr,jul,oct} OR |drift[ETF]| > 5% for any ETF:
       calcular ventas/compras para volver a pesos objetivo
       ejecutar trades
5. POST /api/snapshot (mark-to-market + benchmark)
6. Guardar resumen en reports (type: "monthly")
```

**Intensidad de API**: 5 ETFs × (1 quote + N trades) = ~10 llamadas/run. Muy
ligero.

---

## 4. Mapeo a la infraestructura existente

### 4.1 Lo que ya existe y se reutiliza

| Componente            | Estado | Notas |
|-----------------------|--------|-------|
| `strategies` table    | ✅ Sembrada | `trader` y `funds` ya tienen filas con monthly_contribution=100 |
| `strategy_id` en positions/trades/valuations | ✅ | Migración ya aplicada |
| `contributions` table | ✅ | Lista para registrar aportes DCA |
| `positions.stop_loss_eur`, `.take_profit_eur`, `.entry_signal`, `.trade_plan` | ✅ | Columnas para el Trader ya añadidas |
| `trades.exit_reason`  | ✅ | Para registrar por qué se cerró un trade |
| `/api/trade`          | ⚠️ | **No pasa `strategy_id`** → siempre asigna a `value` por defecto. **Necesita modificación** |
| `/api/quote`          | ✅ | Funciona para ETFs y acciones EUR |
| `/api/snapshot`       | ⚠️ | Snapshot global, no por estrategia. `saveValuation` no filtra por strategy_id |
| Yahoo `/v8/finance/chart` histórico | ✅ | Disponible sin crumb para OHLCV diario |

### 4.2 Cambios necesarios en el código

**Cambio 1 — `/api/trade` debe aceptar `strategy_id`** (CRÍTICO)

En `src/routes/api/trade/+server.ts` y `src/lib/server/portfolio.ts`, añadir
`strategy_id` al body y pasarlo al INSERT de positions/trades. Default `'value'`
para retrocompatibilidad.

```typescript
// portfolio.ts — TradeInput
export interface TradeInput {
  // ... campos existentes ...
  strategy_id?: string;  // default 'value'
  stop_loss_eur?: number;     // para trader
  take_profit_eur?: number;   // para trader
  entry_signal?: string;      // descripción de la señal técnica
  exit_reason?: string;       // 'stop_loss' | 'take_profit' | 'trailing' | 'time' | 'signal'
}

// En executeTrade, los INSERT de positions y trades deben incluir strategy_id
```

**Cambio 2 — `saveValuation` debe soportar multi-strategy** (para que cada
estrategia tenga su propia equity curve)

`valuation.ts` actualmente calcula un snapshot global. Necesita una variante que
filtre por `strategy_id`:

```typescript
export async function saveValuation(strategyId?: string): Promise<Valuation> {
  // si strategyId, filtrar positions/trades WHERE strategy_id = ?
  // y usar initial_capital / monthly_contribution de la fila strategies
}
```

Y el cálculo de cash debe incorporar las `contributions` acumuladas:

```typescript
const contributions = db.prepare(
  `SELECT COALESCE(SUM(amount_eur),0) as total FROM contributions WHERE strategy_id = ?`
).get(strategyId).total;
const cash_eur = initial_capital + contributions + sells - buys;
```

**Cambio 3 — Cash por estrategia**

El cash actual se deriva de `settings.initial_capital` global. Para
multi-strategy, cada estrategia necesita su propio cash. Opciones:
- **(A)** Calcular cash dinámicamente desde `strategies.initial_capital_eur` +
  `SUM(contributions)` + ventas − compras (sin settings). Más limpio.
- **(B)** Añadir `cash_balance_eur` a `strategies` y actualizar en cada trade.

Recomendado **(A)**: el cash es derivado, no almacenado.

**Cambio 4 — Snapshot multi-strategy en el cron**

El cron debe llamar a `saveValuation('trader')`, `saveValuation('funds')` y
`saveValuation('value')` por separado, o un endpoint `/api/snapshot?strategy=all`
que itere. Cada uno inserta una fila en `valuations` con su `strategy_id`.

### 4.3 Cron jobs (Hermes)

| Estrategia  | Job ID (sugerido) | Frecuencia                | Hora CET |
|-------------|-------------------|---------------------------|----------|
| Paco Value  | (existente)       | Semanal (lunes)           | 22:00    |
| Paco Trader | `trader-weekly`   | Semanal (lunes o jueves)  | 22:30    |
| Paco Funds  | `funds-monthly`   | Mensual (día 1)           | 22:00    |

Cada cron job es un prompt de Hermes que ejecuta el flujo descrito en §2.8 / §3.7
y opera contra producción (`https://pacoinvestor.billytech.es`).

---

## 5. Prompt de cron — resumen ejecutivo

### Paco Trader (semanal)

```
Eres Paco Trader, un swing trader técnico sistemático. Estrategia: strategy_id="trader".

Cada lunes a las 22:30 CET:
1. DCA: si es inicio de mes, registrar 100 € (contributions + cash).
2. Gestionar posiciones abiertas (strategy_id="trader"): para cada una, fetch
   histórico 1y (Yahoo /v8/finance/chart), calcular ATR/EMA20/50/200/RSI/MACD/
   Stochastic, evaluar salidas (SL=2×ATR, TP=3×ATR, trailing, tiempo>30d,
   EMA20<EMA50). Vender las que disparen salida vía POST /api/trade
   {side:"sell", strategy_id:"trader", exit_reason}.
3. Escanear universo de 20 tickers EUR (SAP.DE, SIE.DE, ... ver §2.2). Para cada
   uno: calcular 10 indicadores, aplicar checklist de 8 puntos (gate precio>EMA200
   + ≥5 puntos). Si BUY signal, max 3 posiciones, cash suficiente → comprar
   (shares según sizing 2% equity, redondeo a entero), guardar stop_loss_eur y
   take_profit_eur.
4. POST /api/snapshot para mark-to-market.
5. Guardar weekly report.

Todo en EUR nativo. UTF-8 con --data-binary. Benchmark: S&P 500 EUR.
```

### Paco Funds (mensual)

```
Eres Paco Funds, un gestor pasivo de ETFs (lazy portfolio). strategy_id="funds".

Cada día 1 de mes a las 22:00 CET:
1. Registrar aporte DCA 100 € (contributions + cash).
2. Comprar ETFs según peso objetivo (fracciones):
   EUNL.DE 50% | VFEA.DE 15% | DBXN.DE 20% | 8PSG.DE 10% | IEAC.AS 5%
   shares = (100 × peso) / precio_eur. Verificar currency=EUR en cada quote.
3. Descontar TER: fee = NAV × (0.22%/365) × días_desde_último_snapshot.
4. Rebalancear si mes ∈ {ene,abr,jul,oct} OR drift >5% en algún ETF.
5. POST /api/snapshot para mark-to-market + benchmark S&P 500 EUR.
6. Guardar monthly report.

UCITS, EUR nativo, todo Xetra. UTF-8 con --data-binary.
```

---

## Apéndice A — Verificación de tickers (ejecutar antes del primer run)

Antes de arrancar cualquier cron, verificar que cada ticker responde y cotiza en
EUR. Script de sanity check:

```bash
# ETFs (los que realmente responden en Yahoo con currency=EUR)
for t in EUNL.DE VFEA.DE DBXN.DE 8PSG.DE IEAC.AS XGDU.DE XG7S.DE; do
  curl -sS --max-time 8 "https://query1.finance.yahoo.com/v8/finance/chart/$t?interval=1d&range=5d" \
    -H 'User-Agent: Mozilla/5.0' \
    | python -c "import json,sys; d=json.load(sys.stdin); m=d['chart']['result'][0]['meta']; \
      print(f'{m[\"symbol\"]:10} {m[\"currency\"]:5} {m.get(\"regularMarketPrice\",0):>10.2f} {m.get(\"exchangeName\",\"\")}')" \
    || echo "$t FAILED"
  sleep 0.5
done

# Acciones del universo Trader
for t in SAP.DE SIE.DE ALV.DE BMW.DE MBG.DE BAS.DE DTE.DE VOW3.DE IFX.DE DHL.DE \
       OR.PA MC.PA TTE.PA AI.PA RMS.PA SAN.PA ENGI.PA ITX.MC SAN.MC BBVA.MC; do
  curl -sS --max-time 8 "https://query1.finance.yahoo.com/v8/finance/chart/$t?interval=1d&range=5d" \
    -H 'User-Agent: Mozilla/5.0' \
    | python -c "import json,sys; d=json.load(sys.stdin); m=d['chart']['result'][0]['meta']; \
      print(f'{m[\"symbol\"]:10} {m[\"currency\"]:5} {m.get(\"regularMarketPrice\",0):>10.2f} {m.get(\"exchangeName\",\"\")}')" \
    || echo "$t FAILED"
  sleep 0.3
done
```

Cualquier ticker que devuelva `currency != "EUR"` o falle → excluir del universo
y buscar sustituto.

## Apéndice B — Implementación de ADX y Stochastic (referencia)

```python
def stochastic_high_low(close, high, low, k_period=14, d_period=3):
    """Stochastic Oscillator (%K y %D)."""
    lows = low.rolling(k_period).min()
    highs = high.rolling(k_period).max()
    k = 100 * (close - lows) / (highs - lows)
    d = k.rolling(d_period).mean()
    return k, d

def adx(high, low, close, period=14):
    """Average Directional Index."""
    plus_dm = high.diff()
    minus_dm = -low.diff()
    plus_dm[plus_dm < 0] = 0
    minus_dm[minus_dm < 0] = 0
    plus_dm[plus_dm < minus_dm] = 0
    minus_dm[minus_dm < plus_dm] = 0
    tr = pd.concat([high - low, (high - close.shift()).abs(),
                    (low - close.shift()).abs()], axis=1).max(axis=1)
    atr = tr.ewm(alpha=1/period, adjust=False).mean()
    plus_di = 100 * (plus_dm.ewm(alpha=1/period, adjust=False).mean() / atr)
    minus_di = 100 * (minus_dm.ewm(alpha=1/period, adjust=False).mean() / atr)
    dx = 100 * (plus_di - minus_di).abs() / (plus_di + minus_di)
    return dx.ewm(alpha=1/period, adjust=False).mean()
```

---

*Fin del documento. Próximos pasos: (1) aplicar cambios §4.2 en el código,
(2) ejecutar sanity check del Apéndice A, (3) crear los dos cron jobs en Hermes
con los prompts de §5.*
