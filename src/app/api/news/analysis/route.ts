import { NextRequest, NextResponse } from 'next/server';
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
    { step: 1, stepName: '搜索热点新闻', status: 'pending' },
    { step: 2, stepName: '主题归类', status: 'pending' },
    { step: 3, stepName: '热度排序', status: 'pending' },
    { step: 4, stepName: '深度分析', status: 'pending' },
  ];

  try {
    // ========== 步骤1：搜索热点新闻 ==========
    steps[0].status = 'running';
    
    const allNews: NewsItem[] = [];
    const usedTitles = new Set<string>();
    const usedContentHashes = new Set<string>();
    
    // 计算标题指纹（去除数字和常见词）
    function getTitleFingerprint(title: string): string {
      return title
        .toLowerCase()
        .replace(/\d+/g, '#')  // 数字统一替换
        .replace(/[特朗普|关税|行政令|签署|最新|今日|2025]/g, '')  // 去除常见词
        .replace(/\s+/g, '')
        .substring(0, 30);
    }
    
    // 策略：多维度搜索，严格限制最新时间
    const searchQueries = [
      // 地缘政治（最高优先级）
      { query: '美国 伊朗 中东 冲突 最新 今日 2025', timeRange: '1d', weight: 15 },
      { query: '中东局势 战争 最新 今日', timeRange: '1d', weight: 15 },
      
      // 重大政策（严格限制时间）
      { query: '特朗普 关税 最新 今日 2025', timeRange: '1d', weight: 12 },
      { query: '中美 贸易 关税 最新 2025', timeRange: '1d', weight: 10 },
      
      // 科技突破
      { query: 'AI 芯片 突破 最新 今日', timeRange: '1d', weight: 8 },
      
      // 搜索各媒体首页（最新）
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
            
            // 去重（相同标题指纹）
            const titleKey = title.toLowerCase().replace(/\s+/g, '');
            const fingerprint = getTitleFingerprint(title);
            
            if (usedTitles.has(titleKey) || usedContentHashes.has(fingerprint)) continue;
            if (!title || title.length < 8) continue;
            
            // 计算权重
            const { score, isBreaking } = calculateWeight(title, snippet, searchParams.weight);
            
            // 检查排除词
            if (shouldExclude(title)) continue;
            
            // 识别来源
            const source = identifySource(url);
            
            allNews.push({
              title,
              url,
              source,
              publishTime: item.publish_time,
              snippet,
              weightScore: score,
              isBreaking,
            });
            
            usedTitles.add(titleKey);
            usedContentHashes.add(fingerprint);
          }
        }
      } catch (error) {
        console.error(`Search error for "${searchParams.query}":`, error);
      }
    }

    // 按权重排序
    allNews.sort((a, b) => b.weightScore - a.weightScore);

    // 去重（相同URL也去掉）
    const uniqueNews = allNews.filter((item, index, self) => 
      index === self.findIndex(t => t.url === item.url)
    );

    steps[0].status = 'completed';
    steps[0].data = {
      totalCount: uniqueNews.length,
      topNews: uniqueNews.slice(0, 10).map(n => ({ 
        title: n.title.substring(0, 50), 
        source: n.source, 
        weight: n.weightScore,
        isBreaking: n.isBreaking 
      })),
    };

    console.log(`步骤1完成：搜索到 ${uniqueNews.length} 条新闻`);
    console.log('=== TOP 10 新闻 ===');
    uniqueNews.slice(0, 10).forEach((n, i) => {
      console.log(`${i+1}. [${n.weightScore}分] ${n.isBreaking ? '【突发】' : ''}${n.source}: ${n.title.substring(0, 60)}`);
    });

    // ========== 步骤2：主题归类 ==========
    steps[1].status = 'running';

    const topicClusters = await classifyNewsByTopic(uniqueNews, llmClient);

    steps[1].status = 'completed';
    steps[1].data = {
      clustersCount: topicClusters.length,
      topClusters: topicClusters.slice(0, 3).map(c => c.topic),
    };

    console.log(`步骤2完成：归类为 ${topicClusters.length} 个主题`);
    console.log('TOP主题:', topicClusters.slice(0, 3).map(c => `${c.topic}(${c.newsCount}条)`).join(' | '));

    // ========== 步骤3：热度排序 ==========
    steps[2].status = 'running';

    // 考虑突发新闻权重
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

    steps[2].status = 'completed';
    steps[2].data = {
      topTopic: rankedTopics[0] || null,
      hotTopics: rankedTopics.slice(0, 5),
    };

    console.log(`步骤3完成：TOP1="${rankedTopics[0]?.topic}" (${rankedTopics[0]?.newsCount}条, 热度${rankedTopics[0]?.hotScore})`);

    // ========== 步骤4：深度分析 ==========
    steps[3].status = 'running';

    let deepAnalysis = null;
    if (rankedTopics[0]) {
      deepAnalysis = await analyzeTopic(rankedTopics[0], llmClient);
    }

    steps[3].status = 'completed';
    steps[3].data = deepAnalysis;

    // ========== 返回结果 ==========
    return NextResponse.json({
      success: true,
      steps,
      finalResult: {
        topTopic: rankedTopics[0],
        allTopics: rankedTopics,
        deepAnalysis,
      },
      summary: {
        totalNews: uniqueNews.length,
        totalTopics: topicClusters.length,
        topTopicName: rankedTopics[0]?.topic || '无',
        topTopicCount: rankedTopics[0]?.newsCount || 0,
        isBreaking: rankedTopics[0]?.hasBreaking || false,
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
function calculateWeight(title: string, snippet: string, searchWeight: number): { score: number; isBreaking: boolean } {
  let score = searchWeight;
  let isBreaking = false;
  const text = title + ' ' + (snippet || '');
  
  // 突发事件检测
  for (const kw of BREAKING_KEYWORDS) {
    if (text.includes(kw)) {
      score += 8;
      isBreaking = true;
      break;
    }
  }
  
  // 重要关键词
  for (const kw of IMPORTANT_KEYWORDS) {
    if (text.includes(kw)) score += 4;
  }
  
  // 有具体数字（增强可信度）
  if (/\d+%/.test(text)) score += 3;
  if (/\d{4}年\d{1,2}月/.test(text)) score += 2;
  if (/\d+[亿万美]/.test(text)) score += 2;
  
  // 标题长度适中
  if (title.length >= 12 && title.length <= 45) score += 2;
  
  // 来源可信度
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
  
  // 排除纯数字标题
  if (/^\d+$/.test(title)) return true;
  
  return false;
}

// ========== 识别来源 ==========
function identifySource(url: string): string {
  const urlLower = url.toLowerCase();
  
  const sourceMap: Record<string, string> = {
    'huxiu.com': '虎嗅',
    '36kr.com': '36氪',
    'tmtpost.com': '钛媒体',
    'jiemian.com': '界面新闻',
    'caixin.com': '财新网',
    'yicai.com': '第一财经',
    'eeo.com.cn': '经济观察报',
    'wallstreetcn.com': '华尔街见闻',
    'wsj.com': '华尔街日报',
    'ft.com': '金融时报',
    'ftchinese.com': '金融时报中文',
    'economist.com': '经济学人',
    'bloomberg.com': '彭博社',
    'reuters.com': '路透社',
    'bbc.com': 'BBC',
    'thepaper.cn': '澎湃新闻',
    'theblock.com': 'The Block',
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
      return `${idx + 1}. ${breaking}[${item.source}] ${item.title}\n   ${item.snippet?.substring(0, 100) || ''}`;
    })
    .join('\n');

  const prompt = `请将以下财经新闻按主题归类。**重点关注突发事件和重大新闻**：

${newsTexts}

输出JSON：
{
  "clusters": [
    {
      "topic": "具体新闻事件名称（如：美伊战争升级、A股大涨、茅台业绩发布）",
      "keywords": ["关键词1", "关键词2"],
      "newsCount": 数量,
      "importanceScore": 1-10评分,
      "hasBreakingNews": true或false,
      "news": [{"title": "标题", "source": "来源", "url": "链接", "weightScore": 分数}]
    }
  ]
}

**重要规则**：
1. 突发事件（战争、崩盘、重大政策）必须是独立主题
2. 每个主题至少2条新闻
3. 主题按重要性和突发性排序
4. 最多8个主题`;

  try {
    const response = await llmClient.invoke([
      { role: 'system', content: '你是专业的金融新闻分析师，回答必须是JSON格式。突发事件和重大新闻应获得更高优先级。' },
      { role: 'user', content: prompt },
    ], { temperature: 0.3 });

    const jsonMatch = response.content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const result = JSON.parse(jsonMatch[0]);
      return result.clusters || [];
    }
  } catch (error) {
    console.error('LLM error:', error);
  }
  return [];
}

// ========== 深度分析 ==========
async function analyzeTopic(topic: TopicCluster, llmClient: LLMClient) {
  const newsTitles = topic.news.slice(0, 5).map(n => `- ${n.title}`).join('\n');
  
  const prompt = `分析"${topic.topic}"这一重大新闻事件：

${newsTitles}

输出JSON：
{
  "summary": "100字内的事件概要",
  "keyPoints": ["要点1", "要点2", "要点3"],
  "marketImpact": "对市场的影响",
  "historicalComparison": "与历史类似事件对比",
  "tradingAdvice": "交易建议（谨慎/观望/关注）"
}`;

  try {
    const response = await llmClient.invoke([
      { role: 'system', content: '你是金融市场分析师，回答必须是JSON。' },
      { role: 'user', content: prompt },
    ], { temperature: 0.5 });

    const jsonMatch = response.content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (error) {
    console.error('LLM error:', error);
  }
  
  return { 
    topic: topic.topic, 
    summary: '分析生成中...', 
    keyPoints: [],
    marketImpact: '暂无',
    historicalComparison: '暂无',
    tradingAdvice: '观望'
  };
}
