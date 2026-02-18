#!/bin/bash

# Configuration
REMOTE_USER="alp"
REMOTE_HOST="192.168.1.99"
REMOTE_PORT="1881"
REMOTE_DIR="/opt/urologv3"
DOCKER_COMPOSE_FILE="docker-compose.prod.yml"

echo "🚀 Starting Deployment to ${REMOTE_HOST} on port ${REMOTE_PORT}..."

# 1. Check if .env exists
if [ ! -f .env ]; then
    echo "❌ .env file not found! Please create it first."
    exit 1
fi

# 2. Sync files to remote server
echo "📂 Synchronizing files..."
rsync -avz --progress -e "ssh -p ${REMOTE_PORT}" \
    --exclude '.git' \
    --exclude 'node_modules' \
    --exclude 'venv' \
    --exclude '__pycache__' \
    --exclude '.agent' \
    --exclude '_bmad-output' \
    --exclude '03.db' \
    --exclude '03.db_import' \
    ./ ${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_DIR}

# 3. Run Docker Compose on Remote
echo "🐳 Starting Docker containers on Remote..."
ssh -p ${REMOTE_PORT} ${REMOTE_USER}@${REMOTE_HOST} << EOF
    cd ${REMOTE_DIR}
    # Ensure .env is used
    docker compose -f ${DOCKER_COMPOSE_FILE} down
    docker compose -f ${DOCKER_COMPOSE_FILE} up -d --build
    echo "✅ Containers are up and running!"
EOF

echo "🏁 Deployment Finished Successfully!"
