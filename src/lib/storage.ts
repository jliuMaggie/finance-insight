import { S3Storage } from 'coze-coding-dev-sdk';

const storage = new S3Storage({
  endpointUrl: process.env.COZE_BUCKET_ENDPOINT_URL,
  accessKey: '',
  secretKey: '',
  bucketName: process.env.COZE_BUCKET_NAME,
  region: 'cn-beijing',
});

// 新闻数据存储键名前缀
const NEWS_STORAGE_PREFIX = 'finance-news-top20';

// 根据时间段获取文件名
function getNewsFileName(timeRange: string): string {
  return `${NEWS_STORAGE_PREFIX}-${timeRange}.json`;
}

export async function saveNewsData(data: any, timeRange: string = '24h') {
  try {
    const key = await storage.uploadFile({
      fileContent: Buffer.from(JSON.stringify(data, null, 2)),
      fileName: getNewsFileName(timeRange),
      contentType: 'application/json',
    });
    return key;
  } catch (error) {
    console.error('Error saving news data:', error);
    throw error;
  }
}

export async function loadNewsData(timeRange: string = '24h'): Promise<any | null> {
  try {
    const fileName = getNewsFileName(timeRange);
    
    // 尝试读取指定时间段的文件
    const listResult = await storage.listFiles({
      prefix: fileName,
      maxKeys: 1,
    });

    if (!listResult.keys || listResult.keys.length === 0) {
      return null;
    }

    const latestKey = listResult.keys[0];
    const buffer = await storage.readFile({ fileKey: latestKey });
    const data = JSON.parse(buffer.toString('utf-8'));

    // 检查数据是否过期
    const lastUpdated = new Date(data.lastUpdated || 0);
    const now = new Date();
    const hoursDiff = (now.getTime() - lastUpdated.getTime()) / (1000 * 60 * 60);

    // 不同时间段有不同的过期时间
    const maxAge = parseInt(timeRange) || 24;
    
    if (hoursDiff > maxAge) {
      console.log(`News data for ${timeRange} is expired (older than ${maxAge} hours)`);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error loading news data:', error);
    return null;
  }
}

export async function saveHoldingsData(data: any) {
  try {
    const key = await storage.uploadFile({
      fileContent: Buffer.from(JSON.stringify(data, null, 2)),
      fileName: 'finance-holdings.json',
      contentType: 'application/json',
    });
    return key;
  } catch (error) {
    console.error('Error saving holdings data:', error);
    throw error;
  }
}

export async function loadHoldingsData(): Promise<any | null> {
  try {
    const listResult = await storage.listFiles({
      prefix: 'finance-holdings',
      maxKeys: 1,
    });

    if (!listResult.keys || listResult.keys.length === 0) {
      return null;
    }

    const latestKey = listResult.keys[0];
    const buffer = await storage.readFile({ fileKey: latestKey });
    const data = JSON.parse(buffer.toString('utf-8'));

    // 检查数据是否过期（超过24小时）
    const lastUpdated = new Date(data.lastUpdated || 0);
    const now = new Date();
    const hoursDiff = (now.getTime() - lastUpdated.getTime()) / (1000 * 60 * 60);

    if (hoursDiff > 24) {
      console.log('Holdings data is expired (older than 24 hours)');
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error loading holdings data:', error);
    return null;
  }
}
