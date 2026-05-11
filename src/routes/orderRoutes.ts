import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import {
  type DepositRequest,
  type WithdrawalRequest,
} from '../services/orderService';
import { handleDeposit, handleWithdrawal, handleGetOrder, handleCancel, handleOrderSuccess, handleOrderError, handleOrderCancel } from '../controllers/orderController';
import { partnerAuth } from '../middlewares/partnerAuth';

export async function orderRoutes(app: FastifyInstance): Promise<void> {
  app.post<{ Body: DepositRequest }>('/deposit', {
    preHandler: partnerAuth,
    schema: {
      security: [{ PartnerAppKey: [] }],
      tags: ['Orders'],
      summary: 'Create a deposit order (buy USDC/XLM) — returns SePay checkout session',
      body: {
        type: 'object',
        required: ['amount', 'chain_id', 'asset_code', 'recipient', 'callback'],
        properties: {
          amount: { type: 'string', description: 'Amount as string' },
          chain_id: { type: 'integer', description: 'Chain ID (1=Stellar testnet, 0=Stellar mainnet)' },
          token_address: { type: 'string', description: 'Token issuer (required for USDC, empty for XLM native)' },
          asset_code: { type: 'string', description: 'Token code (e.g. USDC, XLM)' },
          recipient: { type: 'string', description: "User's wallet to receive tokens" },
          callback: { type: 'string', description: 'Webhook URL for order state changes' },
          user_id: { type: 'string', description: 'Optional client user ID' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { type: 'object', additionalProperties: true },
          },
        },
      },
    },
  }, handleDeposit);

  app.post<{ Body: WithdrawalRequest }>('/withdrawal', {
    preHandler: partnerAuth,
    schema: {
      security: [{ PartnerAppKey: [] }],
      tags: ['Orders'],
      summary: 'Create a withdrawal order (sell USDC/XLM) — stub, logic incomplete',
      body: {
        type: 'object',
        required: ['amount', 'chain_id', 'asset_code', 'callback', 'payment_info'],
        properties: {
          amount: { type: 'string' },
          chain_id: { type: 'integer' },
          token_address: { type: 'string', description: 'Token issuer (required for USDC, empty for XLM native)' },
          asset_code: { type: 'string', description: 'Token code (e.g. USDC, XLM)' },
          callback: { type: 'string' },
          user_id: { type: 'string' },
          payment_info: {
            type: 'object',
            required: ['bank_id', 'full_name', 'account_type', 'account_number'],
            properties: {
              bank_id: { type: 'string', description: 'Bank name (MBBank, Techcombank, etc.)' },
              full_name: { type: 'string', description: 'Account holder name (no accents)' },
              account_type: { type: 'integer' },
              account_number: { type: 'string' },
            },
          },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { type: 'object', additionalProperties: true },
          },
        },
      },
    },
  }, handleWithdrawal);

  app.get<{ Params: { id: string } }>('/:id', {
    preHandler: partnerAuth,
    schema: {
      security: [{ PartnerAppKey: [] }],
      tags: ['Orders'],
      summary: 'Get order status by ID',
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Order ID (numeric)' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { type: 'object', additionalProperties: true },
          },
        },
        404: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            error: {
              type: 'object',
              properties: {
                code: { type: 'string' },
                message: { type: 'string' },
                retriable: { type: 'boolean' },
                trace_id: { type: 'string' },
              },
            },
          },
        },
      },
    },
  }, handleGetOrder);

  app.post<{ Params: { id: string }; Body: { reason?: string } }>('/:id/cancel', {
    preHandler: partnerAuth,
    schema: {
      security: [{ PartnerAppKey: [] }],
      tags: ['Orders'],
      summary: 'Cancel an order by ID',
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Order ID (numeric)' },
        },
      },
      body: {
        type: 'object',
        properties: {
          reason: { type: 'string', description: 'Optional cancellation reason' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { type: 'object' },
          },
        },
        404: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            error: {
              type: 'object',
              properties: {
                code: { type: 'string' },
                message: { type: 'string' },
                retriable: { type: 'boolean' },
                trace_id: { type: 'string' },
              },
            },
          },
        },
        409: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            error: {
              type: 'object',
              properties: {
                code: { type: 'string' },
                message: { type: 'string' },
                retriable: { type: 'boolean' },
                trace_id: { type: 'string' },
              },
            },
          },
        },
      },
    },
  }, handleCancel);

  app.get<{ Params: { id: string } }>('/:id/success', handleOrderSuccess);
  app.get<{ Params: { id: string } }>('/:id/error', handleOrderError);
  app.get<{ Params: { id: string } }>('/:id/cancel', handleOrderCancel);
}
