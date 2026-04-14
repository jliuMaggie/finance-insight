import { NextRequest, NextResponse } from 'next/server';
import { SearchClient, Config, LLMClient } from 'coze-coding-dev-sdk';

// 精选财经媒体
const MEDIA_LIST = [
  { name: '虎嗅', keywords: ['huxiu.com'] },
  { name: '36氪', keywords: ['36kr.com'] },
  { name: '钛媒体', keywords: ['tmtpost.com'] },
  { name: '界面新闻', keywords: ['jiemian.com'] },
  { name: '财新网', keywords: ['caixin.com'] },
  { name: '第一财经', keywords: ['yicai.com'] },
  { name: '经济观察报', keywords: ['eeo.com.cn'] },
  { name: '华尔街见闻', keywords: ['wallstreetcn.com'] },
  { name: '华尔街日报', keywords: ['wsj.com'] },
  { name: '金融时报', keywords: ['ft.com', 'ftchinese.com'] },
  { name: '经济学人', keywords: ['economist.com'] },
  { name: '彭博社', keywords: ['bloomberg.com'] },
  { name: '路透社', keywords: ['reuters.com'] },
  { name: 'BBC财经', keywords: ['bbc.com/news/business'] },
];

// 高权重关键词（重要新闻）
const HIGH_WEIGHT_KEYWORDS = [
  '战争', '冲突', '制裁', '关税', '核', '导弹',
  '大选', '总统', '白宫', '国会', '议会',
  '央行', '美联储', '加息', '降息', '利率',
  '崩盘', '暴涨', '暴跌', '危机', '违约',
  '突破', '首次', '最大', '历史',
  '协议', '谈判', '签署', '达成',
  '辞职', '下台', '去世', '任命',
  '收购', '并购', '上市', '退市',
];

// 排除关键词
const EXCLUDE_PATTERNS = [
  '早报', '晚报', '日报', '晨报', '收盘行情', '今日行情',
  '资讯汇总', '新闻汇总', '一览', '速览', '回顾',
  '周报', '月报', '年度', '盘点',
  '栏目', '专题', '首页', '频道',
  '订阅', 'APP', '关于我们',
  '融资余额', '融资净买入', 'ETF', '科创板股', '创业板股',
  '涨幅榜', '跌幅榜', '涨停股', '跌停股',
  '资金流向', '北向资金', '南向资金',
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
    const usedDomains = new Set<string>();
    
    // 搜索每个媒体的最新新闻
    const searchPromises = MEDIA_LIST.flatMap(async (media) => {
      const results: NewsItem[] = [];
      
      for (const domain of media.keywords) {
        try {
          // 针对每个媒体搜索不同主题
          const queries = [
            `${domain} 今日 最新 新闻`,
            `${domain} 财经 市场 最新`,
          ];
          
          for (const query of queries) {
            const response = await searchClient.advancedSearch(query, {
              searchType: 'web',
              count: 10,
              timeRange: '1d',
              needSummary: true,
              needUrl: true,
            });

            if (response.web_items) {
              for (const item of response.web_items) {
                const title = item.title || '';
                const url = item.url || '';
                
                // 检查是否已添加过
                if (usedDomains.has(url)) continue;
                
                // 过滤
                if (!isValidNews(title, url)) continue;
                
                const weightScore = calculateWeight(title, item.snippet || '');
                
                results.push({
                  title,
                  url,
                  source: media.name,
                  publishTime: item.publish_time,
                  snippet: item.snippet || '',
                  weightScore,
                });
                
                usedDomains.add(url);
              }
            }
          }
        } catch (error) {
          console.error(`Search error for ${domain}:`, error);
        }
      }
      
      return results;
    });

    const results = await Promise.all(searchPromises);
    results.forEach(items => allNews.push(...items));

    // 按权重排序
    allNews.sort((a, b) => b.weightScore - a.weightScore);

    steps[0].status = 'completed';
    steps[0].data = {
      totalCount: allNews.length,
      topNews: allNews.slice(0, 5).map(n => ({ title: n.title, source: n.source, weight: n.weightScore })),
    };

    console.log(`步骤1完成：爬取到 ${allNews.length} 条新闻`);
    console.log('TOP新闻:', allNews.slice(0, 5).map(n => n.title.substring(0, 40)).join(' | '));

    // ========== 步骤2：主题归类 ==========
    steps[1].status = 'running';

    const topicClusters = await classifyNewsByTopic(allNews, llmClient);

    steps[1].status = 'completed';
    steps[1].data = {
      clustersCount: topicClusters.length,
    };

    console.log(`步骤2完成：归类为 ${topicClusters.length} 个主题`);

    // ========== 步骤3：热度排序 ==========
    steps[2].status = 'running';

    const rankedTopics = topicClusters
      .map((cluster) => ({
        ...cluster,
        hotScore: cluster.newsCount * 10 + cluster.importanceScore * 20,
      }))
      .sort((a, b) => b.hotScore - a.hotScore);

    steps[2].status = 'completed';
    steps[2].data = {
      topTopic: rankedTopics[0] || null,
      allTopics: rankedTopics,
    };

    console.log(`步骤3完成：TOP1="${rankedTopics[0]?.topic}" (${rankedTopics[0]?.newsCount}条)`);

    // ========== 步骤4：历史分析 ==========
    steps[3].status = 'running';

    let historicalAnalysis = null;
    if (rankedTopics[0] && rankedTopics[0].newsCount >= 2) {
      historicalAnalysis = await analyzeHistoricalEvents(rankedTopics[0], llmClient);
    }

    steps[3].status = 'completed';
    steps[3].data = historicalAnalysis;

    // ========== 返回结果 ==========
    return NextResponse.json({
      success: true,
      steps,
      finalResult: {
        topTopic: rankedTopics[0],
        allTopics: rankedTopics,
        historicalAnalysis,
      },
      summary: {
        totalNews: allNews.length,
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
      { success: false, steps, error: '分析失败' },
      { status: 500 }
    );
  }
}

// ========== 计算权重 ==========
function calculateWeight(title: string, snippet: string): number {
  let score = 0;
  const text = title + ' ' + (snippet || '');
  
  for (const kw of HIGH_WEIGHT_KEYWORDS) {
    if (text.includes(kw)) score += 5;
  }
  
  // 有具体数字
  if (/\d+%/.test(text)) score += 3;
  if (/\d{4}年/.test(text)) score += 2;
  if (/\d+[亿万]/.test(text)) score += 2;
  
  // 标题长度适中
  if (title.length >= 15 && title.length <= 40) score += 2;
  
  return score;
}

// ========== 验证新闻 ==========
function isValidNews(title: string, url: string): boolean {
  if (!title || title.length < 10 || title.length > 60) return false;
  
  const lower = title.toLowerCase();
  
  for (const pattern of EXCLUDE_PATTERNS) {
    if (lower.includes(pattern.toLowerCase())) return false;
  }
  
  return true;
}

// ========== LLM归类 ==========
async function classifyNewsByTopic(news: NewsItem[], llmClient: LLMClient): Promise<TopicCluster[]> {
  const newsTexts = news
    .slice(0, 40)
    .map((item, idx) => `${idx + 1}. [${item.source}] ${item.title}`)
    .join('\n');

  const prompt = `请将以下财经新闻按主题归类，识别重要新闻事件：

${newsTexts}

输出JSON：
{
  "clusters": [
    {
      "topic": "具体新闻事件（如：美伊冲突升级、茅台业绩发布）",
      "keywords": ["关键词"],
      "newsCount": 数量,
      "importanceScore": 1-10评分,
      "news": [{"title": "标题", "source": "来源", "url": "链接"}]
    }
  ]
}

要求：
1. 主题必须是具体事件
2. 每个主题至少2条新闻
3. 最多8个主题
4. 按新闻数量排序`;

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

// ========== 历史分析 ==========
async function analyzeHistoricalEvents(topic: TopicCluster, llmClient: LLMClient) {
  const prompt = `分析"${topic.topic}"的历史类似事件：

输出JSON：
{
  "summary": "当前热点简要分析",
  "historicalEvents": [{"year": "年份", "event": "事件", "outcome": "结局", "relevance": "相关性"}],
  "marketImpact": "市场影响分析",
  "investorAdvice": "投资建议"
}`;

  try {
    const response = await llmClient.invoke([
      { role: 'system', content: '你是金融市场历史分析师，回答必须是JSON。' },
      { role: 'user', content: prompt },
    ], { temperature: 0.5 });

    const jsonMatch = response.content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (error) {
    console.error('LLM error:', error);
  }
  return { topic: topic.topic, summary: '暂无', historicalEvents: [], marketImpact: '暂无', investorAdvice: '谨慎决策' };
}
