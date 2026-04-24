import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { SepayWebhookPayload } from '../models/types';
import { handleSepayWebhook as processSepayWebhook } from '../services/sepayService';
import { handleChainEvent } from '../services/orderService';
import { createErrorReply } from '../middlewares/errorHandler';

export async function handleSepayWebhook(
  req: FastifyRequest<{ Body: SepayWebhookPayload }>,
  reply: FastifyReply,
  app: FastifyInstance,
) {
  try {
    await processSepayWebhook(req.body);
  } catch (err) {
    app.log.error({ err }, 'sepay webhook processing error');
  }
  reply.send({ success: true });
}

interface ChainWebhookBody {
  order_key: string;
  tx_hash: string;
  amount: string;
  address: string;
  chain_id: number;
}

export async function handleChainWebhook(
  req: FastifyRequest<{ Body: ChainWebhookBody }>,
  reply: FastifyReply,
): Promise<void> {
  const { order_key, tx_hash, amount, address, chain_id } = req.body;

  const result = await handleChainEvent({
    paymentCode: order_key,
    txHash: tx_hash,
    amount,
    address,
    chainId: chain_id,
  });

  if (!result.success) {
    return createErrorReply(reply, 'CHAIN_EVENT_MISMATCH', result.error || 'Chain event validation failed', req.id);
  }

  return reply.send({ success: true });
}