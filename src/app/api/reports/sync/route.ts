import { NextRequest, NextResponse } from 'next/server';
import { writeFile } from 'fs/promises';
import { join } from 'path';
import { LLMClient, Config } from 'coze-coding-dev-sdk';

export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const reportType = searchParams.get('type') || '早报'; // '早报' | '晚报'
    
    // 获取当前日期
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;
    
    const filename = `${dateStr}_${reportType}.md`;
    const filepath = join(process.cwd(), 'public', 'reports', filename);
    
    // 生成简报内容
    const reportContent = await generateReport(reportType, dateStr);
    
    // 保存到文件
    await writeFile(filepath, reportContent, 'utf-8');
    
    return NextResponse.json({
      success: true,
      message: `${reportType}同步成功`,
      filename,
      date: dateStr,
      type: reportType,
    });
  } catch (error) {
    console.error('Error syncing report:', error);
    return NextResponse.json(
      {
        success: false,
        error: '同步简报失败',
      },
      { status: 500 }
    );
  }
}

async function generateReport(type: string, date: string): Promise<string> {
  const config = new Config();
  const llmClient = new LLMClient(config);
  
  const prompt = type === '早报' 
    ? `请生成一份${date}的金融早报（Morning Report）。

要求：
1. 包含以下板块：隔夜市场、今日关注、板块热点、投资策略、风险提示
2. 格式使用 Markdown
3. 每个板块包含3-5条关键信息
4. 使用专业金融术语
5. 内容简洁明了，便于快速阅读
6. 使用表情符号增加可读性

请以"# 📈 ${date} 金融早报"为标题，使用 ## 标记板块，### 标记子板块。`
    : `请生成一份${date}的金融晚报（Evening Report）。

要求：
1. 包含以下板块：宏观要闻、市场动态、政策与监管、行业热点、大宗商品、消费数据、重要提示
2. 格式使用 Markdown
3. 每个板块包含3-5条关键信息
4. 使用专业金融术语
5. 内容简洁明了，便于快速阅读
6. 使用表情符号增加可读性

请以"# 📊 ${date} 金融晚报"为标题，使用 ## 标记板块，### 标记子板块。`;

  try {
    const response = await llmClient.invoke([
      {
        role: 'system',
        content: '你是一位专业的金融分析师，擅长撰写每日金融市场简报。你的简报内容准确、结构清晰、易于阅读。'
      },
      {
        role: 'user',
        content: prompt
      }
    ], {
      temperature: 0.5,
    });

    let content = response.content;
    
    // 清理可能的 Markdown 代码块标记
    content = content.replace(/^```markdown\s*\n/, '');
    content = content.replace(/^```\s*\n/, '');
    content = content.replace(/\n```$/, '');
    
    return content;
  } catch (error) {
    console.error('Error generating report:', error);
    throw new Error('生成简报失败');
  }
}
