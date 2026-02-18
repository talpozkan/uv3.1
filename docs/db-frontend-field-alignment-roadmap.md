# DB-Frontend Alan Uyumlama Yol Haritası

## Özet

Bu doküman, `clinical.sharded_clinical_muayeneler` tablosu ile frontend Examination formu arasındaki alan uyumsuzluklarını gidermek için hazırlanmış bir yol haritasıdır.

---

## 🔴 Faz 1: Kritik - Veri Kaybı Önleme (Öncelik: YÜKSEK)

### Sorun

Frontend'de `tani3`, `tani4`, `tani5` alanları mevcut ancak DB şemasında karşılıkları yok. Kullanıcı 3+ tanı girdiğinde veri sessizce kaybolur.

### Eylemler

#### 1.1 DB Şema Güncellemesi

**Dosya:** `backend/app/repositories/clinical/models.py`

```python
# ShardedMuayene modeline eklenecek alanlar:
tani3 = Column(String(255), nullable=True)
tani3_kodu = Column(String(50), nullable=True)
tani4 = Column(String(255), nullable=True)
tani4_kodu = Column(String(50), nullable=True)
tani5 = Column(String(255), nullable=True)
tani5_kodu = Column(String(50), nullable=True)
```

#### 1.2 Veritabanı Migrasyonu

```bash
# Alembic migration oluştur
alembic revision --autogenerate -m "add_tani3_tani4_tani5_columns"
alembic upgrade head
```

#### 1.3 API Şema Güncellemesi

**Dosya:** `backend/app/schemas/muayene.py` - Yeni alanları ekle

#### 1.4 Frontend Form Validasyonu

Mevcut `DiagnosisForm` zaten bu alanları destekliyor, sadece API'ye gönderim doğrulanmalı.

---

## 🟡 Faz 2: Gizli DB Alanlarını Göster (Öncelik: ORTA)

### Sorun

DB'de veri saklanan ancak UI'da gösterilmeyen alanlar var.

### 2.1 `oneriler` Alanı

**Konum:** Tanı & Sonuç kartına eklenmeli

| Özellik | Değer |
|---------|-------|
| Label | "Öneriler" |
| Tip | Textarea |
| Placeholder | "Hastaya verilen öneriler..." |
| Dosya | `DiagnosisForm.tsx` |

### 2.2 `prosedur` Alanı

**Konum:** Muayene Bulguları kartına eklenmeli

| Özellik | Değer |
|---------|-------|
| Label | "Yapılan İşlem / Prosedür" |
| Tip | Textarea |
| Placeholder | "PRP, ESWT, Biyopsi vb." |
| Dosya | `PhysicalExamForm.tsx` |

### 2.3 `mshq` Alanı

**Konum:** IIEF/IPSS benzeri dialog olarak

| Özellik | Değer |
|---------|-------|
| Tip | Dialog + Anket Formu |
| Tetikleyici | QuestionnaireScoreCard butonları |
| Referans | IIEF dialog yapısı |

---

## 🟢 Faz 3: Alan İsimlendirme Tutarlılığı (Öncelik: DÜŞÜK)

### Sorun

Bazı alanlar DB ve frontend'de farklı isimlerle tanımlı.

| DB Alanı | Frontend Alanı | Aksiyon |
|----------|---------------|---------|
| `erektil_islev` | `erektilDisfonksiyon` | Frontend'i `erektil_islev`'e çevir |
| `aliskanliklar` | `sigara/alkol/sosyal` | Mevcut parse mantığı korunsun |

---

## 📋 Kontrol Listesi

### Faz 1 (Kritik)

- [ ] `ShardedMuayene` modeline tani3-5 ekle
- [ ] Alembic migration oluştur ve çalıştır
- [ ] API şemalarını güncelle
- [ ] Frontend formData -> API payload eşleşmesini doğrula
- [ ] Test: 5 tanı girip kaydet, verilerin korunduğunu doğrula

### Faz 2 (Gizli Alanlar)

- [ ] DiagnosisForm'a "Öneriler" textarea ekle
- [ ] PhysicalExamForm'a "Prosedür" textarea ekle
- [ ] MSHQ dialog bileşeni oluştur
- [ ] Test: Yeni alanları doldur, kaydet, yükle döngüsünü test et

### Faz 3 (Tutarlılık)

- [ ] `erektilDisfonksiyon` -> `erektil_islev` refactor
- [ ] Tüm adapter dosyalarını güncelle
- [ ] Regresyon testi

---

## Tahmini Süre

| Faz | Süre | Karmaşıklık |
|-----|------|-------------|
| Faz 1 | 2-3 saat | Orta |
| Faz 2 | 3-4 saat | Orta |
| Faz 3 | 1-2 saat | Düşük |
| **Toplam** | **6-9 saat** | |

---

## Başlangıç Noktası

Başka bilgisayarda devam ederken:

1. `git pull backup main` ile güncel kodu çek
2. Bu dosyayı oku: `docs/db-frontend-field-alignment-roadmap.md`
3. Faz 1'den başla
