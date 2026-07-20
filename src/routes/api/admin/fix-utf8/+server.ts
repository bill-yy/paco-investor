import type { RequestHandler } from './$types';
import { json, error } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';

// Sanea datos UTF-8 corruptos en positions y trades.
// El carácter EF BF BD (Unicode Replacement Character U+FFFD) aparece cuando
// texto UTF-8 se transmite/codifica mal. Este endpoint lo reemplaza por
// el texto correcto proporcionado en el body.
//
// Uso:
//   POST /api/admin/fix-utf8
//   {
//     "table": "positions" | "trades",
//     "ticker": "MUV2.DE",
//     "fields": {
//       "company_name": "Münchener Rückversicherungs-Gesellschaft AG",
//       "sector": "Finanzas — Reaseguro",
//       "thesis": "...",
//       "bear_case": "...",
//       "catalysts": "...",
//       "risks": "..."
//     }
//   }

const ALLOWED_FIELDS: Record<string, string[]> = {
	positions: ['company_name', 'sector', 'market', 'thesis', 'bear_case', 'catalysts', 'risks'],
	trades: ['company_name', 'thesis']
};

export const POST: RequestHandler = async ({ request }) => {
	let body: any;
	try {
		body = await request.json();
	} catch {
		throw error(400, 'Invalid JSON');
	}

	const { table, ticker, fields } = body;
	if (!table || !ALLOWED_FIELDS[table]) {
		throw error(400, `table must be one of: ${Object.keys(ALLOWED_FIELDS).join(', ')}`);
	}
	if (!ticker) throw error(400, 'ticker required');
	if (!fields || typeof fields !== 'object') throw error(400, 'fields object required');

	const db = getDb();
	const allowed = ALLOWED_FIELDS[table];
	const updates: string[] = [];
	const values: any[] = [];

	for (const [field, value] of Object.entries(fields)) {
		if (!allowed.includes(field)) continue;
		updates.push(`${field} = ?`);
		values.push(value);
	}

	if (updates.length === 0) {
		throw error(400, `no updatable fields. Allowed: ${allowed.join(', ')}`);
	}

	values.push(ticker);
	const result = db.prepare(`UPDATE ${table} SET ${updates.join(', ')} WHERE ticker = ?`).run(values);

	return json({
		updated: result.changes,
		table,
		ticker,
		fields: Object.keys(fields)
	});
};
