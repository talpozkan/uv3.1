
import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import text
import uuid

# URL from root .env with localhost:5441
DB_URL = "postgresql+asyncpg://emr_admin:huyKd4iNjG4ACwiQ897uZeZFCA3fnBab2T@localhost:5441/V3_lokal_db"

async def debug_db():
    engine = create_async_engine(DB_URL)
    Session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    async with Session() as db:
        print("Checking tables...")
        # Check all patients in sharded demographics
        res = await db.execute(text("SELECT id, ad, soyad FROM patient.sharded_patient_demographics"))
        patients = res.all()
        print(f"Total patients in patient.sharded_patient_demographics: {len(patients)}")
        for p in patients:
            print(f"  ID: {p[0]} ({type(p[0])}), Name: {p[1]} {p[2]}")
            
        print("\nChecking if any patient is deleted...")
        res = await db.execute(text("SELECT id FROM patient.sharded_patient_demographics WHERE is_deleted = True"))
        deleted = res.all()
        print(f"Deleted patients: {len(deleted)}")

if __name__ == "__main__":
    asyncio.run(debug_db())
