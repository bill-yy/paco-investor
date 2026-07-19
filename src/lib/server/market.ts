// Market data: indices, commodities, sectors, FX
import { getQuote } from './yahoo';

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
		.filter(Boolean) as Array<{
		ticker: string;
		name: string;
		category: string;
		price: number;
		currency: string;
		change_pct: number;
		previous_close: number;
	}>;
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
	return results.map((r) => (r.status === 'fulfilled' ? r.value : null)).filter(Boolean);
}
