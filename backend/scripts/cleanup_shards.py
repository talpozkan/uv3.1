import asyncio
from sqlalchemy import text
from app.db.session import SessionLocal

async def cleanup():
    async with SessionLocal() as session:
        print("Dropping sharded tables...")
        tables = [
            ("patient", "sharded_patient_demographics"),
            ("clinical", "sharded_clinical_muayeneler"),
            ("clinical", "sharded_clinical_operasyonlar"),
            ("clinical", "sharded_clinical_notlar"),
            ("clinical", "sharded_clinical_tetkikler"),
            ("clinical", "sharded_clinical_fotograflar"),
            ("clinical", "sharded_clinical_telefon_gorusmeleri"),
            ("clinical", "sharded_clinical_istirahat_raporlari"),
            ("clinical", "sharded_clinical_durum_bildirir_raporlari"),
            ("clinical", "sharded_clinical_tibbi_mudahale_raporlari"),
            ("clinical", "sharded_clinical_trus_biyopsileri"),
            ("finance", "sharded_finance_islemler")
        ]
        
        for schema, table in tables:
            try:
                await session.execute(text(f"DROP TABLE IF EXISTS {schema}.{table} CASCADE"))
                print(f"Dropped {schema}.{table}")
            except Exception as e:
                print(f"Error dropping {schema}.{table}: {e}")
        
        await session.commit()
        print("Cleanup complete.")

if __name__ == "__main__":
    asyncio.run(cleanup())
