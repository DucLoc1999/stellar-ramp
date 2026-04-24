import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { sepayAuth } from '../middlewares/sepayAuth';
import { chainWebhookAuth } from '../middlewares/chainWebhookAuth';
import type { SepayWebhookPayload } from '../models/types';
import { handleSepayWebhook } from '../controllers/webhookController';
import { handleChainWebhook } from '../controllers/webhookController';

export async function webhookRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', sepayAuth);

  app.post<{ Body: SepayWebhookPayload }>('/sepay', {
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

  app.post<{ Body: ChainWebhookBody }>('/chain', {
    preHandler: chainWebhookAuth,
    schema: {
      tags: ['Webhooks'],
      summary: 'Chain webhook — receives external chain events (USDT received at hot wallet)',
      body: {
        type: 'object',
        required: ['order_key', 'tx_hash', 'amount', 'address', 'chain_id'],
        properties: {
          order_key: { type: 'string', description: 'Payment code (e.g. USD247-XXXXXXXX)' },
          tx_hash: { type: 'string', description: 'Stellar transaction hash' },
          amount: { type: 'string', description: 'USDT amount received' },
          address: { type: 'string', description: 'Destination address (hot wallet)' },
          chain_id: { type: 'integer', description: 'Chain ID (56=BSC, 20=TRC20, 1=ERC20)' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: { success: { type: 'boolean' } },
        },
        400: {
          type: 'object',
          properties: { success: { type: 'boolean' }, error: { type: 'object' } },
        },
      },
    },
  }, handleChainWebhook);
}

interface ChainWebhookBody {
  order_key: string;
  tx_hash: string;
  amount: string;
  address: string;
  chain_id: number;
}
