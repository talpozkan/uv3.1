
import asyncio
from sqlalchemy import text
from app.db.session import SessionLocal

async def check_patients():
    async with SessionLocal() as db:
        print("Checking ShardedPatientDemographics (patient.sharded_patient_demographics)...")
        res = await db.execute(text("SELECT id, ad, soyad, is_deleted FROM patient.sharded_patient_demographics"))
        rows = res.all()
        for row in rows:
            print(f"ID: {row[0]}, Name: {row[1]} {row[2]}, Deleted: {row[3]}")
        
        print("\nChecking Legacy Patients (hastalar)...")
        # Check if table exists first
        try:
            res = await db.execute(text("SELECT id, ad, soyad FROM hastalar"))
            rows = res.all()
            for row in rows:
                print(f"ID: {row[0]}, Name: {row[1]} {row[2]}")
        except Exception as e:
            print(f"Table 'hastalar' might not exist: {e}")

if __name__ == "__main__":
    asyncio.run(check_patients())
