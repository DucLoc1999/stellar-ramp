import type { FastifyInstance } from 'fastify';
import { sepayAuth } from '../middlewares/sepayAuth';
import type { SepayWebhookPayload } from '../models/types';
import { handleSepayWebhook } from '../controllers/webhookController';

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
}
