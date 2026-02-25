import { NextRequest, NextResponse } from 'next/server';
import { SearchClient, Config, HeaderUtils } from 'coze-coding-dev-sdk';
import { LLMClient } from 'coze-coding-dev-sdk';
import { loadHoldingsData, saveHoldingsData } from '@/lib/storage';
import { INVESTORS } from '@/lib/investors';

interface HoldingChange {
  investor: string;
  symbol: string;
  action: string;
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
  // 搜索该投资者的最新持仓变动
  const query = `${investor} 持仓变动 13F 增持 减持 近期`;
  
  const response = await searchClient.advancedSearch(query, {
    searchType: 'web',
    count: 10,
    timeRange: '2w',
    needSummary: true,
    needContent: true,
  });

  if (!response.web_items || response.web_items.length === 0) {
    return [];
  }

  // 使用 LLM 提取持仓变动信息
  const holdings = await extractHoldingFromSearchResults(investor, response.web_items, llmClient);
  
  return holdings;
}

async function extractHoldingFromSearchResults(
  investor: string,
  webItems: any[],
  llmClient: LLMClient
): Promise<HoldingChange[]> {
  // 将搜索结果转换为文本格式
  const resultsText = webItems.map((item, idx) => 
    `${idx + 1}. 标题: ${item.title}\n   摘要: ${item.summary || item.snippet}\n   内容: ${item.content?.substring(0, 500) || ''}\n   时间: ${item.publish_time || ''}`
  ).join('\n\n');

  const prompt = `请从以下搜索结果中提取 ${investor} 的持仓变动信息。

搜索结果：
${resultsText}

请提取以下信息，只返回JSON格式：
{
  "holdings": [
    {
      "symbol": "股票代码或名称",
      "action": "买入/增持/减持/卖出",
      "percentage": 变动百分比数字,
      "date": "日期(YYYY-MM-DD格式)",
      "value": 持仓价值(百万美元，可选)
    }
  ]
}

注意事项：
1. 只提取真实的持仓变动信息
2. 如果搜索结果中没有明确的持仓数据，返回空数组
3. action 字段只能是：买入、增持、减持、卖出
4. percentage 为数字，正数表示增持，负数表示减持
5. 如果信息不明确或不确定，不要猜测`;

  try {
    const response = await llmClient.invoke([
      { 
        role: 'system', 
        content: '你是一位专业的金融分析师，擅长从新闻报道中提取投资持仓变动信息。只提取明确的、可验证的数据。' 
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
