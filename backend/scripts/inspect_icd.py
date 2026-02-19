
import pandas as pd
import sys

file_path = "/Users/alp/Documents/antigravity/UroLog_v2.0/03.db_import/ICD 10.xls"

try:
    # Try reading with pandas (engine='xlrd' for .xls, 'openpyxl' for .xlsx usually, but .xls needs xlrd)
    # If it fails, I'll report it.
    df = pd.read_excel(file_path)
    print("Columns:", df.columns.tolist())
    print("First 5 rows:")
    print(df.head().to_dict('records'))
except Exception as e:
    print(f"Error reading excel: {e}")
