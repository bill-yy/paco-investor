import type { RequestHandler } from './$types';
import { json, error } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';

// DELETE /api/admin/delete-position?ticker=XXX&strategy_id=funds
// Elimina la posición y todos sus trades asociados. Solo para uso administrativo.
// Si strategy_id se especifica, solo afecta esa estrategia.
export const DELETE: RequestHandler = async ({ url }) => {
	const ticker = url.searchParams.get('ticker');
	if (!ticker) throw error(400, 'ticker query param required');
	const strategyId = url.searchParams.get('strategy_id'); // optional

	const db = getDb();
	const t = db.transaction(() => {
		if (strategyId) {
			const trades = db.prepare('DELETE FROM trades WHERE ticker = ? AND strategy_id = ?').run(ticker, strategyId);
			const positions = db.prepare('DELETE FROM positions WHERE ticker = ? AND strategy_id = ?').run(ticker, strategyId);
			return { trades: trades.changes, positions: positions.changes };
		} else {
			const trades = db.prepare('DELETE FROM trades WHERE ticker = ?').run(ticker);
			const positions = db.prepare('DELETE FROM positions WHERE ticker = ?').run(ticker);
			return { trades: trades.changes, positions: positions.changes };
		}
	});
	const result = t();

	return json({ deleted: result, ticker, strategy_id: strategyId || 'all' });
};
