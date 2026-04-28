import { getBinancePrices } from './binanceService';
import { getConfigNumber } from './configService';

export interface RateResult {
  buy_price: number;
  sell_price: number;
  binance_mid: number;
  spread_buy: number;
  spread_sell: number;
  updated_at: string;
  cached: boolean;
}

export interface QuoteResult {
  direction: 'buy' | 'sell';
  usdt_amount: number;
  rate: number;
  gross_vnd: number;
  fee_rate: number;
  fee_vnd: number;
  net_vnd: number;
  note: string;
}

export async function getRate(): Promise<RateResult> {
  const [prices, spreadBuy, spreadSell] = await Promise.all([
    getBinancePrices(),
    getConfigNumber('spread_buy', 50),
    getConfigNumber('spread_sell', 50),
  ]);

  const binance_mid = Math.round((prices.buy + prices.sell) / 2);

  return {
    buy_price: Math.round(prices.buy + spreadBuy),
    sell_price: Math.round(prices.sell - spreadSell),
    binance_mid,
    spread_buy: spreadBuy,
    spread_sell: spreadSell,
    updated_at: new Date().toISOString(),
    cached: prices.cached,
  };
}

export async function getQuote(direction: 'buy' | 'sell', usdt_amount: number): Promise<QuoteResult> {
  const [rate, feeRateBuy, feeRateSell] = await Promise.all([
    getRate(),
    getConfigNumber('fee_rate_buy', 0.008),
    getConfigNumber('fee_rate_sell', 0.008),
  ]);

  const price = direction === 'buy' ? rate.buy_price : rate.sell_price;
  const fee_rate = direction === 'buy' ? feeRateBuy : feeRateSell;
  const gross_vnd = Math.round(usdt_amount * price);
  const fee_vnd = Math.round(gross_vnd * fee_rate);
  const net_vnd = direction === 'buy' ? gross_vnd + fee_vnd : gross_vnd - fee_vnd;

  const note =
    direction === 'buy'
      ? `Bạn cần chuyển ${net_vnd.toLocaleString('vi-VN')} VND để nhận ${usdt_amount} USDC`
      : `Bạn nhận được ${net_vnd.toLocaleString('vi-VN')} VND khi bán ${usdt_amount} USDC`;

  return { direction, usdt_amount, rate: price, gross_vnd, fee_rate, fee_vnd, net_vnd, note };
}
