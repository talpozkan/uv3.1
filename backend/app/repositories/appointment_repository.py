from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import and_
from sqlalchemy.orm import selectinload
from typing import List, Optional
from datetime import datetime
from app.models.appointment import Randevu
from app.schemas.appointment import RandevuCreate, RandevuUpdate

class AppointmentRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_all(self, start: Optional[datetime] = None, end: Optional[datetime] = None) -> List[Randevu]:
        query = select(Randevu).options(
            selectinload(Randevu.hasta),
            selectinload(Randevu.doctor)
        )
        conditions = []
        
        if start:
            # Event ends after the start of our window
            conditions.append(Randevu.end >= start)
        if end:
            # Event starts before the end of our window
            conditions.append(Randevu.start <= end)
        
        # Sadece silinmemişleri getir (Aktif randevular)
        from sqlalchemy import or_
        conditions.append(or_(Randevu.is_deleted != 1, Randevu.is_deleted.is_(None)))
        
        if conditions:
            query = query.filter(and_(*conditions))
        
        query = query.order_by(Randevu.start.desc())
        result = await self.db.execute(query)
        return result.scalars().all()

    async def get_by_id(self, randevu_id: int) -> Optional[Randevu]:
        result = await self.db.execute(
            select(Randevu).options(selectinload(Randevu.hasta)).filter(Randevu.id == randevu_id)
        )
        return result.scalars().first()

    async def get_by_patient(self, hasta_id: str) -> List[Randevu]:
        result = await self.db.execute(
            select(Randevu).options(selectinload(Randevu.hasta)).filter(Randevu.hasta_id == hasta_id).order_by(Randevu.start.desc())
        )
        return result.scalars().all()

    async def create(self, obj_in: RandevuCreate) -> Randevu:
        db_obj = Randevu(**obj_in.model_dump())
        self.db.add(db_obj)
        await self.db.commit()
        await self.db.refresh(db_obj)
        
        # Reload with relationship
        result = await self.db.execute(
            select(Randevu).options(
                selectinload(Randevu.hasta),
                selectinload(Randevu.doctor)
            ).filter(Randevu.id == db_obj.id)
        )
        return result.scalars().first()

    async def update(self, randevu_id: int, obj_in: RandevuUpdate) -> Optional[Randevu]:
        db_obj = await self.get_by_id(randevu_id)
        if not db_obj:
            return None
        
        update_data = obj_in.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(db_obj, field, value)
        
        await self.db.commit()
        await self.db.refresh(db_obj)
        
        # Reload with relationship
        result = await self.db.execute(
            select(Randevu).options(
                selectinload(Randevu.hasta),
                selectinload(Randevu.doctor)
            ).filter(Randevu.id == randevu_id)
        )
        return result.scalars().first()

    async def delete(self, randevu_id: int, reason: Optional[str] = None) -> bool:
        db_obj = await self.get_by_id(randevu_id)
        if not db_obj:
            return False
        
        db_obj.is_deleted = 1
        db_obj.delete_reason = reason
        await self.db.commit()
        return True
