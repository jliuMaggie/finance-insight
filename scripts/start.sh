#!/bin/bash
set -Eeuo pipefail

COZE_WORKSPACE_PATH="${COZE_WORKSPACE_PATH:-$(pwd)}"
PORT=5000
DEPLOY_RUN_PORT="${DEPLOY_RUN_PORT:-$PORT}"

cd "${COZE_WORKSPACE_PATH}"

# 在部署时设置环境变量（避免只读文件系统问题）
if [ -n "$ARK_API_KEY" ] || [ -n "$COZE_BUCKET_ENDPOINT_URL" ] || [ -n "$COZE_BUCKET_NAME" ]; then
  echo "Setting environment variables for deploy..."
  export ARK_API_KEY="${ARK_API_KEY:-}"
  export COZE_BUCKET_ENDPOINT_URL="${COZE_BUCKET_ENDPOINT_URL:-}"
  export COZE_BUCKET_NAME="${COZE_BUCKET_NAME:-}"
  echo "Environment variables set successfully"
fi

start_service() {
    echo "Starting HTTP service on port ${DEPLOY_RUN_PORT} for deploy..."
    npx next start --port ${DEPLOY_RUN_PORT}
}

echo "Starting HTTP service on port ${DEPLOY_RUN_PORT} for deploy..."
start_service
