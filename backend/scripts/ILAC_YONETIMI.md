# İlaç Tanımları Yönetimi

Bu klasör, UroLog sisteminde kullanılan ilaç tanımlarını yönetmek için gerekli scriptleri içerir.

## Dosyalar

- **`ilac_listesi.json`**: Veritabanına yüklenecek ilaç tanımlarını içeren JSON dosyası
- **`seed_ilaclar.py`**: JSON dosyasındaki ilaçları veritabanına yükleyen script
- **`convert_ilac_csv_to_json.py`**: CSV formatındaki ilaç listesini JSON'a dönüştüren yardımcı script

## Kullanım

### 1. Yeni İlaç Listesi Yükleme (CSV'den)

Eğer CSV formatında bir ilaç listesi dosyanız varsa:

```bash
# Backend klasöründe çalıştırın
cd backend

# CSV'yi JSON'a dönüştür
python3 scripts/convert_ilac_csv_to_json.py /path/to/ilac_listesi.csv

# Veritabanına yükle
python3 -m scripts.seed_ilaclar
```

### 2. Mevcut JSON'dan Yükleme

```bash
cd backend
python3 -m scripts.seed_ilaclar
```

### 3. Docker İçinden Yükleme

```bash
docker compose exec backend python -m scripts.seed_ilaclar
```

### 4. Mevcut Verileri Koruyarak Ekleme

```bash
python3 -m scripts.seed_ilaclar --no-clear
```

## CSV Formatı

CSV dosyası aşağıdaki formatta olmalıdır (noktalı virgül ile ayrılmış):

```
ilaç adı;Barkod;ATC Adı;ATC Kodu;Firma Adı
ASEC 100 MG 20 FILM TABLET;8680381900209;aceclofenac;M01AB16;GLOBAL PHARMA İLAÇ SANAYİ...
```

## JSON Formatı

```json
[
  {
    "name": "İlaç Adı",
    "barcode": "8680381900209",
    "etkin_madde": "Etkin Madde (ATC Adı)",
    "atc_kodu": "M01AB16",
    "firma": "Firma Adı",
    "recete_tipi": "Normal"
  }
]
```

## Veritabanı Tablosu

İlaçlar `ilac_tanimlari` tablosuna yüklenir:

| Alan | Açıklama |
|------|----------|
| id | Otomatik artan ID |
| name | İlaç adı |
| barcode | Barkod numarası |
| etkin_madde | Etkin madde (ATC Adı) |
| atc_kodu | ATC Kodu |
| firma | Üretici firma |
| recete_tipi | Reçete türü (Normal, Kırmızı, Yeşil vb.) |
| aktif | Aktif durumu |
| created_at | Oluşturulma tarihi |
| updated_at | Güncellenme tarihi |
