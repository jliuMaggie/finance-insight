import type { NextConfig } from 'next';
import path from 'path';

const nextConfig: NextConfig = {
  // outputFileTracingRoot: path.resolve(__dirname, '../../'),
  /* config options here */
  allowedDevOrigins: ['*.dev.coze.site'],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'lf-coze-web-cdn.coze.cn',
        pathname: '/**',
      },
    ],
  },
  // 声明服务端环境变量
  env: {
    ARK_API_KEY: process.env.ARK_API_KEY || '',
    COZE_BUCKET_ENDPOINT_URL: process.env.COZE_BUCKET_ENDPOINT_URL || '',
    COZE_BUCKET_NAME: process.env.COZE_BUCKET_NAME || '',
  },
};

export default nextConfig;
