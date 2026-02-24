import { S3Storage } from 'coze-coding-dev-sdk';

const storage = new S3Storage({
  endpointUrl: process.env.COZE_BUCKET_ENDPOINT_URL,
  accessKey: '',
  secretKey: '',
  bucketName: process.env.COZE_BUCKET_NAME,
  region: 'cn-beijing',
});

export async function saveNewsData(data: any) {
  try {
    const key = await storage.uploadFile({
      fileContent: Buffer.from(JSON.stringify(data, null, 2)),
      fileName: 'finance-news-top20.json',
      contentType: 'application/json',
    });
    return key;
  } catch (error) {
    console.error('Error saving news data:', error);
    throw error;
  }
}

export async function loadNewsData(): Promise<any | null> {
  try {
    // 尝试读取最新文件
    const listResult = await storage.listFiles({
      prefix: 'finance-news-top20',
      maxKeys: 1,
    });

    if (!listResult.keys || listResult.keys.length === 0) {
      return null;
    }

    const latestKey = listResult.keys[0];
    const buffer = await storage.readFile({ fileKey: latestKey });
    const data = JSON.parse(buffer.toString('utf-8'));

    // 检查数据是否过期（超过12小时）
    const lastUpdated = new Date(data.lastUpdated || 0);
    const now = new Date();
    const hoursDiff = (now.getTime() - lastUpdated.getTime()) / (1000 * 60 * 60);

    if (hoursDiff > 12) {
      console.log('News data is expired (older than 12 hours)');
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
