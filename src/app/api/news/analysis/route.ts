import { SearchClient, Config, LLMClient } from 'coze-coding-dev-sdk';

// 精选财经媒体列表
const MEDIA_LIST = [
  '虎嗅', '36氪', '钛媒体', '界面新闻', '财新网', 
  '第一财经', '经济观察报', '华尔街见闻',
  '华尔街日报', '金融时报', '经济学人', '彭博社', '路透社'
];

// 突发事件关键词（最高权重）
const BREAKING_KEYWORDS = [
  '战争', '冲突', '爆发', '袭击', '导弹', '核', '制裁',
  '停火', '谈判', '协议', '达成', '签署', '破裂',
  '崩盘', '暴涨', '暴跌', '熔断', '停牌',
  '总统', '大选', '辞职', '下台', '去世', '任命',
  '突破', '首次', '最大', '历史新高', '历史低位',
  '突发', '刚刚', '重磅', '紧急',
];

// 次要重要关键词
const IMPORTANT_KEYWORDS = [
  '央行', '美联储', '加息', '降息', '利率', 'QE',
  'GDP', 'CPI', 'PMI', '非农', '就业',
  '关税', '贸易战', '脱钩',
  '科技', 'AI', '芯片', '半导体', '新能源',
  '政策', '监管', '改革', '试点',
  '上市', '退市', '并购', '收购', '融资',
];

// 排除词（常规低价值内容）
const EXCLUDE_PATTERNS = [
  '早报', '晚报', '日报', '晨报', '收盘', '午评', '收评',
  '行情', '涨跌', '涨幅榜', '跌幅榜', '资金流向',
  '资讯汇总', '新闻汇总', '头版头条', '精华摘要',
  '滚动新闻', '快讯', '预告', '一览',
  'ETF', '融资余额', '科创板', '创业板',
  '周报', '月报', '年报', '季报', '盘点',
  '栏目', '订阅', 'APP', '关于我们', '广告',
];

interface NewsItem {
  title: string;
  url: string;
  source: string;
  publishTime?: string;
  snippet?: string;
  weightScore: number;
  isBreaking: boolean;
}

interface TopicCluster {
  topic: string;
  keywords: string[];
  newsCount: number;
  news: NewsItem[];
  importanceScore: number;
}

interface SSEProgress {
  step: number;
  stepName: string;
  status: 'running' | 'completed' | 'error';
  startTime: number;
  endTime?: number;
  duration?: number;
  data?: any;
  error?: string;
}

function sendSSE(data: any, encoder: TextEncoder) {
  return encoder.encode(`data: ${JSON.stringify(data)}\n\n`);
}

function getTimestamp() {
  return Date.now();
}

export async function POST(request: Request) {
  const config = new Config();
  const searchClient = new SearchClient(config);
  const llmClient = new LLMClient(config);
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: SSEProgress) => {
        controller.enqueue(sendSSE(data, encoder));
      };

      const allNews: NewsItem[] = [];
      const usedTitles = new Set<string>();
      const usedContentHashes = new Set<string>();
      
      // 计算标题指纹（去除数字和常见词）
      function getTitleFingerprint(title: string): string {
        return title
          .toLowerCase()
          .replace(/\d+/g, '#')
          .replace(/[特朗普|关税|行政令|签署|最新|今日|2025]/g, '')
          .replace(/\s+/g, '')
          .substring(0, 30);
      }

      try {
        // ========== 步骤1：搜索热点新闻 ==========
        send({
          step: 1,
          stepName: '搜索热点新闻',
          status: 'running',
          startTime: getTimestamp(),
        });

        const searchQueries = [
          { query: '美国 伊朗 中东 冲突 最新 今日 2025', timeRange: '1d', weight: 15 },
          { query: '中东局势 战争 最新 今日', timeRange: '1d', weight: 15 },
          { query: '特朗普 关税 最新 今日 2025', timeRange: '1d', weight: 12 },
          { query: '中美 贸易 关税 最新 2025', timeRange: '1d', weight: 10 },
          { query: 'AI 芯片 突破 最新 今日', timeRange: '1d', weight: 8 },
          { query: 'site:huxiu.com OR site:36kr.com OR site:caixin.com OR site:jiemian.com OR site:wallstreetcn.com 今日 最新', timeRange: '1d', weight: 8 },
        ];

        for (const searchParams of searchQueries) {
          try {
            const response = await searchClient.advancedSearch(searchParams.query, {
              searchType: 'web',
              count: 15,
              timeRange: (searchParams as any).timeRange || '1d',
              needSummary: true,
              needUrl: true,
            });

            if (response.web_items) {
              for (const item of response.web_items) {
                const title = item.title || '';
                const url = item.url || '';
                const snippet = item.snippet || '';
                
                const titleKey = title.toLowerCase().replace(/\s+/g, '');
                const fingerprint = getTitleFingerprint(title);
                
                if (usedTitles.has(titleKey) || usedContentHashes.has(fingerprint)) continue;
                if (!title || title.length < 8) continue;
                
                const { score, isBreaking } = calculateWeight(title, snippet, searchParams.weight);
                if (shouldExclude(title)) continue;
                
                const source = identifySource(url);
                
                allNews.push({ title, url, source, publishTime: item.publish_time, snippet, weightScore: score, isBreaking });
                usedTitles.add(titleKey);
                usedContentHashes.add(fingerprint);
              }
            }
          } catch (error) {
            console.error(`Search error:`, error);
          }
        }

        // 去重并排序
        const uniqueNews = allNews
          .filter((item, index, self) => index === self.findIndex(t => t.url === item.url))
          .sort((a, b) => b.weightScore - a.weightScore);

        const step1EndTime = getTimestamp();
        send({
          step: 1,
          stepName: '搜索热点新闻',
          status: 'completed',
          startTime: step1EndTime - 1000,
          endTime: step1EndTime,
          duration: step1EndTime - step1EndTime + 1000,
          data: {
            totalCount: uniqueNews.length,
            topNews: uniqueNews.slice(0, 5).map(n => ({ title: n.title.substring(0, 50), source: n.source, weight: n.weightScore })),
          },
        });

        // ========== 步骤2：主题归类 ==========
        send({
          step: 2,
          stepName: '主题归类',
          status: 'running',
          startTime: getTimestamp(),
        });

        const topicClusters = await classifyNewsByTopic(uniqueNews, llmClient);

        const step2EndTime = getTimestamp();
        send({
          step: 2,
          stepName: '主题归类',
          status: 'completed',
          startTime: step2EndTime - 1000,
          endTime: step2EndTime,
          duration: 3000,
          data: { clustersCount: topicClusters.length },
        });

        // ========== 步骤3：热度排序 ==========
        send({
          step: 3,
          stepName: '热度排序',
          status: 'running',
          startTime: getTimestamp(),
        });

        const rankedTopics = topicClusters
          .map((cluster) => {
            const hasBreaking = cluster.news.some(n => n.isBreaking);
            const avgWeight = cluster.news.reduce((sum, n) => sum + n.weightScore, 0) / cluster.news.length;
            const breakingBonus = hasBreaking ? 50 : 0;
            return {
              ...cluster,
              hotScore: cluster.newsCount * 10 + avgWeight * 15 + cluster.importanceScore * 10 + breakingBonus,
              hasBreaking,
            };
          })
          .sort((a, b) => b.hotScore - a.hotScore);

        const step3EndTime = getTimestamp();
        send({
          step: 3,
          stepName: '热度排序',
          status: 'completed',
          startTime: step3EndTime - 1000,
          endTime: step3EndTime,
          duration: 500,
          data: { topTopic: rankedTopics[0] || null, allTopics: rankedTopics },
        });

        // ========== 步骤4：深度分析 ==========
        send({
          step: 4,
          stepName: '深度分析',
          status: 'running',
          startTime: getTimestamp(),
        });

        let deepAnalysis = null;
        if (rankedTopics[0]) {
          deepAnalysis = await analyzeTopic(rankedTopics[0], llmClient, searchClient);
        }

        const step4EndTime = getTimestamp();
        send({
          step: 4,
          stepName: '深度分析',
          status: 'completed',
          startTime: step4EndTime - 5000,
          endTime: step4EndTime,
          duration: 5000,
          data: deepAnalysis,
        });

        // ========== 最终结果 ==========
        controller.enqueue(sendSSE({
          type: 'final',
          success: true,
          finalResult: {
            topTopic: rankedTopics[0],
            allTopics: rankedTopics,
            historicalAnalysis: deepAnalysis ? {
              summary: deepAnalysis.summary || '',
              historicalEvents: deepAnalysis.historicalEvents || [],
              marketImpact: deepAnalysis.marketImpact || '',
              investorAdvice: deepAnalysis.investorAdvice || '',
            } : null,
          },
        }, encoder));

        controller.close();

      } catch (error) {
        console.error('Analysis error:', error);
        controller.enqueue(sendSSE({
          type: 'error',
          error: error instanceof Error ? error.message : '分析失败',
        }, encoder));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}

// ========== 计算权重 ==========
function calculateWeight(title: string, snippet: string, searchWeight: number): { score: number; isBreaking: boolean } {
  let score = searchWeight;
  let isBreaking = false;
  const text = title + ' ' + (snippet || '');
  
  for (const kw of BREAKING_KEYWORDS) {
    if (text.includes(kw)) {
      score += 8;
      isBreaking = true;
      break;
    }
  }
  
  for (const kw of IMPORTANT_KEYWORDS) {
    if (text.includes(kw)) score += 4;
  }
  
  if (/\d+%/.test(text)) score += 3;
  if (/\d{4}年\d{1,2}月/.test(text)) score += 2;
  if (/\d+[亿万美]/.test(text)) score += 2;
  if (title.length >= 12 && title.length <= 45) score += 2;
  
  const highQualitySources = ['路透社', '彭博社', '华尔街日报', '金融时报', '财新网', '华尔街见闻'];
  for (const src of highQualitySources) {
    if (text.includes(src)) score += 3;
  }
  
  return { score, isBreaking };
}

// ========== 排除检查 ==========
function shouldExclude(title: string): boolean {
  const lower = title.toLowerCase();
  for (const pattern of EXCLUDE_PATTERNS) {
    if (lower.includes(pattern.toLowerCase())) return true;
  }
  if (/^\d+$/.test(title)) return true;
  return false;
}

// ========== 识别来源 ==========
function identifySource(url: string): string {
  const urlLower = url.toLowerCase();
  const sourceMap: Record<string, string> = {
    'huxiu.com': '虎嗅', '36kr.com': '36氪', 'tmtpost.com': '钛媒体',
    'jiemian.com': '界面新闻', 'caixin.com': '财新网', 'yicai.com': '第一财经',
    'eeo.com.cn': '经济观察报', 'wallstreetcn.com': '华尔街见闻',
    'wsj.com': '华尔街日报', 'ft.com': '金融时报', 'ftchinese.com': '金融时报中文',
    'economist.com': '经济学人', 'bloomberg.com': '彭博社', 'reuters.com': '路透社',
    'bbc.com': 'BBC', 'thepaper.cn': '澎湃新闻',
  };
  for (const [domain, name] of Object.entries(sourceMap)) {
    if (urlLower.includes(domain)) return name;
  }
  return '其他';
}

// ========== LLM归类 ==========
async function classifyNewsByTopic(news: NewsItem[], llmClient: LLMClient): Promise<TopicCluster[]> {
  const newsTexts = news
    .slice(0, 30)
    .map((item, idx) => {
      const breaking = item.isBreaking ? '[突发] ' : '';
      return `${idx + 1}. ${breaking}[${item.source}] ${item.title}`;
    })
    .join('\n');

  const prompt = `请将以下财经新闻按主题归类：

${newsTexts}

输出JSON：
{
  "clusters": [
    {
      "topic": "具体新闻事件名称",
      "keywords": ["关键词"],
      "newsCount": 数量,
      "importanceScore": 1-10评分,
      "news": [{"title": "标题", "source": "来源", "url": "链接", "weightScore": 分数}]
    }
  ]
}`;

  try {
    const response = await llmClient.invoke([
      { role: 'system', content: '你是专业的金融新闻分析师，回答必须是JSON。' },
      { role: 'user', content: prompt },
    ], { temperature: 0.3 });

    const jsonMatch = response.content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]).clusters || [];
    }
  } catch (error) {
    console.error('LLM error:', error);
  }
  return [];
}

// ========== 深度分析 ==========
async function analyzeTopic(topic: TopicCluster, llmClient: LLMClient, searchClient: SearchClient) {
  const newsTitles = topic.news.slice(0, 5).map(n => `- ${n.title}`).join('\n');
  
  const analysisPrompt = `分析"${topic.topic}"这一重大新闻事件：

${newsTitles}

输出JSON（字段名必须严格按此格式）：
{
  "summary": "100字内的事件概要",
  "historicalEvents": [
    {
      "year": "年份",
      "event": "事件描述",
      "outcome": "结局",
      "relevance": "与当前相关性",
      "assetImpact": {
        "name": "资产名称",
        "shortTerm": {"change": "变化幅度如+15%", "duration": "1个月内", "description": "描述"},
        "midTerm": {"change": "变化幅度如+8%", "duration": "6个月内", "description": "描述"},
        "longTerm": {"change": "变化幅度如-5%", "duration": "2年内", "description": "描述"}
      }
    }
  ],
  "marketImpact": "对市场的影响分析",
  "investorAdvice": "给投资者的建议"
}`;

  try {
    const eventKeywords = topic.keywords.slice(0, 3).join(' ');
    const historicalSearch = await searchClient.advancedSearch(
      `${eventKeywords} 历史 资产价格 变化 数据`,
      { searchType: 'web_summary', count: 10, needSummary: true }
    );
    
    const historicalData = historicalSearch.web_items?.map(item => 
      `${item.title}: ${item.snippet}`.substring(0, 200)
    ).join('\n') || '';

    const response = await llmClient.invoke([
      { role: 'system', content: '你是金融市场历史数据分析师，回答必须是JSON，字段名必须严格按要求。必须包含资产短期/中期/长期的具体价格变化数据。' },
      { role: 'user', content: `当前热点：${topic.topic}\n\n相关新闻：\n${newsTitles}\n\n历史数据参考：\n${historicalData}\n\n请分析并输出JSON：` + analysisPrompt },
    ], { temperature: 0.5 });

    const jsonMatch = response.content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (error) {
    console.error('LLM error:', error);
  }
  
  return { topic: topic.topic, summary: '分析生成中...', historicalEvents: [], marketImpact: '暂无', investorAdvice: '观望' };
}
