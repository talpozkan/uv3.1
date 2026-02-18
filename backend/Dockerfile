# -----------------------------------------------------------------------------
# Stage 1: Builder
# Amacı: Tüm derleme gereçlerini (gcc, make vb.) kullanarak Python paketlerini hazırlamak.
# Bu aşama final imajda yer almayacak, böylece gereksiz dosyalardan kurtulacağız.
# -----------------------------------------------------------------------------
FROM python:3.11-slim as builder

WORKDIR /app

# Python'un .pyc dosyaları oluşturmasını ve stdout'u tamponlamasını engeller
ENV PYTHONDONTWRITEBYTECODE 1
ENV PYTHONUNBUFFERED 1

COPY requirements.txt .

# Wheel dosyalarını oluştur (Dependency derleme)
# Bu işlem, derleme gerektiren C kütüphanelerini binary formatına çevirir.
RUN pip wheel --no-cache-dir --no-deps --wheel-dir /app/wheels -r requirements.txt

# -----------------------------------------------------------------------------
# Stage 2: Final
# Amacı: Sadece çalışması gereken dosyaları içeren, hafif ve güvenli imaj.
# -----------------------------------------------------------------------------
FROM python:3.11-slim

WORKDIR /app

# Builder aşamasından sadece derlenmiş paketleri (wheels) kopyalıyoruz
COPY --from=builder /app/wheels /wheels
COPY --from=builder /app/requirements.txt .

# Paketleri kuruyoruz. Artık derleme aracına ihtiyaç yok.
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 \
    libglib2.0-0 \
    libfontconfig1 \
    libfreetype6 \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

RUN pip install --no-cache /wheels/*

# Uygulama kodunu kopyalıyoruz
COPY . .

# GÜVENLİK ÖNERİSİ:
# Docker konteynerları varsayılan olarak 'root' kullanıcısı ile çalışır.
# Production ortamında, olası bir container breakout saldırısını engellemek için
# yetkisiz bir kullanıcı oluşturup onu kullanmak en iyi pratiktir.
# RUN adduser -D appuser && chown -R appuser /app
# USER appuser

# Varsayılan komut (Docker Compose tarafından override edilebilir)
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
