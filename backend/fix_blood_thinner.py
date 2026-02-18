"""
Kan Sulandırıcı Düzeltme Script'i (Docker Safe)
---------------------------------
Tüm kayıtları sıfırlayıp, bilinen kan sulandırıcı ilaçları içerenleri
otomatk olarak tespit edip işaretler. Environment variables kullanır.
"""

import os
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

# Load env from file if exists (for local testing)
load_dotenv()

# Database Config from Env
DB_USER = os.getenv("DB_USER", "emr_admin")
DB_PASSWORD = os.getenv("DB_PASSWORD", "")
DB_NAME = os.getenv("DB_NAME", "urov3_db")
DB_HOST = os.getenv("DB_HOST", "db")
DB_PORT = os.getenv("DB_PORT", "5432")

# Sync Database URL for fix script
DATABASE_URL = f"postgresql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"

# Bilinen kan sulandırıcı ilaçlar (case-insensitive arama yapılacak)
BLOOD_THINNERS = [
    # Aspirin türevleri
    "aspirin", "ecoprin", "cospirin", "coraspin", "asprin", "asa",
    "cardioaspirin", "dispirin", "ecotrin",
    
    # Warfarin türevleri
    "coumadin", "kumadin", "warfarin", "marevan", "jantoven",
    
    # Clopidogrel türevleri
    "plavix", "clopidogrel", "klopidogrel", "iscover", "plagrel",
    
    # Diğer antikoagülanlar
    "marcumar", "sintrom", "eliquis", "xarelto", "pradaxa",
    "rivaroxaban", "apixaban", "dabigatran", "edoxaban",
    "heparin", "clexane", "enoxaparin", "fragmin", "innohep",
    
    # Ticagrelor
    "brilinta", "ticagrelor",
    
    # Prasugrel
    "effient", "prasugrel",
    
    # Dipiridamol
    "persantine", "aggrenox", "dipiridamol",
]

def fix_blood_thinner():
    print(f"Connecting to database at {DB_HOST}:{DB_PORT}...")
    engine = create_engine(DATABASE_URL)
    
    with engine.connect() as conn:
        # 1. Mevcut durumu raporla
        print("\n=== MEVCUT DURUM ===")
        try:
            result = conn.execute(text("""
                SELECT kan_sulandirici, COUNT(*) 
                FROM clinical.sharded_clinical_muayeneler 
                GROUP BY kan_sulandirici
            """))
            for row in result:
                print(f"  kan_sulandirici = {row[0]}: {row[1]} kayıt")
        except Exception as e:
            print(f"Error checking status: {e}")
        
        # 2. Tüm kayıtları 0'a sıfırla
        print("\n=== ADIM 1: Tüm kayıtlar sıfırlanıyor... ===")
        result = conn.execute(text("""
            UPDATE clinical.sharded_clinical_muayeneler 
            SET kan_sulandirici = 0
        """))
        conn.commit()
        print(f"  {result.rowcount} kayıt sıfırlandı.")
        
        # 3. Kan sulandırıcı ilaçları içerenleri tespit et ve işaretle
        print("\n=== ADIM 2: Kan sulandırıcı içeren kayıtlar işaretleniyor... ===")
        
        # ILIKE ile case-insensitive arama için pattern oluştur
        patterns = " OR ".join([f"LOWER(kullandigi_ilaclar) LIKE '%{drug.lower()}%'" for drug in BLOOD_THINNERS])
        
        query = f"""
            UPDATE clinical.sharded_clinical_muayeneler 
            SET kan_sulandirici = 1
            WHERE kullandigi_ilaclar IS NOT NULL 
              AND kullandigi_ilaclar != ''
              AND ({patterns})
        """
        
        result = conn.execute(text(query))
        conn.commit()
        print(f"  {result.rowcount} kayıt kan sulandırıcı olarak işaretlendi.")
        
        # 4. Sonucu raporla
        print("\n=== DÜZELTME SONRASI DURUM ===")
        result = conn.execute(text("""
            SELECT kan_sulandirici, COUNT(*) 
            FROM clinical.sharded_clinical_muayeneler 
            GROUP BY kan_sulandirici
        """))
        for row in result:
            print(f"  kan_sulandirici = {row[0]}: {row[1]} kayıt")

if __name__ == "__main__":
    print("=" * 60)
    print("KAN SULANDIRICI DÜZELTME SCRİPTİ (PRODUCTION)")
    print("=" * 60)
    fix_blood_thinner()
    print("\n✅ Düzeltme tamamlandı!")
