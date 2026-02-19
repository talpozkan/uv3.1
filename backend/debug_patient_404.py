
import asyncio
from app.api import deps
from sqlalchemy.ext.asyncio import AsyncSession
from app.controllers.legacy_adapters.patient_controller import PatientController
from app.core.user_context import UserContext
from app.db.session import SessionLocal

async def debug_patient_lookup():
    async with SessionLocal() as db:
        context = UserContext(user_id=1, username="debug")
        controller = PatientController(db, context)
        
        print("Listing patients...")
        patients = await controller.get_patients(limit=10)
        if not patients:
            print("No patients found in list.")
            return
            
        for p in patients:
            print(f"Found patient in list: {p.ad} {p.soyad} (ID: {p.id})")
            
            # Now try to get this specific patient
            print(f"Trying to get profile for ID: {p.id}...")
            profile = await controller.get_patient_profile(p.id)
            if profile:
                print(f"Successfully found profile for {profile.ad} {profile.soyad}")
            else:
                print(f"FAILED to find profile for ID {p.id}")

if __name__ == "__main__":
    asyncio.run(debug_patient_lookup())
