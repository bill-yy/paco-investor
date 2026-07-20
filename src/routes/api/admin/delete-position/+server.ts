import type { RequestHandler } from './$types';
import { json, error } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';

// DELETE /api/admin/delete-position?ticker=XXX
// Elimina la posición y todos sus trades asociados. Solo para uso administrativo
// (corregir errores de seeding, duplicados, etc.)
export const DELETE: RequestHandler = async ({ url }) => {
	const ticker = url.searchParams.get('ticker');
	if (!ticker) throw error(400, 'ticker query param required');

	const db = getDb();
	const t = db.transaction(() => {
		const trades = db.prepare('DELETE FROM trades WHERE ticker = ?').run(ticker);
		const positions = db.prepare('DELETE FROM positions WHERE ticker = ?').run(ticker);
		return { trades: trades.changes, positions: positions.changes };
	});
	const result = t();

	// Recalcular cash: el capital es inicial (10000) menos lo invertido en posiciones restantes
	const remaining = db
		.prepare('SELECT SUM(shares * avg_price_eur) as total FROM positions')
		.get() as any;
	const totalInvested = remaining?.total || 0;
	const cash = 10000 - totalInvested;

	return json({ deleted: result, ticker, cash_remaining: cash });
};
