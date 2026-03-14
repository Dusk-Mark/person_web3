'use client';

import React, { useState, useEffect, useRef } from 'react';
import AdvancedChart from '@/components/charts/AdvancedChart';
import LiquidationMap from '@/components/charts/LiquidationMap';
import { Activity, LayoutDashboard, Map, Zap, Settings, Bell, ChevronDown, ExternalLink, FileText } from 'lucide-react';
import { cn, formatNumber } from '@/lib/utils';
import { getTickers, TickerData } from '@/lib/okx';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const TIMEFRAMES = [
  { label: '1分', value: '1m' },
  { label: '5分', value: '5m' },
  { label: '1时', value: '1H' },
  { label: '4时', value: '4H' },
  { label: '1日', value: '1D' },
];

const ASSETS = [
  { label: 'BTC-USDT', value: 'BTC-USDT' },
  { label: 'ETH-USDT', value: 'ETH-USDT' },
];

type NewsItem = {
  title: string;
  link: string;
  source: string;
  publishedAt: string;
};

export const dynamic = 'force-dynamic';

export default function Dashboard() {
  const pathname = usePathname();
  const [activeTab, setActiveTab] = useState('kline');
  const [selectedAsset, setSelectedAsset] = useState('BTC-USDT');
  const [selectedTimeframe, setSelectedTimeframe] = useState('1D');
  const [tickers, setTickers] = useState<TickerData[]>([]);
  const [news, setNews] = useState<NewsItem[]>([]);
  const [newsLoading, setNewsLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<string>('');
  const [assetMenuOpen, setAssetMenuOpen] = useState(false);
  const assetMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchTickers = async () => {
      try {
        const data = await getTickers(['BTC-USDT', 'ETH-USDT']);
        setTickers(data);
      } catch (err) {
        console.error(err);
      }
    };
    fetchTickers();
    const timer = setInterval(fetchTickers, 2000); // 秒级更新：2秒
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (!assetMenuRef.current) return;
      if (!assetMenuRef.current.contains(event.target as Node)) {
        setAssetMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  useEffect(() => {
    let isMounted = true;
    const fetchNews = async () => {
      try {
        const res = await fetch('/api/news', { cache: 'no-store' });
        if (!res.ok) throw new Error('API request failed');
        const payload = (await res.json()) as { data: NewsItem[]; timestamp?: string };
        if (isMounted) {
          setNews(payload.data || []);
          if (payload.timestamp) setLastUpdated(payload.timestamp);
          setNewsLoading(false);
        }
      } catch (err) {
        console.error('Failed to fetch news:', err);
        if (isMounted) setNewsLoading(false);
      }
    };
    fetchNews();
    const timer = setInterval(fetchNews, 60000);
    return () => {
      isMounted = false;
      clearInterval(timer);
    };
  }, []);

  const currentTicker = tickers.find(t => t.instId === selectedAsset);

  return (
    <main className="min-h-screen bg-[#050505] text-[#E0E0E0] font-mono selection:bg-cyan-500/30">
      {/* 侧边栏 */}
      <aside className="fixed left-0 top-0 bottom-0 w-16 border-r border-[#1A1A1A] bg-[#0A0A0A] flex flex-col items-center py-8 z-50">
        <Link href="/" className="mb-12 text-cyan-500 animate-pulse">
          <Zap size={32} />
        </Link>
        
        <nav className="flex flex-col gap-8">
          <button 
            onClick={() => setActiveTab('kline')}
            title="K线图表"
            className={cn("p-2 transition-all duration-300", activeTab === 'kline' && pathname === '/dashboard' ? "text-cyan-400 drop-shadow-[0_0_8px_rgba(34,211,238,0.5)]" : "text-gray-600 hover:text-gray-400")}
          >
            <Activity size={24} />
          </button>
          <button 
            onClick={() => setActiveTab('liquidation')}
            title="清算地图"
            className={cn("p-2 transition-all duration-300", activeTab === 'liquidation' && pathname === '/dashboard' ? "text-cyan-400 drop-shadow-[0_0_8px_rgba(34,211,238,0.5)]" : "text-gray-600 hover:text-gray-400")}
          >
            <Map size={24} />
          </button>
          <Link 
            href="/blog"
            title="研究报告"
            className={cn("p-2 transition-all duration-300", pathname === '/blog' ? "text-cyan-400 drop-shadow-[0_0_8px_rgba(34,211,238,0.5)]" : "text-gray-600 hover:text-gray-400")}
          >
            <FileText size={24} />
          </Link>
          <button title="仪表盘" className="p-2 text-gray-600 hover:text-gray-400 transition-colors">
            <LayoutDashboard size={24} />
          </button>
        </nav>

        <div className="mt-auto flex flex-col gap-6">
          <button title="通知" className="p-2 text-gray-600 hover:text-gray-400 transition-colors">
            <Bell size={24} />
          </button>
          <button title="设置" className="p-2 text-gray-600 hover:text-gray-400 transition-colors">
            <Settings size={24} />
          </button>
        </div>
      </aside>

      {/* 主内容区 */}
      <section className="pl-16 p-8">
        {/* 页眉 */}
        <header className="flex justify-between items-end mb-12">
          <div>
            <h1 className="text-4xl font-black tracking-tighter text-white flex items-center gap-2">
              <span className="bg-cyan-500 text-black px-2 py-0.5 uppercase">Mark</span>
              私人 Web3 终端
            </h1>
            <p className="text-gray-500 mt-2 text-xs uppercase tracking-widest">
              私人项目 // Mark 的加密资产分析引擎 v1.1.0
            </p>
          </div>
          
          <div className="flex gap-4 text-[10px] text-gray-500 font-mono">
            <div className="flex flex-col items-end">
              <span>系统状态: <span className="text-green-500">优级</span></span>
              <span>网络: <span className="text-white">主网节点-01</span></span>
            </div>
            <div className="h-8 w-px bg-[#1A1A1A]" />
            <div className="flex flex-col items-end">
              <span>延迟: <span className="text-white">24MS</span></span>
              <span>日期: <span className="text-white">{new Date().toISOString().split('T')[0]}</span></span>
            </div>
          </div>
        </header>

        {/* 仪表盘网格 */}
        <div className="grid grid-cols-12 gap-6">
          {/* 主图表区域 */}
          <div className="col-span-12 lg:col-span-9 space-y-6">
            <div className="relative border border-[#1A1A1A] bg-[#0A0A0A] p-6 rounded-sm">
              {/* 角部装饰 */}
              <div className="absolute top-0 left-0 w-2 h-2 border-t-2 border-l-2 border-cyan-500" />
              <div className="absolute top-0 right-0 w-2 h-2 border-t-2 border-r-2 border-cyan-500" />
              <div className="absolute bottom-0 left-0 w-2 h-2 border-b-2 border-l-2 border-cyan-500" />
              <div className="absolute bottom-0 right-0 w-2 h-2 border-b-2 border-r-2 border-cyan-500" />
              
              <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-6">
                  {/* 资产选择器 */}
                  <div ref={assetMenuRef} className="relative">
                    <button
                      onClick={() => setAssetMenuOpen((prev) => !prev)}
                      className="flex items-center gap-2 text-lg font-bold text-cyan-400 uppercase tracking-tighter"
                    >
                      {selectedAsset}
                      <ChevronDown size={16} className={cn("transition-transform", assetMenuOpen && "rotate-180")} />
                    </button>
                    <div
                      className={cn(
                        "absolute top-full left-0 mt-2 w-40 bg-[#0A0A0A] border border-[#1A1A1A] z-50",
                        assetMenuOpen ? "block" : "hidden"
                      )}
                    >
                      {ASSETS.map(asset => (
                        <button 
                          key={asset.value}
                          onClick={() => {
                            setSelectedAsset(asset.value);
                            setAssetMenuOpen(false);
                          }}
                          className="w-full text-left px-4 py-2 text-xs hover:bg-cyan-500 hover:text-black transition-colors"
                        >
                          {asset.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 周期选择器 */}
                  <div className="flex gap-2">
                    {TIMEFRAMES.map(tf => (
                      <button 
                        key={tf.value}
                        onClick={() => setSelectedTimeframe(tf.value)}
                        className={cn(
                          "px-2 py-0.5 text-[10px] border transition-all",
                          selectedTimeframe === tf.value 
                            ? "bg-cyan-500/20 text-cyan-400 border-cyan-500/50" 
                            : "text-gray-500 border-gray-500/20 hover:border-gray-500/50"
                        )}
                      >
                        {tf.label}
                      </button>
                    ))}
                  </div>

                  {/* 价格信息 */}
                  {currentTicker && (
                    <div className="flex items-center gap-4 ml-4">
                      <div className="text-xl font-black text-white">${formatNumber(parseFloat(currentTicker.last))}</div>
                      <div className={cn("text-[10px]", parseFloat(currentTicker.last) >= parseFloat(currentTicker.open24h) ? "text-green-500" : "text-magenta-500")}>
                        {((parseFloat(currentTicker.last) - parseFloat(currentTicker.open24h)) / parseFloat(currentTicker.open24h) * 100).toFixed(2)}%
                      </div>
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  <div className="w-1.5 h-1.5 bg-cyan-500 rounded-full animate-ping" />
                  <span className="text-[10px] text-cyan-500 font-bold uppercase">实时数据流</span>
                </div>
              </div>

              {activeTab === 'kline' ? (
                <AdvancedChart instId={selectedAsset} interval={selectedTimeframe} className="h-[500px]" />
              ) : (
                <LiquidationMap instId={selectedAsset} className="h-[500px]" />
              )}
            </div>

            {/* 数据统计行 */}
            <div className="grid grid-cols-3 gap-6">
              {[
                { label: '24H 最高', value: currentTicker ? `$${formatNumber(parseFloat(currentTicker.high24h))}` : '---', trend: '峰值' },
                { label: '24H 最低', value: currentTicker ? `$${formatNumber(parseFloat(currentTicker.low24h))}` : '---', trend: '谷值' },
                { label: '24H 成交量', value: currentTicker ? `${formatNumber(parseFloat(currentTicker.volCcy24h) / 1000000)}M` : '---', trend: '交易额' },
              ].map((stat, i) => (
                <div key={i} className="border border-[#1A1A1A] bg-[#0A0A0A] p-4 relative overflow-hidden group">
                  <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent" />
                  <div className="text-[10px] text-gray-500 uppercase mb-1">{stat.label}</div>
                  <div className="flex justify-between items-baseline">
                    <div className="text-2xl font-black text-white">{stat.value}</div>
                    <div className="text-[10px] text-cyan-500">{stat.trend}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 侧边栏部分 */}
          <div className="col-span-12 lg:col-span-3 space-y-6">
            <div className="border border-[#1A1A1A] bg-[#0A0A0A] p-6 h-full relative group overflow-hidden">
              {/* 背景装饰 */}
              <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/5 blur-[80px] -mr-16 -mt-16 pointer-events-none" />
              
              <div className="flex justify-between items-center mb-6 border-b border-[#1A1A1A] pb-2">
                <h2 className="text-sm font-bold text-white uppercase tracking-tighter flex items-center gap-2">
                  <span className="w-2 h-2 bg-cyan-500 animate-pulse" />
                  实时新闻
                </h2>
                {lastUpdated && (
                  <span className="text-[8px] text-gray-600 font-mono">
                    SYNC: {new Date(lastUpdated).toLocaleTimeString()}
                  </span>
                )}
              </div>

              <div className="space-y-4 min-h-[400px]">
                {newsLoading && news.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-64 space-y-4">
                    <div className="w-8 h-8 border-2 border-cyan-500/20 border-t-cyan-500 rounded-full animate-spin" />
                    <div className="text-[10px] text-cyan-500 font-mono animate-pulse">正在接入加密数据流...</div>
                  </div>
                ) : news.length > 0 ? (
                  news.slice(0, 10).map((item, i) => (
                    <a
                      key={`${item.link}-${i}`}
                      href={item.link}
                      target="_blank"
                      rel="noreferrer"
                      className="block group/item relative pl-4 py-2 border-l border-white/5 hover:border-cyan-500/50 transition-all duration-300"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[8px] font-mono text-gray-600">
                          {new Date(item.publishedAt).toLocaleTimeString('zh-CN', { hour12: false })}
                        </span>
                        <span className="text-[8px] px-1 bg-white/5 text-cyan-400 border border-white/10 uppercase">
                          {item.source}
                        </span>
                      </div>
                      <h3 className="text-[11px] leading-relaxed text-gray-400 group-hover/item:text-white transition-colors line-clamp-2">
                        {item.title}
                      </h3>
                      {/* 悬停时的光效 */}
                      <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-cyan-500 scale-y-0 group-hover/item:scale-y-100 transition-transform origin-top duration-300 shadow-[0_0_8px_rgba(34,211,238,0.8)]" />
                    </a>
                  ))
                ) : (
                  <div className="flex flex-col items-center justify-center h-64 text-center px-4">
                    <div className="text-red-500/50 mb-2">
                      <Bell size={24} className="mx-auto" />
                    </div>
                    <div className="text-[10px] text-gray-500 font-mono">数据流中断</div>
                    <button 
                      onClick={() => window.location.reload()}
                      className="mt-4 text-[9px] text-cyan-500 border border-cyan-500/30 px-3 py-1 hover:bg-cyan-500 hover:text-black transition-all"
                    >
                      重新建立连接
                    </button>
                  </div>
                )}
              </div>
              
              <div className="mt-8">
                <a
                  href={news[0]?.link || 'https://www.coindesk.com/'}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full py-2 bg-[#0A0A0A] border border-cyan-500/20 text-[10px] text-cyan-500 uppercase tracking-widest hover:bg-cyan-500 hover:text-black hover:border-cyan-500 transition-all duration-500 flex items-center justify-center gap-2 group/btn relative overflow-hidden"
                >
                  <span className="relative z-10 flex items-center gap-2">
                    阅读完整简报
                    <ExternalLink size={12} className="group-hover/btn:translate-x-0.5 group-hover/btn:-translate-y-0.5 transition-transform" />
                  </span>
                  <div className="absolute inset-0 bg-cyan-500 translate-y-full group-hover/btn:translate-y-0 transition-transform duration-300" />
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 页脚装饰 */}
      <div className="fixed bottom-0 left-0 right-0 h-[2px] bg-cyan-500/20 pointer-events-none" />
      <div className="fixed top-0 left-0 right-0 h-[2px] bg-cyan-500/20 pointer-events-none" />
    </main>
  );
}
