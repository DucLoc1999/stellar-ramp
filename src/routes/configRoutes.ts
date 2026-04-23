import type { FastifyInstance } from 'fastify';
import { handleGetFees } from '../controllers/configController';

export async function configRoutes(app: FastifyInstance): Promise<void> {
  app.get('/fees', {
    schema: {
      tags: ['Config'],
      summary: 'Get current fee rates and last 20 audit log entries',
    },
  }, handleGetFees);
}
