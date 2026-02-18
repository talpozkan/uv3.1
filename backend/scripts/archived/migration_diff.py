import asyncio
import hashlib
from sqlalchemy import text
from app.db.session import SessionLocal

# Re-using hashing logic from integrity_engine
from scripts.integrity_engine import calculate_row_hash

async def run_diff(table_name, source_schema='public', target_schema='patient'):
    # Determine target table name based on schema
    if target_schema == 'patient':
        target_table = 'sharded_patient_demographics'
    elif target_schema == 'clinical':
        if table_name == 'tetkik_sonuclari':
            target_table = 'sharded_clinical_tetkikler'
        elif table_name == 'hasta_notlari':
            target_table = 'sharded_clinical_notlar'
        else:
            target_table = f'sharded_clinical_{table_name}'
    elif target_schema == 'finance':
        target_table = 'sharded_finance_islemler'
    else:
        target_table = table_name

    print(f"🔍 Starting Diff Report: {source_schema}.{table_name} vs {target_schema}.{target_table}")
    
    async with SessionLocal() as session:
        # 1. Fetch source rows
        res_src = await session.execute(text(f"SELECT * FROM {source_schema}.{table_name}"))
        src_rows = {str(r.id): dict(zip(res_src.keys(), r)) for r in res_src.fetchall()}
        
        # 2. Fetch target rows
        res_tgt = await session.execute(text(f"SELECT * FROM {target_schema}.{target_table}"))
        tgt_rows = {str(r.id): dict(zip(res_tgt.keys(), r)) for r in res_tgt.fetchall()}
        
        mismatches = []
        missing_in_target = []
        
        for sid, srow in src_rows.items():
            if sid not in tgt_rows:
                missing_in_target.append(sid)
                continue
            
            trow = tgt_rows[sid]
            
            # Apply truncations to source row to match target schema constraints
            TRUNCATIONS = {
                'hastalar': {
                    'dogum_yeri': 100, 'meslek': 100, 'doktor': 100, 'referans': 100,
                    'kurum': 100, 'sigorta': 100, 'ozelsigorta': 100, 'protokol_no': 50,
                    'postakodu': 10, 'iletisim_kaynagi': 50, 'iletisim_tercihi': 50, 'indirim_grubu': 50
                },
                'muayeneler': {
                    'tani1': 255, 'tani2': 255, 'doktor': 100, 'tani1_kodu': 50, 'tani2_kodu': 50,
                    'tansiyon': 50, 'ates': 50, 'kvah': 50, 'bobrek_sag': 50, 'bobrek_sol': 50,
                    'suprapubik_kitle': 50, 'ego': 50, 'rektal_tuse': 50,
                    'ipss_skor': 50, 'iief_ef_skor': 50, 'erektil_islev': 50, 'ejakulasyon': 50, 'mshq': 50,
                    'disuri': 10, 'pollakiuri': 10, 'nokturi': 10, 'hematuri': 10, 'genital_akinti': 10,
                    'kabizlik': 10, 'tas_oyku': 10, 'catallanma': 10, 'projeksiyon_azalma': 10,
                    'kalibre_incelme': 10, 'idrar_bas_zorluk': 10, 'kesik_idrar_yapma': 10,
                    'terminal_damlama': 10, 'residiv_hissi': 10, 'inkontinans': 10
                },
                'tetkik_sonuclari': {
                    'kategori': 50, 'birim': 50, 'sembol': 50, 'referans_araligi': 100,
                    'tetkik_adi': 255, 'dosya_yolu': 255, 'dosya_adi': 255
                }
            }
            
            if table_name in TRUNCATIONS:
                for col, limit in TRUNCATIONS[table_name].items():
                    if col in srow and srow[col] is not None:
                        srow[col] = str(srow[col])[:limit]

            # Define exclusions
            exclude_common = ['id', 'created_at', 'updated_at', 'uuid']
            
            exclude_src = exclude_common + ['faks', 'personel_ids'] # Legacy columns not migrated (hastalar)
            if table_name == 'finans_islemler':
                exclude_src += ['belge_url', 'firma_id', 'iptal_nedeni', 'iptal_tarihi', 'kasa_id', 
                                'kategori_id', 'kdv_orani', 'kdv_tutari', 'notlar', 'vade_tarihi', 'created_by']

            s_hash = calculate_row_hash(srow, exclude_fields=exclude_src)
            
            # For target, we might need to exclude more sharding-specific fields to match legacy
            exclude_tgt = exclude_common + ['is_deleted', 'created_by', 'updated_by', 'sharding_key']
            if table_name == 'muayeneler':
                exclude_tgt += ['tani3', 'tani3_kodu', 'tani4', 'tani4_kodu', 'tani5', 'tani5_kodu']
            
            t_hash = calculate_row_hash(trow, exclude_fields=exclude_tgt)
            
            if s_hash != t_hash:
                if not mismatches:
                    print(f"DEBUG: First mismatch on ID {sid}")
                    s_clean = {k: v for k, v in srow.items() if k not in ['id', 'created_at', 'updated_at', 'uuid']}
                    t_clean = {k: v for k, v in trow.items() if k not in ['id', 'created_at', 'updated_at', 'uuid', 'is_deleted', 'created_by', 'updated_by', 'sharding_key']}
                    print(f"Source Keys: {sorted(s_clean.keys())}")
                    print(f"Target Keys: {sorted(t_clean.keys())}")
                    
                    # Check first key that differs
                    for k in sorted(s_clean.keys()):
                        if k in t_clean and s_clean[k] != t_clean[k]:
                            print(f"Mismatch in key {k}: SRC={s_clean[k]} TGT={t_clean[k]}")
                            break
                            
                mismatches.append(sid)

        print("-" * 50)
        print(f"📊 REPORT FOR {table_name}:")
        print(f"  - Total Source Rows: {len(src_rows)}")
        print(f"  - Total Target Rows: {len(tgt_rows)}")
        print(f"  - Missing in Target: {len(missing_in_target)}")
        print(f"  - Hash Mismatches: {len(mismatches)}")
        
        if mismatches:
            print(f"  - First 5 Mismatched IDs: {mismatches[:5]}")
        
        if not mismatches and not missing_in_target:
            print("  ✅ DATA INTEGRITY VERIFIED (100% Match on non-volatile fields).")
        else:
            print("  ❌ DATA DISCREPANCIES FOUND.")
        print("-" * 50)

if __name__ == "__main__":
    import sys
    table = sys.argv[1] if len(sys.argv) > 1 else 'hastalar'
    schema = sys.argv[2] if len(sys.argv) > 2 else 'patient'
    asyncio.run(run_diff(table, target_schema=schema))
