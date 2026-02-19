import asyncio
from app.db.session import SessionLocal
from app.services.orchestrators.patient_orchestrator import PatientOrchestrator
from app.core.user_context import UserContext

async def test_orchestrator():
    async with SessionLocal() as session:
        from sqlalchemy import text
        # Get valid user
        u_res = await session.execute(text("SELECT id FROM public.users LIMIT 1"))
        user_id = u_res.scalar()
        print(f"Testing with User ID: {user_id}")
        
        # Create a dummy context
        context = UserContext(user_id=user_id, username="admin")
        orchestrator = PatientOrchestrator(session, context)
        
        # Get valid patient
        res = await session.execute(text("SELECT id FROM patient.sharded_patient_demographics LIMIT 1"))
        patient_id = res.scalar()
        print(f"Testing with Patient ID: {patient_id}")
        
        profile = await orchestrator.get_patient_full_profile(patient_id)
        print("Profile Keys:", profile.keys())
        print("Sample Data:", {k: profile[k] for k in ['ad', 'soyad', 'son_muayene_tarihi'] if k in profile})

if __name__ == "__main__":
    asyncio.run(test_orchestrator())
