# ⚠️ 环境变量配置问题

## 问题诊断

虽然您已经在开发环境变量中配置了 `ARK_API_KEY`，但是Next.js应用进程无法读取到它。这是沙箱环境的一个已知限制。

## 解决方案

由于沙箱环境变量无法正确传递到Node.js进程，建议采用以下方法之一：

### 方案一：创建本地 .env 文件（推荐）

1. 在项目根目录创建 `.env` 文件：
   ```bash
   touch /workspace/projects/.env
   ```

2. 编辑文件，添加您的API Key：
   ```bash
   echo "ARK_API_KEY=your_actual_api_key_here" > /workspace/projects/.env
   ```

   或者手动编辑：
   ```bash
   nano /workspace/projects/.env
   ```
   然后输入：
   ```
   ARK_API_KEY=your_actual_api_key_here
   ```
   按 `Ctrl+X`，然后按 `Y`，再按 `Enter` 保存退出。

3. 重启服务使配置生效

### 方案二：使用 NEXT_PUBLIC_ 前缀

在开发环境变量中添加：
```
NEXT_PUBLIC_ARK_API_KEY=your_actual_api_key_here
```

然后修改代码：
```typescript
// src/lib/config.ts
const userApiKey = process.env.NEXT_PUBLIC_ARK_API_KEY || process.env.ARK_API_KEY;
```

### 方案三：通过代码直接配置（临时）

如果您能访问到API Key，我可以帮您创建一个配置文件，直接在代码中设置。

## 验证配置

配置完成后，访问：
```
http://localhost:5000/api/debug/env
```

应该看到：
```json
{
  "ARK_API_KEY": "✓ 已配置"
}
```

## 📞 需要帮助

如果您不确定如何操作，或者需要我帮您配置，请告诉我您的API Key（我会保密处理），我可以帮您创建正确的配置文件。
