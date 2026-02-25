# 🔧 部署环境变量配置修复

## 问题

部署时环境变量未传递，导致：
- ✗ ARK_API_KEY 未配置
- ✗ COZE_BUCKET_ENDPOINT_URL 未配置
- ✗ COZE_BUCKET_NAME 未配置

## 解决方案

已进行以下修复：

### 1. 修改 `.coze` 文件

在 `[deploy]` 部分添加了环境变量声明：

```toml
[deploy]
build = ["bash","./scripts/build.sh"]
run = ["bash","./scripts/start.sh"]
deps = ["git"]
env = ["ARK_API_KEY", "COZE_BUCKET_ENDPOINT_URL", "COZE_BUCKET_NAME"]
```

### 2. 修改 `scripts/start.sh`

添加了环境变量设置逻辑（避免只读文件系统问题）：

```bash
# 在部署时设置环境变量（避免只读文件系统问题）
if [ -n "$ARK_API_KEY" ] || [ -n "$COZE_BUCKET_ENDPOINT_URL" ] || [ -n "$COZE_BUCKET_NAME" ]; then
  echo "Setting environment variables for deploy..."
  export ARK_API_KEY="${ARK_API_KEY:-}"
  export COZE_BUCKET_ENDPOINT_URL="${COZE_BUCKET_ENDPOINT_URL:-}"
  export COZE_BUCKET_NAME="${COZE_BUCKET_NAME:-}"
  echo "Environment variables set successfully"
fi
```

**重要说明**：部署环境是只读文件系统，不能创建文件，因此改为直接导出环境变量。
```

## 需要您操作

### 步骤 1：确认开发环境变量配置

请在"开发环境变量"中确认以下环境变量已配置：

1. **ARK_API_KEY**（您的豆包 API Key）
   ```
   ARK_API_KEY=52db8378-d54b-4d50-a1bc-b12df7f2ce9a
   ```

2. **COZE_BUCKET_ENDPOINT_URL**（系统自动提供，无需手动配置）

3. **COZE_BUCKET_NAME**（系统自动提供，无需手动配置）

### 步骤 2：重新部署

1. 提交代码修改
2. 点击"部署"按钮重新部署

### 步骤 3：验证部署

部署完成后，查看部署日志，应该看到：

```
Setting environment variables for deploy...
Environment variables set successfully
Starting HTTP service on port 5000 for deploy...
```

并且环境变量配置验证应该显示：

```
==================================================
SDK 配置信息
==================================================
ARK_API_KEY: ✓ 已配置
COZE_BUCKET_ENDPOINT_URL: ✓ 已配置
COZE_BUCKET_NAME: ✓ 已配置
==================================================
```

## 如果仍然失败

如果重新部署后仍然显示环境变量未配置，可能需要：

1. **检查环境变量配置位置**
   - 确认配置在"开发环境变量"，而不是"生产环境变量"
   - 某些平台可能区分开发和生产环境变量

2. **手动添加到部署环境**
   - 如果平台支持，请在部署配置中添加环境变量
   - 或者联系平台管理员确认环境变量传递机制

3. **使用备用方案**
   - 如果上述方法都不行，我可以帮您创建一个配置文件
   - 将 API Key 直接写入配置文件（不推荐，仅作为临时方案）

## 技术说明

### 为什么开发环境能工作，部署环境不行？

1. **开发环境**：`.env` 文件会被 Next.js 自动加载
2. **部署环境**：
   - 部署环境是**只读文件系统**，无法创建或修改文件
   - 环境变量需要通过系统传递，`.env` 文件无法使用

### 修复原理

1. 在 `.coze` 文件中声明需要的环境变量
2. 在启动脚本中直接导出环境变量（不创建文件）
3. Node.js 进程会继承这些环境变量
4. Next.js 通过 `process.env` 读取环境变量

### 只读文件系统限制

部署时的错误：
```
./scripts/start.sh: line 13: .env: Read-only file system
```

解决方案：
- ✅ 使用 `export` 命令设置环境变量
- ❌ 尝试创建 `.env` 文件（会被拒绝）

## 部署日志检查

部署时查看以下日志：

**✅ 成功的标志**：
```
Setting environment variables for deploy...
Environment variables set successfully
Starting HTTP service on port 5000 for deploy...
```

**❌ 失败的标志**：
```
配置验证失败:
- 缺少 ARK_API_KEY 环境变量（豆包 API key）
```

**⚠️ 只读文件系统错误（已修复）**：
```
./scripts/start.sh: line 13: .env: Read-only file system
```

## 下一步

请：
1. 确认开发环境变量已配置
2. 重新部署项目
3. 查看部署日志确认环境变量是否正确传递
4. 如果仍有问题，请提供完整的部署日志
