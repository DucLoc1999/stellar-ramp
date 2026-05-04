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
      summary: 'Create a deposit order (buy USDC) — returns SePay checkout session',
      body: {
        type: 'object',
        required: ['amount', 'chain_id', 'token_address', 'recipient', 'callback'],
        properties: {
          amount: { type: 'string', description: 'USDC amount as string' },
          chain_id: { type: 'integer', description: 'Chain ID (56=BSC, 20=TRC20, 1=ERC20)' },
          token_address: { type: 'string', description: 'USDC contract address' },
          recipient: { type: 'string', description: "User's wallet to receive USDC" },
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
      summary: 'Create a withdrawal order (sell USDC) — stub, logic incomplete',
      body: {
        type: 'object',
        required: ['amount', 'chain_id', 'token_address', 'callback', 'payment_info'],
        properties: {
          amount: { type: 'string' },
          chain_id: { type: 'integer' },
          token_address: { type: 'string' },
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

  app.get<{ Params: { payment_code: string } }>('/:payment_code', {
    preHandler: partnerAuth,
    schema: {
      security: [{ PartnerAppKey: [] }],
      tags: ['Orders'],
      summary: 'Get order status by payment code',
      params: {
        type: 'object',
        properties: {
          payment_code: { type: 'string', description: 'e.g. USDC247-A3F8B2C1' },
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

  app.post<{ Params: { payment_code: string }; Body: { reason?: string } }>('/:payment_code/cancel', {
    preHandler: partnerAuth,
    schema: {
      security: [{ PartnerAppKey: [] }],
      tags: ['Orders'],
      summary: 'Cancel an order by payment code',
      params: {
        type: 'object',
        properties: {
          payment_code: { type: 'string', description: 'e.g. USDC247-A3F8B2C1' },
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

  app.get<{ Params: { payment_code: string } }>('/:payment_code/success', handleOrderSuccess);
  app.get<{ Params: { payment_code: string } }>('/:payment_code/error', handleOrderError);
  app.get<{ Params: { payment_code: string } }>('/:payment_code/cancel', handleOrderCancel);
}
