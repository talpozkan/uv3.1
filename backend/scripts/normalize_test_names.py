#!/usr/bin/env python3
"""
Migration script to normalize existing test names in the database.
- Converts Turkish characters to English equivalents
- Converts all test names to uppercase

Run with: python normalize_test_names.py
"""

import asyncio
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv('/Users/alp/Documents/antigravity/Urolog_v2.4/UroLog/backend/.env')

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import text

DATABASE_URL = os.getenv("DATABASE_URL", "").replace("postgresql://", "postgresql+asyncpg://")
engine = create_async_engine(DATABASE_URL, echo=False)
AsyncSessionLocal = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

# Turkish to English character mapping
TURKISH_MAP = {
    'ç': 'c', 'Ç': 'C', 'ğ': 'g', 'Ğ': 'G',
    'ı': 'i', 'İ': 'I', 'ö': 'o', 'Ö': 'O',
    'ş': 's', 'Ş': 'S', 'ü': 'u', 'Ü': 'U'
}

def normalize_turkish(text_val: str) -> str:
    """Normalize Turkish characters and convert to uppercase."""
    if not text_val:
        return text_val
    for tr_char, en_char in TURKISH_MAP.items():
        text_val = text_val.replace(tr_char, en_char)
    return text_val.upper()


async def migrate_tetkik_sonuclari():
    """Migrate tetkik_sonuclari table."""
    async with AsyncSessionLocal() as session:
        # Get all records with tetkik_adi
        result = await session.execute(
            text("SELECT id, tetkik_adi FROM tetkik_sonuclari WHERE tetkik_adi IS NOT NULL")
        )
        rows = result.fetchall()
        
        updated_count = 0
        for row in rows:
            record_id, old_name = row
            new_name = normalize_turkish(old_name)
            
            if old_name != new_name:
                await session.execute(
                    text("UPDATE tetkik_sonuclari SET tetkik_adi = :new_name WHERE id = :id"),
                    {"new_name": new_name, "id": record_id}
                )
                updated_count += 1
                print(f"  Updated: '{old_name}' -> '{new_name}'")
        
        await session.commit()
        print(f"\n✅ tetkik_sonuclari: {updated_count} records updated")
        return updated_count


async def migrate_goruntuleme_sonuclari():
    """Migrate goruntuleme_sonuclari table."""
    async with AsyncSessionLocal() as session:
        # Get all records with tetkik_adi
        result = await session.execute(
            text("SELECT id, tetkik_adi FROM goruntuleme_sonuclari WHERE tetkik_adi IS NOT NULL")
        )
        rows = result.fetchall()
        
        updated_count = 0
        for row in rows:
            record_id, old_name = row
            new_name = normalize_turkish(old_name)
            
            if old_name != new_name:
                await session.execute(
                    text("UPDATE goruntuleme_sonuclari SET tetkik_adi = :new_name WHERE id = :id"),
                    {"new_name": new_name, "id": record_id}
                )
                updated_count += 1
                if updated_count <= 20:  # Only print first 20 for brevity
                    print(f"  Updated: '{old_name}' -> '{new_name}'")
        
        await session.commit()
        print(f"\n✅ goruntuleme_sonuclari: {updated_count} records updated")
        return updated_count


async def migrate_lab_sonuclari():
    """Migrate lab_sonuclari table."""
    async with AsyncSessionLocal() as session:
        # Get all records with tetkik_adi
        result = await session.execute(
            text("SELECT id, tetkik_adi FROM lab_sonuclari WHERE tetkik_adi IS NOT NULL")
        )
        rows = result.fetchall()
        
        updated_count = 0
        for row in rows:
            record_id, old_name = row
            new_name = normalize_turkish(old_name)
            
            if old_name != new_name:
                await session.execute(
                    text("UPDATE lab_sonuclari SET tetkik_adi = :new_name WHERE id = :id"),
                    {"new_name": new_name, "id": record_id}
                )
                updated_count += 1
                if updated_count <= 20:  # Only print first 20 for brevity
                    print(f"  Updated: '{old_name}' -> '{new_name}'")
        
        await session.commit()
        print(f"\n✅ lab_sonuclari: {updated_count} records updated")
        return updated_count


async def main():
    print("=" * 60)
    print("TEST NAME NORMALIZATION MIGRATION")
    print("Converting Turkish chars to English and applying UPPERCASE")
    print("=" * 60)
    
    total = 0
    
    print("\n📋 Processing tetkik_sonuclari...")
    try:
        total += await migrate_tetkik_sonuclari()
    except Exception as e:
        print(f"❌ Error: {e}")
    
    print("\n📋 Processing goruntuleme_sonuclari...")
    try:
        total += await migrate_goruntuleme_sonuclari()
    except Exception as e:
        print(f"❌ Error: {e}")
    
    print("\n" + "=" * 60)
    print(f"🎉 MIGRATION COMPLETE: {total} total records updated")
    print("=" * 60)


if __name__ == "__main__":
    asyncio.run(main())
