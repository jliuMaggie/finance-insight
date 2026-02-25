# 配置指南 - 使用自定义豆包 API Key

## 📝 概述

本项目支持使用您自己在火山引擎购买的豆包 API Key，所有的 token 消耗将从您的 API key 额度中扣除。

## 🔑 配置步骤

### 方式一：在沙箱环境变量中配置（推荐）

1. 在沙箱环境的环境变量设置中添加：
   ```
   ARK_API_KEY=your_actual_api_key_here
   ```

2. 重启服务使配置生效

### 方式二：创建 .env 文件

1. 在项目根目录创建 `.env` 文件：
   ```bash
   cp .env.example .env
   ```

2. 编辑 `.env` 文件，填入您的 API Key：
   ```env
   ARK_API_KEY=your_actual_api_key_here
   ```

3. 重启服务

## 🎯 获取豆包 API Key

1. 访问 [火山引擎控制台](https://console.volcengine.com/ark)
2. 开通豆包 API 服务
3. 创建 API Key
4. 复制 API Key 到环境变量

## ✅ 验证配置

配置完成后，查看日志，应该看到：
```
==================================================
SDK 配置信息
==================================================
ARK_API_KEY: ✓ 已配置
COZE_BUCKET_ENDPOINT_URL: ✓ 已配置
COZE_BUCKET_NAME: ✓ 已配置
==================================================
✓ 使用用户自定义的豆包 API key (ARK_API_KEY)
```

如果看到：
```
⚠ 未检测到 ARK_API_KEY 环境变量，将使用默认配置
```

说明环境变量未正确配置。

## 💰 Token 消耗说明

配置自定义 API Key 后，以下功能的 token 消耗将从您的额度中扣除：

1. **新闻搜索与处理**：每次刷新约 10,000-15,000 tokens
2. **持仓数据提取**：每次刷新约 15,000-20,000 tokens（10位投资者）
3. **AI 分析问答**：每次对话约 2,000-5,000 tokens

### 成本估算

假设豆包 API 定价为 0.003 元/1K tokens：
- 新闻刷新：0.03-0.045 元/次
- 持仓刷新：0.045-0.06 元/次
- AI 问答：0.006-0.015 元/次

### 每日成本估算（按使用频率）

| 功能 | 每日次数 | Token 消耗 | 成本 |
|------|---------|-----------|------|
| 新闻刷新 | 10次 | 100K-150K | 0.3-0.45元 |
| 持仓刷新 | 5次 | 75K-100K | 0.225-0.3元 |
| AI 问答 | 20次 | 40K-100K | 0.12-0.3元 |
| **总计** | - | **215K-350K** | **0.645-1.05元** |

## 🔍 技术细节

### 配置文件

项目使用 `src/lib/config.ts` 统一管理 SDK 配置：

```typescript
import { Config } from 'coze-coding-dev-sdk';

export function getSDKConfig(): Config {
  const config = new Config();
  
  // 自动从环境变量读取 ARK_API_KEY
  const userApiKey = process.env.ARK_API_KEY;
  
  if (userApiKey) {
    console.log('✓ 使用用户自定义的豆包 API key (ARK_API_KEY)');
  }
  
  return config;
}
```

### 使用的 API 文件

以下文件已配置使用自定义 API Key：

1. `src/app/api/news/route.ts` - 新闻搜索与处理
2. `src/app/api/holdings/route.ts` - 持仓数据提取
3. `src/app/api/chat/route.ts` - AI 分析问答

### 配置验证

服务启动时会自动验证配置：

```typescript
export function validateConfig(): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!process.env.ARK_API_KEY) {
    errors.push('缺少 ARK_API_KEY 环境变量');
  }
  
  return {
    isValid: errors.length === 0,
    errors,
  };
}
```

## ❓ 常见问题

### Q1: 配置后仍然显示"使用默认配置"？

**A:** 请检查：
1. 环境变量名称是否为 `ARK_API_KEY`（大小写敏感）
2. .env 文件是否在项目根目录
3. 是否重启了服务

### Q2: 如何查看实际的 token 消耗？

**A:** 
1. 登录火山引擎控制台
2. 进入豆包 API 服务页面
3. 查看用量统计和费用明细

### Q3: 可以切换回默认配置吗？

**A:** 可以，只需删除或注释掉 `ARK_API_KEY` 环境变量，重启服务即可。

### Q4: API key 余额不足会怎样？

**A:** API 调用会失败，返回错误。建议在控制台设置余额告警提醒。

## 📞 支持

如果遇到配置问题，请：
1. 检查日志中的错误信息
2. 确认 API Key 格式正确
3. 确认 API Key 有足够余额
4. 查看 [火山引擎文档](https://www.volcengine.com/docs/82379)

## 🔐 安全建议

1. 不要将 API Key 提交到代码仓库
2. 定期轮换 API Key
3. 在火山引擎控制台设置 IP 白名单（如需要）
4. 设置费用上限，避免意外超支
