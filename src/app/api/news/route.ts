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
