import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('getAccountBalance stub mode', () => {
  beforeEach(() => {
    delete process.env.PAYOUT_MODE;
  });

  afterEach(() => {
    vi.resetModules();
  });

  it('returns stub balance when PAYOUT_MODE=stub', async () => {
    process.env.PAYOUT_MODE = 'stub';

    const { getAccountBalance } = await import('../src/services/payoutService');
    const result = await getAccountBalance();
    expect(result.success).toBe(true);
    expect(result.balance).toBe(50000000);
    expect(result.availableBalance).toBe(45000000);
  });

  it('returns stub balance when forceStub=true even if PAYOUT_MODE=live', async () => {
    process.env.PAYOUT_MODE = 'live';

    const { getAccountBalance } = await import('../src/services/payoutService');
    const result = await getAccountBalance(true);
    expect(result.success).toBe(true);
    expect(result.balance).toBe(50000000);
    expect(result.availableBalance).toBe(45000000);
  });
});