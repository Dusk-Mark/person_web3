import axios from 'axios';

const OKX_API_URL = 'https://www.okx.com';

export interface CandleData {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  vol: number;
  volCcy: number;
  volCcyQuote: number;
  confirm: string;
}

export interface TickerData {
  instId: string;
  last: string;
  open24h: string;
  high24h: string;
  low24h: string;
  volCcy24h: string;
}

export interface OpenInterestItem {
  instId: string;
  oi: string;
  ts: string;
}

export interface FundingRateItem {
  instId: string;
  fundingRate: string;
  fundingTime: string;
}

export interface LiquidationItem {
  instId: string;
  side: 'buy' | 'sell';
  bkPx: string;
  sz: string;
  ts: string;
}

export const okxClient = axios.create({
  baseURL: OKX_API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export async function getCandles(instId: string = 'BTC-USDT', bar: string = '1D', limit: string = '100', after?: string, before?: string) {
  try {
    const response = await okxClient.get('/api/v5/market/candles', {
      params: {
        instId,
        bar,
        limit,
        after,
        before,
      },
    });

    if (response.data.code !== '0') {
      throw new Error(response.data.msg);
    }

    // OKX returns data in [ts, o, h, l, c, vol, volCcy, volCcyQuote, confirm]
    return response.data.data.map((d: string[]) => ({
      time: parseInt(d[0]),
      open: parseFloat(d[1]),
      high: parseFloat(d[2]),
      low: parseFloat(d[3]),
      close: parseFloat(d[4]),
      vol: parseFloat(d[5]),
      volCcy: parseFloat(d[6]),
      volCcyQuote: parseFloat(d[7]),
      confirm: d[8],
    })).reverse(); // Reverse to get chronological order
  } catch (error) {
    console.error('Error fetching candles:', error);
    throw error;
  }
}

export async function getTickers(instIds: string[] = ['BTC-USDT', 'ETH-USDT']): Promise<TickerData[]> {
  try {
    const response = await okxClient.get('/api/v5/market/tickers', {
      params: {
        instType: 'SPOT',
      },
    });

    if (response.data.code !== '0') {
      throw new Error(response.data.msg);
    }

    const tickers = response.data.data as TickerData[];
    return tickers.filter((ticker) => instIds.includes(ticker.instId));
  } catch (error) {
    console.error('Error fetching tickers:', error);
    throw error;
  }
}

export async function getOpenInterest(instId: string = 'BTC-USDT-SWAP'): Promise<OpenInterestItem[]> {
  try {
    const response = await okxClient.get('/api/v5/public/open-interest', {
      params: {
        instId,
        instType: 'SWAP',
      },
    });
    if (response.data.code !== '0') throw new Error(response.data.msg);
    return response.data.data as OpenInterestItem[];
  } catch (error) {
    console.error('Error fetching OI:', error);
    return [];
  }
}

export async function getFundingRate(instId: string = 'BTC-USDT-SWAP'): Promise<FundingRateItem[]> {
  try {
    const response = await okxClient.get('/api/v5/public/funding-rate', {
      params: { instId },
    });
    if (response.data.code !== '0') throw new Error(response.data.msg);
    return response.data.data as FundingRateItem[];
  } catch (error) {
    console.error('Error fetching funding rate:', error);
    return [];
  }
}

export async function getLiquidationMap(instId: string = 'BTC-USDT'): Promise<LiquidationItem[]> {
  const baseAsset = instId.split('-')[0];
  
  try {
    // 1. 尝试直接获取特定合约的爆仓单 (增加 validateStatus 以防 400 抛出异常)
    const quoteAsset = instId.split('-')[1] || 'USDT';
    const swapInstId = `${baseAsset}-${quoteAsset}-SWAP`;
    
    const response = await okxClient.get('/api/v5/public/liquidation-orders', {
      params: {
        instType: 'SWAP',
        instId: swapInstId,
      },
      validateStatus: () => true, // 允许处理 400 等错误状态码而不抛出
    });

    if (response.data.code === '0' && response.data.data && response.data.data.length > 0) {
      return response.data.data as LiquidationItem[];
    }

    // 2. 降级方案：获取所有 SWAP 的最近爆仓并过滤
    // 这样做更稳健，因为不需要猜测确切的合约名称 (如币本位 vs U本位)
    const fallbackResponse = await okxClient.get('/api/v5/public/liquidation-orders', {
      params: { instType: 'SWAP' },
      validateStatus: () => true,
    });
    
    if (fallbackResponse.data.code === '0' && fallbackResponse.data.data) {
      const allLiqs = fallbackResponse.data.data as LiquidationItem[];
      return allLiqs.filter(item => item.instId.startsWith(baseAsset));
    }

    return [];
  } catch (error) {
    // 只有在网络错误或代码崩溃时才记录
    console.debug('Liquidation API quiet failure:', error);
    return [];
  }
}
