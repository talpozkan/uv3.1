import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text
from app.core.config import settings

async def reset_database():
    pd = settings.DATABASE_URL.replace("postgresql+asyncpg://", "postgresql://")
    engine = create_async_engine(settings.DATABASE_URL, isolation_level="AUTOCOMMIT")
    
    confirm = input("Are you sure you want to DROP ALL tables and types? This cannot be undone. (yes/no): ")
    if confirm.lower() != "yes":
        print("Aborted.")
        return

    async with engine.connect() as conn:
        print("Dropping public schema...")
        await conn.execute(text("DROP SCHEMA public CASCADE;"))
        await conn.execute(text("CREATE SCHEMA public;"))
        await conn.execute(text("GRANT ALL ON SCHEMA public TO public;"))
        await conn.execute(text("GRANT ALL ON SCHEMA public TO emr_admin;"))
        
        print("Dropping custom schemas (patient, clinical, finance)...")
        await conn.execute(text("DROP SCHEMA IF EXISTS patient CASCADE;"))
        await conn.execute(text("DROP SCHEMA IF EXISTS clinical CASCADE;"))
        await conn.execute(text("DROP SCHEMA IF EXISTS finance CASCADE;"))
        
        print("All schemas dropped. You can now run 'alembic upgrade head'.")

if __name__ == "__main__":
    asyncio.run(reset_database())
