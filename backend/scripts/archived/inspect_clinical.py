import asyncio
import sys
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text
from app.core.config import settings

DATABASE_URL = settings.DATABASE_URL

async def inspect_clinical_tables():
    print(f"Connecting to DB: {DATABASE_URL}")
    engine = create_async_engine(DATABASE_URL, echo=False)
    
    async with engine.connect() as conn:
        tables = ["muayene", "ameliyatlar", "randevular"] # Guessing common names based on turkish context urology
        # actually grep showed 'Muayene', 'Operasyon' models mapping to tables. 
        # Typically sqlalchemy models default to lowercase or specifically named.
        # Let's list all tables first to be sure.
        
        print("Listing all tables...")
        result = await conn.execute(text("""
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public'
        """))
        all_tables = [row[0] for row in result.fetchall()]
        print(all_tables)
        
        # Now inspect columns of likely candidates
        targets = ["muayeneler", "operasyonlar"]
        
        for t in targets:
            print(f"\nColumns in '{t}':")
            cols = await conn.execute(text(f"SELECT * FROM {t} LIMIT 1"))
            print(list(cols.keys()))

if __name__ == "__main__":
    if sys.platform == 'win32':
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    asyncio.run(inspect_clinical_tables())
