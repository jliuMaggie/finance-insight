import { NextRequest, NextResponse } from 'next/server';
import { SearchClient, Config } from 'coze-coding-dev-sdk';
import { LLMClient } from 'coze-coding-dev-sdk';
import { loadHoldingsData, saveHoldingsData } from '@/lib/storage';
import { INVESTORS } from '@/lib/investors';

interface HoldingChange {
  investor: string;
  symbol: string;
  action: '买入' | '增持' | '减持' | '卖出' | '持仓';
  percentage: number;
  date: string;
  value?: number;
}

// 从配置文件中获取投资者列表
const INVESTORS_LIST = INVESTORS.map(inv => inv.name);

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

async function fetchHoldingsData(): Promise<HoldingChange[]> {
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
    count: 15,
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
`;
  }

  const prompt = `分析以下关于"${investor}"的搜索结果，提取近期的持仓变动信息。

${resultsText}

要求：
1. 提取持仓变动信息：股票代码、操作类型（买入/增持/减持/卖出/持仓）、变动比例、日期
2. 只提取明确提到的持仓变动，不要猜测
3. 如果没有明确信息，返回空数组
4. 数据格式：
${extraInstructions}

返回JSON格式：
{
  "holdings": [
    {
      "symbol": "股票代码（如AAPL、NVDA）",
      "action": "买入|增持|减持|卖出|持仓",
      "percentage": 持仓比例数字,
      "date": "日期（如2025-01-15）",
      "value": 持仓金额（可选，单位百万美元）
    }
  ]
}

如果没有找到明确的持仓变动信息，返回：{"holdings": []}`;

  try {
    const response = await llmClient.invoke([
      { 
        role: 'system', 
        content: '你是一个专业的金融数据分析助手，擅长从新闻和报告中提取持仓变动信息。你能够准确识别股票代码、操作类型和变动幅度。' 
      },
      { role: 'user', content: prompt }
    ], {
      temperature: 0.2,
    });

    const content = response.content;
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    
    if (!jsonMatch) {
      console.log(`No valid JSON found in LLM response for ${investor}`);
      return [];
    }

    const result = JSON.parse(jsonMatch[0]);
    
    if (!result.holdings || !Array.isArray(result.holdings)) {
      console.log(`No holdings array found in LLM response for ${investor}`);
      return [];
    }

    // 添加投资者名称
    return result.holdings.map((item: any) => ({
      investor,
      symbol: item.symbol || '',
      action: item.action || '持仓',
      percentage: item.percentage || 0,
      date: item.date || new Date().toISOString().split('T')[0],
      value: item.value,
    }));
  } catch (error) {
    console.error('Error extracting holdings with LLM:', error);
    return [];
  }
}
