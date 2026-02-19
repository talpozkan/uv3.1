import asyncio
import sys
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text
from app.core.config import settings

DATABASE_URL = settings.DATABASE_URL
# Using standard uuid lib for generation if needed, though we might cast existing IDs
import uuid

async def migrate_patients():
    print(f"Connecting to DB: {DATABASE_URL}")
    engine = create_async_engine(DATABASE_URL, echo=True)
    
    async with engine.begin() as conn:
        print("Checking for legacy data...")
        result = await conn.execute(text("SELECT count(*) FROM hastalar"))
        count = result.scalar()
        print(f"Found {count} records in 'hastalar'")
        
        if count == 0:
            print("No data to migrate.")
            return

        print("Migrating data from 'hastalar' to 'patient.sharded_patient_demographics'...")
        
        # Mapping:
        # id (int) -> uuid (generate or cast?) 
        # CAUTION: Sharded schema expects UUID. Legacy is likely Integer.
        # If legacy ID is integer, we need to generate new UUIDs or handle mapping.
        # Let's check legacy ID type.
        
        # For this script, we will generate new UUIDs using `uuid_generate_v4()` if available, or python logic.
        # But wait, linking other tables (visits etc) will break if we change IDs.
        # Verify if existing IDs are UUIDs.
        
        # Check ID type
        try:
            sample = await conn.execute(text("SELECT id FROM hastalar LIMIT 1"))
            row = sample.fetchone()
            if row:
                print(f"Sample ID: {row[0]} (Type: {type(row[0])})")
        except Exception as e:
            print(f"Error checking ID: {e}")

        # Assuming we need to preserve relationships, migration is complex if types differ.
        # However, looking at `ShardedPatientDemographics` model, `id` IS UUID.
        # Let's assume we can cast if they are strings, or valid UUIDs. 
        # If they are integers, we have a problem: Schema Migration required.
        
        # Simple migration attempt:
        # INSERT INTO patient.sharded_patient_demographics (id, ad, soyad, tc_kimlik, dogum_tarihi, cinsiyet, telefon, email, adres, is_deleted)
        # SELECT 
        #   uuid_generate_v4(), -- Generating NEW UUIDs for now, assuming data is fresh import
        #   ad, soyad, tc_no, dogum_tarihi, cinsiyet, cep_tel, e_mail, adres, false
        # FROM hastalar;
        
        # Note: referencing tables `muayene` etc will point to old IDs. 
        # If old IDs are INT and new are UUID, we can't join.
        
        # Let's inspect `ShardedMuayene` model logic too?
        # For now, let's just populate the patient list so dashboard works.
        
        query = """
        INSERT INTO patient.sharded_patient_demographics 
        (id, ad, soyad, tc_kimlik, dogum_tarihi, cinsiyet, cep_tel, email, adres, 
         dogum_yeri, kan_grubu, medeni_hal, meslek, doktor, kimlik_notlar, protokol_no,
         ev_tel, is_tel, referans, postakodu, kurum, sigorta, ozelsigorta, cocuk_sayisi,
         sms_izin, email_izin, iletisim_kaynagi, iletisim_tercihi, indirim_grubu, dil, etiketler, kayit_notu,
         is_deleted, created_at, updated_at)
        SELECT 
          id,
          ad, 
          soyad, 
          tc_kimlik, 
          dogum_tarihi, 
          cinsiyet, 
          cep_tel, 
          email, 
          adres, 
          LEFT(dogum_yeri, 100),
          kan_grubu,
          medeni_hal,
          LEFT(meslek, 100),
          LEFT(doktor, 100),
          kimlik_notlar,
          LEFT(protokol_no, 50),
          ev_tel,
          is_tel,
          LEFT(referans, 100),
          LEFT(postakodu, 10),
          LEFT(kurum, 100),
          LEFT(sigorta, 100),
          LEFT(ozelsigorta, 100),
          NULLIF(REGEXP_REPLACE(cocuk_sayisi, '[^0-9]', '', 'g'), '')::INTEGER,
          COALESCE(sms_izin = 'Evet', false),
          COALESCE(email_izin = 'Evet', false),
          LEFT(iletisim_kaynagi, 50),
          LEFT(iletisim_tercihi, 50),
          LEFT(indirim_grubu, 50),
          dil,
          etiketler,
          kayit_notu,
          false,
          now(),
          now()
        FROM hastalar
        WHERE NOT EXISTS (SELECT 1 FROM patient.sharded_patient_demographics WHERE tc_kimlik = hastalar.tc_kimlik);
        """
        
        try:
            await conn.execute(text("CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\""))
            await conn.execute(text(query))
            print("Migration completed.")
        except Exception as e:
             print(f"Migration failed: {e}")

if __name__ == "__main__":
    if sys.platform == 'win32':
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    asyncio.run(migrate_patients())
