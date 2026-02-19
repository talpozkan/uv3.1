
from sqlalchemy import create_engine, text
import os
from collections import Counter

# Database URL from .env
DATABASE_URL = "postgresql://emr_admin:EiQ1pgMr5o2Xyo%2BcBgFnb4urHPlfg%2FVT@localhost:5441/V3_lokal_db"

def check_blood_thinner_stats():
    engine = create_engine(DATABASE_URL)
    with engine.connect() as conn:
        result = conn.execute(text("SELECT kan_sulandirici, COUNT(*) FROM clinical.sharded_clinical_muayeneler GROUP BY kan_sulandirici"))
        print("\n--- Kan Sulandırıcı İstatistikleri ---")
        for row in result:
            print(f"Değer: {row[0]} | Adet: {row[1]}")

        # Let's check a sample of patients where it is 1 to see if we can spot patterns (e.g. no used drugs)
        print("\n--- Örnek Kayıtlar (kan_sulandirici = 1) ---")
        result = conn.execute(text("""
            SELECT id, hasta_id, kullandigi_ilaclar, kan_sulandirici 
            FROM clinical.sharded_clinical_muayeneler 
            WHERE kan_sulandirici = 1 
            LIMIT 10
        """))
        for row in result:
            print(f"ID: {row[0]}, İlaçlar: {row[2]}, KS: {row[3]}")

if __name__ == "__main__":
    check_blood_thinner_stats()
