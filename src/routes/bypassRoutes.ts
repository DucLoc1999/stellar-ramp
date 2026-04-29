import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { bypassPayment } from '../services/orderService';

interface BypassPaymentBody {
  admin_key: string;
  payment_code: string;
}

export async function bypassRoutes(app: FastifyInstance): Promise<void> {
  app.post<{ Body: BypassPaymentBody }>('/bypass-payment', {
    schema: {
      tags: ['Bypass'],
      summary: 'Bypass payment for buy order (admin key)',
      body: {
        type: 'object',
        required: ['admin_key', 'payment_code'],
        properties: {
          admin_key: { type: 'string' },
          payment_code: { type: 'string' },
        },
      },
    },
  }, async (req, reply) => {
    const { admin_key, payment_code } = req.body;
    const result = await bypassPayment(admin_key, payment_code);
    if (result.error) {
      return reply.status(400).send({ success: false, error: result.error });
    }
    return reply.send({ success: true });
  });
}