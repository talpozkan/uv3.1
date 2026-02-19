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
from app.repositories.clinical.models import ShardedMuayene

# Path to the source CSV
DATA_DIR = "/Users/alp/Documents/antigravity/UroLog_v2.0/03.db_import/csv_exports"

def parse_date(date_str):
    if not date_str: return None
    try:
        # Expected format: M/D/YYYY
        return datetime.strptime(date_str, "%m/%d/%Y").date()
    except ValueError:
        try:
            return datetime.strptime(date_str, "%d.%m.%Y").date()
        except:
            return None

def clean_str(s):
    if not s: return ""
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

async def import_muayeneler():
    csv_path = os.path.join(DATA_DIR, "MUAYENE.CSV")
    print(f"🚀 Starting Modernized Muayene Import: {csv_path}")
    
    if not os.path.exists(csv_path):
        print(f"❌ File not found: {csv_path}")
        return

    data_lines = get_clean_csv_lines(csv_path)
    if not data_lines:
        print("❌ No valid data lines found.")
        return
        
    reader = csv.DictReader(data_lines, quotechar='"')
    
    count = 0
    added_count = 0
    not_found = 0
    skipped = 0
    
    async with SessionLocal() as session:
        for row in reader:
            try:
                if not row.get("MRecID"): continue
                
                # 1. Resolve Patient (Legacy Ref -> New UUID)
                legacy_id = row.get("HastaRecID")
                if not legacy_id: continue
                
                stmt = select(ShardedPatientDemographics).filter(ShardedPatientDemographics.legacy_id == int(legacy_id))
                res = await session.execute(stmt)
                patient = res.scalars().first()
                
                if not patient:
                    not_found += 1
                    continue

                # 2. Extract Data
                raw_date = parse_date(row.get("Tarih"))
                clean_sikayet = clean_str(row.get("Sikayet"))
                clean_oyku = clean_str(row.get("Oyku"))
                
                # 3. De-duplication Check (Same Patient, Date, Sikayet)
                stmt_exact = select(ShardedMuayene).filter(
                    ShardedMuayene.hasta_id == patient.id,
                    ShardedMuayene.tarih == raw_date,
                    ShardedMuayene.sikayet == clean_sikayet
                )
                res_exact = await session.execute(stmt_exact)
                if res_exact.scalars().first():
                    continue

                # 4. Create Sharded Muayene
                muayene = ShardedMuayene(
                    hasta_id=patient.id,
                    tarih=raw_date or datetime.now(),
                    sikayet=clean_sikayet,
                    oyku=clean_oyku,
                    tansiyon=clean_str(row.get("Tansiyon")),
                    ates=clean_str(row.get("Ates")),
                    kvah=clean_str(row.get("KVAH")),
                    bobrek_sag=clean_str(row.get("BobrekSag")),
                    bobrek_sol=clean_str(row.get("BobrekSol")),
                    suprapubik_kitle=clean_str(row.get("SuprapubikKitle")),
                    ego=clean_str(row.get("EGO")),
                    rektal_tuse=clean_str(row.get("DRE")), 
                    disuri=clean_str(row.get("Disuri")),
                    pollakiuri=clean_str(row.get("Pollakiuri")),
                    nokturi=clean_str(row.get("Nokturi")),
                    hematuri=clean_str(row.get("Hematuri")),
                    genital_akinti=clean_str(row.get("GenitalAkinti")),
                    kabizlik=clean_str(row.get("Kabizlik")),
                    tas_oyku=clean_str(row.get("TasOyku")),
                    catallanma=clean_str(row.get("Catallanma")),
                    projeksiyon_azalma=clean_str(row.get("ProjeksiyonAzalma")),
                    kalibre_incelme=clean_str(row.get("KalibreIncelme")),
                    idrar_bas_zorluk=clean_str(row.get("IdrarBasZorluk")),
                    kesik_idrar_yapma=clean_str(row.get("KesikIdrarYapma")),
                    terminal_damlama=clean_str(row.get("TerminalDamlama")),
                    residiv_hissi=clean_str(row.get("ResidivHissi")),
                    inkontinans=clean_str(row.get("Inkontinans")),
                    status="active"
                )
                
                session.add(muayene)
                added_count += 1
                
                if added_count % 100 == 0:
                    await session.commit()
                    print(f"Processed {added_count} muayenes...")
                    
            except Exception as e:
                # print(f"⚠️ Error: {e}")
                skipped += 1
                
        await session.commit()
    
    print(f"\n✅ Import Summary:")
    print(f" - Successfully Added: {added_count}")
    print(f" - Patient Not Found: {not_found}")
    print(f" - Errors/Skipped: {skipped}")

if __name__ == "__main__":
    asyncio.run(import_muayeneler())
