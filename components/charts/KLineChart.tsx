'use client';

import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { getCandles, CandleData } from '@/lib/okx';
import { calculateMA, calculateMACD } from '@/lib/indicators';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Maximize2, Minimize2, Eye, EyeOff, Ruler, Settings2 } from 'lucide-react';

interface KLineChartProps {
  instId?: string;
  bar?: string;
  className?: string;
}

// TradingView 官方配色参考
const COLORS = {
  bg: '#131722',
  grid: '#1e222d',
  bull: '#26a69a',
  bear: '#ef5350',
  text: '#9db2bd',
  crosshair: '#758696',
  axisBg: '#1e222d',
  ma5: '#ffeb3b',
  ma10: '#2196f3',
  ma20: '#e91e63',
  fibLine: 'rgba(117, 134, 150, 0.4)',
  fibLabel: '#758696'
};

const FIB_LEVELS = [
  { level: 0, color: 'rgba(239, 83, 80, 0.1)' },
  { level: 0.236, color: 'rgba(255, 152, 0, 0.1)' },
  { level: 0.382, color: 'rgba(76, 175, 80, 0.1)' },
  { level: 0.5, color: 'rgba(0, 188, 212, 0.1)' },
  { level: 0.618, color: 'rgba(33, 150, 243, 0.1)' },
  { level: 0.786, color: 'rgba(156, 39, 176, 0.1)' },
  { level: 1, color: 'rgba(38, 166, 154, 0.1)' },
];

const RIGHT_PANEL_WIDTH = 60;
const BOTTOM_PANEL_HEIGHT = 30;

export default function KLineChart({ instId = 'BTC-USDT', bar = '1D', className }: KLineChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mainCanvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  
  const [data, setData] = useState<CandleData[]>([]);
  const [loading, setLoading] = useState(true);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  
  // 核心视口状态
  const [candleWidth, setCandleWidth] = useState(10);
  const [rightOffset, setRightOffset] = useState(100); // 距离右侧刻度尺的距离
  const [priceZoom, setPriceZoom] = useState(1); // Y轴缩放比例
  
  // 交互状态
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartX, setDragStartX] = useState(0);
  const [startRightOffset, setStartRightOffset] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showIndicators, setShowIndicators] = useState({ ma: true, macd: true, vol: true });
  
  // 斐波那契工具状态
  const [fibTool, setFibTool] = useState<{ active: boolean; startPrice: number | null; endPrice: number | null; startIdx: number | null }>({
    active: false,
    startPrice: null,
    endPrice: null,
    startIdx: null
  });

  const ma5 = useMemo(() => calculateMA(data, 5), [data]);
  const ma10 = useMemo(() => calculateMA(data, 10), [data]);
  const ma20 = useMemo(() => calculateMA(data, 20), [data]);
  const { macdLine, signalLine, histogram } = useMemo(() => calculateMACD(data), [data]);

  // 坐标转换工具
  const getXByGlobalIndex = useCallback((index: number, width: number) => {
    const chartWidth = width - RIGHT_PANEL_WIDTH;
    const lastCandleX = chartWidth - rightOffset;
    return lastCandleX - (data.length - 1 - index) * candleWidth;
  }, [data.length, rightOffset, candleWidth]);

  const getGlobalIndexByX = useCallback((x: number, width: number) => {
    const chartWidth = width - RIGHT_PANEL_WIDTH;
    const lastCandleX = chartWidth - rightOffset;
    const diff = (lastCandleX - x) / candleWidth;
    return Math.round(data.length - 1 - diff);
  }, [data.length, rightOffset, candleWidth]);

  const visibleRange = useMemo(() => {
    if (!containerRef.current || !data.length) return { start: 0, end: 0 };
    const width = containerRef.current.clientWidth;
    return {
      start: Math.max(0, getGlobalIndexByX(0, width)),
      end: Math.min(data.length - 1, getGlobalIndexByX(width - RIGHT_PANEL_WIDTH, width))
    };
  }, [data.length, candleWidth, rightOffset, getGlobalIndexByX]);

  const chartMetrics = useMemo(() => {
    const { start, end } = visibleRange;
    const vData = data.slice(start, end + 1);
    if (!vData.length) return null;

    let highs = vData.map(d => d.high);
    let lows = vData.map(d => d.low);
    if (showIndicators.ma) {
      highs = [...highs, ...ma5.slice(start, end + 1).filter(v => v !== null) as number[]];
      lows = [...lows, ...ma20.slice(start, end + 1).filter(v => v !== null) as number[]];
    }

    const maxP = Math.max(...highs);
    const minP = Math.min(...lows);
    const range = maxP - minP;
    const padding = range * 0.1;
    
    return { 
      maxPrice: maxP + padding, 
      minPrice: minP - padding, 
      priceRange: (range + padding * 2) / priceZoom // 应用价格轴缩放
    };
  }, [data, visibleRange, ma5, ma20, showIndicators.ma, priceZoom]);

  useEffect(() => {
    const fetchData = async () => {
      if (data.length === 0) setLoading(true);
      try {
        const candles = await getCandles(instId, bar, '1000'); // 加载更大量数据
        setData(candles);
      } catch (err) { console.error(err); } finally { setLoading(false); }
    };
    fetchData();
    const timer = setInterval(fetchData, 2000);
    return () => clearInterval(timer);
  }, [instId, bar]);

  const drawMainChart = useCallback(() => {
    if (!mainCanvasRef.current || !data.length || !chartMetrics) return;
    const canvas = mainCanvasRef.current;
    const ctx = canvas.getContext('2d')!;
    const width = canvas.width / window.devicePixelRatio;
    const height = canvas.height / window.devicePixelRatio;
    const { maxPrice, minPrice, priceRange } = chartMetrics;
    const { start, end } = visibleRange;

    ctx.clearRect(0, 0, width, height);

    const mainAreaH = height - BOTTOM_PANEL_HEIGHT;
    const chartWidth = width - RIGHT_PANEL_WIDTH;
    const kLineAreaH = showIndicators.macd ? mainAreaH * 0.7 : mainAreaH * 0.85;
    const priceScale = (kLineAreaH - 40) / (priceRange || 1);
    const getPriceY = (p: number) => kLineAreaH - 20 - (p - minPrice) * priceScale;

    // 1. Grid Lines
    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 1;
    ctx.beginPath();
    // Horizontal
    for (let i = 0; i <= 6; i++) {
      const y = getPriceY(minPrice + (priceRange / 6) * i);
      ctx.moveTo(0, y); ctx.lineTo(chartWidth, y);
    }
    // Vertical
    for (let i = start; i <= end; i++) {
      if (i % 20 === 0) {
        const x = getXByGlobalIndex(i, width) + candleWidth / 2;
        ctx.moveTo(x, 0); ctx.lineTo(x, mainAreaH);
      }
    }
    ctx.stroke();

    // 2. Volume (Under Candles)
    if (showIndicators.vol) {
      const maxVol = Math.max(...data.slice(start, end + 1).map(d => d.vol), 1);
      const volH = kLineAreaH * 0.2;
      const volScale = volH / maxVol;
      for (let i = start; i <= end; i++) {
        const x = getXByGlobalIndex(i, width);
        const isUp = data[i].close >= data[i].open;
        ctx.fillStyle = isUp ? `${COLORS.bull}33` : `${COLORS.bear}33`;
        ctx.fillRect(x + 1, kLineAreaH - data[i].vol * volScale, candleWidth - 2, data[i].vol * volScale);
      }
    }

    // 3. Candles
    const bodyW = candleWidth * 0.8;
    const bodyOff = candleWidth * 0.1;
    for (let i = start; i <= end; i++) {
      const d = data[i];
      const x = getXByGlobalIndex(i, width);
      const isUp = d.close >= d.open;
      const color = isUp ? COLORS.bull : COLORS.bear;
      ctx.strokeStyle = ctx.fillStyle = color;
      
      // Wick
      ctx.beginPath();
      ctx.moveTo(x + candleWidth / 2, getPriceY(d.high));
      ctx.lineTo(x + candleWidth / 2, getPriceY(d.low));
      ctx.stroke();

      // Body
      const y1 = getPriceY(d.open), y2 = getPriceY(d.close);
      ctx.fillRect(x + bodyOff, Math.min(y1, y2), bodyW, Math.max(1, Math.abs(y1 - y2)));
    }

    // 4. Moving Averages
    if (showIndicators.ma) {
      const drawMA = (ma: (number|null)[], col: string) => {
        ctx.strokeStyle = col; ctx.lineWidth = 1.5; ctx.beginPath();
        let started = false;
        for (let i = start; i <= end; i++) {
          if (ma[i] === null) { started = false; continue; }
          const x = getXByGlobalIndex(i, width) + candleWidth / 2, y = getPriceY(ma[i]!);
          if (!started) { ctx.moveTo(x, y); started = true; } else ctx.lineTo(x, y);
        }
        ctx.stroke();
      };
      drawMA(ma5, COLORS.ma5); drawMA(ma10, COLORS.ma10); drawMA(ma20, COLORS.ma20);
    }

    // 5. MACD Area
    if (showIndicators.macd) {
      const macdAreaY = mainAreaH * 0.75;
      const macdAreaH = mainAreaH * 0.2;
      const vH = histogram.slice(start, end+1).filter(v=>v!==null) as number[];
      const maxH = Math.max(...vH, 0.0001), minH = Math.min(...vH, -0.0001);
      const hScale = (macdAreaH - 10) / (maxH - minH);
      const getHY = (v: number) => macdAreaY + macdAreaH/2 - (v * hScale);
      
      for (let i = start; i <= end; i++) {
        if (histogram[i] === null) continue;
        ctx.fillStyle = histogram[i]! >= 0 ? `${COLORS.bull}88` : `${COLORS.bear}88`;
        const x = getXByGlobalIndex(i, width) + bodyOff;
        ctx.fillRect(x, Math.min(getHY(0), getHY(histogram[i]!)), bodyW, Math.max(1, Math.abs(getHY(histogram[i]!) - getHY(0))));
      }
    }

    // 6. Axis Panels (Static Labels)
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(chartWidth, 0, RIGHT_PANEL_WIDTH, height);
    ctx.fillRect(0, mainAreaH, width, BOTTOM_PANEL_HEIGHT);
    ctx.strokeStyle = COLORS.grid;
    ctx.beginPath();
    ctx.moveTo(chartWidth, 0); ctx.lineTo(chartWidth, height);
    ctx.moveTo(0, mainAreaH); ctx.lineTo(width, mainAreaH);
    ctx.stroke();

    // Price Scale Labels
    ctx.fillStyle = COLORS.text;
    ctx.font = '10px Arial';
    ctx.textAlign = 'left';
    for (let i = 0; i <= 6; i++) {
      const p = minPrice + (priceRange / 6) * i;
      ctx.fillText(p.toFixed(2), chartWidth + 5, getPriceY(p) + 4);
    }
  }, [data, visibleRange, chartMetrics, candleWidth, getXByGlobalIndex, showIndicators, ma5, ma10, ma20, histogram]);

  const drawOverlay = useCallback(() => {
    if (!overlayCanvasRef.current || !data.length || !chartMetrics) return;
    const canvas = overlayCanvasRef.current;
    const ctx = canvas.getContext('2d')!;
    const width = canvas.width / window.devicePixelRatio;
    const height = canvas.height / window.devicePixelRatio;
    const { maxPrice, minPrice, priceRange } = chartMetrics;
    const chartWidth = width - RIGHT_PANEL_WIDTH;
    const mainAreaH = height - BOTTOM_PANEL_HEIGHT;
    const kLineAreaH = showIndicators.macd ? mainAreaH * 0.7 : mainAreaH * 0.85;
    const priceScale = (kLineAreaH - 40) / (priceRange || 1);
    const getPriceY = (p: number) => kLineAreaH - 20 - (p - minPrice) * priceScale;

    ctx.clearRect(0, 0, width, height);

    // 1. Fibonacci (Enhanced with Colors)
    if (fibTool.startPrice !== null) {
      const targetP = fibTool.endPrice || (hoverIndex !== null ? maxPrice - (mousePos.y - (kLineAreaH - 20 - priceRange * priceScale)) / priceScale : fibTool.startPrice);
      const startX = getXByGlobalIndex(fibTool.startIdx!, width) + candleWidth/2;
      const endX = chartWidth;

      FIB_LEVELS.forEach((lvl, i) => {
        const p = fibTool.startPrice! + (targetP - fibTool.startPrice!) * lvl.level;
        const y = getPriceY(p);
        
        // Area Fill
        if (i < FIB_LEVELS.length - 1) {
          const nextP = fibTool.startPrice! + (targetP - fibTool.startPrice!) * FIB_LEVELS[i+1].level;
          ctx.fillStyle = lvl.color;
          ctx.fillRect(startX, y, endX - startX, getPriceY(nextP) - y);
        }

        // Line & Label
        ctx.strokeStyle = COLORS.fibLine;
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(startX, y); ctx.lineTo(endX, y); ctx.stroke();
        ctx.fillStyle = COLORS.fibLabel; ctx.font = '10px monospace';
        ctx.fillText(`${lvl.level.toFixed(3)} (${p.toFixed(1)})`, startX + 5, y - 5);
      });
    }

    // 2. Crosshair & Dynamic Labels
    if (hoverIndex !== null) {
      const crossX = getXByGlobalIndex(hoverIndex, width) + candleWidth / 2;
      const crossY = mousePos.y;
      
      ctx.setLineDash([4, 4]); ctx.strokeStyle = COLORS.crosshair;
      ctx.beginPath();
      if (crossX <= chartWidth) { ctx.moveTo(crossX, 0); ctx.lineTo(crossX, mainAreaH); }
      if (crossY <= mainAreaH) { ctx.moveTo(0, crossY); ctx.lineTo(chartWidth, crossY); }
      ctx.stroke(); ctx.setLineDash([]);

      // Price Label (Right)
      if (crossY <= kLineAreaH) {
        const p = maxPrice - (crossY - (kLineAreaH - 20 - priceRange * priceScale)) / priceScale;
        const txt = p.toFixed(2), tw = ctx.measureText(txt).width + 10;
        ctx.fillStyle = COLORS.axisBg; ctx.fillRect(chartWidth, crossY - 10, RIGHT_PANEL_WIDTH, 20);
        ctx.fillStyle = '#fff'; ctx.fillText(txt, chartWidth + 5, crossY + 4);
      }

      // Time Label (Bottom)
      if (crossX <= chartWidth) {
        const dt = format(data[hoverIndex].time, 'HH:mm');
        const dw = ctx.measureText(dt).width + 10;
        ctx.fillStyle = COLORS.axisBg; ctx.fillRect(crossX - dw/2, mainAreaH, dw, BOTTOM_PANEL_HEIGHT);
        ctx.fillStyle = '#fff'; ctx.textAlign = 'center';
        ctx.fillText(dt, crossX, mainAreaH + 18);
        ctx.textAlign = 'left';
      }
    }
  }, [data, hoverIndex, mousePos, chartMetrics, candleWidth, getXByGlobalIndex, fibTool, showIndicators.macd]);

  useEffect(() => {
    const resize = () => {
      if (!containerRef.current) return;
      const { width, height } = containerRef.current.getBoundingClientRect();
      [mainCanvasRef.current, overlayCanvasRef.current].forEach(c => {
        if (!c) return;
        c.width = width * window.devicePixelRatio; c.height = height * window.devicePixelRatio;
        const ctx = c.getContext('2d')!; ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
      });
      drawMainChart(); drawOverlay();
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, [drawMainChart, drawOverlay, isFullscreen]);

  const handleMouseDown = (e: React.MouseEvent) => {
    const rect = containerRef.current!.getBoundingClientRect();
    const x = e.clientX - rect.left, y = e.clientY - rect.top;

    if (fibTool.active) {
      const { maxPrice, minPrice, priceRange } = chartMetrics!;
      const kH = (overlayCanvasRef.current!.height / window.devicePixelRatio) * (showIndicators.macd ? 0.7 : 0.85);
      const pScale = (kH - 40) / (priceRange || 1);
      const price = maxPrice - (y - (kH - 20 - priceRange * pScale)) / pScale;
      
      if (!fibTool.startPrice) setFibTool(p => ({ ...p, startPrice: price, startIdx: getGlobalIndexByX(x, rect.width) }));
      else setFibTool(p => ({ ...p, endPrice: price, active: false }));
      return;
    }
    setIsDragging(true); setDragStartX(e.clientX); setStartRightOffset(rightOffset);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const rect = containerRef.current!.getBoundingClientRect();
    const x = e.clientX - rect.left, y = e.clientY - rect.top;
    if (isDragging) { setRightOffset(startRightOffset - (e.clientX - dragStartX)); return; }
    const idx = getGlobalIndexByX(x, rect.width);
    if (idx >= 0 && idx < data.length) { setHoverIndex(idx); setMousePos({ x, y }); }
    else setHoverIndex(null);
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault(); e.stopPropagation();
    const factor = e.deltaY > 0 ? 0.9 : 1.1;
    setCandleWidth(w => Math.max(2, Math.min(100, w * factor)));
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) containerRef.current.requestFullscreen().then(() => setIsFullscreen(true));
    else document.exitFullscreen().then(() => setIsFullscreen(false));
  };

  const hCandle = hoverIndex !== null ? data[hoverIndex] : null;

  return (
    <div 
      ref={containerRef} 
      className={cn(
        "relative w-full bg-[#131722] p-0 border border-[#2a2e39] overflow-hidden cursor-crosshair select-none",
        isFullscreen ? "fixed inset-0 z-[100] h-screen" : "h-[650px] rounded-sm",
        className
      )}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={() => setIsDragging(false)}
      onWheel={handleWheel}
    >
      {/* 增强型 TradingView 顶部工具栏 */}
      <div className="absolute top-0 left-0 right-0 h-10 bg-[#1c202b] border-b border-[#2a2e39] z-20 flex items-center px-4 justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-white font-black text-sm tracking-tighter">{instId}</span>
            <span className="text-[#758696] text-[10px] font-bold">· {bar} · MARK</span>
          </div>
          <div className="h-4 w-px bg-gray-700 mx-2" />
          <div className="flex gap-2">
            <button onClick={() => setShowIndicators(p => ({ ...p, ma: !p.ma }))} className={cn("p-1 text-[10px] font-bold rounded", showIndicators.ma ? "text-cyan-400 bg-cyan-400/10" : "text-gray-500 hover:bg-white/5")}>指标</button>
            <button onClick={() => setFibTool(p => ({ ...p, active: !p.active, startPrice: null, endPrice: null }))} className={cn("p-1 text-[10px] font-bold rounded", fibTool.active ? "text-yellow-400 bg-yellow-400/10" : "text-gray-500 hover:bg-white/5")}>绘图</button>
          </div>
          {hCandle && (
            <div className="flex gap-3 text-[10px] font-mono ml-4">
              <span className="text-gray-500">O<span className={cn("ml-0.5", hCandle.close >= hCandle.open ? "text-green-400" : "text-red-400")}>{hCandle.open.toFixed(1)}</span></span>
              <span className="text-gray-500">H<span className="text-white ml-0.5">{hCandle.high.toFixed(1)}</span></span>
              <span className="text-gray-500">L<span className="text-white ml-0.5">{hCandle.low.toFixed(1)}</span></span>
              <span className="text-gray-500">C<span className={cn("ml-0.5", hCandle.close >= hCandle.open ? "text-green-400" : "text-red-400")}>{hCandle.close.toFixed(1)}</span></span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-4">
          <button onClick={() => setPriceZoom(1)} className="text-[10px] text-gray-500 hover:text-white" title="重置缩放">AUTO</button>
          <button onClick={toggleFullscreen} className="text-gray-500 hover:text-white">
            {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>
        </div>
      </div>

      {fibTool.active && (
        <div className="absolute top-12 left-1/2 -translate-x-1/2 z-30 bg-yellow-500 text-black px-4 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider">
          FIB: {!fibTool.startPrice ? "Select Origin" : "Select Target"}
        </div>
      )}

      <canvas ref={mainCanvasRef} className="absolute inset-0 w-full h-full" />
      <canvas ref={overlayCanvasRef} className="absolute inset-0 w-full h-full z-10" />
    </div>
  );
}
