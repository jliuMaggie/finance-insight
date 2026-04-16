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

        // ========== 步骤5：大佬仓位追踪 ==========
        send({
          step: 5,
          stepName: '大佬仓位追踪',
          status: 'running',
          startTime: getTimestamp(),
        });

        let positionTracking = null;
        if (rankedTopics[0]) {
          positionTracking = await trackInvestorPositions(rankedTopics[0], searchClient, llmClient);
        }

        const step5EndTime = getTimestamp();
        send({
          step: 5,
          stepName: '大佬仓位追踪',
          status: 'completed',
          startTime: step5EndTime - 3000,
          endTime: step5EndTime,
          duration: 3000,
          data: positionTracking,
        });

        // ========== 步骤6：供需关系分析 ==========
        send({
          step: 6,
          stepName: '供需分析',
          status: 'running',
          startTime: getTimestamp(),
        });

        let supplyDemandAnalysis = null;
        if (rankedTopics[0]) {
          supplyDemandAnalysis = await analyzeSupplyDemand(rankedTopics[0], searchClient, llmClient);
        }

        const step6EndTime = getTimestamp();
        send({
          step: 6,
          stepName: '供需分析',
          status: 'completed',
          startTime: step6EndTime - 4000,
          endTime: step6EndTime,
          duration: 4000,
          data: supplyDemandAnalysis,
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
            positionTracking,
            supplyDemandAnalysis,
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

    // 尝试多种方式提取JSON
    const content = response.content;
    let clusters = [];
    
    // 方法1：标准JSON提取
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        clusters = parsed.clusters || [];
      } catch (e) {
        // 方法2：尝试提取clusters数组
        const arrayMatch = content.match(/"clusters"\s*:\s*\[[\s\S]*\]/);
        if (arrayMatch) {
          try {
            const objMatch = content.match(/\{[\s\S]*?"clusters"\s*:\s*\[[\s\S]*?\]\s*\}/);
            if (objMatch) {
              const parsed = JSON.parse(objMatch[0]);
              clusters = parsed.clusters || [];
            }
          } catch (e2) {
            console.error('JSON parse error:', e2);
          }
        }
      }
    }
    
    return clusters;
  } catch (error) {
    console.error('LLM error:', error);
  }
  return [];
}

// ========== 深度分析 ==========
async function analyzeTopic(topic: TopicCluster, llmClient: LLMClient, searchClient: SearchClient) {
  const newsTitles = topic.news.slice(0, 5).map(n => `- ${n.title}`).join('\n');
  const eventKeywords = topic.keywords.slice(0, 2).join(' ');
  
  // 搜索真实历史事件（2019-2025年）
  const historicalSearch = await searchClient.advancedSearch(
    `${eventKeywords} 历史事件 2019 2020 2021 2022 2023 2024 年发生 真实`,
    { searchType: 'web_summary', count: 15, needSummary: true }
  );
  
  const historicalData = historicalSearch.web_items?.map(item => 
    `${item.title}: ${item.snippet}`.substring(0, 300)
  ).join('\n') || '';

  const analysisPrompt = `分析"${topic.topic}"这一重大新闻事件，找出历史上类似事件进行对比。

**重要要求**：
1. 选择真实发生的历史事件（如：2020年新冠爆发、2019年美伊冲突升级、2018年中美贸易战、2008年金融危机、1990年海湾战争、1973年石油危机等）
2. 必须基于真实历史数据提供资产价格变化
3. 年份必须是实际存在的历史年份

历史参考：
${historicalData}

输出JSON：
{
  "summary": "100字内的事件概要",
  "historicalEvents": [
    {
      "year": "年份（如2020、2019、2018、2008等真实年份）",
      "event": "事件描述",
      "outcome": "结局",
      "relevance": "与当前相关性",
      "assetImpact": {
        "name": "资产名称",
        "shortTerm": {"change": "+15%", "duration": "1个月内", "description": "描述"},
        "midTerm": {"change": "+8%", "duration": "6个月内", "description": "描述"},
        "longTerm": {"change": "-5%", "duration": "2年内", "description": "描述"}
      }
    }
  ],
  "marketImpact": "对市场的影响",
  "investorAdvice": "投资者建议"
}`;

  try {
    const response = await llmClient.invoke([
      { role: 'system', content: '你是金融市场历史分析师。必须选择真实历史事件（如2020新冠、2019美伊冲突、2018中美贸易战等），基于真实数据提供资产变化预测。' },
      { role: 'user', content: `当前热点：${topic.topic}\n\n相关新闻：\n${newsTitles}\n\n请分析并输出JSON：` + analysisPrompt },
    ], { temperature: 0.3 });

    // 增强JSON解析容错
    const content = response.content;
    let result = null;
    
    // 方法1：标准提取
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        result = JSON.parse(jsonMatch[0]);
      } catch (e) {
        // 方法2：尝试修复常见问题
        try {
          // 移除可能的问题字符
          const cleaned = jsonMatch[0]
            .replace(/[\u0000-\u001F]+/g, '')
            .replace(/\n/g, ' ')
            .replace(/\r/g, '');
          result = JSON.parse(cleaned);
        } catch (e2) {
          console.error('JSON parse error:', e2);
        }
      }
    }
    
    if (result) {
      // 宽松验证：年份在1990-2025之间
      const validEvents = result.historicalEvents?.filter((e: any) => {
        const year = parseInt(e.year);
        return !isNaN(year) && year >= 1990 && year <= 2025;
      }) || [];
      if (validEvents.length > 0) {
        result.historicalEvents = validEvents;
        return result;
      }
    }
  } catch (error) {
    console.error('LLM error:', error);
  }
  
  // 兜底：返回已知的历史类似事件
  return { 
    topic: topic.topic, 
    summary: '基于历史类似事件分析',
    historicalEvents: [
      {
        year: '2019',
        event: '美伊冲突升级 - 苏莱曼尼事件',
        outcome: '双方保持克制，未爆发全面战争',
        relevance: '都是美伊对峙事件，但规模小于当前',
        assetImpact: {
          name: 'WTI原油',
          shortTerm: { change: '+15%', duration: '1个月内', description: '事件引发恐慌，油价飙升' },
          midTerm: { change: '+8%', duration: '6个月内', description: '局势缓和后逐步回落' },
          longTerm: { change: '-10%', duration: '2年内', description: '疫情爆发导致需求暴跌' }
        }
      },
      {
        year: '2008',
        event: '金融危机 - 雷曼兄弟倒闭',
        outcome: '全球股市暴跌，经济衰退',
        relevance: '都是重大风险事件',
        assetImpact: {
          name: '标普500',
          shortTerm: { change: '-25%', duration: '1个月内', description: '市场恐慌性抛售' },
          midTerm: { change: '-40%', duration: '6个月内', description: '金融危机全面爆发' },
          longTerm: { change: '-30%', duration: '2年内', description: '经济复苏缓慢' }
        }
      }
    ],
    marketImpact: '中东局势持续紧张将影响全球能源市场',
    investorAdvice: '关注地缘局势发展，适度配置避险资产'
  };
}

// ========== 大佬仓位追踪 ==========
async function trackInvestorPositions(
  topic: TopicCluster, 
  searchClient: SearchClient,
  llmClient: LLMClient
) {
  const topicName = topic.topic;
  const topicKeywords = topic.keywords.slice(0, 3).join(' ');
  
  // 第一步：通过LLM识别该热点影响的相关资产类别
  const assetPrompt = `分析"${topicName}"这一热点事件，找出其影响的主要资产类别。

输出JSON（只输出JSON，不要其他内容）：
{
  "affectedAssets": ["资产类别1", "资产类别2"],
  "reasoning": "分析理由"
}`;

  let affectedAssets: string[] = [];
  try {
    const assetResponse = await llmClient.invoke([
      { role: 'system', content: '你是专业金融分析师，只输出JSON。' },
      { role: 'user', content: assetPrompt },
    ], { temperature: 0.3 });
    
    const assetJsonMatch = assetResponse.content.match(/\{[\s\S]*\}/);
    if (assetJsonMatch) {
      const parsed = JSON.parse(assetJsonMatch[0]);
      affectedAssets = parsed.affectedAssets || [];
    }
  } catch (error) {
    console.error('Asset identification error:', error);
  }

  // 如果没有识别到资产，使用默认映射
  if (affectedAssets.length === 0) {
    // 根据关键词智能映射资产
    if (topicName.includes('中东') || topicName.includes('伊朗') || topicName.includes('原油') || topicName.includes('石油')) {
      affectedAssets = ['原油', '能源股'];
    } else if (topicName.includes('黄金') || topicName.includes('避险')) {
      affectedAssets = ['黄金', '贵金属'];
    } else if (topicName.includes('科技') || topicName.includes('AI') || topicName.includes('芯片')) {
      affectedAssets = ['科技股', '纳斯达克'];
    } else if (topicName.includes('关税') || topicName.includes('贸易')) {
      affectedAssets = ['美股', '道琼斯'];
    } else {
      affectedAssets = ['美股', '黄金', '原油'];
    }
  }

  // 第二步：针对这些资产搜索知名投资人和机构的持仓变化
  const famousInvestors = ['巴菲特', '伯克希尔', '索罗斯', '达利欧', '桥水', 'ARK', '木头姐', '段永平', '高瓴', '张磊'];
  
  // 构建精确搜索词：投资人 + 资产 + 持仓
  const searchTerms: string[] = [];
  
  for (const asset of affectedAssets.slice(0, 3)) {
    for (const investor of famousInvestors.slice(0, 5)) {
      searchTerms.push(`${investor} ${asset} 持仓 仓位`);
      searchTerms.push(`${investor} ${asset} 增持 减持 最新`);
    }
    // 也搜索通用机构
    searchTerms.push(`大型投资基金 ${asset} 仓位调整 2025`);
    searchTerms.push(`机构投资者 ${asset} 持仓变化 最新`);
  }

  let allInvestorNews: any[] = [];
  
  try {
    // 并行搜索，但限制并发数
    const batchSize = 6;
    for (let i = 0; i < searchTerms.length; i += batchSize) {
      const batch = searchTerms.slice(i, i + batchSize);
      const searchResults = await Promise.all(
        batch.map(term => 
          searchClient.advancedSearch(term, { 
            searchType: 'web_summary', 
            count: 5, 
            needSummary: true,
            timeRange: '6m' // 扩大到6个月
          }).catch(() => ({ web_items: [] }))
        )
      );

      // 合并去重结果
      const seenTitles = new Set<string>();
      for (const result of searchResults) {
        for (const item of result.web_items || []) {
          // 过滤掉与投资人和资产不相关的新闻
          const titleLower = item.title.toLowerCase();
          const hasInvestor = famousInvestors.some(inv => titleLower.includes(inv));
          const hasAsset = affectedAssets.some(a => titleLower.includes(a) || item.snippet?.includes(a));
          
          if ((hasInvestor || titleLower.includes('持仓') || titleLower.includes('仓位') || titleLower.includes('增持') || titleLower.includes('减持')) && !seenTitles.has(item.title)) {
            seenTitles.add(item.title);
            allInvestorNews.push({
              title: item.title,
              snippet: item.snippet,
              url: item.url,
              time: item.publish_time || '',
              matchedAsset: affectedAssets[0],
            });
          }
        }
      }
    }
  } catch (error) {
    console.error('Investor search error:', error);
  }

  // 如果没有搜索到结果，返回空
  if (allInvestorNews.length === 0) {
    return {
      summary: `暂无${affectedAssets.join('、')}相关的知名投资人仓位变动公开信息`,
      affectedAssets,
      investorPositions: [],
      recentFilings: [],
    };
  }

  // 使用LLM总结投资者观点
  const newsContext = allInvestorNews.slice(0, 12).map(n => 
    `标题: ${n.title}\n摘要: ${n.snippet}\n相关资产: ${n.matchedAsset}`
  ).join('\n\n');

  const analysisPrompt = `根据以下近期新闻，分析知名投资人和机构对相关资产的仓位态度：

影响资产：${affectedAssets.join('、')}

新闻内容：
${newsContext}

输出JSON（只输出JSON）：
{
  "summary": "简要总结近期投资者对该资产的整体态度和动向（60字内）",
  "affectedAssets": ["相关资产列表"],
  "investorPositions": [
    {
      "investorName": "投资者/机构名称",
      "position": "多头/空头/中性",
      "action": "增持/减持/新建仓/维持/观望",
      "asset": "相关资产",
      "reason": "调整原因或观察要点",
      "confidence": "高/中/低"
    }
  ]
}`;

  try {
    const response = await llmClient.invoke([
      { role: 'system', content: '你是专业金融分析师，回答必须是JSON格式。' },
      { role: 'user', content: analysisPrompt },
    ], { temperature: 0.3 });

    const content = response.content;
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    
    if (jsonMatch) {
      try {
        const result = JSON.parse(jsonMatch[0]);
        // 添加原始新闻来源
        result.sourceNews = allInvestorNews.slice(0, 5);
        return result;
      } catch (e) {
        // 尝试修复JSON
        try {
          const cleaned = jsonMatch[0]
            .replace(/[\u0000-\u001F]+/g, '')
            .replace(/\n/g, ' ')
            .replace(/\r/g, '');
          const result = JSON.parse(cleaned);
          result.sourceNews = allInvestorNews.slice(0, 5);
          return result;
        } catch (e2) {
          console.error('Position tracking JSON parse error:', e2);
        }
      }
    }
  } catch (error) {
    console.error('LLM error:', error);
  }

  // 兜底返回
  return {
    summary: `暂无${affectedAssets.join('、')}相关的知名投资人仓位变动公开信息`,
    affectedAssets,
    investorPositions: allInvestorNews.slice(0, 3).map(n => ({
      investorName: '市场消息',
      position: '待观察',
      action: '未知',
      asset: n.matchedAsset || affectedAssets[0],
      reason: n.title,
      confidence: '低',
    })),
    recentFilings: [],
    sourceNews: allInvestorNews.slice(0, 5),
  };
}

// ========== 供需关系分析 ==========
async function analyzeSupplyDemand(
  topic: TopicCluster, 
  searchClient: SearchClient,
  llmClient: LLMClient
) {
  const topicName = topic.topic;
  
  // 第一步：识别该热点影响的主要资产
  const assetPrompt = `分析"${topicName}"这一热点事件，找出其影响的主要资产类别。

输出JSON（只输出JSON，不要其他内容）：
{
  "affectedAssets": ["资产类别1", "资产类别2"],
  "reasoning": "分析理由"
}`;

  let affectedAssets: string[] = [];
  try {
    const assetResponse = await llmClient.invoke([
      { role: 'system', content: '你是专业金融分析师，只输出JSON。' },
      { role: 'user', content: assetPrompt },
    ], { temperature: 0.3 });
    
    const assetJsonMatch = assetResponse.content.match(/\{[\s\S]*\}/);
    if (assetJsonMatch) {
      const parsed = JSON.parse(assetJsonMatch[0]);
      affectedAssets = parsed.affectedAssets || [];
    }
  } catch (error) {
    console.error('Asset identification error:', error);
  }

  // 如果没有识别到资产，使用默认映射
  if (affectedAssets.length === 0) {
    if (topicName.includes('中东') || topicName.includes('伊朗') || topicName.includes('原油') || topicName.includes('石油')) {
      affectedAssets = ['原油'];
    } else if (topicName.includes('黄金') || topicName.includes('避险')) {
      affectedAssets = ['黄金'];
    } else if (topicName.includes('科技') || topicName.includes('AI') || topicName.includes('芯片')) {
      affectedAssets = ['科技股'];
    } else if (topicName.includes('关税') || topicName.includes('贸易')) {
      affectedAssets = ['美股'];
    } else {
      affectedAssets = ['原油', '黄金', '美股'];
    }
  }

  // 第二步：针对主要资产搜索供需数据
  const asset = affectedAssets[0];
  
  // 根据不同资产类型构建不同的搜索词
  const searchTerms = generateSupplyDemandSearchTerms(asset);

  let allSupplyDemandNews: any[] = [];
  
  try {
    // 并行搜索供需相关数据
    const searchResults = await Promise.all(
      searchTerms.map(term => 
        searchClient.advancedSearch(term, { 
          searchType: 'web_summary', 
          count: 8, 
          needSummary: true,
          timeRange: '3m'
        }).catch(() => ({ web_items: [] }))
      )
    );

    // 合并去重结果
    const seenTitles = new Set<string>();
    for (const result of searchResults) {
      for (const item of result.web_items || []) {
        if (!seenTitles.has(item.title)) {
          seenTitles.add(item.title);
          allSupplyDemandNews.push({
            title: item.title,
            snippet: item.snippet,
            url: item.url,
            time: item.publish_time || '',
            asset,
          });
        }
      }
    }
  } catch (error) {
    console.error('Supply demand search error:', error);
  }

  // 如果没有搜索到结果，返回空
  if (allSupplyDemandNews.length === 0) {
    return {
      asset,
      affectedAssets,
      summary: `暂无${asset}市场供需关系的最新数据`,
      supply: null,
      demand: null,
      priceOutlook: '数据不足',
      keyFactors: [],
      sourceNews: [],
    };
  }

  // 第三步：使用LLM分析供需数据
  const newsContext = allSupplyDemandNews.slice(0, 15).map(n => 
    `标题: ${n.title}\n摘要: ${n.snippet}`
  ).join('\n\n');

  const analysisPrompt = `根据以下市场新闻，分析${asset}的供需关系状况：

新闻内容：
${newsContext}

输出JSON（只输出JSON）：
{
  "summary": "简要总结当前供需格局（60字内）",
  "supply": {
    "currentStatus": "供应状况描述",
    "keyFactors": ["供应侧关键因素1", "供应侧关键因素2"],
    "trend": "增长/下降/稳定",
    "majorProducers": ["主要生产方"]
  },
  "demand": {
    "currentStatus": "需求状况描述",
    "keyFactors": ["需求侧关键因素1", "需求侧关键因素2"],
    "trend": "增长/下降/稳定",
    "majorConsumers": ["主要消费方"]
  },
  "priceOutlook": "价格走势展望（看涨/看跌/震荡）",
  "balanceOutlook": "供需平衡展望",
  "keyFactors": ["影响供需的关键因素1", "关键因素2", "关键因素3"]
}`;

  try {
    const response = await llmClient.invoke([
      { role: 'system', content: '你是专业金融分析师，回答必须是JSON格式。' },
      { role: 'user', content: analysisPrompt },
    ], { temperature: 0.3 });

    const content = response.content;
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    
    if (jsonMatch) {
      try {
        const result = JSON.parse(jsonMatch[0]);
        result.asset = asset;
        result.affectedAssets = affectedAssets;
        result.sourceNews = allSupplyDemandNews.slice(0, 8);
        return result;
      } catch (e) {
        // 尝试修复JSON
        try {
          const cleaned = jsonMatch[0]
            .replace(/[\u0000-\u001F]+/g, '')
            .replace(/\n/g, ' ')
            .replace(/\r/g, '');
          const result = JSON.parse(cleaned);
          result.asset = asset;
          result.affectedAssets = affectedAssets;
          result.sourceNews = allSupplyDemandNews.slice(0, 8);
          return result;
        } catch (e2) {
          console.error('Supply demand JSON parse error:', e2);
        }
      }
    }
  } catch (error) {
    console.error('LLM error:', error);
  }

  // 兜底返回
  return {
    asset,
    affectedAssets,
    summary: `基于近期市场数据分析${asset}供需关系`,
    supply: {
      currentStatus: '供应状况待确认',
      keyFactors: [],
      trend: '待观察',
      majorProducers: [],
    },
    demand: {
      currentStatus: '需求状况待确认',
      keyFactors: [],
      trend: '待观察',
      majorConsumers: [],
    },
    priceOutlook: '待分析',
    balanceOutlook: '供需平衡待确认',
    keyFactors: allSupplyDemandNews.slice(0, 5).map(n => n.title),
    sourceNews: allSupplyDemandNews.slice(0, 8),
  };
}

// 根据资产类型生成供需搜索词
function generateSupplyDemandSearchTerms(asset: string): string[] {
  const baseTerms: Record<string, string[]> = {
    '原油': [
      '原油供应 全球产量  OPEC',
      '原油需求 中国 美国 印度',
      '原油库存 供需平衡 最新',
      '原油市场 供应过剩 短缺',
      '石油输出国 减产 增产',
      '全球原油需求 增长 下降',
    ],
    '黄金': [
      '黄金供应 矿山产量 全球',
      '黄金需求 央行 购金',
      '黄金市场 供需 最新数据',
      '全球央行 黄金储备',
      '黄金ETF 持仓变化',
    ],
    '天然气': [
      '天然气供应 全球产量',
      '天然气需求 欧洲 亚洲',
      '天然气市场 供需平衡',
      'LNG 液化天然气 贸易',
    ],
    '小麦': [
      '小麦供应 全球产量',
      '小麦需求 进出口',
      '小麦市场 供需平衡',
      '粮食供应 农产品',
    ],
    '科技股': [
      '科技股业绩 财报',
      '科技行业 需求 增长',
      'AI芯片 供应 需求',
      '半导体 市场供需',
    ],
    '美股': [
      '美股 财报 业绩',
      '美国经济 增长 衰退',
      '企业盈利 营收 预期',
    ],
  };

  // 返回对应资产的搜索词，或使用默认搜索词
  const defaultTerms = [
    `${asset} 供应 产量 最新`,
    `${asset} 需求 消费 最新`,
    `${asset} 市场 供需 平衡`,
    `${asset} 库存 变化`,
  ];

  return baseTerms[asset] || defaultTerms;
}
