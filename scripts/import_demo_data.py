import asyncio
import json
import sys
import os
from datetime import datetime
from sqlalchemy import create_engine, text, inspect
from sqlalchemy.orm import sessionmaker

DB_URL = "postgresql://emr_admin:urolog123@db:5432/urolog_db"

def get_columns(engine, table_name):
    inspector = inspect(engine)
    return {col['name'] for col in inspector.get_columns(table_name)}

def import_data():
    print("🔌 Connecting to DB...")
    engine = create_engine(DB_URL)
    Session = sessionmaker(bind=engine)
    session = Session()

    try:
        if not os.path.exists("demo_patients.json"):
            print("❌ demo_patients.json not found!")
            return

        with open("demo_patients.json", "r", encoding="utf-8") as f:
            data = json.load(f)

        # Cache columns to avoid repetitive queries
        cols_cache = {
            "hastalar": get_columns(engine, "hastalar"),
            "randevular": get_columns(engine, "randevular"),
            "muayeneler": get_columns(engine, "muayeneler")
        }
        print(f"Schema columns loaded: { {k: len(v) for k,v in cols_cache.items()} }")

        # 1. Import Patients
        patients = data.get("hastalar", [])
        print(f"📥 Importing {len(patients)} patients...")
        
        valid_cols = cols_cache["hastalar"]
        for p in patients:
            # Manual mappings first
            if "telefon" in p and "cep_tel" in valid_cols and "telefon" not in valid_cols:
                if p["telefon"]: p["cep_tel"] = p["telefon"]
            
            if "eposta" in p and "email" in valid_cols and "eposta" not in valid_cols:
                if p["eposta"]: p["email"] = p["eposta"]

            # Filter keys
            filtered_p = {k: v for k, v in p.items() if k in valid_cols}
            
            keys = list(filtered_p.keys())
            cols_str = ", ".join([f'"{k}"' for k in keys])
            vals_str = ", ".join([f":{k}" for k in keys])
            
            stmt = text(f"INSERT INTO hastalar ({cols_str}) VALUES ({vals_str}) ON CONFLICT (id) DO NOTHING")
            session.execute(stmt, filtered_p)

        # 2. Import Appointments
        appts = data.get("randevular", [])
        print(f"📥 Importing {len(appts)} appointments...")
        valid_cols = cols_cache["randevular"]
        for a in appts:
            if "id" in a: del a["id"] # Let DB generate ID
            filtered_a = {k: v for k, v in a.items() if k in valid_cols and k != "id"}
            keys = list(filtered_a.keys())
            cols_str = ", ".join([f'"{k}"' for k in keys])
            vals_str = ", ".join([f":{k}" for k in keys])
            stmt = text(f"INSERT INTO randevular ({cols_str}) VALUES ({vals_str})")
            session.execute(stmt, filtered_a)

        # 3. Import Exams
        exams = data.get("muayeneler", [])
        print(f"📥 Importing {len(exams)} examinations...")
        valid_cols = cols_cache["muayeneler"]
        for m in exams:
            if "id" in m: del m["id"]
            filtered_m = {k: v for k, v in m.items() if k in valid_cols and k != "id"}
            keys = list(filtered_m.keys())
            cols_str = ", ".join([f'"{k}"' for k in keys])
            vals_str = ", ".join([f":{k}" for k in keys])
            stmt = text(f"INSERT INTO muayeneler ({cols_str}) VALUES ({vals_str})")
            session.execute(stmt, filtered_m)

        session.commit()
        print("✅ Import completed successfully!")

    except Exception as e:
        session.rollback()
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        session.close()

if __name__ == "__main__":
    import_data()
