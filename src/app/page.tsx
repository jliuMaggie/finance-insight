'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { RefreshCw, TrendingUp, DollarSign, Brain, ExternalLink, Calendar, MessageSquare, User, Send, Building2, Info, Star, Newspaper, Globe, Link2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { INVESTORS, getInvestorInfo, Investor } from '@/lib/investors';

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
  action: '买入' | '增持' | '减持' | '卖出' | '持仓';
  percentage: number;
  date: string;
  value?: number;
}

interface AIResponse {
  content: string;
  isStreaming: boolean;
}

// 简报查看器组件
function ReportViewer() {
  const [reports, setReports] = useState<any[]>([]);
  const [selectedReport, setSelectedReport] = useState<any>(null);
  const [reportContent, setReportContent] = useState('');
  const [loading, setLoading] = useState(true);

  // 加载简报列表
  useEffect(() => {
    loadReports();
  }, []);

  // 当选择简报时，加载内容
  useEffect(() => {
    if (selectedReport) {
      loadReportContent(selectedReport.filename);
    }
  }, [selectedReport]);

  const loadReports = async () => {
    try {
      const response = await fetch('/api/reports');
      const data = await response.json();
      if (data.success) {
        setReports(data.reports);
        // 默认选择最新的简报
        if (data.reports.length > 0) {
          setSelectedReport(data.reports[0]);
        }
      }
    } catch (error) {
      console.error('Error loading reports:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadReportContent = async (filename: string) => {
    try {
      const response = await fetch(`/api/reports/${filename}`);
      const data = await response.json();
      if (data.success) {
        setReportContent(data.content);
      }
    } catch (error) {
      console.error('Error loading report content:', error);
    }
  };

  // 将 Markdown 转换为简单的 HTML
  const renderMarkdown = (markdown: string) => {
    if (!markdown) return '';
    
    // 简单的 Markdown 转换
    let html = markdown;
    
    // 转换标题
    html = html.replace(/^### (.*$)/gm, '<h3 class="text-lg font-semibold mt-6 mb-3">$1</h3>');
    html = html.replace(/^## (.*$)/gm, '<h2 class="text-xl font-bold mt-8 mb-4 text-blue-600 dark:text-blue-400">$1</h2>');
    html = html.replace(/^# (.*$)/gm, '<h1 class="text-2xl font-bold mb-6">$1</h1>');
    
    // 转换加粗
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold">$1</strong>');
    
    // 转换列表
    html = html.replace(/^- (.*$)/gm, '<li class="ml-4 list-disc mb-1">$1</li>');
    
    // 转换段落
    html = html.replace(/^(?!<[hlu])/gm, '<p class="mb-2">$&</p>');
    
    return html;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2 text-purple-600 dark:text-purple-400" />
          <p className="text-sm text-muted-foreground">正在加载简报...</p>
        </div>
      </div>
    );
  }

  if (reports.length === 0) {
    return (
      <div className="text-center py-12">
        <ExternalLink className="h-12 w-12 mx-auto mb-2 text-muted-foreground/50" />
        <p className="text-muted-foreground">暂无简报</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* 简报列表 */}
      <div className="lg:col-span-1">
        <div className="space-y-2">
          {reports.map((report) => (
            <button
              key={report.filename}
              onClick={() => setSelectedReport(report)}
              className={cn(
                "w-full text-left p-4 rounded-lg border transition-all",
                selectedReport?.filename === report.filename
                  ? "bg-purple-50 dark:bg-purple-950/20 border-purple-500 dark:border-purple-400"
                  : "bg-background hover:bg-slate-50 dark:hover:bg-slate-800/50"
              )}
            >
              <div className="flex items-center justify-between mb-2">
                <Badge
                  variant={report.type === '早报' ? 'default' : 'secondary'}
                  className="text-xs"
                >
                  {report.type}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {report.date}
                </span>
              </div>
              <div className="font-semibold text-sm">
                {report.date} {report.type}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* 简报内容 */}
      <div className="lg:col-span-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ExternalLink className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              {selectedReport?.date} {selectedReport?.type}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[600px]">
              <div
                className="prose prose-sm dark:prose-invert max-w-none"
                dangerouslySetInnerHTML={{ __html: renderMarkdown(reportContent) }}
              />
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function FinanceInsightPage() {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [newsLoading, setNewsLoading] = useState(false); // 初始状态为 false，不自动加载
  const [timeRange, setTimeRange] = useState<'12h' | '24h' | '36h' | '48h'>('24h');
  
  // 前端缓存记忆，记录已加载的数据
  const [newsCache, setNewsCache] = useState<Record<string, NewsItem[]>>({});
  const [lastUpdated, setLastUpdated] = useState<Record<string, string>>({});

  const [holdings, setHoldings] = useState<HoldingChange[]>([]);
  const [holdingsLoading, setHoldingsLoading] = useState(false); // 初始状态为 false，不自动加载
  const [holdingsRefreshing, setHoldingsRefreshing] = useState(false);
  const [holdingsLoaded, setHoldingsLoaded] = useState(false); // 标识是否已加载过

  const [question, setQuestion] = useState('');
  const [aiResponse, setAiResponse] = useState<AIResponse>({ content: '', isStreaming: false });
  const [selectedNewsId, setSelectedNewsId] = useState<string | null>(null);

  // 从配置文件中获取投资者列表
  const investors = INVESTORS.map(inv => inv.name);

  // 页面加载时自动读取缓存数据
  useEffect(() => {
    loadNews();
  }, [timeRange]);

  // 页面加载时自动读取持仓缓存
  useEffect(() => {
    loadHoldings();
  }, []);

  const loadNews = async (forceRefresh = false) => {
    // 如果不是强制刷新且前端缓存中有数据，直接使用
    if (!forceRefresh && newsCache[timeRange] && newsCache[timeRange].length > 0) {
      console.log(`Using cached news for ${timeRange}`);
      setNews(newsCache[timeRange]);
      setNewsLoading(false);
      return;
    }

    try {
      setNewsLoading(true);
      // forceRefresh=true 时跳过后端缓存
      const url = forceRefresh 
        ? `/api/news?timeRange=${timeRange}&refresh=true`
        : `/api/news?timeRange=${timeRange}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to load news');
      const data = await response.json();
      
      // 保存到前端缓存
      if (data.news && data.news.length > 0) {
        setNewsCache(prev => ({ ...prev, [timeRange]: data.news }));
        setLastUpdated(prev => ({ ...prev, [timeRange]: data.lastUpdated }));
      }
      
      setNews(data.news || []);
    } catch (error) {
      console.error('Error loading news:', error);
      setNews([]);
    } finally {
      setNewsLoading(false);
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
      setHoldingsLoaded(true);
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
          <TabsList className="grid w-full grid-cols-5 lg:w-[1000px]">
            <TabsTrigger value="news" className="gap-2">
              <TrendingUp className="h-4 w-4" />
              金融新闻
            </TabsTrigger>
            <TabsTrigger value="reports" className="gap-2">
              <ExternalLink className="h-4 w-4" />
              早晚简报
            </TabsTrigger>
            <TabsTrigger value="holdings" className="gap-2">
              <DollarSign className="h-4 w-4" />
              持仓变动
            </TabsTrigger>
            <TabsTrigger value="media" className="gap-2">
              <Newspaper className="h-4 w-4" />
              媒体导航
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
                      基于豆包AI联网搜索的国内外重大金融新闻
                    </CardDescription>
                  </div>
                  <Button
                    onClick={() => {
                      setNewsLoading(true);
                      loadNews(true);  // 强制刷新，跳过缓存
                    }}
                    disabled={newsLoading}
                    variant="outline"
                    size="sm"
                    className="gap-2"
                  >
                    <RefreshCw className={cn("h-4 w-4", newsLoading && "animate-spin")} />
                    刷新
                  </Button>
                </div>
                {/* 时间段选择器 */}
                <div className="flex items-center gap-2 mt-4">
                  <span className="text-sm text-muted-foreground">查看时段：</span>
                  <div className="flex gap-2">
                    {(['12h', '24h', '36h', '48h'] as const).map((range) => (
                      <button
                        key={range}
                        onClick={() => {
                          setTimeRange(range);
                          // useEffect 会自动触发 loadNews()
                        }}
                        className={cn(
                          "px-3 py-1.5 text-sm rounded-md transition-colors relative",
                          timeRange === range
                            ? "bg-blue-600 text-white hover:bg-blue-700"
                            : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                        )}
                        title={newsCache[range] ? `已缓存 (${lastUpdated[range] ? new Date(lastUpdated[range]).toLocaleTimeString() : ''})` : '点击加载'}
                      >
                        {range}
                        {newsCache[range] && (
                          <span className="absolute -top-1 -right-1 w-2 h-2 bg-green-500 rounded-full" title="已缓存" />
                        )}
                      </button>
                    ))}
                  </div>
                  {lastUpdated[timeRange] && (
                    <Badge variant="outline" className="text-xs ml-2">
                      更新于 {new Date(lastUpdated[timeRange]).toLocaleTimeString()}
                    </Badge>
                  )}
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
                    <p className="text-muted-foreground mb-4">暂无新闻数据</p>
                    <p className="text-sm text-muted-foreground">请点击上方"刷新"按钮获取最新新闻</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {news.map((item, index) => (
                      <a
                        key={item.id}
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block"
                      >
                        <Card className={cn(
                          "transition-all hover:shadow-md cursor-pointer h-full",
                          index < 3 && "border-l-4 border-l-blue-500 dark:border-l-blue-400"
                        )}>
                          <CardContent className="pt-4">
                            <div className="flex items-start gap-3">
                              <div className={cn(
                                "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-bold text-white text-sm",
                                index < 3 ? "bg-blue-600 dark:bg-blue-400" : "bg-slate-600 dark:bg-slate-400"
                              )}>
                                {item.rank}
                              </div>
                              <div className="flex-1 min-w-0">
                                {/* AI总结的标题（主要显示，可点击） */}
                                <h3 className="font-semibold text-base line-clamp-2 hover:text-blue-600 dark:hover:text-blue-400 transition-colors mb-2">
                                  {item.aiTitle}
                                </h3>
                                
                                {/* 原新闻标题（次要显示） */}
                                <p className="text-xs text-muted-foreground mb-2 line-clamp-1">
                                  {item.originalTitle}
                                </p>
                                
                                {/* AI摘要 */}
                                <p className="text-sm text-foreground mb-3 line-clamp-3 leading-relaxed">
                                  {item.summary}
                                </p>
                                
                                {/* 来源和时间 */}
                                <div className="flex items-center gap-2 flex-wrap">
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
                                      {item.importanceScore >= 8 ? '★' : item.importanceScore >= 6 ? '★★' : '★'}
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </a>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Reports Tab - 早晚简报 */}
          <TabsContent value="reports" className="space-y-4">
            <Card>
              <CardHeader>
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <ExternalLink className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                    每日早晚简报
                  </CardTitle>
                  <CardDescription>
                    智能体生成的每日金融市场概览，涵盖宏观要闻、市场动态、政策监管、行业热点
                  </CardDescription>
                </div>
              </CardHeader>
              <CardContent>
                <ReportViewer />
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
                      {INVESTORS.length}位投资大师（含个人与机构）近期持仓变化
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
                    <p className="text-muted-foreground mb-4">暂无持仓数据</p>
                    <p className="text-sm text-muted-foreground">请点击上方"刷新"按钮加载最新持仓变动</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                    {INVESTORS.map((investorInfo) => {
                      const investorHoldings = holdings
                        .filter(h => h.investor === investorInfo.name)
                        // 按时间从近到远排序
                        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

                      return (
                        <Card key={investorInfo.name} className="overflow-hidden flex flex-col h-full">
                          {/* 投资者头部信息 */}
                          <CardHeader className="bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 pb-4">
                            <div className="space-y-3">
                              <div className="flex items-start justify-between">
                                <div className="flex items-center gap-2">
                                  {investorInfo.type === 'institution' ? (
                                    <Building2 className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0" />
                                  ) : (
                                    <User className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0" />
                                  )}
                                  <div>
                                    <CardTitle className="text-lg leading-tight">{investorInfo.name}</CardTitle>
                                    <Badge 
                                      variant={investorInfo.type === 'institution' ? 'default' : 'secondary'}
                                      className="mt-1.5 text-xs"
                                    >
                                      {investorInfo.type === 'institution' ? '投资机构' : '个人投资者'}
                                    </Badge>
                                  </div>
                                </div>
                                {investorHoldings.length > 0 && (
                                  <Badge variant="outline" className="gap-1 text-xs">
                                    <Star className="h-3 w-3" />
                                    {investorHoldings.length} 条
                                  </Badge>
                                )}
                              </div>

                              {/* 投资者详细信息 - 紧凑版 */}
                              <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                                <div className="flex items-start gap-1.5">
                                  <Info className="h-3.5 w-3.5 text-muted-foreground mt-0.5 flex-shrink-0" />
                                  <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
                                    {investorInfo.description}
                                  </p>
                                </div>
                                <div className="grid grid-cols-2 gap-2 mt-2">
                                  <div className="bg-white/50 dark:bg-slate-800/50 rounded-md p-2">
                                    <div className="text-[10px] text-muted-foreground mb-0.5">投资风格</div>
                                    <div className="text-xs font-medium text-blue-600 dark:text-blue-400 line-clamp-1">
                                      {investorInfo.investmentStyle}
                                    </div>
                                  </div>
                                  <div className="bg-white/50 dark:bg-slate-800/50 rounded-md p-2">
                                    <div className="text-[10px] text-muted-foreground mb-0.5">持仓特点</div>
                                    <div className="text-xs font-medium text-purple-600 dark:text-purple-400 line-clamp-1">
                                      {investorInfo.holdingRatio || '动态调整'}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </CardHeader>

                          {/* 持仓变动列表 */}
                          <CardContent className="pt-4 flex-1 flex flex-col">
                            {investorHoldings.length === 0 ? (
                              <div className="flex-1 flex items-center justify-center py-8">
                                <div className="text-center">
                                  <DollarSign className="h-8 w-8 mx-auto mb-2 text-muted-foreground/30" />
                                  <p className="text-sm text-muted-foreground">暂无持仓数据</p>
                                </div>
                              </div>
                            ) : (
                              <ScrollArea className="flex-1 h-[280px]">
                                <div className="space-y-2 pr-2">
                                  {investorHoldings.map((holding, idx) => (
                                    <div
                                      key={idx}
                                      className="flex items-center justify-between p-3 rounded-lg border bg-background hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                                    >
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                          <span className="font-semibold text-sm">{holding.symbol}</span>
                                          <Badge
                                            variant={
                                              holding.action === '买入' || holding.action === '增持' ? 'default' :
                                              holding.action === '减持' || holding.action === '卖出' ? 'destructive' :
                                              'secondary'
                                            }
                                            className="text-[10px] h-5 px-1.5 font-medium"
                                          >
                                            {holding.action}
                                          </Badge>
                                        </div>
                                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                          <Calendar className="h-3 w-3 flex-shrink-0" />
                                          <span className="truncate">{holding.date}</span>
                                          {idx === 0 && (
                                            <Badge variant="outline" className="text-[10px] gap-0.5 ml-auto">
                                              最新
                                            </Badge>
                                          )}
                                        </div>
                                      </div>
                                      <div className="text-right ml-3 flex-shrink-0">
                                        <div className={cn(
                                          "font-bold text-xl leading-none",
                                          holding.action === '持仓' ? 'text-blue-600 dark:text-blue-400' :
                                          (holding.action === '买入' || holding.action === '增持') ? 'text-green-600 dark:text-green-400' : 
                                          'text-red-600 dark:text-red-400'
                                        )}>
                                          {holding.percentage}%
                                        </div>
                                        {holding.value && (
                                          <div className="text-[10px] text-muted-foreground font-medium mt-1">
                                            ${holding.value}M
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </ScrollArea>
                            )}
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Media Navigation Tab */}
          <TabsContent value="media" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Newspaper className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                  财经媒体导航
                </CardTitle>
                <CardDescription>
                  精选国内外高质量经济商业新闻媒体，一站式获取专业财经资讯
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-8">
                {/* 国内媒体 */}
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <Globe className="h-5 w-5 text-red-600 dark:text-red-400" />
                    <h3 className="text-lg font-semibold">国内媒体</h3>
                    <Badge variant="outline" className="text-xs">10家</Badge>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                    {[
                      { name: '虎嗅', url: 'https://www.huxiu.com', desc: '商业科技资讯' },
                      { name: '36氪', url: 'https://36kr.com', desc: '创业投资平台' },
                      { name: '钛媒体', url: 'https://www.tmtpost.com', desc: '科技财经媒体' },
                      { name: '界面新闻', url: 'https://www.jiemian.com', desc: '商业财经新闻' },
                      { name: '财新网', url: 'https://www.caixin.com', desc: '财经新闻门户' },
                      { name: '第一财经', url: 'https://www.yicai.com', desc: '专业财经频道' },
                      { name: '经济观察报', url: 'https://www.eeo.com.cn', desc: '经济类报纸' },
                      { name: '中国经营报', url: 'https://www.cb.com.cn', desc: '经营类报纸' },
                      { name: '21世纪经济报道', url: 'https://www.21jingji.com', desc: '财经报纸' },
                      { name: '华尔街见闻', url: 'https://wallstreetcn.com', desc: '全球财经资讯' },
                    ].map((media) => (
                      <a
                        key={media.name}
                        href={media.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group flex flex-col items-center p-4 rounded-lg border bg-card hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:border-blue-500 dark:hover:border-blue-400 transition-all hover:shadow-md"
                      >
                        <div className="flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-br from-red-500 to-orange-500 text-white font-bold mb-2 group-hover:scale-110 transition-transform">
                          {media.name.charAt(0)}
                        </div>
                        <span className="font-medium text-sm text-center group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                          {media.name}
                        </span>
                        <span className="text-xs text-muted-foreground mt-1 text-center">
                          {media.desc}
                        </span>
                        <Link2 className="h-3 w-3 text-muted-foreground mt-2 group-hover:text-blue-500 transition-colors" />
                      </a>
                    ))}
                  </div>
                </div>

                {/* 国外媒体 */}
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <Globe className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    <h3 className="text-lg font-semibold">国际媒体</h3>
                    <Badge variant="outline" className="text-xs">12家</Badge>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                    {[
                      { name: '华尔街日报 The Wall Street Journal', url: 'https://www.wsj.com', desc: '美国财经报纸' },
                      { name: '金融时报 Financial Times', url: 'https://www.ft.com', desc: '英国财经报纸' },
                      { name: '经济学人 The Economist', url: 'https://www.economist.com', desc: '全球政经周刊' },
                      { name: '彭博社 Bloomberg', url: 'https://www.bloomberg.com', desc: '全球财经资讯' },
                      { name: '路透社 Reuters', url: 'https://www.reuters.com', desc: '国际通讯社' },
                      { name: '福布斯 Forbes', url: 'https://www.forbes.com', desc: '商业财经杂志' },
                      { name: '商业内幕 Business Insider', url: 'https://www.businessinsider.com', desc: '商业新闻网' },
                      { name: '财富 Fortune', url: 'https://www.fortune.com', desc: '商业杂志' },
                      { name: '纽约时报财经 NYTimes Business', url: 'https://www.nytimes.com/section/business', desc: '财经版块' },
                      { name: 'BBC财经 BBC Business', url: 'https://www.bbc.com/news/business', desc: '英国财经' },
                      { name: '日经亚洲 Nikkei Asia', url: 'https://asia.nikkei.com', desc: '日本财经' },
                      { name: 'FT中文网', url: 'https://www.ftchinese.com', desc: '金融时报中文' },
                    ].map((media) => (
                      <a
                        key={media.name}
                        href={media.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group flex flex-col p-4 rounded-lg border bg-card hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:border-blue-500 dark:hover:border-blue-400 transition-all hover:shadow-md"
                      >
                        <div className="flex items-start gap-3">
                          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white font-bold flex-shrink-0 group-hover:scale-110 transition-transform">
                            {media.name.charAt(0)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <span className="font-medium text-sm block group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors line-clamp-2">
                              {media.name}
                            </span>
                            <span className="text-xs text-muted-foreground mt-1 block">
                              {media.desc}
                            </span>
                          </div>
                          <ExternalLink className="h-4 w-4 text-muted-foreground group-hover:text-blue-500 transition-colors flex-shrink-0 mt-1" />
                        </div>
                      </a>
                    ))}
                  </div>
                </div>

                {/* 使用提示 */}
                <Card className="bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800">
                  <CardContent className="pt-4">
                    <div className="flex items-start gap-3">
                      <Info className="h-5 w-5 text-slate-500 mt-0.5" />
                      <div className="text-sm text-muted-foreground">
                        <p className="font-medium text-foreground mb-2">使用提示</p>
                        <ul className="space-y-1 list-disc list-inside">
                          <li>点击媒体卡片即可在新标签页中打开对应网站</li>
                          <li>国内媒体主要为中文内容，国际媒体多为英文内容</li>
                          <li>部分国际媒体可能需要科学上网才能访问</li>
                          <li>建议收藏本页面，随时快速访问常用财经媒体</li>
                        </ul>
                      </div>
                    </div>
                  </CardContent>
                </Card>
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
