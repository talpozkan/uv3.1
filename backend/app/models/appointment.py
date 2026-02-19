from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, Enum as SQLEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.models.base_class import Base
import enum

class AppointmentStatus(str, enum.Enum):
    scheduled = "scheduled"
    completed = "completed"
    cancelled = "cancelled"
    confirmed = "confirmed"
    unreachable = "unreachable"



class Randevu(Base):
    __tablename__ = "randevular"

    id = Column(Integer, primary_key=True, index=True)
    hasta_id = Column(UUID(as_uuid=True), ForeignKey("patient.sharded_patient_demographics.id"), nullable=True, index=True)
    
    title = Column(String, nullable=False)  # Randevu başlığı
    type = Column(String, nullable=True)    # Muayene, Kontrol, Operasyon, etc.
    
    start = Column(DateTime(timezone=True), nullable=False, index=True)
    end = Column(DateTime(timezone=True), nullable=False)
    
    status = Column(String, default="scheduled", index=True)  # scheduled, completed, cancelled, blocked
    notes = Column(Text, nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    doctor_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    doctor_name = Column(String, nullable=True)
    
    is_deleted = Column(Integer, default=0, index=True) # 0: aktif, 1: silindi
    cancel_reason = Column(String, nullable=True) # Zaman, Hastalık, Fiyat, Farklı Hekim, Randevu Süresi
    delete_reason = Column(Text, nullable=True) # Serbest metin gerekçe
    
    # Google Calendar Sync Fields
    google_event_id = Column(String, nullable=True, index=True)  # Google tarafındaki event ID
    google_calendar_id = Column(String, nullable=True)  # Hangi takvime senkronize edildi
    last_synced_at = Column(DateTime(timezone=True), nullable=True)

    # Relationship
    hasta = relationship("ShardedPatientDemographics", backref="randevular")
    doctor = relationship("User", backref="randevular")
