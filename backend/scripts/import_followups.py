import csv
import asyncio
import os
import sys
from datetime import datetime
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

# Add parent directory to path to import app modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.db.session import SessionLocal
from app.repositories.patient.models import ShardedPatientDemographics
from app.repositories.clinical.models import ShardedClinicalNote

# Path to the source CSV
DATA_FILE = "/Users/alp/Documents/antigravity/UroLog_v2.0/03.db_import/csv_exports/HNOTLAR.CSV"

def parse_date(date_str):
    if not date_str:
        return None
    try:
        # Expected format: M/D/YYYY
        return datetime.strptime(date_str, "%m/%d/%Y").date()
    except ValueError:
        try:
             # Fallback: DD.MM.YYYY
            return datetime.strptime(date_str, "%d.%m.%Y").date()
        except:
            return None

def clean_str(s):
    if not s:
        return ""
    return s.replace('\x00', '').strip()

def get_clean_csv_lines(path):
    if not os.path.exists(path):
        return []
    with open(path, mode='r', encoding='cp1254', errors='replace') as f:
        lines = f.readlines()
    
    start_idx = 0
    for i, line in enumerate(lines):
        if line.strip().startswith('"#"'):
            start_idx = i
            break
    
    return [l for l in lines[start_idx:] if l.strip()]

async def import_notlar():
    print(f"🚀 Starting Modernized Note Import: {DATA_FILE}")
    
    if not os.path.exists(DATA_FILE):
        print(f"❌ File not found: {DATA_FILE}")
        return

    data_lines = get_clean_csv_lines(DATA_FILE)
    if not data_lines:
        print("❌ No valid data lines found.")
        return
        
    reader = csv.DictReader(data_lines, quotechar='"')
    
    count = 0
    skipped = 0
    not_found = 0
    
    async with SessionLocal() as session:
        for row in reader:
            try:
                # 1. Resolve Patient (Legacy Ref -> New UUID)
                legacy_id = row.get("HastaRecID")
                if not legacy_id:
                    continue
                
                # In our sharding system, we kept legacy_id in sharded_patient_demographics for correlation
                stmt = select(ShardedPatientDemographics).filter(ShardedPatientDemographics.legacy_id == int(legacy_id))
                res = await session.execute(stmt)
                patient = res.scalars().first()
                
                if not patient:
                    not_found += 1
                    continue

                # 2. Create Sharded Note
                # CSV Columns: Tip, Notlar, Sembol, Tarih
                tarih = parse_date(row.get("Tarih"))
                
                note = ShardedClinicalNote(
                    hasta_id=patient.id, # New UUID
                    tarih=tarih or datetime.now(),
                    tip=clean_str(row.get("Tip")),
                    icerik=clean_str(row.get("Notlar")),
                    sembol=clean_str(row.get("Sembol")),
                    status="active"
                )
                
                session.add(note)
                count += 1
                
                # Commit in batches for performance
                if count % 100 == 0:
                    await session.commit()
                    print(f"Processed {count} notes...")
                    
            except Exception as e:
                print(f"⚠️ Error importing row: {e}")
                skipped += 1
        
        await session.commit()
    
    print(f"\n✅ Import Summary:")
    print(f" - Successfully Imported: {count}")
    print(f" - Patient Not Found: {not_found}")
    print(f" - Errors/Skipped: {skipped}")

if __name__ == "__main__":
    asyncio.run(import_notlar())
