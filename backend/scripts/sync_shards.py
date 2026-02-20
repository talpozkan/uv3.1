import asyncio
import sys
import logging
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text
from app.core.config import settings

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("sync_shards")

DATABASE_URL = str(settings.DATABASE_URL)

async def sync_table(conn, source_table, target_table, mapping, schema=None):
    """
    Synchronizes data from source_table to target_table using the provided mapping.
    Includes ON CONFLICT (id) DO UPDATE for idempotency.
    """
    qualified_target = f"{schema}.{target_table}" if schema else target_table
    logger.info(f"Syncing {source_table} -> {qualified_target}...")
    
    target_cols_list = list(mapping.keys())
    source_exprs_list = [mapping[k] for k in target_cols_list]
    
    target_cols = ", ".join(target_cols_list)
    source_exprs = ", ".join(source_exprs_list)
    
    update_clause_list = []
    for col in target_cols_list:
        if col != 'id':
            update_clause_list.append(f"{col} = EXCLUDED.{col}")
    update_clause = ", ".join(update_clause_list)
    
    query = f"""
    INSERT INTO {qualified_target} ({target_cols}, created_at, updated_at, is_deleted)
    SELECT {source_exprs}, now(), now(), false
    FROM {source_table} s
    ON CONFLICT (id) DO UPDATE SET
    {update_clause},
    updated_at = now()
    """
    
    try:
        result = await conn.execute(text(query))
        logger.info(f"✅ Synced {result.rowcount} rows in {qualified_target}.")
        
        # Reset sequence only if it exists
        seq_exists_query = f"SELECT pg_get_serial_sequence('{qualified_target}', 'id') IS NOT NULL as has_seq;"
        try:
            seq_res = await conn.execute(text(seq_exists_query))
            has_seq = seq_res.scalar()
            
            if has_seq:
                # Type check for id to avoid MAX(uuid) error
                id_type_query = f"SELECT data_type FROM information_schema.columns WHERE table_schema = '{schema or 'public'}' AND table_name = '{target_table}' AND column_name = 'id';"
                id_type_res = await conn.execute(text(id_type_query))
                id_type = id_type_res.scalar()
                
                if id_type in ('integer', 'bigint', 'smallint'):
                    seq_query = f"SELECT setval(pg_get_serial_sequence('{qualified_target}', 'id'), COALESCE((SELECT MAX(id) FROM {qualified_target}), 1));"
                    await conn.execute(text(seq_query))
                    logger.info(f"🔄 Sequence reset for {qualified_target}.")
                else:
                    logger.info(f"ℹ️ Skipping sequence reset for {qualified_target} (Type: {id_type})")
            else:
                logger.debug(f"ℹ️ No sequence found for {qualified_target}.")
        except Exception as seq_err:
            logger.warning(f"⚠️ Sequence reset skipped for {qualified_target}: {seq_err}")
            
    except Exception as e:
        logger.error(f"❌ Failed to sync {source_table} -> {qualified_target}: {e}")
        raise

async def full_sync():
    logger.info(f"Connecting to database: {DATABASE_URL}")
    engine = create_async_engine(DATABASE_URL)
    
    async with engine.begin() as conn:
        # Pre-requisite: UUID extension
        await conn.execute(text("CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\""))
        
        # 1. Patients -> patient.sharded_patient_demographics
        patient_map = {
            "id": "s.id", "tc_kimlik": "s.tc_kimlik", "ad": "s.ad", "soyad": "s.soyad",
            "dogum_tarihi": "s.dogum_tarihi", "cinsiyet": "s.cinsiyet", "cep_tel": "s.cep_tel",
            "email": "s.email", "adres": "s.adres", 
            "dogum_yeri": "LEFT(s.dogum_yeri, 100)",
            "kan_grubu": "s.kan_grubu", "medeni_hal": "s.medeni_hal", 
            "meslek": "LEFT(s.meslek, 100)",
            "doktor": "LEFT(s.doktor, 100)", 
            "kimlik_notlar": "s.kimlik_notlar", 
            "protokol_no": "LEFT(s.protokol_no, 50)",
            "ev_tel": "s.ev_tel", "is_tel": "s.is_tel", 
            "referans": "LEFT(s.referans, 100)",
            "postakodu": "LEFT(s.postakodu, 10)", 
            "kurum": "LEFT(s.kurum, 100)", 
            "sigorta": "LEFT(s.sigorta, 100)",
            "ozelsigorta": "LEFT(s.ozelsigorta, 100)", 
            "cocuk_sayisi": "NULLIF(REGEXP_REPLACE(s.cocuk_sayisi, '[^0-9]', '', 'g'), '')::INTEGER", 
            "sms_izin": "COALESCE(s.sms_izin = 'Evet', false)", 
            "email_izin": "COALESCE(s.email_izin = 'Evet', false)", 
            "iletisim_kaynagi": "LEFT(s.iletisim_kaynagi, 50)", 
            "iletisim_tercihi": "LEFT(s.iletisim_tercihi, 50)", 
            "indirim_grubu": "LEFT(s.indirim_grubu, 50)", 
            "dil": "s.dil", "etiketler": "s.etiketler", "kayit_notu": "s.kayit_notu"
        }
        await sync_table(conn, "hastalar", "sharded_patient_demographics", patient_map, schema="patient")
        
        # 2. Muayeneler -> clinical.sharded_clinical_muayeneler
        muayene_map = {
            "id": "s.id", "hasta_id": "s.hasta_id", "tarih": "s.tarih", "sikayet": "s.sikayet",
            "oyku": "s.oyku", "bulgu_notu": "s.bulgu_notu", "tani1": "LEFT(s.tani1, 255)", 
            "tani1_kodu": "LEFT(s.tani1_kodu, 50)", "tani2": "LEFT(s.tani2, 255)", 
            "tani2_kodu": "LEFT(s.tani2_kodu, 50)",
            "tani3": "LEFT(s.tani3, 255)", "tani3_kodu": "LEFT(s.tani3_kodu, 50)",
            "tani4": "LEFT(s.tani4, 255)", "tani4_kodu": "LEFT(s.tani4_kodu, 50)",
            "tani5": "LEFT(s.tani5, 255)", "tani5_kodu": "LEFT(s.tani5_kodu, 50)",
            "tedavi": "s.tedavi", "doktor": "LEFT(s.doktor, 100)", "recete": "s.recete", 
            "ozgecmis": "s.ozgecmis", "soygecmis": "s.soygecmis", 
            "kullandigi_ilaclar": "s.kullandigi_ilaclar", "kan_sulandirici": "s.kan_sulandirici",
            "aliskanliklar": "s.aliskanliklar", "sistem_sorgu": "s.sistem_sorgu", 
            "ipss_skor": "LEFT(s.ipss_skor, 50)", 
            "iief_ef_skor": "LEFT(s.iief_ef_skor, 50)", 
            "iief_ef_answers": "s.iief_ef_answers",
            "fizik_muayene": "s.fizik_muayene", 
            "erektil_islev": "LEFT(s.erektil_islev, 50)", 
            "ejakulasyon": "LEFT(s.ejakulasyon, 50)", 
            "mshq": "LEFT(s.mshq, 50)", 
            "prosedur": "s.prosedur", 
            "allerjiler": "s.allerjiler", "oneriler": "s.oneriler", "sonuc": "s.sonuc"
        }
        v10_cols = ['disuri', 'pollakiuri', 'nokturi', 'hematuri', 'genital_akinti', 'kabizlik', 'tas_oyku', 'catallanma', 'projeksiyon_azalma', 'kalibre_incelme', 'idrar_bas_zorluk', 'kesik_idrar_yapma', 'terminal_damlama', 'residiv_hissi', 'inkontinans']
        v50_cols = ['tansiyon', 'ates', 'kvah', 'bobrek_sag', 'bobrek_sol', 'suprapubik_kitle', 'ego', 'rektal_tuse']
        for c in v10_cols: muayene_map[c] = f"LEFT(s.{c}, 10)"
        for c in v50_cols: muayene_map[c] = f"LEFT(s.{c}, 50)"
        await sync_table(conn, "muayeneler", "sharded_clinical_muayeneler", muayene_map, schema="clinical")
        
        # 3. Operasyonlar -> clinical.sharded_clinical_operasyonlar
        op_map = {
            "id": "s.id", "hasta_id": "s.hasta_id", "tarih": "s.tarih", 
            "ameliyat": "LEFT(s.ameliyat, 255)", "pre_op_tani": "LEFT(s.pre_op_tani, 255)", 
            "post_op_tani": "LEFT(s.post_op_tani, 255)",
            "ekip": "s.ekip", "hemsire": "LEFT(s.hemsire, 100)", 
            "anestezi_ekip": "LEFT(s.anestezi_ekip, 100)",
            "anestezi_tur": "LEFT(s.anestezi_tur, 50)", "notlar": "s.notlar", 
            "patoloji": "s.patoloji", "post_op": "s.post_op", "video_url": "LEFT(s.video_url, 255)"
        }
        await sync_table(conn, "operasyonlar", "sharded_clinical_operasyonlar", op_map, schema="clinical")
        
        # 4. Tetkik Sonuçları -> clinical.sharded_clinical_tetkikler
        tetkik_map = {
            "id": "s.id", "hasta_id": "s.hasta_id", "tarih": "s.tarih", 
            "kategori": "LEFT(s.kategori, 50)",
            "tetkik_adi": "LEFT(s.tetkik_adi, 255)", 
            "sonuc": "s.sonuc", 
            "birim": "LEFT(s.birim, 50)",
            "referans_araligi": "LEFT(s.referans_araligi, 100)", 
            "sembol": "LEFT(s.sembol, 50)",
            "dosya_yolu": "LEFT(s.dosya_yolu, 255)", 
            "dosya_adi": "LEFT(s.dosya_adi, 255)"
        }
        await sync_table(conn, "tetkik_sonuclari", "sharded_clinical_tetkikler", tetkik_map, schema="clinical")
        
        # 5. Hasta Notları -> clinical.sharded_clinical_notlar
        notlar_map = {
            "id": "s.id", "hasta_id": "s.hasta_id", "tarih": "s.tarih", "tip": "s.tip",
            "icerik": "s.icerik", "sembol": "s.sembol", "etiketler": "s.etiketler"
        }
        await sync_table(conn, "hasta_notlari", "sharded_clinical_notlar", notlar_map, schema="clinical")
        
        # 6. Finance -> finance.sharded_finance_islemler
        finance_map = {
            "id": "s.id", "referans_kodu": "s.referans_kodu", "hasta_id": "s.hasta_id", 
            "muayene_id": "s.muayene_id", "tarih": "s.tarih", "islem_tipi": "s.islem_tipi", 
            "tutar": "s.tutar", "net_tutar": "s.net_tutar", "para_birimi": "s.para_birimi",
            "durum": "s.durum", "aciklama": "s.aciklama", "doktor": "s.doktor"
        }
        await sync_table(conn, "finans_islemler", "sharded_finance_islemler", finance_map, schema="finance")

        # 6b. Photos -> clinical.sharded_clinical_fotograflar
        photo_map = {
            "id": "s.id", "hasta_id": "s.hasta_id", "tarih": "s.tarih",
            "dosya_yolu": "s.dosya_yolu", "kategori": "s.kategori", "notlar": "s.notlar"
        }
        await sync_table(conn, "fotograf_arsivi", "sharded_clinical_fotograflar", photo_map, schema="clinical")

        # 7. Additional Clinical Tables
        istirahat_map = {
            "id": "s.id", "hasta_id": "s.hasta_id", "tarih": "s.tarih",
            "baslangic_tarihi": "s.baslangic_tarihi", "bitis_tarihi": "s.bitis_tarihi",
            "icd_kodu": "s.icd_kodu", "tani": "s.tani", "karar": "s.karar",
            "kontrol_tarihi": "s.kontrol_tarihi"
        }
        await sync_table(conn, "istirahat_raporlari", "sharded_clinical_istirahat_raporlari", istirahat_map, schema="clinical")

        durum_map = {
            "id": "s.id", "hasta_id": "s.hasta_id", "tarih": "s.tarih",
            "tani_bulgular": "s.tani_bulgular", "icd_kodu": "s.icd_kodu", "sonuc_kanaat": "s.sonuc_kanaat"
        }
        await sync_table(conn, "durum_bildirir_raporlari", "sharded_clinical_durum_bildirir_raporlari", durum_map, schema="clinical")

        tibbi_map = {
            "id": "s.id", "hasta_id": "s.hasta_id", "tarih": "s.tarih",
            "islem_basligi": "s.islem_basligi", "islem_detayi": "s.islem_detayi", "sonuc_oneriler": "s.sonuc_oneriler"
        }
        await sync_table(conn, "tibbi_mudahale_raporlari", "sharded_clinical_tibbi_mudahale_raporlari", tibbi_map, schema="clinical")

        trus_map = {
            "id": "s.id", "hasta_id": "s.hasta_id", "tarih": "s.tarih",
            "psa_total": "s.psa_total", "rektal_tuse": "s.rektal_tuse", 
            "mri_var": "COALESCE(s.mri_var, false)", 
            "mri_tarih": "s.mri_tarih", "mri_ozet": "s.mri_ozet",
            "pirads_lezyon_boyut": "s.pirads_lezyon_boyut", 
            "pirads_lezyon_lokasyon": "s.pirads_lezyon_lokasyon",
            "lokasyonlar": "s.lokasyonlar", "prosedur_notu": "s.prosedur_notu"
        }
        await sync_table(conn, "trus_biyopsileri", "sharded_clinical_trus_biyopsileri", trus_map, schema="clinical")

        telefon_map = {
            "id": "s.id", "hasta_id": "s.hasta_id", "tarih": "s.tarih",
            "notlar": "s.notlar", "doktor": "s.doktor"
        }
        await sync_table(conn, "telefon_gorusmeleri", "sharded_clinical_telefon_gorusmeleri", telefon_map, schema="clinical")

    logger.info("🎉 Full Sharded Sync completed successfully.")

if __name__ == "__main__":
    asyncio.run(full_sync())
