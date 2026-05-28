import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { handleGetFees, handleGetTokenFees, handlePatchConfig } from '../controllers/configController';
import { adminAuth } from '../middlewares/adminAuth';

const tokenSideConfigSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    spread: { type: 'number' },
    fee_rate: { type: 'number' },
    min_fee: { type: 'number' },
    min_order_amount: { type: 'number' },
    max_order_amount: { type: 'number' },
    source: { type: 'string' },
  },
} as const;

const tokenFeeResponseSchema = {
  type: 'object',
  properties: {
    success: { type: 'boolean' },
    data: {
      type: 'object',
      properties: {
        token: { type: 'string' },
        buy: tokenSideConfigSchema,
        sell: tokenSideConfigSchema,
      },
    },
  },
} as const;

export async function configRoutes(app: FastifyInstance): Promise<void> {
  app.get('/fees', {
    schema: {
      tags: ['Config'],
      summary: 'Get current spreads and fee rates (global + token-specific)',
    },
  }, handleGetFees);

  app.get('/fee/:token', {
    schema: {
      tags: ['Config'],
      summary: 'Get all fee config for a token',
      params: {
        type: 'object',
        additionalProperties: false,
        properties: {
          token: { type: 'string' },
        },
      },
      response: {
        200: tokenFeeResponseSchema,
      },
    },
  }, handleGetTokenFees);

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
          USDC_buy: tokenSideConfigSchema,
          USDC_sell: tokenSideConfigSchema,
          XLM_buy: tokenSideConfigSchema,
          XLM_sell: tokenSideConfigSchema,
        },
      },
    },
  }, handlePatchConfig as (req: FastifyRequest, reply: FastifyReply) => Promise<void>);
}
