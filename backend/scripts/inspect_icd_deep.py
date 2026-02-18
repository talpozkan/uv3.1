
import pandas as pd
import re

file_path = "/Users/alp/Documents/antigravity/UroLog_v2.0/03.db_import/ICD 10.xls"

try:
    df = pd.read_excel(file_path, header=None)
    print("Total rows:", len(df))
    
    # Iterate and find rows that look like ICD codes
    # Pattern: generic ICD is like A00 or A00.0
    
    found_count = 0
    for index, row in df.iterrows():
        # Check first few columns for code
        row_str = " | ".join([str(x) for x in row.values if pd.notna(x)])
        
        # Look for code in first column usually
        col0 = str(row[0]).strip() if pd.notna(row[0]) else ""
        col1 = str(row[1]).strip() if pd.notna(row[1]) else ""
        
        if re.match(r'^[A-Z]\d{2}(\.\d+)?$', col0) or re.match(r'^[A-Z]\d{2}(\.\d+)?$', col1):
            if found_count < 10:
                print(f"Row {index}: {row_str}")
            found_count += 1
            
    print(f"Total potential ICD rows found: {found_count}")

except Exception as e:
    print(f"Error: {e}")
