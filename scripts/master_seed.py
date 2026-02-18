
import asyncio
import json
import os
import sys
import csv
from datetime import datetime

# Add the project directory to sys.path
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
BACKEND_DIR = os.path.dirname(SCRIPT_DIR)
sys.path.append(BACKEND_DIR)

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select, text
from app.core.config import settings
from app.models.system import SystemSetting, ICDTani, IlacTanim, SablonTanim
from app.models.user import User
from app.core.security import get_password_hash
from app.db.session import SessionLocal

# Import sharded models to initialize SQLAlchemy relationships correctly
try:
    from app.repositories.patient.models import ShardedPatientDemographics
    from app.repositories.clinical.models import ShardedMuayene, ShardedOperasyon, ShardedClinicalNote, ShardedTetkikSonuc
    from app.models.appointment import Randevu
    from app.models.finance import FinansIslem, FinansOdeme, Kasa
    from app.models.audit import AuditLog
except ImportError as e:
    print(f"Warning: Some sharded models could not be imported: {e}")

# --- PATHS ---
DATA_IMPORT_DIR = os.path.join(os.path.dirname(BACKEND_DIR), "03.db_import")
DRUGS_SEED_PATH = os.path.join(SCRIPT_DIR, 'drugs_seed.json')
ILAC_LISTESI_PATH = os.path.join(SCRIPT_DIR, 'ilac_listesi.json')
OP_SABLON_PATH = os.path.join(DATA_IMPORT_DIR, 'Op_Sablon.csv')

# --- HELPERS ---
def load_json(path):
    if os.path.exists(path):
        with open(path, 'r', encoding='utf-8') as f:
            return json.load(f)
    return None

async def seed_users(session: AsyncSession):
    print(">>> Seeding users...")
    
    # 1. Handle potential username conflict (Move 'alp' username if it belongs to another email)
    await session.execute(text("UPDATE users SET username = email WHERE username = 'alp' AND email != 'alp@urolog.net.tr'"))
    await session.commit()
    
    # Define users to seed
    users_to_seed = [
        {
            "username": "alp",
            "full_name": "Alp Ozkan",
            "email": "alp@urolog.net.tr",
            "password": "Terlik90",
            "is_superuser": True,
            "role": "DOCTOR"
        }
    ]
    
    for u_data in users_to_seed:
        # Now we can safely check and update/create by email
        stmt = select(User).where(User.email == u_data["email"])
        result = await session.execute(stmt)
        existing_user = result.scalar_one_or_none()
        
        if not existing_user:
            new_user = User(
                username=u_data["username"],
                full_name=u_data["full_name"],
                email=u_data["email"],
                hashed_password=get_password_hash(u_data["password"]),
                is_superuser=u_data["is_superuser"],
                role=u_data["role"],
                is_active=True
            )
            session.add(new_user)
            print(f"  User created: {u_data['email']}")
        else:
            # Update existing user
            existing_user.username = u_data["username"]
            existing_user.full_name = u_data["full_name"]
            existing_user.hashed_password = get_password_hash(u_data["password"])
            existing_user.is_superuser = u_data["is_superuser"]
            print(f"  User updated: {u_data['email']}")
            
    await session.commit()
    print("✅ Users synchronized.")

async def upsert_system_definitions(session: AsyncSession):
    print(">>> Upserting system_definitions...")
    
    # 1. Load Drugs Seed for Frontend Search
    drugs_data = load_json(DRUGS_SEED_PATH) or []
    drug_list_strings = [json.dumps(drug, ensure_ascii=False) for drug in drugs_data]
    
    # 2. Load Op Templates from CSV
    op_templates = []
    if os.path.exists(OP_SABLON_PATH):
        try:
            with open(OP_SABLON_PATH, 'r', encoding='cp1254', errors='replace') as f:
                lines = f.readlines()
                start_index = 0
                for i, line in enumerate(lines):
                    if '"#","Item","ANot"' in line:
                        start_index = i + 1
                        break
                
                reader = csv.reader(lines[start_index:])
                for row in reader:
                    if len(row) >= 3:
                        name = row[1].strip()
                        note = row[2].strip()
                        if name and note:
                            op_templates.append(f"{name} | {note}")
            print(f"Loaded {len(op_templates)} op templates.")
        except Exception as e:
            print(f"Error reading Op_Sablon.csv: {e}")
    
    # 3. Get Existing or Create New
    stmt = select(SystemSetting).where(SystemSetting.key == 'system_definitions')
    result = await session.execute(stmt)
    setting = result.scalar_one_or_none()
    
    if setting:
        definitions = json.loads(setting.value)
    else:
        setting = SystemSetting(key='system_definitions', description="Default system definitions")
        session.add(setting)
        definitions = {
            "Doktorlar": ["Dr. Urolog Uzman"],
            "Reçete Şablonları": [],
            "İlaç Listesi": [],
            "Ameliyat Not Şablonları": []
        }

    # Update fields (Preserve existing doctors/templates unless empty)
    if not definitions.get("Doktorlar"):
        definitions["Doktorlar"] = ["Dr. Urolog Uzman"]
    
    definitions["İlaç Listesi"] = drug_list_strings
    definitions["Ameliyat Not Şablonları"] = op_templates
    
    setting.value = json.dumps(definitions, ensure_ascii=False)
    await session.commit()
    print("✅ System definitions synchronized.")

async def seed_ilac_tanimlari(session: AsyncSession):
    print(">>> Seeding ilac_tanimlari (Detailed table)...")
    ilaclar = load_json(ILAC_LISTESI_PATH)
    if not ilaclar:
        print("Skipping ilac_tanimlari: ilac_listesi.json not found.")
        return

    # Clear existing to avoid dupes on fresh setup
    await session.execute(text("TRUNCATE TABLE ilac_tanimlari RESTART IDENTITY CASCADE;"))
    
    count = 0
    batch_size = 500
    for i in range(0, len(ilaclar), batch_size):
        chunk = ilaclar[i:i + batch_size]
        for item in chunk:
            name = item.get("name", "").strip()
            if not name: continue
            
            db_item = IlacTanim(
                name=name,
                barcode=item.get("barcode", "").strip() or None,
                atc_kodu=item.get("atc_kodu", "").strip() or None,
                etkin_madde=item.get("etkin_madde", "").strip() or None,
                firma=item.get("firma", "").strip() or None,
                recete_tipi=item.get("recete_tipi", "Normal").strip(),
                aktif=True
            )
            session.add(db_item)
        await session.flush()
        count += len(chunk)
        print(f"  Inserted {count}/{len(ilaclar)} drugs...")
    
    await session.commit()
    print(f"✅ Loaded {count} drugs into ilac_tanimlari.")

async def seed_icd_tanilar(session: AsyncSession):
    print(">>> Seeding icd_tanilar...")
    
    fallback_json = os.path.join(SCRIPT_DIR, 'icd_fallback.json')
    
    if os.path.exists(fallback_json):
        print(f"Reading ICD from JSON: {fallback_json}")
        await session.execute(text("TRUNCATE TABLE icd_tanilar RESTART IDENTITY CASCADE;"))
        data = load_json(fallback_json)
        count = 0
        for item in data:
            code = item.get('kodu', item.get('code', '')).strip()
            name = item.get('adi', item.get('name', '')).strip()
            if code and name:
                session.add(ICDTani(kodu=code, adi=name, aktif="1", seviye="2"))
                count += 1
            if count % 500 == 0: await session.flush()
        await session.commit()
        print(f"✅ Loaded {count} ICD codes from JSON.")
    else:
        print("⚠️ icd_fallback.json not found. Skipping.")

async def main():
    print(f"=== MASTER SEEDER STARTING AT {datetime.now()} ===")
    async with SessionLocal() as session:
        try:
            await seed_users(session)
            await upsert_system_definitions(session)
            await seed_ilac_tanimlari(session)
            await seed_icd_tanilar(session)
            print("=== MASTER SEEDER COMPLETED SUCCESSFULLY ===")
        except Exception as e:
            print(f"❌ MASTER SEEDER FAILED: {e}")
            await session.rollback()
            raise e

if __name__ == "__main__":
    asyncio.run(main())
