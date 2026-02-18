import json
import os
import shutil
import asyncio
import sys
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import text

# Add parent directory to path to import app modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.db.session import SessionLocal
from app.models.documents import HastaDosya
from app.repositories.patient.models import ShardedPatientDemographics

# Paths
JSON_PATH = "../03.db_import/archive_export_v1.json"
DOCS_SOURCE_DIR = "../03.db_import/Documents_Sync"
DOCS_TARGET_DIR = "static/documents"

async def sync_documents():
    print(f"🚀 Starting document sync from {JSON_PATH}")
    
    if not os.path.exists(JSON_PATH):
        print(f"❌ JSON file not found: {JSON_PATH}")
        return

    if not os.path.exists(DOCS_TARGET_DIR):
        os.makedirs(DOCS_TARGET_DIR, exist_ok=True)
        print(f"📁 Created target directory: {DOCS_TARGET_DIR}")

    with open(JSON_PATH, 'r', encoding='utf-8') as f:
        data = json.load(f)

    print(f"📊 Found {len(data)} document entries in JSON.")

    count = 0
    file_copied = 0
    skipped_no_patient = 0
    skipped_no_file = 0
    errors = 0

    async with SessionLocal() as session:
        for entry in data:
            try:
                patient_uuid = entry.get("patient_uuid")
                file_name_original = entry.get("file_name") # e.g. Arsiv_3_1.pdf
                file_path_in_json = entry.get("file_path") # e.g. /static/documents/uuid.pdf
                file_type = entry.get("file_type")
                category = entry.get("category")
                
                if not patient_uuid or not file_path_in_json:
                    continue

                # 1. Extract physical filename from file_path_in_json
                # /static/documents/6fb16ceb-4196-4990-8ce5-ad66935d0bdb.pdf -> 6fb16ceb-4196-4990-8ce5-ad66935d0bdb.pdf
                physical_filename = os.path.basename(file_path_in_json)
                source_file_path = os.path.join(DOCS_SOURCE_DIR, physical_filename)
                target_file_path = os.path.join(DOCS_TARGET_DIR, physical_filename)

                # 2. Check if file exists in source
                if not os.path.exists(source_file_path):
                    # Try case-insensitive or other variations? JSON says PDF, Files are .pdf.
                    # list_dir showed .pdf (lowercase).
                    skipped_no_file += 1
                    continue

                # 3. Verify patient exists in DB
                # Using sharded demographics as the source of truth
                patient_exists = False
                try:
                    res = await session.execute(
                        text("SELECT id FROM patient.sharded_patient_demographics WHERE id = :pid"), 
                        {"pid": patient_uuid}
                    )
                    if res.fetchone():
                        patient_exists = True
                except Exception as e:
                    print(f"Error checking patient: {e}")
                    pass

                if not patient_exists:
                    skipped_no_patient += 1
                    continue

                # 4. Copy file if not already there
                if not os.path.exists(target_file_path):
                    shutil.copy2(source_file_path, target_file_path)
                    file_copied += 1

                # 5. Create HastaDosya record if not already exists
                # Check for existing record for this patient and this file_path
                stmt_check = select(HastaDosya).where(
                    HastaDosya.hasta_id == patient_uuid,
                    HastaDosya.dosya_yolu == file_path_in_json
                )
                res_check = await session.execute(stmt_check)
                if res_check.scalars().first():
                    # Already imported
                    continue

                new_doc = HastaDosya(
                    hasta_id=patient_uuid,
                    tarih=datetime.now(), # Or extract from filename if possible? Arsiv entries usually don't have dates in this JSON
                    dosya_tipi=file_type,
                    kategori=category,
                    dosya_adi=file_name_original, # The user-friendly name
                    dosya_yolu=file_path_in_json, # The path used by the app to serve
                    kaynak="ARSIV"
                )
                session.add(new_doc)
                count += 1

                if count % 100 == 0:
                    await session.commit()
                    print(f"⏳ Processed {count} records, {file_copied} files copied...")

            except Exception as e:
                print(f"❌ Error processing entry {entry.get('file_id')}: {e}")
                errors += 1

        await session.commit()

    print("\n✨ Sync Completed!")
    print(f"✅ New records added: {count}")
    print(f"📂 Files copied: {file_copied}")
    print(f"👥 Skipped (No patient in DB): {skipped_no_patient}")
    print(f"📄 Skipped (Source file missing): {skipped_no_file}")
    print(f"⚠️ Errors: {errors}")

if __name__ == "__main__":
    asyncio.run(sync_documents())
