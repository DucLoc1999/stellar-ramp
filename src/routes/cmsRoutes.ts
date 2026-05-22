import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { handleCmsLogin, handleCreateAdmin, handleGetConfig, handlePatchCmsConfig, handleGetRates, handleGetAuditLog, handleChangePassword } from '../controllers/cmsController';
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

  const tokenConfigSchema = {
    type: 'object',
    properties: {
      spread_buy: { type: 'number' },
      spread_sell: { type: 'number' },
      fee_rate_buy: { type: 'number' },
      fee_rate_sell: { type: 'number' },
      min_fee: { type: 'number' },
    },
  };

  const configResponseSchema = {
    type: 'object',
    properties: {
      success: { type: 'boolean' },
      data: {
        type: 'object',
        properties: {
          usdc: tokenConfigSchema,
          xlm: tokenConfigSchema,
        },
      },
    },
  };

  const tokenConfigBodySchema = {
    type: 'object',
    additionalProperties: false,
    properties: {
      spread_buy: { type: 'number' },
      spread_sell: { type: 'number' },
      fee_rate_buy: { type: 'number' },
      fee_rate_sell: { type: 'number' },
      min_fee: { type: 'number' },
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
          usdc: tokenConfigBodySchema,
          xlm: tokenConfigBodySchema,
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
