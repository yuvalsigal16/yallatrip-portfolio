#!/usr/bin/env bash
# Spins up a throwaway local Postgres, applies the migration + seed,
# and runs the security/logic tests. Nothing touches your real Supabase.
# Needs PostgreSQL 15+ binaries (initdb, pg_ctl, psql) on this machine.
set -euo pipefail
cd "$(dirname "$0")/.."

PGBIN="${PGBIN:-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)}"
export PATH="$PGBIN:$PATH"
DATA="$(mktemp -d)"
PORT="${PORT:-54329}"
trap 'pg_ctl -D "$DATA" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$DATA"' EXIT

if [ "$(id -u)" = 0 ]; then echo "Run as a regular user (Postgres refuses root)"; exit 1; fi

initdb -D "$DATA" -U postgres -A trust -E UTF8 --locale=C.UTF-8 >/dev/null
pg_ctl -D "$DATA" -o "-p $PORT -k $DATA -c listen_addresses=''" -w start >/dev/null

PSQL=(psql -h "$DATA" -p "$PORT" -U postgres -d postgres -v ON_ERROR_STOP=1 -q)
"${PSQL[@]}" -f supabase/tests/00_local_shim.sql
for f in supabase/migrations/*.sql; do "${PSQL[@]}" -f "$f"; done
"${PSQL[@]}" -f supabase/seed.sql
for t in supabase/tests/[0-9][0-9]_*.sql; do
  [ "$t" = supabase/tests/00_local_shim.sql ] && continue
  echo "== $t"
  "${PSQL[@]}" -f "$t" 2>&1 >/dev/null | sed -e 's/^psql:[^ ]* NOTICE:  //' -e 's/^psql:[^ ]* ERROR:  //' -e 's/^psql:[^ ]* WARNING:  //'
  [ "${PIPESTATUS[0]}" = 0 ] || exit 1
done
