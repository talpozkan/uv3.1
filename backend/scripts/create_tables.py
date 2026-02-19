import asyncio
import sys
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text
from app.core.config import settings
from app.models.base_class import Base

# Import models to register them with Base.metadata
from app.repositories.patient.models import ShardedPatientDemographics
# Add others if needed later
from app.repositories.clinical.models import ShardedMuayene, ShardedOperasyon

DATABASE_URL = settings.DATABASE_URL

async def create_tables():
    print(f"Connecting to DB: {DATABASE_URL}")
    engine = create_async_engine(DATABASE_URL, echo=True)
    
    async with engine.begin() as conn:
        print("Creating schemas...")
        await conn.execute(text("CREATE SCHEMA IF NOT EXISTS patient"))
        await conn.execute(text("CREATE SCHEMA IF NOT EXISTS clinical"))
        await conn.execute(text("CREATE SCHEMA IF NOT EXISTS finance"))
        
        print("Creating tables...")
        await conn.run_sync(Base.metadata.create_all)
        print("Tables created.")

if __name__ == "__main__":
    if sys.platform == 'win32':
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    asyncio.run(create_tables())
