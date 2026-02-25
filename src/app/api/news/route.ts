import { NextRequest, NextResponse } from 'next/server';
import { SearchClient, LLMClient, HeaderUtils } from 'coze-coding-dev-sdk';
import { loadNewsData, saveNewsData } from '@/lib/storage';
import { getSDKConfig } from '@/lib/config';

interface NewsItem {
  id: string;
  rank: number;
  aiTitle: string; // AI总结的标题
  originalTitle: string; // 原新闻标题
  summary: string; // 1-3句话的AI总结摘要
  url: string; // 原新闻链接
  publishTime?: string;
  source?: string;
  importanceScore?: number;
}

// 高质量媒体来源
const HIGH_QUALITY_SITES = [
  // 中文媒体
  '36kr.com',
  'wallstreetcn.com',
  'huxiu.com',
  'caixin.com',
  'jiemian.com',
  'yicai.com',
  // 英文媒体
  'wsj.com',
  'economist.com',
  'ft.com',
  'bloomberg.com',
  'reuters.com',
  'cnbc.com',
];

// 简单去重函数：基于 URL 和标题相似度
function simpleDeduplicate(newsList: any[]): any[] {
  const seenUrls = new Set<string>();
  const seenTitles = new Map<string, any>(); // key: 关键词数组的join结果
  const result: any[] = [];

  for (const item of newsList) {
    // 1. URL 去重：提取 URL 的核心部分
    let urlCore = '';
    try {
      const urlObj = new URL(item.url);
      // 去除查询参数和锚点
      urlCore = urlObj.origin + urlObj.pathname;
      // 进一步简化：移除文章 ID 等数字后缀
      urlCore = urlCore.replace(/\/\d+\.html$/, '').replace(/\/\d+$/, '');
    } catch (e) {
      urlCore = item.url;
    }

    if (seenUrls.has(urlCore)) {
      continue; // URL 重复，跳过
    }
    seenUrls.add(urlCore);

    // 2. 标题相似度去重：提取关键词
    const titleKeywords = extractKeywords(item.originalTitle);
    const titleKeywordsStr = titleKeywords.join(','); // 转换为字符串作为 Map key
    let isDuplicate = false;

    for (const [existingKeywordsStr, existingItem] of seenTitles.entries()) {
      const existingKeywords = existingKeywordsStr.split(',');
      // 如果关键词重叠度 > 70%，认为是重复
      if (calculateKeywordOverlap(titleKeywords, existingKeywords) > 0.7) {
        // 保留来源更好的新闻
        if (compareSourceQuality(item.source, existingItem.source) > 0) {
          // 新新闻更好，替换旧新闻
          const idx = result.indexOf(existingItem);
          if (idx !== -1) {
            result[idx] = item;
          }
          seenTitles.set(titleKeywordsStr, item);
        }
        isDuplicate = true;
        break;
      }
    }

    if (!isDuplicate) {
      seenTitles.set(titleKeywordsStr, item);
      result.push(item);
    }
  }

  return result;
}

// 提取标题关键词（去除停用词和标点）
function extractKeywords(title: string): string[] {
  const stopWords = ['的', '了', '是', '在', '和', '与', '等', '将', '要', '这', '那', '个', '位', '条'];
  return title
    .replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, ' ')
    .split(' ')
    .filter(word => word.length > 0 && !stopWords.includes(word));
}

// 计算关键词重叠度
function calculateKeywordOverlap(keywords1: string[], keywords2: string[]): number {
  if (keywords1.length === 0 || keywords2.length === 0) return 0;
  
  const intersection = keywords1.filter(k => keywords2.includes(k));
  const union = [...new Set([...keywords1, ...keywords2])];
  
  return intersection.length / union.length;
}

// 比较来源质量（返回正数表示第一个更好）
function compareSourceQuality(source1: string, source2: string): number {
  if (!source1) return -1;
  if (!source2) return 1;
  
  const qualityScores: Record<string, number> = {
    'caixin.com': 10,
    'wallstreetcn.com': 9,
    'jiemian.com': 8,
    'yicai.com': 8,
    '36kr.com': 8,
    'huxiu.com': 7,
    'economist.com': 10,
    'ft.com': 9,
    'wsj.com': 9,
    'bloomberg.com': 9,
    'reuters.com': 9,
    'cnbc.com': 8,
  };
  
  return (qualityScores[source1] || 5) - (qualityScores[source2] || 5);
}

export async function GET(request: NextRequest) {
  try {
    // 获取查询参数
    const { searchParams } = new URL(request.url);
    const timeRange = searchParams.get('timeRange') || '24h';
    const forceRefresh = searchParams.get('refresh') === 'true';
    
    // 如果不是强制刷新，优先读取缓存
    if (!forceRefresh) {
      const cachedResult = await loadNewsData(timeRange);
      
      if (cachedResult && cachedResult.data && cachedResult.data.news && cachedResult.data.news.length > 0) {
        return NextResponse.json({
          success: true,
          news: cachedResult.data.news,
          lastUpdated: cachedResult.data.lastUpdated,
          fromCache: true,
          timeRange: timeRange,
        });
      }
    }
    
    // 缓存不存在或强制刷新，进行搜索
    console.log(`No cache found for ${timeRange}, fetching fresh news...`);
    const news = await fetchLatestNews();
    
    // 保存到 storage（按当前整点）
    const dataToSave = {
      news,
      lastUpdated: new Date().toISOString(),
    };
    await saveNewsData(dataToSave, timeRange);
    
    return NextResponse.json({
      success: true,
      news,
      lastUpdated: new Date().toISOString(),
      fromCache: false,
      timeRange: timeRange,
    });
  } catch (error) {
    console.error('Error fetching news:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch news',
        news: [],
      },
      { status: 500 }
    );
  }
}

export async function POST() {
  try {
    // 强制刷新新闻
    const news = await fetchLatestNews();
    
    // 保存到 storage
    const dataToSave = {
      news,
      lastUpdated: new Date().toISOString(),
    };
    await saveNewsData(dataToSave);
    
    return NextResponse.json({
      success: true,
      news,
      lastUpdated: new Date().toISOString(),
      message: 'News refreshed successfully',
      fromCache: false,
    });
  } catch (error) {
    console.error('Error refreshing news:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to refresh news',
        news: [],
      },
      { status: 500 }
    );
  }
}

async function fetchLatestNews(): Promise<NewsItem[]> {
  const config = getSDKConfig();
  const client = new SearchClient(config);
  
  // 优化：使用更全面的金融新闻关键词，避免过度偏向AI相关新闻
  // 参考豆包智能体的查询方式，涵盖经济、股市、政策、科技等多个维度
  const query = '近24小时重要经济事件 股市动态 政策变化 央行政策 宏观数据 上市公司 重大并购 融资事件 消费数据 国际贸易 市场波动 科技互联网';
  
  // 策略：先限定高质量媒体搜索
  let response = await client.advancedSearch(query, {
    searchType: 'web',
    count: 30, // 优化：从50减少到30，减少token消耗
    timeRange: '1d',
    needSummary: true,
    needUrl: true,
    needContent: true,
    sites: HIGH_QUALITY_SITES.join(','),
  });

  // 如果高质量媒体结果不足，扩展到更广泛的来源
  if (!response.web_items || response.web_items.length < 10) {
    console.log('High quality sources results insufficient, searching broader...');
    response = await client.advancedSearch(query, {
      searchType: 'web',
      count: 30, // 优化：保持30条
      timeRange: '1d',
      needSummary: true,
      needUrl: true,
      needContent: true,
    });
  }

  if (!response.web_items || response.web_items.length === 0) {
    return [];
  }

  // 使用 LLM 对新闻进行排序、筛选和优化摘要，获取 TOP 20 重要事件
  // 同时让LLM根据来源质量进行筛选
  const rankedNews = await processAndRankNews(response.web_items);
  
  return rankedNews;
}

async function processAndRankNews(
  webItems: any[]
): Promise<NewsItem[]> {
  const config = getSDKConfig();
  const llmClient = new (await import('coze-coding-dev-sdk')).LLMClient(config);

  // 提取新闻信息
  const newsData = webItems.map((item, index) => ({
    id: `news-${Date.now()}-${index}`,
    originalTitle: item.title || '',
    snippet: item.snippet || '',
    summary: item.summary || item.snippet || '',
    content: item.content || '',
    url: item.url || '',
    publishTime: item.publish_time,
    source: item.site_name,
    rankScore: item.rank_score || 0,
  }));

  // 简单去重：基于 URL 和标题相似度
  const deduplicatedNews = simpleDeduplicate(newsData);

  // 优化：缩短文本长度，减少 token 消耗
  const newsText = deduplicatedNews.map((item, idx) => 
    `[${idx + 1}] 标题:${item.originalTitle}
来源:${item.source||'未知'}
摘要:${item.summary.substring(0,200)}
链接:${item.url}`
  ).join('\n');

  // 优化：简化 prompt，减少冗余说明
  const prompt = `请对以下近24小时新闻进行分析，按对经济和股市的影响度排序，选出TOP 20重要事件。

${newsText}

要求：
1. 去重处理：识别并去除重复新闻（同一事件的不同报道），只保留最重要的一条
   - 重复特征：标题关键词高度相似（如"广东GDP 25.8万亿" vs "广东锚定25.8万亿GDP目标"）
   - 重复特征：摘要核心内容一致（同一会议、同一数据、同一公司）
   - 重复特征：发布时间相近、事件本质相同
   - 去重策略：保留权威来源、报道更全面、发布时间较早的那条
2. 按重要度排序（重大政策>股市动态>公司事件>一般新闻）
3. 为每条新闻生成简练的AI标题（15-30字）
4. 生成1-3句话的AI摘要
5. 评分（1-10分，9-10为重大事件）

返回JSON格式：
{
  "news": [
    {
      "index": 序号,
      "score": 评分,
      "aiTitle": "AI标题",
      "originalTitle": "原标题",
      "summary": "摘要",
      "url": "链接"
    }
  ]
}`;

  try {
    // 优化：简化 system prompt，减少 token 消耗
    const response = await llmClient.invoke([
      { 
        role: 'system', 
        content: '专业金融新闻编辑，擅长筛选重要事件、生成精准标题和摘要，快速判断对金融市场的影响。' 
      },
      { role: 'user', content: prompt }
    ], {
      temperature: 0.3,
    });

    // 解析 LLM 返回的结果
    const content = response.content;
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    
    if (!jsonMatch) {
      console.error('Failed to parse LLM response for news processing');
      // 降级方案：使用原始数据
      return deduplicatedNews.slice(0, 20).map((item, idx) => ({
        id: item.id,
        rank: idx + 1,
        aiTitle: item.originalTitle,
        originalTitle: item.originalTitle,
        summary: item.summary,
        url: item.url,
        publishTime: item.publishTime,
        source: item.source,
      }));
    }

    const result = JSON.parse(jsonMatch[0]);
    
    if (!result.news || !Array.isArray(result.news)) {
      console.error('Invalid news data format from LLM');
      return deduplicatedNews.slice(0, 20).map((item, idx) => ({
        id: item.id,
        rank: idx + 1,
        aiTitle: item.originalTitle,
        originalTitle: item.originalTitle,
        summary: item.summary,
        url: item.url,
        publishTime: item.publishTime,
        source: item.source,
      }));
    }

    // 构建 index 到原始新闻的映射
    const newsMap = new Map(
      deduplicatedNews.map((item, idx) => [idx + 1, item])
    );

    // 返回 TOP 20
    return result.news.slice(0, 20).map((item: any, idx: number) => {
      const original = newsMap.get(item.index);
      return {
        id: original?.id || `news-${Date.now()}-${idx}`,
        rank: idx + 1,
        aiTitle: item.aiTitle || original?.originalTitle || '',
        originalTitle: item.originalTitle || original?.originalTitle || '',
        summary: item.summary || original?.summary || '',
        url: item.url || original?.url || '',
        publishTime: original?.publishTime,
        source: original?.source,
        importanceScore: item.score || 5,
      };
    });
  } catch (error) {
    console.error('Error processing news with LLM:', error);
    // 降级方案：使用原始数据
    return deduplicatedNews.slice(0, 20).map((item, idx) => ({
      id: item.id,
      rank: idx + 1,
      aiTitle: item.originalTitle,
      originalTitle: item.originalTitle,
      summary: item.summary,
      url: item.url,
      publishTime: item.publishTime,
      source: item.source,
    }));
  }
}
