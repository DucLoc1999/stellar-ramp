import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { bypassPayment } from '../services/orderService';

interface BypassPaymentBody {
  admin_key: string;
  order_id: number;
}

export async function bypassRoutes(app: FastifyInstance): Promise<void> {
  app.post<{ Body: BypassPaymentBody }>('/bypass-payment', {
    schema: {
      tags: ['Bypass'],
      summary: 'Bypass payment for buy order (admin key)',
      body: {
        type: 'object',
        required: ['admin_key', 'order_id'],
        properties: {
          admin_key: { type: 'string' },
          order_id: { type: 'integer' },
        },
      },
    },
  }, async (req, reply) => {
    const { admin_key, order_id } = req.body;
    const result = await bypassPayment(admin_key, order_id);
    if (result.error) {
      return reply.status(400).send({ success: false, error: result.error });
    }
    return reply.send({ success: true });
  });
}