import asyncio
import sys
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text
from app.core.config import settings
from app.models.base_class import Base
from app.repositories.patient.models import ShardedPatientDemographics

DATABASE_URL = settings.DATABASE_URL

async def recreate_patient_table():
    print(f"Connecting to DB: {DATABASE_URL}")
    engine = create_async_engine(DATABASE_URL, echo=True)
    
    async with engine.begin() as conn:
        print("Dropping patient.sharded_patient_demographics...")
        await conn.execute(text("DROP TABLE IF EXISTS patient.sharded_patient_demographics CASCADE"))
        
        print("Creating patient.sharded_patient_demographics...")
        # Since we use Base.metadata, we need to target specifically this table or create all
        # To avoid dropping other tables, we can try creating just this one if possible, 
        # but Base.metadata.create_all is easiest if others exist.
        # But wait, create_all checks persistence. 
        # Since I dropped it, create_all should recreate it.
        await conn.run_sync(Base.metadata.create_all)
        print("Table recreated.")

if __name__ == "__main__":
    if sys.platform == 'win32':
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    asyncio.run(recreate_patient_table())
