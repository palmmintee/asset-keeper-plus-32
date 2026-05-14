#!/bin/bash
# รัน migration ของแอพหลัง Supabase init schema เสร็จแล้ว
set -e

echo ">>> Running app migrations..."
for f in /docker-entrypoint-initdb.d/migrations/*.sql; do
  echo "  -> $f"
  psql -v ON_ERROR_STOP=0 -U postgres -d postgres -f "$f" || echo "  (warning: some statements may have failed - check above)"
done
echo ">>> App migrations done."
