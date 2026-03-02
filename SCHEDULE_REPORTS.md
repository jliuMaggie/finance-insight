# 简报定时任务使用说明

## 功能概述

本定时任务用于自动生成每日的金融早报和晚报，并保存到 `public/reports/` 目录。

## 定时规则

- **早报**：每天 08:00 自动生成
- **晚报**：每天 20:00 自动生成

## 使用方法

### 方式一：运行自动定时任务

启动定时任务脚本，它会每分钟检查一次是否需要生成简报：

```bash
pnpm schedule:reports
```

启动后，脚本会：
- 每分钟检查一次当前时间
- 如果是 08:00，自动生成早报
- 如果是 20:00，自动生成晚报

**注意**：此脚本需要持续运行，不要关闭终端。

### 方式二：手动触发

#### 生成早报
```bash
pnpm schedule:reports:morning
```

#### 生成晚报
```bash
pnpm schedule:reports:evening
```

#### 同时生成早报和晚报
```bash
pnpm schedule:reports --manual
```

### 方式三：使用系统 Cron（推荐）

对于生产环境，建议使用系统的 cron 来定时运行脚本。

#### 编辑 Cron 任务
```bash
crontab -e
```

#### 添加定时任务
```cron
# 每天早上 8:00 生成早报
0 8 * * * cd /path/to/project && pnpm schedule:reports:morning >> /var/log/reports-schedule.log 2>&1

# 每天晚上 20:00 生成晚报
0 20 * * * cd /path/to/project && pnpm schedule:reports:evening >> /var/log/reports-schedule.log 2>&1
```

#### 重启 Cron 服务
```bash
# Linux
sudo service cron restart

# 或
sudo systemctl restart cron

# macOS
sudo launchctl stop com.apple.cron
sudo launchctl start com.apple.cron
```

## 环境变量

可以通过环境变量自定义基础 URL：

```bash
export BASE_URL=http://localhost:5000
pnpm schedule:reports
```

## 文件存储

生成的简报文件会保存在 `public/reports/` 目录下，文件命名格式：

- 早报：`YYYY-MM-DD_早报.md`
- 晚报：`YYYY-MM-DD_晚报.md`

示例：
- `2026-03-01_早报.md`
- `2026-03-01_晚报.md`

## 监控和日志

### 查看日志

如果使用 cron 运行，日志会输出到指定的日志文件：

```bash
tail -f /var/log/reports-schedule.log
```

### 检查生成的文件

```bash
ls -lh public/reports/
```

### 在页面查看

1. 打开网站
2. 点击"早晚简报"标签页
3. 查看最新的早报和晚报

## 故障排除

### 问题 1：脚本无法运行

**错误**：`command not found: tsx`

**解决**：
```bash
pnpm install
```

### 问题 2：API 调用失败

**错误**：`Error syncing report: fetch failed`

**解决**：
1. 确保 Web 服务正在运行（端口 5000）
2. 检查 `BASE_URL` 环境变量是否正确
3. 查看服务日志：`tail -f /app/work/logs/bypass/app.log`

### 问题 3：文件已存在

**现象**：提示文件已存在

**解决**：脚本会自动覆盖同名文件，这是正常行为。

### 问题 4：生成的简报内容异常

**解决**：
1. 检查 LLM 服务是否正常
2. 查看服务日志中的错误信息
3. 手动触发生成测试：`pnpm schedule:reports:morning`

## 高级配置

### 自定义生成时间

修改 `scripts/schedule-reports.ts` 中的时间判断逻辑：

```typescript
// 早报在 8:00 生成
return hours === 8 && minutes === 0;

// 晚报在 20:00 生成
return hours === 20 && minutes === 0;
```

### 修改简报内容模板

修改 `src/app/api/reports/sync/route.ts` 中的 prompt 内容。

### 添加更多类型的简报

1. 在 `src/app/api/reports/sync/route.ts` 中添加新的 prompt
2. 在 `scripts/schedule-reports.ts` 中添加定时逻辑
3. 在 `package.json` 中添加对应的脚本命令

## 注意事项

1. **时区问题**：定时任务使用服务器本地时间，请确保服务器时区正确
2. **依赖服务**：定时任务依赖 Web 服务（/api/reports/sync），请确保服务持续运行
3. **文件覆盖**：同一天的早报/晚报会被覆盖，如需保留历史版本，请自行备份
4. **API 限制**：频繁调用 LLM 可能会受到限制，建议不要手动频繁触发

## 生产环境部署建议

1. **使用 Docker Compose**：将定时任务和服务一起部署
2. **使用 PM2**：使用 PM2 管理 Web 服务和定时任务进程
3. **监控告警**：添加监控和告警，确保定时任务正常运行
4. **日志管理**：使用日志轮转工具（如 logrotate）管理日志文件

## Docker Compose 示例

```yaml
version: '3.8'

services:
  web:
    build: .
    ports:
      - "5000:5000"
    environment:
      - NODE_ENV=production

  scheduler:
    build: .
    command: pnpm schedule:reports
    depends_on:
      - web
    restart: unless-stopped
```

## 联系支持

如有问题，请查看：
- 项目 README
- 服务日志：`/app/work/logs/bypass/`
- Coze Coding 文档
