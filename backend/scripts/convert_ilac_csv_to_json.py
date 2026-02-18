"""
İlaç Listesi Dönüştürücü
========================
Bu script, CSV formatındaki ilaç listesini JSON formatına dönüştürür.

Kullanım:
    1. İlaç listesi CSV dosyasını ilac_input.csv olarak kaydedin
    2. python scripts/convert_ilac_csv_to_json.py
    3. Oluşan ilac_listesi.json dosyasını scripts/ klasörüne taşıyın
"""

import csv
import json
import sys
import os

def convert_csv_to_json(csv_content: str, output_path: str):
    """
    CSV içeriğini JSON formatına dönüştürür.
    
    CSV formatı beklentisi:
    ilaç adı;Barkod;ATC Adı;ATC Kodu;Firma Adı
    """
    lines = csv_content.strip().split('\n')
    
    # İlk satırı header olarak al
    if not lines:
        print("HATA: Boş içerik")
        return False
    
    ilaclar = []
    
    # Header satırını atla
    for line in lines[1:]:
        if not line.strip():
            continue
        
        # Satırdaki yeni satır karakterlerini temizle
        line = line.replace('\n', ' ').replace('\r', ' ').strip()
        
        parts = line.split(';')
        if len(parts) < 5:
            continue
        
        name = parts[0].strip().replace('"', '')
        barcode = parts[1].strip() if len(parts) > 1 else ""
        atc_kodu = parts[2].strip() if len(parts) > 2 else ""
        etkin_madde = parts[3].strip() if len(parts) > 3 else ""
        firma = parts[4].strip() if len(parts) > 4 else ""
        recete_tipi = parts[5].strip() if len(parts) > 5 else "Normal"
        
        if not name:
            continue
        
        ilaclar.append({
            "name": name,
            "barcode": barcode,
            "etkin_madde": etkin_madde,
            "atc_kodu": atc_kodu,
            "firma": firma,
            "recete_tipi": recete_tipi
        })
    
    # JSON olarak kaydet
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(ilaclar, f, ensure_ascii=False, indent=2)
    
    print(f"✅ {len(ilaclar)} ilaç JSON olarak kaydedildi: {output_path}")
    return True

def main():
    """
    Ana fonksiyon - stdin'den veya dosyadan CSV okur
    """
    script_dir = os.path.dirname(os.path.abspath(__file__))
    output_path = os.path.join(script_dir, "ilac_listesi.json")
    
    # Komut satırından dosya verilmişse onu oku
    if len(sys.argv) > 1:
        csv_file = sys.argv[1]
        if os.path.exists(csv_file):
            with open(csv_file, 'r', encoding='utf-8-sig') as f:
                csv_content = f.read()
            convert_csv_to_json(csv_content, output_path)
        else:
            print(f"HATA: Dosya bulunamadı: {csv_file}")
            sys.exit(1)
    else:
        print("Kullanım: python convert_ilac_csv_to_json.py <csv_dosyası>")
        print("\nÖrnek:")
        print("  python scripts/convert_ilac_csv_to_json.py ilac_liste.csv")
        sys.exit(1)

if __name__ == "__main__":
    main()
