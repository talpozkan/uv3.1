import asyncio
from sqlalchemy import text
from app.db.session import SessionLocal

async def check():
    async with SessionLocal() as session:
        res = await session.execute(text("""
            SELECT column_name, character_maximum_length 
            FROM information_schema.columns 
            WHERE table_schema = 'clinical' 
            AND table_name = 'sharded_clinical_tetkikler' 
            AND data_type = 'character varying'
        """))
        for col, length in res.fetchall():
            print(f"{col}: {length}")
        
if __name__ == "__main__":
    asyncio.run(check())
