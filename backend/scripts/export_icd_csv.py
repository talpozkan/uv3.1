import asyncio
import csv
import os
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import sessionmaker

# App imports
import sys
sys.path.append(os.getcwd())
from app.core.config import settings
from app.models.system import ICDTani

async def export_icd_to_csv():
    # Use the same logic as the app to determine DB host
    db_url = settings.DATABASE_URL
    print(f"Connecting to: {db_url}")
    
    engine = create_async_engine(db_url)
    async_session = sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)
    
    output_file = "icd_kodlari_listesi.csv"
    
    async with async_session() as session:
        result = await session.execute(select(ICDTani).order_by(ICDTani.kodu))
        tanilar = result.scalars().all()
        
        if not tanilar:
            print("No ICD codes found in the database.")
            return
            
        with open(output_file, 'w', newline='', encoding='utf-8-sig') as csvfile:
            fieldnames = ['ID', 'KODU', 'ADI', 'UST_KODU', 'AKTIF', 'SEVIYE']
            writer = csv.DictWriter(csvfile, fieldnames=fieldnames, delimiter=';')
            
            writer.writeheader()
            for tani in tanilar:
                writer.writerow({
                    'ID': tani.id,
                    'KODU': tani.kodu,
                    'ADI': tani.adi,
                    'UST_KODU': tani.ust_kodu,
                    'AKTIF': tani.aktif,
                    'SEVIYE': tani.seviye
                })
                
        print(f"Successfully exported {len(tanilar)} ICD codes to {output_file}")

if __name__ == "__main__":
    asyncio.run(export_icd_to_csv())
