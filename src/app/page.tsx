'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { 
  Brain, DollarSign, Newspaper, Globe, Link2, ExternalLink, Info,
  RefreshCw, CheckCircle2, Circle, Loader2, AlertCircle, 
  TrendingUp, BarChart3, Clock, BookOpen, ArrowRight
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { INVESTORS, Investor } from '@/lib/investors';

interface NewsItem {
  title: string;
  url: string;
  source: string;
  publishTime?: string;
  snippet?: string;
}

interface TopicCluster {
  topic: string;
  keywords: string[];
  newsCount: number;
  news: NewsItem[];
  importanceScore: number;
  hotScore?: number;
}

interface HistoricalEvent {
  year: string;
  event: string;
  outcome: string;
  relevance: string;
}

interface AnalysisStep {
  step: number;
  stepName: string;
  status: 'pending' | 'running' | 'completed' | 'error';
  data?: any;
  error?: string;
}

interface AnalysisResult {
  topTopic: TopicCluster;
  allTopics: TopicCluster[];
  historicalAnalysis: {
    topic: string;
    summary: string;
    historicalEvents: HistoricalEvent[];
    marketImpact: string;
    investorAdvice: string;
  };
}

export default function FinanceInsightPage() {
  // 新闻分析状态
  const [analysisSteps, setAnalysisSteps] = useState<AnalysisStep[]>([
    { step: 1, stepName: '爬取新闻', status: 'pending' },
    { step: 2, stepName: '主题归类', status: 'pending' },
    { step: 3, stepName: '热度排序', status: 'pending' },
    { step: 4, stepName: '历史分析', status: 'pending' },
  ]);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  // 持仓状态
  const [holdings, setHoldings] = useState<any[]>([]);
  const [holdingsLoading, setHoldingsLoading] = useState(false);
  const [holdingsLastUpdated, setHoldingsLastUpdated] = useState<string>('');

  // 加载持仓数据
  useEffect(() => {
    loadHoldings();
  }, []);

  const loadHoldings = async () => {
    try {
      setHoldingsLoading(true);
      const response = await fetch('/api/holdings');
      if (!response.ok) throw new Error('Failed to load holdings');
      const data = await response.json();
      setHoldings(data.holdings || []);
      setHoldingsLastUpdated(data.lastUpdated || '');
    } catch (error) {
      console.error('Error loading holdings:', error);
      setHoldings([]);
    } finally {
      setHoldingsLoading(false);
    }
  };

  // 开始新闻分析
  const startAnalysis = async () => {
    setIsAnalyzing(true);
    setAnalysisError(null);
    
    // 重置步骤状态
    setAnalysisSteps([
      { step: 1, stepName: '爬取新闻', status: 'pending' },
      { step: 2, stepName: '主题归类', status: 'pending' },
      { step: 3, stepName: '热度排序', status: 'pending' },
      { step: 4, stepName: '历史分析', status: 'pending' },
    ]);
    setAnalysisResult(null);

    try {
      const response = await fetch('/api/news/analysis', { method: 'POST' });
      const data = await response.json();

      if (data.success) {
        setAnalysisSteps(data.steps);
        setAnalysisResult(data.finalResult);
      } else {
        setAnalysisError(data.error || '分析失败');
        setAnalysisSteps(data.steps);
      }
    } catch (error) {
      console.error('Analysis error:', error);
      setAnalysisError('网络请求失败');
    } finally {
      setIsAnalyzing(false);
    }
  };

  // 计算进度
  const completedSteps = analysisSteps.filter((s) => s.status === 'completed').length;
  const progressPercent = (completedSteps / 4) * 100;

  // 获取步骤图标
  const getStepIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />;
      case 'running':
        return <Loader2 className="h-5 w-5 text-blue-600 dark:text-blue-400 animate-spin" />;
      case 'error':
        return <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />;
      default:
        return <Circle className="h-5 w-5 text-muted-foreground" />;
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
                  智能分析财经热点与历史规律
                </p>
              </div>
            </div>
            <Badge variant="outline" className="gap-1">
              <Clock className="h-3 w-3" />
              每日智能分析
            </Badge>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6">
        <Tabs defaultValue="analysis" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 lg:w-[400px]">
            <TabsTrigger value="analysis" className="gap-2">
              <Brain className="h-4 w-4" />
              智能分析
            </TabsTrigger>
            <TabsTrigger value="holdings" className="gap-2">
              <DollarSign className="h-4 w-4" />
              持仓变动
            </TabsTrigger>
          </TabsList>

          {/* 智能分析 Tab */}
          <TabsContent value="analysis" className="space-y-6">
            {/* 分析控制卡片 */}
            <Card className="border-2 border-blue-200 dark:border-blue-800">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <TrendingUp className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                      财经热点智能分析
                    </CardTitle>
                    <CardDescription>
                      AI驱动的四步分析：爬取 → 归类 → 排序 → 历史回顾
                    </CardDescription>
                  </div>
                  <Button
                    onClick={startAnalysis}
                    disabled={isAnalyzing}
                    className="gap-2 bg-blue-600 hover:bg-blue-700"
                  >
                    {isAnalyzing ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        分析中...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="h-4 w-4" />
                        开始分析
                      </>
                    )}
                  </Button>
                </div>
              </CardHeader>

              {/* 步骤进度 */}
              <CardContent>
                {/* 进度条 */}
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">分析进度</span>
                    <span className="text-sm text-muted-foreground">
                      {completedSteps}/4 步骤完成
                    </span>
                  </div>
                  <Progress value={progressPercent} className="h-2" />
                </div>

                {/* 步骤列表 */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  {analysisSteps.map((step) => (
                    <div
                      key={step.step}
                      className={cn(
                        "flex items-center gap-3 p-3 rounded-lg border transition-all",
                        step.status === 'running' && "bg-blue-50 dark:bg-blue-950/30 border-blue-300 dark:border-blue-700",
                        step.status === 'completed' && "bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800",
                        step.status === 'error' && "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800",
                        step.status === 'pending' && "bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800"
                      )}
                    >
                      {getStepIcon(step.status)}
                      <div className="flex-1 min-w-0">
                        <p className={cn(
                          "text-sm font-medium truncate",
                          step.status === 'completed' && "text-green-700 dark:text-green-400",
                          step.status === 'running' && "text-blue-700 dark:text-blue-400",
                          step.status === 'error' && "text-red-700 dark:text-red-400"
                        )}>
                          步骤{step.step}: {step.stepName}
                        </p>
                        {step.status === 'completed' && step.data && (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {step.step === 1 && `已爬取 ${step.data.totalCount} 条新闻`}
                            {step.step === 2 && `归类为 ${step.data.clustersCount} 个主题`}
                            {step.step === 3 && `共 ${step.data.totalTopics} 个主题`}
                            {step.step === 4 && '分析完成'}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* 错误信息 */}
                {analysisError && (
                  <div className="mt-4 p-3 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800">
                    <p className="text-sm text-red-600 dark:text-red-400 flex items-center gap-2">
                      <AlertCircle className="h-4 w-4" />
                      {analysisError}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* 分析结果展示 */}
            {analysisResult && (
              <>
                {/* 热度排名 TOP 主题 */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <BarChart3 className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                      热度排名 TOP 主题
                    </CardTitle>
                    <CardDescription>
                      基于新闻覆盖量和媒体关注度的综合排名
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {analysisResult.allTopics.slice(0, 10).map((topic, idx) => (
                        <div
                          key={idx}
                          className={cn(
                            "flex items-center gap-4 p-4 rounded-lg border transition-all hover:shadow-md",
                            idx === 0 && "bg-orange-50 dark:bg-orange-950/30 border-orange-200 dark:border-orange-800"
                          )}
                        >
                          <div className={cn(
                            "flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center font-bold text-white",
                            idx === 0 ? "bg-orange-500" : idx === 1 ? "bg-slate-500" : idx === 2 ? "bg-amber-600" : "bg-slate-400"
                          )}>
                            {idx + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="font-semibold text-lg">{topic.topic}</h3>
                              {idx === 0 && (
                                <Badge variant="destructive" className="text-xs animate-pulse">
                                  TOP 1
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-2 flex-wrap">
                              {topic.keywords.map((kw, i) => (
                                <Badge key={i} variant="secondary" className="text-xs">
                                  {kw}
                                </Badge>
                              ))}
                            </div>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                              {topic.newsCount}
                            </div>
                            <div className="text-xs text-muted-foreground">条新闻</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* TOP 1 主题详情 */}
                {analysisResult.topTopic && (
                  <Card className="border-2 border-orange-300 dark:border-orange-700">
                    <CardHeader className="bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-950/30 dark:to-amber-950/30">
                      <CardTitle className="flex items-center gap-2">
                        <TrendingUp className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                        TOP 1 热点：{analysisResult.topTopic.topic}
                      </CardTitle>
                      <CardDescription>
                        共 {analysisResult.topTopic.newsCount} 条相关新闻，覆盖 {analysisResult.topTopic.keywords.join(', ')}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {analysisResult.topTopic.news.map((item: NewsItem, idx: number) => (
                          <a
                            key={idx}
                            href={item.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-start gap-3 p-3 rounded-lg border hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                          >
                            <Badge variant="outline" className="flex-shrink-0 mt-0.5">
                              {item.source}
                            </Badge>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm line-clamp-2 hover:text-blue-600 dark:hover:text-blue-400">
                                {item.title}
                              </p>
                              {item.snippet && (
                                <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                                  {item.snippet}
                                </p>
                              )}
                            </div>
                            <ExternalLink className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                          </a>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* 历史事件分析 */}
                {analysisResult.historicalAnalysis && (
                  <Card className="border-2 border-purple-200 dark:border-purple-800">
                    <CardHeader className="bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-950/30 dark:to-indigo-950/30">
                      <CardTitle className="flex items-center gap-2">
                        <BookOpen className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                        历史事件对比分析
                      </CardTitle>
                      <CardDescription>
                        基于&quot;{analysisResult.topTopic?.topic}&quot;搜索历史类似事件
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6 pt-4">
                      {/* 分析摘要 */}
                      <div className="p-4 rounded-lg bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800">
                        <h4 className="font-semibold mb-2 flex items-center gap-2">
                          <Info className="h-4 w-4" />
                          热点分析
                        </h4>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          {analysisResult.historicalAnalysis.summary}
                        </p>
                      </div>

                      {/* 历史事件时间线 */}
                      {analysisResult.historicalAnalysis.historicalEvents.length > 0 && (
                        <div>
                          <h4 className="font-semibold mb-4 flex items-center gap-2">
                            <Clock className="h-4 w-4" />
                            历史类似事件
                          </h4>
                          <div className="space-y-4">
                            {analysisResult.historicalAnalysis.historicalEvents.map((event, idx) => (
                              <div key={idx} className="flex gap-4">
                                <div className="flex-shrink-0">
                                  <div className="w-16 text-center">
                                    <span className="text-sm font-bold text-purple-600 dark:text-purple-400">
                                      {event.year}
                                    </span>
                                  </div>
                                  <div className="w-px h-full bg-purple-200 dark:bg-purple-800 mt-2" />
                                </div>
                                <div className="flex-1 pb-4">
                                  <p className="font-medium mb-1">{event.event}</p>
                                  <p className="text-sm text-muted-foreground mb-2">
                                    <span className="font-medium">结局：</span>{event.outcome}
                                  </p>
                                  <p className="text-xs text-purple-600 dark:text-purple-400">
                                    与当前相关性：{event.relevance}
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* 市场影响 */}
                      <div className="p-4 rounded-lg bg-slate-100 dark:bg-slate-800/50">
                        <h4 className="font-semibold mb-2 flex items-center gap-2">
                          <TrendingUp className="h-4 w-4" />
                          市场影响分析
                        </h4>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          {analysisResult.historicalAnalysis.marketImpact}
                        </p>
                      </div>

                      {/* 投资者建议 */}
                      <div className="p-4 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800">
                        <h4 className="font-semibold mb-2 flex items-center gap-2 text-green-700 dark:text-green-400">
                          <Brain className="h-4 w-4" />
                          投资者建议
                        </h4>
                        <p className="text-sm leading-relaxed">
                          {analysisResult.historicalAnalysis.investorAdvice}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </>
            )}

            {/* 空状态提示 */}
            {!isAnalyzing && !analysisResult && (
              <Card className="border-dashed">
                <CardContent className="py-16 text-center">
                  <Brain className="h-16 w-16 mx-auto mb-4 text-muted-foreground/50" />
                  <h3 className="text-lg font-medium mb-2">点击上方按钮开始智能分析</h3>
                  <p className="text-sm text-muted-foreground max-w-md mx-auto">
                    系统将自动爬取各大财经媒体新闻，AI智能归类热点主题，
                    并基于历史数据提供投资参考
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* 持仓变动 Tab */}
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
                      {INVESTORS.length}位投资大师近期持仓数据
                    </CardDescription>
                  </div>
                  {holdingsLastUpdated && (
                    <Badge variant="outline" className="text-xs">
                      数据更新于 {holdingsLastUpdated}
                    </Badge>
                  )}
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
                  <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                    {INVESTORS.map((investorInfo) => {
                      const investorHoldings = holdings
                        .filter(h => h.investor === investorInfo.name)
                        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

                      return (
                        <Card key={investorInfo.name} className="overflow-hidden flex flex-col h-full">
                          <CardHeader className="bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 pb-4">
                            <div className="space-y-3">
                              <div className="flex items-start justify-between">
                                <div className="flex items-center gap-2">
                                  {investorInfo.type === 'institution' ? (
                                    <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
                                      <span className="text-sm font-bold text-green-700 dark:text-green-400">
                                        {investorInfo.name.charAt(0)}
                                      </span>
                                    </div>
                                  ) : (
                                    <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                                      <span className="text-sm font-bold text-blue-700 dark:text-blue-400">
                                        {investorInfo.name.charAt(0)}
                                      </span>
                                    </div>
                                  )}
                                  <div>
                                    <CardTitle className="text-lg leading-tight">{investorInfo.name}</CardTitle>
                                    <Badge 
                                      variant={investorInfo.type === 'institution' ? 'default' : 'secondary'}
                                      className="mt-1.5 text-xs"
                                    >
                                      {investorInfo.type === 'institution' ? '机构' : '个人'}
                                    </Badge>
                                  </div>
                                </div>
                                {investorHoldings.length > 0 && (
                                  <Badge variant="outline" className="gap-1 text-xs">
                                    {investorHoldings.length} 条
                                  </Badge>
                                )}
                              </div>
                              {investorInfo.description && (
                                <p className="text-xs text-muted-foreground line-clamp-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                                  {investorInfo.description}
                                </p>
                              )}
                            </div>
                          </CardHeader>
                          <CardContent className="flex-1 pt-4">
                            {investorHoldings.length === 0 ? (
                              <p className="text-sm text-muted-foreground text-center py-4">暂无持仓数据</p>
                            ) : (
                              <div className="space-y-3">
                                {investorHoldings.slice(0, 5).map((holding, idx) => (
                                  <div key={idx} className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-800 last:border-0">
                                    <div className="flex items-center gap-3">
                                      <Badge 
                                        variant={holding.action === '买入' || holding.action === '增持' || holding.action === '持仓' ? 'default' : 'destructive'}
                                        className={cn(
                                          "text-xs font-medium",
                                          holding.action === '买入' || holding.action === '增持' || holding.action === '持仓'
                                            ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300" 
                                            : "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300"
                                        )}
                                      >
                                        {holding.action}
                                      </Badge>
                                      <span className="font-mono font-semibold">{holding.symbol}</span>
                                    </div>
                                    <div className="text-right">
                                      <div className="text-sm font-medium">
                                        {holding.percentage > 0 ? '+' : ''}{holding.percentage}%
                                      </div>
                                      {holding.value && (
                                        <div className="text-xs text-muted-foreground">
                                          ${(holding.value / 1000).toFixed(1)}B
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                ))}
                                {investorHoldings.length > 5 && (
                                  <p className="text-xs text-muted-foreground text-center pt-2">
                                    还有 {investorHoldings.length - 5} 条...
                                  </p>
                                )}
                              </div>
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

          {/* 媒体导航 Tab */}
          <TabsContent value="media" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Newspaper className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                  财经媒体导航
                </CardTitle>
                <CardDescription>
                  精选国内外高质量经济商业新闻媒体
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-8">
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
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
