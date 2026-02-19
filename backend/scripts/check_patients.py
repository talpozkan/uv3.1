import asyncio
import sys
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy import text
from app.core.config import settings

DATABASE_URL = settings.DATABASE_URL

async def check_patient_data():
    print(f"Connecting to DB: {DATABASE_URL}")
    engine = create_async_engine(DATABASE_URL, echo=False)
    
    async with engine.connect() as conn:
        # Check 'hastalar' or 'patients' table, assuming 'hastalar' based on earlier grep
        try:
            result = await conn.execute(text("SELECT count(*) FROM hastalar"))
            count = result.scalar()
            print(f"Count in 'hastalar': {count}")
            
            if count > 0:
                result = await conn.execute(text("SELECT id, ad, soyad, is_deleted FROM hastalar LIMIT 5"))
                rows = result.fetchall()
                print("Sample rows:")
                for row in rows:
                    print(row)
        except Exception as e:
            print(f"Error querying 'hastalar': {e}")
            
        # Also check sharded tables if they exist
        try:
            result = await conn.execute(text("SELECT count(*) FROM patient.demographics"))
            count = result.scalar()
            print(f"Count in 'patient.demographics': {count}")
        except Exception as e:
            print(f"Error querying 'patient.demographics': {e}")

if __name__ == "__main__":
    if sys.platform == 'win32':
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    asyncio.run(check_patient_data())
