'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Activity, Map, Zap, Bell, Settings, FileText, Calculator } from 'lucide-react';
import { cn } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default function CalculatorPage() {
  const pathname = usePathname();
  const [contractSide, setContractSide] = useState<'long' | 'short'>('long');
  const [crossMargin, setCrossMargin] = useState('1000');
  const [positionRatio, setPositionRatio] = useState('30');
  const [leverage, setLeverage] = useState('10');
  const [entryPrice, setEntryPrice] = useState('100000');
  const [tpPrice, setTpPrice] = useState('105000');
  const [slPrice, setSlPrice] = useState('98000');

  const calc = useMemo(() => {
    const marginValue = Number(crossMargin);
    const ratioValue = Number(positionRatio);
    const leverageValue = Number(leverage);
    const entryValue = Number(entryPrice);
    const tpValue = Number(tpPrice);
    const slValue = Number(slPrice);
    const ready =
      Number.isFinite(marginValue) &&
      Number.isFinite(ratioValue) &&
      Number.isFinite(leverageValue) &&
      Number.isFinite(entryValue) &&
      Number.isFinite(tpValue) &&
      Number.isFinite(slValue) &&
      marginValue > 0 &&
      ratioValue > 0 &&
      leverageValue > 0 &&
      entryValue > 0 &&
      tpValue > 0 &&
      slValue > 0;
    const usedMargin = ready ? marginValue * (ratioValue / 100) : 0;
    const notional = ready ? usedMargin * leverageValue : 0;
    const quantity = ready ? notional / entryValue : 0;
    const tpPnl = ready ? quantity * (contractSide === 'long' ? tpValue - entryValue : entryValue - tpValue) : 0;
    const slPnl = ready ? quantity * (contractSide === 'long' ? slValue - entryValue : entryValue - slValue) : 0;
    const tpAccount = ready ? marginValue + tpPnl : 0;
    const slAccount = ready ? marginValue + slPnl : 0;

    return {
      ready,
      marginValue,
      usedMargin,
      notional,
      tpPnl,
      slPnl,
      tpAccount,
      slAccount,
      roiTp: ready ? (tpPnl / marginValue) * 100 : 0,
      roiSl: ready ? (slPnl / marginValue) * 100 : 0,
    };
  }, [contractSide, crossMargin, positionRatio, leverage, entryPrice, tpPrice, slPrice]);

  return (
    <main className="min-h-screen bg-[#050505] text-[#E0E0E0] font-mono selection:bg-cyan-500/30">
      <div className="md:hidden sticky top-0 z-40 border-b border-[#1A1A1A] bg-[#0A0A0A]/95 backdrop-blur-md px-4 py-3">
        <div className="flex items-center justify-between">
          <Link href="/" className="text-cyan-500">
            <Zap size={22} />
          </Link>
          <div className="text-[11px] text-gray-400 uppercase tracking-widest">合约计算器</div>
          <Link href="/dashboard" className="text-gray-400 hover:text-cyan-400 transition-colors">
            <Activity size={20} />
          </Link>
        </div>
      </div>

      <aside className="hidden md:flex fixed left-0 top-0 bottom-0 w-16 border-r border-[#1A1A1A] bg-[#0A0A0A] flex-col items-center py-8 z-50">
        <Link href="/" className="mb-12 text-cyan-500 animate-pulse">
          <Zap size={32} />
        </Link>
        <nav className="flex flex-col gap-8">
          <Link
            href="/dashboard"
            title="K线图表"
            className={cn("p-2 transition-all duration-300", pathname === '/dashboard' ? "text-cyan-400 drop-shadow-[0_0_8px_rgba(34,211,238,0.5)]" : "text-gray-600 hover:text-gray-400")}
          >
            <Activity size={24} />
          </Link>
          <Link
            href="/dashboard"
            title="清算地图"
            className="p-2 transition-all duration-300 text-gray-600 hover:text-gray-400"
          >
            <Map size={24} />
          </Link>
          <Link
            href="/calculator"
            title="合约计算器"
            className={cn("p-2 transition-all duration-300", pathname === '/calculator' ? "text-cyan-400 drop-shadow-[0_0_8px_rgba(34,211,238,0.5)]" : "text-gray-600 hover:text-gray-400")}
          >
            <Calculator size={24} />
          </Link>
          <Link
            href="/blog"
            title="研究报告"
            className={cn("p-2 transition-all duration-300", pathname === '/blog' ? "text-cyan-400 drop-shadow-[0_0_8px_rgba(34,211,238,0.5)]" : "text-gray-600 hover:text-gray-400")}
          >
            <FileText size={24} />
          </Link>
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

      <section className="px-4 pb-24 pt-4 md:pl-16 md:p-8 md:pb-8">
        <header className="flex flex-col gap-4 md:flex-row md:justify-between md:items-end mb-8 md:mb-12">
          <div>
            <h1 className="text-2xl md:text-4xl font-black tracking-tighter text-white flex items-center gap-2">
              <span className="bg-cyan-500 text-black px-2 py-0.5 uppercase">Mark</span>
              合约计算器
            </h1>
            <p className="text-gray-500 mt-2 text-xs uppercase tracking-widest">
              全仓模式 // USDT 计价 // 止盈止损收益模拟
            </p>
          </div>
        </header>

        <div className="max-w-5xl mx-auto border border-[#1A1A1A] bg-[#0A0A0A] p-4 md:p-8 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/5 blur-[90px] -mr-16 -mt-16 pointer-events-none" />

          <div className="grid grid-cols-2 gap-2 mb-6">
            <button
              onClick={() => setContractSide('long')}
              className={cn(
                "py-2 text-[11px] border uppercase tracking-widest transition-colors",
                contractSide === 'long' ? "border-cyan-500/50 text-cyan-400 bg-cyan-500/10" : "border-[#222] text-gray-500"
              )}
            >
              做多
            </button>
            <button
              onClick={() => setContractSide('short')}
              className={cn(
                "py-2 text-[11px] border uppercase tracking-widest transition-colors",
                contractSide === 'short' ? "border-cyan-500/50 text-cyan-400 bg-cyan-500/10" : "border-[#222] text-gray-500"
              )}
            >
              做空
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { label: '全仓金额 (USDT)', value: crossMargin, setter: setCrossMargin, placeholder: '1000' },
              { label: '仓位占比 (%)', value: positionRatio, setter: setPositionRatio, placeholder: '30' },
              { label: '杠杆倍数', value: leverage, setter: setLeverage, placeholder: '10' },
              { label: '入场价格', value: entryPrice, setter: setEntryPrice, placeholder: '100000' },
              { label: '预计止盈价格', value: tpPrice, setter: setTpPrice, placeholder: '105000' },
              { label: '预计止损价格', value: slPrice, setter: setSlPrice, placeholder: '98000' },
            ].map((item) => (
              <div key={item.label} className="space-y-1">
                <label className="text-[10px] text-gray-500 uppercase tracking-widest">{item.label}</label>
                <input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="any"
                  value={item.value}
                  onChange={(e) => item.setter(e.target.value)}
                  placeholder={item.placeholder}
                  className="w-full bg-[#050505] border border-[#1A1A1A] py-2 px-3 text-xs focus:outline-none focus:border-cyan-500/50 text-white"
                />
              </div>
            ))}
          </div>

          <div className="mt-6 border-t border-[#1A1A1A] pt-5 space-y-3 text-[11px]">
            <div className="flex justify-between">
              <span className="text-gray-500 uppercase tracking-widest">实际开仓保证金</span>
              <span className="text-white font-mono">{calc.ready ? `${calc.usedMargin.toFixed(2)} USDT` : '--'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500 uppercase tracking-widest">仓位名义价值</span>
              <span className="text-white font-mono">{calc.ready ? `${calc.notional.toFixed(2)} USDT` : '--'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500 uppercase tracking-widest">预计止盈盈亏</span>
              <span className={cn("font-mono", calc.tpPnl >= 0 ? "text-green-500" : "text-red-500")}>
                {calc.ready ? `${calc.tpPnl >= 0 ? '+' : ''}${calc.tpPnl.toFixed(2)} USDT` : '--'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500 uppercase tracking-widest">预计止损盈亏</span>
              <span className={cn("font-mono", calc.slPnl >= 0 ? "text-green-500" : "text-red-500")}>
                {calc.ready ? `${calc.slPnl >= 0 ? '+' : ''}${calc.slPnl.toFixed(2)} USDT` : '--'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <div className="border border-[#1A1A1A] bg-[#080808] p-3">
                <div className="text-[9px] text-gray-500 uppercase tracking-widest mb-1">止盈后余额</div>
                <div className={cn("text-sm font-black", calc.tpAccount >= calc.marginValue ? "text-green-500" : "text-red-500")}>
                  {calc.ready ? `${calc.tpAccount.toFixed(2)} USDT` : '--'}
                </div>
                <div className={cn("text-[10px] mt-1", calc.roiTp >= 0 ? "text-green-500" : "text-red-500")}>
                  {calc.ready ? `${calc.roiTp >= 0 ? '+' : ''}${calc.roiTp.toFixed(2)}%` : '--'}
                </div>
              </div>
              <div className="border border-[#1A1A1A] bg-[#080808] p-3">
                <div className="text-[9px] text-gray-500 uppercase tracking-widest mb-1">止损后余额</div>
                <div className={cn("text-sm font-black", calc.slAccount >= calc.marginValue ? "text-green-500" : "text-red-500")}>
                  {calc.ready ? `${calc.slAccount.toFixed(2)} USDT` : '--'}
                </div>
                <div className={cn("text-[10px] mt-1", calc.roiSl >= 0 ? "text-green-500" : "text-red-500")}>
                  {calc.ready ? `${calc.roiSl >= 0 ? '+' : ''}${calc.roiSl.toFixed(2)}%` : '--'}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 border-t border-[#1A1A1A] bg-[#0A0A0A]/95 backdrop-blur-md px-2 py-2">
        <div className="grid grid-cols-4 gap-1">
          <Link href="/" className="flex flex-col items-center gap-1 py-1 text-[10px] uppercase text-gray-500 hover:text-cyan-400">
            <Zap size={16} />
            首页
          </Link>
          <Link href="/dashboard" className="flex flex-col items-center gap-1 py-1 text-[10px] uppercase text-gray-500 hover:text-cyan-400">
            <Activity size={16} />
            行情
          </Link>
          <Link href="/calculator" className="flex flex-col items-center gap-1 py-1 text-[10px] uppercase text-cyan-400">
            <Calculator size={16} />
            计算
          </Link>
          <Link href="/blog" className="flex flex-col items-center gap-1 py-1 text-[10px] uppercase text-gray-500 hover:text-cyan-400">
            <FileText size={16} />
            博客
          </Link>
        </div>
      </nav>

      <div className="fixed bottom-0 left-0 right-0 h-[2px] bg-cyan-500/20 pointer-events-none" />
      <div className="fixed top-0 left-0 right-0 h-[2px] bg-cyan-500/20 pointer-events-none" />
    </main>
  );
}
