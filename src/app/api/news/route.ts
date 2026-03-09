import { NextRequest, NextResponse } from 'next/server';
import { SearchClient, Config, HeaderUtils } from 'coze-coding-dev-sdk';
import { loadNewsData, saveNewsData } from '@/lib/storage';

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
  const config = new Config();
  const client = new SearchClient(config);
  
  // 使用多个查询关键词进行搜索，确保覆盖更全面的金融新闻
  const queries = [
    '重要经济事件 股市动态 央行政策 宏观数据 2026',
    '上市公司重大并购 融资事件 投资动态 最新',
    '国际金融市场 美股 港股 A股 行情',
    '经济政策 贸易数据 消费数据 最新消息',
  ];
  
  const allResults: any[] = [];
  
  // 执行多个查询，合并结果
  for (const query of queries) {
    try {
      const response = await client.advancedSearch(query, {
        searchType: 'web',
        count: 20, // 每个查询获取20条
        timeRange: '1d',
        needSummary: true,
        needUrl: true,
        needContent: true,
      });
      
      if (response.web_items && response.web_items.length > 0) {
        console.log(`Query "${query.substring(0, 30)}..." returned ${response.web_items.length} results`);
        allResults.push(...response.web_items);
      }
    } catch (error) {
      console.error(`Error searching for query: ${query}`, error);
    }
  }
  
  // 如果多个查询结果太少，再进行一次广泛搜索
  if (allResults.length < 15) {
    console.log('Multiple queries returned insufficient results, doing broader search...');
    const broadResponse = await client.advancedSearch('金融新闻 股市 经济 最新', {
      searchType: 'web',
      count: 40,
      timeRange: '1d',
      needSummary: true,
      needUrl: true,
      needContent: true,
    });
    
    if (broadResponse.web_items) {
      allResults.push(...broadResponse.web_items);
    }
  }
  
  console.log(`Total raw results: ${allResults.length}`);

  // 基于 URL 去重（避免同一新闻重复出现）
  const uniqueResults = deduplicateByUrl(allResults);
  console.log(`After URL dedup: ${uniqueResults.length} items`);

  // 基于域名去重，每个域名最多保留2条
  const deduplicatedItems = deduplicateNewsByDomain(uniqueResults);
  console.log(`After domain dedup: ${deduplicatedItems.length} items`);

  // 使用 LLM 对新闻进行排序、筛选和优化摘要，获取 TOP 20 重要事件
  const rankedNews = await processAndRankNews(deduplicatedItems);
  
  return rankedNews;
}

// 基于 URL 去重
function deduplicateByUrl(webItems: any[]): any[] {
  const urlMap = new Map<string, any>();
  
  webItems.forEach((item, index) => {
    const url = item.url || '';
    if (url && !urlMap.has(url)) {
      urlMap.set(url, { ...item, index });
    }
  });
  
  return Array.from(urlMap.values());
}

// 基于域名去重新闻，每个域名最多保留2条
function deduplicateNewsByDomain(webItems: any[]): any[] {
  const domainItemsMap = new Map<string, any[]>();
  
  webItems.forEach((item, index) => {
    try {
      const url = item.url || '';
      let domain = '';
      
      // 提取域名
      if (url) {
        try {
          const urlObj = new URL(url);
          domain = urlObj.hostname;
        } catch (e) {
          // 如果 URL 解析失败，使用 source 字段
          domain = item.site_name || 'unknown';
        }
      } else {
        domain = item.site_name || 'unknown';
      }
      
      // 获取该域名已有的新闻列表
      const existingItems = domainItemsMap.get(domain) || [];
      
      // 每个域名最多保留2条新闻
      if (existingItems.length < 2) {
        existingItems.push({ ...item, index });
        domainItemsMap.set(domain, existingItems);
      }
    } catch (e) {
      console.error('Error processing item for deduplication:', e);
    }
  });
  
  // 将所有域名的新闻合并，并保持原始顺序
  const allItems: any[] = [];
  domainItemsMap.forEach((items) => {
    allItems.push(...items);
  });
  
  // 按原始顺序排序
  allItems.sort((a, b) => a.index - b.index);
  
  return allItems;
}

async function processAndRankNews(
  webItems: any[]
): Promise<NewsItem[]> {
  const config = new Config();
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

  // 优化：缩短文本长度，减少 token 消耗
  const newsText = newsData.map((item, idx) => 
    `[${idx + 1}] 标题:${item.originalTitle}
来源:${item.source||'未知'}
摘要:${item.summary.substring(0,200)}
链接:${item.url}`
  ).join('\n');

  // 优化：简化 prompt，减少冗余说明
  const prompt = `请对以下近24小时新闻进行分析，按对经济和股市的影响度排序，选出TOP 20重要事件。

${newsText}

要求：
1. 按重要度排序（重大政策>股市动态>公司事件>一般新闻）
2. 为每条新闻生成简练的AI标题（15-30字）
3. 生成1-3句话的AI摘要
4. 评分（1-10分，9-10为重大事件）
5. 去重要求：如果多条新闻报道同一事件（如同一个会议、同一个政策、同一个公司动作），只保留最重要的一条，去除重复内容

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
        content: '专业金融新闻编辑，擅长筛选重要事件、生成精准标题和摘要，快速判断对金融市场的影响。能够识别并去除报道同一事件的重复新闻。' 
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
      return newsData.slice(0, 20).map((item, idx) => ({
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
      return newsData.slice(0, 20).map((item, idx) => ({
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
      newsData.map((item, idx) => [idx + 1, item])
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
    return newsData.slice(0, 20).map((item, idx) => ({
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
