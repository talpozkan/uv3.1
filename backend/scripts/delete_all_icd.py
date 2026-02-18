import asyncio
import os
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy import text
from sqlalchemy.orm import sessionmaker

# App imports
import sys
sys.path.append(os.path.join(os.getcwd(), "backend"))
from app.core.config import settings

async def delete_all_icd_codes():
    # Use the same logic as the app to determine DB host
    db_url = settings.DATABASE_URL
    print(f"Connecting to: {db_url}")
    
    engine = create_async_engine(db_url)
    async_session = sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)
    
    async with async_session() as session:
        print("Deleting all ICD codes from icd_tanilar table...")
        try:
            # Using raw SQL for direct deletion
            result = await session.execute(text("DELETE FROM icd_tanilar"))
            await session.commit()
            print(f"Successfully deleted ICD codes. Rows affected: {result.rowcount}")
        except Exception as e:
            print(f"An error occurred: {e}")
            await session.rollback()

if __name__ == "__main__":
    asyncio.run(delete_all_icd_codes())
