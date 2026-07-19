import type { PageServerLoad } from './$types';
import { getDb } from '$lib/server/db';

export const load: PageServerLoad = async () => {
	const db = getDb();
	let watchlist: any[] = [];
	try {
		watchlist = db.prepare('SELECT * FROM watchlist ORDER BY added_at DESC').all() as any[];
	} catch (e) {
		watchlist = [];
	}
	return { watchlist };
};
