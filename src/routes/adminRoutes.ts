import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { handleGetStats, handleLogin, handleRotateCallbackSecret } from '../controllers/adminController';
import { adminAuth } from '../middlewares/adminAuth';

export async function adminRoutes(app: FastifyInstance): Promise<void> {
  app.post('/login', {
    schema: {
      tags: ['Admin'],
      summary: 'Admin login (JWT)',
      body: {
        type: 'object',
        additionalProperties: false,
        required: ['email', 'password'],
        properties: {
          email: { type: 'string' },
          password: { type: 'string' },
        },
      },
    },
  }, handleLogin as (req: FastifyRequest, reply: FastifyReply) => Promise<void>);

  app.get('/stats', {
    preHandler: adminAuth,
    schema: {
      tags: ['Admin'],
      summary: 'Get BI stats (admin)',
      security: [{ BearerAuth: [] }],
      querystring: {
        type: 'object',
        additionalProperties: false,
        properties: {
          from: { type: 'string' },
          to: { type: 'string' },
        },
      },
    },
  }, handleGetStats as (req: FastifyRequest, reply: FastifyReply) => Promise<void>);

  app.patch('/callback-secret', {
    preHandler: adminAuth,
    schema: {
      tags: ['Admin'],
      summary: 'Rotate callback signature secret',
      security: [{ BearerAuth: [] }],
      body: {
        type: 'object',
        additionalProperties: false,
        required: ['secret'],
        properties: {
          secret: { type: 'string', minLength: 32, description: 'New secret (min 32 chars)' },
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
      },
    },
  }, handleRotateCallbackSecret as (req: FastifyRequest, reply: FastifyReply) => Promise<void>);
}

