#!/usr/bin/env bash
# End-to-end API test: the real schema behind a real PostgREST (the server Supabase uses),
# driven by the exact queries the app sends. Needs PostgreSQL 15+ and a `postgrest` binary
# (https://github.com/PostgREST/postgrest/releases) on PATH or in POSTGREST=/path.
set -euo pipefail
cd "$(dirname "$0")/.."
if [ "$(id -u)" = 0 ]; then echo "Run as a regular user (Postgres refuses root)"; exit 1; fi

PGBIN="${PGBIN:-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)}"
export PATH="$PGBIN:$PATH"
POSTGREST="${POSTGREST:-postgrest}"
DATA="$(mktemp -d)"
PGPORT="${PGPORT:-54331}"
API_PORT="${API_PORT:-54332}"
export JWT_SECRET="local-test-secret-that-is-at-least-32-characters-long"
trap 'kill $PGRST_PID 2>/dev/null || true; pg_ctl -D "$DATA" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$DATA"' EXIT
PGRST_PID=""

initdb -D "$DATA" -U postgres -A trust -E UTF8 --locale=C.UTF-8 >/dev/null
pg_ctl -D "$DATA" -o "-p $PGPORT -k $DATA -c listen_addresses=''" -w start >/dev/null
PSQL=(psql -h "$DATA" -p "$PGPORT" -U postgres -d postgres -v ON_ERROR_STOP=1 -q)
"${PSQL[@]}" -f supabase/tests/00_local_shim.sql
for f in supabase/migrations/*.sql; do "${PSQL[@]}" -f "$f"; done
"${PSQL[@]}" -f supabase/seed.sql

PGRST_DB_URI="postgres://authenticator@/postgres?host=$DATA&port=$PGPORT" \
PGRST_DB_SCHEMAS=public PGRST_DB_ANON_ROLE=anon PGRST_JWT_SECRET="$JWT_SECRET" \
PGRST_SERVER_PORT="$API_PORT" PGRST_LOG_LEVEL=crit "$POSTGREST" &
PGRST_PID=$!
for _ in $(seq 1 50); do curl -s "http://localhost:$API_PORT/" >/dev/null && break; sleep 0.2; done

API="http://localhost:$API_PORT" PGHOST="$DATA" PGPORT="$PGPORT" python3 tests/api/api_test.py
