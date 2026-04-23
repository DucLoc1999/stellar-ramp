export interface AppConfig {
  port: number;
  host: string;
  nodeEnv: string;
}

export const OrderState = {
  CREATED: 1,
  PROCESSING: 2,
  COMPLETED: 3,
  FAILED: 4,
  CANCELLED: 5,
} as const;

export interface DepositRequest {
  amount: string;
  chain_id: number;
  token_address: string;
  recipient: string;
  callback: string;
}

export interface WithdrawalRequest {
  amount: string;
  chain_id: number;
  token_address: string;
  callback: string;
  payment_info: {
    bank_id: string;
    full_name: string;
    account_type: number;
    account_number: string;
  };
}

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

export interface SepayWebhookPayload {
  id: number;
  gateway: string;
  transactionDate: string;
  accountNumber: string;
  code: string | null;
  content: string;
  transferType: 'in' | 'out';
  transferAmount: number;
  accumulated: number;
  subAccount: string | null;
  referenceCode: string;
  description: string;
}
