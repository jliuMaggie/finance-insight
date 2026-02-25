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

// 高质量媒体来源（大幅扩展）
const HIGH_QUALITY_SITES = [
  // 中文财经媒体
  '36kr.com',
  'wallstreetcn.com',
  'huxiu.com',
  'caixin.com',
  'jiemian.com',
  'yicai.com',
  'thepaper.cn', // 澎湃新闻
  'stcn.com', // 证券时报
  'cs.com.cn', // 中国证券报
  '21jingji.com', // 21世纪经济报道
  'finance.sina.com.cn', // 新浪财经
  'finance.qq.com', // 腾讯财经
  
  // 中文科技媒体
  'ifanr.com', // 爱范儿
  'geekpark.net', // 极客公园
  'tech.qq.com', // 腾讯科技
  'tech.sina.com.cn', // 新浪科技
  'tech.163.com', // 网易科技
  '36kr.com', // 36氪（重复但重要）
  
  // 英文财经媒体
  'wsj.com', // 华尔街日报
  'economist.com', // 经济学人
  'ft.com', // 金融时报
  'bloomberg.com', // 彭博社
  'reuters.com', // 路透社
  'cnbc.com', // CNBC
  'marketwatch.com', // 市场观察
  'forbes.com', // 福布斯
  'businessinsider.com', // 商业内幕
  
  // 英文科技媒体
  'techcrunch.com', // TechCrunch
  'theverge.com', // The Verge
  'wired.com', // 连线
  'venturebeat.com', // VentureBeat
  'arstechnica.com', // Ars Technica
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
  
  // 高质量媒体列表（优先搜索）
  const highQualitySources = [
    '36氪', '华尔街见闻', '虎嗅', '第一财经', '财新', '界面新闻', '每日经济新闻', '雪球',
    '澎湃新闻', '证券时报', '中国证券报', '21世纪经济报道',
  ];

  // 收集所有搜索结果
  const allWebItems: any[] = [];
  const seenUrls = new Set<string>();

  // 第一步：分别搜索每个高质量媒体（提高命中率）
  console.log('Step 1: Searching high-quality financial media...');
  for (const source of highQualitySources) {
    const query = `${source} 财经新闻 股市 科技 互联网 AI`;
    console.log(`  Searching: ${source}`);
    
    try {
      const response = await client.advancedSearch(query, {
        searchType: 'web',
        count: 30, // 每个媒体搜索30条
        timeRange: '2d',
        needSummary: true,
        needUrl: true,
        needContent: true,
      });

      if (response.web_items && response.web_items.length > 0) {
        for (const item of response.web_items) {
          if (item.url && !seenUrls.has(item.url)) {
            item.priority = 1; // 最高优先级
            allWebItems.push(item);
            seenUrls.add(item.url);
          }
        }
        console.log(`    Found ${response.web_items.length} results, total ${allWebItems.length}`);
      }
    } catch (error) {
      console.error(`    Error searching ${source}:`, error);
    }
  }
  console.log(`Step 1 complete: ${allWebItems.length} total results`);

  // 第二步：如果结果不足，补充搜索英文媒体
  if (allWebItems.length < 80) {
    console.log('Step 2: Supplementing with English media search...');
    const englishSources = ['彭博', '路透', '金融时报', 'CNBC'];
    
    for (const source of englishSources) {
      const query = `${source} 财经 新闻 市场 股票`;
      console.log(`  Searching: ${source}`);
      
      try {
        const response = await client.advancedSearch(query, {
          searchType: 'web',
          count: 30,
          timeRange: '3d',
          needSummary: true,
          needUrl: true,
          needContent: true,
        });

        if (response.web_items && response.web_items.length > 0) {
          for (const item of response.web_items) {
            if (item.url && !seenUrls.has(item.url)) {
              item.priority = 2;
              allWebItems.push(item);
              seenUrls.add(item.url);
            }
          }
          console.log(`    Found ${response.web_items.length} results, total ${allWebItems.length}`);
        }
      } catch (error) {
        console.error(`    Error searching ${source}:`, error);
      }
    }
  }

  // 第三步：如果结果仍不足，广泛搜索
  if (allWebItems.length < 100) {
    console.log('Step 3: Broad search for more content...');
    const broadQuery = '重要财经新闻 市场动态 股市 经济 AI 互联网 科技';
    
    try {
      const response = await client.advancedSearch(broadQuery, {
        searchType: 'web',
        count: 50,
        timeRange: '2d',
        needSummary: true,
        needUrl: true,
        needContent: true,
      });

      if (response.web_items && response.web_items.length > 0) {
        for (const item of response.web_items) {
          if (item.url && !seenUrls.has(item.url)) {
            item.priority = 3;
            allWebItems.push(item);
            seenUrls.add(item.url);
          }
        }
        console.log(`    Found ${response.web_items.length} results, total ${allWebItems.length}`);
      }
    } catch (error) {
      console.error('    Error in broad search:', error);
    }
  }

  if (allWebItems.length === 0) {
    console.log('No news found after all search attempts');
    return [];
  }

  console.log(`Total unique news items: ${allWebItems.length}`);
  
  // 统计高质量媒体新闻数量
  let highQualityCount = 0;
  const allSources = [...highQualitySources, '彭博', '路透', '金融时报', 'CNBC'];
  allWebItems.forEach(item => {
    const source = (item.site_name || '').toLowerCase();
    if (allSources.some(name => source.includes(name.toLowerCase()))) {
      highQualityCount++;
    }
  });
  console.log(`High quality media news count: ${highQualityCount}/${allWebItems.length}`);

  const rankedNews = await processAndRankNews(allWebItems);
  
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
    priority: item.priority || 5, // 添加优先级标记
  }));

  // 定义高质量媒体名称列表（用于LLM识别）
  const highQualitySources = [
    '虎嗅', '华尔街见闻', '36氪', '雪球', '第一财经', '财新', '界面新闻', '每日经济新闻', // 今日头条官方账号
    '36kr', 'huxiu', 'caixin', 'jiemian', 'yicai', 'nbd',
    '爱范儿', '极客公园', '澎湃新闻', '证券时报',
    '华尔街日报', '经济学人', '金融时报', '彭博', 'Bloomberg', '路透', 'Reuters', 'CNBC', '福布斯', 'Forbes',
    'TechCrunch', 'The Verge', 'Wired', 'VentureBeat', 'Ars Technica'
  ];

  // 检查新闻是否来自高质量媒体
  const isHighQuality = (source: string | undefined, title: string): boolean => {
    if (!source) return false;
    const lowerSource = source.toLowerCase();
    const lowerTitle = title.toLowerCase();
    return highQualitySources.some(name => 
      lowerSource.includes(name.toLowerCase()) || lowerTitle.includes(name.toLowerCase())
    );
  };

  // 将新闻列表转换为文本格式，包含优先级和来源质量标记
  const newsText = newsData.map((item, idx) => {
    const isHQ = isHighQuality(item.source, item.originalTitle);
    return `【新闻 ${idx + 1}】
优先级：${item.priority === 1 ? '高-中文财经权威' : item.priority === 2 ? '高-中文科技' : item.priority === 3 ? '高-英文财经权威' : item.priority === 4 ? '高-英文科技' : '中-广泛搜索'}
来源质量：${isHQ ? '✓ 高质量媒体' : '✗ 其他来源'}
标题：${item.originalTitle}
来源：${item.source || '未知'}
摘要：${item.summary.substring(0, 300)}
内容：${item.content?.substring(0, 500) || ''}
链接：${item.url}`;
  }).join('\n\n---\n\n');

  const prompt = `请给我一份金融晚报，就按照近48小时发生的对经济和股市有较大影响的排名前20个需要关注的事件，重要度排序，含新闻标题，摘要和每个事件对应链接，尤其是科技和互联网领域的信息。

新闻列表：
${newsText}

**关键筛选规则（必须严格遵守）：**

1. 优先级1（必须执行）：
   - TOP 20 新闻中，优先选择"来源质量：✓ 高质量媒体"的新闻
   - **最高优先级**：来自今日头条财经官方账号（虎嗅APP、华尔街见闻、36氪财经、雪球基金、第一财经、财新网、界面新闻、每日经济新闻）发布的新闻
   - 这些官方账号发布的新闻通常具有较高的权威性和专业性
   - 即使其他媒体的内容看起来很重要，也应优先保证今日头条官方账号新闻的覆盖率

2. 评估每条新闻的重要性（综合考虑来源质量和事件重大程度）：
   - 今日头条官方账号 + 重大事件（9-10分）：政策变化、重大并购、大公司重大事件、AI突破、科技颠覆性变化
   - 其他高质量媒体 + 重大事件（8-9分）：行业动态、公司业绩、监管变化、市场波动
   - 今日头条官方账号 + 重要事件（7-8分）：内容来自官方账号，重要性一般
   - 其他来源 + 重大事件（5-6分）：内容重要但来源不够权威
   - 其他来源 + 一般事件（1-4分）：普通新闻，应尽量避免选择

3. 为每条新闻生成一个简练的AI总结标题（突出核心事件和影响）

4. 用1-3句话生成AI摘要（简洁明了地说明事件及其影响）

5. 按重要性从高到低排序，选出TOP 20

**特别强调：**
- 优先选择标记"来源质量：✓ 高质量媒体"的新闻
- 特别关注来自今日头条财经官方账号的新闻（虎嗅、华尔街见闻、36氪、雪球、第一财经、财新、界面、每日经济新闻）
- 只有当高质量媒体新闻确实不够重要或不够多时，才选择其他来源的新闻

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

评分标准（1-10分，优先考虑来源质量）：
- 9-10分：今日头条官方账号 + 重大事件（首选）
- 8-9分：其他高质量媒体 + 重大事件（次选）
- 7-8分：今日头条官方账号 + 重要事件
- 5-6分：其他来源 + 重大事件（补充）
- 1-4分：其他来源 + 一般事件（最后选择，尽量避免）

今日头条财经官方账号（最高优先级）：
- 虎嗅APP、华尔街见闻、36氪财经、雪球基金、第一财经、财新网、界面新闻、每日经济新闻

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
        content: '你是一位资深的金融新闻编辑，擅长从大量新闻中筛选重要事件、生成精准的AI标题和摘要，能够快速判断新闻对金融市场的影响程度。你特别关注科技和互联网领域的重大事件，并且非常重视新闻来源的质量和可信度。你始终优先选择来自今日头条财经官方账号（虎嗅APP、华尔街见闻、36氪财经、雪球基金、第一财经、财新网、界面新闻、每日经济新闻）和其他权威媒体的新闻。' 
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
