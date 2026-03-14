'use client';

import React, { useEffect, useRef, useState } from 'react';
import { 
  createChart, 
  ColorType, 
  LineStyle, 
  CrosshairMode, 
  ISeriesApi, 
  UTCTimestamp,
  IChartApi,
  CandlestickSeries,
  HistogramSeries,
  LineSeries,
  AreaSeries
} from 'lightweight-charts';
import { getCandles, getOpenInterest, getFundingRate, getLiquidationMap } from '@/lib/okx';
import { calculateMA, calculateMACD } from '@/lib/indicators';
import { 
  Maximize2, 
  Minimize2, 
  Settings, 
  Camera, 
  ChevronDown, 
  MousePointer2, 
  TrendingUp, 
  Type, 
  Layout, 
  Trash2, 
  Search, 
  Zap, 
  BarChart3, 
  Clock, 
  Layers,
  Activity,
  ArrowRightLeft,
  CircleDot,
  Minus,
  ArrowUpRight
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CandleData, LiquidationItem } from '@/lib/okx';

interface AdvancedChartProps {
  instId?: string;
  interval?: string;
  className?: string;
}

type DrawingTool = 'trendline' | 'ray' | 'hline' | 'fib' | null;

type LiquidationMarker = {
  time: UTCTimestamp;
  position: 'belowBar' | 'aboveBar';
  color: string;
  shape: 'circle';
  text: string;
  size: number;
};

const COLORS = {
  bg: '#000000', // 纯黑背景
  text: '#d1d4dc',
  grid: 'rgba(42, 46, 57, 0.3)', // 更细微的网格
  bull: '#089981', // 霓虹绿
  bear: '#f23645', // 霓虹红
  volume: 'rgba(8, 153, 129, 0.5)',
  crosshair: '#758696',
};

export default function AdvancedChart({ 
  instId = 'BTC-USDT', 
  interval = '1D', 
  className 
}: AdvancedChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const oiSeriesRef = useRef<ISeriesApi<'Area'> | null>(null);
  const fundingSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const macdSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const signalSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const macdHistSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const liquidationMarkersRef = useRef<LiquidationMarker[]>([]);
  
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showDerivative, setShowDerivative] = useState({ 
    oi: false, 
    funding: false, 
    liq: false, 
    ma: false,
    macd: false,
    volume: false 
  });
  const [drawingTool, setDrawingTool] = useState<DrawingTool>(null);
  const [drawings, setDrawings] = useState<Array<ISeriesApi<'Line'>>>([]);
  const drawingToolRef = useRef<DrawingTool>(null);
  const drawingStateRef = useRef<{
    firstPoint: { time: UTCTimestamp; price: number } | null;
    previewSeries: ISeriesApi<'Line'> | null;
    fibPreviewSeries: ISeriesApi<'Line'>[];
  }>({ firstPoint: null, previewSeries: null, fibPreviewSeries: [] });

  const updateDrawingTool = (tool: DrawingTool) => {
    // 如果点击的是当前已激活的工具，则切换回指针模式
    const nextTool = drawingToolRef.current === tool ? null : tool;
    setDrawingTool(nextTool);
    drawingToolRef.current = nextTool;
    // 切换工具时彻底重置状态
    drawingStateRef.current.firstPoint = null;
    
    // 清理可能存在的预览
    if (chartRef.current) {
      if (drawingStateRef.current.previewSeries) {
        chartRef.current.removeSeries(drawingStateRef.current.previewSeries);
        drawingStateRef.current.previewSeries = null;
      }
      drawingStateRef.current.fibPreviewSeries.forEach(s => chartRef.current?.removeSeries(s));
      drawingStateRef.current.fibPreviewSeries = [];
    }
  };
  const [currentInterval, setCurrentInterval] = useState(interval);
  const [loading, setLoading] = useState(true);

  const timeframes = [
    { label: '1秒', value: '1s' },
    { label: '1分', value: '1m' },
    { label: '5分', value: '5m' },
    { label: '15分', value: '15m' },
    { label: '1时', value: '1H' },
    { label: '4时', value: '4H' },
    { label: '1日', value: '1D' },
  ];

  const maSeriesRefs = useRef<{
    ma5?: ISeriesApi<'Line'>;
    ma10?: ISeriesApi<'Line'>;
    ma20?: ISeriesApi<'Line'>;
  }>({});

  // 动态显示/隐藏指标系列
  useEffect(() => {
    if (!chartRef.current) return;
    
    maSeriesRefs.current.ma5?.applyOptions({ visible: showDerivative.ma });
    maSeriesRefs.current.ma10?.applyOptions({ visible: showDerivative.ma });
    maSeriesRefs.current.ma20?.applyOptions({ visible: showDerivative.ma });
    
    oiSeriesRef.current?.applyOptions({ visible: showDerivative.oi });
    fundingSeriesRef.current?.applyOptions({ visible: showDerivative.funding });
    macdSeriesRef.current?.applyOptions({ visible: showDerivative.macd });
    signalSeriesRef.current?.applyOptions({ visible: showDerivative.macd });
    macdHistSeriesRef.current?.applyOptions({ visible: showDerivative.macd });
    volumeSeriesRef.current?.applyOptions({ visible: showDerivative.volume });
    const candleSeriesTyped = candleSeriesRef.current as unknown as { setMarkers?: (input: typeof liquidationMarkersRef.current) => void };
    if (typeof candleSeriesTyped?.setMarkers === 'function') {
      candleSeriesTyped.setMarkers(showDerivative.liq ? liquidationMarkersRef.current : []);
    }

    // 处理爆仓标记的重新应用 (因为 setMarkers 需要在数据存在时调用)
    // 注意：这里的 markers 获取可能需要重新拉取或从 state 缓存，暂保持当前逻辑
  }, [showDerivative]);

  // 动态调整指标高度
  useEffect(() => {
    if (!chartRef.current || !candleSeriesRef.current || !volumeSeriesRef.current) return;
    
    // 增加一个小延迟，确保图表的所有 Pane 已经初始化完成
    const timer = setTimeout(() => {
      const chart = chartRef.current;
      if (!chart) return;

      const indicatorHeight = 0.15; // 每个副图指标占据 15% 的高度
      const visibleIndicators = [
        showDerivative.oi,
        showDerivative.funding,
        showDerivative.macd,
        showDerivative.volume
      ].filter(Boolean).length;

      const totalIndicatorHeight = visibleIndicators * indicatorHeight;
      const mainChartBottomMargin = totalIndicatorHeight + 0.05; // 留一点间隙

      // 1. 调整主图 (K线) 的边距
      try {
        chart.priceScale('right').applyOptions({
          scaleMargins: {
            top: 0.05,
            bottom: mainChartBottomMargin,
          },
        });

        // 2. 自下而上堆叠显示的指标
        let currentBottom = 0.01;

        // MACD
        if (showDerivative.macd && macdSeriesRef.current) {
          chart.priceScale('macd').applyOptions({
            scaleMargins: { top: 1 - currentBottom - indicatorHeight, bottom: currentBottom },
          });
          currentBottom += indicatorHeight;
        }

        // Funding
        if (showDerivative.funding && fundingSeriesRef.current) {
          chart.priceScale('funding').applyOptions({
            scaleMargins: { top: 1 - currentBottom - indicatorHeight, bottom: currentBottom },
          });
          currentBottom += indicatorHeight;
        }

        // OI
        if (showDerivative.oi && oiSeriesRef.current) {
          chart.priceScale('oi').applyOptions({
            scaleMargins: { top: 1 - currentBottom - indicatorHeight, bottom: currentBottom },
          });
          currentBottom += indicatorHeight;
        }

        // Volume
        if (showDerivative.volume && volumeSeriesRef.current) {
          volumeSeriesRef.current.priceScale().applyOptions({
            scaleMargins: {
              top: 1 - currentBottom - indicatorHeight,
              bottom: currentBottom,
            },
          });
          volumeSeriesRef.current.applyOptions({ visible: true });
        } else if (volumeSeriesRef.current) {
          volumeSeriesRef.current.applyOptions({ visible: false });
        }
      } catch (e) {
        console.warn('Failed to apply scale options, chart may not be ready:', e);
      }
    }, 50);

    return () => clearTimeout(timer);
  }, [showDerivative.oi, showDerivative.funding, showDerivative.macd, showDerivative.volume, loading]);

  // 初始化图表
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: COLORS.bg },
        textColor: COLORS.text,
        fontSize: 11, // 更紧凑的字体
        fontFamily: '-apple-system, BlinkMacSystemFont, "Trebuchet MS", Roboto, Ubuntu, sans-serif',
      },
      grid: {
        vertLines: { color: 'rgba(42, 46, 57, 0.1)', style: LineStyle.Dotted },
        horzLines: { color: 'rgba(42, 46, 57, 0.1)', style: LineStyle.Dotted },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: {
          width: 1,
          color: 'rgba(255, 255, 255, 0.5)',
          style: LineStyle.Dashed,
          labelBackgroundColor: '#131722',
        },
        horzLine: {
          width: 1,
          color: 'rgba(255, 255, 255, 0.5)',
          style: LineStyle.Dashed,
          labelBackgroundColor: '#131722',
        },
      },
      rightPriceScale: {
        borderColor: '#2a2e39',
        autoScale: true,
        // scaleMargins 将由动态 useEffect 处理
      },
      timeScale: {
        borderColor: '#2a2e39',
        timeVisible: true,
        secondsVisible: false,
        barSpacing: 12, // 初始间距更宽一点
        minBarSpacing: 1,
        rightOffset: 5, // 右侧留白
      },
      localization: {
        locale: 'zh-CN',
        dateFormat: 'yyyy-MM-dd',
        timeFormatter: (time: number) => {
          const date = new Date(time * 1000);
          const days = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
          const day = days[date.getDay()];
          const y = date.getFullYear();
          const m = (date.getMonth() + 1).toString().padStart(2, '0');
          const d = date.getDate().toString().padStart(2, '0');
          const hh = date.getHours().toString().padStart(2, '0');
          const mm = date.getMinutes().toString().padStart(2, '0');
          return `${day} ${y}-${m}-${d} ${hh}:${mm}`;
        },
      },
      handleScroll: true,
      handleScale: true,
    });

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: COLORS.bull,
      downColor: COLORS.bear,
      borderVisible: false,
      wickUpColor: COLORS.bull,
      wickDownColor: COLORS.bear,
    });

    const volumeSeries = chart.addSeries(HistogramSeries, {
      color: COLORS.volume,
      priceFormat: { type: 'volume' },
      priceScaleId: '', // 置于覆盖层
      visible: false,
    });

    // 添加均线系列
    const ma5Series = chart.addSeries(LineSeries, {
      color: '#ffeb3b',
      lineWidth: 1,
      priceLineVisible: false,
      crosshairMarkerVisible: false,
      visible: false,
    });

    const ma10Series = chart.addSeries(LineSeries, {
      color: '#2196f3',
      lineWidth: 1,
      priceLineVisible: false,
      crosshairMarkerVisible: false,
      visible: false,
    });

    const ma20Series = chart.addSeries(LineSeries, {
      color: '#e91e63',
      lineWidth: 1,
      priceLineVisible: false,
      crosshairMarkerVisible: false,
      visible: false,
    });

    maSeriesRefs.current = { ma5: ma5Series, ma10: ma10Series, ma20: ma20Series };

    // 持仓量系列 (Area)
    const oiSeries = chart.addSeries(AreaSeries, {
      topColor: 'rgba(33, 150, 243, 0.4)',
      bottomColor: 'rgba(33, 150, 243, 0.0)',
      lineColor: '#2196f3',
      lineWidth: 2,
      priceScaleId: 'oi', // 独立 Y 轴
      visible: false,
    });

    // 资金费率系列 (Histogram)
    const fundingSeries = chart.addSeries(HistogramSeries, {
      color: '#ff9800',
      priceFormat: { type: 'percent' },
      priceScaleId: 'funding', // 独立 Y 轴
      visible: false,
    });

    chart.priceScale('oi').applyOptions({
      visible: false,
    });

    chart.priceScale('funding').applyOptions({
      visible: false,
    });

    volumeSeries.priceScale().applyOptions({
      visible: false,
    });

    // MACD 系列
    const macdSeries = chart.addSeries(LineSeries, {
      color: '#2962ff',
      lineWidth: 1,
      priceScaleId: 'macd',
      visible: false,
    });
    const signalSeries = chart.addSeries(LineSeries, {
      color: '#ff6d00',
      lineWidth: 1,
      priceScaleId: 'macd',
      visible: false,
    });
    const macdHistSeries = chart.addSeries(HistogramSeries, {
      priceScaleId: 'macd',
      visible: false,
    });

    chart.priceScale('macd').applyOptions({
      visible: false,
    });

    chartRef.current = chart;
    candleSeriesRef.current = candleSeries;
    volumeSeriesRef.current = volumeSeries;
    oiSeriesRef.current = oiSeries;
    fundingSeriesRef.current = fundingSeries;
    macdSeriesRef.current = macdSeries;
    signalSeriesRef.current = signalSeries;
    macdHistSeriesRef.current = macdHistSeries;

    const handleResize = () => {
      if (chartContainerRef.current) {
        chart.applyOptions({ 
          width: chartContainerRef.current.clientWidth,
          height: chartContainerRef.current.clientHeight 
        });
      }
    };

    window.addEventListener('resize', handleResize);

    // 加载初始数据并回溯至 2024-01-01
    const loadInitialData = async () => {
      setLoading(true);
      try {
        const swapInstId = instId.endsWith('-SWAP') ? instId : `${instId}-SWAP`;
        const targetTime = new Date('2024-01-01').getTime();
        let allData: CandleData[] = [];
        let after: string | undefined = undefined;
        const maxPages = 10;
        let pagesFetched = 0;

        while (pagesFetched < maxPages) {
          const chunk = await getCandles(instId, currentInterval, '300', after);
          if (!chunk || chunk.length === 0) break;
          allData = [...chunk, ...allData];
          const earliestInChunk = chunk[0].time;
          if (earliestInChunk <= targetTime) break;
          after = earliestInChunk.toString();
          pagesFetched++;
        }

        allData = Array.from(new Map(allData.map(item => [item.time, item])).values())
          .sort((a, b) => a.time - b.time);

        // 获取衍生品数据 (OI & Funding)
        const [oiData, fundingData, liqData] = await Promise.all([
          getOpenInterest(swapInstId),
          getFundingRate(swapInstId),
          getLiquidationMap(instId)
        ]);

        const formattedCandles = allData.map(d => ({
          time: (d.time / 1000) as UTCTimestamp,
          open: d.open,
          high: d.high,
          low: d.low,
          close: d.close,
        }));

        // 处理 OI 数据
        const formattedOI = oiData.map((d) => ({
          time: (parseInt(d.ts) / 1000) as UTCTimestamp,
          value: parseFloat(d.oi),
        })).sort((a, b) => a.time - b.time);

        // 处理 Funding 数据
        const formattedFunding = fundingData.map((d) => ({
          time: (parseInt(d.fundingTime) / 1000) as UTCTimestamp,
          value: parseFloat(d.fundingRate) * 100, // 转为百分比
          color: parseFloat(d.fundingRate) >= 0 ? 'rgba(38, 166, 154, 0.5)' : 'rgba(239, 83, 80, 0.5)',
        })).sort((a, b) => a.time - b.time);

        // 处理爆仓标记
        const markers: LiquidationMarker[] = liqData.map((d: LiquidationItem) => ({
          time: (parseInt(d.ts) / 1000) as UTCTimestamp,
          position: d.side === 'buy' ? 'belowBar' : 'aboveBar',
          color: d.side === 'buy' ? COLORS.bull : COLORS.bear, // Short liq = Green, Long liq = Red
          shape: 'circle',
          text: d.side === 'buy' ? 'B' : 'S', 
          size: 2,
        }));

        const formattedVolume = allData.map(d => ({
          time: (d.time / 1000) as UTCTimestamp,
          value: d.vol,
          color: d.close >= d.open ? 'rgba(8, 153, 129, 0.4)' : 'rgba(242, 54, 69, 0.4)',
        }));

        const ma5 = calculateMA(allData, 5);
        const ma10 = calculateMA(allData, 10);
        const ma20 = calculateMA(allData, 20);
        const { macdLine, signalLine, histogram } = calculateMACD(allData);

        const formatMA = (ma: (number | null)[]) => 
          ma.map((v, i) => v !== null ? { time: (allData[i].time / 1000) as UTCTimestamp, value: v } : null)
            .filter((v): v is { time: UTCTimestamp; value: number } => v !== null);

        const formatData = (data: (number | null)[], color?: string) => 
          data.map((v, i) => v !== null ? { 
            time: (allData[i].time / 1000) as UTCTimestamp, 
            value: v,
            color: color || (v >= 0 ? 'rgba(8, 153, 129, 0.4)' : 'rgba(242, 54, 69, 0.4)')
          } : null)
            .filter((v): v is { time: UTCTimestamp; value: number; color: string } => v !== null);

        ma5Series.setData(formatMA(ma5));
        ma10Series.setData(formatMA(ma10));
        ma20Series.setData(formatMA(ma20));
        
        macdSeries.setData(formatData(macdLine, '#2962ff'));
        signalSeries.setData(formatData(signalLine, '#ff6d00'));
        macdHistSeries.setData(formatData(histogram));

        oiSeries.setData(formattedOI);
        fundingSeries.setData(formattedFunding);
        candleSeries.setData(formattedCandles);
        volumeSeries.setData(formattedVolume);
        liquidationMarkersRef.current = markers;
        const candleSeriesTyped = candleSeries as unknown as { setMarkers?: (input: typeof markers) => void };
        if (typeof candleSeriesTyped.setMarkers === 'function') {
          candleSeriesTyped.setMarkers(markers);
        }
        
        chart.timeScale().scrollToPosition(0, false);
      } catch (err) {
        console.error('Failed to load chart data:', err);
      } finally {
        setLoading(false);
      }
    };

    loadInitialData();

    // WebSocket 实时更新
    const ws = new WebSocket('wss://wspap.okx.com:8443/ws/v5/public');
    
    ws.onopen = () => {
      const intervalMap: Record<string, string> = {
        '1m': 'candle1m',
        '5m': 'candle5m',
        '1H': 'candle1H',
        '4H': 'candle4H',
        '1D': 'candle1D',
      };
      
      const channel = intervalMap[currentInterval] || 'candle1D';
      const subscribeMsg = {
        op: 'subscribe',
        args: [{
          channel,
          instId: instId.endsWith('-SWAP') ? instId : `${instId}-SWAP`
        }]
      };
      ws.send(JSON.stringify(subscribeMsg));
    };

    ws.onmessage = (event) => {
      const response = JSON.parse(event.data);
      if (response.data && response.data.length > 0) {
        const candle = response.data[0];
        const timestamp = (parseInt(candle[0]) / 1000) as UTCTimestamp;
        
        const newCandle = {
          time: timestamp,
          open: parseFloat(candle[1]),
          high: parseFloat(candle[2]),
          low: parseFloat(candle[3]),
          close: parseFloat(candle[4]),
        };

        const newVolume = {
          time: timestamp,
          value: parseFloat(candle[5]),
          color: parseFloat(candle[4]) >= parseFloat(candle[1]) ? 'rgba(8, 153, 129, 0.4)' : 'rgba(242, 54, 69, 0.4)',
        };

        candleSeries.update(newCandle);
        volumeSeries.update(newVolume);
      }
    };

    // 绘图系统逻辑
    chart.subscribeClick((param) => {
      const tool = drawingToolRef.current;
      if (!param.point || !tool) return;
      
      // 尝试获取点击处的时间，如果点击在空白处则映射到最近的 Bar
      const clickTime = param.time as UTCTimestamp;
      if (!clickTime) {
        // 如果点击在右侧空白区，则不触发（除非未来版本支持预测绘图）
        return;
      }
      
      const price = candleSeries.coordinateToPrice(param.point.y);
      if (price === null) return;

      const { firstPoint } = drawingStateRef.current;

      if (tool === 'hline') {
        const lineSeries = chart.addSeries(LineSeries, {
          color: '#758696',
          lineWidth: 1,
          lineStyle: LineStyle.Dotted,
          lastValueVisible: false,
          priceLineVisible: false,
          crosshairMarkerVisible: false,
        });
        const leftTime = Math.max(1, (clickTime as number) - 31536000) as UTCTimestamp;
        const rightTime = ((clickTime as number) + 31536000) as UTCTimestamp;
        lineSeries.setData([
          { time: leftTime, value: price },
          { time: rightTime, value: price },
        ]);
        setDrawings(prev => [...prev, lineSeries]);
        return;
      }

      if (!firstPoint) {
        // 记录第一个点
        drawingStateRef.current.firstPoint = { time: clickTime, price };
        
        // 创建预览系列
        if (tool === 'trendline' || tool === 'ray') {
          drawingStateRef.current.previewSeries = chart.addSeries(LineSeries, {
            color: 'rgba(41, 98, 255, 0.7)',
            lineWidth: 2,
            lineStyle: LineStyle.Dashed,
            lastValueVisible: false,
            priceLineVisible: false,
            crosshairMarkerVisible: false,
          });
          // 初始预览点 (只设一个点，避免时间重复)
          drawingStateRef.current.previewSeries.setData([
            { time: clickTime, value: price },
          ]);
        } else if (tool === 'fib') {
          const fibLevels = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];
          drawingStateRef.current.fibPreviewSeries = fibLevels.map(() => 
            chart.addSeries(LineSeries, {
              color: 'rgba(117, 134, 150, 0.4)',
              lineWidth: 1,
              lineStyle: LineStyle.Dotted,
              lastValueVisible: false,
              priceLineVisible: false,
            })
          );
        }
      } else {
        // 完成绘制
        if (tool === 'trendline') {
          // 确保时间戳升序且不重复
          if (firstPoint.time === clickTime) {
            // 如果在同一个 Bar 上点击，暂不生成线（LineSeries 不支持）
          } else {
            const lineSeries = chart.addSeries(LineSeries, {
              color: '#2962ff',
              lineWidth: 2,
              lastValueVisible: false,
              priceLineVisible: false,
              crosshairMarkerVisible: false,
            });
            const sortedData = [
              { time: firstPoint.time, value: firstPoint.price },
              { time: clickTime, value: price },
            ].sort((a, b) => (a.time as number) - (b.time as number));
            
            lineSeries.setData(sortedData);
            setDrawings(prev => [...prev, lineSeries]);
          }
        } else if (tool === 'ray') {
          if (firstPoint.time !== clickTime) {
            const raySeries = chart.addSeries(LineSeries, {
              color: '#2962ff',
              lineWidth: 2,
              lastValueVisible: false,
              priceLineVisible: false,
              crosshairMarkerVisible: false,
            });
            const t1 = firstPoint.time as number;
            const t2 = clickTime as number;
            const slope = (price - firstPoint.price) / (t2 - t1);
            const farTime = (t2 + Math.sign(t2 - t1) * 31536000) as UTCTimestamp;
            const farPrice = price + slope * ((farTime as number) - t2);
            const rayData = [
              { time: firstPoint.time, value: firstPoint.price },
              { time: clickTime, value: price },
              { time: farTime, value: farPrice },
            ].sort((a, b) => (a.time as number) - (b.time as number));
            raySeries.setData(rayData);
            setDrawings(prev => [...prev, raySeries]);
          }
        } else if (tool === 'fib') {
          if (firstPoint.time !== clickTime) {
            const fibLevels = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];
            const diff = price - firstPoint.price;
            const newFibSeries: ISeriesApi<'Line'>[] = [];

            fibLevels.forEach((level) => {
              const levelPrice = firstPoint.price + diff * level;
              const line = chart.addSeries(LineSeries, {
                color: level === 0 || level === 1 ? '#758696' : 'rgba(117, 134, 150, 0.5)',
                lineWidth: 1,
                lineStyle: LineStyle.Dotted,
                lastValueVisible: false,
                priceLineVisible: false,
                title: level.toString(),
              });
              const sortedFibData = [
                { time: firstPoint.time, value: levelPrice },
                { time: clickTime, value: levelPrice },
              ].sort((a, b) => (a.time as number) - (b.time as number));
              
              line.setData(sortedFibData);
              newFibSeries.push(line);
            });
            setDrawings(prev => [...prev, ...newFibSeries]);
          }
        }
        
        // 清理预览
        if (drawingStateRef.current.previewSeries) {
          chart.removeSeries(drawingStateRef.current.previewSeries);
          drawingStateRef.current.previewSeries = null;
        }
        drawingStateRef.current.fibPreviewSeries.forEach(s => chart.removeSeries(s));
        drawingStateRef.current.fibPreviewSeries = [];

        drawingStateRef.current.firstPoint = null;
        // 保持工具激活，但不调用 updateDrawingTool(null)，这样可以连续画线
      }
    });

    // 绘图预览逻辑 (增加防抖，避免 Maximum call stack size exceeded)
    let lastPreviewTime: UTCTimestamp | null = null;
    let lastPreviewPrice: number | null = null;

    chart.subscribeCrosshairMove((param) => {
      const tool = drawingToolRef.current;
      const { firstPoint, previewSeries, fibPreviewSeries } = drawingStateRef.current;
      
      if (!tool || !firstPoint || !param.time || !param.point) return;
      
      const currentPrice = candleSeries.coordinateToPrice(param.point.y);
      if (currentPrice === null) return;

      const currentTime = param.time as UTCTimestamp;

      // 如果坐标没变，跳过更新，减少性能开销和递归风险
      if (currentTime === lastPreviewTime && Math.abs(currentPrice - (lastPreviewPrice || 0)) < 0.0001) {
        return;
      }

      lastPreviewTime = currentTime;
      lastPreviewPrice = currentPrice;

      if ((tool === 'trendline' || tool === 'ray') && previewSeries) {
        if (firstPoint.time === currentTime) {
          previewSeries.setData([{ time: firstPoint.time, value: firstPoint.price }]);
        } else {
          if (tool === 'trendline') {
            const sortedPreview = [
              { time: firstPoint.time, value: firstPoint.price },
              { time: currentTime, value: currentPrice },
            ].sort((a, b) => (a.time as number) - (b.time as number));
            previewSeries.setData(sortedPreview);
          } else {
            const t1 = firstPoint.time as number;
            const t2 = currentTime as number;
            const slope = (currentPrice - firstPoint.price) / (t2 - t1);
            const farTime = (t2 + Math.sign(t2 - t1) * 31536000) as UTCTimestamp;
            const farPrice = currentPrice + slope * ((farTime as number) - t2);
            const rayPreview = [
              { time: firstPoint.time, value: firstPoint.price },
              { time: currentTime, value: currentPrice },
              { time: farTime, value: farPrice },
            ].sort((a, b) => (a.time as number) - (b.time as number));
            previewSeries.setData(rayPreview);
          }
        }
      } else if (tool === 'fib' && fibPreviewSeries.length > 0) {
        if (firstPoint.time !== currentTime) {
          const fibLevels = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];
          const diff = currentPrice - firstPoint.price;
          fibLevels.forEach((level, i) => {
            const levelPrice = firstPoint.price + diff * level;
            const sortedFibPreview = [
              { time: firstPoint.time, value: levelPrice },
              { time: currentTime, value: levelPrice },
            ].sort((a, b) => (a.time as number) - (b.time as number));
            fibPreviewSeries[i].setData(sortedFibPreview);
          });
        }
      }
    });

    return () => {
      window.removeEventListener('resize', handleResize);
      ws.close();
      chart.remove();
    };
  }, [instId, currentInterval]);

  // 全屏切换
  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().then(() => setIsFullscreen(true));
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false));
    }
  };

  const containerRef = useRef<HTMLDivElement>(null);

  return (
    <div 
      ref={containerRef}
      className={cn(
        "relative w-full bg-[#000000] border border-[#2a2e39] overflow-hidden flex flex-col",
        isFullscreen ? "fixed inset-0 z-[100] h-screen" : "h-[800px] rounded-lg",
        className
      )}
    >
      {/* 1. 顶部工具栏 - 100% 还原 TradingView */}
      <div className="h-[48px] bg-[#131722] border-b border-[#2a2e39] flex items-center justify-between px-2 z-30">
        <div className="flex items-center h-full gap-1">
          {/* 交易对选择 */}
          <button className="flex items-center gap-2 px-3 py-1 hover:bg-[#2a2e39] rounded text-white transition-colors">
            <span className="text-sm font-bold tracking-tighter">{instId}</span>
            <span className="text-xs text-[#089981] font-mono">+0.07%</span>
            <ChevronDown size={14} className="text-[#758696]" />
          </button>
          
          <div className="w-[1px] h-6 bg-[#2a2e39] mx-1" />

          {/* 时间周期切换 */}
          <div className="flex items-center gap-0.5">
            {timeframes.map((tf) => (
              <button
                key={tf.value}
                onClick={() => setCurrentInterval(tf.value)}
                className={cn(
                  "px-2 py-1 text-[11px] font-bold rounded transition-colors",
                  currentInterval === tf.value 
                    ? "text-[#2962ff] bg-[#2962ff]/10" 
                    : "text-[#d1d4dc] hover:bg-[#2a2e39]"
                )}
              >
                {tf.label}
              </button>
            ))}
          </div>

          <div className="w-[1px] h-6 bg-[#2a2e39] mx-1" />

          {/* 图表类型 & 指标 */}
          <div className="flex items-center gap-1">
            <button className="p-1.5 text-[#d1d4dc] hover:bg-[#2a2e39] rounded">
              <BarChart3 size={18} />
            </button>
            <button 
              onClick={() => setShowDerivative(prev => ({ ...prev, ma: !prev.ma, oi: !prev.oi, funding: !prev.funding, liq: !prev.liq }))}
              className="flex items-center gap-1 px-2 py-1 text-[12px] font-bold text-[#d1d4dc] hover:bg-[#2a2e39] rounded"
            >
              <Activity size={16} />
              <span>技术指标</span>
            </button>
            <button className="flex items-center gap-1 px-2 py-1 text-[12px] font-bold text-[#d1d4dc] hover:bg-[#2a2e39] rounded">
              <Layers size={16} />
              <span>显示设置</span>
            </button>
          </div>
        </div>

        <div className="flex items-center h-full gap-2 pr-2">
          <div className="flex items-center bg-[#2a2e39]/50 rounded p-0.5">
            <button className="px-2 py-1 text-[11px] font-bold text-[#d1d4dc] hover:bg-[#2a2e39] rounded">TradingView</button>
            <button className="px-2 py-1 text-[11px] font-bold text-[#758696] hover:bg-[#2a2e39] rounded">深度图</button>
          </div>
          <button className="p-1.5 text-[#758696] hover:text-white hover:bg-[#2a2e39] rounded transition-colors">
            <Camera size={18} />
          </button>
          <button className="p-1.5 text-[#758696] hover:text-white hover:bg-[#2a2e39] rounded transition-colors">
            <Settings size={18} />
          </button>
          <button 
            onClick={toggleFullscreen}
            className="p-1.5 text-[#758696] hover:text-white hover:bg-[#2a2e39] rounded transition-colors"
          >
            {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
          </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* 2. 左侧绘图工具栏 */}
        <div className="w-[48px] bg-[#131722] border-r border-[#2a2e39] flex flex-col items-center py-2 gap-2 z-20">
          <button 
            onClick={() => updateDrawingTool(null)}
            className={cn("p-2 rounded transition-colors", !drawingTool ? "text-[#2962ff] bg-[#2962ff]/10" : "text-[#758696] hover:bg-[#2a2e39]")}
          >
            <MousePointer2 size={20} />
          </button>
          <button 
            onClick={() => updateDrawingTool('trendline')}
            className={cn("p-2 rounded transition-colors", drawingTool === 'trendline' ? "text-[#2962ff] bg-[#2962ff]/10" : "text-[#758696] hover:text-white hover:bg-[#2a2e39]")}
            title="趋势线"
          >
            <TrendingUp size={20} />
          </button>
          <button 
            onClick={() => updateDrawingTool('ray')}
            className={cn("p-2 rounded transition-colors", drawingTool === 'ray' ? "text-[#2962ff] bg-[#2962ff]/10" : "text-[#758696] hover:text-white hover:bg-[#2a2e39]")}
            title="射线"
          >
            <ArrowUpRight size={20} />
          </button>
          <button 
            onClick={() => updateDrawingTool('hline')}
            className={cn("p-2 rounded transition-colors", drawingTool === 'hline' ? "text-[#2962ff] bg-[#2962ff]/10" : "text-[#758696] hover:text-white hover:bg-[#2a2e39]")}
            title="水平线"
          >
            <Minus size={20} />
          </button>
          <button 
            onClick={() => updateDrawingTool('fib')}
            className={cn("p-2 rounded transition-colors", drawingTool === 'fib' ? "text-[#2962ff] bg-[#2962ff]/10" : "text-[#758696] hover:text-white hover:bg-[#2a2e39]")}
            title="斐波那契回撤"
          >
            <Zap size={20} />
          </button>
          <button className="p-2 text-[#758696] hover:text-white hover:bg-[#2a2e39] rounded transition-colors">
            <CircleDot size={20} />
          </button>
          <button className="p-2 text-[#758696] hover:text-white hover:bg-[#2a2e39] rounded transition-colors">
            <ArrowRightLeft size={20} />
          </button>
          <button className="p-2 text-[#758696] hover:text-white hover:bg-[#2a2e39] rounded transition-colors">
            <Type size={20} />
          </button>
          <button className="p-2 text-[#758696] hover:text-white hover:bg-[#2a2e39] rounded transition-colors">
            <Layout size={20} />
          </button>
          <div className="mt-auto flex flex-col items-center gap-2 pb-2">
            <button className="p-2 text-[#758696] hover:text-white hover:bg-[#2a2e39] rounded transition-colors">
              <Search size={20} />
            </button>
            <button 
              onClick={() => {
                drawings.forEach(d => chartRef.current?.removeSeries(d));
                setDrawings([]);
              }}
              className="p-2 text-[#758696] hover:text-[#f23645] hover:bg-[#2a2e39] rounded transition-colors"
            >
              <Trash2 size={20} />
            </button>
          </div>
        </div>

        {/* 3. 主图表区域 */}
        <div className="flex-1 relative bg-black">
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-40">
              <div className="flex flex-col items-center gap-3">
                <div className="w-10 h-10 border-2 border-[#2962ff] border-t-transparent rounded-full animate-spin" />
                <div className="text-[#2962ff] font-mono text-[10px] tracking-widest uppercase animate-pulse">
                  Initializing Neural Link...
                </div>
              </div>
            </div>
          )}

          {/* 指标状态标签 (左上角浮动) */}
          <div className="absolute top-4 left-4 z-20 flex flex-col gap-1 pointer-events-none">
            <div className="flex items-center gap-2 text-[11px] font-bold group">
              <span className="text-white uppercase">{instId}</span>
              <span className="text-[#758696]">{currentInterval}</span>
              <div className="flex items-center gap-1.5 px-2 py-0.5 border-l border-[#2a2e39] ml-1">
                <span className="text-[#758696] font-bold uppercase tracking-tighter group-hover:text-cyan-500 transition-colors">MARK</span>
                <div className="w-1 h-1 bg-cyan-500 rounded-full animate-pulse" />
              </div>
            </div>
            {showDerivative.ma && (
              <div className="flex gap-3 text-[10px] font-mono">
                <span className="text-[#ffeb3b]">MA5: 71,074.0</span>
                <span className="text-[#2196f3]">MA10: 71,081.7</span>
                <span className="text-[#e91e63]">MA20: 70,881.8</span>
              </div>
            )}
          </div>

      {/* 绘图模式提示 */}
          {drawingTool && (
            <div className="absolute top-16 left-1/2 -translate-x-1/2 z-50 bg-[#2962ff] text-white text-[10px] px-3 py-1 rounded-full font-bold shadow-lg animate-bounce">
              {drawingTool === 'hline' ? '点击图表任意位置生成水平线' : '请在图表上点击两个点来完成绘制'}
            </div>
          )}

          <div 
            ref={chartContainerRef} 
            className={cn("w-full h-full", drawingTool && "cursor-crosshair")} 
          />

          {/* 右下角水印 */}
          <div className="absolute bottom-12 right-16 opacity-10 pointer-events-none select-none">
            <div className="text-white font-black text-6xl tracking-tighter italic">CYBER-NODE</div>
          </div>
        </div>
      </div>

      {/* 4. 底部状态栏 */}
      <div className="h-[32px] bg-[#131722] border-t border-[#2a2e39] flex items-center justify-between px-3 z-30">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            {['1日', '5日', '1月', '3月', '6月', '1年', '全部'].map(range => (
              <button key={range} className="text-[10px] font-bold text-[#758696] hover:text-white transition-colors px-1">
                {range}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-4 text-[10px] font-bold text-[#758696]">
          <div className="flex items-center gap-1">
            <Clock size={12} />
            <span>13:37:45 (UTC+8)</span>
          </div>
          <div className="flex items-center gap-2">
            <button className="hover:text-white">%</button>
            <button className="hover:text-white">log</button>
            <button className="text-[#2962ff]">自动</button>
            <Settings size={12} className="hover:text-white cursor-pointer" />
          </div>
        </div>
      </div>

      {/* 指标快速切换 (悬浮) */}
      <div className="absolute bottom-12 left-16 z-30 flex gap-2">
        <button 
          onClick={() => setShowDerivative(prev => ({ ...prev, volume: !prev.volume }))}
          className={cn(
            "px-2 py-1 rounded-md text-[10px] font-bold border transition-all backdrop-blur-md",
            showDerivative.volume ? "bg-[#2962ff]/20 border-[#2962ff] text-white" : "bg-black/40 border-[#2a2e39] text-[#758696]"
          )}
        >
          成交量
        </button>
        <button 
          onClick={() => setShowDerivative(prev => ({ ...prev, ma: !prev.ma }))}
          className={cn(
            "px-2 py-1 rounded-md text-[10px] font-bold border transition-all backdrop-blur-md",
            showDerivative.ma ? "bg-[#2962ff]/20 border-[#2962ff] text-white" : "bg-black/40 border-[#2a2e39] text-[#758696]"
          )}
        >
          MA
        </button>
        <button 
          onClick={() => setShowDerivative(prev => ({ ...prev, oi: !prev.oi }))}
          className={cn(
            "px-2 py-1 rounded-md text-[10px] font-bold border transition-all backdrop-blur-md",
            showDerivative.oi ? "bg-[#2962ff]/20 border-[#2962ff] text-white" : "bg-black/40 border-[#2a2e39] text-[#758696]"
          )}
        >
          持仓量
        </button>
        <button 
          onClick={() => setShowDerivative(prev => ({ ...prev, funding: !prev.funding }))}
          className={cn(
            "px-2 py-1 rounded-md text-[10px] font-bold border transition-all backdrop-blur-md",
            showDerivative.funding ? "bg-[#2962ff]/20 border-[#2962ff] text-white" : "bg-black/40 border-[#2a2e39] text-[#758696]"
          )}
        >
          资金费率
        </button>
        <button 
          onClick={() => setShowDerivative(prev => ({ ...prev, macd: !prev.macd }))}
          className={cn(
            "px-2 py-1 rounded-md text-[10px] font-bold border transition-all backdrop-blur-md",
            showDerivative.macd ? "bg-[#2962ff]/20 border-[#2962ff] text-white" : "bg-black/40 border-[#2a2e39] text-[#758696]"
          )}
        >
          MACD
        </button>
        <button 
          onClick={() => setShowDerivative(prev => ({ ...prev, liq: !prev.liq }))}
          className={cn(
            "px-2 py-1 rounded-md text-[10px] font-bold border transition-all backdrop-blur-md",
            showDerivative.liq ? "bg-[#2962ff]/20 border-[#2962ff] text-white" : "bg-black/40 border-[#2a2e39] text-[#758696]"
          )}
        >
          爆仓统计
        </button>
      </div>
    </div>
  );
}
