import { PayOS } from '@payos/node';
import { getBinById } from '../config/banks';

export interface PayoutRequest {
  orderId: number;
  amount: number;
  bankId: string;
  bankAccountName: string;
  bankAccountNo: string;
  description?: string;
}

export interface PayoutResult {
  success: boolean;
  transactionId?: string;
  error?: string;
}

let payOSInstance: PayOS | null = null;

function getPayOS(): PayOS {
  if (!payOSInstance) {
    payOSInstance = new PayOS({
      clientId: process.env.PAYOS_CLIENT_ID!,
      apiKey: process.env.PAYOS_API_KEY!,
      checksumKey: process.env.PAYOS_CHECKSUM_KEY!,
    });
  }
  return payOSInstance;
}

export async function executePayout(req: PayoutRequest, forceStub = false): Promise<PayoutResult> {
  if (process.env.PAYOUT_MODE === 'stub' || forceStub) {
    await new Promise((r) => setTimeout(r, 1000));
    console.log(`[PayoutService] STUB payout for order ${req.orderId}: ${req.amount} VND to ${req.bankAccountNo}`);
    return { success: true, transactionId: `stub-${Date.now()}` };
  }

  const payOS = getPayOS();
  try {
    const bin = getBinById(Number(req.bankId)) || req.bankId;
    console.log(`[PayoutService] PAYOS payout: bin=${bin}, account=${req.bankAccountNo}, amount=${req.amount} VND`);
    const payout = await payOS.payouts.create({
      referenceId: `payout_${req.orderId}_${Date.now()}`,
      amount: req.amount,
      description: req.description || `Withdrawal ${req.orderId}`,
      toBin: bin,
      toAccountNumber: req.bankAccountNo,
      toAccountName: req.bankAccountName,
    } as any);
    console.log(`[PayoutService] PAYOS payout created: ${payout.id} for order ${req.orderId}, approvalState: ${payout.approvalState}`);
    return { success: true, transactionId: payout.id };
  } catch (err) {
    console.error(`[PayoutService] PAYOS error for order ${req.orderId}:`, err);
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message };
  }
}