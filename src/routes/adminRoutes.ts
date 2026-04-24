import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { handleGetStats, handleLogin } from '../controllers/adminController';
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
}

