import gzip
import re

input_file = "../03.db_import/db_2026-02-02_13-14.sql.gz"
output_file = "../03.db_import/prepared_import.sql"

print(f"Processing {input_file} -> {output_file}...")

with gzip.open(input_file, 'rt', encoding='utf-8') as f_in, open(output_file, 'w', encoding='utf-8') as f_out:
    # Prepend schema creation
    f_out.write("CREATE SCHEMA IF NOT EXISTS legacy_import;\n")
    f_out.write("SET search_path TO legacy_import;\n")
    
    for line in f_in:
        # Replace explicit public schema references
        # Be careful not to break standard PG stuff like public.geometry if it exists (but usually postgis)
        # Our dump showed "CREATE TABLE public.hastalar"
        
        # Regex to replace "public." with "legacy_import." but only when it looks like a table/sequence/view
        # Simplest safe approach for this specific dump structure:
        new_line = line.replace("public.", "legacy_import.")
        
        # Also remove any "SET search_path" that might reset it to public
        if "SET search_path" in new_line and "pg_catalog" not in new_line:
             new_line = "SET search_path = legacy_import;\n"
             
        # Filter out "DROP SCHEMA public" or "CREATE SCHEMA public" if they exist
        if "SCHEMA public" in new_line:
            new_line = "-- " + new_line
            
        # Filter out 'alembic_version' to avoid confusion? No, let it be in legacy_import.
        
        f_out.write(new_line)

print("Done. Ready to import into 'legacy_import' schema.")
