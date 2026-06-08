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
      summary: 'Create a deposit order (buy USDC/XLM)',
      description: 'Creates a buy order. Returns SePay checkout session with bank transfer details. Order expires after 5 minutes (configurable via ORDER_EXPIRY_MINUTES). On creation, a callback is fired with order_state=CREATED. User must transfer VND to SePay with payment code as transfer content.',
      body: {
        type: 'object',
        required: ['amount', 'chain_id', 'asset_code', 'recipient', 'callback'],
        properties: {
          amount: { type: 'string', description: 'Amount of crypto to buy (e.g. "100"). Must be positive number string.' },
          chain_id: { type: 'integer', description: 'Stellar chain: 1=testnet, 0=mainnet' },
          token_address: { type: 'string', description: 'Token issuer address. Required for USDC. Use empty string "" for XLM native.' },
          asset_code: { type: 'string', description: 'Token code: "USDC" or "XLM"' },
          recipient: { type: 'string', description: "User's Stellar wallet (G...) to receive tokens. Must have USDC trustline for USDC deposits." },
          callback: { type: 'string', description: 'HTTPS webhook URL. Called on every order state change with HMAC signature.' },
          user_id: { type: 'string', description: 'Optional client-side user ID for tracking.' },
        },
      },
      response: {
        200: {
          type: 'object',
          description: 'Order created. Use `body.bankInfo` to show bank transfer details.',
          properties: {
            success: { type: 'boolean' },
            data: { type: 'object', additionalProperties: true },
          },
        },
        400: {
          type: 'object',
          description: 'Validation or business logic error.',
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
  }, handleDeposit);

  app.post<{ Body: WithdrawalRequest }>('/withdrawal', {
    preHandler: partnerAuth,
    schema: {
      security: [{ PartnerAppKey: [] }],
      tags: ['Orders'],
      summary: 'Create a withdrawal order (sell USDC/XLM)',
      description: 'Creates a sell order. Client must send crypto to hot wallet address (`pay_data.address`) with payment code as Stellar memo. Order expires after 5 minutes.',
      body: {
        type: 'object',
        required: ['amount', 'chain_id', 'asset_code', 'callback', 'payment_info'],
        properties: {
          amount: { type: 'string', description: 'Amount of crypto to sell. Must be positive number string.' },
          chain_id: { type: 'integer', description: 'Stellar chain: 1=testnet, 0=mainnet' },
          token_address: { type: 'string', description: 'Token issuer. Required for USDC. Use empty string "" for XLM native.' },
          asset_code: { type: 'string', description: 'Token code: "USDC" or "XLM"' },
          callback: { type: 'string', description: 'HTTPS webhook URL. Called on every order state change with HMAC signature.' },
          user_id: { type: 'string', description: 'Optional client-side user ID.' },
          payment_info: {
            type: 'object',
            required: ['bank_id', 'full_name', 'account_type', 'account_number'],
            description: 'Bank account for VND payout.',
            properties: {
              bank_id: { type: 'string', description: 'Bank BIN (e.g. "970422" for MBBank)' },
              full_name: { type: 'string', description: 'Account holder name (no accents, no special chars)' },
              account_type: { type: 'integer', description: 'Account type: 0=khong thuong (checking), 1=atm, 2=tin dung' },
              account_number: { type: 'string', description: 'Bank account number' },
            },
          },
        },
      },
      response: {
        200: {
          type: 'object',
          description: 'Order created. Use `pay_data.address` for crypto transfer and `code` as memo.',
          properties: {
            success: { type: 'boolean' },
            data: { type: 'object', additionalProperties: true },
          },
        },
        400: {
          type: 'object',
          description: 'Validation or business logic error.',
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
  }, handleWithdrawal);

  app.get<{ Params: { id: string } }>('/:id', {
    preHandler: partnerAuth,
    schema: {
      security: [{ PartnerAppKey: [] }],
      tags: ['Orders'],
      summary: 'Get order status',
      description: 'Fetches current order state and details. Accepts numeric order ID or payment code (e.g. DHA1B2C3D4E5).',
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Order ID (numeric) or payment code (e.g. DHA1B2C3D4E5)' },
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
          description: 'Order not found.',
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
      summary: 'Cancel an order',
      description: 'Cancels an order. Only orders in CREATED(1) state, or PROCESSING(2) without irreversible steps (no sepay_transaction_id), can be cancelled.',
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Order ID (numeric) or payment code (e.g. DHA1B2C3D4E5)' },
        },
      },
      body: {
        type: 'object',
        properties: {
          reason: { type: 'string', description: 'Optional cancellation reason (logged, not shown to user).' },
        },
      },
      response: {
        200: {
          type: 'object',
          description: 'Order cancelled successfully.',
          properties: {
            success: { type: 'boolean' },
            data: { type: 'object' },
          },
        },
        404: {
          type: 'object',
          description: 'Order not found.',
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
          description: 'Order cannot be cancelled (e.g. already processing, crypto received).',
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

  app.get<{ Params: { id: string } }>('/:id/success', {
    schema: {
      tags: ['Orders'],
      summary: 'Order success redirect',
      description: 'Redirects to frontend order status page with payment=success query param. Accepts order ID or payment code.',
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Order ID or payment code' },
        },
      },
      response: { 302: { type: 'null', description: 'Redirect to ${DOMAIN}/order/{code}?payment=success' } },
    },
  }, handleOrderSuccess);
  app.get<{ Params: { id: string } }>('/:id/error', {
    schema: {
      tags: ['Orders'],
      summary: 'Order error redirect',
      description: 'Redirects to frontend order status page with payment=error query param. Accepts order ID or payment code.',
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Order ID or payment code' },
        },
      },
      response: { 302: { type: 'null', description: 'Redirect to ${DOMAIN}/order/{code}?payment=error' } },
    },
  }, handleOrderError);
  app.get<{ Params: { id: string } }>('/:id/cancel', {
    schema: {
      tags: ['Orders'],
      summary: 'Order cancel redirect',
      description: 'Redirects to frontend order status page with payment=cancel query param. Accepts order ID or payment code.',
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Order ID or payment code' },
        },
      },
      response: { 302: { type: 'null', description: 'Redirect to ${DOMAIN}/order/{code}?payment=cancel' } },
    },
  }, handleOrderCancel);
}
