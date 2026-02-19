import json
import random
from datetime import datetime
from sqlalchemy import create_engine, select, text
from sqlalchemy.orm import sessionmaker
import sys
import os

# Add parent directory to sys.path to import app
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.config import settings
from app.models.patient import Hasta
from app.models.clinical import Muayene
from app.models.system import SystemSetting

# Setup DB Connection
in_docker = os.path.exists('/.dockerenv')
db_host = settings.DB_HOST if in_docker else "localhost"
db_port = settings.DB_PORT if in_docker else "5440"

from urllib.parse import quote_plus
password = quote_plus(settings.DB_PASSWORD)
database_url = f"postgresql://{settings.DB_USER}:{password}@{db_host}:{db_port}/{settings.DB_NAME}"

engine = create_engine(database_url)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def main():
    session = SessionLocal()
    try:
        print("Starting protocol number generation (Yearly Sequential)...")
        
        # 1. Fetch Year Codes
        res = session.execute(text("SELECT value FROM system_settings WHERE key = 'protocol_year_codes'"))
        row = res.first()
        year_codes = {}
        if row:
            try:
                year_codes = json.loads(row[0])
            except: pass
        
        # 2. Fetch all patients and their first muayene date
        patients = session.query(Hasta).all()
        print(f"Found {len(patients)} patients.")
        
        # Group by year
        patients_by_year = {} # year -> list of (date, patient)
        
        for p in patients:
            # Check first muayene
            first_exam = session.query(Muayene).filter(Muayene.hasta_id == p.id).order_by(Muayene.tarih.asc()).first()
            date_to_use = first_exam.tarih if first_exam and first_exam.tarih else (p.created_at or datetime.now())
            
            if hasattr(date_to_use, 'year'):
                year = date_to_use.year
            else:
                try:
                    year = datetime.fromisoformat(str(date_to_use)).year
                except:
                    year = datetime.now().year
            
            if year not in patients_by_year:
                patients_by_year[year] = []
            patients_by_year[year].append((date_to_use, p))
            
        ALLOWED_CHARS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'J', 'K', 'L', 'M', 'N', 'P', 'R', 'S', 'T', 'U', 'V', 'Y', 'Z']
        updated_settings = False
        updated_count = 0
        
        # 3. Assign sequential numbers for each year
        for year in sorted(patients_by_year.keys()):
            year_str = str(year)
            if year_str not in year_codes:
                c1, c2 = random.choice(ALLOWED_CHARS), random.choice(ALLOWED_CHARS)
                year_codes[year_str] = f"{c1}{c2}"
                updated_settings = True
            
            code = year_codes[year_str]
            last_digit = year_str[-1]
            
            # Sort patients of this year by date
            # Using (date, id) for stable sort
            p_list = patients_by_year[year]
            p_list.sort(key=lambda x: (x[0].isoformat() if hasattr(x[0], 'isoformat') else str(x[0]), x[1].id))
            
            for i, (dt, p) in enumerate(p_list, 1):
                # Format: CODE + Y + SEQ(4)
                protocol_no = f"{code}{last_digit}{i:04d}"
                if p.protokol_no != protocol_no:
                    p.protokol_no = protocol_no
                    updated_count += 1
        
        if updated_settings:
            session.execute(
                text("INSERT INTO system_settings (key, value, description) VALUES ('protocol_year_codes', :val, 'Year mapping') "
                     "ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value"),
                {"val": json.dumps(year_codes)}
            )
            
        session.commit()
        print(f"Successfully updated protocol numbers for {updated_count} patients (Total: {len(patients)}).")

    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        session.close()

if __name__ == "__main__":
    main()
