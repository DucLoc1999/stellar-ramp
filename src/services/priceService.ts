import { getBinancePrices } from './binanceService';
import { getConfigNumber } from './configService';

export interface RateResult {
  buy_price: number;
  sell_price: number;
  binance_mid: number;
  spread_buy: number;
  spread_sell: number;
  fee_rate_buy: number;
  fee_rate_sell: number;
  updated_at: string;
  cached: boolean;
}

export interface QuoteResult {
  direction: 'buy' | 'sell';
  usdt_amount: number;
  rate: number;
  original_rate: number;
  spread: number;
  gross_vnd: number;
  fee_rate: number;
  fee_vnd: number;
  net_vnd: number;
  note: string;
}

const DEFAULT_ASSET = 'USDC';

async function getAssetConfig(asset: string, key: string, fallback: number): Promise<number> {
  const assetKey = asset.toUpperCase();
  if (assetKey !== DEFAULT_ASSET) {
    const assetSpecific = await getConfigNumber(`${key}_${assetKey}`, -1);
    if (assetSpecific >= 0) return assetSpecific;
  }
  return getConfigNumber(key, fallback);
}

export async function getRate(asset: string = DEFAULT_ASSET): Promise<RateResult> {
  const [prices, spreadBuy, spreadSell, feeRateBuy, feeRateSell] = await Promise.all([
    getBinancePrices(asset),
    getAssetConfig(asset, 'spread_buy', 50),
    getAssetConfig(asset, 'spread_sell', 50),
    getAssetConfig(asset, 'fee_rate_buy', 0.0008),
    getAssetConfig(asset, 'fee_rate_sell', 0.0008),
  ]);

  const binance_mid = Math.round((prices.buy + prices.sell) / 2);

  return {
    buy_price: Math.round(prices.buy + spreadBuy),
    sell_price: Math.round(prices.sell - spreadSell),
    binance_mid,
    spread_buy: spreadBuy,
    spread_sell: spreadSell,
    fee_rate_buy: feeRateBuy,
    fee_rate_sell: feeRateSell,
    updated_at: new Date().toISOString(),
    cached: prices.cached,
  };
}

export const MIN_FEE_VND = parseInt(process.env.MIN_FEE_VND || '5000', 10);

export async function getQuote(direction: 'buy' | 'sell', usdt_amount: number, asset: string = DEFAULT_ASSET): Promise<QuoteResult> {
  const rate = await getRate(asset);

  const price = direction === 'buy' ? rate.buy_price : rate.sell_price;
  const original_rate = direction === 'buy' ? rate.buy_price - rate.spread_buy : rate.sell_price + rate.spread_sell;
  const spread = direction === 'buy' ? rate.spread_buy : rate.spread_sell;
  const fee_rate = direction === 'buy' ? rate.fee_rate_buy : rate.fee_rate_sell;
  const gross_vnd = Math.round(usdt_amount * price);
  const calculatedFee = Math.round(gross_vnd * fee_rate);
  const fee_vnd = Math.max(calculatedFee, MIN_FEE_VND);
  const net_vnd = direction === 'buy' ? gross_vnd + fee_vnd : gross_vnd - fee_vnd;

  const assetCode = asset.toUpperCase();
  const note =
    direction === 'buy'
      ? `Bạn cần chuyển ${net_vnd.toLocaleString('vi-VN')} VND để nhận ${usdt_amount} ${assetCode}`
      : `Bạn nhận được ${net_vnd.toLocaleString('vi-VN')} VND khi bán ${usdt_amount} ${assetCode}`;

  return { direction, usdt_amount, rate: price, original_rate, spread, gross_vnd, fee_rate, fee_vnd, net_vnd, note };
}
