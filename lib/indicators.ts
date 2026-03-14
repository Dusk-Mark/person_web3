export interface CandleData {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  vol: number;
}

export function calculateMA(data: CandleData[], period: number): (number | null)[] {
  const result: (number | null)[] = [];
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      result.push(null);
    } else {
      const sum = data.slice(i - period + 1, i + 1).reduce((acc, curr) => acc + curr.close, 0);
      result.push(sum / period);
    }
  }
  return result;
}

export function calculateEMA(data: number[], period: number): (number | null)[] {
  const k = 2 / (period + 1);
  const result: (number | null)[] = [];
  let ema = data[0];
  
  for (let i = 0; i < data.length; i++) {
    if (i === 0) {
      result.push(ema);
    } else {
      ema = (data[i] - ema) * k + ema;
      result.push(ema);
    }
  }
  return result;
}

export function calculateMACD(data: CandleData[], shortPeriod: number = 12, longPeriod: number = 26, signalPeriod: number = 9) {
  const closes = data.map(d => d.close);
  const emaShort = calculateEMA(closes, shortPeriod);
  const emaLong = calculateEMA(closes, longPeriod);
  
  const macdLine: (number | null)[] = [];
  for (let i = 0; i < closes.length; i++) {
    const short = emaShort[i];
    const long = emaLong[i];
    if (short !== null && long !== null) {
      macdLine.push(short - long);
    } else {
      macdLine.push(null);
    }
  }
  
  const validMacdLine = macdLine.filter(v => v !== null) as number[];
  const signalLineFull = calculateEMA(validMacdLine, signalPeriod);
  
  // Pad signalLine with nulls
  const signalLine: (number | null)[] = Array(macdLine.length - validMacdLine.length).fill(null).concat(signalLineFull);
  
  const histogram: (number | null)[] = [];
  for (let i = 0; i < macdLine.length; i++) {
    const macd = macdLine[i];
    const signal = signalLine[i];
    if (macd !== null && signal !== null) {
      histogram.push(macd - signal);
    } else {
      histogram.push(null);
    }
  }
  
  return { macdLine, signalLine, histogram };
}
