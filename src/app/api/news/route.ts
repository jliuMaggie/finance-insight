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
    
    // 先尝试从 storage 读取指定时间段的缓存数据
    const cachedData = await loadNewsData(timeRange);
    
    if (cachedData && cachedData.news && cachedData.news.length > 0) {
      return NextResponse.json({
        success: true,
        news: cachedData.news,
        lastUpdated: cachedData.lastUpdated,
        fromCache: true,
        timeRange: timeRange,
      });
    }

    // 缓存不存在或过期，则进行搜索（默认使用24h）
    const news = await fetchLatestNews();
    
    // 保存到 storage（保存到多个时间段）
    const dataToSave = {
      news,
      lastUpdated: new Date().toISOString(),
    };
    await saveNewsData(dataToSave, '24h');
    
    return NextResponse.json({
      success: true,
      news,
      lastUpdated: new Date().toISOString(),
      fromCache: false,
      timeRange: '24h',
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
  
  // 搜索近24小时的重要金融新闻，优先来自高质量媒体
  const query = '金融新闻 股市 经济 科技 互联网 AI 芯片 半导体 重要事件 市场波动';
  
  // 策略：先限定高质量媒体搜索
  let response = await client.advancedSearch(query, {
    searchType: 'web',
    count: 50,
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
      count: 50,
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

  // 将新闻列表转换为文本格式
  const newsText = newsData.map((item, idx) => 
    `【新闻 ${idx + 1}】
标题：${item.originalTitle}
来源：${item.source || '未知'}
摘要：${item.summary.substring(0, 300)}
内容：${item.content?.substring(0, 500) || ''}
链接：${item.url}`
  ).join('\n\n---\n\n');

  const prompt = `请给我一份金融晚报，就按照近24小时发生的对经济和股市有较大影响的排名前20个需要关注的事件，重要度排序，含新闻标题，摘要和每个事件对应链接，尤其是科技和互联网领域的信息。

新闻列表：
${newsText}

请对以上新闻进行以下处理：
1. 评估每条新闻的重要性（对经济和股市的影响程度），综合考虑：
   - 事件本身的重大程度
   - 对市场的潜在影响
   - 新闻来源的可信度（高质量媒体如：36kr、华尔街见闻、虎嗅、华尔街日报、经济学人等的权重更高）
   - 是否涉及科技、互联网、AI等前沿领域
2. 为每条新闻生成一个简练的AI总结标题（突出核心事件和影响）
3. 用1-3句话生成AI摘要（简洁明了地说明事件及其影响）
4. 按重要性从高到低排序，选出TOP 20

只返回JSON格式，不要任何其他文字：
{
  "news": [
    {
      "index": 1,
      "score": 9,
      "aiTitle": "AI总结的标题",
      "originalTitle": "原新闻标题",
      "summary": "1-3句话的AI摘要",
      "url": "原新闻链接"
    }
  ]
}

评分标准（1-10分）：
- 9-10分：重大政策变化、重大并购、知名大公司重大事件、对全球市场有重大影响、科技行业颠覆性变化
- 7-8分：重要行业动态、重要公司业绩、重要监管变化、央行政策调整、市场重大波动
- 5-6分：一般行业新闻、一般公司事件、市场趋势分析
- 1-4分：常规新闻、影响较小、次要事件

高质量媒体（优先）：
中文：36kr、华尔街见闻、虎嗅、财新、界面新闻、第一财经
英文：华尔街日报、经济学人、金融时报、彭博社、路透社

AI标题要求：
- 简练有力（15-30字）
- 突出核心事件和影响
- 使用专业金融术语

AI摘要要求：
- 1-3句话
- 简洁明了
- 说明事件及其对市场的影响
- 提及关键数据和影响方向`;

  try {
    const response = await llmClient.invoke([
      { 
        role: 'system', 
        content: '你是一位资深的金融新闻编辑，擅长从大量新闻中筛选重要事件、生成精准的AI标题和摘要，能够快速判断新闻对金融市场的影响程度。你特别关注科技和互联网领域的重大事件。' 
      },
      { role: 'user', content: prompt }
    ], {
      temperature: 0.3,
      model: 'doubao-seed-1-8-251228',
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
