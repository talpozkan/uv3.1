#!/usr/bin/env python3
import asyncio
import gzip
import re
import sys
import os
from datetime import datetime
from typing import Dict, List, Any
from dateutil import parser as date_parser
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

# Config
BACKUP_PATH = "/tmp/urolog_db_2025-12-30_14-11.sql.gz"
DATABASE_URL = "postgresql+asyncpg://emr_admin:2XdNsB*VjTuhDGyE8wNNoa@db:5432/urolog_db"

DATE_COLUMNS = ['tarih', 'dogum_tarihi', 'baslangic_tarihi', 'bitis_tarihi', 'kontrol_tarihi']
DATETIME_COLUMNS = ['created_at', 'updated_at', 'start', 'end']

def parse_copy_block(lines: List[str], start_idx: int) -> tuple:
    header_line = lines[start_idx]
    match = re.match(r'COPY public\.(\w+) \(([^)]+)\) FROM stdin;', header_line)
    if not match:
        return None, None, [], start_idx + 1
    
    table_name = match.group(1)
    columns = [c.strip().strip('"') for c in match.group(2).split(',')]
    
    data_rows = []
    idx = start_idx + 1
    while idx < len(lines) and lines[idx].strip() != '\\.' and not lines[idx].startswith('COPY '):
        if lines[idx].strip():
            data_rows.append(lines[idx].rstrip('\n'))
        idx += 1
    
    return table_name, columns, data_rows, idx + 1

def parse_row(row: str, num_columns: int) -> List[str]:
    values = row.split('\t')
    while len(values) < num_columns:
        values.append('\\N')
    return values[:num_columns]

def convert_value(val: str, col_name: str = None) -> Any:
    if val == '\\N' or val == '' or val is None:
        return None
    val = val.replace('\\n', '\n').replace('\\r', '\r').replace('\\t', '\t')
    if col_name:
        if col_name in DATE_COLUMNS:
            try: return date_parser.parse(val).date()
            except: return None
        elif col_name in DATETIME_COLUMNS:
            try: return date_parser.parse(val)
            except: return None
    return val

async def main():
    print("Starting Appointment Import...")
    
    # 1. Read Backup
    if not os.path.exists(BACKUP_PATH):
        print(f"Error: Backup file not found at {BACKUP_PATH}")
        return

    with gzip.open(BACKUP_PATH, 'rt', encoding='utf-8', errors='replace') as f:
        content = f.read()
    lines = content.split('\n')
    
    # 2. Parse Tables
    tables_data = {}
    idx = 0
    while idx < len(lines):
        if lines[idx].startswith('COPY public.'):
            table_name, columns, data_rows, next_idx = parse_copy_block(lines, idx)
            if table_name in ['hastalar', 'randevular']:
                tables_data[table_name] = {'columns': columns, 'rows': data_rows}
            idx = next_idx
        else:
            idx += 1
            
    if 'hastalar' not in tables_data or 'randevular' not in tables_data:
        print("Required tables not found in backup.")
        return

    # 3. Create Mapping (old_id -> protokol_no)
    old_id_to_proto = {}
    h_cols = tables_data['hastalar']['columns']
    id_idx = h_cols.index('id')
    proto_idx = h_cols.index('protokol_no')
    
    for row in tables_data['hastalar']['rows']:
        vals = parse_row(row, len(h_cols))
        old_id_to_proto[int(vals[id_idx])] = vals[proto_idx]

    # 4. Connect to DB and get (protokol_no -> UUID) mapping
    engine = create_async_engine(DATABASE_URL)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    id_mapping = {} # old_id -> UUID
    
    async with async_session() as session:
        result = await session.execute(text("SELECT id, protokol_no FROM hastalar"))
        for row in result:
            uuid_str, proto = str(row[0]), row[1]
            # Find old_id for this proto
            for old_id, p in old_id_to_proto.items():
                if p == proto:
                    id_mapping[old_id] = uuid_str
                    break
        
        print(f"Mapped {len(id_mapping)} patients out of {len(old_id_to_proto)} in backup.")

        # 5. Import Appointments
        r_cols = tables_data['randevular']['columns']
        hasta_id_idx = r_cols.index('hasta_id')
        
        print(f"Importing {len(tables_data['randevular']['rows'])} appointments...")
        
        count = 0
        skipped = 0
        for row in tables_data['randevular']['rows']:
            vals = parse_row(row, len(r_cols))
            old_h_id = vals[hasta_id_idx]
            
            if old_h_id == '\\N':
                new_h_id = None
            else:
                try:
                    new_h_id = id_mapping.get(int(old_h_id))
                    if not new_h_id:
                        skipped += 1
                        continue
                except:
                    skipped += 1
                    continue
            
            # Prepare insert
            insert_cols = []
            insert_vals = []
            for i, col in enumerate(r_cols):
                if col in ['id', 'doctor_id']: continue # Skip id and doctor_id (FK mismatch)
                if col == 'hasta_id':
                    val = new_h_id
                else:
                    val = convert_value(vals[i], col)
                    # Cast integer columns
                    if col in ['is_deleted'] and val is not None:
                        try:
                            val = int(val)
                        except:
                            val = 0
                
                if val is not None:
                    insert_cols.append(col)
                    insert_vals.append(val)
            
            placeholders = ', '.join([f':p{i}' for i in range(len(insert_cols))])
            cols_str = ', '.join([f'"{c}"' for c in insert_cols])
            params = {f'p{i}': v for i, v in enumerate(insert_vals)}
            
            try:
                await session.execute(text(f'INSERT INTO randevular ({cols_str}) VALUES ({placeholders})'), params)
                count += 1
                if count % 100 == 0:
                    await session.commit()
            except Exception as e:
                print(f"Error inserting row: {e}")
                await session.rollback()
                skipped += 1
                
        await session.commit()
    
    print(f"Finished: {count} imported, {skipped} skipped.")

if __name__ == "__main__":
    asyncio.run(main())
