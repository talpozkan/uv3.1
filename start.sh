#!/bin/bash

# UroLOG System Autostart Script
# Starts Backend (Docker) and Frontend (Next.js)
# v2.0 - Optimized with health checks and absolute path resilience

# 0. Configuration & Absolute Path Resolution
ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
export PROJECT_NAME="V3_lokal"
echo "🚀 UroLOG Başlatılıyor... (Dizin: ${ROOT_DIR}, Proje: ${PROJECT_NAME})"

# Trap colors
NC='\033[0m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
YELLOW='\033[1;33m'

# Function to handle cleanup (Stop backend when script is terminated)
cleanup() {
    echo -e "\n${RED}🛑 Sistem kapatılıyor...${NC}"
    echo "Backend servisleri durduruluyor (docker compose down)..."
    cd "${ROOT_DIR}/backend" && docker compose down
    echo -e "${GREEN}✅ Sistem başarıyla kapatıldı.${NC}"
    exit 0
}

# Trap Ctrl+C (SIGINT) to run cleanup
trap cleanup SIGINT

# 1. Start Backend (Docker Compose)
echo -e "\n${BLUE}---------------------------------------------------${NC}"
echo -e "🐘 ${BLUE}Backend ve Veritabanı (Docker) Başlatılıyor...${NC}"
echo -e "${BLUE}---------------------------------------------------${NC}"

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}❌ HATA: Docker çalışmıyor. Lütfen Docker Desktop uygulamasını başlatın.${NC}"
    exit 1
fi

cd "${ROOT_DIR}/backend"
docker compose up -d --build

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Backend servisleri arka planda başlatıldı.${NC}"
else
    echo -e "${RED}❌ Backend başlatılamadı.${NC}"
    exit 1
fi

# Wait for database to be ready (Robust loop)
echo -ne "⏳ Veritabanı hazır olması bekleniyor..."
MAX_RETRIES=30
RETRY_COUNT=0
while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    if docker compose exec -T db pg_isready -U emr_admin -d DrEren_db > /dev/null 2>&1; then
        echo -e "\n${GREEN}✅ Veritabanı hazır (Port: 5441).${NC}"
        break
    fi
    echo -n "."
    RETRY_COUNT=$((RETRY_COUNT + 1))
    sleep 2
done

if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
    echo -e "\n${RED}❌ HATA: Veritabanı bağlantısı zaman aşımına uğradı.${NC}"
    exit 1
fi

# Run migrations
echo "🔄 Veritabanı migration'ları çalıştırılıyor..."
docker compose exec -T backend alembic upgrade head

# Seed drug definitions (only if table is empty)
echo "💊 İlaç tanımları kontrol ediliyor..."
DRUG_COUNT=$(docker compose exec -T backend python -c "
import asyncio
from app.db.session import SessionLocal
from sqlalchemy import text
async def check():
    async with SessionLocal() as db:
        result = await db.execute(text('SELECT COUNT(*) FROM ilac_tanimlari'))
        return result.scalar()
print(asyncio.run(check()))
" 2>/dev/null | tr -d '\r')

if [ "$DRUG_COUNT" = "0" ] || [ -z "$DRUG_COUNT" ]; then
    echo -e "${YELLOW}📥 İlaç tanımları yükleniyor (7846 ilaç)...${NC}"
    docker compose exec -T backend python -m scripts.seed_ilaclar
    echo -e "${GREEN}✅ İlaç tanımları yüklendi.${NC}"
else
    echo -e "${GREEN}✅ İlaç tanımları mevcut ($DRUG_COUNT ilaç).${NC}"
fi

# 2. Start Frontend
echo -e "\n${BLUE}---------------------------------------------------${NC}"
echo -e "🎨 ${BLUE}Frontend (Next.js) Başlatılıyor...${NC}"
echo -e "${BLUE}---------------------------------------------------${NC}"
echo "Backend loglarını görmek için: cd backend && docker compose logs -f"
echo -e "Çıkmak için: ${RED}Ctrl+C${NC}"
echo -e "${BLUE}---------------------------------------------------${NC}\n"

cd "${ROOT_DIR}/frontend"

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Bağımlılıklar yükleniyor (npm install)..."
    npm install
fi

npm run dev

# If npm run dev stops unexpectedly
cleanup
