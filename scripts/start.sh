#!/bin/bash
set -Eeuo pipefail

COZE_WORKSPACE_PATH="${COZE_WORKSPACE_PATH:-$(pwd)}"
PORT=5000
DEPLOY_RUN_PORT="${DEPLOY_RUN_PORT:-$PORT}"

# 在部署时创建临时的 .env 文件（如果环境变量存在）
cd "${COZE_WORKSPACE_PATH}"

if [ -n "$ARK_API_KEY" ] || [ -n "$COZE_BUCKET_ENDPOINT_URL" ] || [ -n "$COZE_BUCKET_NAME" ]; then
  echo "Creating .env file from environment variables..."
  cat > .env << EOF
ARK_API_KEY=${ARK_API_KEY:-}
COZE_BUCKET_ENDPOINT_URL=${COZE_BUCKET_ENDPOINT_URL:-}
COZE_BUCKET_NAME=${COZE_BUCKET_NAME:-}
EOF
  echo ".env file created successfully"
fi

start_service() {
    echo "Starting HTTP service on port ${DEPLOY_RUN_PORT} for deploy..."
    npx next start --port ${DEPLOY_RUN_PORT}
}

echo "Starting HTTP service on port ${DEPLOY_RUN_PORT} for deploy..."
start_service
