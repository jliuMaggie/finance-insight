#!/bin/bash
set -Eeuo pipefail

COZE_WORKSPACE_PATH="${COZE_WORKSPACE_PATH:-$(pwd)}"

cd "${COZE_WORKSPACE_PATH}"

# 在构建时设置环境变量（避免只读文件系统问题）
if [ -n "$ARK_API_KEY" ] || [ -n "$COZE_BUCKET_ENDPOINT_URL" ] || [ -n "$COZE_BUCKET_NAME" ]; then
  echo "Setting environment variables for build..."
  export ARK_API_KEY="${ARK_API_KEY:-}"
  export COZE_BUCKET_ENDPOINT_URL="${COZE_BUCKET_ENDPOINT_URL:-}"
  export COZE_BUCKET_NAME="${COZE_BUCKET_NAME:-}"
  echo "Environment variables set successfully"
fi

echo "Installing dependencies..."
pnpm install --prefer-frozen-lockfile --prefer-offline --loglevel debug --reporter=append-only

echo "Building the project..."
npx next build

echo "Build completed successfully!"
