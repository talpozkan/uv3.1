#!/bin/bash

# Configuration
REMOTE_USER="alp"
REMOTE_HOST="192.168.1.99"
REMOTE_PORT="1881"
REMOTE_DIR="/opt/urologv3/"  # Note the trailing slash
LOCAL_DIR="./"

echo "🚀 Starting Sync from Server (${REMOTE_HOST}) to Local..."
echo "⚠️  This will overwrite local files with versions from the server."

# Sync files from remote server to local
rsync -avz --progress -e "ssh -p ${REMOTE_PORT}" \
    --exclude '.git' \
    --exclude 'node_modules' \
    --exclude 'venv' \
    --exclude '__pycache__' \
    --exclude '.agent' \
    --exclude '_bmad-output' \
    --exclude '03.db' \
    --exclude '03.db_import' \
    ${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_DIR} ${LOCAL_DIR}

echo "✅ Sync from server complete!"
