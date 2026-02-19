import asyncio
from sqlalchemy import text
from app.db.session import SessionLocal

async def inspect():
    async with SessionLocal() as session:
        legacy_tables = ['hastalar', 'muayeneler', 'operasyonlar', 'tetkik_sonuclari', 'hasta_notlari', 'finans_islemler']
        for table in legacy_tables:
            res = await session.execute(text(f"SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = '{table}'"))
            cols = [r[0] for r in res.fetchall()]
            print(f"Legacy Table {table}: {cols}")
        
        for schema in ['patient', 'clinical', 'finance']:
            res = await session.execute(text(f"SELECT table_name FROM information_schema.tables WHERE table_schema = '{schema}'"))
            tables = [r[0] for r in res.fetchall()]
            for table in tables:
                res = await session.execute(text(f"SELECT column_name FROM information_schema.columns WHERE table_schema = '{schema}' AND table_name = '{table}'"))
                cols = [r[0] for r in res.fetchall()]
                print(f"Sharded Table {schema}.{table}: {cols}")

if __name__ == "__main__":
    asyncio.run(inspect())
