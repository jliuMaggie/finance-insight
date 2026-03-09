import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { join } from 'path';

interface HoldingChange {
  investor: string;
  symbol: string;
  action: '买入' | '增持' | '减持' | '卖出' | '持仓';
  percentage: number;
  date: string;
  value?: number;
}

// 读取静态持仓数据
export async function GET() {
  try {
    const filePath = join(process.cwd(), 'public', 'data', 'holdings.json');
    const fileContent = await readFile(filePath, 'utf-8');
    const data = JSON.parse(fileContent);
    
    return NextResponse.json({
      success: true,
      holdings: data.holdings || [],
      lastUpdated: data.lastUpdated || '未知',
      fromStatic: true,
    });
  } catch (error) {
    console.error('Error reading holdings data:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to read holdings data',
        holdings: [],
      },
      { status: 500 }
    );
  }
}
