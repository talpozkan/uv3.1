
import asyncio
import pandas as pd
import re
import sys
import os

# Add parent dir to path to import app modules
sys.path.append(os.getcwd())

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import text
from app.core.config import settings

# Database connection
DATABASE_URL = "postgresql+asyncpg://emr_admin:secure_password@localhost:5440/urolog_db"
EXCEL_PATH = "/Users/alp/Documents/antigravity/UroLog_v2.0/03.db_import/ICD 10.xls"

async def import_icd_data():
    print(f"Reading Excel: {EXCEL_PATH}")
    try:
        df = pd.read_excel(EXCEL_PATH, header=None)
    except Exception as e:
        print(f"Error reading excel: {e}")
        return

    print(f"Total rows found: {len(df)}")
    
    engine = create_async_engine(DATABASE_URL, echo=False)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    codes_to_insert = []
    
    # Iterate rows
    # Assuming Column 0 is Code, Column 1 is Name
    # Based on inspection:
    # Row 41: A00.0 | Kolera...
    
    for index, row in df.iterrows():
        if pd.isna(row[0]) or pd.isna(row[1]):
            continue
            
        code = str(row[0]).strip()
        name = str(row[1]).strip()
        
        # Validate code pattern
        # Accept A00, A00.0, A00.9, B99 etc.
        if not re.match(r'^[A-Z]\d{2}(\.\d+)?$', code):
            continue
            
        # Determine parent code
        parent = None
        if '.' in code:
            parent = code.split('.')[0]
        
        codes_to_insert.append({
            "kodu": code,
            "adi": name,
            "ust_kodu": parent,
            "aktif": "1",
            "seviye": "1" if not parent else "2"
        })
        
    print(f"Parsed {len(codes_to_insert)} valid ICD codes.")
    
    if not codes_to_insert:
        print("No codes found. Aborting.")
        return

    async with async_session() as session:
        try:
            # We will use bulk insert/upsert
            # Since updating 10k rows one by one is slow, we'll delete and re-insert 
            # OR we can do batch upsert.
            
            # User said "güncelle", which might imply keeping IDs if possible?
            # But "ICD 10.xls" is authoritative.
            # Let's try to UPSERT.
            
            # To be safe and efficient, let's process in chunks
            chunk_size = 1000
            total_updated = 0
            
            for i in range(0, len(codes_to_insert), chunk_size):
                chunk = codes_to_insert[i:i + chunk_size]
                
                # Construct values string for VALUES (...)
                # Note: We need to be careful with SQL injection, but these are local files.
                # However, SQL Alchemy text is better.
                
                # Using explicit loop for simplicity in script, though slower than COPY.
                for item in chunk:
                    await session.execute(text("""
                        INSERT INTO icd_tanilar (kodu, adi, ust_kodu, aktif, seviye)
                        VALUES (:kodu, :adi, :ust_kodu, :aktif, :seviye)
                        ON CONFLICT (kodu) DO UPDATE SET
                            adi = EXCLUDED.adi,
                            ust_kodu = EXCLUDED.ust_kodu,
                            aktif = EXCLUDED.aktif
                    """), item)
                
                await session.commit()
                total_updated += len(chunk)
                print(f"Processed {total_updated}/{len(codes_to_insert)}")
                
            print("✅ ICD 10 update success.")

        except Exception as e:
            await session.rollback()
            print(f"❌ Error during DB update: {e}")
            
    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(import_icd_data())
