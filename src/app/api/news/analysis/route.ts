import { NextRequest, NextResponse } from 'next/server';
import { SearchClient, Config, LLMClient } from 'coze-coding-dev-sdk';

// 财经媒体列表
const MEDIA_SITES = [
  { name: '虎嗅', domain: 'huxiu.com', searchTerms: ['site:huxiu.com 今日 财经', 'site:huxiu.com 最新 商业'] },
  { name: '36氪', domain: '36kr.com', searchTerms: ['site:36kr.com 今日 融资', 'site:36kr.com 最新 创业'] },
  { name: '钛媒体', domain: 'tmtpost.com', searchTerms: ['site:tmtpost.com 今日 快讯', 'site:tmtpost.com 科技 财经'] },
  { name: '界面新闻', domain: 'jiemian.com', searchTerms: ['site:jiemian.com 今日 头条', 'site:jiemian.com 财经 最新'] },
  { name: '财新网', domain: 'caixin.com', searchTerms: ['site:caixin.com 最新 经济', 'site:caixin.com 今日 宏观'] },
  { name: '第一财经', domain: 'yicai.com', searchTerms: ['site:yicai.com 最新 市场', 'site:yicai.com 今日 A股'] },
  { name: '华尔街见闻', domain: 'wallstreetcn.com', searchTerms: ['site:wallstreetcn.com 今日 快讯', 'site:wallstreetcn.com 全球 市场'] },
];

// 需要排除的关键词（栏目、汇总类）
const EXCLUDE_PATTERNS = [
  '早报', '晚报', '日报', '晨报', '晚报', '收盘', '今日行情', '财经早餐',
  '资讯汇总', '新闻汇总', '一览', '速览', '回顾', '周报', '月报',
  '栏目', '专题', '首页', '频道', '导航', '精华', '推荐', '热门',
  '订阅', 'APP', '下载', '登录', '注册', '关于我们', '联系',
  '融资余额', '融资净买入', '融资融券', '大宗交易',  // 排除融资汇总
  '资金流向', '主力资金', '北向资金', '南向资金',      // 排除资金流汇总
  '涨幅榜', '跌幅榜', '涨停股', '跌停股',              // 排除榜单类
  '行情播报', '收盘播报', '今日股市',                   // 排除行情汇总
  'ETF', '个股', '科创板股',                           // 排除个股汇总
];

// 有效的新闻标题模式
const VALID_TITLE_PATTERNS = [
  /[\u4e00-\u9fa5]{8,}/,  // 中文标题至少8个字符
  /[A-Z]{2,5}\s+\d/,      // 股票代码+数字
  /\d+[亿万]/,            // 金额
  /[%％]/,                // 百分比
  /[涨跌增减持]/,         // 股市关键词
  /[中美欧日韩]国/,        // 国家
  /[美联储央行]/,          // 机构
  /[收购并购上市]/,        // 事件
  /[暴跌暴涨创新]/,        // 程度词
];

interface NewsItem {
  title: string;
  url: string;
  source: string;
  publishTime?: string;
  snippet?: string;
}

interface TopicCluster {
  topic: string;
  keywords: string[];
  newsCount: number;
  news: NewsItem[];
  importanceScore: number;
}

interface HistoricalEvent {
  year: string;
  event: string;
  outcome: string;
  relevance: string;
}

interface AnalysisResult {
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

  const steps: AnalysisResult[] = [
    { step: 1, stepName: '爬取新闻', status: 'pending' },
    { step: 2, stepName: '主题归类', status: 'pending' },
    { step: 3, stepName: '热度排序', status: 'pending' },
    { step: 4, stepName: '历史分析', status: 'pending' },
  ];

  try {
    // ========== 步骤1：爬取新闻 ==========
    steps[0].status = 'running';
    
    const allNews: NewsItem[] = [];
    
    // 并行爬取各媒体新闻
    const searchPromises = MEDIA_SITES.flatMap(async (media) => {
      const results: NewsItem[] = [];
      
      // 使用多个搜索词
      for (const searchTerm of media.searchTerms) {
        try {
          const response = await searchClient.advancedSearch(searchTerm, {
            searchType: 'web',
            count: 15,
            timeRange: '1d',
            needSummary: true,
            needUrl: true,
          });

          if (response.web_items && response.web_items.length > 0) {
            for (const item of response.web_items) {
              const title = item.title || '';
              const url = item.url || '';
              
              // 过滤：排除栏目标题
              if (isValidNewsTitle(title, url)) {
                results.push({
                  title,
                  url,
                  source: media.name,
                  publishTime: item.publish_time,
                  snippet: item.snippet || '',
                });
              }
            }
          }
        } catch (error) {
          console.error(`Error searching ${searchTerm}:`, error);
        }
      }
      
      return results;
    });

    const resultsArray = await Promise.all(searchPromises);
    resultsArray.forEach((items) => allNews.push(...items));

    // 去重：基于 URL 或标题相似度
    const uniqueNews = deduplicateNews(allNews);

    steps[0].status = 'completed';
    steps[0].data = {
      totalCount: uniqueNews.length,
      sources: MEDIA_SITES.map((m) => m.name),
      news: uniqueNews.slice(0, 80), // 最多保留80条
    };

    console.log(`步骤1完成：爬取到 ${uniqueNews.length} 条有效新闻`);

    // 如果新闻太少，进行备选搜索
    if (uniqueNews.length < 20) {
      console.log('新闻数量不足，进行补充搜索...');
      const fallbackNews = await fallbackSearch(searchClient);
      uniqueNews.push(...fallbackNews);
    }

    // ========== 步骤2：主题归类 ==========
    steps[1].status = 'running';

    const topicClusters = await classifyNewsByTopic(uniqueNews, llmClient);

    steps[1].status = 'completed';
    steps[1].data = {
      clustersCount: topicClusters.length,
      clusters: topicClusters,
    };

    console.log(`步骤2完成：归类为 ${topicClusters.length} 个主题`);

    // ========== 步骤3：热度排序 ==========
    steps[2].status = 'running';

    // 按新闻数量和重要性排序
    const rankedTopics = topicClusters
      .map((cluster) => ({
        ...cluster,
        hotScore: cluster.newsCount * 10 + cluster.importanceScore * 5,
      }))
      .sort((a, b) => b.hotScore - a.hotScore);

    steps[2].status = 'completed';
    steps[2].data = {
      topTopic: rankedTopics[0] || null,
      allTopics: rankedTopics,
      totalTopics: rankedTopics.length,
    };

    console.log(`步骤3完成：热度最高的topic是 "${rankedTopics[0]?.topic}"`);

    // ========== 步骤4：历史分析 ==========
    steps[3].status = 'running';

    let historicalAnalysis = null;
    
    if (rankedTopics[0]) {
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
        totalNews: uniqueNews.length,
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

// ========== 判断是否为有效新闻标题 ==========
function isValidNewsTitle(title: string, url: string): boolean {
  const lowerTitle = title.toLowerCase();
  const lowerUrl = url.toLowerCase();
  
  // 排除包含栏目关键词的
  for (const pattern of EXCLUDE_PATTERNS) {
    if (lowerTitle.includes(pattern.toLowerCase())) {
      return false;
    }
  }
  
  // 排除 URL 中包含这些路径的
  const excludePaths = ['/column/', '/topic/', '/special/', '/daily/', '/morning/', '/report/'];
  for (const path of excludePaths) {
    if (lowerUrl.includes(path)) {
      return false;
    }
  }
  
  // 标题太短的不算
  if (title.length < 10) {
    return false;
  }
  
  // 标题太长（超过50字）的可能是汇总
  if (title.length > 50) {
    return false;
  }
  
  // 包含多个"｜"或"·"的可能是标题党
  if ((title.match(/[｜]/g) || []).length > 2) {
    return false;
  }
  
  // 标题必须包含至少一个有效模式
  const hasValidPattern = VALID_TITLE_PATTERNS.some(pattern => pattern.test(title));
  if (!hasValidPattern) {
    // 但如果标题确实很长且包含数字，可能是一篇好文章
    if (title.length > 20 && /[\d]/.test(title)) {
      return true;
    }
    return false;
  }
  
  return true;
}

// ========== 新闻去重 ==========
function deduplicateNews(news: NewsItem[]): NewsItem[] {
  const seen = new Map<string, NewsItem>();
  
  for (const item of news) {
    // 用 URL 或标题作为 key
    const key = item.url || item.title;
    
    if (!seen.has(key)) {
      seen.set(key, item);
    }
  }
  
  return Array.from(seen.values());
}

// ========== 补充搜索（当新闻不足时） ==========
async function fallbackSearch(searchClient: SearchClient): Promise<NewsItem[]> {
  const results: NewsItem[] = [];
  
  const fallbackQueries = [
    'A股 今日 涨停 暴跌',
    '美联储 加息 降息 最新',
    '人民币 汇率 美元',
    '中美 贸易 关税 最新',
    'IPO 上市 融资',
    '科技股 财报 业绩',
  ];
  
  for (const query of fallbackQueries) {
    try {
      const response = await searchClient.advancedSearch(query, {
        searchType: 'web',
        count: 10,
        timeRange: '1d',
        needSummary: true,
        needUrl: true,
      });

      if (response.web_items) {
        for (const item of response.web_items) {
          if (isValidNewsTitle(item.title || '', item.url || '')) {
            results.push({
              title: item.title || '',
              url: item.url || '',
              source: item.site_name || '其他',
              publishTime: item.publish_time,
              snippet: item.snippet || '',
            });
          }
        }
      }
    } catch (error) {
      console.error(`Fallback search error for ${query}:`, error);
    }
  }
  
  return results;
}

// ========== 辅助函数：新闻主题归类 ==========
async function classifyNewsByTopic(news: NewsItem[], llmClient: LLMClient): Promise<TopicCluster[]> {
  // 只取有 snippet 的新闻进行分析
  const analysisNews = news.filter(n => n.snippet && n.snippet.length > 20);
  
  const newsTexts = analysisNews
    .slice(0, 50)
    .map((item, idx) => `${idx + 1}. [${item.source}] ${item.title}\n   ${item.snippet?.substring(0, 100)}`)
    .join('\n');

  const prompt = `请将以下财经新闻按主题进行归类。只分析有实质内容的新闻，过滤掉无关内容。

新闻列表：
${newsTexts}

请分析这些新闻，将相似主题归为一类。输出JSON格式：
{
  "clusters": [
    {
      "topic": "精准的主题描述（如：茅台业绩下滑、苹果新品发布、美联储加息等）",
      "keywords": ["关键词1", "关键词2", "关键词3"],
      "newsCount": 该主题的新闻数量,
      "importanceScore": 1-10的重要性评分,
      "news": [
        {"title": "新闻标题", "source": "来源", "url": "链接", "snippet": "摘要"}
      ]
    }
  ]
}

要求：
1. 主题必须是具体的新闻事件，不能是笼统的"财经"、"市场"
2. 每个主题至少要有2条新闻才单独成类
3. 最多输出8个最有价值的主题
4. 按新闻数量从多到少排序
5. 只输出真正有新闻价值的内容`;

  try {
    const response = await llmClient.invoke([
      {
        role: 'system',
        content: '你是一个专业的金融新闻分析师，擅长识别具体的新闻事件并归类。你的回答必须是有效的JSON格式。',
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

// ========== 辅助函数：历史事件分析 ==========
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
    `${keywords} 历史 事件 回顾 影响 结局`,
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

  // LLM分析历史事件
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
      "relevance": "与当前事件的相关性（1-2句话）"
    }
  ],
  "marketImpact": "对市场的整体影响分析（2-3句话）",
  "investorAdvice": "给投资者的具体建议（2-3句话）"
}`;

  try {
    const response = await llmClient.invoke([
      {
        role: 'system',
        content: '你是一个资深金融市场历史分析师，擅长从历史事件中总结规律和经验教训。你的回答必须是有效的JSON格式。',
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
