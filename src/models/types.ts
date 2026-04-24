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

export interface Usdt247Timestamp {
  seconds: number;
  nanos: number;
}

export interface Usdt247Order {
  id: string;
  user_id: string | null;
  order_type: 'buy' | 'sell';
  external_id: string | null;
  code: string;
  provider: string;
  callback: string;
  amount: number;
  currency: string;
  rate: number;
  token_address: string;
  recipient: string | null;
  chain_id: number;
  partner_id: string | null;
  state: number;
  processing_state: number | null;
  body: Record<string, unknown> | null;
  pay_data: Record<string, unknown> | null;
  payment_info: Record<string, unknown> | null;
  expired_at: Usdt247Timestamp;
  created_at: Usdt247Timestamp;
  updated_at: Usdt247Timestamp;
  client_ip: string | null;
  outcome: string | null;
  original_rate: number;
  total_fee_vnd: number;
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
