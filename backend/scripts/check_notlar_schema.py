import asyncio
from sqlalchemy import text
from app.db.session import SessionLocal

async def check():
    async with SessionLocal() as session:
        res = await session.execute(text("""
            SELECT column_name, data_type, character_maximum_length 
            FROM information_schema.columns 
            WHERE table_schema = 'clinical' 
            AND table_name = 'sharded_clinical_notlar'
        """))
        for row in res.fetchall():
            print(row)
        
if __name__ == "__main__":
    asyncio.run(check())
