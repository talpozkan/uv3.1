import asyncio
import sys
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text
from app.core.config import settings

DATABASE_URL = settings.DATABASE_URL

async def inspect_hastalar():
    print(f"Connecting to DB: {DATABASE_URL}")
    engine = create_async_engine(DATABASE_URL, echo=False)
    
    async with engine.connect() as conn:
        try:
            # Check values for boolean conversion
            res = await conn.execute(text("SELECT distinct sms_izin FROM hastalar LIMIT 10"))
            print("sms_izin values:", res.fetchall())
            
            res = await conn.execute(text("SELECT distinct email_izin FROM hastalar LIMIT 10"))
            print("email_izin values:", res.fetchall())
        except Exception as e:
            print(f"Error inspecting 'hastalar': {e}")

if __name__ == "__main__":
    if sys.platform == 'win32':
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    asyncio.run(inspect_hastalar())
