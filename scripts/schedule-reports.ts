#!/usr/bin/env node

/**
 * 简报定时任务脚本
 * 
 * 功能：
 * - 每天早上 8:00 自动生成早报
 * - 每天晚上 20:00 自动生成晚报
 * - 支持手动触发
 */

const BASE_URL = process.env.BASE_URL || 'http://localhost:5000';

// 检查是否是手动触发
const manualTrigger = process.argv.includes('--manual');
const reportTypeArg = process.argv.find(arg => arg === '--morning' || arg === '--evening');
const manualType = reportTypeArg === '--morning' ? '早报' : reportTypeArg === '--evening' ? '晚报' : null;

/**
 * 同步简报
 */
async function syncReport(type: '早报' | '晚报'): Promise<void> {
  const now = new Date();
  console.log(`[${now.toLocaleTimeString()}] 开始同步${type}...`);

  try {
    const response = await fetch(`${BASE_URL}/api/reports/sync?type=${encodeURIComponent(type)}`, {
      method: 'POST',
    });

    const data = await response.json();

    if (data.success) {
      console.log(`✅ ${type}同步成功: ${data.filename}`);
    } else {
      console.error(`❌ ${type}同步失败: ${data.error}`);
    }
  } catch (error) {
    console.error(`❌ ${type}同步出错:`, error);
  }
}

/**
 * 检查是否需要生成早报
 */
function shouldGenerateMorningReport(): boolean {
  const now = new Date();
  const hours = now.getHours();
  const minutes = now.getMinutes();
  
  // 早报在 8:00 生成
  return hours === 8 && minutes === 0;
}

/**
 * 检查是否需要生成晚报
 */
function shouldGenerateEveningReport(): boolean {
  const now = new Date();
  const hours = now.getHours();
  const minutes = now.getMinutes();
  
  // 晚报在 20:00 生成
  return hours === 20 && minutes === 0;
}

/**
 * 主函数
 */
async function main(): Promise<void> {
  console.log('📅 简报定时任务启动');
  console.log(`📍 基础URL: ${BASE_URL}`);
  console.log(`🕐 当前时间: ${new Date().toLocaleString()}`);
  
  // 手动触发模式
  if (manualTrigger) {
    if (manualType) {
      console.log(`📝 手动触发: 生成${manualType}`);
      await syncReport(manualType as '早报' | '晚报');
    } else {
      console.log('📝 手动触发: 生成早报和晚报');
      await syncReport('早报');
      await syncReport('晚报');
    }
    process.exit(0);
  }
  
  // 自动定时模式
  console.log('⏰ 自动定时模式已启动');
  console.log('📅 早报: 每天 08:00');
  console.log('📅 晚报: 每天 20:00');
  console.log('⏱️  每分钟检查一次...\n');

  // 每分钟检查一次
  let lastCheckedMinute = -1;
  
  setInterval(async () => {
    const now = new Date();
    const currentMinute = now.getMinutes();
    
    // 避免同一分钟重复检查
    if (currentMinute === lastCheckedMinute) {
      return;
    }
    
    lastCheckedMinute = currentMinute;
    
    // 检查是否需要生成早报
    if (shouldGenerateMorningReport()) {
      console.log(`\n[${now.toLocaleTimeString()}] 🌅 触发生成早报`);
      await syncReport('早报');
    }
    
    // 检查是否需要生成晚报
    if (shouldGenerateEveningReport()) {
      console.log(`\n[${now.toLocaleTimeString()}] 🌙 触发生成晚报`);
      await syncReport('晚报');
    }
  }, 1000 * 60); // 每分钟检查一次
}

// 运行主函数
main().catch((error) => {
  console.error('❌ 定时任务启动失败:', error);
  process.exit(1);
});
