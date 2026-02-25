import { NextRequest } from 'next/server';
import { LLMClient, Config, HeaderUtils } from 'coze-coding-dev-sdk';
import { getSDKConfig } from '@/lib/config';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const { question, context } = await request.json();
  const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);

  if (!question || typeof question !== 'string') {
    return new Response(
      JSON.stringify({ error: 'Question is required' }),
      { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }

  const config = getSDKConfig();
  const client = new LLMClient(config, customHeaders);

  // 构建 system prompt
  const systemPrompt = `你是一位资深的投资分析师，擅长分析金融新闻事件的投资机会和风险。

你的职责：
1. 分析新闻事件对相关行业、公司、股市的影响
2. 识别潜在的投资机会
3. 提醒可能的投资风险
4. 给出客观、专业的投资建议
5. 引用数据和市场信息支撑你的观点

回答格式：
- 先总结事件的核心影响
- 分析机会：列出具体的投资机会、受益板块、相关公司
- 分析风险：指出潜在的风险点、不确定性
- 给出建议：综合评估后给出投资建议（积极/谨慎/观望）

注意事项：
- 保持客观中立，不提供买卖建议
- 明确指出信息的不确定性
- 提醒投资者自行决策并承担风险`;

  // 构建用户消息
  let userMessage = '';
  if (context) {
    userMessage = `新闻事件：
标题：${context.title}
摘要：${context.summary}
来源：${context.source || '未知'}
发布时间：${context.publishTime || '未知'}
链接：${context.url}

我的问题：${question}`;
  } else {
    userMessage = `我的问题：${question}`;
  }

  const messages = [
    { role: 'system' as const, content: systemPrompt },
    { role: 'user' as const, content: userMessage }
  ];

  try {
    // 创建 SSE 流式响应
    const stream = new ReadableStream({
      async start(controller) {
        try {
          const llmStream = client.stream(messages, {
            temperature: 0.7,
            model: 'doubao-seed-1-8-251228',
          });

          for await (const chunk of llmStream) {
            if (chunk.content) {
              const text = chunk.content.toString();
              const data = JSON.stringify({ content: text });
              controller.enqueue(`data: ${data}\n\n`);
            }
          }

          // 发送结束信号
          controller.enqueue('data: [DONE]\n\n');
          controller.close();
        } catch (error) {
          console.error('Error in LLM stream:', error);
          const errorData = JSON.stringify({ 
            error: 'Analysis failed',
            content: '抱歉，分析过程中出现错误。请稍后重试。'
          });
          controller.enqueue(`data: ${errorData}\n\n`);
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    console.error('Error in chat API:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Failed to process request',
        message: error instanceof Error ? error.message : 'Unknown error'
      }),
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}
