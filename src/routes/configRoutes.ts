import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { handleGetFees, handlePatchConfig } from '../controllers/configController';
import { adminAuth } from '../middlewares/adminAuth';

export async function configRoutes(app: FastifyInstance): Promise<void> {
  app.get('/fees', {
    schema: {
      tags: ['Config'],
      summary: 'Get current spreads and fee rates',
    },
  }, handleGetFees);

  app.patch('/', {
    preHandler: adminAuth,
    schema: {
      tags: ['Config'],
      summary: 'Update spreads and fee rates (admin)',
      security: [{ BearerAuth: [] }],
      body: {
        type: 'object',
        additionalProperties: false,
        properties: {
          spread_buy: { type: 'number' },
          spread_sell: { type: 'number' },
          fee_rate_buy: { type: 'number' },
          fee_rate_sell: { type: 'number' },
        },
      },
    },
  }, handlePatchConfig as (req: FastifyRequest, reply: FastifyReply) => Promise<void>);
}
