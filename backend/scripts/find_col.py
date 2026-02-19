import asyncio
from sqlalchemy import text
from app.db.session import SessionLocal

async def check():
    async with SessionLocal() as session:
        res = await session.execute(text("SELECT table_schema, table_name FROM information_schema.columns WHERE column_name = 'referans'"))
        print(res.fetchall())
        
if __name__ == "__main__":
    asyncio.run(check())
