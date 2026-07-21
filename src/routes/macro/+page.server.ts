import type { PageServerLoad } from './$types';
import { getMacroContext } from '$lib/server/market';

export const load: PageServerLoad = async () => {
	// Best-effort: a Yahoo failure degrades to nulls, which the page renders
	// with a clear "dato no disponible" rather than crashing.
	let macro: Awaited<ReturnType<typeof getMacroContext>>;
	try {
		macro = await getMacroContext();
	} catch (e) {
		console.error('Macro context failed:', e);
		macro = {
			us_10y: null,
			us_13w: null,
			bund_10y: null,
			vix: null,
			curve_slope: null,
			regime: 'unknown'
		};
	}
	return { macro };
};
