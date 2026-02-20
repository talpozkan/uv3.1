#!/bin/bash
# Master Deploy Script v1.0
# Bu script sunucu üzerinde (/opt/urologv3/master_deploy.sh) çalıştırılacaktır.

NC='\033[0m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
YELLOW='\033[1;33m'

FORCE_BUILD=false
if [[ "$1" == "--force" ]]; then
    FORCE_BUILD=true
    echo -e "${YELLOW}⚠️  Zorlamalı Build aktif edildi. Cache kullanılmayacak.${NC}"
fi

echo -e "${BLUE}🚀 UroLOG Master Deploy Başlatılıyor...${NC}"

# 0. Dizin Çözümleme (Gerçek dizini bul - Sembolik link takibi)
REAL_PATH=$(readlink -f "$0")
PROJECT_DIR=$(dirname "$REAL_PATH")
cd "$PROJECT_DIR" || exit 1

# Eğer scripts dizini içindeyse ana dizine çık
if [[ "$(basename "$PWD")" == "scripts" ]]; then
    cd ..
fi
PROJECT_DIR=$(pwd)

echo -e "${BLUE}📍 Çalışma Dizini: $PROJECT_DIR${NC}"

# 1. Safety Net: Backup
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
    echo -e "${YELLOW}⚠️  Yedekleme scripti bulunamadı. Devam ediliyor...${NC}"
fi

# 2. Sync: Git Pull
echo -e "${YELLOW}🔄 [2/4] GitHub'dan güncel kod çekiliyor...${NC}"
PRE_PULL_SHA=$(git rev-parse HEAD 2>/dev/null || echo "0000000")
git fetch origin main
git reset --hard origin/main
POST_PULL_SHA=$(git rev-parse HEAD)

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Kod güncellendi.${NC}"
else
    echo -e "${RED}❌ Git pull hatası! SSH Key yetkisini kontrol edin.${NC}"
    exit 1
fi

# 3. Smart Build & Deploy: Docker
echo -e "${YELLOW}🐳 [3/4] Konteynerlar güncelleniyor...${NC}"

# Git SHA'yı al ve export et (Frontend versiyon numarası için)
export GIT_SHA=$(git rev-parse --short HEAD)
echo -e "${BLUE}🏷️ Versiyon: v$GIT_SHA${NC}"

if [ "$FORCE_BUILD" = true ]; then
    echo -e "${YELLOW}🛠️ Tam rebuild yapılıyor (--no-cache)...${NC}"
    docker compose -f docker-compose.prod.yml build --no-cache
else
    # Değişiklikleri tespit et
    CHANGES=$(git diff --name-only "$PRE_PULL_SHA" "$POST_PULL_SHA" 2>/dev/null)
    
    BUILD_SERVICES=""
    [[ "$CHANGES" == *"backend/"* ]] && BUILD_SERVICES="$BUILD_SERVICES backend"
    [[ "$CHANGES" == *"frontend/"* ]] && BUILD_SERVICES="$BUILD_SERVICES frontend"
    # Eğer docker-compose veya nginx değiştiyse tam build gerekebilir
    [[ "$CHANGES" == *"nginx/"* || "$CHANGES" == *"docker-compose.prod.yml"* ]] && FORCE_BUILD_SELECTIVE=true

    if [ "$FORCE_BUILD_SELECTIVE" = true ]; then
        echo -e "${YELLOW}🛠️ Yapılandırma değişikliği saptandı, tam build yapılıyor...${NC}"
        docker compose -f docker-compose.prod.yml build
    elif [ -z "$BUILD_SERVICES" ] && [ "$PRE_PULL_SHA" != "0000000" ]; then
        echo -e "${GREEN}✅ Kod değişikliği saptanmadı, build atlanıyor.${NC}"
    else
        [ -z "$BUILD_SERVICES" ] && BUILD_SERVICES="backend frontend"
        echo -e "${YELLOW}🛠️ Değişen servisler derleniyor:$BUILD_SERVICES...${NC}"
        docker compose -f docker-compose.prod.yml build $BUILD_SERVICES
    fi
fi

docker compose -f docker-compose.prod.yml up -d --remove-orphans
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Docker stack güncellendi.${NC}"
else
    echo -e "${RED}❌ Deploy hatası!${NC}"
    exit 1
fi

# 4. Health Check
echo -e "${YELLOW}🔍 [4/4] Sistem sağlığı kontrol ediliyor...${NC}"
sleep 5
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep urov3

echo -e "\n${GREEN}✨ Dağıtım Başarıyla Tamamlandı! ✨${NC}"
