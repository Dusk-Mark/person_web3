'use client';

import React, { useEffect, useState } from 'react';
import { Zap, Activity, Shield, Cpu, ArrowRight, BarChart3, Globe } from 'lucide-react';
import { cn, formatNumber } from '@/lib/utils';
import { getTickers, TickerData } from '@/lib/okx';
import Link from 'next/link';

export default function LandingPage() {
  const [tickers, setTickers] = useState<TickerData[]>([]);

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

  return (
    <main className="min-h-screen bg-[#050505] text-[#E0E0E0] font-mono selection:bg-cyan-500/30 overflow-hidden relative">
      {/* 背景装饰 */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-cyan-500/10 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-magenta-500/10 blur-[120px] rounded-full" />
      </div>

      {/* 页眉 */}
      <header className="fixed top-0 left-0 right-0 z-50 px-8 py-6 flex justify-between items-center backdrop-blur-md border-b border-[#1A1A1A]">
        <div className="flex items-center gap-2">
          <Zap className="text-cyan-500 animate-pulse" size={24} />
          <span className="text-xl font-black tracking-tighter text-white uppercase">Mark Team 终端</span>
        </div>
        <nav className="hidden md:flex gap-8 text-[10px] uppercase tracking-widest font-bold items-center">
          <a href="#features" className="hover:text-cyan-400 transition-colors">核心规格</a>
          <a href="#about" className="hover:text-cyan-400 transition-colors">关于团队</a>
          <Link href="/blog" className="hover:text-cyan-400 transition-colors">研究报告</Link>
          <Link href="/dashboard" className="px-4 py-1 bg-cyan-500 text-black hover:bg-cyan-400 transition-all">启动终端控制台</Link>
        </nav>
      </header>

      {/* 英雄板块 */}
      <section className="relative pt-40 pb-20 px-8 flex flex-col items-center text-center">
        <div className="inline-block px-3 py-1 bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-[10px] uppercase tracking-[0.2em] mb-6 animate-fade-in">
          由 Mark 团队倾力打造的 Web3 核心分析节点
        </div>
        <h1 className="text-6xl md:text-8xl font-black text-white tracking-tighter mb-8 max-w-5xl leading-[0.9] uppercase glitch" data-text="解码加密矩阵">
          解码 <br /> <span className="text-cyan-500">加密矩阵</span>
        </h1>
        <p className="text-gray-500 max-w-2xl text-sm md:text-base leading-relaxed mb-12">
          专为精英交易者打造的高性能 Web3 监控套件。
          由 Mark 团队深度集成顶级数据源，提供实时 K 线分析与聚合清算热力图。
        </p>
        
        <div className="flex flex-col md:flex-row gap-6">
          <Link href="/dashboard" className="group flex items-center gap-3 px-8 py-4 bg-cyan-500 text-black font-black uppercase tracking-widest hover:bg-cyan-400 transition-all">
            进入控制终端 <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
          </Link>
          <Link href="/blog" className="px-8 py-4 border border-cyan-500/30 text-cyan-400 font-black uppercase tracking-widest hover:bg-cyan-500/5 transition-all">
            查阅研究报告
          </Link>
          <a href="#about" className="px-8 py-4 border border-[#333] font-black uppercase tracking-widest hover:bg-white/5 transition-all">
            技术规格
          </a>
        </div>
      </section>

      {/* 实时报价板块 */}
      <section className="px-8 py-20 bg-[#080808] border-y border-[#1A1A1A]">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8">
          {['BTC-USDT', 'ETH-USDT'].map((asset) => {
            const ticker = tickers.find(t => t.instId === asset);
            const isUp = ticker ? parseFloat(ticker.last) >= parseFloat(ticker.open24h) : true;
            return (
              <div key={asset} className="relative p-8 border border-[#1A1A1A] bg-[#0A0A0A] group overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-30 transition-opacity">
                  <Activity size={48} className={isUp ? "text-green-500" : "text-magenta-500"} />
                </div>
                <div className="text-[10px] text-gray-500 uppercase tracking-widest mb-2">实时资产报价</div>
                <div className="flex items-baseline gap-4 mb-6">
                  <h3 className="text-3xl font-black text-white">{asset.split('-')[0]}</h3>
                  <div className={cn("text-xs font-bold", isUp ? "text-green-500" : "text-magenta-500")}>
                    {ticker ? `${((parseFloat(ticker.last) - parseFloat(ticker.open24h)) / parseFloat(ticker.open24h) * 100).toFixed(2)}%` : '---'}
                  </div>
                </div>
                <div className="text-5xl font-black text-cyan-400 tracking-tighter mb-4">
                  {ticker ? `$${formatNumber(parseFloat(ticker.last))}` : '加载中...'}
                </div>
                <div className="grid grid-cols-2 gap-4 text-[10px] text-gray-500 font-bold border-t border-[#1A1A1A] pt-4">
                  <div>24H 最高: <span className="text-white">${ticker ? formatNumber(parseFloat(ticker.high24h)) : '---'}</span></div>
                  <div>24H 最低: <span className="text-white">${ticker ? formatNumber(parseFloat(ticker.low24h)) : '---'}</span></div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 功能介绍板块 */}
      <section id="features" className="px-8 py-32">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-20">
            <h2 className="text-4xl font-black text-white uppercase tracking-tighter mb-4">系统核心规格</h2>
            <div className="w-20 h-1 bg-cyan-500 mx-auto" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { icon: Globe, title: '核心数据集成', desc: '来自全球顶级 API 的低延迟直接馈送，确保您始终掌握最新的市场遥测数据。' },
              { icon: Activity, title: '多维指标', desc: 'MACD、OI 与资金费率的无缝整合，在单一高保真界面中穿透市场迷雾。' },
              { icon: Cpu, title: '私人定制 UI', desc: '专为 Mark 优化的视觉风格，针对高密度信息展示和深色模式进行了极致优化。' },
              { icon: Zap, title: '闪电刷新', desc: '亚秒级数据自动同步，贯穿终端所有模块，确保决策的实时性。' },
              { icon: Shield, title: '数据主权', desc: '本地化配置与私人密钥安全隔离，确保您的监控环境纯净且无干扰。' },
              { icon: BarChart3, title: '聚合热力图', desc: '深度追踪清算事件与流动性分布，在数字丛林中预判大宗波动。' },
            ].map((feature, i) => (
              <div key={i} className="p-8 border border-[#1A1A1A] bg-[#080808] hover:border-cyan-500/30 transition-all group">
                <feature.icon className="text-cyan-500 mb-6 group-hover:scale-110 transition-transform" size={32} />
                <h3 className="text-xl font-black text-white mb-4 uppercase">{feature.title}</h3>
                <p className="text-gray-500 text-xs leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 关于板块 */}
      <section id="about" className="px-8 py-32">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-black text-white uppercase tracking-tighter mb-8">Mark Team 系统规格</h2>
          <div className="space-y-6 text-gray-500 text-sm leading-relaxed">
            <p>
              <span className="text-cyan-500 font-bold">Mark Team 终端</span> 是由 Mark 团队倾力打造的专业研究项目，旨在探索 Web3 市场动态与未来主义 UI 设计的结合点。
            </p>
            <p>
              每一字节数据都经过团队优化的专用通道流式传输，提供纯净的数字资产景观视角。我们的使命是为精英交易者提供高保真视觉界面，穿透传统金融的噪音。
            </p>
          </div>
        </div>
      </section>

      {/* 页脚 */}
      <footer className="px-8 py-12 border-t border-[#1A1A1A] text-center">
        <div className="text-[10px] text-gray-600 uppercase tracking-[0.4em]">
          由 Mark 团队开发 // 为反抗者设计
        </div>
      </footer>

      {/* 装饰元素 */}
      <div className="fixed bottom-12 left-12 z-50 animate-bounce">
        <div className="w-1 h-12 bg-gradient-to-b from-cyan-500 to-transparent" />
      </div>
    </main>
  );
}
