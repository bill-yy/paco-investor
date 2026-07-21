import type { PageServerLoad } from './$types';
import { getDb } from '$lib/server/db';
import type { Watchlist } from '$lib/server/db';

export const load: PageServerLoad = async () => {
	const db = getDb();
	let watchlist: Watchlist[] = [];
	try {
		watchlist = db.prepare('SELECT * FROM watchlist ORDER BY added_at DESC').all() as Watchlist[];
	} catch (e) {
		watchlist = [];
	}
	return { watchlist };
};
