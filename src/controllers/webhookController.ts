import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { SepayWebhookPayload } from '../models/types';
import { handleSepayWebhook as processSepayWebhook } from '../services/sepayService';
import { processSellPayment } from '../services/orderService';
import { createErrorReply } from '../middlewares/errorHandler';

export async function handleSepayWebhook(
  req: FastifyRequest<{ Body: SepayWebhookPayload }>,
  reply: FastifyReply,
  app: FastifyInstance,
) {
  try {
    await processSepayWebhook(req.body);
    reply.send({ success: true });
  } catch (err) {
    app.log.error({ err }, 'sepay webhook processing error');
    reply.code(500).send({ success: false, error: 'Processing failed' });
  }
}

interface StellarIncomingBody {
  txHash: string;
  from?: string;
  to?: string;
  amount: string;
  asset: string;
  tokenIssuer?: string;
  timestamp?: string;
  walletLabel?: string;
  memo?: string;
}

export async function handleStellarIncoming(
  req: FastifyRequest<{ Body: StellarIncomingBody }>,
  reply: FastifyReply,
): Promise<void> {
  const { txHash, from, amount, asset, tokenIssuer, memo } = req.body;

  const result = await processSellPayment({ txHash, from, amount, asset, tokenIssuer, memo });

  const ignoreCodes = [
    'MEMO_INVALID_FORMAT', 'ORDER_NOT_FOUND', 'ORDER_ALREADY_COMPLETED',
    'ORDER_NOT_ELIGIBLE', 'AMOUNT_MISMATCH', 'DUPLICATE_TX',
    'ASSET_CODE_MISMATCH', 'ASSET_ISSUER_MISMATCH', 'ORDER_EXPIRED',
  ];
  if (!result.success && ignoreCodes.includes(result.error || '')) {
    return reply.send({ success: true, ignored: true });
  }

  if (!result.success) {
    return createErrorReply(reply, 'CHAIN_EVENT_MISMATCH', result.error || 'Processing failed', req.id);
  }

  return reply.send({ success: true });
}