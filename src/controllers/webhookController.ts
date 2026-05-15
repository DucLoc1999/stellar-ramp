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

interface ChainWebhookBody {
  order_key: string;
  tx_hash: string;
  amount: string;
  address: string;
  chain_id: number;
  token_address?: string;
  asset_code?: string;
}

export async function handleChainWebhook(
  req: FastifyRequest<{ Body: ChainWebhookBody }>,
  reply: FastifyReply,
): Promise<void> {
  const { order_key, tx_hash, amount, address, chain_id, token_address, asset_code } = req.body;

  const result = await processSellPayment({
    txHash: tx_hash,
    from: address,
    amount,
    asset: asset_code || 'USDC',
    tokenIssuer: token_address,
    memo: order_key,
  });

  if (!result.success) {
    return createErrorReply(reply, 'CHAIN_EVENT_MISMATCH', result.error || 'Chain event validation failed', req.id);
  }

  return reply.send({ success: true });
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