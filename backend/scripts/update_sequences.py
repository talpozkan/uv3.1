import asyncio
import os
import sys

# Add backend directory to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text
from app.core import config

settings = config.settings

async def update_sequences():
    db_url = settings.DATABASE_URL
    if "db" in db_url and "localhost" not in db_url:
        db_url = db_url.replace("@db:5432", "@localhost:5441")

    engine = create_async_engine(db_url, echo=True)

    tables_with_int_ids = [
        ("clinical.sharded_clinical_muayeneler", "id"),
        ("clinical.sharded_clinical_operasyonlar", "id"),
        ("clinical.sharded_clinical_notlar", "id"),
        ("clinical.sharded_clinical_tetkikler", "id"),
        ("clinical.sharded_clinical_fotograflar", "id"),
        ("clinical.sharded_clinical_istirahat_raporlari", "id"),
        ("clinical.sharded_clinical_durum_bildirir_raporlari", "id"),
        ("clinical.sharded_clinical_tibbi_mudahale_raporlari", "id"),
        ("clinical.sharded_clinical_trus_biyopsileri", "id"),
        ("public.randevular", "id"),
        ("public.users", "id"),
    ]

    async with engine.begin() as conn:
        print("Updating Primary Key Sequences...")
        
        for table, pk in tables_with_int_ids:
            # Construct sequence name assumption or use dynamic lookup
            # Default PG naming: table_column_seq. 
            # Schemas involved: clinical, public.
            
            # Use dynamic PG query to find sequence:
            query = text(f"""
                SELECT pg_get_serial_sequence('{table}', '{pk}');
            """)
            result = await conn.execute(query)
            seq_name = result.scalar()
            
            if seq_name:
                print(f"Updating sequence {seq_name} for {table}...")
                await conn.execute(text(f"""
                    SELECT setval('{seq_name}', (SELECT COALESCE(MAX({pk}), 0) + 1 FROM {table}), false);
                """))
            else:
                print(f"No sequence found for {table} PK {pk}")

    await engine.dispose()
    print("Sequence Update Complete.")

if __name__ == "__main__":
    asyncio.run(update_sequences())
