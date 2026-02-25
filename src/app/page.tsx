'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { RefreshCw, TrendingUp, DollarSign, Brain, ExternalLink, Calendar, MessageSquare, User, Send } from 'lucide-react';
import { cn } from '@/lib/utils';

interface NewsItem {
  id: string;
  rank: number;
  aiTitle: string; // AI总结的标题
  originalTitle: string; // 原新闻标题
  summary: string; // 1-3句话的AI摘要
  url: string;
  publishTime?: string;
  source?: string;
  importanceScore?: number;
}

interface HoldingChange {
  investor: string;
  symbol: string;
  action: string;
  percentage: number;
  date: string;
  value?: number;
}

interface AIResponse {
  content: string;
  isStreaming: boolean;
}

export default function FinanceInsightPage() {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [newsLoading, setNewsLoading] = useState(true);
  const [newsRefreshing, setNewsRefreshing] = useState(false);

  const [holdings, setHoldings] = useState<HoldingChange[]>([]);
  const [holdingsLoading, setHoldingsLoading] = useState(true);
  const [holdingsRefreshing, setHoldingsRefreshing] = useState(false);

  const [question, setQuestion] = useState('');
  const [aiResponse, setAiResponse] = useState<AIResponse>({ content: '', isStreaming: false });
  const [selectedNewsId, setSelectedNewsId] = useState<string | null>(null);

  const investors = [
    '沃伦·巴菲特',
    '段永平',
    '李录',
    '但斌',
    '詹姆斯·西蒙斯'
  ];

  // 加载新闻数据
  useEffect(() => {
    loadNews();
  }, []);

  // 加载持仓数据
  useEffect(() => {
    loadHoldings();
  }, []);

  const loadNews = async () => {
    try {
      setNewsLoading(true);
      const response = await fetch('/api/news');
      if (!response.ok) throw new Error('Failed to load news');
      const data = await response.json();
      setNews(data.news || []);
    } catch (error) {
      console.error('Error loading news:', error);
      setNews([]);
    } finally {
      setNewsLoading(false);
    }
  };

  const refreshNews = async () => {
    try {
      setNewsRefreshing(true);
      const response = await fetch('/api/news/refresh', { method: 'POST' });
      if (!response.ok) throw new Error('Failed to refresh news');
      const data = await response.json();
      setNews(data.news || []);
    } catch (error) {
      console.error('Error refreshing news:', error);
    } finally {
      setNewsRefreshing(false);
    }
  };

  const loadHoldings = async () => {
    try {
      setHoldingsLoading(true);
      const response = await fetch('/api/holdings');
      if (!response.ok) throw new Error('Failed to load holdings');
      const data = await response.json();
      setHoldings(data.holdings || []);
    } catch (error) {
      console.error('Error loading holdings:', error);
      setHoldings([]);
    } finally {
      setHoldingsLoading(false);
    }
  };

  const refreshHoldings = async () => {
    try {
      setHoldingsRefreshing(true);
      const response = await fetch('/api/holdings/refresh', { method: 'POST' });
      if (!response.ok) throw new Error('Failed to refresh holdings');
      const data = await response.json();
      setHoldings(data.holdings || []);
    } catch (error) {
      console.error('Error refreshing holdings:', error);
    } finally {
      setHoldingsRefreshing(false);
    }
  };

  const askAI = async () => {
    if (!question.trim()) return;

    try {
      setAiResponse({ content: '', isStreaming: true });
      
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question,
          context: selectedNewsId ? news.find(n => n.id === selectedNewsId) : null
        }),
      });

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (reader) {
        let fullContent = '';
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          const chunk = decoder.decode(value);
          const lines = chunk.split('\n');
          
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              if (data === '[DONE]') continue;
              
              try {
                const parsed = JSON.parse(data);
                if (parsed.content) {
                  fullContent += parsed.content;
                  setAiResponse({ content: fullContent, isStreaming: true });
                }
              } catch (e) {
                // Ignore JSON parse errors
              }
            }
          }
        }
        
        setAiResponse({ content: fullContent, isStreaming: false });
      }
    } catch (error) {
      console.error('Error asking AI:', error);
      setAiResponse({
        content: '抱歉，AI分析时出现错误，请稍后重试。',
        isStreaming: false
      });
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      askAI();
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-950 dark:via-slate-900 dark:to-indigo-950">
      {/* Header */}
      <header className="border-b bg-white/80 dark:bg-slate-950/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Brain className="h-8 w-8 text-blue-600 dark:text-blue-400" />
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400 bg-clip-text text-transparent">
                  金融智能洞察
                </h1>
                <p className="text-xs text-muted-foreground">
                  由豆包AI驱动的实时金融新闻与投资分析
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="gap-1">
                <TrendingUp className="h-3 w-3" />
                24小时实时更新
              </Badge>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6">
        <Tabs defaultValue="news" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3 lg:w-[600px]">
            <TabsTrigger value="news" className="gap-2">
              <TrendingUp className="h-4 w-4" />
              金融新闻
            </TabsTrigger>
            <TabsTrigger value="holdings" className="gap-2">
              <DollarSign className="h-4 w-4" />
              持仓变动
            </TabsTrigger>
            <TabsTrigger value="ai-chat" className="gap-2">
              <MessageSquare className="h-4 w-4" />
              AI 分析
            </TabsTrigger>
          </TabsList>

          {/* News Tab */}
          <TabsContent value="news" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <TrendingUp className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                      重要金融事件（TOP 20）
                    </CardTitle>
                    <CardDescription>
                      基于豆包AI联网搜索的近24小时国内外重大金融新闻
                    </CardDescription>
                  </div>
                  <Button
                    onClick={refreshNews}
                    disabled={newsRefreshing}
                    variant="outline"
                    size="sm"
                    className="gap-2"
                  >
                    <RefreshCw className={cn("h-4 w-4", newsRefreshing && "animate-spin")} />
                    刷新
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {newsLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="text-center">
                      <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2 text-blue-600 dark:text-blue-400" />
                      <p className="text-sm text-muted-foreground">正在加载新闻...</p>
                    </div>
                  </div>
                ) : news.length === 0 ? (
                  <div className="text-center py-12">
                    <TrendingUp className="h-12 w-12 mx-auto mb-2 text-muted-foreground/50" />
                    <p className="text-muted-foreground">暂无新闻数据</p>
                  </div>
                ) : (
                  <ScrollArea className="h-[600px] pr-4">
                    <div className="space-y-4">
                      {news.map((item, index) => (
                        <Card key={item.id} className={cn(
                          "transition-all hover:shadow-md cursor-pointer",
                          index < 3 && "border-l-4 border-l-blue-500 dark:border-l-blue-400"
                        )}>
                          <CardContent className="pt-6">
                            <div className="flex items-start gap-4">
                              <div className={cn(
                                "flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center font-bold text-white",
                                index < 3 ? "bg-blue-600 dark:bg-blue-400" : "bg-slate-600 dark:bg-slate-400"
                              )}>
                                {item.rank}
                              </div>
                              <div className="flex-1 min-w-0">
                                {/* AI总结的标题（主要显示） */}
                                <div className="flex items-start justify-between gap-4 mb-2">
                                  <h3 className="font-semibold text-lg line-clamp-2 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                                    {item.aiTitle}
                                  </h3>
                                  <a
                                    href={item.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex-shrink-0"
                                    title="查看原文"
                                  >
                                    <ExternalLink className="h-4 w-4 text-muted-foreground hover:text-blue-600 dark:hover:text-blue-400" />
                                  </a>
                                </div>
                                
                                {/* 原新闻标题（次要显示） */}
                                <div className="mb-3">
                                  <p className="text-xs text-muted-foreground mb-1">原标题：{item.originalTitle}</p>
                                </div>
                                
                                {/* AI摘要 */}
                                <p className="text-sm text-foreground mb-3 line-clamp-3 leading-relaxed">
                                  {item.summary}
                                </p>
                                
                                {/* 来源和时间 */}
                                <div className="flex items-center gap-3 flex-wrap">
                                  {item.source && (
                                    <Badge variant="secondary" className="text-xs">
                                      {item.source}
                                    </Badge>
                                  )}
                                  {item.publishTime && (
                                    <Badge variant="outline" className="text-xs gap-1">
                                      <Calendar className="h-3 w-3" />
                                      {item.publishTime}
                                    </Badge>
                                  )}
                                  {item.importanceScore && (
                                    <Badge 
                                      variant="outline" 
                                      className={cn(
                                        "text-xs gap-1",
                                        item.importanceScore >= 8 ? "border-red-500 text-red-600 dark:text-red-400" :
                                        item.importanceScore >= 6 ? "border-orange-500 text-orange-600 dark:text-orange-400" :
                                        "border-blue-500 text-blue-600 dark:text-blue-400"
                                      )}
                                    >
                                      重要度: {item.importanceScore}/10
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Holdings Tab */}
          <TabsContent value="holdings" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <DollarSign className="h-5 w-5 text-green-600 dark:text-green-400" />
                      投资大佬持仓变动
                    </CardTitle>
                    <CardDescription>
                      巴菲特、段永平、李录、但斌、西蒙斯等投资大师近期持仓变化
                    </CardDescription>
                  </div>
                  <Button
                    onClick={refreshHoldings}
                    disabled={holdingsRefreshing}
                    variant="outline"
                    size="sm"
                    className="gap-2"
                  >
                    <RefreshCw className={cn("h-4 w-4", holdingsRefreshing && "animate-spin")} />
                    刷新
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {holdingsLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="text-center">
                      <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2 text-green-600 dark:text-green-400" />
                      <p className="text-sm text-muted-foreground">正在加载持仓数据...</p>
                    </div>
                  </div>
                ) : holdings.length === 0 ? (
                  <div className="text-center py-12">
                    <DollarSign className="h-12 w-12 mx-auto mb-2 text-muted-foreground/50" />
                    <p className="text-muted-foreground">暂无持仓数据</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {investors.map((investor) => {
                      const investorHoldings = holdings.filter(h => h.investor === investor);
                      if (investorHoldings.length === 0) return null;

                      return (
                        <Card key={investor}>
                          <CardHeader className="pb-3">
                            <div className="flex items-center gap-3">
                              <User className="h-5 w-5 text-green-600 dark:text-green-400" />
                              <CardTitle className="text-lg">{investor}</CardTitle>
                              <Badge variant="secondary">{investorHoldings.length} 条变动</Badge>
                            </div>
                          </CardHeader>
                          <CardContent>
                            <ScrollArea className="h-[300px]">
                              <div className="space-y-3">
                                {investorHoldings.map((holding, idx) => (
                                  <div
                                    key={idx}
                                    className="flex items-center justify-between p-3 rounded-lg border bg-background"
                                  >
                                    <div className="flex-1">
                                      <div className="flex items-center gap-2 mb-1">
                                        <span className="font-semibold">{holding.symbol}</span>
                                        <Badge
                                          variant={holding.action === '买入' || holding.action === '增持' ? 'default' : 'destructive'}
                                          className="text-xs"
                                        >
                                          {holding.action}
                                        </Badge>
                                      </div>
                                      <div className="text-xs text-muted-foreground">
                                        {holding.date}
                                      </div>
                                    </div>
                                    <div className="text-right">
                                      <div className={cn(
                                        "font-bold text-lg",
                                        (holding.action === '买入' || holding.action === '增持') ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                                      )}>
                                        {holding.percentage > 0 ? '+' : ''}{holding.percentage}%
                                      </div>
                                      {holding.value && (
                                        <div className="text-xs text-muted-foreground">
                                          ${holding.value}M
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </ScrollArea>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* AI Chat Tab */}
          <TabsContent value="ai-chat" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                  AI 投资分析
                </CardTitle>
                <CardDescription>
                  基于豆包AI的专业投资机会与风险分析
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* News Selector */}
                <div>
                  <label className="text-sm font-medium mb-2 block">
                    选择新闻（可选）
                  </label>
                  <div className="relative">
                    <select
                      value={selectedNewsId || ''}
                      onChange={(e) => setSelectedNewsId(e.target.value || null)}
                      className="w-full px-3 py-2 border rounded-md bg-background"
                    >
                      <option value="">请选择要分析的新闻事件</option>
                      {news.slice(0, 10).map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.rank}. {item.aiTitle.substring(0, 80)}...
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Question Input */}
                <div>
                  <label className="text-sm font-medium mb-2 block">
                    您的问题
                  </label>
                  <Textarea
                    placeholder="例如：这个事件对科技股有什么影响？有哪些投资机会和风险？"
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    onKeyPress={handleKeyPress}
                    rows={4}
                    className="resize-none"
                  />
                </div>

                {/* Ask Button */}
                <Button
                  onClick={askAI}
                  disabled={!question.trim() || aiResponse.isStreaming}
                  className="w-full gap-2"
                >
                  {aiResponse.isStreaming ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      分析中...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4" />
                      提交分析
                    </>
                  )}
                </Button>

                {/* AI Response */}
                {aiResponse.content && (
                  <Card className="bg-purple-50 dark:bg-purple-950/20 border-purple-200 dark:border-purple-800">
                    <CardHeader className="pb-3">
                      <div className="flex items-center gap-2">
                        <Brain className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                        <CardTitle className="text-lg">豆包AI 分析结果</CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="prose prose-sm dark:prose-invert max-w-none">
                        <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">
                          {aiResponse.content}
                        </pre>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
