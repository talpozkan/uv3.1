import asyncio
import os
import uuid
import sys
from datetime import datetime, timedelta, date
from sqlalchemy import text

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from app.db.session import SessionLocal

async def seed_micheal_jordan():
    async with SessionLocal() as db:
        print("🏀 Micheal Jordan: Final Match Implementation (Fixed Dates)...")
        
        # 0. Cleanup existing MJs
        print("🗑 Cleaning up old MJ records...")
        await db.execute(text("DELETE FROM patient.sharded_patient_demographics WHERE ad = 'Micheal' AND soyad = 'JORDAN'"))
        await db.commit()

        patient_id = uuid.uuid4()
        
        # 1. Patient
        try:
            sql_patient = text("""
                INSERT INTO patient.sharded_patient_demographics 
                (id, ad, soyad, tc_kimlik, cep_tel, dogum_tarihi, created_at, is_deleted)
                VALUES (:id, :ad, :soyad, :tc, :tel, :dob, NOW(), false)
            """)
            await db.execute(sql_patient, {
                "id": patient_id, "ad": "Micheal", "soyad": "JORDAN", 
                "tc": f"23{uuid.uuid4().hex[:9]}", "tel": "+905232322323", "dob": date(1963, 2, 17)
            })
            await db.commit()
            print("✅ Patient: Micheal Jordan Created.")
        except Exception as e:
            print(f"❌ Patient Fail: {e}")
            return

        # 2. 10 Examinations (FIXED: Use .date() to avoid ResponseValidationError)
        for i in range(10):
            try:
                # Use plain date to satisfy Pydantic v2 date validation
                tarih = (date.today() - timedelta(days=30 * (10 - i)))
                sql_exam = text("""
                    INSERT INTO clinical.sharded_clinical_muayeneler 
                    (hasta_id, tarih, sikayet, created_at, is_deleted)
                    VALUES (:pid, :tarih, :sikayet, NOW(), false)
                """)
                await db.execute(sql_exam, {
                    "pid": patient_id, "tarih": tarih, 
                    "sikayet": f"Elite Performance Audit - Phase {i+1}"
                })
                await db.commit()
            except Exception: pass
        print("✅ 10 Examinations added.")

        # 3. Appointment
        try:
            sql_appt = text("""
                INSERT INTO public.randevular (hasta_id, "start", "end", title, type, status, color)
                VALUES (:pid, :start, :end, :title, 'Muayene', 'scheduled', '#D2122E')
            """)
            await db.execute(sql_appt, {
                "pid": patient_id, 
                "start": datetime.now().replace(hour=10, minute=0, second=0) + timedelta(days=1),
                "end": datetime.now().replace(hour=10, minute=30, second=0) + timedelta(days=1),
                "title": "Championship Recovery Session"
            })
            await db.commit()
            print("✅ Appointment Scheduled.")
        except Exception as e: 
            await db.rollback()
            print(f"⚠️ Appt Fail: {e}")

        # 4. Imaging
        try:
            sql_tetkik = text("""
                INSERT INTO clinical.sharded_clinical_tetkikler (hasta_id, tarih, kategori, tetkik_adi, sonuc, created_at, is_deleted)
                VALUES (:pid, :tarih, 'Goruntuleme', 'MRI Knee Scan', 'Hyper-athletic structure found.', NOW(), false)
            """)
            await db.execute(sql_tetkik, {"pid": patient_id, "tarih": date.today()})
            await db.commit()
            print("✅ Clinical Imaging Ready.")
        except Exception as e: 
            await db.rollback()
            print(f"⚠️ Imaging Fail: {e}")

        # 5. Follow-up Notes (Takip/Notes)
        try:
            sql_note = text("""
                INSERT INTO clinical.sharded_clinical_notlar (hasta_id, tarih, tip, icerik, sembol, is_deleted)
                VALUES (:pid, :tarih, :tip, :icerik, :sembol, false)
            """)
            notes = [
                (date.today() - timedelta(days=5), "KONTROL", "Patient is in peak condition. No fatigue reported.", "check"),
                (date.today() - timedelta(days=15), "LAB REWIEW", "Blood work shows optimal testosterone levels for a 60yo athlete.", "warning"),
                (date.today() - timedelta(days=45), "NUTRITION", "Switching to high-protein recovery diet.", "info")
            ]
            for d, t, c, s in notes:
                await db.execute(sql_note, {"pid": patient_id, "tarih": d, "tip": t, "icerik": c, "sembol": s})
            await db.commit()
            print("✅ 3 Follow-up Notes Added.")
        except Exception as e:
            await db.rollback()
            print(f"⚠️ Notes Fail: {e}")

        # 6. Operation (Operasyon)
        try:
            sql_op = text("""
                INSERT INTO clinical.sharded_clinical_operasyonlar (hasta_id, tarih, ameliyat, pre_op_tani, post_op_tani, ekip, notlar, is_deleted)
                VALUES (:pid, :tarih, :ameliyat, :pre, :post, :ekip, :notlar, false)
            """)
            await db.execute(sql_op, {
                "pid": patient_id, 
                "tarih": date.today() - timedelta(days=120),
                "ameliyat": "Arthroscopic Knee Debridement",
                "pre": "Chronic Meniscus Degeneration",
                "post": "Successful Debridement",
                "ekip": "Dr. Phil Jackson, Dr. Scottie Pippen",
                "notlar": "The procedure went perfectly. The GOAT's knee is as good as 1996."
            })
            await db.commit()
            print("✅ Operation Record Created.")
        except Exception as e:
            await db.rollback()
            print(f"⚠️ Operation Fail: {e}")

        # 7. Reports (İstirahat, Durum, Tıbbi)
        # 7a. Rest Report
        try:
            sql_rest = text("""
                INSERT INTO clinical.sharded_clinical_istirahat_raporlari (hasta_id, tarih, baslangic_tarihi, bitis_tarihi, tani, karar, is_deleted)
                VALUES (:pid, :tarih, :start, :end, :tani, 'calisir', false)
            """)
            await db.execute(sql_rest, {
                "pid": patient_id, "tarih": date.today(),
                "start": date.today(), "end": date.today() + timedelta(days=7),
                "tani": "Acute Athletic Fatigue"
            })
            await db.commit()
            print("✅ Rest Report Added.")
        except Exception as e:
            await db.rollback()
            print(f"⚠️ Rest Report Fail: {e}")

        # 7b. Status Report
        try:
            sql_status = text("""
                INSERT INTO clinical.sharded_clinical_durum_bildirir_raporlari (hasta_id, tarih, tani_bulgular, sonuc_kanaat, is_deleted)
                VALUES (:pid, :tarih, :tani, :sonuc, false)
            """)
            await db.execute(sql_status, {
                "pid": patient_id, "tarih": date.today(),
                "tani": "Patient is Micheal Jordan. Enough said.",
                "sonuc": "Fit for any championship series."
            })
            await db.commit()
            print("✅ Status Report Added.")
        except Exception as e:
            await db.rollback()
            print(f"⚠️ Status Report Fail: {e}")

        # 7c. Medical Intervention Report
        try:
            sql_med = text("""
                INSERT INTO clinical.sharded_clinical_tibbi_mudahale_raporlari (hasta_id, tarih, islem_basligi, islem_detayi, sonuc_oneriler, is_deleted)
                VALUES (:pid, :tarih, :baslik, :detay, :oneri, false)
            """)
            await db.execute(sql_med, {
                "pid": patient_id, "tarih": date.today(),
                "baslik": "Cortisone Injection",
                "detay": "Left knee joint injection for inflammation.",
                "oneri": "Rest for 48 hours."
            })
            await db.commit()
            print("✅ Medical Intervention Report Added.")
        except Exception as e:
            await db.rollback()
            print(f"⚠️ Medical Report Fail: {e}")

        # 8. Finance (Updated name from step 5 to 8)
        try:
            ref = f"GEL-2026-{uuid.uuid4().hex[:5].upper()}"
            sql_islem = text("""
                INSERT INTO public.finans_islemler (referans_kodu, hasta_id, tarih, islem_tipi, tutar, net_tutar, durum, created_at)
                VALUES (:ref, :pid, CURRENT_DATE, 'gelir', 23000.0, 23000.0, 'tamamlandi', NOW())
            """)
            await db.execute(sql_islem, {"ref": ref, "pid": patient_id})
            await db.commit()
            print("✅ Finance Transaction Recorded.")
        except Exception as e: 
            await db.rollback()
            print(f"⚠️ Finance Fail: {e}")

        print(f"\n🏀 MJ RE-SEEDED SUCCESSFULLY!")
        print(f"🆔 New Patient ID: {patient_id}")
        print(f"🌍 Live Dashboard: https://urotip.urolog.net.tr/patients/{patient_id}/clinical")

if __name__ == "__main__":
    asyncio.run(seed_micheal_jordan())
