from sqlalchemy import Column, Integer, String, Text, DateTime, func, Boolean
from sqlalchemy.dialects.postgresql import UUID
from app.db.base import Base

class ShardedMuayene(Base):
    __tablename__ = "sharded_clinical_muayeneler"
    __table_args__ = {"schema": "clinical"}
    
    id = Column(Integer, primary_key=True, index=True)
    hasta_id = Column(UUID(as_uuid=True), index=True)
    tarih = Column(DateTime, nullable=False)
    sikayet = Column(Text, nullable=True)
    oyku = Column(Text, nullable=True)
    bulgu_notu = Column(Text, nullable=True)
    tani1 = Column(String(255), nullable=True)
    tedavi = Column(Text, nullable=True)
    doktor = Column(String(100), nullable=True)
    
    # Extended Clinical Data (Legacy Migration)
    recete = Column(Text, nullable=True)
    ozgecmis = Column(Text, nullable=True)
    soygecmis = Column(Text, nullable=True)
    kullandigi_ilaclar = Column(Text, nullable=True)
    kan_sulandirici = Column(Integer, default=0, nullable=True)
    aliskanliklar = Column(Text, nullable=True)
    sistem_sorgu = Column(Text, nullable=True)
    ipss_skor = Column(String(50), nullable=True)
    iief_ef_skor = Column(String(50), nullable=True)
    iief_ef_answers = Column(Text, nullable=True)
    fizik_muayene = Column(Text, nullable=True)
    erektil_islev = Column(String(50), nullable=True)
    ejakulasyon = Column(String(50), nullable=True)
    mshq = Column(String(50), nullable=True)
    prosedur = Column(Text, nullable=True)
    allerjiler = Column(Text, nullable=True)
    
    # Diagnosis Extras
    tani1_kodu = Column(String(50), nullable=True)
    tani2 = Column(String(255), nullable=True)
    tani2_kodu = Column(String(50), nullable=True)
    tani3 = Column(String(255), nullable=True)
    tani3_kodu = Column(String(50), nullable=True)
    tani4 = Column(String(255), nullable=True)
    tani4_kodu = Column(String(50), nullable=True)
    tani5 = Column(String(255), nullable=True)
    tani5_kodu = Column(String(50), nullable=True)
    oneriler = Column(Text, nullable=True)
    sonuc = Column(Text, nullable=True)
    
    # Physical Exam Details
    tansiyon = Column(String(50), nullable=True)
    ates = Column(String(50), nullable=True)
    kvah = Column(String(50), nullable=True)
    bobrek_sag = Column(String(50), nullable=True)
    bobrek_sol = Column(String(50), nullable=True)
    suprapubik_kitle = Column(String(50), nullable=True)
    ego = Column(String(50), nullable=True)
    rektal_tuse = Column(Text, nullable=True)
    
    # Symptoms
    disuri = Column(String(10), nullable=True)
    pollakiuri = Column(String(10), nullable=True)
    nokturi = Column(String(10), nullable=True)
    hematuri = Column(String(10), nullable=True)
    genital_akinti = Column(String(10), nullable=True)
    kabizlik = Column(String(10), nullable=True)
    tas_oyku = Column(String(10), nullable=True)
    catallanma = Column(String(10), nullable=True)
    projeksiyon_azalma = Column(String(10), nullable=True)
    kalibre_incelme = Column(String(10), nullable=True)
    idrar_bas_zorluk = Column(String(10), nullable=True)
    kesik_idrar_yapma = Column(String(10), nullable=True)
    terminal_damlama = Column(String(10), nullable=True)
    residiv_hissi = Column(String(10), nullable=True)
    inkontinans = Column(String(10), nullable=True)
    
    # Audit & Soft Delete
    is_deleted = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    created_by = Column(Integer, nullable=True)
    updated_by = Column(Integer, nullable=True)

class ShardedOperasyon(Base):
    __tablename__ = "sharded_clinical_operasyonlar"
    __table_args__ = {"schema": "clinical"}
    
    id = Column(Integer, primary_key=True, index=True)
    hasta_id = Column(UUID(as_uuid=True), index=True)
    tarih = Column(DateTime, nullable=True)
    ameliyat = Column(String(255), nullable=True) # Legacy: 'ameliyat' instead of 'ad'
    
    pre_op_tani = Column(String(255), nullable=True)
    post_op_tani = Column(String(255), nullable=True)
    
    ekip = Column(Text, nullable=True)
    hemsire = Column(String(100), nullable=True)
    anestezi_ekip = Column(String(100), nullable=True)
    anestezi_tur = Column(String(50), nullable=True)
    
    notlar = Column(Text, nullable=True)
    patoloji = Column(Text, nullable=True)
    post_op = Column(Text, nullable=True)
    video_url = Column(String(255), nullable=True)
    
    # Audit & Soft Delete
    is_deleted = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    created_by = Column(Integer, nullable=True)
    updated_by = Column(Integer, nullable=True)

class ShardedClinicalNote(Base):
    __tablename__ = "sharded_clinical_notlar"
    __table_args__ = {"schema": "clinical"}
    
    id = Column(Integer, primary_key=True, index=True)
    hasta_id = Column(UUID(as_uuid=True), index=True)
    tarih = Column(DateTime, nullable=True)
    tip = Column(String(100), nullable=True) # Legacy: 'tip'
    icerik = Column(Text, nullable=True) # Legacy: 'icerik'
    sembol = Column(String(50), nullable=True)
    etiketler = Column(String(255), nullable=True)
    
    # Audit & Soft Delete
    is_deleted = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    created_by = Column(Integer, nullable=True)
    updated_by = Column(Integer, nullable=True)

class ShardedTetkikSonuc(Base):
    __tablename__ = "sharded_clinical_tetkikler"
    __table_args__ = {"schema": "clinical"}
    
    id = Column(Integer, primary_key=True, index=True)
    hasta_id = Column(UUID(as_uuid=True), index=True)
    tarih = Column(DateTime, nullable=True)
    kategori = Column(String(50), nullable=True) # Goruntuleme, Laboratuvar
    tetkik_adi = Column(String(255), nullable=True)
    sonuc = Column(Text, nullable=True)
    birim = Column(String(50), nullable=True)
    referans_araligi = Column(String(100), nullable=True)
    sembol = Column(String(50), nullable=True)
    dosya_yolu = Column(String(255), nullable=True)
    dosya_adi = Column(String(255), nullable=True)
    
    # Audit & Soft Delete
    is_deleted = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    created_by = Column(Integer, nullable=True)
    updated_by = Column(Integer, nullable=True)

class ShardedFotografArsivi(Base):
    __tablename__ = "sharded_clinical_fotograflar"
    __table_args__ = {"schema": "clinical"}
    
    id = Column(Integer, primary_key=True, index=True)
    hasta_id = Column(UUID(as_uuid=True), index=True)
    tarih = Column(DateTime, nullable=True)
    asama = Column(String(50), nullable=True)
    etiketler = Column(String(255), nullable=True)
    dosya_yolu = Column(String(255), nullable=True)
    dosya_adi = Column(String(255), nullable=True)
    notlar = Column(Text, nullable=True)
    
    # Audit & Soft Delete
    is_deleted = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    created_by = Column(Integer, nullable=True)
    updated_by = Column(Integer, nullable=True)

# Other report models... (Rest, Status, etc. following same pattern)
class ShardedIstirahatRaporu(Base):
    __tablename__ = "sharded_clinical_istirahat_raporlari"
    __table_args__ = {"schema": "clinical"}
    id = Column(Integer, primary_key=True, index=True)
    hasta_id = Column(UUID(as_uuid=True), index=True)
    tarih = Column(DateTime, nullable=True)
    baslangic_tarihi = Column(DateTime, nullable=True)
    bitis_tarihi = Column(DateTime, nullable=True)
    icd_kodu = Column(String(50), nullable=True)
    tani = Column(Text, nullable=True)
    karar = Column(String(100), nullable=True)
    kontrol_tarihi = Column(DateTime, nullable=True)
    is_deleted = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    created_by = Column(Integer, nullable=True)
    updated_by = Column(Integer, nullable=True)

class ShardedDurumBildirirRaporu(Base):
    __tablename__ = "sharded_clinical_durum_bildirir_raporlari"
    __table_args__ = {"schema": "clinical"}
    id = Column(Integer, primary_key=True, index=True)
    hasta_id = Column(UUID(as_uuid=True), index=True)
    tarih = Column(DateTime, nullable=True)
    tani_bulgular = Column(Text, nullable=True)
    icd_kodu = Column(String(50), nullable=True)
    sonuc_kanaat = Column(Text, nullable=True)
    is_deleted = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    created_by = Column(Integer, nullable=True)
    updated_by = Column(Integer, nullable=True)

class ShardedTibbiMudahaleRaporu(Base):
    __tablename__ = "sharded_clinical_tibbi_mudahale_raporlari"
    __table_args__ = {"schema": "clinical"}
    id = Column(Integer, primary_key=True, index=True)
    hasta_id = Column(UUID(as_uuid=True), index=True)
    tarih = Column(DateTime, nullable=True)
    islem_basligi = Column(String(255), nullable=True)
    islem_detayi = Column(Text, nullable=True)
    sonuc_oneriler = Column(Text, nullable=True)
    is_deleted = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    created_by = Column(Integer, nullable=True)
    updated_by = Column(Integer, nullable=True)

class ShardedTrusBiyopsi(Base):
    __tablename__ = "sharded_clinical_trus_biyopsileri"
    __table_args__ = {"schema": "clinical"}
    id = Column(Integer, primary_key=True, index=True)
    hasta_id = Column(UUID(as_uuid=True), index=True)
    tarih = Column(DateTime, nullable=True)
    psa_total = Column(String(50), nullable=True)
    rektal_tuse = Column(Text, nullable=True)
    mri_var = Column(Boolean, default=False)
    mri_tarih = Column(DateTime, nullable=True)
    mri_ozet = Column(Text, nullable=True)
    pirads_lezyon_boyut = Column(String(100), nullable=True)
    pirads_lezyon_lokasyon = Column(String(100), nullable=True)
    lokasyonlar = Column(Text, nullable=True) 
    prosedur_notu = Column(Text, nullable=True)
    is_deleted = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    created_by = Column(Integer, nullable=True)
    updated_by = Column(Integer, nullable=True)

class ShardedTelefonGorusmesi(Base):
    __tablename__ = "sharded_clinical_telefon_gorusmeleri"
    __table_args__ = {"schema": "clinical"}
    id = Column(Integer, primary_key=True, index=True)
    hasta_id = Column(UUID(as_uuid=True), index=True)
    tarih = Column(DateTime, nullable=True)
    notlar = Column(Text, nullable=True)
    doktor = Column(String(100), nullable=True)
    is_deleted = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    created_by = Column(Integer, nullable=True)
    updated_by = Column(Integer, nullable=True)
