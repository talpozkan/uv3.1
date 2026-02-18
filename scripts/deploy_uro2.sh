#!/bin/bash
REMOTE_ALIAS="uro2-nur"
REMOTE_DIR="/home/alp/UroLog_V3"
DOCKER_COMPOSE_FILE="docker-compose.prod.yml"

echo "📂 Synchronizing to ${REMOTE_ALIAS}..."
rsync -avz --progress \
    --exclude '.git' \
    --exclude 'node_modules' \
    --exclude 'venv' \
    --exclude '__pycache__' \
    --exclude '.agent' \
    --exclude '_bmad-output' \
    --exclude '03.db' \
    --exclude '03.db_import' \
    ./ ${REMOTE_ALIAS}:${REMOTE_DIR}

echo "🐳 Restarting Backend on Remote..."
ssh ${REMOTE_ALIAS} << EOF
    cd ${REMOTE_DIR}
    # Using export to make variables available to docker-compose
    export PROJECT_NAME_FILE=urotip
    export PROJECT_NAME=urotip
    # These are needed by docker-compose.prod.yml
    export DB_PORT_EXTERNAL=5440
    export BACKEND_PORT_EXTERNAL=9000
    export REDIS_PORT_EXTERNAL=6380
    export FRONTEND_PORT_EXTERNAL=3000
    export NGINX_HTTP_PORT=8000
    export NGINX_HTTPS_PORT=4430
    
    # Use -p urotip to ensure we target the correct project
    docker compose -p urotip -f ${DOCKER_COMPOSE_FILE} up -d --build backend
EOF

echo "🏁 Deployment to ${REMOTE_ALIAS} Finished!"
