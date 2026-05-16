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

  if (!result.success) {
    return createErrorReply(reply, 'CHAIN_EVENT_MISMATCH', result.error || 'Processing failed', req.id);
  }

  return reply.send({ success: true });
}