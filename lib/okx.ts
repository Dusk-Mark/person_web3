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
  // 爆仓订单接口通常需要 SWAP 类型的 instId
  const swapInstId = instId.includes('-SWAP') ? instId : `${instId.split('-')[0]}-${instId.split('-')[1]}-SWAP`;
  
  try {
    const response = await okxClient.get('/api/v5/public/liquidation-orders', {
      params: {
        instType: 'SWAP',
        instId: swapInstId,
      },
    });

    if (response.data.code !== '0') {
      // 如果报错内容包含“不存在”或“非法参数”，尝试只传 instType 获取最近所有爆仓
      if (response.data.code === '51001' || response.data.code === '51015') {
        const fallbackResponse = await okxClient.get('/api/v5/public/liquidation-orders', {
          params: { instType: 'SWAP' },
        });
        if (fallbackResponse.data.code === '0') {
          return (fallbackResponse.data.data as LiquidationItem[]).filter((item) => item.instId === swapInstId);
        }
      }
      return [];
    }

    return response.data.data as LiquidationItem[];
  } catch {
    return [];
  }
}
