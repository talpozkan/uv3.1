import asyncio
import hashlib
import json
from decimal import Decimal
from datetime import date, datetime
from sqlalchemy import text
from app.db.session import SessionLocal

def normalize_val(val):
    if val is None:
        return ""
    if isinstance(val, bool):
        return str(val).lower()
    if hasattr(val, 'isoformat'):
        s = val.isoformat()
        if 'T00:00:00' in s:
            return s.split('T')[0]
        return s
    return str(val).strip()

def calculate_row_hash(row_dict, exclude_fields=None):
    if exclude_fields is None:
        exclude_fields = ['id', 'created_at', 'updated_at', 'uuid']
        
    clean_data = {k: v for k, v in row_dict.items() if k not in exclude_fields}
    sorted_keys = sorted(clean_data.keys())
    
    hash_input = ""
    for k in sorted_keys:
        val = clean_data[k]
        
        if k in ['sms_izin', 'email_izin']:
            if val is None:
                val = False
            elif val == 'Evet':
                val = True
            
        val_str = normalize_val(val)
        hash_input += f"{k}:{val_str}|"
    
    return hashlib.sha256(hash_input.encode('utf-8')).hexdigest()

async def run_integrity_check(table_name, schema='public'):
    async with SessionLocal() as session:
        # 1. Create verification table if not exists
        await session.execute(text("""
            CREATE TABLE IF NOT EXISTS migration_verification (
                id SERIAL PRIMARY KEY,
                source_table VARCHAR(100),
                source_id VARCHAR(100),
                hash_value VARCHAR(64),
                calculated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """))
        await session.commit()
        
        # 2. Fetch rows
        print(f"Calculating hashes for {schema}.{table_name}...")
        res = await session.execute(text(f"SELECT * FROM {schema}.{table_name}"))
        rows = res.fetchall()
        keys = res.keys()
        
        count = 0
        for row in rows:
            row_dict = dict(zip(keys, row))
            row_hash = calculate_row_hash(row_dict)
            
            source_id = str(row_dict.get('id', 'unknown'))
            
            # 3. Store in verification table
            await session.execute(text("""
                INSERT INTO migration_verification (source_table, source_id, hash_value)
                VALUES (:table, :id, :hash)
            """), {"table": table_name, "id": source_id, "hash": row_hash})
            
            count += 1
            if count % 500 == 0:
                print(f"Processed {count} rows...")
        
        await session.commit()
        print(f"✅ Completed. Total {count} hashes stored for {table_name}.")

if __name__ == "__main__":
    import sys
    table = sys.argv[1] if len(sys.argv) > 1 else 'hastalar'
    schema = sys.argv[2] if len(sys.argv) > 2 else 'public'
    asyncio.run(run_integrity_check(table, schema=schema))
