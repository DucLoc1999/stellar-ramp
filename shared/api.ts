export interface ExchangeRatesResponse {
  created_at: string;
  buy: number;
  sell: number;
}

export interface P2PRate {
  bestBuyPrice: number | null;
  bestSellPrice: number | null;
}

export interface P2PHistoryPoint {
  created_at: number;
  buy: number | null;
  sell: number | null;
}
