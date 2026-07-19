#!/bin/sh
set -e

# Initialize DB on first boot (creates tables + default settings)
node -e "
import('./build/server/seed.js').then(() => process.exit(0)).catch(e => { console.error('Seed skipped:', e.message); process.exit(0); });
" 2>/dev/null || true

# Start the server
exec node build
