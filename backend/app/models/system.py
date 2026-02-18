from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Numeric
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.models.base_class import Base

class ICDTani(Base):
    __tablename__ = "icd_tanilar"

    id = Column(Integer, primary_key=True, index=True)
    kodu = Column(String, unique=True, index=True, nullable=False)
    adi = Column(String, index=True, nullable=True)
    ust_kodu = Column(String, nullable=True)
    aktif = Column(String, nullable=True)
    seviye = Column(String, nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class SablonTanim(Base):
    __tablename__ = "sablon_tanimlari"

    id = Column(Integer, primary_key=True, index=True)
    grup = Column(String, index=True, nullable=False)
    kod = Column(String, index=True, nullable=True)
    icerik = Column(String, nullable=True)
    aktif = Column(Boolean, default=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())

class EkipUyesi(Base):
    __tablename__ = "ekip_uyeleri"

    id = Column(Integer, primary_key=True, index=True)
    ad_soyad = Column(String, nullable=False)
    gorev = Column(String, nullable=True)
    aktif = Column(Boolean, default=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())

class SystemSetting(Base):
    __tablename__ = "system_settings"

    key = Column(String, primary_key=True, index=True)
    value = Column(String, nullable=True) # JSON value stored as string if needed, or simple text
    description = Column(String, nullable=True)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), server_default=func.now())

class IlacTanim(Base):
    __tablename__ = "ilac_tanimlari"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True, nullable=False)
    barcode = Column(String, index=True, nullable=True) # Barkod
    
    # Generic fields that might come from the excel
    etkin_madde = Column(String, nullable=True) 
    atc_kodu = Column(String, nullable=True)
    fiyat = Column(String, nullable=True)
    firma = Column(String, nullable=True)
    recete_tipi = Column(String, nullable=True) # Normal, Kırmızı, Yeşil vs.
    
    aktif = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), server_default=func.now())
