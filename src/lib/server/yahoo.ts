// Yahoo Finance API client
// Uses cookie + crumb auth (required since 2023)

import { YAHOO_BASE, YAHOO_BASE_2 } from './config';
import path from 'node:path';
import fs from 'node:fs';

const COOKIE_PATH = path.join(process.cwd(), '.yahoo-cookies.txt');

interface QuoteResult {
	price: number;
	previousClose: number;
	currency: string;
	exchange: string;
	change: number;
	changePercent: number;
}

interface QuoteDetails {
	regularMarketPrice: number;
	previousClose: number;
	currency: string;
	exchangeName: string;
	marketCap?: number;
	fiftyTwoWeekHigh?: number;
	fiftyTwoWeekLow?: number;
}

interface Fundamentals {
	peRatio?: number;
	forwardPe?: number;
	pegRatio?: number;
	eps?: number;
	dividendYield?: number;
	payoutRatio?: number;
	beta?: number;
	evToEbitda?: number;
	evToRevenue?: number;
	profitMargins?: number;
	returnOnEquity?: number;
	returnOnAssets?: number;
	revenueGrowth?: number;
	earningsGrowth?: number;
	debtToEquity?: number;
	currentRatio?: number;
	quickRatio?: number;
	totalCash?: number;
	totalDebt?: number;
	totalRevenue?: number;
	grossMargins?: number;
	operatingMargins?: number;
	revenuePerShare?: number;
	targetMeanPrice?: number;
	targetHighPrice?: number;
	targetLowPrice?: number;
	targetMedianPrice?: number;
}

async function fetchWithUA(url: string, opts: RequestInit = {}, cookie?: string): Promise<Response> {
	const headers: Record<string, string> = {
		'User-Agent':
			'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
		Accept: 'application/json,text/html,*/*',
		'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8'
	};
	if (cookie) headers.Cookie = cookie;
	return fetch(url, { ...opts, headers });
}

let cachedCookie: string | null = null;
let cachedCrumb: string | null = null;
let cacheExpiry = 0;

async function getCookieAndCrumb(): Promise<{ cookie: string; crumb: string }> {
	const now = Date.now();
	if (cachedCookie && cachedCrumb && now < cacheExpiry) {
		return { cookie: cachedCookie!, crumb: cachedCrumb! };
	}

	// Persist cookies to disk for reuse across restarts
	if (fs.existsSync(COOKIE_PATH)) {
		const saved = fs.readFileSync(COOKIE_PATH, 'utf8').trim();
		if (saved.includes('|')) {
			const [c, cr] = saved.split('|');
			cachedCookie = c;
			cachedCrumb = cr;
		}
	}

	// Step 1: get cookie from fc.yahoo.com
	const r1 = await fetchWithUA('https://fc.yahoo.com/', { redirect: 'manual' });
	const setCookie = r1.headers.get('set-cookie') || '';
	let cookie = '';
	for (const line of setCookie.split(',')) {
		const m = line.match(/([^=]+=[^;]+)/);
		if (m && (m[1].startsWith('A1=') || m[1].startsWith('A3=') || m[1].startsWith('GUC='))) {
			cookie = cookie ? `${cookie}; ${m[1]}` : m[1];
		}
	}
	if (!cookie && cachedCookie) cookie = cachedCookie;
	if (!cookie) throw new Error('Could not get Yahoo cookie');

	// Step 2: get crumb
	const r2 = await fetchWithUA(`${YAHOO_BASE}/v1/test/getcrumb`, {}, cookie);
	const crumb = (await r2.text()).trim();
	if (!crumb || crumb.length < 4) throw new Error('Could not get Yahoo crumb');

	cachedCookie = cookie;
	cachedCrumb = crumb;
	cacheExpiry = now + 1000 * 60 * 30; // 30 min

	fs.writeFileSync(COOKIE_PATH, `${cookie}|${crumb}`);

	return { cookie, crumb };
}

export async function getQuote(ticker: string): Promise<QuoteResult> {
	const url = `${YAHOO_BASE}/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=5d`;
	const r = await fetchWithUA(url);
	if (!r.ok) throw new Error(`getQuote ${ticker}: HTTP ${r.status}`);
	const data = await r.json();
	const meta = data?.chart?.result?.[0]?.meta;
	if (!meta) throw new Error(`getQuote ${ticker}: no meta`);
	return {
		price: meta.regularMarketPrice,
		previousClose: meta.chartPreviousClose ?? meta.previousClose,
		currency: meta.currency,
		exchange: meta.exchangeName,
		change: (meta.regularMarketPrice ?? 0) - (meta.chartPreviousClose ?? 0),
		changePercent: meta.regularMarketPrice && meta.chartPreviousClose
			? (meta.regularMarketPrice - meta.chartPreviousClose) / meta.chartPreviousClose
			: 0
	};
}

export async function getQuoteDetails(ticker: string): Promise<QuoteDetails & Fundamentals> {
	const { cookie, crumb } = await getCookieAndCrumb();
	const modules = [
		'summaryDetail',
		'financialData',
		'defaultKeyStatistics',
		'price',
		'financialsTemplate'
	].join(',');
	const url = `${YAHOO_BASE_2}/v10/finance/quoteSummary/${encodeURIComponent(
		ticker
	)}?modules=${modules}&crumb=${encodeURIComponent(crumb)}`;
	const r = await fetchWithUA(url, {}, cookie);
	if (!r.ok) throw new Error(`getQuoteDetails ${ticker}: HTTP ${r.status}`);
	const data = await r.json();
	const result = data?.quoteSummary?.result?.[0];
	if (!result) throw new Error(`getQuoteDetails ${ticker}: no result`);

	const sd = result.summaryDetail || {};
	const fd = result.financialData || {};
	const ks = result.defaultKeyStatistics || {};
	const pr = result.price || {};

	const num = (v: any): number | undefined =>
		v && typeof v === 'object' && 'raw' in v ? v.raw : undefined;

	return {
		regularMarketPrice: num(pr.regularMarketPrice) ?? 0,
		previousClose: num(sd.previousClose) ?? num(pr.regularMarketPreviousClose) ?? 0,
		currency: pr.currency || sd.currency,
		exchangeName: pr.exchangeName,
		marketCap: num(sd.marketCap) ?? num(pr.marketCap),
		fiftyTwoWeekHigh: num(sd.fiftyTwoWeekHigh),
		fiftyTwoWeekLow: num(sd.fiftyTwoWeekLow),
		peRatio: num(sd.trailingPE),
		forwardPe: num(sd.forwardPE),
		pegRatio: num(sd.pegRatio),
		eps: num(sd.trailingEps) ?? num(ks.trailingEps),
		dividendYield: num(sd.dividendYield),
		payoutRatio: num(sd.payoutRatio),
		beta: num(sd.beta) ?? num(ks.beta),
		evToEbitda: num(sd.enterpriseToEbitda) ?? num(ks.enterpriseToEbitda),
		evToRevenue: num(sd.enterpriseToRevenue) ?? num(ks.enterpriseToRevenue),
		profitMargins: num(fd.profitMargins),
		returnOnEquity: num(fd.returnOnEquity),
		returnOnAssets: num(fd.returnOnAssets),
		revenueGrowth: num(fd.revenueGrowth),
		earningsGrowth: num(fd.earningsGrowth),
		debtToEquity: num(fd.debtToEquity) ?? num(ks.debtToEquity),
		currentRatio: num(fd.currentRatio),
		quickRatio: num(fd.quickRatio),
		totalCash: num(fd.totalCash),
		totalDebt: num(fd.totalDebt),
		totalRevenue: num(fd.totalRevenue),
		grossMargins: num(fd.grossMargins),
		operatingMargins: num(fd.operatingMargins),
		revenuePerShare: num(fd.revenuePerShare),
		targetMeanPrice: num(fd.targetMeanPrice),
		targetHighPrice: num(fd.targetHighPrice),
		targetLowPrice: num(fd.targetLowPrice),
		targetMedianPrice: num(fd.targetMedianPrice)
	};
}

export async function getFxRate(pair: string): Promise<number> {
	// pair like 'USDEUR'
	const t = `${pair}=X`;
	const q = await getQuote(t);
	return q.price;
}
