
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text
from app.core.config import settings

async def create_indexes():
    """
    Creates indexes to optimize dashboard query performance and searching.
    Includes both B-Tree indexes for sorting/filtering and GiST/GIN for text search.
    """
    db_url = settings.DATABASE_URL
    print(f"Connecting to database: {db_url}")
    engine = create_async_engine(db_url, echo=True)

    async with engine.begin() as conn:
        print("Creating Indexes...")
        
        # 1. Enable pg_trgm extension for fuzzy search if not exists
        await conn.execute(text("CREATE EXTENSION IF NOT EXISTS pg_trgm;"))
        
        # 2. Index for Sorting by Name (Dashboard Patient List)
        # Used when listing patients ordered by name
        await conn.execute(text("""
            CREATE INDEX IF NOT EXISTS ix_patient_demographics_ad 
            ON patient.sharded_patient_demographics (ad);
        """))
        await conn.execute(text("""
            CREATE INDEX IF NOT EXISTS ix_patient_demographics_soyad 
            ON patient.sharded_patient_demographics (soyad);
        """))

        # 3. Index for Dashboard Statistics (created_at)
        # Used for "Total Patients", "New This Month", etc.
        await conn.execute(text("""
            CREATE INDEX IF NOT EXISTS ix_patient_demographics_created_at 
            ON patient.sharded_patient_demographics (created_at);
        """))

        # 4. Indexes for Search (Fuzzy / Trigram)
        # Used for "Fast Search" in the dashboard
        await conn.execute(text("""
            CREATE INDEX IF NOT EXISTS trgm_idx_patient_ad 
            ON patient.sharded_patient_demographics 
            USING gin (ad gin_trgm_ops);
        """))
        await conn.execute(text("""
            CREATE INDEX IF NOT EXISTS trgm_idx_patient_soyad 
            ON patient.sharded_patient_demographics 
            USING gin (soyad gin_trgm_ops);
        """))
        await conn.execute(text("""
            CREATE INDEX IF NOT EXISTS trgm_idx_patient_tc 
            ON patient.sharded_patient_demographics 
            USING gin (tc_kimlik gin_trgm_ops);
        """))
        
        # 5. Composite Index for Updated At (Last Operation Sort)
        await conn.execute(text("""
            CREATE INDEX IF NOT EXISTS ix_patient_demographics_updated_at 
            ON patient.sharded_patient_demographics (updated_at DESC NULLS LAST);
        """))

        # 6. Composite Index for Examinations (Latest Exam per Patient)
        # Critical for Dashboard Patient List aggregation
        await conn.execute(text("""
            CREATE INDEX IF NOT EXISTS ix_clinical_muayeneler_patient_date 
            ON clinical.sharded_clinical_muayeneler (hasta_id, tarih DESC);
        """))

    await engine.dispose()
    print("✅ Index Creation Complete.")

if __name__ == "__main__":
    asyncio.run(create_indexes())
