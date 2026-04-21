import type { FastifyInstance } from 'fastify';
import { sepayAuth } from '../middlewares/sepayAuth';
import { handleSepayIpn, type SepayIpnPayload } from '../services/sepayService';

export async function sepayWebhookRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', sepayAuth);

  app.post<{ Body: SepayIpnPayload }>('/sepay', {
    schema: {
      tags: ['Webhooks'],
      summary: 'SePay IPN — notifies on ORDER_PAID events',
      security: [{ SepayKey: [] }],
      body: {
        type: 'object',
        properties: {
          timestamp: { type: 'number' },
          notification_type: { type: 'string' },
          order: {
            type: 'object',
            properties: {
              order_invoice_number: { type: 'string' },
              order_status: { type: 'string' },
              order_amount: { type: 'string' },
              order_currency: { type: 'string' },
            },
          },
          transaction: {
            type: 'object',
            properties: {
              transaction_id: { type: 'string' },
              transaction_status: { type: 'string' },
              transaction_amount: { type: 'string' },
              transaction_currency: { type: 'string' },
              payment_method: { type: 'string' },
            },
          },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: { success: { type: 'boolean' } },
        },
      },
    },
  }, async (req, reply) => {
    // Always return 200 — SePay retries on non-200
    try {
      await handleSepayIpn(req.body);
    } catch (err) {
      app.log.error({ err }, 'sepay IPN processing error');
    }
    reply.send({ success: true });
  });
}
