import asyncio
import csv
import os
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import sessionmaker

# App imports
import sys
sys.path.append(os.path.join(os.getcwd(), "backend"))
from app.core.config import settings
from app.models.system import ICDTani

async def import_special_icd():
    # Use the same logic as the app to determine DB host
    db_url = settings.DATABASE_URL
    print(f"Connecting to: {db_url}")
    
    engine = create_async_engine(db_url)
    async_session = sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)
    
    csv_file = "/Users/alp/Documents/antigravity/UroLog_v2.0/03.db_import/Uroloji_ICD_summary.csv"
    
    if not os.path.exists(csv_file):
        print(f"File not found: {csv_file}")
        return

    count_added = 0
    count_updated = 0

    async with async_session() as session:
        with open(csv_file, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                code = row['KODU'].strip()
                name = row['ADI'].strip()
                
                # Check if exists
                result = await session.execute(select(ICDTani).filter(ICDTani.kodu == code))
                existing = result.scalars().first()
                
                if existing:
                    if existing.adi != name:
                        existing.adi = name
                        count_updated += 1
                else:
                    new_tani = ICDTani(
                        kodu=code,
                        adi=name,
                        aktif="1", # Assuming active
                        seviye="2" # Usually point level
                    )
                    session.add(new_tani)
                    count_added += 1
            
            await session.commit()
            
    print(f"Import complete: {count_added} added, {count_updated} updated.")

if __name__ == "__main__":
    asyncio.run(import_special_icd())
