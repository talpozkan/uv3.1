import asyncio
import sys
import os

# Add parent directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.db.session import SessionLocal
from app.repositories.patient_repository import PatientRepository

async def delete_target_patients():
    async with SessionLocal() as session:
        patient_repo = PatientRepository(session)
        target_ids = [1391, 1388]
        
        for pid in target_ids:
            print(f"Attempting to delete patient {pid}...")
            patient = await patient_repo.get(pid)
            if patient:
                print(f"Found patient: {patient.ad} {patient.soyad} (ID: {patient.id})")
                try:
                    await patient_repo.remove(pid)
                    print(f"Successfully deleted patient {pid}")
                except Exception as e:
                    print(f"Error deleting patient {pid}: {e}")
            else:
                print(f"Patient {pid} not found.")

if __name__ == "__main__":
    asyncio.run(delete_target_patients())
