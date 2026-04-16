import { NextRequest, NextResponse } from 'next/server';
import { S3Storage } from 'coze-coding-dev-sdk';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const imageData = formData.get('image') as string;
    const title = formData.get('title') as string || '金融洞察报告';

    if (!imageData) {
      return NextResponse.json({ error: '未提供图片数据' }, { status: 400 });
    }

    // 将 base64 转换为 Buffer
    const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');

    // 初始化存储
    const storage = new S3Storage({
      endpointUrl: process.env.COZE_BUCKET_ENDPOINT_URL,
      bucketName: process.env.COZE_BUCKET_NAME,
    });

    // 生成文件名
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const safeTitle = title.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '_').substring(0, 50);
    const fileName = `reports/insight_${safeTitle}_${timestamp}.png`;

    // 上传图片
    const key = await storage.uploadFile({
      fileContent: buffer,
      fileName,
      contentType: 'image/png',
    });

    // 生成签名 URL（7天有效期）
    const downloadUrl = await storage.generatePresignedUrl({
      key,
      expireTime: 604800,
    });

    return NextResponse.json({
      success: true,
      downloadUrl,
      key,
    });
  } catch (error) {
    console.error('Export error:', error);
    return NextResponse.json(
      { error: '导出失败' },
      { status: 500 }
    );
  }
}
