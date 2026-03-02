import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { join } from 'path';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  try {
    const { filename } = await params;

    // 安全检查：防止路径遍历攻击
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid filename',
          content: '',
        },
        { status: 400 }
      );
    }

    // 读取文件
    const filePath = join(process.cwd(), 'public', 'reports', filename);
    const content = await readFile(filePath, 'utf-8');

    return NextResponse.json({
      success: true,
      filename,
      content,
    });
  } catch (error) {
    console.error('Error reading report file:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to read report',
        content: '',
      },
      { status: 404 }
    );
  }
}
