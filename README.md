# Finance Insight - AI 金融热点分析平台

智能化的金融资讯分析工具，基于 AI 实现从海量新闻中提取热点、分析趋势、追踪资金动向，为投资决策提供多维度参考。

## 核心功能

### 八步深度分析流程

| 步骤 | 内容 | 说明 |
|------|------|------|
| 1 | 搜索热点新闻 | 多源爬取金融资讯 |
| 2 | 主题归类 | AI 智能聚类相似新闻 |
| 3 | 热度排序 | 按权重计算话题热度 |
| 4 | 历史分析 | 对比历史相似事件及资产表现 |
| 5 | 大佬仓位追踪 | 追踪知名投资人的持仓变化 |
| 6 | 供需分析 | 分析相关资产的供需数据 |
| 7 | 产业链冲击 | 评估上中下游产业链影响 |
| 8 | Agent 讨论 | 五位顶级投资人观点交锋 |

### 五位投资大师 Agent

- **Agent（沃伦·巴菲特 & 段永平）** - 价值投资
- **Agent（詹姆斯·西蒙斯）** - 量化投资
- **Agent（红杉资本）** - 风险投资
- **Agent（贝莱德）** - 被动投资
- **Agent（雷达里奥 & 索罗斯）** - 宏观对冲

## 在线预览

项目已部署，可直接体验：

👉 **https://financialanalysis.coze.site**

## 示例截图

![金融分析平台](https://code.coze.cn/api/sandbox/coze_coding/file/proxy?expire_time=-1&file_path=assets%2Ffinancialanalysis.coze.site_.png&nonce=81d4f5e8-df9d-4095-bf7a-4ebfd3db5d75&project_id=7610328561177788443&sign=256ef1cba4a27ec12e9d7627cdb341b418ab594b920fb3b00154c62fa5674048)

## 本地运行

```bash
# 安装依赖
pnpm install

# 启动开发服务器
pnpm dev

# 访问 http://localhost:5000
```

## 技术栈

- **框架**: Next.js 16 (App Router)
- **语言**: TypeScript
- **UI**: shadcn/ui + Tailwind CSS
- **AI**: 豆包/DeepSeek 大模型
- **搜索**: 智能搜索 API

## 自行部署配置

### 1. 获取 API Key

本项目使用火山引擎的大模型服务，你需要准备：

- **ARK API Key**: 在 [火山引擎 ARK 控制台](https://console.volcengine.com/ark) 获取

### 2. 配置环境变量

在项目根目录创建 `.env` 文件：

```env
ARK_API_KEY=your_api_key_here
```

### 3. 启动项目

```bash
pnpm install
pnpm dev
```

访问 http://localhost:5000 即可使用。

## 项目结构

```
src/
├── app/
│   ├── page.tsx           # 首页（八步分析界面）
│   └── api/
│       └── news/
│           └── analysis/  # 分析 API
├── components/ui/         # shadcn/ui 组件
└── lib/                   # 工具函数
```

## License

MIT License - 详见 [LICENSE](LICENSE)
