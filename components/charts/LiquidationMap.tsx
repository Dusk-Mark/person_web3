'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { getLiquidationMap, LiquidationItem } from '@/lib/okx';
import { cn } from '@/lib/utils';

interface LiquidationMapProps {
  instId?: string;
  className?: string;
}

export default function LiquidationMap({ instId = 'BTC-USDT', className }: LiquidationMapProps) {
  const [data, setData] = useState<LiquidationItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const liquidations = await getLiquidationMap(instId);
        setData(liquidations);
      } catch (error) {
        console.error('获取清算数据失败:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 2000); // 秒级更新：2秒
    return () => clearInterval(interval);
  }, [instId]);

  const bins = useMemo(() => {
    if (!data || !data.length) return [];

    // 按价格和方向分组
    const longLiquidations: Record<number, number> = {};
    const shortLiquidations: Record<number, number> = {};

    data.forEach((item) => {
      const price = Math.round(parseFloat(item.bkPx) / 100) * 100; // 以 $100 为步长
      const sz = parseFloat(item.sz);
      if (item.side === 'buy') { // buy 表示空单被强平（被迫买入）
        shortLiquidations[price] = (shortLiquidations[price] || 0) + sz;
      } else { // sell 表示多单被强平（被迫卖出）
        longLiquidations[price] = (longLiquidations[price] || 0) + sz;
      }
    });

    const prices = [...new Set([...Object.keys(longLiquidations), ...Object.keys(shortLiquidations)].map(Number))].sort((a, b) => a - b);
    
    return prices.map(price => ({
      price,
      long: longLiquidations[price] || 0,
      short: shortLiquidations[price] || 0,
    }));
  }, [data]);

  const maxVal = Math.max(...bins.map(b => Math.max(b.long, b.short)), 1);

  return (
    <div className={cn("relative w-full h-full bg-[#0D0D0D] p-6 border border-[#1A1A1A] flex flex-col", className)}>
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest">聚合清算矩阵</h3>
        <div className="flex gap-4 text-[10px]">
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 bg-magenta-500" />
            <span className="text-gray-400">空单强平</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 bg-green-500" />
            <span className="text-gray-400">多单强平</span>
          </div>
        </div>
      </div>

      {loading && data.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-cyan-500 animate-pulse font-mono text-xs">
          正在同步清算数据...
        </div>
      ) : (
        <div className="flex-1 flex flex-col gap-1 overflow-y-auto pr-2 custom-scrollbar">
          {bins.slice().reverse().map((bin, i) => (
            <div key={i} className="flex items-center gap-4 group">
              <div className="w-16 text-[10px] text-gray-500 font-mono">${bin.price}</div>
              <div className="flex-1 flex items-center gap-[1px] h-4">
                {/* 空单强平 (左侧) */}
                <div className="flex-1 flex justify-end">
                  <div 
                    className="bg-magenta-500/30 border-r border-magenta-500/50 h-full transition-all duration-500 group-hover:bg-magenta-500/50"
                    style={{ width: `${(bin.short / maxVal) * 100}%` }}
                  />
                </div>
                {/* 中心分割线 */}
                <div className="w-[1px] h-full bg-gray-800" />
                {/* 多单强平 (右侧) */}
                <div className="flex-1 flex justify-start">
                  <div 
                    className="bg-green-500/30 border-l border-green-500/50 h-full transition-all duration-500 group-hover:bg-green-500/50"
                    style={{ width: `${(bin.long / maxVal) * 100}%` }}
                  />
                </div>
              </div>
              <div className="w-20 text-[10px] text-gray-400 font-mono text-right">
                {(bin.long + bin.short).toFixed(2)} BTC
              </div>
            </div>
          ))}
          {bins.length === 0 && !loading && (
            <div className="flex-1 flex items-center justify-center text-gray-600 text-xs uppercase tracking-widest">
              暂无清算数据
            </div>
          )}
        </div>
      )}

      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 2px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #050505;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #1A1A1A;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #333;
        }
      `}</style>
    </div>
  );
}
