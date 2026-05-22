process.env.NODE_ENV = 'test';
import { afterEach, vi } from 'vitest';

process.env.PARTNER_APP_KEY ??= 'test-partner-key';
process.env.SEPAY_WEBHOOK_API_KEY ??= 'test-sepay-key';
process.env.ADMIN_JWT_SECRET ??= 'test-secret';
process.env.CMS_CREATE_ADMIN_KEY ??= 'test-cms-create-key';
process.env.TEST_SUPPORTED_TOKEN_ISSUER ??= '0x55d398326f99059fF775485246999027B3197955';
process.env.STELLAR_HOT_WALLET_ENCRYPTION_KEY ??= '12345678901234567890123456789012';

const TEST_SUPPORTED_TOKEN_ISSUER = process.env.TEST_SUPPORTED_TOKEN_ISSUER;

function buildQuote(direction: 'buy' | 'sell', amount: number, asset: string) {
  const upperAsset = asset.toUpperCase();
  const rate = upperAsset === 'XLM' ? 4200 : 25000;
  const spread = upperAsset === 'XLM' ? 25 : 50;
  const fee_rate = 0.008;
  const gross_vnd = Math.round(amount * rate);
  const fee_vnd = Math.max(Math.round(gross_vnd * fee_rate), 5000);
  const net_vnd = direction === 'buy' ? gross_vnd + fee_vnd : gross_vnd - fee_vnd;

  return {
    direction,
    usdt_amount: amount,
    rate,
    original_rate: rate,
    spread,
    gross_vnd,
    fee_rate,
    fee_vnd,
    net_vnd,
    note: '',
  };
}

vi.mock('../src/services/priceService', () => ({
  getRate: vi.fn(async (asset: string = 'USDC') => {
    const upperAsset = asset.toUpperCase();
    const buyBase = upperAsset === 'XLM' ? 4250 : 25050;
    const sellBase = upperAsset === 'XLM' ? 4150 : 24950;
    return {
      buy_price: buyBase,
      sell_price: sellBase,
      binance_mid: Math.round((buyBase + sellBase) / 2),
      spread_buy: upperAsset === 'XLM' ? 25 : 50,
      spread_sell: upperAsset === 'XLM' ? 25 : 50,
      fee_rate_buy: 0.008,
      fee_rate_sell: 0.008,
      updated_at: '2026-01-01T00:00:00.000Z',
      cached: true,
    };
  }),
  getMinFee: vi.fn(async () => 5000),
  getQuote: vi.fn(async (direction: 'buy' | 'sell', amount: number, asset: string = 'USDC') => buildQuote(direction, amount, asset)),
}));

vi.mock('../src/services/sepayPgService', () => ({
  createSepayOrder: vi.fn(async ({ payment_code, net_vnd }: { payment_code: string; net_vnd: number }) => ({
    bank_info: {
      account_number: '1234567890',
      account_holder_name: 'TEST HOLDER',
      bank_name: 'Mock Bank',
      bank_short_name: 'MB',
    },
    qr_code_url: `https://mock.sepay.local/${payment_code}`,
    va_number: '1234567890',
    transfer_content: payment_code,
    amount: net_vnd,
  })),
  listSepayOrders: vi.fn(async () => []),
}));

vi.mock('../src/services/stellarService', () => ({
  SUPPORTED_TOKEN_ISSUER: TEST_SUPPORTED_TOKEN_ISSUER,
  DEFAULT_ASSET_CODE: 'USDC',
  checkTrustline: vi.fn(async () => ({
    exists: true,
    authorized: true,
    hasLimit: true,
    availableLimit: Number.POSITIVE_INFINITY,
  })),
  hasTrustline: vi.fn(async () => true),
  triggerDisburse: vi.fn(async () => ({ success: true, hash: 'mock-disburse-hash' })),
  disburseUSDC: vi.fn(async () => ({ success: true, hash: 'mock-disburse-hash' })),
  initStellarServer: vi.fn(async () => null),
  getHorizonAccount: vi.fn(async () => null),
  getUsdcBalance: vi.fn(async () => '0'),
  getXlmBalance: vi.fn(async () => '0'),
}));

vi.mock('../src/services/callbackService', () => ({
  fireCallback: vi.fn(async () => undefined),
}));

vi.mock('../src/services/payoutService', () => ({
  executePayout: vi.fn(async () => ({ success: true, transactionId: 'mock-payout-id' })),
}));

vi.mock('../src/services/queueService', () => ({
  emitDisburseCrypto: vi.fn(async () => undefined),
  emitOrderPaid: vi.fn(async () => undefined),
}));

afterEach(() => {
  vi.clearAllMocks();
});
