#!/bin/sh
set -e

# Use the Prisma CLI bundled in node_modules. Bare `npx prisma` would silently
# download the latest CLI (v7+) when the local one is missing, and v7 rejects
# this schema (`url` in the datasource block, the "metrics" preview feature).
PRISMA="./node_modules/.bin/prisma"

# Maximum number of seconds to wait for PostgreSQL to accept connections.
DB_WAIT_TIMEOUT="${DB_WAIT_TIMEOUT:-60}"
# Seconds to sleep between readiness attempts.
DB_WAIT_INTERVAL="${DB_WAIT_INTERVAL:-2}"

# Parse the host and port out of DATABASE_URL.
# Expected form: postgresql://user:pass@host:port/db?params
# Falls back to sensible defaults when a component is missing.
parse_db_host_port() {
  url="$1"
  # Strip the scheme (everything up to and including "://").
  rest="${url#*://}"
  # Strip any query string.
  rest="${rest%%\?*}"
  # Strip the credentials (everything up to and including the last "@").
  case "$rest" in
    *@*) hostport="${rest##*@}" ;;
    *)   hostport="$rest" ;;
  esac
  # Strip the database path.
  hostport="${hostport%%/*}"
  # Split host and port.
  case "$hostport" in
    *:*)
      DB_HOST="${hostport%%:*}"
      DB_PORT="${hostport##*:}"
      ;;
    *)
      DB_HOST="$hostport"
      DB_PORT="5432"
      ;;
  esac
  # Handle IPv6 literals wrapped in brackets, e.g. [::1]:5432
  case "$DB_HOST" in
    \[*\]) DB_HOST="${DB_HOST#[}"; DB_HOST="${DB_HOST%]}" ;;
  esac
  [ -n "$DB_HOST" ] || DB_HOST="localhost"
  [ -n "$DB_PORT" ] || DB_PORT="5432"
}

# Poll PostgreSQL with pg_isready until it accepts connections or we time out.
wait_for_postgres() {
  parse_db_host_port "$DATABASE_URL"

  if ! command -v pg_isready >/dev/null 2>&1; then
    echo "WARNING: pg_isready not found; skipping database readiness check." >&2
    return 0
  fi

  echo "Waiting for PostgreSQL at ${DB_HOST}:${DB_PORT} (timeout: ${DB_WAIT_TIMEOUT}s)..."
  elapsed=0
  attempt=0
  while :; do
    attempt=$((attempt + 1))
    if pg_isready -h "$DB_HOST" -p "$DB_PORT" -q; then
      echo "PostgreSQL is ready (attempt ${attempt}, ${elapsed}s elapsed)."
      return 0
    fi
    if [ "$elapsed" -ge "$DB_WAIT_TIMEOUT" ]; then
      echo "ERROR: PostgreSQL at ${DB_HOST}:${DB_PORT} did not become ready within ${DB_WAIT_TIMEOUT}s." >&2
      return 1
    fi
    echo "Waiting for PostgreSQL... attempt ${attempt} failed (${elapsed}s elapsed)."
    sleep "$DB_WAIT_INTERVAL"
    elapsed=$((elapsed + DB_WAIT_INTERVAL))
  done
}

if [ -z "${DATABASE_URL:-}" ]; then
  echo "WARNING: DATABASE_URL is not set." >&2
  echo "Skipping database migrations and running in mock/fallback mode." >&2
else
  if ! wait_for_postgres; then
    exit 1
  fi

  echo "Running database migrations..."
  # Automatically resolve the duplicate soft_deletes migration that failed on Render
  "$PRISMA" migrate resolve --applied 20260829000000_soft_deletes || true
  "$PRISMA" migrate deploy
  echo "Verifying migration status..."
  if "$PRISMA" migrate status >/dev/null 2>&1; then
    echo "Database schema is up to date."
  else
    echo "WARNING: Prisma schema is out of sync with the database." >&2
    echo "Run './node_modules/.bin/prisma migrate deploy' and restart the server." >&2
  fi
fi

if [ ! -x "$PRISMA" ]; then
  echo "ERROR: Prisma CLI not found at $PRISMA." >&2
  echo "It must be a production dependency so it survives 'npm prune --omit=dev'." >&2
  exit 1
fi

if [ ! -d "./node_modules/@prisma/client" ]; then
  echo "ERROR: @prisma/client is missing from the runtime image." >&2
  echo "Without it the app falls back to a mock client and serves fake data." >&2
  exit 1
fi


echo "Starting the application..."
npm start