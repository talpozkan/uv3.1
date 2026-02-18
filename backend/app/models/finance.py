from sqlalchemy import Column, Integer, String, Boolean, DateTime, Date, ForeignKey, Numeric, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.models.base_class import Base


# =============================================================================
# 1. FİNANS KATEGORİLERİ (Gelir/Gider Kategorileri)
# =============================================================================
class FinansKategori(Base):
    """Gelir ve gider kategorileri için tablo"""
    __tablename__ = "finans_kategoriler"

    id = Column(Integer, primary_key=True, index=True)
    ad = Column(String(100), nullable=False)
    tip = Column(String(20), nullable=False)  # 'gelir', 'gider'
    ust_kategori_id = Column(Integer, ForeignKey("finans_kategoriler.id"), nullable=True)
    renk = Column(String(7), nullable=True)  # Hex color code
    ikon = Column(String(50), nullable=True)
    aktif = Column(Boolean, default=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    alt_kategoriler = relationship("FinansKategori", backref="ust_kategori", remote_side=[id])


# =============================================================================
# 2. HİZMET/ÜRÜN TANIMLARI
# =============================================================================
class FinansHizmet(Base):
    """Hizmet ve ürün tanımları - satış formunda kullanılır"""
    __tablename__ = "finans_hizmetler"

    id = Column(Integer, primary_key=True, index=True)
    ad = Column(String(200), nullable=False)
    kod = Column(String(20), nullable=True)  # SUT kodu veya iç kod
    kategori = Column(String(100), nullable=True)
    varsayilan_fiyat = Column(Numeric(12, 2), nullable=True)
    kdv_orani = Column(Integer, default=0)  # 0, 1, 10, 20
    aktif = Column(Boolean, default=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())


# =============================================================================
# 3. KASALAR (Kasa/Banka Hesap Tanımları)
# =============================================================================
class Kasa(Base):
    """Nakit kasa, banka hesabı ve POS tanımları"""
    __tablename__ = "kasalar"

    id = Column(Integer, primary_key=True, index=True)
    ad = Column(String(100), nullable=False)
    tip = Column(String(20), nullable=False)  # 'nakit', 'banka', 'pos'
    bakiye = Column(Numeric(12, 2), default=0)
    para_birimi = Column(String(3), default='TRY')
    banka_adi = Column(String(100), nullable=True)
    iban = Column(String(34), nullable=True)
    aktif = Column(Boolean, default=True)
    sira_no = Column(Integer, default=0)

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    hareketler = relationship("KasaHareket", back_populates="kasa")


# =============================================================================
# 4. KASA HAREKETLERİ (Giriş/Çıkış Logları)
# =============================================================================
class KasaHareket(Base):
    """Kasa giriş ve çıkış hareketlerinin log kaydı"""
    __tablename__ = "kasa_hareketler"

    id = Column(Integer, primary_key=True, index=True)
    kasa_id = Column(Integer, ForeignKey("kasalar.id"), nullable=False, index=True)
    islem_id = Column(Integer, ForeignKey("finans_islemler.id"), nullable=True)
    odeme_id = Column(Integer, ForeignKey("finans_odemeler.id"), nullable=True)
    tarih = Column(DateTime(timezone=True), server_default=func.now())
    hareket_tipi = Column(String(10), nullable=False)  # 'giris', 'cikis'
    tutar = Column(Numeric(12, 2), nullable=False)
    onceki_bakiye = Column(Numeric(12, 2), nullable=True)
    sonraki_bakiye = Column(Numeric(12, 2), nullable=True)
    aciklama = Column(Text, nullable=True)
    created_by = Column(String(100), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    kasa = relationship("Kasa", back_populates="hareketler")


# =============================================================================
# 5. FİRMALAR (Tedarikçi/Firma Bilgileri)
# =============================================================================
class Firma(Base):
    """Tedarikçi ve firma bilgileri"""
    __tablename__ = "firmalar"

    id = Column(Integer, primary_key=True, index=True)
    ad = Column(String(200), nullable=False)
    vergi_no = Column(String(20), nullable=True)
    telefon = Column(String(20), nullable=True)
    email = Column(String(100), nullable=True)
    adres = Column(Text, nullable=True)
    notlar = Column(Text, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    islemler = relationship("FinansIslem", back_populates="firma")


# =============================================================================
# 6. FİNANS İŞLEMLERİ (Ana İşlem Tablosu)
# =============================================================================
class FinansIslem(Base):
    """Gelir ve gider işlemlerinin ana tablosu"""
    __tablename__ = "finans_islemler"

    id = Column(Integer, primary_key=True, index=True)
    referans_kodu = Column(String(20), unique=True, nullable=False, index=True)  # GEL-2026-00001
    hasta_id = Column(UUID(as_uuid=True), ForeignKey("patient.sharded_patient_demographics.id"), nullable=True, index=True)
    muayene_id = Column(Integer, ForeignKey("clinical.sharded_clinical_muayeneler.id"), nullable=True)  # Integer - uyumlu tip
    tarih = Column(Date, nullable=False)
    islem_tipi = Column(String(20), nullable=False)  # 'gelir', 'gider', 'transfer'
    durum = Column(String(20), default='tamamlandi')  # 'tamamlandi', 'bekliyor', 'iptal'
    kategori_id = Column(Integer, ForeignKey("finans_kategoriler.id"), nullable=True)
    aciklama = Column(Text, nullable=True)
    
    # Tutar bilgileri
    tutar = Column(Numeric(12, 2), nullable=False)
    kdv_orani = Column(Integer, default=0)  # 0, 1, 10, 20
    kdv_tutari = Column(Numeric(12, 2), default=0)
    net_tutar = Column(Numeric(12, 2), nullable=False)
    para_birimi = Column(String(3), default='TRY')
    
    # İlişkiler
    kasa_id = Column(Integer, ForeignKey("kasalar.id"), nullable=True)
    firma_id = Column(Integer, ForeignKey("firmalar.id"), nullable=True)
    doktor = Column(String(100), nullable=True)
    
    # Vade ve notlar
    vade_tarihi = Column(Date, nullable=True)
    notlar = Column(Text, nullable=True)
    belge_url = Column(Text, nullable=True)  # Fiş/fatura görseli
    
    # İptal bilgileri
    iptal_tarihi = Column(DateTime(timezone=True), nullable=True)
    iptal_nedeni = Column(Text, nullable=True)
    
    # Audit
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    created_by = Column(String(100), nullable=True)

    # Relationships
    satirlar = relationship("FinansIslemSatir", back_populates="islem", cascade="all, delete-orphan")
    odemeler = relationship("FinansOdeme", back_populates="islem", cascade="all, delete-orphan")
    kategori = relationship("FinansKategori")
    firma = relationship("Firma", back_populates="islemler")
    kasa = relationship("Kasa")


# =============================================================================
# 7. FİNANS İŞLEM SATIRLARI (İşlem Detay Satırları)
# =============================================================================
class FinansIslemSatir(Base):
    """İşlem detay satırları - hizmet/ürün bazlı"""
    __tablename__ = "finans_islem_satirlari"

    id = Column(Integer, primary_key=True, index=True)
    islem_id = Column(Integer, ForeignKey("finans_islemler.id", ondelete="CASCADE"), nullable=False, index=True)
    hizmet_id = Column(Integer, ForeignKey("finans_hizmetler.id"), nullable=True)
    hizmet_adi = Column(String(200), nullable=False)
    adet = Column(Integer, default=1)
    birim_fiyat = Column(Numeric(12, 2), nullable=False)
    toplam = Column(Numeric(12, 2), nullable=False)
    doktor = Column(String(100), nullable=True)

    # Relationships
    islem = relationship("FinansIslem", back_populates="satirlar")
    hizmet = relationship("FinansHizmet")


# =============================================================================
# 8. FİNANS ÖDEMELERİ (Ödeme Detayları)
# =============================================================================
class FinansOdeme(Base):
    """Ödeme detayları - parçalı ödemeler için"""
    __tablename__ = "finans_odemeler"

    id = Column(Integer, primary_key=True, index=True)
    islem_id = Column(Integer, ForeignKey("finans_islemler.id", ondelete="CASCADE"), nullable=False, index=True)
    kasa_id = Column(Integer, ForeignKey("kasalar.id"), nullable=True)
    odeme_tarihi = Column(Date, nullable=False)
    tutar = Column(Numeric(12, 2), nullable=False)
    odeme_yontemi = Column(String(30), nullable=False)  # 'nakit', 'kredi_karti', 'havale', 'sgk', 'ozel_sigorta', 'diger'
    banka = Column(String(100), nullable=True)
    taksit_sayisi = Column(Integer, default=1)
    kapora = Column(Boolean, default=False)
    notlar = Column(Text, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    islem = relationship("FinansIslem", back_populates="odemeler")
    taksitler = relationship("FinansTaksit", back_populates="odeme", cascade="all, delete-orphan")
    kasa = relationship("Kasa")


# =============================================================================
# 9. FİNANS TAKSİTLERİ (Taksit Takibi)
# =============================================================================
class FinansTaksit(Base):
    """Taksitli ödemelerin takibi"""
    __tablename__ = "finans_taksitler"

    id = Column(Integer, primary_key=True, index=True)
    odeme_id = Column(Integer, ForeignKey("finans_odemeler.id", ondelete="CASCADE"), nullable=False, index=True)
    taksit_no = Column(Integer, nullable=False)
    tutar = Column(Numeric(12, 2), nullable=False)
    vade_tarihi = Column(Date, nullable=False)
    tahsil_tarihi = Column(Date, nullable=True)
    durum = Column(String(20), default='bekliyor')  # 'bekliyor', 'tahsil_edildi'

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    odeme = relationship("FinansOdeme", back_populates="taksitler")


# =============================================================================
# ESKİ MODELLER (Geriye Uyumluluk için korunuyor)
# =============================================================================

class Kurum(Base):
    """Kurum bilgileri (eski model - geriye uyumluluk)"""
    __tablename__ = "kurumlar"

    id = Column(Integer, primary_key=True, index=True)
    ad = Column(String, nullable=False)
    
    adres = Column(String, nullable=True)
    vergi_dairesi = Column(String, nullable=True)
    vergi_no = Column(String, nullable=True)
    telefon = Column(String, nullable=True)
    faks = Column(String, nullable=True)
    yetkili = Column(String, nullable=True)
    notlar = Column(String, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())


class KasaTanim(Base):
    """Kasa tanımları (eski model - geriye uyumluluk)"""
    __tablename__ = "kasa_tanimlari"

    id = Column(Integer, primary_key=True, index=True)
    ad = Column(String, nullable=False)  # Örn: Nakit Kasa - TL, Garanti POS, İş Bankası Havale
    tip = Column(String, nullable=False)  # NAKIT, BANKA, POS
    para_birimi = Column(String, default="TL")
    bakiye = Column(Numeric(12, 2), default=0)  # Kasa bakiyesi
    aktif = Column(Boolean, default=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())


class HizmetTanim(Base):
    """Hizmet tanımları (eski model - geriye uyumluluk)"""
    __tablename__ = "hizmet_tanimlari"

    id = Column(Integer, primary_key=True, index=True)
    ad = Column(String, nullable=False)
    kod = Column(String, nullable=True)
    fiyat = Column(Numeric(10, 2), nullable=True)
    para_birimi = Column(String, default="TL")
    kdv_orani = Column(Integer, default=0)
    aktif = Column(Boolean, default=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())


class HastaFinansHareket(Base):
    """Hasta finans hareketleri (eski model - geriye uyumluluk)"""
    __tablename__ = "hasta_finans_hareketleri"

    id = Column(Integer, primary_key=True, index=True)
    hasta_id = Column(UUID(as_uuid=True), ForeignKey("patient.sharded_patient_demographics.id"), nullable=False, index=True)
    
    tarih = Column(DateTime, default=func.now(), index=True)
    muayene_id = Column(Integer, ForeignKey("clinical.sharded_clinical_muayeneler.id"), nullable=True)
    islem_tipi = Column(String, nullable=False)  # HIZMET (Borç), TAHSILAT (Alacak)
    
    # Hizmet Detayları (HIZMET tipinde dolu olur)
    hizmet_id = Column(Integer, ForeignKey("finans_hizmetler.id"), nullable=True)
    
    # Ödeme Detayları (TAHSILAT tipinde dolu olur)
    kasa_id = Column(Integer, ForeignKey("kasalar.id"), nullable=True)
    odeme_yontemi = Column(String, nullable=True)  # Kredi Kartı, Nakit, Havale/EFT
    odeme_araci = Column(String(100), nullable=True) # Banka, POS Cihazı vb.
    referans_kodu = Column(String(10), unique=True, nullable=True)
    
    aciklama = Column(String, nullable=True)
    
    borc = Column(Numeric(10, 2), default=0)   # İşlem Tutarı
    alacak = Column(Numeric(10, 2), default=0)  # Ödeme Tutarı
    bakiye = Column(Numeric(10, 2), nullable=True)  # O anki bakiye
    
    doktor = Column(String, nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
