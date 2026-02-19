import asyncio
import json
import os
import shutil
from uuid import UUID
from datetime import datetime
from sqlalchemy import select, or_, delete
from app.db.session import SessionLocal
from app.repositories.patient.models import ShardedPatientDemographics
from app.repositories.clinical.models import ShardedTetkikSonuc, ShardedFotografArsivi
from app.models.documents import HastaDosya

# Paths
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
# Check if running inside container (mount path) or locally
if os.path.exists("/data_import"):
    IMPORT_DIR = "/data_import"
else:
    IMPORT_DIR = os.path.join(os.path.dirname(BASE_DIR), "03.db_import")

JSON_FILE = os.path.join(IMPORT_DIR, "archive_export_v1.json")
DOCS_SOURCE_DIR = os.path.join(IMPORT_DIR, "documents")
DOCS_DEST_DIR = os.path.join(BASE_DIR, "static", "documents")

IMAGE_EXTENSIONS = {'.jpg', '.jpeg', '.png', '.webp', '.bmp', '.gif'}

async def match_patient(session, entry):
    # 1. Match by TC Kimlik
    tc = entry.get("tc_kimlik")
    if tc:
        tc = tc.strip()
        stmt = select(ShardedPatientDemographics).where(ShardedPatientDemographics.tc_kimlik == tc)
        result = await session.execute(stmt)
        patient = result.scalar_one_or_none()
        if patient:
            return patient

    # 2. Match by Name and Surname (Exact)
    ad = entry.get("ad", "").strip().upper()
    soyad = entry.get("soyad", "").strip().upper()
    if ad and soyad:
        stmt = select(ShardedPatientDemographics).where(
            (ShardedPatientDemographics.ad.ilike(ad)) & (ShardedPatientDemographics.soyad.ilike(soyad))
        )
        result = await session.execute(stmt)
        patients = result.scalars().all()
        if len(patients) == 1:
            return patients[0]
    return None

async def import_docs():
    if not os.path.exists(JSON_FILE):
        print(f"JSON file not found: {JSON_FILE}")
        return

    with open(JSON_FILE, "r", encoding="utf-8") as f:
        data = json.load(f)

    print(f"Total entries to process: {len(data)}")
    os.makedirs(DOCS_DEST_DIR, exist_ok=True)

    success_count = 0
    fail_count = 0
    skip_count = 0
    cleaned_count = 0

    async with SessionLocal() as session:
        # Optional: Cleanup previous run from ShardedTetkikSonuc to avoid duplicates in wrong section
        print("Cleaning up previous run entries from ShardedTetkikSonuc...")
        # Get all filenames from JSON to target them
        all_filenames = [os.path.basename(e.get("file_path", "")) for e in data if e.get("file_path")]
        all_paths = [f"/static/documents/{f}" for f in all_filenames]
        
        # Batch cleanup
        for i in range(0, len(all_paths), 100):
            batch = all_paths[i:i+100]
            stmt = delete(ShardedTetkikSonuc).where(ShardedTetkikSonuc.dosya_yolu.in_(batch))
            res = await session.execute(stmt)
            cleaned_count += res.rowcount
        
        await session.commit()
        print(f"Removed {cleaned_count} existing entries from TetkikSonuc.")

        for idx, entry in enumerate(data):
            patient = await match_patient(session, entry)
            if not patient:
                fail_count += 1
                continue

            file_path_json = entry.get("file_path", "")
            if not file_path_json:
                skip_count += 1
                continue
                
            filename = os.path.basename(file_path_json)
            source_path = os.path.join(DOCS_SOURCE_DIR, filename)
            dest_path = os.path.join(DOCS_DEST_DIR, filename)

            if not os.path.exists(source_path):
                fail_count += 1
                continue

            # Copy file (if not already there)
            if not os.path.exists(dest_path):
                try:
                    shutil.copy2(source_path, dest_path)
                except Exception as e:
                    print(f"[{idx}] Error copying file: {e}")
                    fail_count += 1
                    continue

            # Determine type
            ext = os.path.splitext(filename)[1].lower()
            category = entry.get("category") or "Arşiv"
            
            if ext in IMAGE_EXTENSIONS:
                # Add to Photos (ShardedFotografArsivi)
                new_rec = ShardedFotografArsivi(
                    hasta_id=patient.id,
                    tarih=datetime.now(),
                    asama="Arşiv",
                    etiketler=category,
                    dosya_adi=entry.get("file_name", filename),
                    dosya_yolu=f"/static/documents/{filename}",
                    notlar=f"Arşivden Aktarıldı: {category}"
                )
            else:
                # Add to Archive Documents (HastaDosya)
                new_rec = HastaDosya(
                    hasta_id=patient.id,
                    tarih=datetime.now().date(),
                    dosya_tipi=ext[1:].upper() if ext else "FILE",
                    kategori=category,
                    dosya_adi=entry.get("file_name", filename),
                    dosya_yolu=f"/static/documents/{filename}",
                    aciklama=f"Arşivden Aktarıldı",
                    kaynak="ARSIV"
                )
            
            session.add(new_rec)
            success_count += 1
            
            if success_count % 50 == 0:
                await session.commit()
                print(f"Processed {success_count} files...")

        await session.commit()

    print(f"\nImport Finished!")
    print(f"Success: {success_count}")
    print(f"Failed: {fail_count}")
    print(f"Skipped: {skip_count}")

if __name__ == "__main__":
    asyncio.run(import_docs())
