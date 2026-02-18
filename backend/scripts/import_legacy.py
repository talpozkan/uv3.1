import csv
import asyncio
import os
import sys
from datetime import datetime
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
    if not date_str:
        return None
    try:
        # Expected format: M/D/YYYY
        return datetime.strptime(date_str, "%m/%d/%Y").date()
    except ValueError:
        try:
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

async def import_hastalar():
    csv_path = os.path.join(DATA_DIR, "HASTA.CSV")
    print(f"🚀 Starting Modernized Patient Import: {csv_path}")
    
    data_lines = get_clean_csv_lines(csv_path)
    if not data_lines:
        print(f"❌ No data found at {csv_path}")
        return
        
    reader = csv.DictReader(data_lines, quotechar='"')
    count = 0
    skipped = 0
    
    async with SessionLocal() as session:
        for row in reader:
            try:
                if not row.get("HastaRecID"): continue
                legacy_id = int(row.get("HastaRecID"))
                
                # Check if exists in sharded table
                stmt = select(ShardedPatientDemographics).filter(ShardedPatientDemographics.legacy_id == legacy_id)
                result = await session.execute(stmt)
                if result.scalars().first():
                    continue

                adres_parts = [
                    row.get("Adres1"), row.get("Adres2"), row.get("Adres3"), row.get("Postakod")
                ]
                tam_adres = " ".join([clean_str(p) for p in adres_parts if p])

                hasta = ShardedPatientDemographics(
                    legacy_id=legacy_id,
                    tc_kimlik=clean_str(row.get("TCKimlik")),
                    ad=clean_str(row.get("Ad")),
                    soyad=clean_str(row.get("Soyad")),
                    cinsiyet=clean_str(row.get("Cinsiyet")),
                    dogum_tarihi=parse_date(row.get("DTarih")),
                    dogum_yeri=clean_str(row.get("DYer")),
                    kan_grubu=clean_str(row.get("Kangrubu")),
                    medeni_hal=clean_str(row.get("MedeniHal")),
                    meslek=clean_str(row.get("Meslek")),
                    adres=tam_adres,
                    ev_tel=clean_str(row.get("Evtelefonu")),
                    is_tel=clean_str(row.get("IsTelefon")),
                    cep_tel=clean_str(row.get("Ceptelefonu")),
                    email=clean_str(row.get("Eposta")),
                    doktor=clean_str(row.get("Doktor")),
                    kimlik_notlar=clean_str(row.get("Notlar")),
                    status="active"
                )
                session.add(hasta)
                count += 1
                
                if count % 100 == 0:
                    await session.commit()
                    print(f"Processed {count} patients...")
                    
            except Exception as e:
                skipped += 1
        
        await session.commit()
    print(f"✅ Finished importing {count} patients. Skipped/Error: {skipped}")

async def import_muayeneler():
    csv_path = os.path.join(DATA_DIR, "MUAYENE.CSV")
    print(f"🚀 Starting Modernized Muayene Import: {csv_path}")
    
    data_lines = get_clean_csv_lines(csv_path)
    if not data_lines:
        return
        
    reader = csv.DictReader(data_lines, quotechar='"')
    count = 0
    not_found = 0

    async with SessionLocal() as session:
        for row in reader:
            try:
                if not row.get("MRecID"):
                    continue
                
                legacy_h_id = int(row.get("HastaRecID"))
                tarih = parse_date(row.get("Tarih"))
                
                # Resolve sharded patient
                stmt = select(ShardedPatientDemographics).filter(ShardedPatientDemographics.legacy_id == legacy_h_id)
                res = await session.execute(stmt)
                patient = res.scalars().first()
                
                if not patient:
                    not_found += 1
                    continue

                # De-duplication check
                clean_sikayet = clean_str(row.get("Sikayet"))
                stmt_check = select(ShardedMuayene).filter(
                    ShardedMuayene.hasta_id == patient.id, 
                    ShardedMuayene.tarih == tarih,
                    ShardedMuayene.sikayet == clean_sikayet
                )
                res_check = await session.execute(stmt_check)
                if res_check.scalars().first():
                    continue

                muayene = ShardedMuayene(
                    hasta_id=patient.id,
                    tarih=tarih or datetime.now(),
                    sikayet=clean_sikayet,
                    oyku=clean_str(row.get("Oyku")),
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
                count += 1
                
                if count % 100 == 0:
                    await session.commit()
                    print(f"Processed {count} examinations...")
                    
            except Exception as e:
                pass

        await session.commit()
    print(f"✅ Finished importing {count} examinations. Patient Not Found: {not_found}")

async def main():
    print("🌟 Starting Modernized Legacy Data Import...")
    await import_hastalar()
    await import_muayeneler()
    print("✨ Import completed.")

if __name__ == "__main__":
    asyncio.run(main())
