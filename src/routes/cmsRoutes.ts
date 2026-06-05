import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { handleCmsLogin, handleCreateAdmin, handleGetConfig, handlePatchCmsConfig, handleGetRates, handleGetAuditLog, handleChangePassword, handleGetBuyOrders, handleGetSellOrders } from '../controllers/cmsController';
import { handleCreatePartner, handleGetPartner, handleListPartners } from '../controllers/partnerController';
import { adminAuth } from '../middlewares/adminAuth';

export async function cmsRoutes(app: FastifyInstance): Promise<void> {
  app.post('/login', {
    schema: {
      tags: ['CMS'],
      summary: 'CMS admin login (JWT)',
      body: {
        type: 'object',
        additionalProperties: false,
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', format: 'email' },
          password: { type: 'string' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                access_token: { type: 'string' },
                token_type: { type: 'string' },
                expires_in: { type: 'number' },
              },
            },
          },
        },
      },
    },
  }, handleCmsLogin as (req: FastifyRequest, reply: FastifyReply) => Promise<void>);

  app.post('/admins', {
    schema: {
      tags: ['CMS'],
      summary: 'Create a new admin account',
      body: {
        type: 'object',
        additionalProperties: false,
        required: ['key', 'email', 'password'],
        properties: {
          key: { type: 'string', description: 'CMS create-admin key' },
          email: { type: 'string', format: 'email' },
          password: { type: 'string', minLength: 8 },
        },
      },
      response: {
        201: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                id: { type: 'number' },
                email: { type: 'string' },
              },
            },
          },
        },
      },
    },
  }, handleCreateAdmin as (req: FastifyRequest, reply: FastifyReply) => Promise<void>);

  app.post('/partner', {
    preHandler: adminAuth,
    schema: {
      tags: ['CMS'],
      summary: 'Create a new partner account',
      security: [{ BearerAuth: [] }],
      body: {
        type: 'object',
        additionalProperties: false,
        required: ['name', 'fee_buy', 'fee_sell'],
        properties: {
          name: { type: 'string' },
          fee_buy: { type: 'number', minimum: 0 },
          fee_sell: { type: 'number', minimum: 0 },
          active: { type: 'boolean' },
        },
      },
      response: {
        201: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                name: { type: 'string' },
                key: { type: 'string' },
                fee_buy: { type: 'number' },
                fee_sell: { type: 'number' },
                active: { type: 'boolean' },
                created_at: { type: 'string' },
                updated_at: { type: ['string', 'null'] },
              },
            },
          },
        },
      },
    },
  }, handleCreatePartner as (req: FastifyRequest, reply: FastifyReply) => Promise<void>);

  app.get('/partner', {
    preHandler: adminAuth,
    schema: {
      tags: ['CMS'],
      summary: 'List partner configs',
      security: [{ BearerAuth: [] }],
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  name: { type: 'string' },
                  key: { type: 'string' },
                  fee_buy: { type: 'number' },
                  fee_sell: { type: 'number' },
                  active: { type: 'boolean' },
                  created_at: { type: 'string' },
                  updated_at: { type: ['string', 'null'] },
                },
              },
            },
          },
        },
      },
    },
  }, handleListPartners as (req: FastifyRequest, reply: FastifyReply) => Promise<void>);

  app.get('/partner/:id', {
    preHandler: adminAuth,
    schema: {
      tags: ['CMS'],
      summary: 'Get partner config by ID',
      security: [{ BearerAuth: [] }],
      params: {
        type: 'object',
        additionalProperties: false,
        required: ['id'],
        properties: {
          id: { type: 'string' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                name: { type: 'string' },
                key: { type: 'string' },
                fee_buy: { type: 'number' },
                fee_sell: { type: 'number' },
                active: { type: 'boolean' },
                created_at: { type: 'string' },
                updated_at: { type: ['string', 'null'] },
              },
            },
          },
        },
      },
    },
  }, handleGetPartner as (req: FastifyRequest, reply: FastifyReply) => Promise<void>);
  const tokenSideConfigSchema = {
    type: 'object',
    properties: {
      spread: { type: 'number' },
      fee_rate: { type: 'number' },
      min_fee: { type: 'number' },
      min_order_amount: { type: 'number' },
      max_order_amount: { type: 'number' },
      source: { type: 'string' },
    },
  };

  const tokenConfigSchema = {
    type: 'object',
    properties: {
      buy: tokenSideConfigSchema,
      sell: tokenSideConfigSchema,
    },
  };

  const configResponseSchema = {
    type: 'object',
    properties: {
      success: { type: 'boolean' },
      data: {
        type: 'object',
        properties: {
          available_price_sources: { type: 'array', items: { type: 'string' } },
          configs: {
            type: 'object',
            properties: {
              usdc: tokenConfigSchema,
              xlm: tokenConfigSchema,
            },
          },
        },
      },
    },
  };

  const tokenSidePatchSchema = {
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
  };

  const tokenPatchSchema = {
    type: 'object',
    additionalProperties: false,
    properties: {
      buy: tokenSidePatchSchema,
      sell: tokenSidePatchSchema,
    },
  };

  app.get('/config', {
    preHandler: adminAuth,
    schema: {
      tags: ['CMS'],
      summary: 'Get per-token spreads and fee rates (creates defaults if missing)',
      security: [{ BearerAuth: [] }],
      response: { 200: configResponseSchema },
    },
  }, handleGetConfig as (req: FastifyRequest, reply: FastifyReply) => Promise<void>);

  app.patch('/config', {
    preHandler: adminAuth,
    schema: {
      tags: ['CMS'],
      summary: 'Update per-token spreads and fee rates',
      security: [{ BearerAuth: [] }],
      body: {
        type: 'object',
        additionalProperties: false,
        properties: {
          usdc: tokenPatchSchema,
          xlm: tokenPatchSchema,
        },
      },
      response: { 200: configResponseSchema },
    },
  }, handlePatchCmsConfig as (req: FastifyRequest, reply: FastifyReply) => Promise<void>);

  app.get('/rates', {
    schema: {
      tags: ['CMS'],
      summary: 'Get buy and sell rates for all tokens (USDC, XLM)',
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                usdc: { type: 'object', properties: { buy: { type: 'number' }, sell: { type: 'number' } } },
                xlm:  { type: 'object', properties: { buy: { type: 'number' }, sell: { type: 'number' } } },
              },
            },
          },
        },
      },
    },
  }, handleGetRates as (req: FastifyRequest, reply: FastifyReply) => Promise<void>);

  app.get('/admin/audit', {
    preHandler: adminAuth,
    schema: {
      tags: ['CMS'],
      summary: 'Get last 50 fee config audit log entries',
      security: [{ BearerAuth: [] }],
      response: {
        200: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              action: { type: 'string' },
              details: { type: 'string' },
              createdAt: { type: 'string' },
              user: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  email: { type: 'string' },
                },
              },
            },
          },
        },
      },
    },
  }, handleGetAuditLog as (req: FastifyRequest, reply: FastifyReply) => Promise<void>);

  app.get('/orders/buy', {
    preHandler: adminAuth,
    schema: {
      tags: ['CMS'],
      summary: 'Get all buy orders',
      security: [{ BearerAuth: [] }],
    },
  }, handleGetBuyOrders as (req: FastifyRequest, reply: FastifyReply) => Promise<void>);

  app.get('/orders/sell', {
    preHandler: adminAuth,
    schema: {
      tags: ['CMS'],
      summary: 'Get all sell orders',
      security: [{ BearerAuth: [] }],
    },
  }, handleGetSellOrders as (req: FastifyRequest, reply: FastifyReply) => Promise<void>);

  app.patch('/admin/password', {
    preHandler: adminAuth,
    schema: {
      tags: ['CMS'],
      summary: 'Change admin password',
      security: [{ BearerAuth: [] }],
      body: {
        type: 'object',
        additionalProperties: false,
        required: ['currentPassword', 'newPassword'],
        properties: {
          currentPassword: { type: 'string' },
          newPassword: { type: 'string', minLength: 8 },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: { success: { type: 'boolean' } },
        },
      },
    },
  }, handleChangePassword as (req: FastifyRequest, reply: FastifyReply) => Promise<void>);
}
