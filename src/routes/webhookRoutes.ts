import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { sepayAuth } from '../middlewares/sepayAuth';
import { stellarAuth } from '../middlewares/stellarAuth';
import type { SepayWebhookPayload } from '../models/types';
import { handleSepayWebhook } from '../controllers/webhookController';
import { handleStellarIncoming } from '../controllers/webhookController';

export async function webhookRoutes(app: FastifyInstance): Promise<void> {
  app.post<{ Body: SepayWebhookPayload }>('/sepay', {
    preHandler: sepayAuth,
    schema: {
      tags: ['Webhooks'],
      summary: 'SePay bank transaction webhook — receives deposit notifications',
      security: [{ SepayWebhookKey: [] }],
      body: {
        type: 'object',
        properties: {
          id: { type: 'integer', description: 'Transaction ID on SePay' },
          gateway: { type: 'string', description: 'Bank brand name' },
          transactionDate: { type: 'string' },
          accountNumber: { type: 'string' },
          code: { type: ['string', 'null'], description: 'Payment code detected by SePay' },
          content: { type: 'string', description: 'Transfer description' },
          transferType: { type: 'string', enum: ['in', 'out'] },
          transferAmount: { type: 'integer', description: 'Amount in VND' },
          accumulated: { type: 'integer' },
          subAccount: { type: ['string', 'null'] },
          referenceCode: { type: 'string' },
          description: { type: 'string' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: { success: { type: 'boolean' } },
        },
      },
    },
  }, (req, reply) => handleSepayWebhook(req, reply, app));

  app.post<{ Body: StellarIncomingBody }>('/stellar-incoming', {
    preHandler: stellarAuth,
    schema: {
      tags: ['Webhooks'],
      summary: 'Stellar incoming webhook — fallback when Kafka unavailable',
      body: {
        type: 'object',
        required: ['txHash', 'amount', 'asset'],
        properties: {
          txHash: { type: 'string' },
          from: { type: 'string' },
          to: { type: 'string' },
          amount: { type: 'string' },
          asset: { type: 'string' },
          tokenIssuer: { type: 'string' },
          timestamp: { type: 'string' },
          walletLabel: { type: 'string' },
          memo: { type: 'string' },
        },
      },
      response: {
        200: { type: 'object', properties: { success: { type: 'boolean' } } },
        400: { type: 'object', properties: { success: { type: 'boolean' }, error: { type: 'object' } } },
      },
    },
  }, handleStellarIncoming);
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
