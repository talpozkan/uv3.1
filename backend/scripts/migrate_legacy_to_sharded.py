import asyncio
import os
import sys

# Add backend directory to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text
from app.core import config

settings = config.settings

async def migrate_data():
    db_url = settings.DATABASE_URL
    # db_url = settings.DATABASE_URL
    # Logic to replace localhost was problematic for in-container execution.
    # We will trust the environment variable or settings.
    db_url = settings.DATABASE_URL
    print(f"Connecting to: {db_url}")

    engine = create_async_engine(db_url, echo=True)

    async with engine.begin() as conn:
        print("Starting Data Migration from 'legacy_import' to Sharded Tables...")

        # 0. Users (Critical for FKs)
        print("Migrating Users...")
        await conn.execute(text("""
            INSERT INTO public.users (
                id, username, full_name, email, hashed_password, role, is_active, is_superuser, created_at, updated_at
            )
            SELECT 
                id, username, full_name, email, hashed_password, role, is_active, is_superuser, created_at, updated_at
            FROM legacy_import.users
            ON CONFLICT (id) DO NOTHING;
        """))
        
        # Update sequence to avoid collisions with new users
        await conn.execute(text("SELECT setval('users_id_seq', (SELECT MAX(id) FROM users));"))

        # 1. Patients
        print("Migrating Patients...")
        result = await conn.execute(text("""
            INSERT INTO patient.sharded_patient_demographics (
                id, tc_kimlik, ad, soyad, cinsiyet, dogum_tarihi, dogum_yeri, 
                kan_grubu, medeni_hal, meslek, adres, ev_tel, is_tel, cep_tel, 
                email, kimlik_notlar, doktor, referans, postakodu, kurum, 
                sigorta, ozelsigorta, cocuk_sayisi, sms_izin, email_izin, 
                iletisim_kaynagi, iletisim_tercihi, indirim_grubu, dil, 
                etiketler, kayit_notu, protokol_no, 
                created_at, updated_at, is_deleted
            )
            SELECT 
                id, NULLIF(tc_kimlik, ''), LEFT(ad, 100), LEFT(soyad, 100), LEFT(cinsiyet, 10), dogum_tarihi, LEFT(dogum_yeri, 100), 
                LEFT(kan_grubu, 10), LEFT(medeni_hal, 20), LEFT(meslek, 100), adres, LEFT(ev_tel, 20), LEFT(is_tel, 20), LEFT(cep_tel, 20), 
                LEFT(email, 100), kimlik_notlar, LEFT(doktor, 100), LEFT(referans, 100), LEFT(postakodu, 10), LEFT(kurum, 100), 
                LEFT(sigorta, 100), LEFT(ozelsigorta, 100), CAST(NULLIF(cocuk_sayisi, '') AS INTEGER), 
                (CASE WHEN sms_izin = 'Evet' THEN true ELSE false END), 
                (CASE WHEN email_izin = 'Evet' THEN true ELSE false END), 
                LEFT(iletisim_kaynagi, 50), LEFT(iletisim_tercihi, 50), LEFT(indirim_grubu, 50), LEFT(dil, 20), 
                etiketler, kayit_notu, LEFT(protokol_no, 50), 
                created_at, updated_at, false
            FROM legacy_import.hastalar
            ON CONFLICT (id) DO NOTHING;
        """))
        print(f"Patients Migrated: {result.rowcount}")

        # 2. Examinations (Muayeneler)
        print("Migrating Examinations...")
        await conn.execute(text("""
            INSERT INTO clinical.sharded_clinical_muayeneler (
                id, hasta_id, tarih, sikayet, oyku, tani1, tedavi, doktor, 
                recete, ozgecmis, soygecmis, kullandigi_ilaclar, kan_sulandirici, 
                aliskanliklar, sistem_sorgu, ipss_skor, iief_ef_skor, 
                fizik_muayene, erektil_islev, ejakulasyon, mshq, prosedur, 
                allerjiler, tani1_kodu, tani2, tani2_kodu, oneriler, sonuc, 
                tansiyon, ates, kvah, bobrek_sag, bobrek_sol, suprapubik_kitle, 
                ego, rektal_tuse, created_at, updated_at, is_deleted
            )
            SELECT 
                id, hasta_id, tarih, sikayet, oyku, LEFT(tani1, 255), tedavi, LEFT(doktor, 100), 
                recete, ozgecmis, soygecmis, kullandigi_ilaclar, 
                COALESCE(kan_sulandirici, 0), 
                aliskanliklar, sistem_sorgu, LEFT(ipss_skor, 50), LEFT(iief_ef_skor, 50), 
                fizik_muayene, LEFT(erektil_islev, 50), LEFT(ejakulasyon, 50), LEFT(mshq, 50), prosedur, 
                allerjiler, LEFT(tani1_kodu, 50), LEFT(tani2, 255), LEFT(tani2_kodu, 50), oneriler, sonuc, 
                LEFT(tansiyon, 50), LEFT(ates, 50), LEFT(kvah, 50), LEFT(bobrek_sag, 50), LEFT(bobrek_sol, 50), LEFT(suprapubik_kitle, 50), 
                LEFT(ego, 50), LEFT(rektal_tuse, 50), created_at, created_at, false
            FROM legacy_import.muayeneler
            ON CONFLICT (id) DO NOTHING;
        """))

        # 3. Operations
        print("Migrating Operations...")
        await conn.execute(text("""
            INSERT INTO clinical.sharded_clinical_operasyonlar (
                id, hasta_id, tarih, ameliyat, pre_op_tani, post_op_tani, 
                ekip, hemsire, anestezi_ekip, anestezi_tur, notlar, 
                patoloji, post_op, video_url, created_at, updated_at, is_deleted
            )
            SELECT 
                id, hasta_id, tarih, ameliyat, pre_op_tani, post_op_tani, 
                ekip, LEFT(hemsire, 100), LEFT(anestezi_ekip, 100), LEFT(anestezi_tur, 50), notlar, 
                patoloji, post_op, video_url, created_at, created_at, false
            FROM legacy_import.operasyonlar
            ON CONFLICT (id) DO NOTHING;
        """))
        
        # 4. Notes
        print("Migrating Notes...")
        await conn.execute(text("""
            INSERT INTO clinical.sharded_clinical_notlar (
                id, hasta_id, tarih, tip, icerik, created_at, updated_at, is_deleted
            )
            SELECT 
                id, hasta_id, tarih, tip, icerik, created_at, created_at, false
            FROM legacy_import.hasta_notlari
            ON CONFLICT (id) DO NOTHING;
        """))

        # 5. Labs (Consolidated to ShardedTetkikSonuc)
        print("Migrating General Lab Results...")
        await conn.execute(text("""
            INSERT INTO clinical.sharded_clinical_tetkikler (
                hasta_id, tarih, kategori, tetkik_adi, sonuc, birim, referans_araligi, created_at, is_deleted
            )
            SELECT 
                hasta_id, tarih, 'Laboratuvar', tetkik_adi, sonuc, birim, referans_araligi, created_at, false
            FROM legacy_import.genel_lab_sonuclari;
        """))

        print("Migrating Imaging Results...")
        await conn.execute(text("""
            INSERT INTO clinical.sharded_clinical_tetkikler (
                hasta_id, tarih, kategori, tetkik_adi, sonuc, sembol, created_at, is_deleted
            )
            SELECT 
                hasta_id, tarih, 'Goruntuleme', tetkik_adi, sonuc, LEFT(sembol, 50), created_at, false
            FROM legacy_import.goruntuleme_sonuclari;
        """))

        print("Migrating Sperm Analysis (Summarized)...")
        # Format a basic summary for the unified table
        await conn.execute(text("""
            INSERT INTO clinical.sharded_clinical_tetkikler (
                hasta_id, tarih, kategori, tetkik_adi, sonuc, created_at, is_deleted
            )
            SELECT 
                hasta_id, tarih, 'Laboratuvar', 'Spermiogram', 
                CONCAT('Volüm: ', volum, ' ml, Sayı: ', sayi, ' mil/ml, Motilite: ', motilite, ', Morfoloji: ', kruger), 
                created_at, false
            FROM legacy_import.sperm_analizleri;
        """))
        
        # 6. Photos
        print("Migrating Photos...")
        await conn.execute(text("""
            INSERT INTO clinical.sharded_clinical_fotograflar (
                id, hasta_id, tarih, asama, etiketler, dosya_yolu, dosya_adi, notlar, created_at, is_deleted
            )
            SELECT 
                id, hasta_id, tarih, LEFT(asama, 50), etiketler, dosya_yolu, dosya_adi, notlar, created_at, false
            FROM legacy_import.fotograf_arsivi
            ON CONFLICT (id) DO NOTHING;
        """))

        # 7. Other Reports (Map to sharded tables)
        # Istirahat
        print("Migrating Reports...")
        await conn.execute(text("""
            INSERT INTO clinical.sharded_clinical_istirahat_raporlari (
                id, hasta_id, tarih, baslangic_tarihi, bitis_tarihi, icd_kodu, tani, karar, kontrol_tarihi, created_at, is_deleted
            )
            SELECT 
                id, hasta_id, tarih, baslangic_tarihi, bitis_tarihi, LEFT(icd_kodu, 50), tani, karar, kontrol_tarihi, created_at, false
            FROM legacy_import.istirahat_raporlari
            ON CONFLICT (id) DO NOTHING;
        """))
        
        # Durum Bildirir
        await conn.execute(text("""
            INSERT INTO clinical.sharded_clinical_durum_bildirir_raporlari (
                id, hasta_id, tarih, tani_bulgular, icd_kodu, sonuc_kanaat, created_at, is_deleted
            )
            SELECT 
                id, hasta_id, tarih, tani_bulgular, LEFT(icd_kodu, 50), sonuc_kanaat, created_at, false
            FROM legacy_import.durum_bildirir_raporlari
            ON CONFLICT (id) DO NOTHING;
        """))
        
        # Tibbi Mudahale
        await conn.execute(text("""
            INSERT INTO clinical.sharded_clinical_tibbi_mudahale_raporlari (
                id, hasta_id, tarih, islem_basligi, islem_detayi, sonuc_oneriler, created_at, is_deleted
            )
            SELECT 
                id, hasta_id, tarih, islem_basligi, islem_detayi, sonuc_oneriler, created_at, false
            FROM legacy_import.tibbi_mudahale_raporlari
            ON CONFLICT (id) DO NOTHING;
        """))
        
        # TRUS
        await conn.execute(text("""
            INSERT INTO clinical.sharded_clinical_trus_biyopsileri (
                id, hasta_id, tarih, psa_total, rektal_tuse, mri_var, mri_tarih, mri_ozet, 
                pirads_lezyon_boyut, pirads_lezyon_lokasyon, lokasyonlar, prosedur_notu, created_at, is_deleted
            )
            SELECT 
                id, hasta_id, tarih, psa_total, rektal_tuse, mri_var, mri_tarih, mri_ozet, 
                pirads_lezyon_boyut, pirads_lezyon_lokasyon, lokasyonlar, prosedur_notu, created_at, false
            FROM legacy_import.trus_biyopsileri
            ON CONFLICT (id) DO NOTHING;
        """))
        
        # 8. Appointments
        print("Migrating Appointments...")
        await conn.execute(text("""
            INSERT INTO public.randevular (
                id, hasta_id, title, type, start, "end", status, notes, 
                doctor_id, doctor_name, is_deleted, cancel_reason, 
                delete_reason, google_event_id, google_calendar_id, last_synced_at, created_at
            )
            SELECT 
                id, hasta_id, title, type, start, "end", status, notes, 
                doctor_id, doctor_name, is_deleted, cancel_reason, 
                delete_reason, google_event_id, google_calendar_id, last_synced_at, created_at
            FROM legacy_import.randevular
            ON CONFLICT (id) DO NOTHING;
        """))

    await engine.dispose()
    print("Migration Complete.")

if __name__ == "__main__":
    asyncio.run(migrate_data())
