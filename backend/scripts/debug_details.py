import asyncio
import sys
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from app.core.config import settings
from app.controllers.legacy_adapters.patient_adapter import PatientLegacyAdapter
from app.core.user_context import UserContext
from uuid import UUID

DATABASE_URL = settings.DATABASE_URL
PATIENT_ID = "ce97f30f-a206-4641-8d23-5abd30d07c0e"

async def debug_details():
    print(f"Connecting to DB: {DATABASE_URL}")
    engine = create_async_engine(DATABASE_URL, echo=False)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    async with async_session() as db:
        print("Initializing Adapter...")
        context = UserContext(user_id=1, username="admin")
        adapter = PatientLegacyAdapter(db, context)
        
        print(f"Fetching patient {PATIENT_ID}...")
        try:
            patient = await adapter.get_patient_by_id(UUID(PATIENT_ID))
            print("Success!")
            print(patient)
        except Exception as e:
            print("Error occurred:")
            import traceback
            traceback.print_exc()

if __name__ == "__main__":
    if sys.platform == 'win32':
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    asyncio.run(debug_details())
