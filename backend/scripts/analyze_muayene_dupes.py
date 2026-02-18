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

def analyze_duplicates():
    csv_path = os.path.join(DATA_DIR, "MUAYENE.CSV")
    print("Reading MUAYENE.CSV to analyze duplicates...")
    
    lines = get_clean_csv_lines(csv_path)
    reader = csv.DictReader(lines, quotechar='"')
    
    # Key: (HastaRecID, Tarih) -> List of rows
    records = {}
    
    for i, row in enumerate(reader):
        try:
            if not row.get("HastaRecID"): continue
            
            h_id = row.get("HastaRecID")
            tarih = row.get("Tarih")
            
            key = (h_id, tarih)
            
            if key not in records:
                records[key] = []
            records[key].append(row)
        except:
            pass
            
    duplicates = [k for k, v in records.items() if len(v) > 1]
    
    print(f"Total Unique (Patient, Date) pairs: {len(records)}")
    print(f"Pairs with multiple records (Duplicates): {len(duplicates)}")
    
    total_skipped = 0
    for k in duplicates:
        count = len(records[k])
        total_skipped += (count - 1)
        # Show first 5 examples
        if total_skipped <= 5:
            print(f"-- Duplicate for Patient {k[0]} on {k[1]}: {count} records")
            
    print(f"Total records that would be skipped with strict (Patient, Date) check: {total_skipped}")

if __name__ == "__main__":
    analyze_duplicates()
