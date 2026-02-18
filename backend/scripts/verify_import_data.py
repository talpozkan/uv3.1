import csv
import os
import sys

DATA_DIR = "/data_import/data_source/Exports CSV"

def get_clean_csv_lines(path):
    with open(path, mode='r', encoding='cp1254', errors='replace') as f:
        lines = f.readlines()
    
    start_idx = 0
    for i, line in enumerate(lines):
        if line.strip().startswith('"#"'):
            start_idx = i
            break
    
    return [l for l in lines[start_idx:] if l.strip()]

def verify_ids():
    hasta_path = os.path.join(DATA_DIR, "HASTA.CSV")
    muayene_path = os.path.join(DATA_DIR, "MUAYENE.CSV")
    
    print("Reading HASTA.CSV...")
    h_lines = get_clean_csv_lines(hasta_path)
    h_reader = csv.DictReader(h_lines, quotechar='"')
    
    hasta_ids = set()
    for row in h_reader:
        if row.get("HastaRecID"):
            try:
                hasta_ids.add(int(row.get("HastaRecID")))
            except:
                pass
                
    print(f"Total Unique Patients in HASTA.CSV: {len(hasta_ids)}")
    
    print("Reading MUAYENE.CSV...")
    m_lines = get_clean_csv_lines(muayene_path)
    m_reader = csv.DictReader(m_lines, quotechar='"')
    
    muayene_patient_ids = set()
    muayene_record_ids = set()
    total_muayene = 0
    duplicates = 0
    
    for row in m_reader:
        if row.get("HastaRecID"):
            try:
                pid = int(row.get("HastaRecID"))
                mid = int(row.get("MRecID"))
                
                if mid in muayene_record_ids:
                    duplicates += 1
                muayene_record_ids.add(mid)
                
                muayene_patient_ids.add(pid)
                total_muayene += 1
            except:
                pass
                
    print(f"Total Examinations in MUAYENE.CSV: {total_muayene}")
    print(f"Unique Muayene IDs: {len(muayene_record_ids)}")
    print(f"Duplicate MRecIDs found: {duplicates}")
    print(f"Unique Patient IDs referenced: {len(muayene_patient_ids)}")
    
    # Intersection
    common_ids = hasta_ids.intersection(muayene_patient_ids)
    missing_ids = muayene_patient_ids - hasta_ids
    
    print("-" * 30)
    print(f"MATCHING IDs: {len(common_ids)}")
    print(f"MISSING IDs (Patients in Muayene but NOT in Hasta): {len(missing_ids)}")
    print("-" * 30)
    
    if len(common_ids) < 50:
        print("Detailed Matches (HastaRecID):", sorted(list(common_ids)))

if __name__ == "__main__":
    verify_ids()
