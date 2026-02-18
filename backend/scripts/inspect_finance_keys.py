import asyncio
from sqlalchemy import text
from app.db.session import SessionLocal

async def check():
    async with SessionLocal() as session:
        res = await session.execute(text("SELECT * FROM public.finans_islemler LIMIT 1"))
        print(res.keys())
        
if __name__ == "__main__":
    asyncio.run(check())
