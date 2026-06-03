export interface P2PRate {
  bestBuyPrice: number | null;
  bestSellPrice: number | null;
}

export interface P2PExchangeRates {
  usdc: P2PRate;
  xlm: P2PRate;
}

export interface OurRate {
  buy: number;
  sell: number;
  fee_rate_buy: number;
  fee_rate_sell: number;
  min_fee_vnd: number;
  created_at: string;
}

export interface OurRates {
  usdc: OurRate;
  xlm: OurRate;
}

export interface AllRatesResponse {
  binance: P2PExchangeRates;
  okx: P2PExchangeRates;
  bybit: P2PExchangeRates;
  our: OurRates;
}

export interface P2PHistoryPoint {
  created_at: number;
  buy: number | null;
  sell: number | null;
}

export interface AllHistoryResponse {
  binance: P2PHistoryPoint[];
  okx: P2PHistoryPoint[];
  bybit: P2PHistoryPoint[];
  our: P2PHistoryPoint[];
}
