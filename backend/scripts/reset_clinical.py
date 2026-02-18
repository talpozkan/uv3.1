import asyncio
import sys
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text
from app.core.config import settings
from app.models.base_class import Base
# Import models so they are registered with Base metadata
from app.repositories.clinical.models import ShardedMuayene, ShardedOperasyon

async def reset_clinical_tables():
    print(f"Connecting to DB: {settings.DATABASE_URL}")
    engine = create_async_engine(settings.DATABASE_URL, echo=True)
    
    async with engine.begin() as conn:
        print("Dropping clinical tables...")
        await conn.execute(text("DROP TABLE IF EXISTS clinical.sharded_clinical_muayeneler CASCADE"))
        await conn.execute(text("DROP TABLE IF EXISTS clinical.sharded_clinical_operasyonlar CASCADE"))
        print("Tables dropped.")
        
    async with engine.begin() as conn:
        print("Recreating tables from SQLAlchemy models...")
        # Create all tables in the metadata (filtered by those we just dropped effectively, 
        # or we can rely on create_all checking existence, but we dropped them so it will create)
        # Note: create_all creates *all* tables. We only want clinical probably.
        # But Base.metadata.create_all is safe if other tables exist.
        await conn.run_sync(Base.metadata.create_all)
        print("Tables recreated.")

if __name__ == "__main__":
    if sys.platform == 'win32':
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    asyncio.run(reset_clinical_tables())
