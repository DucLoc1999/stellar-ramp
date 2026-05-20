import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { handleGetFees, handlePatchConfig } from '../controllers/configController';
import { adminAuth } from '../middlewares/adminAuth';

export async function configRoutes(app: FastifyInstance): Promise<void> {
  app.get('/fees', {
    schema: {
      tags: ['Config'],
      summary: 'Get current spreads and fee rates (global + token-specific)',
    },
  }, handleGetFees);

  app.patch('/', {
    preHandler: adminAuth,
    schema: {
      tags: ['Config'],
      summary: 'Update spreads and fee rates (admin, global + token-specific)',
      security: [{ BearerAuth: [] }],
      body: {
        type: 'object',
        additionalProperties: false,
        properties: {
          spread_buy: { type: 'number' },
          spread_sell: { type: 'number' },
          fee_rate_buy: { type: 'number' },
          fee_rate_sell: { type: 'number' },
          usdc_spread_buy: { type: 'number' },
          usdc_spread_sell: { type: 'number' },
          usdc_fee_rate_buy: { type: 'number' },
          usdc_fee_rate_sell: { type: 'number' },
          xlm_spread_buy: { type: 'number' },
          xlm_spread_sell: { type: 'number' },
          xlm_fee_rate_buy: { type: 'number' },
          xlm_fee_rate_sell: { type: 'number' },
          usdc_min_fee: { type: 'number' },
          xlm_min_fee: { type: 'number' },
        },
      },
    },
  }, handlePatchConfig as (req: FastifyRequest, reply: FastifyReply) => Promise<void>);
}