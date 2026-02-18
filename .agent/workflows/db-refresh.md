---
description: Refresh the database from a SQL dump and synchronize sharded tables
---

# Database Refresh Workflow

This workflow describes the standardized process for refreshing the UroLog database from a SQL dump.

## Prerequisites

- Access to the backend directory.
- Docker running with the `urolog_db` container.
- A valid PostgreSQL SQL dump (`.sql` or `.sql.gz`).

## Steps

1. **Locate the Dump**: Identify the path to the SQL dump file.
2. **Execute Refresh**: Run the master orchestration script from the `backend` directory:

   ```bash
   ./scripts/db_refresh.sh path/to/your/dump.sql.gz
   ```

3. **Verify Output**: Ensure the script logs "✅ Database refresh and synchronization complete!" and has an exit code of 0.
4. **Data Audit**: Verify row counts in key sharded tables:

   ```bash
   docker exec urolog_db psql -U emr_admin -d urolog_db -c "SELECT COUNT(*) FROM patient.sharded_patient_demographics;"
   ```

5. **Access Check**: Confirm you can log in with `alp@alpozkan.com` (password: `salmonella`).

## Troubleshooting

- **Alembic Conflicts**: The script automatically drops `alembic_version` and stamps the baseline to prevent overlaps. If errors persist, manually stamp to the dump's version.
- **Sequence Collisions**: `sync_shards.py` handles sequence resetting. If ID errors occur, rerun Step 5 manually.
- **Module Errors**: Ensure you are using the correct Python environment (specified in the script) to avoid `ModuleNotFoundError`.
