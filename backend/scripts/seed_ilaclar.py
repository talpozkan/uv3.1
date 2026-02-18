"""
İlaç Listesi Seed Script
========================
Bu script, ilac_listesi.json dosyasındaki ilaçları veritabanına yükler.
Yeni bir kurulumda veya ilaç veritabanını güncellemek için kullanılır.

Kullanım:
    python -m scripts.seed_ilaclar

Veya Docker içinden:
    docker compose exec backend python -m scripts.seed_ilaclar
"""

import asyncio
import sys
import os
import json

# Add the parent directory to sys.path to resolve app imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.db.session import SessionLocal
from sqlalchemy import text

# JSON dosyasının yolu
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
JSON_PATH = os.path.join(SCRIPT_DIR, "ilac_listesi.json")

async def seed_ilaclar(clear_existing: bool = True):
    """
    İlaç tanımlarını veritabanına yükler.
    
    Args:
        clear_existing: True ise mevcut ilaçları siler ve yeniden yükler
    """
    print(f"İlaç verileri yükleniyor: {JSON_PATH}")
    
    if not os.path.exists(JSON_PATH):
        print(f"HATA: Dosya bulunamadı: {JSON_PATH}")
        return False
    
    # JSON dosyasını oku
    with open(JSON_PATH, 'r', encoding='utf-8') as f:
        ilaclar = json.load(f)
    
    print(f"Toplam {len(ilaclar)} ilaç bulundu.")
    
    async with SessionLocal() as db:
        if clear_existing:
            print("Mevcut ilaç tanımları temizleniyor...")
            await db.execute(text("TRUNCATE TABLE ilac_tanimlari RESTART IDENTITY;"))
            await db.commit()
        
        count = 0
        batch_size = 500
        batch_values = []
        
        for item in ilaclar:
            name = item.get("name", "").strip()
            if not name:
                continue
            
            barcode = item.get("barcode", "").strip() or None
            atc_kodu = item.get("atc_kodu", "").strip() or None
            etkin_madde = item.get("etkin_madde", "").strip() or None
            firma = item.get("firma", "").strip() or None
            recete_tipi = item.get("recete_tipi", "Normal").strip()
            
            batch_values.append({
                "name": name,
                "barcode": barcode,
                "atc_kodu": atc_kodu,
                "etkin_madde": etkin_madde,
                "firma": firma,
                "recete_tipi": recete_tipi,
                "aktif": True
            })
            
            if len(batch_values) >= batch_size:
                insert_sql = text("""
                    INSERT INTO ilac_tanimlari (name, barcode, atc_kodu, etkin_madde, firma, recete_tipi, aktif)
                    VALUES (:name, :barcode, :atc_kodu, :etkin_madde, :firma, :recete_tipi, :aktif)
                """)
                for vals in batch_values:
                    await db.execute(insert_sql, vals)
                await db.commit()
                count += len(batch_values)
                print(f"  {count} ilaç yüklendi...")
                batch_values = []
        
        # Kalan batch'i kaydet
        if batch_values:
            insert_sql = text("""
                INSERT INTO ilac_tanimlari (name, barcode, atc_kodu, etkin_madde, firma, recete_tipi, aktif)
                VALUES (:name, :barcode, :atc_kodu, :etkin_madde, :firma, :recete_tipi, :aktif)
            """)
            for vals in batch_values:
                await db.execute(insert_sql, vals)
            await db.commit()
            count += len(batch_values)
        
        print(f"\n✅ Toplam {count} ilaç başarıyla yüklendi.")
        return True

async def main():
    """Ana fonksiyon"""
    import argparse
    
    parser = argparse.ArgumentParser(description='İlaç tanımlarını veritabanına yükle')
    parser.add_argument('--no-clear', action='store_true', 
                       help='Mevcut verileri silmeden ekle')
    args = parser.parse_args()
    
    success = await seed_ilaclar(clear_existing=not args.no_clear)
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    asyncio.run(main())
