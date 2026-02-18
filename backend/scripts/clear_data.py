import asyncio
import sys
import os

# Add path to import app modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text
from app.db.session import SessionLocal

async def clear_database():
    print("WARNING: This will delete ALL patient-related data. Tables will remain.")
    confirm = input("Type 'DELETE' to confirm: ")
    if confirm != "DELETE":
        print("Operation cancelled.")
        return

    async with SessionLocal() as session:
        try:
            # Order matters due to Foreign Keys. Delete children first.
            tables_to_clear = [
                # Sharded Clinical
                "clinical.sharded_clinical_muayeneler",
                "clinical.sharded_clinical_operasyonlar",
                "clinical.sharded_clinical_notlar",
                "clinical.sharded_clinical_tetkikler",
                "clinical.sharded_clinical_fotograflar",
                "clinical.sharded_clinical_istirahat_raporlari",
                "clinical.sharded_clinical_durum_bildirir_raporlari",
                "clinical.sharded_clinical_tibbi_mudahale_raporlari",
                "clinical.sharded_clinical_trus_biyopsileri",
                "clinical.sharded_clinical_telefon_gorusmeleri",

                # Sharded Finance
                "finance.sharded_finance_islemler",
                "finance.finans_islem_satirlari",
                "finance.finans_odemeler",
                "finance.finans_taksitler",
                "finance.kasa_hareketleri",

                # Legacy Clinical & Lab
                "hasta_notlari",
                "muayeneler",
                "randevular",
                "operasyonlar",
                "planlar",
                "anamnezler",
                "genel_lab_sonuclari",
                "goruntuleme_sonuclari",
                "hasta_dosyalari",
                "hasta_finans_hareketleri",
                "idrar_tahlilleri",
                "sperm_analizleri",
                "urodinamiler",
                "ekip_uyeleri",

                # Core Patient Records (Last)
                "patient.sharded_patient_demographics",
                "hastalar",
                
                # Audit Logs
                "audit_logs"
            ]

            for table in tables_to_clear:
                print(f"Clearing table: {table}...")
                await session.execute(text(f"TRUNCATE TABLE {table} RESTART IDENTITY CASCADE"))
            
            await session.commit()
            print("All patient data cleared successfully.")

        except Exception as e:
            await session.rollback()
            print(f"Error clearing database: {e}")

if __name__ == "__main__":
    asyncio.run(clear_database())
