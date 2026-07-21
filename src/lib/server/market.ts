// Market data: indices, commodities, sectors, FX
import { getQuote } from './yahoo';

// Type guard to narrow (T | null)[] → T[] after Promise.allSettled / fallbacks.
function isPresent<T>(v: T | null | undefined): v is T {
	return v != null;
}

export const MARKET_TICKERS = {
	indices: [
		{ ticker: '^GSPC', name: 'S&P 500', category: 'Índices' },
		{ ticker: '^DJI', name: 'Dow Jones', category: 'Índices' },
		{ ticker: '^IXIC', name: 'Nasdaq', category: 'Índices' },
		{ ticker: '^RUT', name: 'Russell 2000', category: 'Índices' },
		{ ticker: '^STOXX', name: 'Euro Stoxx 50', category: 'Índices' },
		{ ticker: '^GDAXI', name: 'DAX', category: 'Índices' },
		{ ticker: '^IBEX', name: 'IBEX 35', category: 'Índices' },
		{ ticker: '^N225', name: 'Nikkei 225', category: 'Índices' },
		{ ticker: '^HSI', name: 'Hang Seng', category: 'Índices' },
		{ ticker: '^VIX', name: 'VIX', category: 'Volatilidad' }
	],
	commodities: [
		{ ticker: 'GC=F', name: 'Oro', category: 'Commodities' },
		{ ticker: 'SI=F', name: 'Plata', category: 'Commodities' },
		{ ticker: 'CL=F', name: 'Petróleo WTI', category: 'Commodities' },
		{ ticker: 'BZ=F', name: 'Brent', category: 'Commodities' },
		{ ticker: 'NG=F', name: 'Gas Natural', category: 'Commodities' },
		{ ticker: 'HG=F', name: 'Cobre', category: 'Commodities' }
	],
	rates_fx: [
		{ ticker: 'USDEUR=X', name: 'USD/EUR', category: 'Divisas' },
		{ ticker: 'GBPEUR=X', name: 'GBP/EUR', category: 'Divisas' },
		{ ticker: 'JPYEUR=X', name: 'JPYEUR', category: 'Divisas' },
		{ ticker: '^TNX', name: 'US 10Y', category: 'Tipos' },
		{ ticker: '^IRX', name: 'US 13W', category: 'Tipos' },
		{ ticker: 'BTC-USD', name: 'Bitcoin', category: 'Cripto' },
		{ ticker: 'ETH-USD', name: 'Ethereum', category: 'Cripto' }
	]
};

export async function getMarketOverview() {
	const all = [...MARKET_TICKERS.indices, ...MARKET_TICKERS.commodities, ...MARKET_TICKERS.rates_fx];
	const results = await Promise.allSettled(
		all.map(async (item) => {
			try {
				const q = await getQuote(item.ticker);
				return {
					...item,
					price: q.price,
					currency: q.currency,
					change_pct: q.changePercent,
					previous_close: q.previousClose
				};
			} catch (e: any) {
				return { ...item, price: 0, currency: '', change_pct: 0, previous_close: 0, error: e.message };
			}
		})
	);
	return results
		.map((r) => (r.status === 'fulfilled' ? r.value : null))
		.filter(isPresent);
}

// S&P sector ETFs for sector rotation analysis
export const SECTOR_ETFS = [
	{ ticker: 'XLK', name: 'Tecnología' },
	{ ticker: 'XLF', name: 'Finanzas' },
	{ ticker: 'XLV', name: 'Salud' },
	{ ticker: 'XLY', name: 'Consumo discrecional' },
	{ ticker: 'XLP', name: 'Consumo básico' },
	{ ticker: 'XLE', name: 'Energía' },
	{ ticker: 'XLI', name: 'Industriales' },
	{ ticker: 'XLU', name: 'Utilities' },
	{ ticker: 'XLB', name: 'Materiales' },
	{ ticker: 'XLRE', name: 'Inmobiliario' },
	{ ticker: 'XLC', name: 'Comunicaciones' }
];

export async function getSectorPerformance() {
	const results = await Promise.allSettled(
		SECTOR_ETFS.map(async (s) => {
			try {
				const q = await getQuote(s.ticker);
				return { ...s, change_pct: q.changePercent, price: q.price };
			} catch {
				return { ...s, change_pct: 0, price: 0 };
			}
		})
	);
	return results.map((r) => (r.status === 'fulfilled' ? r.value : null)).filter(isPresent);
}

export interface MacroContext {
	/** US 10-year Treasury yield, percent. */
	us_10y: number | null;
	/** US 13-week (3-month) Treasury bill yield, percent. */
	us_13w: number | null;
	/** Price of the eurozone sovereign bond ETF (XGLE.DE, EUR) — proxy for the Bund.
	 *  Yahoo delisted the ^GT*10Y yield indices, so we track the ETF price instead.
	 *  Price rises when yields fall (and vice versa), so the direction is inverted
	 *  vs the yield, but the level still reflects eurozone risk-free conditions. */
	bund_10y: number | null;
	/** VIX index level. */
	vix: number | null;
	/** 2s10s-like slope: US 10Y minus US 13W. Positive = normal curve, negative = inverted. */
	curve_slope: number | null;
	/** Qualitative rate regime derived from US_13W. */
	regime: 'restrictive' | 'neutral' | 'expansive' | 'unknown';
}

// Yahoo tickers for macro indicators. ^TNX / ^IRX are US yields (in percent),
// ^VIX is the volatility index. Yahoo delisted the European sovereign yield
// indices (^GTDEM10Y, ^GDBR10Y, etc. all return 404), so the eurozone risk-free
// proxy uses XGLE.DE — the Xtrackers Eurozone Government Bond UCITS ETF (EUR).
const MACRO_TICKERS = {
	us_10y: '^TNX',
	us_13w: '^IRX',
	bund_10y: 'XGLE.DE',
	vix: '^VIX'
};

/**
 * Live macro context derived from yields and VIX. Yahoo doesn't expose central
 * bank policy rates directly, so we use market yields which are what actually
 * drive discount rates for value investing. The curve slope (10Y - 13W) is a
 * classic recession signal: negative = inverted = elevated recession risk.
 */
export async function getMacroContext(): Promise<MacroContext> {
	const fetchRate = async (ticker: string): Promise<number | null> => {
		try {
			const q = await getQuote(ticker);
			return q.price;
		} catch {
			return null;
		}
	};

	const [us10y, us13w, bund10y, vix] = await Promise.all([
		fetchRate(MACRO_TICKERS.us_10y),
		fetchRate(MACRO_TICKERS.us_13w),
		fetchRate(MACRO_TICKERS.bund_10y),
		fetchRate(MACRO_TICKERS.vix)
	]);

	const curve_slope = us10y != null && us13w != null ? us10y - us13w : null;

	let regime: MacroContext['regime'] = 'unknown';
	if (us13w != null) {
		if (us13w >= 3) regime = 'restrictive';
		else if (us13w >= 1.5) regime = 'neutral';
		else regime = 'expansive';
	}

	return { us_10y: us10y, us_13w: us13w, bund_10y: bund10y, vix, curve_slope, regime };
}
