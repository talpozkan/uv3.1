import os
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

# Load env
load_dotenv()

# Database Config from Env
DB_USER = os.getenv("DB_USER", "emr_admin")
DB_PASSWORD = os.getenv("DB_PASSWORD", "")
DB_NAME = os.getenv("DB_NAME", "urov3_db")
DB_HOST = os.getenv("DB_HOST", "db")
DB_PORT = os.getenv("DB_PORT", "5432")

DATABASE_URL = f"postgresql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"

def apply_indexes():
    engine = create_engine(DATABASE_URL)
    
    commands = [
        # --- patient schema ---
        "CREATE INDEX IF NOT EXISTS idx_patient_created_at ON patient.sharded_patient_demographics (created_at);",
        "CREATE INDEX IF NOT EXISTS idx_patient_ad_soyad ON patient.sharded_patient_demographics (ad, soyad);",
        "CREATE INDEX IF NOT EXISTS idx_patient_protokol_no ON patient.sharded_patient_demographics (protokol_no);",
        "CREATE INDEX IF NOT EXISTS idx_patient_is_deleted ON patient.sharded_patient_demographics (is_deleted);",
        
        # --- clinical schema ---
        # Muayeneler
        "CREATE INDEX IF NOT EXISTS idx_muayene_tarih ON clinical.sharded_clinical_muayeneler (tarih);",
        "CREATE INDEX IF NOT EXISTS idx_muayene_created_at ON clinical.sharded_clinical_muayeneler (created_at);",
        "CREATE INDEX IF NOT EXISTS idx_muayene_is_deleted ON clinical.sharded_clinical_muayeneler (is_deleted);",
        "CREATE INDEX IF NOT EXISTS idx_muayene_tani1 ON clinical.sharded_clinical_muayeneler (tani1);",
        
        # Operasyonlar
        "CREATE INDEX IF NOT EXISTS idx_operasyon_tarih ON clinical.sharded_clinical_operasyonlar (tarih);",
        "CREATE INDEX IF NOT EXISTS idx_operasyon_created_at ON clinical.sharded_clinical_operasyonlar (created_at);",
        
        # Tetkikler
        "CREATE INDEX IF NOT EXISTS idx_tetkik_tarih ON clinical.sharded_clinical_tetkikler (tarih);",
        "CREATE INDEX IF NOT EXISTS idx_tetkik_created_at ON clinical.sharded_clinical_tetkikler (created_at);",
        "CREATE INDEX IF NOT EXISTS idx_tetkik_kategori ON clinical.sharded_clinical_tetkikler (kategori);",
        
        # Randevular (public)
        "CREATE INDEX IF NOT EXISTS idx_randevu_created_at ON public.randevular (created_at);",
        "CREATE INDEX IF NOT EXISTS idx_randevu_start ON public.randevular (start);",
        "CREATE INDEX IF NOT EXISTS idx_randevu_status ON public.randevular (status);",
        "CREATE INDEX IF NOT EXISTS idx_randevu_updated_at ON public.randevular (updated_at);",

        # Performance Composite Indexes
        "CREATE INDEX IF NOT EXISTS idx_muayene_hasta_tarih ON clinical.sharded_clinical_muayeneler (hasta_id, tarih DESC);",
        "CREATE INDEX IF NOT EXISTS idx_muayene_updated_at ON clinical.sharded_clinical_muayeneler (updated_at DESC);",
        "CREATE INDEX IF NOT EXISTS idx_patient_updated_at ON patient.sharded_patient_demographics (updated_at DESC);",
        
        # --- finance schema (if exists) ---
        # Check if finance schema exists before adding indexes
    ]
    
    with engine.connect() as conn:
        print("Applying indexes for dashboard optimization...")
        for cmd in commands:
            try:
                print(f"Executing: {cmd}")
                conn.execute(text(cmd))
                conn.commit()
            except Exception as e:
                print(f"Error executing command: {e}")
                
    print("\n✅ Indexing completed!")

if __name__ == "__main__":
    apply_indexes()
