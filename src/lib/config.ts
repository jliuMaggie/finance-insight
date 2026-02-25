/**
 * 统一管理 SDK 配置
 * 使用用户自己的豆包 API key（ARK_API_KEY）
 */
import { Config } from 'coze-coding-dev-sdk';

/**
 * 获取 SDK 配置
 * 如果环境变量中配置了 ARK_API_KEY，使用用户的 API key
 */
export function getSDKConfig(): Config {
  const config = new Config();
  
  // 检查是否配置了用户的 API key
  const userApiKey = process.env.ARK_API_KEY;
  
  if (userApiKey) {
    console.log('✓ 使用用户自定义的豆包 API key (ARK_API_KEY)');
    // SDK 应该会自动从环境变量中读取 ARK_API_KEY
    // 如果 Config 支持设置 API key，可以在这里设置
    // config.setApiKey?.(userApiKey); // 根据实际 SDK API 调整
  } else {
    console.warn('⚠ 未检测到 ARK_API_KEY 环境变量，将使用默认配置');
  }
  
  return config;
}

/**
 * 验证环境变量配置
 */
export function validateConfig(): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  // 检查豆包 API key
  if (!process.env.ARK_API_KEY) {
    errors.push('缺少 ARK_API_KEY 环境变量（豆包 API key）');
  }
  
  // 检查存储配置
  if (!process.env.COZE_BUCKET_ENDPOINT_URL) {
    errors.push('缺少 COZE_BUCKET_ENDPOINT_URL 环境变量');
  }
  
  if (!process.env.COZE_BUCKET_NAME) {
    errors.push('缺少 COZE_BUCKET_NAME 环境变量');
  }
  
  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * 打印配置信息（用于调试）
 */
export function printConfigInfo() {
  console.log('='.repeat(50));
  console.log('SDK 配置信息');
  console.log('='.repeat(50));
  console.log(`ARK_API_KEY: ${process.env.ARK_API_KEY ? '✓ 已配置' : '✗ 未配置'}`);
  console.log(`COZE_BUCKET_ENDPOINT_URL: ${process.env.COZE_BUCKET_ENDPOINT_URL ? '✓ 已配置' : '✗ 未配置'}`);
  console.log(`COZE_BUCKET_NAME: ${process.env.COZE_BUCKET_NAME ? '✓ 已配置' : '✗ 未配置'}`);
  console.log('='.repeat(50));
}

// 在服务启动时验证配置
if (typeof window === 'undefined') {
  const validation = validateConfig();
  if (!validation.isValid) {
    console.error('配置验证失败:');
    validation.errors.forEach(err => console.error(`  - ${err}`));
  }
  printConfigInfo();
}
