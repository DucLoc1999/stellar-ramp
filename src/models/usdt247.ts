export interface Usdt247Timestamp {
  seconds: number;
  nanos: number;
}

export interface Usdt247BankInfo {
  bankAccountName?: string;
  bankAccountNumber?: string;
  bankId?: string;
  bankName?: string;
  transferContent?: string;
  vaAmount?: number;
}

export interface Usdt247ResponseBody {
  bank_id?: number;
  full_name?: string;
  account_type?: number;
  account_number?: string;
  amount?: string;
  qr_code?: string;
  qr_link?: string;
  qr_data?: string;
  bankInfo?: Usdt247BankInfo;
  transferContent?: string;
  vaAmount?: number;
}

export interface Usdt247PayData {
  address?: string;
  amount?: string;
  chain_id?: string;
  token_address?: string;
  qr_code?: string;
  qr_link?: string;
}

export interface Usdt247PaymentInfo {
  bank_id: string;
  full_name: string;
  account_type: number;
  account_number: string;
}

export interface Usdt247Order {
  id: string;
  user_id: string;
  order_type: 'buy' | 'sell';
  external_id: string | null;
  code: string;
  provider: string;
  callback: string;
  amount: number;
  currency: string;
  rate: number;
  token_address: string;
  recipient: string;
  chain_id: number;
  partner_id: string | null;
  state: number;
  processing_state: number;
  body: Usdt247ResponseBody | null;
  pay_data: Usdt247PayData | null;
  payment_info: Usdt247PaymentInfo | null;
  expired_at: Usdt247Timestamp;
  created_at: Usdt247Timestamp;
  updated_at: Usdt247Timestamp;
  client_ip: string;
  outcome: string;
  original_rate: number;
  total_fee_vnd: number;
}
