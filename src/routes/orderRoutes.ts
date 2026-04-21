import type { FastifyInstance } from 'fastify';
import { createBuyOrder, getOrderByCode } from '../services/orderService';

export async function orderRoutes(app: FastifyInstance): Promise<void> {
  app.post<{ Body: { usdt_amount: number } }>('/checkout', {
    schema: {
      tags: ['Orders'],
      summary: 'Create a buy order and return SePay checkout session',
      body: {
        type: 'object',
        required: ['usdt_amount'],
        properties: {
          usdt_amount: { type: 'number', minimum: 1, description: 'USDT amount to purchase' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                id: { type: 'number' },
                payment_code: { type: 'string' },
                checkout_url: { type: 'string' },
                form_fields: { type: 'object' },
                quote: { type: 'object' },
              },
            },
          },
        },
      },
    },
  }, async (req, reply) => {
    const { usdt_amount } = req.body;

    if (!usdt_amount || usdt_amount <= 0) {
      return reply.status(400).send({ success: false, error: 'usdt_amount must be a positive number' });
    }

    const data = await createBuyOrder(usdt_amount);
    reply.send({ success: true, data });
  });

  app.get<{ Params: { payment_code: string } }>('/:payment_code', {
    schema: {
      tags: ['Orders'],
      summary: 'Get order status by payment code (poll for payment confirmation)',
      params: {
        type: 'object',
        properties: {
          payment_code: { type: 'string', description: 'e.g. USDT247-A3F8B2C1' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                id: { type: 'number' },
                payment_code: { type: 'string' },
                payment_status: { type: 'string' },
                direction: { type: 'string' },
                usdt_amount: { type: 'number' },
                rate: { type: 'number' },
                net_vnd: { type: 'number' },
                fee_vnd: { type: 'number' },
                fee_rate: { type: 'number' },
                checkout_url: { type: 'string' },
                vnd_received: { type: 'number' },
                payment_confirmed_at: { type: 'string' },
                created_at: { type: 'string' },
              },
            },
          },
        },
        404: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            error: { type: 'string' },
          },
        },
      },
    },
  }, async (req, reply) => {
    const order = await getOrderByCode(req.params.payment_code);
    if (!order) return reply.status(404).send({ success: false, error: 'Order not found' });
    reply.send({ success: true, data: order });
  });
}
