# UroLOG EMR Sistemi

> **Versiyon:** 2.6  
> **Tarih:** 2026-01-23  
> **Kod Adı:** *Enterprise Edition*

UroLOG, üroloji klinikleri için özel olarak tasarlanmış, **kurumsal düzeyde** bir Elektronik Tıbbi Kayıt (EMR) sistemidir. Hasta takibi, muayene kayıtları, laboratuvar sonuçları, ameliyat notları, finans yönetimi ve detaylı raporlama gibi süreçleri tek bir platformda birleştirerek klinik iş akışını optimize eder.

---

## ✨ Temel Özellikler

### 🏥 Hasta Yönetimi

- **Kapsamlı Hasta Kartı** - Demografik bilgiler, tıbbi geçmiş, aile öyküsü
- **Hızlı Arama** - Ad, soyad, TC kimlik, protokol numarası ile anında erişim
- **Hasta Zaman Çizelgesi** - Tüm muayene, operasyon ve takip kayıtları kronolojik sırada
- **Fotoğraf ve Doküman Arşivi** - Hasta bazlı dosya yönetimi

### 📋 Klinik Modüller

- **Muayene Kayıtları** - Anamnez, fizik muayene, ICD-10 tanı kodları, tedavi planı
- **Ameliyat Notları** - Operasyon detayları, ekip bilgileri, şablon sistemi
- **Takip Notları** - Hasta kontrol ve takip kayıtları
- **Laboratuvar Sonuçları** - PDF'den otomatik parsing, manuel giriş, trend analizi
- **Görüntüleme Arşivi** - US, MR, CT gibi tetkik sonuçları

### 💊 Reçete Sistemi

- **İlaç Veritabanı** - Kapsamlı ilaç arama ve otomatik tamamlama
- **Reçete Şablonları** - Sık kullanılan reçeteleri kaydetme
- **Geçmiş Reçeteler** - Önceki reçeteleri görüntüleme ve kopyalama
- **Yazdırma** - Özelleştirilebilir reçete çıktısı

### 📊 Raporlar ve İstatistikler

- **Kohort Analizi** - Yeni vs. kontrol hasta oranları
- **Tanı Dağılımı** - ICD-10 bazlı istatistikler
- **Referans Kaynakları** - Hasta yönlendirme analizleri
- **Hasta Yoğunluğu Isı Haritası** - Aylık görsel analiz

### 💰 Finans Modülü

- **Gelir/Gider Takibi** - Detaylı finansal işlem yönetimi
- **Çoklu Kasa** - Nakit, Kredi Kartı, Havale/EFT kasaları
- **Hasta Cari** - Hasta bazlı borç/alacak durumu
- **Firma Borç Takibi** - Kurumsal alacak yönetimi
- **Finansal Raporlar** - Günlük, aylık, yıllık özet raporlar

### 📅 Randevu Yönetimi

- **Takvim Görünümü** - Görsel randevu takibi
- **Randevu Tipleri** - Renk, süre ve isim ile özelleştirme
- **Durum Takibi** - Planlı, Onaylı, Tamamlandı, İptal durumları

### 🔒 Güvenlik ve Denetim

- **Rol Tabanlı Yetkilendirme** - Admin, Doktor, Hemşire, Sekreter rolleri
- **Audit Logging** - Tüm kritik işlemlerin kayıt altına alınması
- **Rate Limiting** - Brute-force koruması
- **Session Timeout** - Otomatik oturum sonlandırma
- **Şifreli Denetim Paneli** - Yönetici şifresi ile güvenli log erişimi

### 📄 Raporlar ve Çıktılar

- **Reçete Yazdırma** - Özelleştirilebilir format
- **İstirahat Raporu** - Hasta için istirahat belgesi
- **Durum Bildirir Rapor** - Resmi durum raporu
- **Tıbbi Müdahale Raporu** - İşlem dokümantasyonu
- **Hasta Özet Kartı** - Tek sayfa hasta özeti

---

## 🚀 Teknoloji Yığını

### Frontend

| Teknoloji | Versiyon | Açıklama |
|-----------|----------|----------|
| **Next.js** | 16.x | React framework (App Router) |
| **React** | 19.x | UI kütüphanesi |
| **TypeScript** | 5.x | Tip güvenli JavaScript |
| **Tailwind CSS** | 4.x | Utility-first CSS |
| **shadcn/ui** | Latest | Modern UI bileşenleri |
| **Radix UI** | Latest | Erişilebilir primitifler |
| **Zustand** | 4.x | State management |
| **TanStack Query** | 5.x | Sunucu state yönetimi |
| **React Hook Form** | 7.x | Form yönetimi |
| **Zod** | 3.x | Schema validation |

### Backend

| Teknoloji | Versiyon | Açıklama |
|-----------|----------|----------|
| **FastAPI** | 0.100+ | Modern Python web framework |
| **SQLAlchemy** | 2.x | Async ORM |
| **Alembic** | 1.x | Database migrations |
| **Pydantic** | 2.x | Data validation |
| **JWT** | - | Token-based authentication |
| **Redis** | 7.x | Cache layer |
| **Gunicorn** | - | Production WSGI server |

### Veritabanı & Altyapı

| Teknoloji | Versiyon | Açıklama |
|-----------|----------|----------|
| **PostgreSQL** | 15 | İlişkisel veritabanı |
| **Redis** | 7 | Cache ve session store |
| **Docker** | Latest | Container orchestration |
| **Docker Compose** | Latest | Multi-container deployment |

---

## 📂 Proje Yapısı

```
UroLog/
├── frontend/                    # Next.js Frontend Uygulaması
│   ├── app/                     # Next.js App Router sayfaları
│   │   ├── (dashboard)/         # Dashboard layout altındaki sayfalar
│   │   │   ├── dashboard/       # Ana sayfa
│   │   │   ├── patients/        # Hasta yönetimi
│   │   │   ├── finance/         # Finans modülü
│   │   │   ├── calendar/        # Randevu takvimi
│   │   │   ├── reports/         # Raporlar
│   │   │   └── settings/        # Sistem ayarları
│   │   ├── login/               # Giriş sayfası
│   │   └── print/               # Yazdırma sayfaları
│   ├── components/              # React bileşenleri
│   │   ├── ui/                  # shadcn/ui bileşenleri
│   │   ├── layout/              # Layout bileşenleri
│   │   ├── patients/            # Hasta ile ilgili bileşenler
│   │   ├── clinical/            # Klinik bileşenler
│   │   └── settings/            # Ayar bileşenleri
│   ├── lib/                     # Yardımcı kütüphaneler
│   │   ├── api.ts               # API istemcisi
│   │   └── utils.ts             # Utility fonksiyonlar
│   └── stores/                  # Zustand state stores
│
├── backend/                     # FastAPI Backend Servisi
│   ├── app/
│   │   ├── api/v1/endpoints/    # API endpoint'leri
│   │   ├── models/              # SQLAlchemy modelleri
│   │   ├── schemas/             # Pydantic şemaları
│   │   ├── repositories/        # Veritabanı repository'leri
│   │   ├── services/            # İş mantığı servisleri
│   │   ├── core/                # Yapılandırma ve güvenlik
│   │   └── db/                  # Veritabanı bağlantısı
│   ├── alembic/                 # Database migrations
│   ├── static/                  # Statik dosyalar (photos, documents)
│   ├── Dockerfile               # Backend Docker image
│   └── requirements.txt         # Python bağımlılıkları
│
├── deployment_debian/           # Debian sunucu deployment
│   ├── deploy.sh                # Otomatik deployment scripti
│   └── DEBIAN_DEPLOYMENT_GUIDE.md
│
├── docker-compose.prod.yml      # Production Docker Compose
├── start.sh                     # Lokal geliştirme başlatıcı
├── DEVELOPMENT_ROADMAP.md       # Geliştirme yol haritası
└── README.md                    # Bu dosya
```

---

## 🛠️ Kurulum

### Ön Gereksinimler

- **Node.js** 20+ (Frontend)
- **Python** 3.11+ (Backend)
- **Docker Desktop** (Önerilen)
- **PostgreSQL** 15+ (Manuel kurulum için)

### Hızlı Başlangıç (Docker - Önerilen)

```bash
# 1. Projeyi klonlayın
git clone <repo-url>
cd UroLog

# 2. Environment dosyasını oluşturun
cp .env.example .env
# .env dosyasını düzenleyin

# 3. Başlatma scriptini çalıştırın
./start.sh
```

Bu script:

- Backend Docker container'larını başlatır (PostgreSQL, Redis, FastAPI)
- Frontend development server'ı başlatır
- <http://localhost:3000> adresinden erişilebilir

### Manuel Kurulum

#### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt

# Veritabanı migrasyonları
alembic upgrade head

# Backend baş```

#### Frontend

```bash
cd frontend
npm install
npm run dev
```

---

## 🚀 Production Deployment (Debian)

```bash
cd deployment_debian
./deploy.sh          # Full deployment (no-cache build)
./deploy.sh --fast   # Hızlı deployment (cache kullanır)
```

Deployment scripti otomatik olarak:

1. SSH ile sunucuya bağlanır
2. Dosyaları rsync ile aktarır
3. Docker imajlarını build eder
4. Alembic migrasyonlarını çalıştırır
5. Servisleri başlatır
6. Sağlık kontrolü yapar

---

## 🔧 Ortam Değişkenleri

```env
# Veritabanı
DB_USER=admin
DB_PASSWORD=your_secure_password
DB_NAME=db
DATABASE_URL=postgresql+asyncpg://user:pass@host:port/db

# Güvenlik
SECRET_KEY=your-super-secret-key-change-in-production
ENVIRONMENT=production  # development | production

`backend/app/core/config.py` dosyası içindeki `ENVIRONMENT` değişkeni ile sistemin modu değiştirilebilir:

- **development** (Varsayılan): Tüm dökümantasyon sayfaları açıktır. Geliştirme sürecinde API uç noktalarını test etmek için kullanılır.
- **production**: `/docs`, `/redoc` ve `/openapi.json` adresleri tamamen **devre dışı bırakılır (404 Not Found)**. Bu, dışarıdan sistem mimarisinin taranmasını engellemek için kritik bir güvenlik önlemidir.

> [!IMPORTANT]
> **Production'a Geçiş Notu:** Canlı ortama (sunucuya) kuruldummyaparken veya Docker imajı alırken `ENVIRONMENT` değişkeninin `"production"` olarak ayarlandığından emin olun. Ayrıca `SECRET_KEY` değerini mutlaka güncelleyin.

# Redis
REDIS_URL=redis://localhost:6379

> **Port Çakışması:** Varsayılan veritabanı portu 5441 olarak ayarlanmıştır (Mevcut 5440 ile çakışmaması için).
```

---

## 📡 API Endpoints

| Endpoint | Açıklama |
|----------|----------|
| `/api/v1/auth/` | Kimlik doğrulama |
| `/api/v1/patients/` | Hasta yönetimi |
| `/api/v1/clinical/` | Muayene, operasyon, takip |
| `/api/v1/appointments/` | Randevu yönetimi |
| `/api/v1/finance/` | Finans işlemleri |
| `/api/v1/lab/` | Laboratuvar sonuçları |
| `/api/v1/audit/` | Denetim kayıtları (Sadece Admin) |
| `/api/v1/settings/` | Sistem ayarları |
| `/health` | Sistem sağlık kontrolü |

> **Not:** Production ortamında `/docs` ve `/redoc` endpoint'leri devre dışı bırakılır.

---

**npm error ("ENOENT"):**
`npm run dev` komutunu yanlış klasörde (örn. backend veya root) çalıştırırsanız hata alırsınız. Mutlaka `frontend` klasörü içinde çalıştırın.

**uvicorn: command not found:**
Bu hata, Python sanal ortamının (virtual environment) aktif olmadığını gösterir. Backend'i çalıştırmadan önce sanal ortamı aktive edin:

```bash
cd backend
 # Windows: venv\Scripts\activate
uvicorn app.main:app --reload
```

Veya tek satırda:

```bash
source venv/bin/activate && uvicorn app.main:app --reload
```

**Address already in use (Errno 48):**
Port 8000 zaten başka bir işlem tarafından kullanılıyor. Mevcut uvicorn işlemini durdurun veya farklı bir port kullanın:

```bash
uvicorn app.main:app --reload --port 8001
```

---

## 🔒 Güvenlik Özellikleri

- ✅ JWT tabanlı kimlik doğrulama
- ✅ Rol tabanlı yetkilendirme (RBAC)
- ✅ API rate limiting
- ✅ Şifreli audit log erişimi
- ✅ Session timeout
- ✅ SQL injection koruması (ORM)
- ✅ XSS koruması
- 🔄 SSL/HTTPS (Nginx ile)

---

## 📊 Sistem Gereksinimleri (Production)

| Kaynak | Minimum | Önerilen |
|--------|---------|----------|
| **CPU** | 2 Core | 4 Core |
| **RAM** | 4 GB | 8 GB |
| **Disk** | 20 GB | 50 GB+ |
| **OS** | Debian 11+ | Debian 12 |

---

## 🤝 Katkıda Bulunma

1. Fork yapın
2. Feature branch oluşturun (`git checkout -b feature/amazing-feature`)
3. Değişikliklerinizi commit edin (`git commit -m 'Add amazing feature'`)
4. Branch'inizi push edin (`git push origin feature/amazing-feature`)
5. Pull Request açın

---

## 📜 Lisans

Bu proje özel lisans altındadır. Ticari kullanım için iletişime geçin.

---

## 📞 İletişim

Sorularınız veya önerileriniz için:

- **E-posta:** [email protected]
- **Geliştirici:** Antigravity AI

---

*Son Güncelleme: 2026-01-23*
