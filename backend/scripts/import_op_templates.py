import csv
import json
import os
import sys

# Add the project root to sys.path to import app modules if needed
project_root = "/Users/alp/Documents/antigravity/UroLog_v2.0"
sys.path.append(os.path.join(project_root, "backend"))

from sqlalchemy import select
from app.db.session import SessionLocal
from app.models.system import SystemSetting

CSV_PATH = "/Users/alp/Documents/antigravity/UroLog_v2.0/03.db_import/TOP.CSV"

async def import_templates():
    templates = []
    
    # Try reading with cp1254 (Turkish Windows)
    try:
        with open(CSV_PATH, 'r', encoding='cp1254', errors='replace') as f:
            lines = f.readlines()
            start_index = 0
            for i, line in enumerate(lines):
                if '"#","Item","ANot"' in line:
                    start_index = i + 1
                    break
            
            reader = csv.reader(lines[start_index:])
            for row in reader:
                if len(row) >= 3:
                    name = row[1].strip()
                    note = row[2].strip()
                    if name and note:
                        templates.append(f"{name} | {note}")
    except Exception as e:
        print(f"Error reading CSV: {e}")
        return

    print(f"Found {len(templates)} templates.")

    async with SessionLocal() as session:
        # Get existing system_definitions
        stmt = select(SystemSetting).where(SystemSetting.key == 'system_definitions')
        result = await session.execute(stmt)
        setting = result.scalar_one_or_none()

        if setting:
            try:
                definitions = json.loads(setting.value)
            except:
                definitions = {}
        else:
            setting = SystemSetting(key='system_definitions')
            session.add(setting)
            definitions = {}

        # Update Ameliyat Not Şablonları
        definitions['Ameliyat Not Şablonları'] = templates
        setting.value = json.dumps(definitions, ensure_ascii=False)
        
        await session.commit()
        print("Successfully updated Ameliyat Not Şablonları in database.")

if __name__ == "__main__":
    import asyncio
    asyncio.run(import_templates())
