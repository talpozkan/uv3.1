from sqlalchemy import Column, Integer, String, Boolean, Date, DateTime, Text, Numeric, func
from sqlalchemy.dialects.postgresql import UUID
from app.db.base import Base

class ShardedFinansIslem(Base):
    __tablename__ = "sharded_finance_islemler"
    __table_args__ = {"schema": "finance"}
    
    id = Column(Integer, primary_key=True, index=True)
    referans_kodu = Column(String(20), unique=True, nullable=False, index=True)
    hasta_id = Column(UUID(as_uuid=True), index=True, nullable=True)
    muayene_id = Column(Integer, index=True, nullable=True)
    tarih = Column(Date, nullable=False)
    islem_tipi = Column(String(20), nullable=False) # gelir, gider
    tutar = Column(Numeric(12, 2), default=0)
    net_tutar = Column(Numeric(12, 2), nullable=False)
    para_birimi = Column(String(3), default='TRY')
    durum = Column(String(20), default='bekliyor') # bekliyor, tamamlandi, iptal
    aciklama = Column(Text, nullable=True)
    doktor = Column(String(100), nullable=True)
    
    # Audit & Soft Delete
    is_deleted = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    created_by = Column(Integer, nullable=True)
    updated_by = Column(Integer, nullable=True)


class ShardedFinansKategori(Base):
    __tablename__ = "finans_kategoriler"
    __table_args__ = {"schema": "finance"}

    id = Column(Integer, primary_key=True, index=True)
    ad = Column(String(100), nullable=False)
    tip = Column(String(20), nullable=False)
    ust_kategori_id = Column(Integer, nullable=True)
    renk = Column(String(7), nullable=True)
    ikon = Column(String(50), nullable=True)
    aktif = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class ShardedFinansHizmet(Base):
    __tablename__ = "finans_hizmetler"
    __table_args__ = {"schema": "finance"}

    id = Column(Integer, primary_key=True, index=True)
    ad = Column(String(200), nullable=False)
    kod = Column(String(20), nullable=True)
    kategori = Column(String(100), nullable=True)
    varsayilan_fiyat = Column(Numeric(12, 2), nullable=True)
    kdv_orani = Column(Integer, default=0)
    aktif = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class ShardedKasa(Base):
    __tablename__ = "kasalar"
    __table_args__ = {"schema": "finance"}

    id = Column(Integer, primary_key=True, index=True)
    ad = Column(String(100), nullable=False)
    tip = Column(String(20), nullable=False)
    bakiye = Column(Numeric(12, 2), default=0)
    para_birimi = Column(String(3), default='TRY')
    banka_adi = Column(String(100), nullable=True)
    iban = Column(String(34), nullable=True)
    aktif = Column(Boolean, default=True)
    sira_no = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class ShardedKasaHareket(Base):
    __tablename__ = "kasa_hareketleri"
    __table_args__ = {"schema": "finance"}

    id = Column(Integer, primary_key=True, index=True)
    kasa_id = Column(Integer, nullable=False)
    hareket_tipi = Column(String(20), nullable=False) # giris, cikis
    tutar = Column(Numeric(12, 2), nullable=False)
    onceki_bakiye = Column(Numeric(12, 2), nullable=True)
    sonraki_bakiye = Column(Numeric(12, 2), nullable=True)
    aciklama = Column(Text, nullable=True)
    islem_id = Column(Integer, nullable=True)
    tarih = Column(DateTime(timezone=True), server_default=func.now())


class ShardedFirma(Base):
    __tablename__ = "firmalar"
    __table_args__ = {"schema": "finance"}

    id = Column(Integer, primary_key=True, index=True)
    ad = Column(String(200), nullable=False)
    vergi_dairesi = Column(String(100), nullable=True)
    vergi_no = Column(String(20), nullable=True)
    telefon = Column(String(20), nullable=True)
    email = Column(String(100), nullable=True)
    adres = Column(Text, nullable=True)
    yetkili = Column(String(100), nullable=True)
    aktif = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class ShardedFinansIslemSatir(Base):
    __tablename__ = "finans_islem_satirlari"
    __table_args__ = {"schema": "finance"}

    id = Column(Integer, primary_key=True, index=True)
    islem_id = Column(Integer, index=True, nullable=False)
    hizmet_id = Column(Integer, nullable=True)
    aciklama = Column(String(255), nullable=True)
    miktar = Column(Numeric(10, 2), default=1)
    birim_fiyat = Column(Numeric(12, 2), nullable=False)
    kdv_orani = Column(Integer, default=0)
    toplam_tutar = Column(Numeric(12, 2), nullable=False)


class ShardedFinansOdeme(Base):
    __tablename__ = "finans_odemeler"
    __table_args__ = {"schema": "finance"}

    id = Column(Integer, primary_key=True, index=True)
    islem_id = Column(Integer, index=True, nullable=False)
    kasa_id = Column(Integer, nullable=True)
    odeme_yontemi = Column(String(50), nullable=False) # Nakit, Kredi Kartı, Havale
    tutar = Column(Numeric(12, 2), nullable=False)
    odeme_tarihi = Column(Date, nullable=False)
    taksit_sayisi = Column(Integer, default=1)


class ShardedFinansTaksit(Base):
    __tablename__ = "finans_taksitler"
    __table_args__ = {"schema": "finance"}

    id = Column(Integer, primary_key=True, index=True)
    odeme_id = Column(Integer, index=True, nullable=False)
    taksit_no = Column(Integer, nullable=False)
    tutar = Column(Numeric(12, 2), nullable=False)
    vade_tarihi = Column(Date, nullable=False)
    durum = Column(String(20), default='bekliyor')
