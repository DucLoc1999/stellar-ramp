import type { FastifyInstance } from 'fastify';
import { handleGetRate } from '../controllers/priceController';

export async function priceRoutes(app: FastifyInstance): Promise<void> {
  app.get('/usdt_vnd', {
    schema: {
      tags: ['Price'],
      summary: 'Get live USDC/VND buy and sell rates (price per 1 USDC)',
      response: {
        200: {
          type: 'object',
          properties: {
            created_at: { type: 'string' },
            buy: { type: 'number' },
            sell: { type: 'number' },
            fee_rate_buy: { type: 'number' },
            fee_rate_sell: { type: 'number' },
          },
        },
      },
    },
  }, handleGetRate);
}
