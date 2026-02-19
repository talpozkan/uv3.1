import asyncio
import sys
import os

# Add the parent directory to sys.path to allow importing from app
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.db.session import SessionLocal
from app.models.clinical import TetkikSonuc
from sqlalchemy import or_, update

async def update_psa_units():
    print("Starting PSA unit update...")
    async with SessionLocal() as session:
        # Find all PSA records
        # Variations: 'PSA', 'PSA (Total)', 'PSA Total', 'Total PSA'
        # Exclude Free PSA
        
        psa_variations = ['PSA', 'PSA (Total)', 'PSA Total', 'Total PSA']
        
        stmt = (
            update(TetkikSonuc)
            .where(
                or_(*[TetkikSonuc.tetkik_adi.ilike(v) for v in psa_variations])
            )
            .where(TetkikSonuc.tetkik_adi.notilike('%free%'))
            .where(TetkikSonuc.tetkik_adi.notilike('%serbest%'))
            .where(TetkikSonuc.tetkik_adi.notilike('%ratio%'))
            .where(TetkikSonuc.tetkik_adi.notilike('%oran%'))
            .values(birim='ng/mL')
        )
        
        result = await session.execute(stmt)
        await session.commit()
        
        print(f"Updated {result.rowcount} records. Units set to 'ng/mL'.")

if __name__ == "__main__":
    asyncio.run(update_psa_units())
