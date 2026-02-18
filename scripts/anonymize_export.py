import asyncio
import json
import random
import uuid
from datetime import datetime, date
import sys
import os
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

# ----------------- CONFIGURATION -----------------
# Local DB Connection (Docker)
DB_URL = "postgresql://emr_admin:urolog123@localhost:5440/urolog_db"

FAKE_NAMES = [
    ("Ahmet", "Yılmaz"), ("Mehmet", "Kaya"), ("Ayşe", "Demir"), ("Fatma", "Çelik"), 
    ("Mustafa", "Yıldız"), ("Zeynep", "Kara"), ("Ali", "Koç"), ("Hatice", "Öztürk"),
    ("İbrahim", "Şahin"), ("Elif", "Kurt")
]

FAKE_CITIES = ["İstanbul", "Ankara", "İzmir", "Bursa", "Antalya"]

MEDICAL_SCENARIOS = [
    {
        "sikayet": "İdrarda yanma ve sık idrara çıkma.",
        "hikaye": "3 gündür devam eden dizüri ve pollakiüri. Ateş yok.",
        "tani": "N39.0 - İdrar Yolu Enfeksiyonu",
        "plan": "Antibiyotik tedavisi başlandı, bol su içmesi önerildi.",
        "not": "Kontrol 1 hafta sonra."
    },
    {
        "sikayet": "Sağ yan ağrısı.",
        "hikaye": "Ani başlayan sağ lomber ağrı. Anamnezde taş öyküsü var.",
        "tani": "N20.0 - Böbrek Taşı",
        "plan": "BT istendi. Analjezik verildi.",
        "not": "Taş düşürme takibi."
    },
    {
        "sikayet": "İdrar yapmada zorlanma.",
        "hikaye": "Son aylarda artan obstrüktif semptomlar. Gece kalkma 2-3 kez.",
        "tani": "N40 - Benign Prostat Hiperplazisi",
        "plan": "Alfa bloker tedavisi başlandı. PSA bakılacak.",
        "not": "IPSS skoru 18."
    }
]

# ----------------- SCRIPT -----------------

def get_random_tckn():
    return str(random.randint(10000000000, 99999999999))

def get_random_phone():
    return "905" + str(random.randint(300000000, 599999999))

class DateEncoder(json.JSONEncoder):
    """JSON Encoder for datetime objects"""
    def default(self, obj):
        if isinstance(obj, (datetime, date)):
            return obj.isoformat()
        return super().default(obj)

def run_export():
    print("🔌 Connecting to DB...")
    engine = create_engine(DB_URL)
    Session = sessionmaker(bind=engine)
    session = Session()

    try:
        # 1. Select 5 random patient IDs
        print("🎲 Selecting 5 random patients...")
        res = session.execute(text("SELECT id FROM hastalar ORDER BY RANDOM() LIMIT 5"))
        patient_ids = [row[0] for row in res]
        
        if not patient_ids:
            print("❌ No patients found!")
            return

        export_data = {
            "hastalar": [],
            "randevular": [],
            "muayeneler": []
        }

        print(f"📋 Processing patients: {patient_ids}")

        for pid in patient_ids:
            # --- FETCH & ANONYMIZE PATIENT ---
            p_res = session.execute(text(f"SELECT * FROM hastalar WHERE id = '{pid}'"))
            p_row = p_res.fetchone()
            p_dict = dict(p_row._mapping)
            
            # Anonymize
            fname, lname = random.choice(FAKE_NAMES)
            p_dict["ad"] = fname
            p_dict["soyad"] = lname
            p_dict["tc_kimlik"] = get_random_tckn()
            p_dict["telefon"] = get_random_phone()
            p_dict["adres"] = f"{random.choice(FAKE_CITIES)} Merkez"
            p_dict["eposta"] = f"{fname.lower()}.{lname.lower()}@example.com"
            p_dict["yakin_telefon"] = get_random_phone()
            p_dict["avatar"] = None # Clear avatar
            
            # New ID to avoid collision on target (though we export associated data too)
            # Actually, let's keep UUID but careful on insert. User said "dump".
            # We will use the same UUIDs in JSON but Import script handles conflict or we clear target?
            # User said "add to system". So existing IDs might clash.
            # I will Generate NEW UUIDs for everything.
            
            old_pid = p_dict["id"]
            new_pid = str(uuid.uuid4())
            p_dict["id"] = new_pid
            
            export_data["hastalar"].append(p_dict)

            # --- FETCH & ANONYMIZE RELATED DATA ---
            
            # Appointments
            a_res = session.execute(text(f"SELECT * FROM randevular WHERE hasta_id = '{old_pid}'"))
            appointments = [dict(row._mapping) for row in a_res]
            for appt in appointments:
                appt["id"] = str(uuid.uuid4()) # New ID
                appt["hasta_id"] = new_pid
                appt["title"] = f"{fname} {lname} - Kontrol"
                # Keep date/status/doctor_id (assuming doctor exists or handled)
                export_data["randevular"].append(appt)

            # Examinations (Muayeneler)
            m_res = session.execute(text(f"SELECT * FROM muayeneler WHERE hasta_id = '{old_pid}'"))
            exams = [dict(row._mapping) for row in m_res]
            
            for exam in exams:
                exam["id"] = str(uuid.uuid4())
                exam["hasta_id"] = new_pid
                
                # Synthesize Medical Data
                scenario = random.choice(MEDICAL_SCENARIOS)
                exam["sikayet"] = scenario["sikayet"]
                exam["hikaye"] = scenario["hikaye"]
                exam["tani"] = scenario["tani"]
                exam["plan"] = scenario["plan"]
                exam["ozsoy_notu"] = scenario["sikayet"] # Legacy field often used
                # Clear raw data
                exam["muayene_notu"] = scenario["not"]
                
                export_data["muayeneler"].append(exam)

        # 3. Export to JSON
        with open("demo_patients.json", "w", encoding="utf-8") as f:
            json.dump(export_data, f, cls=DateEncoder, ensure_ascii=False, indent=2)
            
        print(f"✅ Exported 5 patients to demo_patients.json")

    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        session.close()

if __name__ == "__main__":
    run_export()
