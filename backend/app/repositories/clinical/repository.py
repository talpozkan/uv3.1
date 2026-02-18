from typing import List, Optional, Any
from uuid import UUID
from datetime import datetime, date, time, timezone
from sqlalchemy import select, and_, update, or_
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.user_context import UserContext
from app.core.audit import audited
from app.repositories.clinical.models import (
    ShardedMuayene, ShardedOperasyon, ShardedClinicalNote, 
    ShardedTetkikSonuc, ShardedFotografArsivi, ShardedIstirahatRaporu,
    ShardedDurumBildirirRaporu, ShardedTibbiMudahaleRaporu, ShardedTrusBiyopsi,
    ShardedTelefonGorusmesi
)

class ClinicalRepository:
    def __init__(self, session: AsyncSession, context: Optional[UserContext] = None):
        self.session = session
        self.context = context

    # --- Examinations ---
    async def get_examination(self, exam_id: int) -> Optional[ShardedMuayene]:
        stmt = select(ShardedMuayene).where(and_(ShardedMuayene.id == exam_id, ShardedMuayene.is_deleted == False))
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    @audited(action="CLINICAL_VIEW", resource_type="patient", id_arg_name="patient_id")
    async def get_examinations_by_patient(self, patient_id: UUID) -> List[ShardedMuayene]:
        stmt = select(ShardedMuayene).where(
            and_(ShardedMuayene.hasta_id == patient_id, ShardedMuayene.is_deleted == False)
        ).order_by(ShardedMuayene.tarih.desc())
        result = await self.session.execute(stmt)
        return result.scalars().all()

    @audited(action="CLINICAL_CREATE", resource_type="patient")
    async def create_examination(self, exam_in: dict) -> ShardedMuayene:
        # Filter dict to only include keys that exist in the model
        valid_data = {k: v for k, v in exam_in.items() if hasattr(ShardedMuayene, k)}
        
        # Handle non-nullable tarih
        if not valid_data.get("tarih"):
            valid_data["tarih"] = datetime.now()
        elif isinstance(valid_data["tarih"], date) and not isinstance(valid_data["tarih"], datetime):
            valid_data["tarih"] = datetime.combine(valid_data["tarih"], datetime.min.time())
            
        db_exam = ShardedMuayene(**valid_data)
        if self.context:
            db_exam.created_by = self.context.user_id
        self.session.add(db_exam)
        await self.session.flush()
        await self.session.commit()
        await self.session.refresh(db_exam)
        return db_exam

    @audited(action="CLINICAL_UPDATE", resource_type="patient", id_arg_name="exam_id")
    async def update_examination(self, exam_id: int, exam_in: dict) -> Optional[ShardedMuayene]:
        db_exam = await self.get_examination(exam_id)
        if not db_exam:
            return None
        for field, value in exam_in.items():
            if hasattr(db_exam, field):
                setattr(db_exam, field, value)
        if self.context:
            db_exam.updated_by = self.context.user_id
        await self.session.flush()
        await self.session.commit()
        await self.session.refresh(db_exam)
        return db_exam

    async def get_all_muayeneler(self, start_date: Optional[str] = None, end_date: Optional[str] = None, search: Optional[str] = None) -> List[ShardedMuayene]:
        query = select(ShardedMuayene).where(ShardedMuayene.is_deleted == False)
        if start_date:
            query = query.where(ShardedMuayene.tarih >= start_date)
        if end_date:
            query = query.where(ShardedMuayene.tarih <= end_date)
        if search:
            query = query.where(
                or_(
                    ShardedMuayene.sikayet.ilike(f"%{search}%"),
                    ShardedMuayene.oyku.ilike(f"%{search}%"),
                    ShardedMuayene.tani1.ilike(f"%{search}%")
                )
            )
        result = await self.session.execute(query)
        return result.scalars().all()

    # --- Operations ---
    async def get_operation(self, op_id: int) -> Optional[ShardedOperasyon]:
        stmt = select(ShardedOperasyon).where(and_(ShardedOperasyon.id == op_id, ShardedOperasyon.is_deleted == False))
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_operations_by_patient(self, patient_id: UUID) -> List[ShardedOperasyon]:
        stmt = select(ShardedOperasyon).where(
            and_(ShardedOperasyon.hasta_id == patient_id, ShardedOperasyon.is_deleted == False)
        ).order_by(ShardedOperasyon.tarih.desc())
        result = await self.session.execute(stmt)
        return result.scalars().all()

    async def create_operation(self, op_in: dict) -> ShardedOperasyon:
        valid_data = {k: v for k, v in op_in.items() if hasattr(ShardedOperasyon, k)}
        db_op = ShardedOperasyon(**valid_data)
        if self.context:
            db_op.created_by = self.context.user_id
        self.session.add(db_op)
        await self.session.flush()
        await self.session.commit()
        await self.session.refresh(db_op)
        return db_op

    async def update_operation(self, op_id: int, op_in: dict) -> Optional[ShardedOperasyon]:
        db_op = await self.get_operation(op_id)
        if not db_op:
            return None
        for field, value in op_in.items():
            if hasattr(db_op, field):
                setattr(db_op, field, value)
        if self.context:
            db_op.updated_by = self.context.user_id
        await self.session.flush()
        await self.session.commit()
        await self.session.refresh(db_op)
        return db_op

    async def get_all_operasyonlar(self, start_date: Optional[str] = None, end_date: Optional[str] = None, search: Optional[str] = None) -> List[ShardedOperasyon]:
        query = select(ShardedOperasyon).where(ShardedOperasyon.is_deleted == False)
        if start_date:
            query = query.where(ShardedOperasyon.tarih >= start_date)
        if end_date:
            query = query.where(ShardedOperasyon.tarih <= end_date)
        if search:
            query = query.where(ShardedOperasyon.ameliyat.ilike(f"%{search}%"))
        result = await self.session.execute(query)
        return result.scalars().all()

    # --- Clinical Notes ---
    async def get_notes_by_patient(self, patient_id: UUID) -> List[ShardedClinicalNote]:
        stmt = select(ShardedClinicalNote).where(
            and_(ShardedClinicalNote.hasta_id == patient_id, ShardedClinicalNote.is_deleted == False)
        ).order_by(ShardedClinicalNote.tarih.desc())
        result = await self.session.execute(stmt)
        return result.scalars().all()

    async def create_note(self, note_in: dict) -> ShardedClinicalNote:
        db_note = ShardedClinicalNote(**note_in)
        if self.context:
            db_note.created_by = self.context.user_id
        self.session.add(db_note)
        await self.session.flush()
        return db_note

    async def update_note(self, note_id: int, note_in: dict) -> Optional[ShardedClinicalNote]:
        stmt = select(ShardedClinicalNote).where(and_(ShardedClinicalNote.id == note_id, ShardedClinicalNote.is_deleted == False))
        res = await self.session.execute(stmt)
        db_note = res.scalar_one_or_none()
        if not db_note: return None
        for field, value in note_in.items():
            if hasattr(db_note, field):
                setattr(db_note, field, value)
        await self.session.flush()
        return db_note

    # --- Combined Follow-up (Takip/Notes) ---
    async def get_takip_by_patient(self, patient_id: UUID) -> List[dict]:
        notes = await self.get_notes_by_patient(patient_id)
        exams = await self.get_examinations_by_patient(patient_id)
        
        combined = []
        for n in notes:
            combined.append({
                "id": n.id, "hasta_id": n.hasta_id, "tarih": n.tarih, "tur": n.tip,
                "notlar": n.icerik, "durum": n.sembol, "etiketler": n.etiketler, "created_at": n.created_at
            })
        for m in exams:
            full_note = " | ".join(filter(None, [f"Şikayet: {m.sikayet}" if m.sikayet else None, f"Öykü: {m.oyku}" if m.oyku else None]))
            combined.append({
                "id": m.id, "hasta_id": m.hasta_id, "tarih": m.tarih, "tur": "Muayene",
                "notlar": full_note, "durum": "Normal", "created_at": m.created_at
            })
        
        combined.sort(key=lambda x: x.get('tarih') or x.get('created_at') or datetime.min, reverse=True)
        return combined

    async def get_takip_note(self, note_id: int) -> Optional[ShardedClinicalNote]:
        stmt = select(ShardedClinicalNote).where(and_(ShardedClinicalNote.id == note_id, ShardedClinicalNote.is_deleted == False))
        res = await self.session.execute(stmt)
        return res.scalar_one_or_none()

    @audited(action="TAKIP_CREATE", resource_type="patient")
    async def create_takip(self, takip_in: Any) -> dict:
        data = takip_in.model_dump() if hasattr(takip_in, 'model_dump') else takip_in
        mapped_data = {
            "hasta_id": data.get("hasta_id"),
            "tarih": data.get("tarih"),
            "tip": data.get("tur"),
            "icerik": data.get("notlar"),
            "sembol": data.get("durum"),
            "etiketler": data.get("etiketler")
        }
        db_note = ShardedClinicalNote(**mapped_data)
        if self.context: db_note.created_by = self.context.user_id
        self.session.add(db_note)
        await self.session.flush()
        await self.session.commit()
        await self.session.refresh(db_note)
        return {
            "id": db_note.id, "hasta_id": db_note.hasta_id, "tarih": db_note.tarih,
            "tur": db_note.tip, "notlar": db_note.icerik, "durum": db_note.sembol,
            "etiketler": db_note.etiketler, "created_at": db_note.created_at
        }

    async def update_takip(self, id: int, takip_in: Any) -> Optional[dict]:
        db_note = await self.get_takip_note(id)
        if not db_note: return None
        data = takip_in.model_dump(exclude_unset=True) if hasattr(takip_in, 'model_dump') else takip_in
        
        mapping = {"tur": "tip", "notlar": "icerik", "durum": "sembol"}
        for k, v in data.items():
            db_field = mapping.get(k, k)
            if hasattr(db_note, db_field):
                setattr(db_note, db_field, v)
        
        if self.context: db_note.updated_by = self.context.user_id
        await self.session.flush()
        await self.session.commit()
        await self.session.refresh(db_note)
        return {
            "id": db_note.id, "hasta_id": db_note.hasta_id, "tarih": db_note.tarih,
            "tur": db_note.tip, "notlar": db_note.icerik, "durum": db_note.sembol,
            "etiketler": db_note.etiketler, "created_at": db_note.created_at
        }

    async def delete_takip(self, id: int) -> bool:
        stmt = update(ShardedClinicalNote).where(ShardedClinicalNote.id == id).values(is_deleted=True)
        res = await self.session.execute(stmt)
        await self.session.commit()
        return res.rowcount > 0

    # --- Tetkikler (Imagings/Labs) ---
    async def get_tetkikler_by_patient(self, patient_id: UUID, kategori: Optional[str] = None) -> List[ShardedTetkikSonuc]:
        conditions = [ShardedTetkikSonuc.hasta_id == patient_id, ShardedTetkikSonuc.is_deleted == False]
        if kategori:
            conditions.append(ShardedTetkikSonuc.kategori == kategori)
        stmt = select(ShardedTetkikSonuc).where(and_(*conditions)).order_by(ShardedTetkikSonuc.tarih.desc())
        result = await self.session.execute(stmt)
        return result.scalars().all()

    async def get_tetkik_sonuclari_by_patient(self, patient_id: UUID, kategori: Optional[str] = None) -> List[ShardedTetkikSonuc]:
        return await self.get_tetkikler_by_patient(patient_id, kategori)

    async def get_tetkik_sonuc(self, id: int) -> Optional[ShardedTetkikSonuc]:
        stmt = select(ShardedTetkikSonuc).where(and_(ShardedTetkikSonuc.id == id, ShardedTetkikSonuc.is_deleted == False))
        res = await self.session.execute(stmt)
        return res.scalar_one_or_none()

    async def create_tetkik_sonuc(self, obj_in: Any) -> ShardedTetkikSonuc:
        data = obj_in.model_dump() if hasattr(obj_in, 'model_dump') else obj_in
        db_obj = ShardedTetkikSonuc(**data)
        if self.context: db_obj.created_by = self.context.user_id
        self.session.add(db_obj)
        await self.session.flush()
        await self.session.commit()
        await self.session.refresh(db_obj)
        return db_obj

    async def update_tetkik_sonuc(self, id: int, obj_in: Any) -> Optional[ShardedTetkikSonuc]:
        db_obj = await self.get_tetkik_sonuc(id)
        if not db_obj: return None
        data = obj_in.model_dump(exclude_unset=True) if hasattr(obj_in, 'model_dump') else obj_in
        for k, v in data.items():
            if hasattr(db_obj, k): setattr(db_obj, k, v)
        await self.session.flush()
        await self.session.commit()
        await self.session.refresh(db_obj)
        return db_obj

    async def delete_tetkik_sonuc(self, id: int) -> bool:
        stmt = update(ShardedTetkikSonuc).where(ShardedTetkikSonuc.id == id).values(is_deleted=True)
        res = await self.session.execute(stmt)
        await self.session.commit()
        return res.rowcount > 0

    # --- Photos ---
    async def get_photos_by_patient(self, patient_id: UUID) -> List[ShardedFotografArsivi]:
        stmt = select(ShardedFotografArsivi).where(and_(ShardedFotografArsivi.hasta_id == patient_id, ShardedFotografArsivi.is_deleted == False))
        res = await self.session.execute(stmt)
        return res.scalars().all()

    async def create_photo(self, obj_in: Any) -> ShardedFotografArsivi:
        data = obj_in.model_dump() if hasattr(obj_in, 'model_dump') else obj_in
        db_obj = ShardedFotografArsivi(**data)
        if self.context: db_obj.created_by = self.context.user_id
        self.session.add(db_obj)
        await self.session.flush()
        await self.session.commit()
        await self.session.refresh(db_obj)
        return db_obj

    async def update_photo(self, id: int, obj_in: Any) -> Optional[ShardedFotografArsivi]:
        stmt = select(ShardedFotografArsivi).where(and_(ShardedFotografArsivi.id == id, ShardedFotografArsivi.is_deleted == False))
        res = await self.session.execute(stmt)
        db_obj = res.scalar_one_or_none()
        if not db_obj: return None
        data = obj_in.model_dump(exclude_unset=True) if hasattr(obj_in, 'model_dump') else obj_in
        for k, v in data.items():
            if hasattr(db_obj, k): setattr(db_obj, k, v)
        await self.session.flush()
        await self.session.commit()
        await self.session.refresh(db_obj)
        return db_obj

    async def delete_photo(self, id: int) -> bool:
        stmt = update(ShardedFotografArsivi).where(ShardedFotografArsivi.id == id).values(is_deleted=True)
        res = await self.session.execute(stmt)
        await self.session.commit()
        return res.rowcount > 0

    # --- Phone Calls ---
    async def get_phone_calls_by_patient(self, patient_id: UUID) -> List[ShardedTelefonGorusmesi]:
        stmt = select(ShardedTelefonGorusmesi).where(and_(ShardedTelefonGorusmesi.hasta_id == patient_id, ShardedTelefonGorusmesi.is_deleted == False)).order_by(ShardedTelefonGorusmesi.tarih.desc())
        res = await self.session.execute(stmt)
        return res.scalars().all()

    async def create_phone_call(self, obj_in: Any) -> ShardedTelefonGorusmesi:
        data = obj_in.model_dump() if hasattr(obj_in, 'model_dump') else obj_in
        db_obj = ShardedTelefonGorusmesi(**data)
        if self.context: db_obj.created_by = self.context.user_id
        self.session.add(db_obj)
        await self.session.flush()
        await self.session.commit()
        await self.session.refresh(db_obj)
        return db_obj

    async def update_phone_call(self, id: int, obj_in: Any) -> Optional[ShardedTelefonGorusmesi]:
        stmt = select(ShardedTelefonGorusmesi).where(and_(ShardedTelefonGorusmesi.id == id, ShardedTelefonGorusmesi.is_deleted == False))
        res = await self.session.execute(stmt)
        db_obj = res.scalar_one_or_none()
        if not db_obj: return None
        data = obj_in.model_dump(exclude_unset=True) if hasattr(obj_in, 'model_dump') else obj_in
        for k, v in data.items():
            if hasattr(db_obj, k): setattr(db_obj, k, v)
        await self.session.flush()
        await self.session.commit()
        await self.session.refresh(db_obj)
        return db_obj

    async def delete_phone_call(self, id: int) -> bool:
        stmt = update(ShardedTelefonGorusmesi).where(ShardedTelefonGorusmesi.id == id).values(is_deleted=True)
        res = await self.session.execute(stmt)
        await self.session.commit()
        return res.rowcount > 0

    # --- Reports (Rest, Status, Medical, Biopsy) ---
    async def _get_report_by_id(self, model, report_id: int):
        stmt = select(model).where(and_(model.id == report_id, model.is_deleted == False))
        res = await self.session.execute(stmt)
        return res.scalar_one_or_none()

    async def get_rest_reports_by_patient(self, patient_id: UUID) -> List[ShardedIstirahatRaporu]:
        stmt = select(ShardedIstirahatRaporu).where(and_(ShardedIstirahatRaporu.hasta_id == patient_id, ShardedIstirahatRaporu.is_deleted == False)).order_by(ShardedIstirahatRaporu.tarih.desc())
        res = await self.session.execute(stmt)
        return res.scalars().all()

    async def get_rest_report(self, id: int) -> Optional[ShardedIstirahatRaporu]:
        return await self._get_report_by_id(ShardedIstirahatRaporu, id)

    async def create_rest_report(self, obj_in: Any) -> ShardedIstirahatRaporu:
        data = obj_in.model_dump() if hasattr(obj_in, 'model_dump') else obj_in
        db_obj = ShardedIstirahatRaporu(**data)
        if self.context: db_obj.created_by = self.context.user_id
        self.session.add(db_obj)
        await self.session.flush()
        await self.session.commit()
        await self.session.refresh(db_obj)
        return db_obj

    async def update_rest_report(self, id: int, obj_in: Any) -> Optional[ShardedIstirahatRaporu]:
        db_obj = await self.get_rest_report(id)
        if not db_obj: return None
        data = obj_in.model_dump(exclude_unset=True) if hasattr(obj_in, 'model_dump') else obj_in
        for k, v in data.items():
            if hasattr(db_obj, k): setattr(db_obj, k, v)
        await self.session.flush()
        await self.session.commit()
        await self.session.refresh(db_obj)
        return db_obj

    async def delete_rest_report(self, id: int) -> bool:
        stmt = update(ShardedIstirahatRaporu).where(ShardedIstirahatRaporu.id == id).values(is_deleted=True)
        res = await self.session.execute(stmt)
        await self.session.commit()
        return res.rowcount > 0

    async def get_status_reports_by_patient(self, patient_id: UUID) -> List[ShardedDurumBildirirRaporu]:
        stmt = select(ShardedDurumBildirirRaporu).where(and_(ShardedDurumBildirirRaporu.hasta_id == patient_id, ShardedDurumBildirirRaporu.is_deleted == False)).order_by(ShardedDurumBildirirRaporu.tarih.desc())
        res = await self.session.execute(stmt)
        return res.scalars().all()

    async def get_status_report(self, id: int) -> Optional[ShardedDurumBildirirRaporu]:
        return await self._get_report_by_id(ShardedDurumBildirirRaporu, id)

    async def create_status_report(self, obj_in: Any) -> ShardedDurumBildirirRaporu:
        data = obj_in.model_dump() if hasattr(obj_in, 'model_dump') else obj_in
        db_obj = ShardedDurumBildirirRaporu(**data)
        if self.context: db_obj.created_by = self.context.user_id
        self.session.add(db_obj)
        await self.session.flush()
        await self.session.commit()
        await self.session.refresh(db_obj)
        return db_obj

    async def update_status_report(self, id: int, obj_in: Any) -> Optional[ShardedDurumBildirirRaporu]:
        db_obj = await self.get_status_report(id)
        if not db_obj: return None
        data = obj_in.model_dump(exclude_unset=True) if hasattr(obj_in, 'model_dump') else obj_in
        for k, v in data.items():
            if hasattr(db_obj, k): setattr(db_obj, k, v)
        await self.session.flush()
        await self.session.commit()
        await self.session.refresh(db_obj)
        return db_obj

    async def delete_status_report(self, id: int) -> bool:
        stmt = update(ShardedDurumBildirirRaporu).where(ShardedDurumBildirirRaporu.id == id).values(is_deleted=True)
        res = await self.session.execute(stmt)
        await self.session.commit()
        return res.rowcount > 0

    async def get_medical_reports_by_patient(self, patient_id: UUID) -> List[ShardedTibbiMudahaleRaporu]:
        stmt = select(ShardedTibbiMudahaleRaporu).where(and_(ShardedTibbiMudahaleRaporu.hasta_id == patient_id, ShardedTibbiMudahaleRaporu.is_deleted == False)).order_by(ShardedTibbiMudahaleRaporu.tarih.desc())
        res = await self.session.execute(stmt)
        return res.scalars().all()

    async def get_medical_report(self, id: int) -> Optional[ShardedTibbiMudahaleRaporu]:
        return await self._get_report_by_id(ShardedTibbiMudahaleRaporu, id)

    async def create_medical_report(self, obj_in: Any) -> ShardedTibbiMudahaleRaporu:
        data = obj_in.model_dump() if hasattr(obj_in, 'model_dump') else obj_in
        db_obj = ShardedTibbiMudahaleRaporu(**data)
        if self.context: db_obj.created_by = self.context.user_id
        self.session.add(db_obj)
        await self.session.flush()
        await self.session.commit()
        await self.session.refresh(db_obj)
        return db_obj

    async def update_medical_report(self, id: int, obj_in: Any) -> Optional[ShardedTibbiMudahaleRaporu]:
        db_obj = await self.get_medical_report(id)
        if not db_obj: return None
        data = obj_in.model_dump(exclude_unset=True) if hasattr(obj_in, 'model_dump') else obj_in
        for k, v in data.items():
            if hasattr(db_obj, k): setattr(db_obj, k, v)
        await self.session.flush()
        await self.session.commit()
        await self.session.refresh(db_obj)
        return db_obj

    async def delete_medical_report(self, id: int) -> bool:
        stmt = update(ShardedTibbiMudahaleRaporu).where(ShardedTibbiMudahaleRaporu.id == id).values(is_deleted=True)
        res = await self.session.execute(stmt)
        await self.session.commit()
        return res.rowcount > 0

    # --- Trus Biyopsi ---
    async def get_trus_biopsies_by_patient(self, patient_id: UUID) -> List[ShardedTrusBiyopsi]:
        stmt = select(ShardedTrusBiyopsi).where(and_(ShardedTrusBiyopsi.hasta_id == patient_id, ShardedTrusBiyopsi.is_deleted == False)).order_by(ShardedTrusBiyopsi.tarih.desc())
        res = await self.session.execute(stmt)
        return res.scalars().all()

    async def get_trus_biopsy(self, id: int) -> Optional[ShardedTrusBiyopsi]:
        return await self._get_report_by_id(ShardedTrusBiyopsi, id)

    async def create_trus_biopsy(self, obj_in: Any) -> ShardedTrusBiyopsi:
        data = obj_in.model_dump() if hasattr(obj_in, 'model_dump') else obj_in
        db_obj = ShardedTrusBiyopsi(**data)
        if self.context: db_obj.created_by = self.context.user_id
        self.session.add(db_obj)
        await self.session.flush()
        await self.session.commit()
        await self.session.refresh(db_obj)
        return db_obj

    async def update_trus_biopsy(self, id: int, obj_in: Any) -> Optional[ShardedTrusBiyopsi]:
        db_obj = await self.get_trus_biopsy(id)
        if not db_obj: return None
        data = obj_in.model_dump(exclude_unset=True) if hasattr(obj_in, 'model_dump') else obj_in
        for k, v in data.items():
            if hasattr(db_obj, k): setattr(db_obj, k, v)
        await self.session.flush()
        await self.session.commit()
        await self.session.refresh(db_obj)
        return db_obj

    async def delete_trus_biopsy(self, id: int) -> bool:
        stmt = update(ShardedTrusBiyopsi).where(ShardedTrusBiyopsi.id == id).values(is_deleted=True)
        res = await self.session.execute(stmt)
        await self.session.commit()
        return res.rowcount > 0

    # --- Logic ---
    async def get_latest_examinations_for_patients(self, patient_ids: List[UUID]) -> List[ShardedMuayene]:
        if not patient_ids:
            return []
        stmt = (
            select(ShardedMuayene)
            .where(and_(ShardedMuayene.hasta_id.in_(patient_ids), ShardedMuayene.is_deleted == False))
            .distinct(ShardedMuayene.hasta_id)
            .order_by(ShardedMuayene.hasta_id, ShardedMuayene.tarih.desc())
        )
        result = await self.session.execute(stmt)
        return result.scalars().all()

    # --- Deletes ---
    async def delete_examination(self, exam_id: int) -> bool:
        stmt = update(ShardedMuayene).where(ShardedMuayene.id == exam_id).values(is_deleted=True, updated_by=self.context.user_id if self.context else None)
        result = await self.session.execute(stmt)
        await self.session.flush()
        await self.session.commit()
        return result.rowcount > 0

    async def delete_operation(self, op_id: int) -> bool:
        stmt = update(ShardedOperasyon).where(ShardedOperasyon.id == op_id).values(is_deleted=True, updated_by=self.context.user_id if self.context else None)
        result = await self.session.execute(stmt)
        await self.session.flush()
        await self.session.commit()
        return result.rowcount > 0

    async def delete_note(self, note_id: int) -> bool:
        stmt = update(ShardedClinicalNote).where(ShardedClinicalNote.id == note_id).values(is_deleted=True, updated_by=self.context.user_id if self.context else None)
        result = await self.session.execute(stmt)
        await self.session.flush()
        await self.session.commit()
        return result.rowcount > 0

    @audited(action="CLINICAL_DELETE_ALL", resource_type="patient", id_arg_name="patient_id")
    async def delete_patient_clinical_data(self, patient_id: UUID) -> bool:
        """Logical delete of ALL clinical data for a patient."""
        models = [
            ShardedMuayene, ShardedOperasyon, ShardedClinicalNote, 
            ShardedTetkikSonuc, ShardedFotografArsivi, ShardedIstirahatRaporu,
            ShardedDurumBildirirRaporu, ShardedTibbiMudahaleRaporu, ShardedTrusBiyopsi,
            ShardedTelefonGorusmesi
        ]
        for model in models:
            stmt = (
                update(model)
                .where(model.hasta_id == patient_id)
                .values(is_deleted=True, updated_by=self.context.user_id if self.context else None)
            )
            await self.session.execute(stmt)
        await self.session.flush()
        await self.session.commit()
        return True

