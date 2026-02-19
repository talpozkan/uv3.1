#!/bin/bash
set -e

# --- Configuration ---
DB_CONTAINER="urolog_db"
DB_USER="emr_admin"
DB_NAME="urolog_db"
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PYTHON_EXEC="/Users/alp/.pyenv/versions/3.11.14/bin/python3"
BACKEND_DIR="$PROJECT_ROOT/backend"

# --- Helper Functions ---
log() {
    echo -e "\033[1;32m[DB-REFRESH]\033[0m $1"
}

error() {
    echo -e "\033[1;31m[ERROR]\033[0m $1"
    exit 1
}

# --- Validation ---
if [ -z "$1" ]; then
    error "Usage: ./db_refresh.sh <path_to_sql_dump>"
fi

DUMP_FILE="$1"
if [ ! -f "$DUMP_FILE" ]; then
    error "Dump file not found: $DUMP_FILE"
fi

# --- Execution ---
log "Starting database refresh process..."

# 1. Cleanup
log "Step 1: Cleaning up old data and schemas..."
docker exec -i "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -c "
DROP SCHEMA IF EXISTS clinical CASCADE;
DROP SCHEMA IF EXISTS patient CASCADE;
DROP SCHEMA IF EXISTS finance CASCADE;
DO \$\$ DECLARE r RECORD; BEGIN
    FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
        EXECUTE 'DROP TABLE IF EXISTS ' || quote_ident(r.tablename) || ' CASCADE';
    END LOOP;
END \$\$;
CREATE SCHEMA clinical;
CREATE SCHEMA patient;
CREATE SCHEMA finance;
CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\";
"

# 2. Import Dump
log "Step 2: Importing SQL dump: $DUMP_FILE"
if [[ "$DUMP_FILE" == *.gz ]]; then
    gunzip -c "$DUMP_FILE" | docker exec -i "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME"
else
    docker exec -i "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" < "$DUMP_FILE"
fi

# 3. Align Alembic State
log "Step 3: Aligning Alembic version..."
cd "$BACKEND_DIR"
export PYTHONPATH=$PYTHONPATH:$(pwd)

# Get current version from dump (if it was restored by the dump)
DUMP_VERSION=$(docker exec -i "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT version_num FROM alembic_version LIMIT 1;" 2>/dev/null | xargs || echo "")

# ALWAYS start with a clean alembic_version table to avoid "already exists" confusion during stamp
docker exec -i "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -c "DROP TABLE IF EXISTS public.alembic_version CASCADE;"

if [ -z "$DUMP_VERSION" ] || [ "$DUMP_VERSION" == "" ]; then
    log "⚠️ No Alembic version found in dump. Assuming legacy (964172eb296a)..."
    "$PYTHON_EXEC" -m alembic stamp 964172eb296a
else
    log "Found version $DUMP_VERSION in dump. Stamping to align..."
    "$PYTHON_EXEC" -m alembic stamp "$DUMP_VERSION"
fi

# 4. Run Migrations
log "Step 4: Running migrations to reach latest schema..."
"$PYTHON_EXEC" -m alembic upgrade head

# 5. Synchronize Shards
log "Step 5: Synchronizing sharded tables..."
# Output sync log to terminal and wait for it
"$PYTHON_EXEC" scripts/sync_shards.py

# 6. Restore Admin Access
log "Step 6: Restoring admin access for alp@alpozkan.com..."
"$PYTHON_EXEC" scripts/restore_admin.py

log "✅ Database refresh and synchronization complete!"
log "Standardized pipeline finished successfully."
