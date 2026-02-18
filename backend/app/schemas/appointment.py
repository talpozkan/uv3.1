from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from uuid import UUID

class RandevuBase(BaseModel):
    hasta_id: Optional[UUID] = None
    title: str
    type: Optional[str] = None
    start: datetime
    end: datetime
    status: Optional[str] = "scheduled"
    notes: Optional[str] = None
    doctor_id: Optional[int] = None
    doctor_name: Optional[str] = None

class RandevuCreate(RandevuBase):
    pass

class RandevuUpdate(BaseModel):
    title: Optional[str] = None
    type: Optional[str] = None
    start: Optional[datetime] = None
    end: Optional[datetime] = None
    status: Optional[str] = None
    notes: Optional[str] = None
    doctor_id: Optional[int] = None
    doctor_name: Optional[str] = None
    is_deleted: Optional[int] = None
    cancel_reason: Optional[str] = None
    delete_reason: Optional[str] = None

class HastaBasic(BaseModel):
    id: UUID
    ad: str
    soyad: str
    tc_kimlik: Optional[str] = None
    cep_tel: Optional[str] = None
    
    class Config:
        from_attributes = True

class RandevuResponse(RandevuBase):
    id: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    is_deleted: Optional[int] = 0
    cancel_reason: Optional[str] = None
    delete_reason: Optional[str] = None
    hasta: Optional[HastaBasic] = None
    
    class Config:
        from_attributes = True
