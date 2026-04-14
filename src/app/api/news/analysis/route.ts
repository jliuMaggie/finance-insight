import { NextRequest, NextResponse } from 'next/server';
import { SearchClient, Config, LLMClient } from 'coze-coding-dev-sdk';

// 精选财经媒体列表（与页面媒体导航一致）
const MEDIA_SITES = [
  // 国内财经媒体
  { name: '虎嗅', domain: 'huxiu.com' },
  { name: '36氪', domain: '36kr.com' },
  { name: '钛媒体', domain: 'tmtpost.com' },
  { name: '界面新闻', domain: 'jiemian.com' },
  { name: '财新网', domain: 'caixin.com' },
  { name: '第一财经', domain: 'yicai.com' },
  { name: '经济观察报', domain: 'eeo.com.cn' },
  { name: '中国经营报', domain: 'cb.com.cn' },
  { name: '21世纪经济报道', domain: '21jingji.com' },
  { name: '华尔街见闻', domain: 'wallstreetcn.com' },
  // 国际媒体
  { name: '华尔街日报', domain: 'wsj.com' },
  { name: '金融时报', domain: 'ft.com' },
  { name: '经济学人', domain: 'economist.com' },
  { name: '彭博社', domain: 'bloomberg.com' },
  { name: '路透社', domain: 'reuters.com' },
  { name: '福布斯', domain: 'forbes.com' },
  { name: '商业内幕', domain: 'businessinsider.com' },
  { name: '财富', domain: 'fortune.com' },
  { name: '纽约时报', domain: 'nytimes.com' },
  { name: 'BBC财经', domain: 'bbc.com/news/business' },
  { name: '日经亚洲', domain: 'asia.nikkei.com' },
  { name: 'FT中文网', domain: 'ftchinese.com' },
];

// 需要排除的栏目标题模式
const EXCLUDE_PATTERNS = [
  '早报', '晚报', '日报', '晨报', '收盘行情', '今日行情',
  '资讯汇总', '新闻汇总', '一览', '速览', '回顾',
  '周报', '月报', '年终盘点', '年度',
  '栏目', '专题', '首页', '频道', '精华', '推荐',
  '订阅', 'APP', '下载', '关于我们',
  // 排除纯数据汇总
  '融资余额', '融资净买入', '融资融券', '大宗交易',
  '资金流向', '主力资金',
  '涨幅榜', '跌幅榜', '涨停股', '跌停股',
];

// 高权重关键词（出现这些词说明是重要新闻）
const HIGH_WEIGHT_KEYWORDS = [
  '战争', '冲突', '制裁', '关税', '贸易战', '核', '导弹',
  '大选', '总统', '首相', '议会', '国会', '白宫',
  '央行', '美联储', '加息', '降息',
  '崩盘', '暴涨', '暴跌', '危机',
  '突破', '历史首次', '首次', '最大',
  '协议', '谈判', '达成', '签署',
  '去世', '辞职', '下台', '任命',
];

// 低权重关键词（出现这些词可能是汇总）
const LOW_WEIGHT_KEYWORDS = [
  '融资', 'ETF', '个股', '科创板', '创业板', '北向',
  '南向', '资金', '净流入', '净流出',
  '行情播报', '收盘播报',
];

interface NewsItem {
  title: string;
  url: string;
  source: string;
  publishTime?: string;
  snippet?: string;
  weightScore: number;
}

interface TopicCluster {
  topic: string;
  keywords: string[];
  newsCount: number;
  news: NewsItem[];
  importanceScore: number;
  weightScore: number;
}

interface HistoricalEvent {
  year: string;
  event: string;
  outcome: string;
  relevance: string;
}

interface AnalysisStep {
  step: number;
  stepName: string;
  status: 'pending' | 'running' | 'completed' | 'error';
  data?: any;
  error?: string;
}

export async function POST(request: NextRequest) {
  const config = new Config();
  const searchClient = new SearchClient(config);
  const llmClient = new LLMClient(config);

  const steps: AnalysisStep[] = [
    { step: 1, stepName: '爬取新闻', status: 'pending' },
    { step: 2, stepName: '主题归类', status: 'pending' },
    { step: 3, stepName: '热度排序', status: 'pending' },
    { step: 4, stepName: '历史分析', status: 'pending' },
  ];

  try {
    // ========== 步骤1：爬取新闻 ==========
    steps[0].status = 'running';
    
    const allNews: NewsItem[] = [];
    
    // 基于精选媒体搜索
    const allQueries = MEDIA_SITES.flatMap((media) => [
      `site:${media.domain} 今日 新闻 最新`,
      `site:${media.domain} 财经 市场 最新`,
    ]);
    
    // 添加一些通用的热门关键词搜索，确保不遗漏
    const fallbackQueries = [
      'site:wsj.com OR site:bloomberg.com OR site:reuters.com 市场 行情',
      'site:huxiu.com OR site:36kr.com 融资 投资 动态',
      'site:caixin.com OR site:jiemian.com 宏观经济 政策',
    ];
    
    allQueries.push(...fallbackQueries);
    
    // 并行搜索
    const searchPromises = allQueries.map(async (query) => {
      try {
        const response = await searchClient.advancedSearch(query, {
          searchType: 'web',
          count: 15,
          timeRange: '1d',
          needSummary: true,
          needUrl: true,
        });

        if (response.web_items && response.web_items.length > 0) {
          return response.web_items.map((item) => ({
            title: item.title || '',
            url: item.url || '',
            source: item.site_name || extractSourceFromUrl(item.url || ''),
            publishTime: item.publish_time,
            snippet: item.snippet || '',
            weightScore: calculateWeight(item.title || '', item.snippet || ''),
          }));
        }
      } catch (error) {
        console.error(`Search error for "${query}":`, error);
      }
      return [];
    });

    const resultsArray = await Promise.all(searchPromises);
    resultsArray.forEach((items) => allNews.push(...items));

    // 去重
    const uniqueNews = deduplicateNews(allNews);
    
    // 过滤掉栏目标题
    const filteredNews = filterNews(uniqueNews);
    
    // 按权重排序，重要新闻优先
    filteredNews.sort((a, b) => b.weightScore - a.weightScore);

    steps[0].status = 'completed';
    steps[0].data = {
      totalCount: filteredNews.length,
      topNews: filteredNews.slice(0, 10).map(n => n.title),
    };

    console.log(`步骤1完成：爬取到 ${filteredNews.length} 条有效新闻`);
    console.log('TOP新闻:', filteredNews.slice(0, 5).map(n => n.title).join(' | '));

    // ========== 步骤2：主题归类 ==========
    steps[1].status = 'running';

    const topicClusters = await classifyNewsByTopic(filteredNews, llmClient);

    steps[1].status = 'completed';
    steps[1].data = {
      clustersCount: topicClusters.length,
      clusters: topicClusters,
    };

    console.log(`步骤2完成：归类为 ${topicClusters.length} 个主题`);

    // ========== 步骤3：热度排序 ==========
    steps[2].status = 'running';

    // 综合评分 = 新闻数量 * 10 + 重要性 * 20 + 权重分
    const rankedTopics = topicClusters
      .map((cluster) => ({
        ...cluster,
        hotScore: cluster.newsCount * 10 + cluster.importanceScore * 20 + (cluster.weightScore || 0),
      }))
      .sort((a, b) => b.hotScore - a.hotScore);

    steps[2].status = 'completed';
    steps[2].data = {
      topTopic: rankedTopics[0] || null,
      allTopics: rankedTopics,
      totalTopics: rankedTopics.length,
    };

    console.log(`步骤3完成：热度最高的topic是 "${rankedTopics[0]?.topic}" (${rankedTopics[0]?.newsCount}条)`);

    // ========== 步骤4：历史分析 ==========
    steps[3].status = 'running';

    let historicalAnalysis = null;
    
    if (rankedTopics[0] && rankedTopics[0].newsCount >= 2) {
      historicalAnalysis = await analyzeHistoricalEvents(rankedTopics[0], searchClient, llmClient);
    }

    steps[3].status = 'completed';
    steps[3].data = historicalAnalysis;

    console.log(`步骤4完成：历史分析结果已生成`);

    // ========== 返回完整结果 ==========
    return NextResponse.json({
      success: true,
      steps,
      finalResult: {
        topTopic: rankedTopics[0],
        allTopics: rankedTopics,
        historicalAnalysis,
      },
      summary: {
        totalNews: filteredNews.length,
        totalTopics: topicClusters.length,
        topTopicName: rankedTopics[0]?.topic || '无',
        topTopicCount: rankedTopics[0]?.newsCount || 0,
      },
    });

  } catch (error) {
    console.error('Analysis error:', error);
    
    for (let i = 0; i < steps.length; i++) {
      if (steps[i].status === 'running') {
        steps[i].status = 'error';
        steps[i].error = error instanceof Error ? error.message : '未知错误';
      }
    }

    return NextResponse.json(
      {
        success: false,
        steps,
        error: error instanceof Error ? error.message : '分析失败',
      },
      { status: 500 }
    );
  }
}

// ========== 从URL提取来源 ==========
function extractSourceFromUrl(url: string): string {
  try {
    const hostname = new URL(url).hostname;
    return hostname.replace('www.', '').split('.')[0];
  } catch {
    return '未知';
  }
}

// ========== 计算新闻权重分 ==========
function calculateWeight(title: string, snippet: string): number {
  let score = 0;
  const text = title + ' ' + (snippet || '');
  
  // 高权重关键词
  for (const kw of HIGH_WEIGHT_KEYWORDS) {
    if (text.includes(kw)) score += 5;
  }
  
  // 低权重关键词（扣分）
  for (const kw of LOW_WEIGHT_KEYWORDS) {
    if (text.includes(kw)) score -= 2;
  }
  
  // 标题长度适中加分（15-40字）
  if (title.length >= 15 && title.length <= 40) score += 2;
  
  // 有具体数字的加分
  if (/\d+%/.test(text)) score += 3;  // 百分比
  if (/\d{4}年/.test(text)) score += 2; // 年份
  if (/\d+亿/.test(text) || /\d+万/.test(text)) score += 2; // 金额
  
  return score;
}

// 允许的媒体域名白名单
const ALLOWED_DOMAINS = [
  'huxiu.com', '36kr.com', 'tmtpost.com', 'jiemian.com', 
  'caixin.com', 'yicai.com', 'eeo.com.cn', 'cb.com.cn',
  '21jingji.com', 'wallstreetcn.com',
  'wsj.com', 'ft.com', 'economist.com', 'bloomberg.com',
  'reuters.com', 'forbes.com', 'businessinsider.com', 
  'fortune.com', 'nytimes.com', 'ftchinese.com',
];

// ========== 过滤新闻 ==========
function filterNews(news: NewsItem[]): NewsItem[] {
  return news.filter((item) => {
    const title = item.title;
    const lowerTitle = title.toLowerCase();
    const itemUrl = item.url || '';
    
    // 排除栏目标题
    for (const pattern of EXCLUDE_PATTERNS) {
      if (lowerTitle.includes(pattern.toLowerCase())) {
        return false;
      }
    }
    
    // 标题太短或太长
    if (title.length < 8 || title.length > 60) {
      return false;
    }
    
    // 排除纯数字标题
    if (/^\d+$/.test(title)) {
      return false;
    }
    
    // 排除问号过多的（可能是问答类）
    if ((title.match(/[？?]/g) || []).length > 2) {
      return false;
    }
    
    // 来源验证：优先使用我们定义的媒体来源
    const sourceLower = item.source.toLowerCase();
    const isAllowedSource = ALLOWED_DOMAINS.some(domain => 
      sourceLower.includes(domain.replace('www.', ''))
    );
    
    // 如果来源不在白名单中，检查URL是否在白名单中
    let isAllowedUrl = false;
    if (itemUrl) {
      isAllowedUrl = ALLOWED_DOMAINS.some(domain => itemUrl.includes(domain));
    }
    
    // 来源或URL至少有一个在白名单中
    if (!isAllowedSource && !isAllowedUrl) {
      // 放宽限制：知名财经媒体也可以（这些平台聚合质量也较高）
      const trustedSources = [
        // 国内
        '东方财富', '新浪财经', '腾讯财经', '网易财经', '凤凰财经',
        '第一财经', '财新', '36氪', '虎嗅', '钛媒体', '界面新闻',
        '华尔街见闻', '经济观察报', '21世纪经济报道', '中国经营报',
        // 国际中文
        '华尔街日报', '彭博', '路透', '金融时报', '经济学人', '福布斯',
        'BBC', 'CNN', '纽约时报', '日经', '财富', '商业内幕',
        // 其他可信赖
        '英为财情', 'Investing.com', '格隆汇', '雪球', '同花顺'
      ];
      const isTrusted = trustedSources.some(ts => sourceLower.includes(ts));
      if (!isTrusted) {
        // 如果新闻标题包含重要关键词，也可以保留
        const importantKeywords = ['战争', '冲突', '制裁', '加息', '降息', '崩盘', '暴涨', '暴跌', '危机', '突破'];
        const hasImportantKeyword = importantKeywords.some(kw => lowerTitle.includes(kw));
        if (!hasImportantKeyword) {
          return false;
        }
      }
    }
    
    return true;
  });
}

// ========== 去重 ==========
function deduplicateNews(news: NewsItem[]): NewsItem[] {
  const seen = new Map<string, NewsItem>();
  
  for (const item of news) {
    const key = normalizeKey(item.title);
    if (!seen.has(key)) {
      seen.set(key, item);
    }
  }
  
  return Array.from(seen.values());
}

// ========== 标准化标题用于去重 ==========
function normalizeKey(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^\u4e00-\u9fa5a-z0-9]/g, '')
    .substring(0, 50);
}

// ========== LLM主题归类 ==========
async function classifyNewsByTopic(news: NewsItem[], llmClient: LLMClient): Promise<TopicCluster[]> {
  const analysisNews = news.slice(0, 60);
  
  const newsTexts = analysisNews
    .map((item, idx) => `${idx + 1}. [${item.source}] ${item.title}\n   ${(item.snippet || '').substring(0, 80)}`)
    .join('\n');

  const prompt = `请将以下新闻按主题进行归类。只分析有实质内容的新闻。

新闻列表：
${newsTexts}

请分析这些新闻，识别出真正重要的新闻主题。输出JSON格式：
{
  "clusters": [
    {
      "topic": "精准的主题描述（如：美伊战争局势升级、茅台业绩发布、美联储加息等）",
      "keywords": ["关键词1", "关键词2", "关键词3"],
      "newsCount": 该主题的新闻数量,
      "importanceScore": 1-10的重要性评分,
      "weightScore": 权重分,
      "news": [
        {"title": "新闻标题", "source": "来源", "url": "链接", "snippet": "摘要"}
      ]
    }
  ]
}

要求：
1. 主题必须是具体的新闻事件（如"美国伊朗冲突"、"华为发布新手机"）
2. 不能是笼统的主题（如"市场行情"、"财经新闻"）
3. 每个主题至少要有2条新闻
4. 最多输出8个主题
5. 按新闻数量从多到少排序
6. 重要性评分要考虑：国际冲突 > 重大政策 > 市场波动 > 日常新闻`;

  try {
    const response = await llmClient.invoke([
      {
        role: 'system',
        content: '你是一个专业的金融新闻分析师，擅长识别具体的、有价值的新闻事件。你的回答必须是有效的JSON格式。',
      },
      { role: 'user', content: prompt },
    ], {
      temperature: 0.3,
    });

    const content = response.content;
    const jsonMatch = content.match(/\{[\s\S]*\}/);

    if (jsonMatch) {
      const result = JSON.parse(jsonMatch[0]);
      return result.clusters || [];
    }
  } catch (error) {
    console.error('Error classifying news:', error);
  }

  return [];
}

// ========== 历史事件分析 ==========
async function analyzeHistoricalEvents(
  topTopic: TopicCluster,
  searchClient: SearchClient,
  llmClient: LLMClient
): Promise<{
  topic: string;
  summary: string;
  historicalEvents: HistoricalEvent[];
  marketImpact: string;
  investorAdvice: string;
}> {
  const topicName = topTopic.topic;
  const keywords = topTopic.keywords.join(' ');

  // 搜索历史类似事件
  const historySearchResponse = await searchClient.advancedSearch(
    `${keywords} 历史 事件 回顾 影响`,
    {
      searchType: 'web',
      count: 15,
      timeRange: '5y',
      needSummary: true,
    }
  );

  const historyTexts = (historySearchResponse.web_items || [])
    .map((item, idx) => `${idx + 1}. ${item.title}\n${item.snippet || ''}`)
    .join('\n\n');

  const prompt = `基于当前最热话题"${topicName}"，分析其历史类似事件。

相关历史新闻：
${historyTexts}

请分析：
1. 当前热点：该话题的核心内容和市场关注点
2. 历史类似事件：过去发生过哪些类似事件
3. 最终结局：这些事件是如何收场的
4. 市场影响：对股市、经济造成了什么影响
5. 投资者建议：当前情况下投资者应该注意什么

输出JSON格式：
{
  "summary": "当前热点话题的简要分析（2-3句话）",
  "historicalEvents": [
    {
      "year": "发生年份",
      "event": "事件描述",
      "outcome": "事件结局/影响",
      "relevance": "与当前事件的相关性"
    }
  ],
  "marketImpact": "对市场的整体影响分析（2-3句话）",
  "investorAdvice": "给投资者的具体建议（2-3句话）"
}`;

  try {
    const response = await llmClient.invoke([
      {
        role: 'system',
        content: '你是一个资深金融市场历史分析师，擅长从历史事件中总结规律。你的回答必须是有效的JSON格式。',
      },
      { role: 'user', content: prompt },
    ], {
      temperature: 0.5,
    });

    const content = response.content;
    const jsonMatch = content.match(/\{[\s\S]*\}/);

    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (error) {
    console.error('Error analyzing historical events:', error);
  }

  return {
    topic: topicName,
    summary: '暂无历史分析数据',
    historicalEvents: [],
    marketImpact: '暂无',
    investorAdvice: '建议关注后续发展，谨慎决策',
  };
}
