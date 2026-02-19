import asyncio
import sys
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text
from app.core.config import settings

DATABASE_URL = settings.DATABASE_URL

async def migrate_exams():
    print(f"Connecting to DB: {DATABASE_URL}")
    engine = create_async_engine(DATABASE_URL, echo=True)
    async with engine.begin() as conn:
        print("Migrating Examinations (Muayeneler)...")
        res = await conn.execute(text("SELECT count(*) FROM muayeneler"))
        count_m = res.scalar()
        print(f"Found {count_m} examinations.")
        if count_m > 0:
            query_m = """
            INSERT INTO clinical.sharded_clinical_muayeneler
            (id, hasta_id, tarih, sikayet, oyku, bulgu_notu, tani1, tedavi, doktor,
             recete, ozgecmis, soygecmis, kullandigi_ilaclar, kan_sulandirici, aliskanliklar,
             sistem_sorgu, ipss_skor, iief_ef_skor, iief_ef_answers, fizik_muayene,
             erektil_islev, ejakulasyon, mshq, prosedur, allerjiler,
             tani1_kodu, tani2, tani2_kodu, oneriler, sonuc,
             tansiyon, ates, kvah, bobrek_sag, bobrek_sol, suprapubik_kitle, ego, rektal_tuse,
             disuri, pollakiuri, nokturi, hematuri, genital_akinti, kabizlik, tas_oyku,
             catallanma, projeksiyon_azalma, kalibre_incelme, idrar_bas_zorluk, kesik_idrar_yapma,
             terminal_damlama, residiv_hissi, inkontinans,
             is_deleted, created_at, updated_at)
            SELECT
                id,
                hasta_id,
                tarih,
                sikayet,
                oyku,
                bulgu_notu,
                tani1,
                tedavi,
                LEFT(doktor, 100),
                recete,
                ozgecmis,
                soygecmis,
                kullandigi_ilaclar,
                kan_sulandirici,
                aliskanliklar,
                sistem_sorgu,
                LEFT(ipss_skor, 50),
                LEFT(iief_ef_skor, 50),
                iief_ef_answers,
                fizik_muayene,
                LEFT(erektil_islev, 50),
                LEFT(ejakulasyon, 50),
                LEFT(mshq, 50),
                prosedur,
                allerjiler,
                LEFT(tani1_kodu, 50),
                LEFT(tani2, 255),
                LEFT(tani2_kodu, 50),
                oneriler,
                sonuc,
                LEFT(tansiyon, 50),
                LEFT(ates, 50),
                LEFT(kvah, 50),
                LEFT(bobrek_sag, 50),
                LEFT(bobrek_sol, 50),
                LEFT(suprapubik_kitle, 50),
                LEFT(ego, 50),
                LEFT(rektal_tuse, 50),
                LEFT(disuri, 10),
                LEFT(pollakiuri, 10),
                LEFT(nokturi, 10),
                LEFT(hematuri, 10),
                LEFT(genital_akinti, 10),
                LEFT(kabizlik, 10),
                LEFT(tas_oyku, 10),
                LEFT(catallanma, 10),
                LEFT(projeksiyon_azalma, 10),
                LEFT(kalibre_incelme, 10),
                LEFT(idrar_bas_zorluk, 10),
                LEFT(kesik_idrar_yapma, 10),
                LEFT(terminal_damlama, 10),
                LEFT(residiv_hissi, 10),
                LEFT(inkontinans, 10),
                false,
                created_at,
                now()
            FROM muayeneler
            WHERE NOT EXISTS (SELECT 1 FROM clinical.sharded_clinical_muayeneler WHERE id = muayeneler.id);
            """
            try:
                await conn.execute(text(query_m))
                print("Examinations migrated.")
            except Exception as e:
                print(f"Examination migration failed: {e}")

async def migrate_ops():
    print(f"Connecting to DB: {DATABASE_URL}")
    engine = create_async_engine(DATABASE_URL, echo=True)
    async with engine.begin() as conn:
        print("Migrating Operations (Operasyonlar)...")
        res = await conn.execute(text("SELECT count(*) FROM operasyonlar"))
        count_o = res.scalar()
        print(f"Found {count_o} operations.")
        if count_o > 0:
            query_o = """
            INSERT INTO clinical.sharded_clinical_operasyonlar
            (id, hasta_id, tarih, ad, notlar, is_deleted, created_at, updated_at)
            SELECT
                id,
                hasta_id,
                tarih,
                COALESCE(ameliyat, 'İsimsiz Operasyon'), -- Handle NULLs for NOT NULL column
                notlar,
                false,
                created_at,
                now()
            FROM operasyonlar
            WHERE NOT EXISTS (SELECT 1 FROM clinical.sharded_clinical_operasyonlar WHERE id = operasyonlar.id);
            """
            try:
                await conn.execute(text(query_o))
                print("Operations migrated.")
            except Exception as e:
                print(f"Operation migration failed: {e}")
        
        print("Resetting sequences...")
        try:
           await conn.execute(text("SELECT setval('clinical.sharded_clinical_muayeneler_id_seq', (SELECT MAX(id) FROM clinical.sharded_clinical_muayeneler));"))
           await conn.execute(text("SELECT setval('clinical.sharded_clinical_operasyonlar_id_seq', (SELECT MAX(id) FROM clinical.sharded_clinical_operasyonlar));"))
        except Exception as e:
            print(f"Sequence reset failed: {e}")

async def main():
    await migrate_exams()
    await migrate_ops()

if __name__ == "__main__":
    if sys.platform == 'win32':
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    asyncio.run(main())
