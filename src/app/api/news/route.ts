import { NextRequest, NextResponse } from 'next/server';
import { SearchClient, Config, HeaderUtils } from 'coze-coding-dev-sdk';
import { loadNewsData, saveNewsData } from '@/lib/storage';

interface NewsItem {
  id: string;
  rank: number;
  title: string;
  summary: string;
  url: string;
  publishTime?: string;
  source?: string;
}

// 新闻存储键名
const NEWS_STORAGE_KEY = 'finance-news-top20';

export async function GET() {
  try {
    // 先尝试从 storage 读取缓存的新闻数据
    const cachedData = await loadNewsData();
    
    if (cachedData && cachedData.news && cachedData.news.length > 0) {
      return NextResponse.json({
        success: true,
        news: cachedData.news,
        lastUpdated: cachedData.lastUpdated,
        fromCache: true,
      });
    }

    // 缓存不存在或过期，则进行搜索
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
      fromCache: false,
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
  
  // 搜索近24小时的重要金融新闻
  const query = '金融新闻 股市 经济 科技 互联网 重要事件 24小时内';
  
  const response = await client.advancedSearch(query, {
    searchType: 'web',
    count: 30,
    timeRange: '1d',
    needSummary: true,
    needUrl: true,
  });

  if (!response.web_items || response.web_items.length === 0) {
    return [];
  }

  // 使用 LLM 对新闻进行排序和筛选，获取 TOP 20 重要事件
  const rankedNews = await rankAndFilterNews(response.web_items);
  
  return rankedNews;
}

async function rankAndFilterNews(
  webItems: any[]
): Promise<NewsItem[]> {
  // 提取新闻信息
  const newsData = webItems.map((item, index) => ({
    id: `news-${Date.now()}-${index}`,
    originalRank: index,
    title: item.title || '',
    summary: item.summary || item.snippet || '',
    url: item.url || '',
    publishTime: item.publish_time,
    source: item.site_name,
    rankScore: item.rank_score || 0,
  }));

  // 调用 LLM 对新闻进行重要性评分
  const importantNews = await scoreNewsImportance(newsData);
  
  // 按 importanceScore 排序，取 TOP 20
  importantNews.sort((a, b) => b.importanceScore - a.importanceScore);
  
  const top20 = importantNews.slice(0, 20);
  
  // 返回最终格式
  return top20.map((item, index) => ({
    id: item.id,
    rank: index + 1,
    title: item.title,
    summary: item.summary,
    url: item.url,
    publishTime: item.publishTime,
    source: item.source,
  }));
}

interface ScoredNews extends NewsItem {
  importanceScore: number;
}

async function scoreNewsImportance(
  newsItems: any[]
): Promise<ScoredNews[]> {
  const config = new Config();
  const llmClient = new (await import('coze-coding-dev-sdk')).LLMClient(config);
  
  // 将新闻列表转换为文本格式
  const newsText = newsItems.map((item, idx) => 
    `${idx + 1}. ${item.title}\n   摘要: ${item.summary.substring(0, 200)}...`
  ).join('\n\n');

  const prompt = `请评估以下每条新闻的重要性（对经济和股市的影响程度），特别是科技和互联网领域的信息。

新闻列表：
${newsText}

请为每条新闻打分（1-10分，10分最重要），只返回JSON格式：
{
  "scores": [
    {"index": 1, "score": 8, "reason": "简短理由"},
    {"index": 2, "score": 6, "reason": "简短理由"}
  ]
}

评分标准：
- 9-10分：重大政策变化、重大并购、知名大公司重大事件、对市场有重大影响
- 7-8分：重要行业动态、重要公司业绩、重要监管变化
- 5-6分：一般行业新闻、一般公司事件
- 1-4分：常规新闻、影响较小`;

  try {
    const response = await llmClient.invoke([
      { role: 'system', content: '你是一位专业的金融分析师，擅长评估新闻对金融市场的影响。' },
      { role: 'user', content: prompt }
    ], {
      temperature: 0.3,
    });

    // 解析 LLM 返回的评分
    const content = response.content;
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    
    if (!jsonMatch) {
      console.error('Failed to parse LLM response for news scoring');
      return newsItems.map((item, idx) => ({
        ...item,
        importanceScore: 5 - idx * 0.1, // 默认递减分数
      }));
    }

    const scoresData = JSON.parse(jsonMatch[0]);
    const scoresMap = new Map(
      scoresData.scores.map((s: any) => [s.index, s.score])
    );

    return newsItems.map((item, idx) => ({
      ...item,
      importanceScore: scoresMap.get(idx + 1) || (5 - idx * 0.1),
    }));
  } catch (error) {
    console.error('Error scoring news with LLM:', error);
    // 降级方案：使用原始排序
    return newsItems.map((item, idx) => ({
      ...item,
      importanceScore: 10 - idx,
    }));
  }
}
