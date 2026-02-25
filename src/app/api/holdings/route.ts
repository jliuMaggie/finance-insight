import { NextRequest, NextResponse } from 'next/server';
import { SearchClient, Config, HeaderUtils } from 'coze-coding-dev-sdk';
import { LLMClient } from 'coze-coding-dev-sdk';
import { loadHoldingsData, saveHoldingsData } from '@/lib/storage';
import { INVESTORS } from '@/lib/investors';

interface HoldingChange {
  investor: string;
  symbol: string;
  action: '买入' | '增持' | '减持' | '卖出' | '持仓';  // 新增"持仓"类型
  percentage: number;
  date: string;
  value?: number;
}

// 从配置文件中获取投资者列表
const INVESTORS_LIST = INVESTORS.map(inv => inv.name);

export async function GET() {
  try {
    // 先尝试从 storage 读取缓存的持仓数据
    const cachedData = await loadHoldingsData();
    
    if (cachedData && cachedData.holdings && cachedData.holdings.length > 0) {
      return NextResponse.json({
        success: true,
        holdings: cachedData.holdings,
        lastUpdated: cachedData.lastUpdated,
        fromCache: true,
      });
    }

    // 缓存不存在或过期，则进行搜索
    const holdings = await fetchHoldingsData();
    
    // 保存到 storage
    const dataToSave = {
      holdings,
      lastUpdated: new Date().toISOString(),
    };
    await saveHoldingsData(dataToSave);
    
    return NextResponse.json({
      success: true,
      holdings,
      lastUpdated: new Date().toISOString(),
      fromCache: false,
    });
  } catch (error) {
    console.error('Error fetching holdings:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch holdings',
        holdings: [],
      },
      { status: 500 }
    );
  }
}

export async function POST() {
  try {
    // 强制刷新持仓数据
    const holdings = await fetchHoldingsData();
    
    // 保存到 storage
    const dataToSave = {
      holdings,
      lastUpdated: new Date().toISOString(),
    };
    await saveHoldingsData(dataToSave);
    
    return NextResponse.json({
      success: true,
      holdings,
      lastUpdated: new Date().toISOString(),
      message: 'Holdings refreshed successfully',
      fromCache: false,
    });
  } catch (error) {
    console.error('Error refreshing holdings:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to refresh holdings',
        holdings: [],
      },
      { status: 500 }
    );
  }
}

async function fetchHoldingsData(forceRefresh = false): Promise<HoldingChange[]> {
  const config = new Config();
  const client = new SearchClient(config);
  const llmClient = new LLMClient(config);
  
  const allHoldings: HoldingChange[] = [];
  
  // 为每个投资者搜索持仓变动信息
  for (const investor of INVESTORS_LIST) {
    try {
      const holdings = await fetchInvestorHoldings(investor, client, llmClient);
      allHoldings.push(...holdings);
    } catch (error) {
      console.error(`Error fetching holdings for ${investor}:`, error);
    }
  }
  
  return allHoldings;
}

async function fetchInvestorHoldings(
  investor: string,
  searchClient: SearchClient,
  llmClient: LLMClient
): Promise<HoldingChange[]> {
  // 判断是个人投资者还是机构投资者
  const isInstitution = investor.includes('资本') || 
                        investor.includes('基金') || 
                        investor.includes('资本') || 
                        investor === '贝莱德' || 
                        investor === '红杉资本' ||
                        investor === '桥水基金' ||
                        investor === '高瓴资本' ||
                        investor === '索罗斯基金';

  let query: string;
  let timeRange: string;

  if (isInstitution) {
    // 机构投资者使用英文关键词搜索（更准确）
    let englishQuery = '';
    if (investor.includes('桥水')) {
      englishQuery = 'Bridgewater Associates 13F filing holdings 2025 Q4';
    } else if (investor.includes('红杉')) {
      englishQuery = 'Sequoia Capital 13F filing holdings 2025';
    } else if (investor.includes('高瓴')) {
      englishQuery = 'Hillhouse Capital 13F filing holdings 2025';
    } else if (investor.includes('贝莱德')) {
      englishQuery = 'BlackRock 13F filing holdings 2025';
    } else if (investor.includes('索罗斯')) {
      englishQuery = 'Soros Fund Management 13F filing holdings 2025';
    } else {
      englishQuery = `${investor} 13F filing holdings 2025`;
    }
    query = englishQuery;
    timeRange = '6m'; // 扩大时间范围
  } else {
    // 个人投资者使用原有查询
    query = `${investor} 持仓变动 13F 增持 减持 近期`;
    timeRange = '2w';
  }
  
  console.log(`Searching holdings for ${investor}, query: ${query}`);
  
  const response = await searchClient.advancedSearch(query, {
    searchType: 'web',
    count: 15, // 增加搜索结果数量
    timeRange: timeRange,
    needSummary: true,
    needContent: true,
  });

  if (!response.web_items || response.web_items.length === 0) {
    console.log(`No results found for ${investor}`);
    return [];
  }

  console.log(`Found ${response.web_items.length} results for ${investor}`);

  // 使用 LLM 提取持仓变动信息
  const holdings = await extractHoldingFromSearchResults(investor, response.web_items, llmClient, isInstitution);
  
  console.log(`Extracted ${holdings.length} holdings for ${investor}`);
  
  return holdings;
}

async function extractHoldingFromSearchResults(
  investor: string,
  webItems: any[],
  llmClient: LLMClient,
  isInstitution: boolean = false
): Promise<HoldingChange[]> {
  // 将搜索结果转换为文本格式
  const resultsText = webItems.map((item, idx) => 
    `${idx + 1}. Title: ${item.title}\n   Summary: ${item.summary || item.snippet}\n   Content: ${item.content?.substring(0, 1000) || ''}\n   Time: ${item.publish_time || ''}`
  ).join('\n\n');

  // 根据投资者类型调整 prompt
  let extraInstructions = '';
  if (isInstitution) {
    extraInstructions = `
特别针对机构投资者的13F持仓报告：
1. 提取"最新持仓"（latest holdings）和"持仓变动"（holdings changes）两种信息
2. 如果看到"increase", "buy", "added"，将 action 设为"买入"或"增持"
3. 如果看到"decrease", "sell", "reduced"，将 action 设为"减持"或"卖出"
4. 如果是"top holdings"或"largest holdings"，提取其持仓占比作为百分比
5. 注意识别股票代码（如 SPY, IVV, GOOGL, AAPL 等）
6. 日期可以提取报告期（如 2025 Q4, 2025-12-31）
7. 如果有"market value"或"value"信息，提取为百万美元`;
  } else {
    extraInstructions = `
1. 只提取真实的持仓变动信息
2. 如果搜索结果中没有明确的持仓数据，返回空数组`;
  }

  const prompt = `Please extract holdings information for ${investor} from the following search results.

Search Results:
${resultsText}

Please extract the following information and return ONLY in JSON format:
{
  "holdings": [
    {
      "symbol": "Stock code or name (e.g., SPY, IVV, Nvidia, Apple)",
      "action": "buy/increase/decrease/sell/hold",
      "percentage": percentage change or holding ratio (e.g., 7 for 7%),
      "date": "Date in YYYY-MM-DD format (e.g., 2025-12-31)",
      "value": holding value in millions USD (optional)
    }
  ]
}

注意事项 / Notes:
1. action can be: buy, increase, decrease, sell, hold
2. percentage can be change percentage or holding ratio
3. If it's "latest holdings" information, set action to "hold", percentage to holding ratio
4. If information is unclear or uncertain, do not guess
${extraInstructions}

请用中文返回 action 字段（买入/增持/减持/卖出/持仓），其他字段保持原始格式。`;

  try {
    const response = await llmClient.invoke([
      { 
        role: 'system', 
        content: 'You are a professional financial analyst specializing in extracting holdings information from news reports and 13F filings. Only extract clear, verifiable data. For institutional investors, pay special attention to extracting latest holdings and changes from 13F filings.' 
      },
      { role: 'user', content: prompt }
    ], {
      temperature: 0.2,
    });

    const content = response.content;
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    
    if (!jsonMatch) {
      return [];
    }

    const data = JSON.parse(jsonMatch[0]);
    
    if (!data.holdings || !Array.isArray(data.holdings)) {
      return [];
    }

    // 转换为标准格式
    return data.holdings.map((h: any) => ({
      investor,
      symbol: h.symbol || 'N/A',
      action: h.action || '未知',
      percentage: typeof h.percentage === 'number' ? h.percentage : 0,
      date: h.date || new Date().toISOString().split('T')[0],
      value: h.value || undefined,
    }));
  } catch (error) {
    console.error('Error extracting holdings with LLM:', error);
    return [];
  }
}
