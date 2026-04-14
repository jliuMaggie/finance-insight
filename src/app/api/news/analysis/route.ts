import { NextRequest, NextResponse } from 'next/server';
import { SearchClient, Config, LLMClient } from 'coze-coding-dev-sdk';

// 财经媒体列表
const MEDIA_SITES = [
  { name: '虎嗅', domain: 'huxiu.com' },
  { name: '36氪', domain: '36kr.com' },
  { name: '钛媒体', domain: 'tmtpost.com' },
  { name: '界面新闻', domain: 'jiemian.com' },
  { name: '财新网', domain: 'caixin.com' },
  { name: '第一财经', domain: 'yicai.com' },
  { name: '华尔街见闻', domain: 'wallstreetcn.com' },
  { name: '彭博社', domain: 'bloomberg.com' },
  { name: '华尔街日报', domain: 'wsj.com' },
  { name: '金融时报', domain: 'ft.com' },
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
    const searchPromises = MEDIA_SITES.map(async (media) => {
      try {
        const response = await searchClient.advancedSearch(`${media.name} 今日 财经 新闻`, {
          searchType: 'web',
          count: 10,
          timeRange: '1d',
          needSummary: true,
          needUrl: true,
        });

        if (response.web_items && response.web_items.length > 0) {
          const newsItems = response.web_items.map((item) => ({
            title: item.title || '',
            url: item.url || '',
            source: media.name,
            publishTime: item.publish_time,
            snippet: item.snippet || '',
          }));
          return newsItems;
        }
      } catch (error) {
        console.error(`Error searching ${media.name}:`, error);
      }
      return [];
    });

    const results = await Promise.all(searchPromises);
    results.forEach((items) => allNews.push(...items));

    // 去重
    const uniqueNews = allNews.filter((item, index, self) => 
      index === self.findIndex((n) => n.url === item.url && n.title === item.title)
    );

    steps[0].status = 'completed';
    steps[0].data = {
      totalCount: uniqueNews.length,
      sources: MEDIA_SITES.map((m) => m.name),
      news: uniqueNews.slice(0, 50), // 最多保留50条
    };

    console.log(`步骤1完成：爬取到 ${uniqueNews.length} 条新闻`);

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
        // 综合评分 = 新闻数量 * 重要性权重 + 权重加成
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
    
    // 标记出错的步骤
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

// ========== 辅助函数：新闻主题归类 ==========
async function classifyNewsByTopic(news: NewsItem[], llmClient: LLMClient): Promise<TopicCluster[]> {
  const newsTexts = news
    .map((item, idx) => `${idx + 1}. [${item.source}] ${item.title}`)
    .join('\n');

  const prompt = `请将以下新闻按主题进行归类。每个主题用关键词概括，并列出该主题下的所有新闻。

新闻列表：
${newsTexts}

请分析这些新闻，将相似主题归为一类。输出JSON格式：
{
  "clusters": [
    {
      "topic": "主题关键词（如：科技股大跌、美联储加息等）",
      "keywords": ["关键词1", "关键词2", "关键词3"],
      "newsCount": 该主题的新闻数量,
      "news": [
        {"title": "新闻标题", "source": "来源", "url": "链接"}
      ]
    }
  ]
}

要求：
1. 主题要精准、简洁，能一眼看出是什么事件
2. 每个主题至少要有2条新闻才单独成类，否则归入"其他"类
3. 最多输出10个主题
4. 按新闻数量从多到少排序`;

  try {
    const response = await llmClient.invoke([
      {
        role: 'system',
        content: '你是一个专业的金融新闻分析师，擅长识别新闻主题并归类。你的回答必须是有效的JSON格式。',
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

  // 降级：按来源简单分组
  return simpleGroupBySource(news);
}

// ========== 辅助函数：简单按来源分组（降级方案） ==========
function simpleGroupBySource(news: NewsItem[]): TopicCluster[] {
  const sourceMap = new Map<string, NewsItem[]>();

  news.forEach((item) => {
    const items = sourceMap.get(item.source) || [];
    items.push(item);
    sourceMap.set(item.source, items);
  });

  return Array.from(sourceMap.entries()).map(([source, items]) => ({
    topic: source,
    keywords: [source],
    newsCount: items.length,
    news: items,
    importanceScore: 5,
  }));
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
    `${keywords} 历史事件 回顾 影响 ${topicName}`,
    {
      searchType: 'web',
      count: 10,
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
1. 当前热点：该话题的核心内容和关注点
2. 历史类似事件：过去发生过哪些类似事件
3. 市场影响：这些事件对市场造成了什么影响
4. 最终结局：事件如何收场
5. 投资者建议：当前情况下投资者应该注意什么

输出JSON格式：
{
  "summary": "当前热点话题的简要分析",
  "historicalEvents": [
    {
      "year": "发生年份",
      "event": "事件描述",
      "outcome": "事件结局/影响",
      "relevance": "与当前事件的相关性"
    }
  ],
  "marketImpact": "对市场的整体影响分析",
  "investorAdvice": "给投资者的建议"
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
