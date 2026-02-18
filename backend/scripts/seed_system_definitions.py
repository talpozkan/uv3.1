
import asyncio
import json
import os
import sys

# Add parent directory to path to allow importing app modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select
from app.core.config import settings
from app.repositories.setting_repository import SettingRepository
from app.schemas.setting import SystemSettingCreate

# Path to drugs_seed.json
# In docker container, we will place it at /app/drugs_seed.json or /app/scripts/drugs_seed.json
DRUGS_SEED_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'drugs_seed.json')
if not os.path.exists(DRUGS_SEED_PATH):
    DRUGS_SEED_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'drugs_seed.json')

async def seed_system_definitions():
    print("Starting system definitions seed...")
    
    # Read drugs seed
    try:
        with open(DRUGS_SEED_PATH, 'r', encoding='utf-8') as f:
            drugs_data = json.load(f)
            print(f"Loaded {len(drugs_data)} drugs from seed file.")
    except Exception as e:
        print(f"Error reading drugs_seed.json: {e}")
        return

    # Convert drug objects to list of JSON strings as expected by the frontend
    drug_list_strings = [json.dumps(drug, ensure_ascii=False) for drug in drugs_data]

    # Create system definitions object
    system_definitions = {
        "Doktorlar": [],
        "Reçete Şablonları": [],
        "İlaç Listesi": drug_list_strings
    }

    # Connect to DB
    engine = create_async_engine(settings.DATABASE_URL, echo=True)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as session:
        repo = SettingRepository(session)
        
        # Check if exists
        existing = await repo.get("system_definitions")
        if existing:
            print("system_definitions key already exists.")
            # We might want to update it only if it's empty or force update?
            # For now, let's just update it to ensure it has the drugs.
            # But be careful not to overwrite existing doctors/templates if they exist.
            existing_val = json.loads(existing.value)
            
            if "Doktorlar" not in existing_val:
                existing_val["Doktorlar"] = []
            if "Reçete Şablonları" not in existing_val:
                existing_val["Reçete Şablonları"] = []
            
            # Update Drug List (Overwrite or Append? Overwrite is safer to ensure consistency with seed)
            existing_val["İlaç Listesi"] = drug_list_strings
            
            await repo.create_or_update(
                key="system_definitions",
                value=json.dumps(existing_val, ensure_ascii=False),
                description="System definitions including drugs, doctors, and templates"
            )
            print("Updated system_definitions.")
        else:
            print("Creating new system_definitions...")
            await repo.create_or_update(
                key="system_definitions",
                value=json.dumps(system_definitions, ensure_ascii=False),
                description="System definitions including drugs, doctors, and templates"
            )
            print("Created system_definitions.")

    await engine.dispose()
    print("Done.")

if __name__ == "__main__":
    asyncio.run(seed_system_definitions())
