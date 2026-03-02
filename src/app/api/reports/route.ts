import { NextRequest, NextResponse } from 'next/server';
import { readdir, readFile, stat } from 'fs/promises';
import { join } from 'path';

interface ReportFile {
  filename: string;
  date: string;
  type: '早报' | '晚报';
  timestamp: number;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const reportType = searchParams.get('type'); // '早报' | '晚报' | null (全部)

    // 读取 public/reports 目录
    const reportsDir = join(process.cwd(), 'public', 'reports');
    
    try {
      const files = await readdir(reportsDir);
      const reportFiles: ReportFile[] = [];

      // 筛选 .md 文件并解析
      for (const file of files) {
        if (!file.endsWith('.md')) continue;

        // 解析文件名格式：YYYY-MM-DD_早报.md 或 YYYY-MM-DD_晚报.md
        const match = file.match(/(\d{4}-\d{2}-\d{2})_(早报|晚报)\.md/);
        if (match) {
          const [, date, type] = match;
          const filePath = join(reportsDir, file);
          const fileStat = await stat(filePath);

          // 如果指定了类型，只返回该类型的简报
          if (reportType && reportType !== type) continue;

          reportFiles.push({
            filename: file,
            date,
            type: type as '早报' | '晚报',
            timestamp: fileStat.mtimeMs,
          });
        }
      }

      // 按日期降序排序（最新的在前面）
      reportFiles.sort((a, b) => b.timestamp - a.timestamp);

      // 返回简报列表
      return NextResponse.json({
        success: true,
        reports: reportFiles,
      });
    } catch (error) {
      // 目录不存在，返回空列表
      return NextResponse.json({
        success: true,
        reports: [],
      });
    }
  } catch (error) {
    console.error('Error fetching reports list:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch reports list',
        reports: [],
      },
      { status: 500 }
    );
  }
}
