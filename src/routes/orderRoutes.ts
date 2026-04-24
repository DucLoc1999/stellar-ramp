import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import {
  type DepositRequest,
  type WithdrawalRequest,
} from '../services/orderService';
import { handleDeposit, handleWithdrawal, handleGetOrder, handleCancel } from '../controllers/orderController';
import { partnerAuth } from '../middlewares/partnerAuth';

export async function orderRoutes(app: FastifyInstance): Promise<void> {
  app.post<{ Body: DepositRequest }>('/deposit', {
    preHandler: partnerAuth,
    schema: {
      tags: ['Orders'],
      summary: 'Create a deposit order (buy USDT) — returns SePay checkout session',
      body: {
        type: 'object',
        required: ['amount', 'chain_id', 'token_address', 'recipient', 'callback'],
        properties: {
          amount: { type: 'string', description: 'USDT amount as string' },
          chain_id: { type: 'integer', description: 'Chain ID (56=BSC, 20=TRC20, 1=ERC20)' },
          token_address: { type: 'string', description: 'USDT contract address' },
          recipient: { type: 'string', description: "User's wallet to receive USDT" },
          callback: { type: 'string', description: 'Webhook URL for order state changes' },
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
      tags: ['Orders'],
      summary: 'Create a withdrawal order (sell USDT) — stub, logic incomplete',
      body: {
        type: 'object',
        required: ['amount', 'chain_id', 'token_address', 'callback', 'payment_info'],
        properties: {
          amount: { type: 'string', description: 'USDT amount as string' },
          chain_id: { type: 'integer' },
          token_address: { type: 'string' },
          callback: { type: 'string' },
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
      tags: ['Orders'],
      summary: 'Get order status by payment code',
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
            data: { type: 'object', additionalProperties: true },
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
  }, handleGetOrder);

  app.post<{ Params: { payment_code: string }; Body: { reason?: string } }>('/:payment_code/cancel', {
    preHandler: partnerAuth,
    schema: {
      tags: ['Orders'],
      summary: 'Cancel an order by payment code',
      params: {
        type: 'object',
        properties: {
          payment_code: { type: 'string', description: 'e.g. USDT247-A3F8B2C1' },
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
            error: { type: 'object' },
          },
        },
        409: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            error: { type: 'object' },
          },
        },
      },
    },
  }, handleCancel);
}
