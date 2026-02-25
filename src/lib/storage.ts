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

// 获取当前整点（向下取整）
function getCurrentHour(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}`;
}

// 获取前N个整点
function getPreviousHour(hours: number): string {
  const now = new Date();
  now.setHours(now.getHours() - hours);
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}`;
}

// 根据时间段获取文件名（现在改为按整点）
function getNewsFileName(timeRange: string): string {
  return `${NEWS_STORAGE_PREFIX}-${timeRange}`;
}

// 按整点存储新闻数据
export async function saveNewsData(data: any, timeRange: string = '24h') {
  try {
    const currentHour = getCurrentHour();
    const key = await storage.uploadFile({
      fileContent: Buffer.from(JSON.stringify(data, null, 2)),
      fileName: `${NEWS_STORAGE_PREFIX}-${currentHour}-${timeRange}.json`,
      contentType: 'application/json',
    });
    console.log(`Saved news data for ${currentHour}-${timeRange}`);
    return key;
  } catch (error) {
    console.error('Error saving news data:', error);
    throw error;
  }
}

// 优先读取最近整点的缓存数据
export async function loadNewsData(timeRange: string = '24h'): Promise<{ data: any; fromCache: boolean } | null> {
  try {
    // 尝试读取最近几个整点的数据（最多回退3小时）
    const hoursToTry = [0, 1, 2, 3];
    
    for (const hourOffset of hoursToTry) {
      const targetHour = hourOffset === 0 ? getCurrentHour() : getPreviousHour(hourOffset);
      const fileName = `${NEWS_STORAGE_PREFIX}-${targetHour}-${timeRange}`;
      
      try {
        const listResult = await storage.listFiles({
          prefix: fileName,
          maxKeys: 1,
        });

        if (listResult.keys && listResult.keys.length > 0) {
          const latestKey = listResult.keys[0];
          const buffer = await storage.readFile({ fileKey: latestKey });
          const data = JSON.parse(buffer.toString('utf-8'));
          
          // 检查数据是否过期（超过24小时就认为过期）
          const lastUpdated = new Date(data.lastUpdated || 0);
          const now = new Date();
          const hoursDiff = (now.getTime() - lastUpdated.getTime()) / (1000 * 60 * 60);
          
          if (hoursDiff <= 24) {
            console.log(`Loaded cached news data for ${targetHour}-${timeRange} (${hoursDiff.toFixed(1)}h old)`);
            return {
              data,
              fromCache: true
            };
          }
        }
      } catch (err) {
        // 忽略单个文件的读取错误，继续尝试下一个
        console.log(`Failed to load ${fileName}, trying next...`);
      }
    }
    
    console.log(`No valid cache found for timeRange=${timeRange}`);
    return null;
  } catch (error) {
    console.error('Error loading news data:', error);
    return null;
  }
}

// 列出所有可用的缓存时间点
export async function listAvailableCaches(timeRange: string = '24h'): Promise<string[]> {
  try {
    const listResult = await storage.listFiles({
      prefix: `${NEWS_STORAGE_PREFIX}-${timeRange}`,
      maxKeys: 100,
    });

    if (!listResult.keys || listResult.keys.length === 0) {
      return [];
    }

    // 提取时间点（如：2025-02-25-14）
    const timePoints = listResult.keys
      .map(key => {
        const match = key.match(new RegExp(`${NEWS_STORAGE_PREFIX}-([0-9]{4}-[0-9]{2}-[0-9]{2}-[0-9]{2})-${timeRange}`));
        return match ? match[1] : null;
      })
      .filter(Boolean)
      .sort()
      .reverse(); // 最新的在前

    return timePoints as string[];
  } catch (error) {
    console.error('Error listing caches:', error);
    return [];
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
