import asyncio
from uuid import UUID
from app.db.session import SessionLocal
from app.services.orchestrators.patient_orchestrator import PatientOrchestrator
from app.services.orchestrators.clinical_orchestrator import ClinicalOrchestrator

async def verify():
    async with SessionLocal() as db:
        patient_orch = PatientOrchestrator(db)
        clinical_orch = ClinicalOrchestrator(db)
        
        # 1. Verify get_multi (Patient List)
        patients = await patient_orch.get_multi(limit=5)
        print("\n--- Patient List (Top 5) ---")
        for p in patients:
            print(f"ID: {p['id']}, Name: {p['ad']} {p['soyad']}, Protokol: {p.get('protokol_no')}, Phone: {p.get('cep_tel')}")
        
        if patients:
            patient_id = patients[0]['id']
            # 2. Verify Full Profile
            profile = await patient_orch.get_patient_full_profile(patient_id)
            print(f"\n--- Patient Profile ({patient_id}) ---")
            print(f"Name: {profile['ad']} {profile['soyad']}, Last Exam: {profile['son_muayene_tarihi']}")
            
            # 3. Verify Clinical History
            history = await clinical_orch.get_patient_clinical_history(patient_id)
            print(f"\n--- Clinical History ---")
            print(f"Exams count: {len(history.get('examinations', []))}")
            print(f"Ops count: {len(history.get('operations', []))}")
            print(f"Notes count: {len(history.get('notes', []))}")
            print(f"Tetkikler (Imagings) count: {len(history.get('imagings', []))}")
            print(f"Tetkikler (Labs) count: {len(history.get('labs', []))}")

if __name__ == "__main__":
    asyncio.run(verify())
