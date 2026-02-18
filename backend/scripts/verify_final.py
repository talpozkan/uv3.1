import asyncio
import os
import sys
from sqlalchemy import text

# Add parent directory to path to import app modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.db.session import SessionLocal

async def verify_final_counts():
    async with SessionLocal() as session:
        r_hasta = await session.execute(text("SELECT COUNT(*) FROM hastalar"))
        c_hasta = r_hasta.scalar()
        
        r_muayene = await session.execute(text("SELECT COUNT(*) FROM muayeneler"))
        c_muayene = r_muayene.scalar()
        
        print(f"Final Patient Count: {c_hasta}")
        print(f"Final Examination Count: {c_muayene}")

if __name__ == "__main__":
    asyncio.run(verify_final_counts())
