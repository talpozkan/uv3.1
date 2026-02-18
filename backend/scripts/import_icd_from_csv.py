import asyncio
import csv
import os
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

# App imports
import sys
sys.path.append(os.path.join(os.getcwd(), "backend"))
from app.core.config import settings
from app.models.system import ICDTani

async def import_icd_from_csv():
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

    async with async_session() as session:
        print(f"Reading {csv_file}...")
        with open(csv_file, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                code = row['KODU'].strip()
                name = row['ADI'].strip()
                
                # We know the table is empty now, so we can just add
                new_tani = ICDTani(
                    kodu=code,
                    adi=name,
                    aktif="1", # Active
                    seviye="2" # Specific code level
                )
                session.add(new_tani)
                count_added += 1
                
                # Commit in batches of 100 for efficiency
                if count_added % 100 == 0:
                    await session.commit()
            
            await session.commit()
            
    print(f"Import complete: {count_added} ICD codes added from CSV.")

if __name__ == "__main__":
    asyncio.run(import_icd_from_csv())
