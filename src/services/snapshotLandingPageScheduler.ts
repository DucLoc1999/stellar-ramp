import * as crypto from 'crypto';
import { insertSnapshot, type Exchange } from './snapshotLandingPageDb';
import { getRate } from './priceService';
import { logger } from '../config/logger';

const INTERVAL_MS = 60_000;

interface BinanceApiResponse {
  data?: Array<{ adv: { price: string } }>;
}

interface BybitApiResponse {
  ret_code: number;
  result?: { items?: Array<{ price: string }> };
}

interface OkxIndexResponse {
  data?: Array<{ idxPx?: string }>;
}

interface UsdRateResponse {
  rates: { VND: number };
}

async function fetchBinancePrices(): Promise<{ buy: number | null; sell: number | null }> {
  const url = 'https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search';

  async function fetchSide(tradeType: 'BUY' | 'SELL'): Promise<number | null> {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        asset: 'USDC',
        fiat: 'VND',
        merchantCheck: true,
        page: 1,
        payTypes: [],
        publisherType: 'merchant',
        rows: 20,
        tradeType,
        transAmount: '150000000',
      }),
    });
    const data = (await response.json()) as BinanceApiResponse;
    if (!data.data?.length) return null;
    const prices = data.data.map((item) => Number(item.adv.price));
    return tradeType === 'BUY' ? Math.min(...prices) : Math.max(...prices);
  }

  const [buy, sell] = await Promise.all([fetchSide('BUY'), fetchSide('SELL')]);
  return { buy, sell };
}
async function fetchOkxPrices(): Promise<{ buy: number | null; sell: number | null }> {
  const HANOI_PREMIUM = 412;

  function getSignature(secretKey: string, timestamp: string, method: string, path: string): string {
    return crypto.createHmac('sha256', secretKey).update(timestamp + method + path).digest('base64');
  }

  const timestamp = new Date().toISOString();
  const path = '/api/v5/market/index-tickers?instId=USDC-USD';
  const response = await fetch(`https://www.okx.com${path}`, {
    headers: {
      'OK-ACCESS-KEY': process.env.OKX_API_KEY!,
      'OK-ACCESS-SIGN': getSignature(process.env.OKX_SECRET_KEY!, timestamp, 'GET', path),
      'OK-ACCESS-TIMESTAMP': timestamp,
      'OK-ACCESS-PASSPHRASE': process.env.OKX_PASSPHRASE!,
    },
  });
  const json = (await response.json()) as OkxIndexResponse;
  const usdcPeg = parseFloat(json.data?.[0]?.idxPx || '1.0000');

  const rateRes = await fetch('https://api.exchangerate-api.com/v4/latest/USD');
  const rateJson = (await rateRes.json()) as UsdRateResponse;
  const bankRate = rateJson.rates.VND;

  const marketMid = bankRate * usdcPeg + HANOI_PREMIUM;
  const buy = Math.round(marketMid * 1.0016);
  const sell = Math.round(marketMid * 0.9984);
  return { buy, sell };
}

async function fetchBybitPrices(): Promise<{ buy: number | null; sell: number | null }> {
  const headers = {
    'Content-Type': 'application/json',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    Accept: 'application/json',
  };

  async function fetchSide(isBuying: boolean): Promise<number | null> {
    const response = await fetch('https://api2.bybit.com/fiat/otc/item/online', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        tokenId: 'USDC',
        currencyId: 'VND',
        side: isBuying ? '1' : '0',
        size: '10',
        page: '1',
        amount: '',
        authMaker: true,
        canTrade: false,
      }),
    });
    const json = (await response.json()) as BybitApiResponse;
    if (json.ret_code !== 0 || !json.result?.items?.length) return null;
    return Number(json.result.items[0].price);
  }

  const [buy, sell] = await Promise.all([fetchSide(true), fetchSide(false)]);
  return { buy, sell };
}

async function fetchOurPrices(): Promise<{ buy: number; sell: number }> {
  const rate = await getRate();
  return { buy: rate.buy_price, sell: rate.sell_price };
}

function recordPrices(exchange: Exchange, prices: { buy: number | null; sell: number | null }): void {
  if (prices.buy !== null) {
    insertSnapshot({ exchange, trade_type: 'buy', asset: 'USDC', fiat: 'VND', best_price: prices.buy });
  }
  if (prices.sell !== null) {
    insertSnapshot({ exchange, trade_type: 'sell', asset: 'USDC', fiat: 'VND', best_price: prices.sell });
  }
}

async function tick(): Promise<void> {
  const results = await Promise.allSettled([
    fetchBinancePrices().then((p) => recordPrices('binance', p)),
    fetchOkxPrices().then((p) => recordPrices('okx', p)),
    fetchBybitPrices().then((p) => recordPrices('bybit', p)),
    fetchOurPrices().then((p) => recordPrices('our', p)),
  ]);

  for (const r of results) {
    if (r.status === 'rejected') {
      logger.warn({ err: r.reason }, 'Snapshot fetch failed for one exchange');
    }
  }
}

export function startSnapshotScheduler(): NodeJS.Timeout {
  logger.info('Snapshot scheduler started (interval: 60s)');
  tick();
  return setInterval(tick, INTERVAL_MS);
}
