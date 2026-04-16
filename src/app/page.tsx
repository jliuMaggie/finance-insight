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
  TrendingUp, BarChart3, Clock, BookOpen, ArrowRight, Users, Activity, Network,
  MessageSquare, Scale, Target
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
  assetImpact?: {
    name: string;
    shortTerm: { change: string; duration: string; description: string };
    midTerm: { change: string; duration: string; description: string };
    longTerm: { change: string; duration: string; description: string };
  };
}

interface AnalysisStep {
  step: number;
  stepName: string;
  status: 'pending' | 'running' | 'completed' | 'error';
  duration?: number;
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
  positionTracking?: {
    summary: string;
    investorPositions: any[];
    recentFilings: any[];
    sourceNews?: any[];
  };
  supplyDemandAnalysis?: {
    asset: string;
    affectedAssets: string[];
    summary: string;
    supply: {
      currentStatus: string;
      keyFactors: string[];
      trend: string;
      majorProducers: string[];
    };
    demand: {
      currentStatus: string;
      keyFactors: string[];
      trend: string;
      majorConsumers: string[];
    };
    priceOutlook: string;
    balanceOutlook: string;
    keyFactors: string[];
    sourceNews?: any[];
  };
  chainImpactAnalysis?: {
    asset: string;
    affectedAssets: string[];
    summary: string;
    upstreamImpact: {
      description: string;
      affectedSectors: string[];
      severity: string;
    };
    midstreamImpact: {
      description: string;
      affectedSectors: string[];
      severity: string;
    };
    downstreamImpact: {
      description: string;
      affectedSectors: string[];
      severity: string;
    };
    overallImpact: string;
    regionalImpact: {
      mostAffected: string[];
      description: string;
    };
    keyCompanies: string[];
    investmentImplication: string;
    sourceNews?: any[];
  };
  multiAgentDiscussion?: {
    agents: Array<{
      name: string;
      style: string;
      philosophy: string;
      avatar: string;
      view: string;
    }>;
    discussions: Array<{
      topic: string;
      participants: string[];
      viewpoint1: string;
      viewpoint2: string;
      conclusion: string;
    }>;
    consensus: {
      consensusView: string;
      recommendedAssets: string[];
      positionStrategy: string;
      riskWarning: string;
      actionItems: string[];
    };
    summary: string;
  };
}

interface HistoricalRecord {
  id: string;
  timestamp: number;
  timeLabel: string;
  topTopic: string;
  topTopicCount: number;
  shortTermChange?: string;
  longTermChange?: string;
  data: AnalysisResult;
}

export default function FinanceInsightPage() {
  // 新闻分析状态
  const [analysisSteps, setAnalysisSteps] = useState<AnalysisStep[]>([
    { step: 1, stepName: '爬取新闻', status: 'pending' },
    { step: 2, stepName: '主题归类', status: 'pending' },
    { step: 3, stepName: '热度排序', status: 'pending' },
    { step: 4, stepName: '历史分析', status: 'pending' },
    { step: 5, stepName: '大佬仓位', status: 'pending' },
    { step: 6, stepName: '供需分析', status: 'pending' },
    { step: 7, stepName: '产业链分析', status: 'pending' },
    { step: 8, stepName: 'Agent讨论', status: 'pending' },
  ]);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  // 持仓状态
  const [holdings, setHoldings] = useState<any[]>([]);
  const [holdingsLoading, setHoldingsLoading] = useState(false);
  const [holdingsLastUpdated, setHoldingsLastUpdated] = useState<string>('');

  // 历史分析记录
  const [historicalRecords, setHistoricalRecords] = useState<HistoricalRecord[]>([]);
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);

  // 加载历史记录
  useEffect(() => {
    const saved = localStorage.getItem('analysisHistory');
    if (saved) {
      try {
        const records = JSON.parse(saved);
        setHistoricalRecords(records);
        if (records.length > 0) {
          setSelectedRecordId(records[0].id);
        }
      } catch (e) {
        console.error('Failed to load history:', e);
      }
    }
  }, []);

  // 保存历史记录
  const saveToHistory = (result: AnalysisResult) => {
    const now = new Date();
    const timeLabel = `${now.getMonth() + 1}月${now.getDate()}日 ${now.getHours()}点`;
    const record: HistoricalRecord = {
      id: `record_${now.getTime()}`,
      timestamp: now.getTime(),
      timeLabel,
      topTopic: result.topTopic?.topic || '无',
      topTopicCount: result.topTopic?.newsCount || 0,
      shortTermChange: result.historicalAnalysis?.historicalEvents?.[0]?.assetImpact?.shortTerm?.change,
      longTermChange: result.historicalAnalysis?.historicalEvents?.[0]?.assetImpact?.longTerm?.change,
      data: result,
    };

    setHistoricalRecords(prev => {
      const updated = [record, ...prev].slice(0, 10); // 保留最近10条
      localStorage.setItem('analysisHistory', JSON.stringify(updated));
      return updated;
    });
    setSelectedRecordId(record.id);
  };

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

  // 开始新闻分析（流式）
  const startAnalysis = async () => {
    setIsAnalyzing(true);
    setAnalysisError(null);
    
    // 重置步骤状态
    setAnalysisSteps([
      { step: 1, stepName: '搜索热点新闻', status: 'pending', duration: 0 },
      { step: 2, stepName: '主题归类', status: 'pending', duration: 0 },
      { step: 3, stepName: '热度排序', status: 'pending', duration: 0 },
      { step: 4, stepName: '深度分析', status: 'pending', duration: 0 },
      { step: 5, stepName: '大佬仓位', status: 'pending', duration: 0 },
      { step: 6, stepName: '供需分析', status: 'pending', duration: 0 },
      { step: 7, stepName: '产业链分析', status: 'pending', duration: 0 },
      { step: 8, stepName: 'Agent讨论', status: 'pending', duration: 0 },
    ]);
    setAnalysisResult(null);

    try {
      const response = await fetch('/api/news/analysis', { method: 'POST' });
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) throw new Error('无法读取响应');

      let buffer = '';
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              
              if (data.type === 'final') {
                // 所有步骤完成，渲染最终结果
                setAnalysisSteps(prev => prev.map(s => ({ ...s, status: 'completed' })));
                setAnalysisResult(data.finalResult);
                // 保存到历史记录
                saveToHistory(data.finalResult);
                setIsAnalyzing(false);
                return;
              }
              
              if (data.type === 'error') {
                setAnalysisError(data.error);
                setIsAnalyzing(false);
                return;
              }

              // 更新步骤进度
              if (data.step && data.status) {
                setAnalysisSteps(prev => {
                  const newSteps = [...prev];
                  const stepIndex = newSteps.findIndex(s => s.step === data.step);
                  if (stepIndex !== -1) {
                    newSteps[stepIndex] = {
                      ...newSteps[stepIndex],
                      status: data.status,
                      duration: data.duration,
                      data: data.data,
                    };
                  }
                  return newSteps;
                });
              }
            } catch (e) {
              console.error('Parse SSE error:', e);
            }
          }
        }
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
  const progressPercent = (completedSteps / 5) * 100;

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

  // 生成迷你柱状图
  const generateMiniBar = (change: string, period: string) => {
    const changeNum = parseFloat(change.replace(/[+%]/g, '')) || 0;
    const bars = [];
    const barCount = 5;
    
    // 根据变化幅度计算柱状图高度
    for (let i = 0; i < barCount; i++) {
      const baseHeight = 10;
      const variance = Math.abs(changeNum) / barCount;
      const height = baseHeight + variance * (i + 1);
      const maxHeight = 40;
      const finalHeight = Math.min(height, maxHeight);
      
      const colorClass = change.startsWith('+') 
        ? (period === 'short' ? 'bg-red-400' : period === 'mid' ? 'bg-amber-400' : 'bg-blue-400')
        : (period === 'short' ? 'bg-green-400' : period === 'mid' ? 'bg-emerald-400' : 'bg-cyan-400');
      
      bars.push(
        <div 
          key={i}
          className={cn("w-3 rounded-t transition-all", colorClass)}
          style={{ height: `${finalHeight}px` }}
        />
      );
    }
    return bars;
  };

  // 历史版本详情组件
  const VersionDetail = ({ record }: { record?: HistoricalRecord }) => {
    if (!record) return null;
    const displayData = record.data;
    const events = displayData.historicalAnalysis?.historicalEvents || [];
    
    return (
      <>
        {/* 分析概览 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center p-3 rounded-lg bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800">
            <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
              {displayData.topTopic?.newsCount || 0}
            </div>
            <div className="text-xs text-muted-foreground">相关新闻</div>
          </div>
          <div className="text-center p-3 rounded-lg bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800">
            <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
              {events.length}
            </div>
            <div className="text-xs text-muted-foreground">历史事件</div>
          </div>
          <div className="text-center p-3 rounded-lg bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800">
            <div className="text-2xl font-bold text-rose-600 dark:text-rose-400">
              {events[0]?.assetImpact?.shortTerm?.change || 'N/A'}
            </div>
            <div className="text-xs text-muted-foreground">首个短期影响</div>
          </div>
          <div className="text-center p-3 rounded-lg bg-cyan-50 dark:bg-cyan-950/30 border border-cyan-200 dark:border-cyan-800">
            <div className="text-2xl font-bold text-cyan-600 dark:text-cyan-400">
              {events[0]?.assetImpact?.longTerm?.change || 'N/A'}
            </div>
            <div className="text-xs text-muted-foreground">首个长期影响</div>
          </div>
        </div>

        {/* 所有历史事件详情 */}
        <div className="space-y-4">
          {events.map((event, eventIdx) => (
            <div key={eventIdx} className="p-4 rounded-lg bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
              {/* 事件标题 */}
              <div className="flex items-start gap-3 mb-4">
                <div className="flex-shrink-0 w-16 h-16 rounded-lg bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center">
                  <span className="text-white font-bold text-lg">{event.year}</span>
                </div>
                <div className="flex-1">
                  <h5 className="font-semibold text-base">{event.event}</h5>
                  <p className="text-sm text-muted-foreground mt-1">
                    <span className="font-medium">结局：</span>{event.outcome}
                  </p>
                  <p className="text-xs text-purple-600 dark:text-purple-400 mt-1">
                    <span className="font-medium">与当前相关性：</span>{event.relevance}
                  </p>
                </div>
              </div>

              {/* 资产影响详情 */}
              {event.assetImpact && (
                <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700">
                  <h6 className="font-semibold text-sm mb-3 flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-orange-600" />
                    {event.assetImpact.name} 资产变化详情
                  </h6>
                  
                  {/* 短期/中期/长期三个阶段 */}
                  <div className="space-y-3">
                    {/* 短期 */}
                    <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-red-700 dark:text-red-400">短期影响 (1个月内)</span>
                        <span className={cn(
                          "text-xl font-bold",
                          event.assetImpact.shortTerm.change.startsWith('+') ? "text-red-600" : "text-green-600"
                        )}>
                          {event.assetImpact.shortTerm.change}
                        </span>
                      </div>
                      <div className="w-full bg-red-200 dark:bg-red-900/50 rounded-full h-3 mb-2">
                        <div 
                          className={cn(
                            "h-3 rounded-full",
                            event.assetImpact.shortTerm.change.startsWith('+') ? "bg-red-500" : "bg-green-500"
                          )}
                          style={{ 
                            width: `${Math.min(Math.abs(parseFloat(event.assetImpact.shortTerm.change)) * 3, 100)}%` 
                          }}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">{event.assetImpact.shortTerm.description}</p>
                    </div>

                    {/* 中期 */}
                    <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-amber-700 dark:text-amber-400">中期影响 (6个月内)</span>
                        <span className={cn(
                          "text-xl font-bold",
                          event.assetImpact.midTerm.change.startsWith('+') ? "text-amber-600" : "text-emerald-600"
                        )}>
                          {event.assetImpact.midTerm.change}
                        </span>
                      </div>
                      <div className="w-full bg-amber-200 dark:bg-amber-900/50 rounded-full h-3 mb-2">
                        <div 
                          className={cn(
                            "h-3 rounded-full",
                            event.assetImpact.midTerm.change.startsWith('+') ? "bg-amber-500" : "bg-emerald-500"
                          )}
                          style={{ 
                            width: `${Math.min(Math.abs(parseFloat(event.assetImpact.midTerm.change)) * 3, 100)}%` 
                          }}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">{event.assetImpact.midTerm.description}</p>
                    </div>

                    {/* 长期 */}
                    <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-blue-700 dark:text-blue-400">长期影响 (2年内)</span>
                        <span className={cn(
                          "text-xl font-bold",
                          event.assetImpact.longTerm.change.startsWith('+') ? "text-blue-600" : "text-cyan-600"
                        )}>
                          {event.assetImpact.longTerm.change}
                        </span>
                      </div>
                      <div className="w-full bg-blue-200 dark:bg-blue-900/50 rounded-full h-3 mb-2">
                        <div 
                          className={cn(
                            "h-3 rounded-full",
                            event.assetImpact.longTerm.change.startsWith('+') ? "bg-blue-500" : "bg-cyan-500"
                          )}
                          style={{ 
                            width: `${Math.min(Math.abs(parseFloat(event.assetImpact.longTerm.change)) * 3, 100)}%` 
                          }}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">{event.assetImpact.longTerm.description}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* 市场影响 */}
        {displayData.historicalAnalysis?.marketImpact && (
          <div className="p-4 rounded-lg bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-950/30 dark:to-cyan-950/30 border border-blue-200 dark:border-blue-800">
            <h5 className="font-semibold text-sm mb-2 flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-blue-600" />
              市场影响分析
            </h5>
            <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
              {displayData.historicalAnalysis.marketImpact}
            </p>
          </div>
        )}

        {/* 分析摘要 */}
        <div className="p-4 rounded-lg bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-950/30 dark:to-purple-950/30 border border-indigo-200 dark:border-indigo-800">
          <h5 className="font-semibold text-sm mb-2 flex items-center gap-2">
            <Info className="h-4 w-4" />
            分析摘要
          </h5>
          <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
            {displayData.historicalAnalysis?.summary}
          </p>
        </div>

        {/* 投资者建议 */}
        {displayData.historicalAnalysis?.investorAdvice && (
          <div className="p-4 rounded-lg bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30 border border-green-200 dark:border-green-800">
            <h5 className="font-semibold text-sm mb-2 flex items-center gap-2">
              <Brain className="h-4 w-4 text-green-600" />
              投资者建议
            </h5>
            <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
              {displayData.historicalAnalysis.investorAdvice}
            </p>
          </div>
        )}

        {/* 大佬仓位追踪 */}
        {displayData.positionTracking && (
          <div className="space-y-4">
            <div className="p-4 rounded-lg bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 border border-amber-200 dark:border-amber-800">
              <h5 className="font-semibold text-sm mb-2 flex items-center gap-2">
                <Users className="h-4 w-4 text-amber-600" />
                大佬仓位追踪
              </h5>
              <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
                {displayData.positionTracking.summary}
              </p>
            </div>

            {/* 投资者仓位列表 */}
            {displayData.positionTracking.investorPositions && displayData.positionTracking.investorPositions.length > 0 && (
              <div className="space-y-2">
                <h6 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">机构仓位变化</h6>
                {displayData.positionTracking.investorPositions.map((inv: any, idx: number) => (
                  <div key={idx} className="p-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-sm">{inv.investorName}</span>
                          <Badge 
                            variant="outline" 
                            className={cn(
                              "text-xs",
                              inv.position === '多头' ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" :
                              inv.position === '空头' ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" :
                              "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400"
                            )}
                          >
                            {inv.position}
                          </Badge>
                          <Badge variant="secondary" className="text-xs">
                            {inv.action}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-2">{inv.reason}</p>
                        {inv.asset && (
                          <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                            相关资产: {inv.asset}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* 原始新闻来源 */}
            {displayData.positionTracking.sourceNews && displayData.positionTracking.sourceNews.length > 0 && (
              <div className="space-y-2">
                <h6 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">信息来源</h6>
                <div className="space-y-1">
                  {displayData.positionTracking.sourceNews.slice(0, 3).map((news: any, idx: number) => (
                    <a 
                      key={idx}
                      href={news.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block p-2 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                    >
                      <p className="text-xs font-medium line-clamp-1">{news.title}</p>
                      <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{news.snippet}</p>
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* 供需分析 */}
        {displayData.supplyDemandAnalysis && (
          <div className="p-4 rounded-lg bg-teal-50 dark:bg-teal-950/20 border border-teal-200 dark:border-teal-800">
            <h5 className="font-semibold text-sm mb-2 flex items-center gap-2">
              <Activity className="h-4 w-4 text-teal-600" />
              供需关系分析 - {displayData.supplyDemandAnalysis.asset}
            </h5>
            <p className="text-sm text-muted-foreground mb-2">
              {displayData.supplyDemandAnalysis.summary}
            </p>
            {displayData.supplyDemandAnalysis.supply && displayData.supplyDemandAnalysis.demand && (
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2 rounded bg-blue-100/50 dark:bg-blue-900/30">
                  <span className="font-medium">供应趋势：</span>{displayData.supplyDemandAnalysis.supply.trend}
                </div>
                <div className="p-2 rounded bg-orange-100/50 dark:bg-orange-900/30">
                  <span className="font-medium">需求趋势：</span>{displayData.supplyDemandAnalysis.demand.trend}
                </div>
              </div>
            )}
            {displayData.supplyDemandAnalysis.priceOutlook && (
              <p className="text-xs text-muted-foreground mt-2">
                价格展望：{displayData.supplyDemandAnalysis.priceOutlook}
              </p>
            )}
          </div>
        )}

        {/* 产业链分析 */}
        {displayData.chainImpactAnalysis && (
          <div className="p-4 rounded-lg bg-violet-50 dark:bg-violet-950/20 border border-violet-200 dark:border-violet-800">
            <h5 className="font-semibold text-sm mb-2 flex items-center gap-2">
              <Network className="h-4 w-4 text-violet-600" />
              产业链冲击 - {displayData.chainImpactAnalysis.asset}
            </h5>
            <p className="text-sm text-muted-foreground mb-2">
              {displayData.chainImpactAnalysis.summary}
            </p>
            {displayData.chainImpactAnalysis.overallImpact && (
              <Badge 
                variant="outline" 
                className={cn(
                  "text-xs",
                  displayData.chainImpactAnalysis.overallImpact.includes('严重') ? "bg-red-100 text-red-700" :
                  displayData.chainImpactAnalysis.overallImpact.includes('分化') ? "bg-yellow-100 text-yellow-700" :
                  "bg-green-100 text-green-700"
                )}
              >
                {displayData.chainImpactAnalysis.overallImpact}
              </Badge>
            )}
          </div>
        )}

        {/* Agent讨论 */}
        {displayData.multiAgentDiscussion && (
          <div className="p-4 rounded-lg bg-pink-50 dark:bg-pink-950/20 border border-pink-200 dark:border-pink-800">
            <h5 className="font-semibold text-sm mb-2 flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-pink-600" />
              Agent投资讨论
            </h5>
            <p className="text-sm text-muted-foreground mb-2">
              {displayData.multiAgentDiscussion.consensus?.consensusView || '讨论进行中...'}
            </p>
            {displayData.multiAgentDiscussion.consensus?.recommendedAssets && displayData.multiAgentDiscussion.consensus.recommendedAssets.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {displayData.multiAgentDiscussion.consensus.recommendedAssets.slice(0, 3).map((asset, idx) => (
                  <Badge key={idx} variant="outline" className="text-xs bg-pink-100/50 dark:bg-pink-900/30">
                    {asset}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        )}
      </>
    );
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
                  财经热点与历史规律分析
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
          <TabsList className="grid w-full grid-cols-3 lg:w-[600px]">
            <TabsTrigger value="analysis" className="gap-2">
              <Brain className="h-4 w-4" />
              财经热点
            </TabsTrigger>
            <TabsTrigger value="holdings" className="gap-2">
              <DollarSign className="h-4 w-4" />
              持仓变动
            </TabsTrigger>
            <TabsTrigger value="media" className="gap-2">
              <Newspaper className="h-4 w-4" />
              媒体导航
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
                      AI驱动的八步分析：爬取 → 归类 → 排序 → 历史回顾 → 大佬仓位 → 供需分析 → 产业链 → Agent讨论
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
                      {completedSteps}/{analysisSteps.length} 步骤完成
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
                            {step.step === 3 && `共 ${step.data.allTopics?.length || 0} 个主题待排序`}
                            {step.step === 4 && '分析完成'}
                            {step.duration && (
                              <span className="ml-2 text-green-600 dark:text-green-400">
                                ({Math.round(step.duration / 1000)}s)
                              </span>
                            )}
                          </p>
                        )}
                        {step.status === 'running' && (
                          <p className="text-xs text-blue-600 dark:text-blue-400 mt-0.5">
                            处理中...</p>
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
                            历史类似事件及资产影响
                          </h4>
                          <div className="space-y-6">
                            {analysisResult.historicalAnalysis.historicalEvents.map((event, idx) => (
                              <div key={idx} className="p-4 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                                <div className="flex gap-4 mb-4">
                                  <div className="flex-shrink-0">
                                    <span className="text-lg font-bold text-purple-600 dark:text-purple-400">
                                      {event.year}
                                    </span>
                                  </div>
                                  <div className="flex-1">
                                    <p className="font-medium mb-1">{event.event}</p>
                                    <p className="text-sm text-muted-foreground mb-1">
                                      <span className="font-medium">结局：</span>{event.outcome}
                                    </p>
                                    <p className="text-xs text-purple-600 dark:text-purple-400">
                                      与当前相关性：{event.relevance}
                                    </p>
                                  </div>
                                </div>
                                
                                {/* 资产变化图表 */}
                                {event.assetImpact && (
                                  <div className="mt-4 p-4 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-600">
                                    <h5 className="font-semibold text-sm mb-3 flex items-center gap-2">
                                      <BarChart3 className="h-4 w-4 text-orange-600" />
                                      {event.assetImpact.name} 资产变化
                                    </h5>
                                    <div className="grid grid-cols-3 gap-4">
                                      {/* 短期 */}
                                      <div className="text-center p-3 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800">
                                        <div className="text-xs text-muted-foreground mb-1">短期</div>
                                        <div className="text-xs text-muted-foreground mb-1">({event.assetImpact.shortTerm.duration})</div>
                                        <div className={cn(
                                          "text-xl font-bold",
                                          event.assetImpact.shortTerm.change.startsWith('+') ? "text-red-600" : "text-green-600"
                                        )}>
                                          {event.assetImpact.shortTerm.change}
                                        </div>
                                        <div className="text-xs text-muted-foreground mt-1 line-clamp-2">
                                          {event.assetImpact.shortTerm.description}
                                        </div>
                                        {/* 迷你柱状图 */}
                                        <div className="mt-2 flex items-end justify-center gap-1 h-12">
                                          {generateMiniBar(event.assetImpact.shortTerm.change, 'short')}
                                        </div>
                                      </div>
                                      
                                      {/* 中期 */}
                                      <div className="text-center p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                                        <div className="text-xs text-muted-foreground mb-1">中期</div>
                                        <div className="text-xs text-muted-foreground mb-1">({event.assetImpact.midTerm.duration})</div>
                                        <div className={cn(
                                          "text-xl font-bold",
                                          event.assetImpact.midTerm.change.startsWith('+') ? "text-amber-600" : "text-emerald-600"
                                        )}>
                                          {event.assetImpact.midTerm.change}
                                        </div>
                                        <div className="text-xs text-muted-foreground mt-1 line-clamp-2">
                                          {event.assetImpact.midTerm.description}
                                        </div>
                                        {/* 迷你柱状图 */}
                                        <div className="mt-2 flex items-end justify-center gap-1 h-12">
                                          {generateMiniBar(event.assetImpact.midTerm.change, 'mid')}
                                        </div>
                                      </div>
                                      
                                      {/* 长期 */}
                                      <div className="text-center p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
                                        <div className="text-xs text-muted-foreground mb-1">长期</div>
                                        <div className="text-xs text-muted-foreground mb-1">({event.assetImpact.longTerm.duration})</div>
                                        <div className={cn(
                                          "text-xl font-bold",
                                          event.assetImpact.longTerm.change.startsWith('+') ? "text-blue-600" : "text-cyan-600"
                                        )}>
                                          {event.assetImpact.longTerm.change}
                                        </div>
                                        <div className="text-xs text-muted-foreground mt-1 line-clamp-2">
                                          {event.assetImpact.longTerm.description}
                                        </div>
                                        {/* 迷你柱状图 */}
                                        <div className="mt-2 flex items-end justify-center gap-1 h-12">
                                          {generateMiniBar(event.assetImpact.longTerm.change, 'long')}
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                )}
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

                {/* 大佬仓位追踪 */}
                {analysisResult.positionTracking && (
                  <Card className="border-2 border-amber-200 dark:border-amber-800">
                    <CardHeader className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30">
                      <CardTitle className="flex items-center gap-2">
                        <Users className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                        大佬仓位追踪
                      </CardTitle>
                      <CardDescription>
                        近期知名投资人和机构的仓位变化
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4 pt-4">
                      {/* 概述 */}
                      <div className="p-4 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          {analysisResult.positionTracking.summary}
                        </p>
                      </div>

                      {/* 投资者仓位列表 */}
                      {analysisResult.positionTracking.investorPositions && analysisResult.positionTracking.investorPositions.length > 0 && (
                        <div>
                          <h4 className="font-semibold mb-3 flex items-center gap-2">
                            <BarChart3 className="h-4 w-4" />
                            机构仓位变化
                          </h4>
                          <div className="space-y-3">
                            {analysisResult.positionTracking.investorPositions.map((inv: any, idx: number) => (
                              <div key={idx} className="p-4 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                                <div className="flex items-start justify-between gap-4">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-2">
                                      <span className="font-semibold">{inv.investorName}</span>
                                      <Badge 
                                        variant="outline" 
                                        className={cn(
                                          inv.position === '多头' ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" :
                                          inv.position === '空头' ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" :
                                          "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400"
                                        )}
                                      >
                                        {inv.position}
                                      </Badge>
                                      <Badge variant="secondary">
                                        {inv.action}
                                      </Badge>
                                    </div>
                                    <p className="text-sm text-muted-foreground mb-2">{inv.reason}</p>
                                    {inv.asset && (
                                      <p className="text-xs text-blue-600 dark:text-blue-400">
                                        相关资产: {inv.asset}
                                      </p>
                                    )}
                                    {inv.newsDate && (
                                      <p className="text-xs text-muted-foreground mt-1">
                                        新闻日期: {inv.newsDate}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* 信息来源 */}
                      {analysisResult.positionTracking.sourceNews && analysisResult.positionTracking.sourceNews.length > 0 && (
                        <div>
                          <h4 className="font-semibold mb-3 flex items-center gap-2">
                            <ExternalLink className="h-4 w-4" />
                            信息来源
                          </h4>
                          <div className="space-y-2">
                            {analysisResult.positionTracking.sourceNews.slice(0, 5).map((news: any, idx: number) => (
                              <a 
                                key={idx}
                                href={news.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-start gap-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors"
                              >
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium line-clamp-1">{news.title}</p>
                                  <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{news.snippet}</p>
                                </div>
                                <ExternalLink className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                              </a>
                            ))}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* 供需关系分析 */}
                {analysisResult.supplyDemandAnalysis && (
                  <Card className="border-2 border-teal-200 dark:border-teal-800">
                    <CardHeader className="bg-gradient-to-r from-teal-50 to-cyan-50 dark:from-teal-950/30 dark:to-cyan-950/30">
                      <CardTitle className="flex items-center gap-2">
                        <Activity className="h-5 w-5 text-teal-600 dark:text-teal-400" />
                        供需关系分析
                      </CardTitle>
                      <CardDescription>
                        {analysisResult.supplyDemandAnalysis.asset}市场供需状况
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4 pt-4">
                      {/* 概述 */}
                      <div className="p-4 rounded-lg bg-teal-50 dark:bg-teal-950/30 border border-teal-200 dark:border-teal-800">
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          {analysisResult.supplyDemandAnalysis.summary}
                        </p>
                      </div>

                      {/* 供应与需求对比 */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* 供应侧 */}
                        {analysisResult.supplyDemandAnalysis.supply && (
                          <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
                            <h4 className="font-semibold mb-3 flex items-center gap-2">
                              <TrendingUp className="h-4 w-4 text-blue-600" />
                              供应侧
                              <Badge variant="outline" className="ml-auto">
                                {analysisResult.supplyDemandAnalysis.supply.trend}
                              </Badge>
                            </h4>
                            <p className="text-sm text-muted-foreground mb-3">
                              {analysisResult.supplyDemandAnalysis.supply.currentStatus}
                            </p>
                            {analysisResult.supplyDemandAnalysis.supply.keyFactors.length > 0 && (
                              <div className="space-y-1">
                                <p className="text-xs font-medium text-muted-foreground">关键因素：</p>
                                {analysisResult.supplyDemandAnalysis.supply.keyFactors.map((factor, idx) => (
                                  <p key={idx} className="text-xs text-muted-foreground flex items-start gap-1">
                                    <span className="text-blue-500">•</span>
                                    {factor}
                                  </p>
                                ))}
                              </div>
                            )}
                            {analysisResult.supplyDemandAnalysis.supply.majorProducers.length > 0 && (
                              <div className="mt-2">
                                <p className="text-xs font-medium text-muted-foreground">主要生产方：</p>
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {analysisResult.supplyDemandAnalysis.supply.majorProducers.map((p, idx) => (
                                    <Badge key={idx} variant="secondary" className="text-xs">
                                      {p}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        {/* 需求侧 */}
                        {analysisResult.supplyDemandAnalysis.demand && (
                          <div className="p-4 rounded-lg bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800">
                            <h4 className="font-semibold mb-3 flex items-center gap-2">
                              <BarChart3 className="h-4 w-4 text-orange-600" />
                              需求侧
                              <Badge variant="outline" className="ml-auto">
                                {analysisResult.supplyDemandAnalysis.demand.trend}
                              </Badge>
                            </h4>
                            <p className="text-sm text-muted-foreground mb-3">
                              {analysisResult.supplyDemandAnalysis.demand.currentStatus}
                            </p>
                            {analysisResult.supplyDemandAnalysis.demand.keyFactors.length > 0 && (
                              <div className="space-y-1">
                                <p className="text-xs font-medium text-muted-foreground">关键因素：</p>
                                {analysisResult.supplyDemandAnalysis.demand.keyFactors.map((factor, idx) => (
                                  <p key={idx} className="text-xs text-muted-foreground flex items-start gap-1">
                                    <span className="text-orange-500">•</span>
                                    {factor}
                                  </p>
                                ))}
                              </div>
                            )}
                            {analysisResult.supplyDemandAnalysis.demand.majorConsumers.length > 0 && (
                              <div className="mt-2">
                                <p className="text-xs font-medium text-muted-foreground">主要消费方：</p>
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {analysisResult.supplyDemandAnalysis.demand.majorConsumers.map((c, idx) => (
                                    <Badge key={idx} variant="secondary" className="text-xs">
                                      {c}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* 价格展望 */}
                      {analysisResult.supplyDemandAnalysis.priceOutlook && (
                        <div className="p-4 rounded-lg bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-950/30 dark:to-pink-950/30 border border-purple-200 dark:border-purple-800">
                          <h4 className="font-semibold mb-2 flex items-center gap-2">
                            <Activity className="h-4 w-4 text-purple-600" />
                            价格展望
                          </h4>
                          <div className="flex items-center gap-2">
                            <Badge 
                              variant="outline" 
                              className={cn(
                                "text-sm",
                                analysisResult.supplyDemandAnalysis.priceOutlook.includes('涨') ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" :
                                analysisResult.supplyDemandAnalysis.priceOutlook.includes('跌') ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" :
                                "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400"
                              )}
                            >
                              {analysisResult.supplyDemandAnalysis.priceOutlook}
                            </Badge>
                            {analysisResult.supplyDemandAnalysis.balanceOutlook && (
                              <span className="text-sm text-muted-foreground">
                                {analysisResult.supplyDemandAnalysis.balanceOutlook}
                              </span>
                            )}
                          </div>
                        </div>
                      )}

                      {/* 关键影响因素 */}
                      {analysisResult.supplyDemandAnalysis.keyFactors && analysisResult.supplyDemandAnalysis.keyFactors.length > 0 && (
                        <div>
                          <h4 className="font-semibold mb-2 text-sm">关键影响因素</h4>
                          <div className="space-y-1">
                            {analysisResult.supplyDemandAnalysis.keyFactors.slice(0, 5).map((factor, idx) => (
                              <div key={idx} className="flex items-start gap-2 text-xs">
                                <Badge variant="outline" className="flex-shrink-0 h-5">
                                  {idx + 1}
                                </Badge>
                                <span className="text-muted-foreground">{factor}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* 信息来源 */}
                      {analysisResult.supplyDemandAnalysis.sourceNews && analysisResult.supplyDemandAnalysis.sourceNews.length > 0 && (
                        <div>
                          <h4 className="font-semibold mb-3 flex items-center gap-2">
                            <ExternalLink className="h-4 w-4" />
                            信息来源
                          </h4>
                          <div className="space-y-2">
                            {analysisResult.supplyDemandAnalysis.sourceNews.slice(0, 4).map((news: any, idx: number) => (
                              <a 
                                key={idx}
                                href={news.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-start gap-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors"
                              >
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium line-clamp-1">{news.title}</p>
                                  <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{news.snippet}</p>
                                </div>
                                <ExternalLink className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                              </a>
                            ))}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* 产业链冲击分析 */}
                {analysisResult.chainImpactAnalysis && (
                  <Card className="border-2 border-violet-200 dark:border-violet-800">
                    <CardHeader className="bg-gradient-to-r from-violet-50 to-purple-50 dark:from-violet-950/30 dark:to-purple-950/30">
                      <CardTitle className="flex items-center gap-2">
                        <Network className="h-5 w-5 text-violet-600 dark:text-violet-400" />
                        产业链冲击分析
                      </CardTitle>
                      <CardDescription>
                        {analysisResult.chainImpactAnalysis.asset}及相关产业链影响
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4 pt-4">
                      {/* 概述 */}
                      <div className="p-4 rounded-lg bg-violet-50 dark:bg-violet-950/30 border border-violet-200 dark:border-violet-800">
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          {analysisResult.chainImpactAnalysis.summary}
                        </p>
                      </div>

                      {/* 上中下游冲击 */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* 上游 */}
                        {analysisResult.chainImpactAnalysis.upstreamImpact && (
                          <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
                            <h4 className="font-semibold mb-2 flex items-center gap-2">
                              <TrendingUp className="h-4 w-4 text-blue-600" />
                              上游产业
                              <Badge 
                                variant="outline" 
                                className={cn(
                                  "ml-auto text-xs",
                                  analysisResult.chainImpactAnalysis.upstreamImpact.severity === '严重' ? "bg-red-100 text-red-700" :
                                  analysisResult.chainImpactAnalysis.upstreamImpact.severity === '中等' ? "bg-yellow-100 text-yellow-700" :
                                  "bg-green-100 text-green-700"
                                )}
                              >
                                {analysisResult.chainImpactAnalysis.upstreamImpact.severity}
                              </Badge>
                            </h4>
                            <p className="text-sm text-muted-foreground mb-2">
                              {analysisResult.chainImpactAnalysis.upstreamImpact.description}
                            </p>
                            {analysisResult.chainImpactAnalysis.upstreamImpact.affectedSectors.length > 0 && (
                              <div className="flex flex-wrap gap-1">
                                {analysisResult.chainImpactAnalysis.upstreamImpact.affectedSectors.map((sector, idx) => (
                                  <Badge key={idx} variant="secondary" className="text-xs">
                                    {sector}
                                  </Badge>
                                ))}
                              </div>
                            )}
                          </div>
                        )}

                        {/* 中游 */}
                        {analysisResult.chainImpactAnalysis.midstreamImpact && (
                          <div className="p-4 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                            <h4 className="font-semibold mb-2 flex items-center gap-2">
                              <BarChart3 className="h-4 w-4 text-amber-600" />
                              中游产业
                              <Badge 
                                variant="outline" 
                                className={cn(
                                  "ml-auto text-xs",
                                  analysisResult.chainImpactAnalysis.midstreamImpact.severity === '严重' ? "bg-red-100 text-red-700" :
                                  analysisResult.chainImpactAnalysis.midstreamImpact.severity === '中等' ? "bg-yellow-100 text-yellow-700" :
                                  "bg-green-100 text-green-700"
                                )}
                              >
                                {analysisResult.chainImpactAnalysis.midstreamImpact.severity}
                              </Badge>
                            </h4>
                            <p className="text-sm text-muted-foreground mb-2">
                              {analysisResult.chainImpactAnalysis.midstreamImpact.description}
                            </p>
                            {analysisResult.chainImpactAnalysis.midstreamImpact.affectedSectors.length > 0 && (
                              <div className="flex flex-wrap gap-1">
                                {analysisResult.chainImpactAnalysis.midstreamImpact.affectedSectors.map((sector, idx) => (
                                  <Badge key={idx} variant="secondary" className="text-xs">
                                    {sector}
                                  </Badge>
                                ))}
                              </div>
                            )}
                          </div>
                        )}

                        {/* 下游 */}
                        {analysisResult.chainImpactAnalysis.downstreamImpact && (
                          <div className="p-4 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800">
                            <h4 className="font-semibold mb-2 flex items-center gap-2">
                              <TrendingUp className="h-4 w-4 text-green-600" />
                              下游产业
                              <Badge 
                                variant="outline" 
                                className={cn(
                                  "ml-auto text-xs",
                                  analysisResult.chainImpactAnalysis.downstreamImpact.severity === '严重' ? "bg-red-100 text-red-700" :
                                  analysisResult.chainImpactAnalysis.downstreamImpact.severity === '中等' ? "bg-yellow-100 text-yellow-700" :
                                  "bg-green-100 text-green-700"
                                )}
                              >
                                {analysisResult.chainImpactAnalysis.downstreamImpact.severity}
                              </Badge>
                            </h4>
                            <p className="text-sm text-muted-foreground mb-2">
                              {analysisResult.chainImpactAnalysis.downstreamImpact.description}
                            </p>
                            {analysisResult.chainImpactAnalysis.downstreamImpact.affectedSectors.length > 0 && (
                              <div className="flex flex-wrap gap-1">
                                {analysisResult.chainImpactAnalysis.downstreamImpact.affectedSectors.map((sector, idx) => (
                                  <Badge key={idx} variant="secondary" className="text-xs">
                                    {sector}
                                  </Badge>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* 整体影响评估 */}
                      {analysisResult.chainImpactAnalysis.overallImpact && (
                        <div className="p-4 rounded-lg bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-900/50 dark:to-slate-800/50 border border-slate-200 dark:border-slate-700">
                          <h4 className="font-semibold mb-2">整体影响评估</h4>
                          <Badge 
                            variant="outline" 
                            className={cn(
                              "text-sm",
                              analysisResult.chainImpactAnalysis.overallImpact.includes('严重') ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" :
                              analysisResult.chainImpactAnalysis.overallImpact.includes('分化') ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400" :
                              "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                            )}
                          >
                            {analysisResult.chainImpactAnalysis.overallImpact}
                          </Badge>
                        </div>
                      )}

                      {/* 地区差异 */}
                      {analysisResult.chainImpactAnalysis.regionalImpact && analysisResult.chainImpactAnalysis.regionalImpact.mostAffected.length > 0 && (
                        <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                          <h4 className="font-semibold mb-2 text-sm">地区差异</h4>
                          <p className="text-xs text-muted-foreground mb-2">
                            {analysisResult.chainImpactAnalysis.regionalImpact.description}
                          </p>
                          <div className="flex flex-wrap gap-1">
                            {analysisResult.chainImpactAnalysis.regionalImpact.mostAffected.map((region, idx) => (
                              <Badge key={idx} variant="outline" className="text-xs">
                                {region}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* 关键公司 */}
                      {analysisResult.chainImpactAnalysis.keyCompanies && analysisResult.chainImpactAnalysis.keyCompanies.length > 0 && (
                        <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                          <h4 className="font-semibold mb-2 text-sm">产业链关键公司</h4>
                          <div className="space-y-1">
                            {analysisResult.chainImpactAnalysis.keyCompanies.slice(0, 5).map((company, idx) => (
                              <p key={idx} className="text-xs text-muted-foreground flex items-start gap-1">
                                <span className="text-violet-500">•</span>
                                {company}
                              </p>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* 投资启示 */}
                      {analysisResult.chainImpactAnalysis.investmentImplication && (
                        <div className="p-4 rounded-lg bg-gradient-to-r from-indigo-50 to-blue-50 dark:from-indigo-950/30 dark:to-blue-950/30 border border-indigo-200 dark:border-indigo-800">
                          <h4 className="font-semibold mb-2 flex items-center gap-2">
                            <Brain className="h-4 w-4 text-indigo-600" />
                            投资启示
                          </h4>
                          <p className="text-sm text-muted-foreground">
                            {analysisResult.chainImpactAnalysis.investmentImplication}
                          </p>
                        </div>
                      )}

                      {/* 信息来源 */}
                      {analysisResult.chainImpactAnalysis.sourceNews && analysisResult.chainImpactAnalysis.sourceNews.length > 0 && (
                        <div>
                          <h4 className="font-semibold mb-3 flex items-center gap-2">
                            <ExternalLink className="h-4 w-4" />
                            信息来源
                          </h4>
                          <div className="space-y-2">
                            {analysisResult.chainImpactAnalysis.sourceNews.slice(0, 4).map((news: any, idx: number) => (
                              <a 
                                key={idx}
                                href={news.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-start gap-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors"
                              >
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium line-clamp-1">{news.title}</p>
                                  <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{news.snippet}</p>
                                </div>
                                <ExternalLink className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                              </a>
                            ))}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* 多Agent投资讨论 */}
                {analysisResult.multiAgentDiscussion && (
                  <Card className="border-2 border-pink-200 dark:border-pink-800">
                    <CardHeader className="bg-gradient-to-r from-pink-50 to-rose-50 dark:from-pink-950/30 dark:to-rose-950/30">
                      <CardTitle className="flex items-center gap-2">
                        <MessageSquare className="h-5 w-5 text-pink-600 dark:text-pink-400" />
                        五大大师投资讨论
                      </CardTitle>
                      <CardDescription>
                        价值投资 × 量化投资 × 风险投资 × 被动投资 × 宏观对冲
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6 pt-4">
                      {/* 摘要 */}
                      <div className="p-4 rounded-lg bg-pink-50 dark:bg-pink-950/30 border border-pink-200 dark:border-pink-800">
                        <p className="text-sm text-muted-foreground">
                          {analysisResult.multiAgentDiscussion.summary}
                        </p>
                      </div>

                      {/* 大师观点 */}
                      <div>
                        <h4 className="font-semibold mb-3 flex items-center gap-2">
                          <Scale className="h-4 w-4" />
                          五大大师观点
                        </h4>
                        <div className="space-y-3">
                          {analysisResult.multiAgentDiscussion.agents.map((agent, idx) => (
                            <div 
                              key={idx}
                              className="p-4 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
                            >
                              <div className="flex items-center gap-2 mb-2">
                                <span className="text-xl">{agent.avatar}</span>
                                <div>
                                  <span className="font-semibold">{agent.name}</span>
                                  <Badge variant="secondary" className="ml-2 text-xs">
                                    {agent.style}
                                  </Badge>
                                </div>
                              </div>
                              <p className="text-sm text-muted-foreground leading-relaxed">
                                {agent.view}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* 观点交锋 */}
                      {analysisResult.multiAgentDiscussion.discussions && analysisResult.multiAgentDiscussion.discussions.length > 0 && (
                        <div>
                          <h4 className="font-semibold mb-3 flex items-center gap-2">
                            <MessageSquare className="h-4 w-4" />
                            观点交锋
                          </h4>
                          <div className="space-y-4">
                            {analysisResult.multiAgentDiscussion.discussions.map((discussion, idx) => (
                              <div 
                                key={idx}
                                className="p-4 rounded-lg bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-900/50 dark:to-slate-800/50 border border-slate-200 dark:border-slate-700"
                              >
                                <h5 className="font-medium text-sm mb-3 text-primary">
                                  {discussion.topic}
                                </h5>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                  <div className="p-3 rounded bg-blue-50/50 dark:bg-blue-950/30">
                                    <p className="text-xs font-medium text-blue-600 dark:text-blue-400 mb-1">
                                      {discussion.participants[0]}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                      {discussion.viewpoint1}
                                    </p>
                                  </div>
                                  <div className="p-3 rounded bg-orange-50/50 dark:bg-orange-950/30">
                                    <p className="text-xs font-medium text-orange-600 dark:text-orange-400 mb-1">
                                      {discussion.participants[1]}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                      {discussion.viewpoint2}
                                    </p>
                                  </div>
                                </div>
                                <div className="mt-3 p-2 rounded bg-green-50/50 dark:bg-green-950/30">
                                  <p className="text-xs">
                                    <span className="font-medium text-green-600 dark:text-green-400">共识：</span>
                                    <span className="text-muted-foreground">{discussion.conclusion}</span>
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* 共识结论 */}
                      {analysisResult.multiAgentDiscussion.consensus && (
                        <div className="p-4 rounded-lg bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30 border border-emerald-200 dark:border-emerald-800">
                          <h4 className="font-semibold mb-3 flex items-center gap-2">
                            <Target className="h-4 w-4 text-emerald-600" />
                            共识结论
                          </h4>
                          
                          <div className="mb-3">
                            <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400 mb-1">
                              {analysisResult.multiAgentDiscussion.consensus.consensusView}
                            </p>
                          </div>

                          {/* 推荐资产 */}
                          {analysisResult.multiAgentDiscussion.consensus.recommendedAssets && analysisResult.multiAgentDiscussion.consensus.recommendedAssets.length > 0 && (
                            <div className="mb-3">
                              <p className="text-xs font-medium text-muted-foreground mb-2">推荐配置资产：</p>
                              <div className="flex flex-wrap gap-2">
                                {analysisResult.multiAgentDiscussion.consensus.recommendedAssets.map((asset, idx) => (
                                  <Badge key={idx} variant="outline" className="bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400">
                                    {asset}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* 仓位策略 */}
                          {analysisResult.multiAgentDiscussion.consensus.positionStrategy && (
                            <div className="mb-3">
                              <p className="text-xs font-medium text-muted-foreground mb-1">仓位策略：</p>
                              <p className="text-sm text-muted-foreground">
                                {analysisResult.multiAgentDiscussion.consensus.positionStrategy}
                              </p>
                            </div>
                          )}

                          {/* 风险提示 */}
                          {analysisResult.multiAgentDiscussion.consensus.riskWarning && (
                            <div className="mb-3 p-3 rounded bg-yellow-50/50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800">
                              <p className="text-xs font-medium text-yellow-700 dark:text-yellow-400 mb-1">风险提示：</p>
                              <p className="text-sm text-muted-foreground">
                                {analysisResult.multiAgentDiscussion.consensus.riskWarning}
                              </p>
                            </div>
                          )}

                          {/* 具体行动 */}
                          {analysisResult.multiAgentDiscussion.consensus.actionItems && analysisResult.multiAgentDiscussion.consensus.actionItems.length > 0 && (
                            <div>
                              <p className="text-xs font-medium text-muted-foreground mb-2">行动建议：</p>
                              <div className="space-y-1">
                                {analysisResult.multiAgentDiscussion.consensus.actionItems.map((item, idx) => (
                                  <div key={idx} className="flex items-start gap-2 text-sm">
                                    <ArrowRight className="h-4 w-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                                    <span className="text-muted-foreground">{item}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* 历史分析版本结果汇总 */}
                {historicalRecords.length > 0 && (
                  <Card className="border-2 border-indigo-200 dark:border-indigo-800">
                    <CardHeader className="bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-950/30 dark:to-purple-950/30">
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="flex items-center gap-2">
                            <BarChart3 className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                            历史分析版本结果
                          </CardTitle>
                          <CardDescription className="mt-1">
                            共保存 {historicalRecords.length} 个版本，点击切换查看
                          </CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4 pt-4">
                      {/* 版本选择器 */}
                      <div className="flex flex-wrap gap-2">
                        {historicalRecords.map((record, idx) => (
                          <button
                            key={record.id}
                            onClick={() => {
                              setSelectedRecordId(record.id);
                              setAnalysisResult(record.data);
                            }}
                            className={cn(
                              "px-3 py-1.5 rounded-full text-sm font-medium transition-all",
                              selectedRecordId === record.id
                                ? "bg-indigo-600 text-white shadow-md"
                                : "bg-slate-100 dark:bg-slate-800 hover:bg-indigo-100 dark:hover:bg-indigo-900"
                            )}
                          >
                            {record.timeLabel}
                            {idx === 0 && <span className="ml-1 text-xs opacity-75">(最新)</span>}
                          </button>
                        ))}
                      </div>

                      {/* 当前选中版本详情 */}
                      <VersionDetail record={historicalRecords.find(r => r.id === selectedRecordId)} />
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
