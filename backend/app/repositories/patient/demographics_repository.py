from typing import List, Optional
from uuid import UUID
from sqlalchemy import select, update, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession
from app.repositories.patient.models import ShardedPatientDemographics
from app.schemas.patient.demographics import PatientDemographicsCreate, PatientDemographicsUpdate
from app.core.user_context import UserContext
from app.core.audit import audited

class DemographicsRepository:
    def __init__(self, session: AsyncSession, context: Optional[UserContext] = None):
        self.session = session
        self.context = context

    @audited(action="PATIENT_VIEW", resource_type="patient", id_arg_name="patient_id")
    async def get_by_id(self, patient_id: UUID) -> Optional[ShardedPatientDemographics]:
        stmt = select(ShardedPatientDemographics).where(
            and_(ShardedPatientDemographics.id == patient_id, ShardedPatientDemographics.is_deleted == False)
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_multi(self, skip: int = 0, limit: int = 100, search: str = None, ad: str = None, soyad: str = None) -> List[ShardedPatientDemographics]:
        stmt = select(ShardedPatientDemographics).where(
            ShardedPatientDemographics.is_deleted == False
        )
        
        if ad:
            stmt = stmt.where(ShardedPatientDemographics.ad.ilike(f"%{ad}%"))
        if soyad:
            stmt = stmt.where(ShardedPatientDemographics.soyad.ilike(f"%{soyad}%"))
        if search:
            stmt = stmt.where(
                or_(
                    ShardedPatientDemographics.ad.ilike(f"%{search}%"),
                    ShardedPatientDemographics.soyad.ilike(f"%{search}%"),
                    ShardedPatientDemographics.tc_kimlik.ilike(f"%{search}%"),
                    ShardedPatientDemographics.protokol_no.ilike(f"%{search}%")
                )
            )

        stmt = stmt.order_by(ShardedPatientDemographics.updated_at.desc().nulls_last()).offset(skip).limit(limit)
        result = await self.session.execute(stmt)
        return result.scalars().all()

    @audited(action="PATIENT_CREATE", resource_type="patient")
    async def create(self, patient_in: PatientDemographicsCreate) -> ShardedPatientDemographics:
        # Protocol Generation Logic (Legacy Port)
        from sqlalchemy import text
        from datetime import date
        import json
        import random
        
        year = date.today().year
        year_str = str(year)
        last_digit = year_str[-1]
        
        # Get Year Code
        res = await self.session.execute(text("SELECT value FROM system_settings WHERE key = 'protocol_year_codes'"))
        row = res.first()
        year_codes = {}
        if row:
            try:
                year_codes = json.loads(row[0])
            except: pass
            
        if year_str not in year_codes:
            ALLOWED_CHARS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'J', 'K', 'L', 'M', 'N', 'P', 'R', 'S', 'T', 'U', 'V', 'Y', 'Z']
            c1, c2 = random.choice(ALLOWED_CHARS), random.choice(ALLOWED_CHARS)
            year_codes[year_str] = f"{c1}{c2}"
            await self.session.execute(text("INSERT INTO system_settings (key, value, description) VALUES ('protocol_year_codes', :val, 'Year mapping') ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value"), {"val": json.dumps(year_codes)})
            # We don't commit here, we rely on the orchestrator or session context
            
        code = year_codes[year_str]
        
        # 2. Find Max Sequence for THIS Year (prefix: CODE + LAST_DIGIT)
        prefix = f"{code}{last_digit}"
        res_max = await self.session.execute(
            text("SELECT MAX(CAST(SUBSTRING(protokol_no FROM 4) AS INTEGER)) FROM patient.sharded_patient_demographics "
                 "WHERE protokol_no LIKE :prefix || '%' AND LENGTH(protokol_no) >= 4"),
            {"prefix": prefix}
        )
        max_seq = res_max.scalar() or 0
        next_seq = max_seq + 1
        
        # 3. Format: CODE + Y + SEQ(padded to 4 digits)
        protocol_no = f"{code}{last_digit}{next_seq:04d}"
        
        data = patient_in.model_dump()
        # Filter fields that don't exist in the model (e.g. legacy tani fields)
        data = {k: v for k, v in data.items() if hasattr(ShardedPatientDemographics, k)}
        
        # Fix: Schema converts these to "Evet"/"Hayır", but Sharded Model needs Boolean
        if isinstance(data.get('sms_izin'), str):
             data['sms_izin'] = (data['sms_izin'] == "Evet")
        if isinstance(data.get('email_izin'), str):
             data['email_izin'] = (data['email_izin'] == "Evet")

        data['protokol_no'] = protocol_no
        
        db_patient = ShardedPatientDemographics(**data)
        if self.context:
            db_patient.created_by = self.context.user_id
        self.session.add(db_patient)
        await self.session.flush()
        # Ensure ID is generated/populated
        if not db_patient.id:
             await self.session.refresh(db_patient)

        return db_patient

        return db_patient

    @audited(action="PATIENT_UPDATE", resource_type="patient", id_arg_name="patient_id")
    async def update(self, patient_id: UUID, patient_in: PatientDemographicsUpdate) -> Optional[ShardedPatientDemographics]:
        db_patient = await self.get_by_id(patient_id)
        if not db_patient:
            return None
            
        update_data = patient_in.model_dump(exclude_unset=True)
        
        # Fix: Schema converts these to "Evet"/"Hayır", but Sharded Model needs Boolean
        if 'sms_izin' in update_data and isinstance(update_data['sms_izin'], str):
             update_data['sms_izin'] = (update_data['sms_izin'] == "Evet")
        if 'email_izin' in update_data and isinstance(update_data['email_izin'], str):
             update_data['email_izin'] = (update_data['email_izin'] == "Evet")

        for field, value in update_data.items():
            if hasattr(db_patient, field):
                setattr(db_patient, field, value)
            
        if self.context:
            db_patient.updated_by = self.context.user_id
            
        await self.session.flush()
        return db_patient

    @audited(action="PATIENT_DELETE", resource_type="patient", id_arg_name="patient_id")
    async def soft_delete(self, patient_id: UUID) -> bool:
        db_patient = await self.get_by_id(patient_id)
        if not db_patient:
            return False
            
        db_patient.is_deleted = True
        if self.context:
            db_patient.updated_by = self.context.user_id
            
        await self.session.flush()
        return True

    async def get_unique_references(self) -> List[str]:
        stmt = select(ShardedPatientDemographics.referans).distinct().where(
            and_(ShardedPatientDemographics.referans.isnot(None), ShardedPatientDemographics.referans != "", ShardedPatientDemographics.is_deleted == False)
        )
        result = await self.session.execute(stmt)
        return [row[0] for row in result.all()]
