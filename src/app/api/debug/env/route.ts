import { NextResponse } from 'next/server';

export async function GET() {
  // 检查所有可能的环境变量
  const envInfo = {
    ARK_API_KEY: process.env.ARK_API_KEY ? '✓ 已配置 (长度: ' + process.env.ARK_API_KEY.length + ')' : '✗ 未配置',
    NEXT_PUBLIC_ARK_API_KEY: process.env.NEXT_PUBLIC_ARK_API_KEY ? '✓ 已配置' : '✗ 未配置',
    COZE_BUCKET_ENDPOINT_URL: process.env.COZE_BUCKET_ENDPOINT_URL ? '✓ 已配置' : '✗ 未配置',
    COZE_BUCKET_NAME: process.env.COZE_BUCKET_NAME ? '✓ 已配置' : '✗ 未配置',
    // 列出所有以ARK或COZE开头的环境变量
    allEnvVars: Object.keys(process.env)
      .filter(key => key.includes('ARK') || key.includes('COZE') || key.includes('VOLC'))
      .reduce((acc, key) => {
        const value = process.env[key];
        acc[key] = value ? `✓ 已配置 (长度: ${value.length})` : '✗ 未配置';
        return acc;
      }, {} as Record<string, string>)
  };

  return NextResponse.json(envInfo);
}
