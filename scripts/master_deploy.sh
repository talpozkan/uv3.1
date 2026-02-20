#!/bin/bash
# Master Deploy Script v1.0
# Bu script sunucu üzerinde (/opt/urologv3/master_deploy.sh) çalıştırılacaktır.

NC='\033[0m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
YELLOW='\033[1;33m'

echo -e "${BLUE}🚀 UroLOG Master Deploy Başlatılıyor...${NC}"

# 0. Dizin Çözümleme (Gerçek dizini bul - Sembolik link takibi)
REAL_PATH=$(readlink -f "$0")
PROJECT_DIR=$(dirname "$REAL_PATH")
cd "$PROJECT_DIR"
echo -e "${BLUE}📍 Çalışma Dizini: $PROJECT_DIR${NC}"
echo -e "${YELLOW}📦 [1/4] Güvenlik yedeği alınıyor...${NC}"
if [ -f "/home/alp/uroV3_backup.sh" ]; then
    bash /home/alp/uroV3_backup.sh
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Yedekleme başarılı.${NC}"
    else
        echo -e "${RED}❌ Yedekleme hatası! Güvenlik nedeniyle durduruluyor.${NC}"
        exit 1
    fi
else
    echo -e "${RED}❌ Yedekleme scripti bulunamadı! (/home/alp/uroV3_backup.sh)${NC}"
    exit 1
fi

# 2. Sync: Git Pull
echo -e "${YELLOW}🔄 [2/4] GitHub'dan güncel kod çekiliyor...${NC}"
git fetch origin main
git reset --hard origin/main
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Kod güncellendi.${NC}"
else
    echo -e "${RED}❌ Git pull hatası! SSH Key yetkisini kontrol edin.${NC}"
    exit 1
fi

# 3. Build & Deploy: Docker
echo -e "${YELLOW}🐳 [3/4] Tüm stack yeniden derleniyor ve başlatılıyor...${NC}"

# Git SHA'yı al ve export et (Frontend versiyon numarası için)
export GIT_SHA=$(git rev-parse --short HEAD)
echo -e "${BLUE}🏷️ Versiyon: v$GIT_SHA${NC}"

docker compose -f docker-compose.prod.yml build --no-cache
docker compose -f docker-compose.prod.yml up -d --remove-orphans
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Docker stack güncellendi.${NC}"
else
    echo -e "${RED}❌ Docker build/up hatası!${NC}"
    exit 1
fi

# 4. Health Check
echo -e "${YELLOW}🔍 [4/4] Sistem sağlığı kontrol ediliyor...${NC}"
sleep 5
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep urov3

echo -e "\n${GREEN}✨ Dağıtım Başarıyla Tamamlandı! ✨${NC}"
