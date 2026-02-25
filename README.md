# 金融智能洞察

基于豆包AI驱动的实时金融新闻与投资分析平台。

## 🚀 快速开始

### 启动开发服务器

```bash
coze dev
```

启动后，在浏览器中打开 [http://localhost:5000](http://localhost:5000) 查看应用。

### 构建生产版本

```bash
coze build
```

### 启动生产服务器

```bash
coze start
```

## ⚙️ 配置自定义豆包 API Key

本项目支持使用您自己在火山引擎购买的豆包 API Key，token 消耗将从您的额度中扣除。

详细配置说明请查看：[配置指南](docs/CONFIG.md)

### 快速配置

在环境变量中添加：
```bash
ARK_API_KEY=your_actual_api_key_here
```

重启服务后，查看日志确认配置生效：
```
✓ 使用用户自定义的豆包 API key (ARK_API_KEY)
```

## 💰 成本估算

配置自定义 API Key 后，每日成本估算：

| 功能 | 每日次数 | Token 消耗 | 成本（0.003元/1K） |
|------|---------|-----------|-------------------|
| 新闻刷新 | 10次 | 100K-150K | 0.3-0.45元 |
| 持仓刷新 | 5次 | 75K-100K | 0.225-0.3元 |
| AI 问答 | 20次 | 40K-100K | 0.12-0.3元 |
| **总计** | - | **215K-350K** | **0.645-1.05元/日** |

## 📋 核心功能

### 1. 金融新闻（TOP 20）
- 基于豆包AI联网搜索的国内外重大金融新闻
- 支持多时段查看（12h/24h/36h/48h）
- AI 智能总结标题和摘要
- 整点缓存策略，减少 token 消耗

### 2. 投资大佬持仓变动
- 10位投资大师（5个个人 + 5个机构）
- 详细的投资者介绍和投资风格
- 持仓变化按时间从近到远排序
- 3列并列显示，信息密度高

### 3. AI 投资分析
- 基于豆包AI的专业投资机会与风险分析
- 支持选择特定新闻事件进行分析
- 流式输出，实时返回分析结果

## 🛠 技术栈

- **Framework**: Next.js 16 (App Router)
- **Core**: React 19
- **Language**: TypeScript 5
- **UI Components**: shadcn/ui
- **Styling**: Tailwind CSS 4
- **AI Services**: coze-coding-dev-sdk (豆包AI)

## 📁 项目结构

```
src/
├── app/                      # Next.js App Router 目录
│   ├── api/                 # API 路由
│   │   ├── news/           # 新闻搜索 API
│   │   ├── holdings/       # 持仓数据 API
│   │   └── chat/           # AI 问答 API
│   ├── layout.tsx          # 根布局
│   ├── page.tsx            # 首页
│   └── globals.css         # 全局样式
├── components/              # React 组件
│   └── ui/                 # shadcn/ui 基础组件
├── lib/                    # 工具函数库
│   ├── config.ts           # SDK 配置管理
│   ├── storage.ts          # 对象存储封装
│   ├── investors.ts        # 投资者信息配置
│   └── utils.ts            # 工具函数
└── docs/                   # 文档
    └── CONFIG.md           # 配置指南
```

## 📖 详细文档

- [配置指南](docs/CONFIG.md) - 如何配置自定义豆包 API Key
- [开发规范](#核心开发规范) - 组件、路由、依赖管理规范

---

**主题变量**

主题变量定义在 `src/app/globals.css` 中，支持亮色/暗色模式：

- `--background`, `--foreground`
- `--primary`, `--primary-foreground`
- `--secondary`, `--secondary-foreground`
- `--muted`, `--muted-foreground`
- `--accent`, `--accent-foreground`
- `--destructive`, `--destructive-foreground`
- `--border`, `--input`, `--ring`

### 5. 表单开发

推荐使用 `react-hook-form` + `zod` 进行表单开发：

```tsx
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const formSchema = z.object({
  username: z.string().min(2, '用户名至少 2 个字符'),
  email: z.string().email('请输入有效的邮箱'),
});

export default function MyForm() {
  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: { username: '', email: '' },
  });

  const onSubmit = (data: z.infer<typeof formSchema>) => {
    console.log(data);
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)}>
      <Input {...form.register('username')} />
      <Input {...form.register('email')} />
      <Button type="submit">提交</Button>
    </form>
  );
}
```

### 6. 数据获取

**服务端组件（推荐）**

```tsx
// src/app/posts/page.tsx
async function getPosts() {
  const res = await fetch('https://api.example.com/posts', {
    cache: 'no-store', // 或 'force-cache'
  });
  return res.json();
}

export default async function PostsPage() {
  const posts = await getPosts();

  return (
    <div>
      {posts.map(post => (
        <div key={post.id}>{post.title}</div>
      ))}
    </div>
  );
}
```

**客户端组件**

```tsx
'use client';

import { useEffect, useState } from 'react';

export default function ClientComponent() {
  const [data, setData] = useState(null);

  useEffect(() => {
    fetch('/api/data')
      .then(res => res.json())
      .then(setData);
  }, []);

  return <div>{JSON.stringify(data)}</div>;
}
```

## 常见开发场景

### 添加新页面

1. 在 `src/app/` 下创建文件夹和 `page.tsx`
2. 使用 shadcn 组件构建 UI
3. 根据需要添加 `layout.tsx` 和 `loading.tsx`

### 创建业务组件

1. 在 `src/components/` 下创建组件文件（非 UI 组件）
2. 优先组合使用 `src/components/ui/` 中的基础组件
3. 使用 TypeScript 定义 Props 类型

### 添加全局状态

推荐使用 React Context 或 Zustand：

```tsx
// src/lib/store.ts
import { create } from 'zustand';

interface Store {
  count: number;
  increment: () => void;
}

export const useStore = create<Store>((set) => ({
  count: 0,
  increment: () => set((state) => ({ count: state.count + 1 })),
}));
```

### 集成数据库

推荐使用 Prisma 或 Drizzle ORM，在 `src/lib/db.ts` 中配置。

## 技术栈

- **框架**: Next.js 16.1.1 (App Router)
- **UI 组件**: shadcn/ui (基于 Radix UI)
- **样式**: Tailwind CSS v4
- **表单**: React Hook Form + Zod
- **图标**: Lucide React
- **字体**: Geist Sans & Geist Mono
- **包管理器**: pnpm 9+
- **TypeScript**: 5.x

## 参考文档

- [Next.js 官方文档](https://nextjs.org/docs)
- [shadcn/ui 组件文档](https://ui.shadcn.com)
- [Tailwind CSS 文档](https://tailwindcss.com/docs)
- [React Hook Form](https://react-hook-form.com)

## 重要提示

1. **必须使用 pnpm** 作为包管理器
2. **优先使用 shadcn/ui 组件** 而不是从零开发基础组件
3. **遵循 Next.js App Router 规范**，正确区分服务端/客户端组件
4. **使用 TypeScript** 进行类型安全开发
5. **使用 `@/` 路径别名** 导入模块（已配置）
