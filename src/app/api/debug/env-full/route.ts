import { NextResponse } from 'next/server';

export async function GET() {
  // 读取完整的进程环境
  const allEnv = process.env;
  
  // 找到所有可能相关的环境变量
  const relevantKeys = Object.keys(allEnv).filter(key => 
    key.toLowerCase().includes('ark') || 
    key.toLowerCase().includes('volc') ||
    key.toLowerCase().includes('doubao') ||
    key.toLowerCase().includes('ark_api')
  );
  
  // 打印所有进程环境变量中的ARK相关变量
  const arkRelatedEnv = relevantKeys.reduce((acc, key) => {
    acc[key] = {
      exists: true,
      length: allEnv[key]?.length || 0,
      preview: allEnv[key]?.substring(0, 8) + '...' || '(empty)'
    };
    return acc;
  }, {} as Record<string, any>);
  
  // 检查我们关心的几个特定变量
  const result = {
    ARK_API_KEY: {
      exists: !!process.env.ARK_API_KEY,
      length: process.env.ARK_API_KEY?.length || 0,
      type: typeof process.env.ARK_API_KEY,
      preview: process.env.ARK_API_KEY?.substring(0, 8) + '...'
    },
    NEXT_PUBLIC_ARK_API_KEY: {
      exists: !!process.env.NEXT_PUBLIC_ARK_API_KEY,
      length: process.env.NEXT_PUBLIC_ARK_API_KEY?.length || 0,
    },
    allARKRelatedEnv: arkRelatedEnv,
    envVarCount: Object.keys(process.env).length,
    // 显示前50个环境变量名称（帮助调试）
    sampleEnvKeys: Object.keys(process.env).slice(0, 50).sort()
  };

  return NextResponse.json(result);
}
