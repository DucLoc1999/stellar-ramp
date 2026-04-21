import type { FastifyInstance } from 'fastify';
import { getRate } from '../services/priceService';

export async function priceRoutes(app: FastifyInstance): Promise<void> {
  app.get('/rate', {
    schema: {
      tags: ['Price'],
      summary: 'Get live USDT/VND buy and sell rates (price per 1 USDT)',
      response: {
        200: {
          type: 'object',
          properties: {
            created_at: { type: 'string' },
            buy: { type: 'number' },
            sell: { type: 'number' },
          },
        },
      },
    },
  }, async (_req, reply) => {
    const rate = await getRate();
    reply.send({
      created_at: rate.updated_at,
      buy: rate.buy_price,
      sell: rate.sell_price,
    });
  });
}
