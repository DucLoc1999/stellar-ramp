import type { FastifyInstance } from 'fastify';
import { handleGetRate, handleGetXlmRate } from '../controllers/priceController';

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
            min_fee_vnd: { type: 'number' },
          },
        },
      },
    },
  }, handleGetRate);

  app.get('/xlm_vnd', {
    schema: {
      tags: ['Price'],
      summary: 'Get live XLM/VND buy and sell rates (price per 1 XLM)',
      response: {
        200: {
          type: 'object',
          properties: {
            created_at: { type: 'string' },
            buy: { type: 'number' },
            sell: { type: 'number' },
            fee_rate_buy: { type: 'number' },
            fee_rate_sell: { type: 'number' },
            min_fee_vnd: { type: 'number' },
          },
        },
      },
    },
  }, handleGetXlmRate);
}
