
import asyncio
import time
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from app.repositories.system_repository import SystemRepository

DATABASE_URL = "postgresql+asyncpg://emr_admin:secure_password@localhost:5440/urolog_db"

async def test_performance():
    engine = create_async_engine(DATABASE_URL, echo=False)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    queries = ["A00", "Biyokimya", "Kolera", "T", "Agri", "Hastalik"]
    
    async with async_session() as session:
        repo = SystemRepository(session)
        
        print("--- Warming up ---")
        await repo.search_icd("Test", 10)
        
        print("--- Starting Benchmark ---")
        start_total = time.time()
        
        for q in queries:
            t0 = time.time()
            res = await repo.search_icd(q, 10)
            dur = (time.time() - t0) * 1000
            print(f"Query: '{q}' -> {len(res)} results in {dur:.2f} ms")
            
        print(f"Total time for {len(queries)} queries: {(time.time() - start_total)*1000:.2f} ms")
        
    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(test_performance())
