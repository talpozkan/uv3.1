
import asyncio
import os
import sys

# Add backend to path
sys.path.append(os.path.join(os.getcwd(), 'backend'))

from sqlalchemy import select, func
from app.db.session import SessionLocal
from app.repositories.patient.models import ShardedPatientDemographics
from app.api.v1.endpoints.patients import _build_advanced_search_query

async def debug_advanced_search():
    async with SessionLocal() as db:
        # Test with no filters
        base_stmt = _build_advanced_search_query(
            None, None, None, None, None, None, None, None, None, None, None, None, None, None
        )
        
        # Count
        count_stmt = select(func.count()).select_from(base_stmt.subquery())
        total_count = await db.scalar(count_stmt)
        print(f"Total patients (no filter): {total_count}")
        
        # Get IDs
        result = await db.execute(base_stmt.limit(5))
        ids = [row[0] for row in result.all()]
        print(f"Sample IDs: {ids}")
        
        if ids:
            # Test with a filter that should match one of these
            # Let's get the ad/soyad of the first one
            p_stmt = select(ShardedPatientDemographics).where(ShardedPatientDemographics.id == ids[0])
            p_res = await db.execute(p_stmt)
            p = p_res.scalars().first()
            print(f"First patient: {p.ad} {p.soyad}")

if __name__ == "__main__":
    asyncio.run(debug_advanced_search())
