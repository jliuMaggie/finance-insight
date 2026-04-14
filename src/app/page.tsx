'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RefreshCw, TrendingUp, DollarSign, Brain, Calendar, User, Building2, Info, Star, Newspaper, Globe, Link2, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import { INVESTORS, Investor } from '@/lib/investors';

interface NewsItem {
  id: string;
  rank: number;
  aiTitle: string;
  originalTitle: string;
  summary: string;
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

export default function FinanceInsightPage() {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [newsLoading, setNewsLoading] = useState(false);
  const [timeRange, setTimeRange] = useState<'12h' | '24h' | '36h' | '48h'>('24h');
  const [newsCache, setNewsCache] = useState<Record<string, NewsItem[]>>({});
  const [lastUpdated, setLastUpdated] = useState<Record<string, string>>({});

  const [holdings, setHoldings] = useState<HoldingChange[]>([]);
  const [holdingsLoading, setHoldingsLoading] = useState(false);
  const [holdingsLastUpdated, setHoldingsLastUpdated] = useState<string>('');

  useEffect(() => {
    loadNews();
  }, [timeRange]);

  useEffect(() => {
    loadHoldings();
  }, []);

  const loadNews = async (forceRefresh = false) => {
    if (!forceRefresh && newsCache[timeRange] && newsCache[timeRange].length > 0) {
      setNews(newsCache[timeRange]);
      setNewsLoading(false);
      return;
    }

    try {
      setNewsLoading(true);
      const url = forceRefresh 
        ? `/api/news?timeRange=${timeRange}&refresh=true`
        : `/api/news?timeRange=${timeRange}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to load news');
      const data = await response.json();
      
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
      setHoldingsLastUpdated(data.lastUpdated || '');
    } catch (error) {
      console.error('Error loading holdings:', error);
      setHoldings([]);
    } finally {
      setHoldingsLoading(false);
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
                  实时金融新闻与投资大佬持仓追踪
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
            <TabsTrigger value="media" className="gap-2">
              <Newspaper className="h-4 w-4" />
              媒体导航
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
                      loadNews(true);
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
                <div className="flex items-center gap-2 mt-4">
                  <span className="text-sm text-muted-foreground">查看时段：</span>
                  <div className="flex gap-2">
                    {(['12h', '24h', '36h', '48h'] as const).map((range) => (
                      <button
                        key={range}
                        onClick={() => setTimeRange(range)}
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
                                <h3 className="font-semibold text-base line-clamp-2 hover:text-blue-600 dark:hover:text-blue-400 transition-colors mb-2">
                                  {item.aiTitle}
                                </h3>
                                <p className="text-xs text-muted-foreground mb-2 line-clamp-1">
                                  {item.originalTitle}
                                </p>
                                <p className="text-sm text-foreground mb-3 line-clamp-3 leading-relaxed">
                                  {item.summary}
                                </p>
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
                    <p className="text-muted-foreground mb-4">暂无持仓数据</p>
                    <p className="text-sm text-muted-foreground">数据正在准备中，请稍后再查看</p>
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
                              <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                                {investorInfo.description && (
                                  <p className="text-xs text-muted-foreground line-clamp-2">
                                    {investorInfo.description}
                                  </p>
                                )}
                                {investorInfo.investmentStyle && (
                                  <p className="text-xs text-muted-foreground">
                                    风格: {investorInfo.investmentStyle}
                                  </p>
                                )}
                              </div>
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
                                        variant={holding.action === '买入' || holding.action === '增持' ? 'default' : 'destructive'}
                                        className={cn(
                                          "text-xs font-medium",
                                          holding.action === '买入' || holding.action === '增持' 
                                            ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300 hover:bg-green-100" 
                                            : "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300 hover:bg-red-100"
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
                                    还有 {investorHoldings.length - 5} 条持仓记录...
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
        </Tabs>
      </main>
    </div>
  );
}
