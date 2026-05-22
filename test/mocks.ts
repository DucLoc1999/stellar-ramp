import { vi } from 'vitest';

// Mock Stellar service - trustline checks
export const mockCheckTrustline = vi.fn(async (recipient: string, assetCode: string, tokenAddress: string, amount: string) => ({
  exists: true,
  hasLimit: true,
  availableLimit: '1000000',
}));

// Mock order service dependencies - SePay integration
export const mockCreateBuyOrder = vi.fn(async (amount: number, assetCode: string) => ({
  payment_code: `USDC247-${Math.random().toString(36).substring(2, 10).toUpperCase()}`,
  sepayOrder: {
    id: 99001,
    va_number: 'VA123456789',
    transfer_content: `USDC247-${Math.random().toString(36).substring(2, 10).toUpperCase()}`,
    amount: Math.round(amount * 23500), // VND
    qr_code: 'https://qr.example.com',
    qr_link: 'https://qr.example.com',
    body: {
      bankInfo: {
        bank_id: 'MBBank',
        account_number: '1234567890',
        account_name: 'Payment Service',
      },
    },
  },
}));

// Mock withdrawal order
export const mockCreateSellOrder = vi.fn(async (amount: number, assetCode: string) => ({
  payment_code: `USDC247-${Math.random().toString(36).substring(2, 10).toUpperCase()}`,
  order_id: Math.floor(Math.random() * 1000000),
}));

// Mock price service
export const mockGetPrice = vi.fn(async (type: 'buy' | 'sell') => ({
  buy: 23500,
  sell: 23400,
  cached: false,
}));

// Mock Binance service
export const mockGetBinancePrice = vi.fn(async () => ({
  buy: 23500,
  sell: 23400,
}));

// Mock admin service - password hashing
export const mockHashPassword = vi.fn(async (password: string) => `hashed_${password}`);
export const mockVerifyPassword = vi.fn(async (password: string, hash: string) => hash === `hashed_${password}`);

// Setup all mocks - call this in test setup
export function setupAllMocks() {
  vi.mock('../src/services/stellarService', () => ({
    checkTrustline: mockCheckTrustline,
    loadHotWallet: vi.fn(async () => ({ publicKey: () => 'GXXXXXX' })),
    disburseUSDC: vi.fn(async () => ({ id: 'tx123' })),
  }));

  vi.mock('../src/services/orderService', async () => {
    const actual = await vi.importActual('../src/services/orderService');
    return {
      ...actual,
      createBuyOrder: mockCreateBuyOrder,
      createSellOrder: mockCreateSellOrder,
    };
  });

  vi.mock('../src/services/priceService', () => ({
    getPrice: mockGetPrice,
  }));

  vi.mock('../src/services/binanceService', () => ({
    getBinancePrice: mockGetBinancePrice,
  }));

  vi.mock('../src/services/adminService', () => ({
    hashPassword: mockHashPassword,
    verifyPassword: mockVerifyPassword,
  }));
}
