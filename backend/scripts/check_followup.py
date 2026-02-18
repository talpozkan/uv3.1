import asyncio
import sys
import os

# Add the parent directory to sys.path to allow importing app modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text
from app.db.session import SessionLocal

async def check_data():
    async with SessionLocal() as session:
        try:
            print(f"Connected to DB: {session.bind.url}")
            print("-" * 30)
            
            # List all tables
            print("MEVCUT TABLOLAR (PostgreSQL):")
            result = await session.execute(text(
                "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name"
            ))
            tables = result.scalars().all()
            
            for i, table in enumerate(tables, 1):
                # Optional: Count rows for each table
                count_res = await session.execute(text(f"SELECT COUNT(*) FROM {table}"))
                count = count_res.scalar()
                print(f"{i}. {table} ({count} kayıt)")
            
            print("-" * 30)

        except Exception as e2:
            print(f"Postgres check failed: {e2}")

if __name__ == "__main__":
    asyncio.run(check_data())
