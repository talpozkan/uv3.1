import asyncio
from sqlalchemy import text
from app.db.session import SessionLocal

async def check():
    async with SessionLocal() as session:
        res = await session.execute(text("SELECT count(*) FROM finans_islemler"))
        print(f"Legacy finans_islemler count: {res.scalar()}")
        
if __name__ == "__main__":
    asyncio.run(check())
