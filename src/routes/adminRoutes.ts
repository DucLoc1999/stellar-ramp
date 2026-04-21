import type { FastifyInstance } from 'fastify';
import { adminAuth } from '../middlewares/adminAuth';
import { getAllConfig } from '../services/configService';
import db from '../db';

const adminSecurity = [{ AdminKey: [] }];

export async function adminRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', adminAuth);

  app.get('/fees', {
    schema: {
      tags: ['Admin'],
      summary: 'Get current fee rates and last 20 audit log entries',
      security: adminSecurity,
    },
  }, async (_req, reply) => {
    const config = await getAllConfig();
    const recent_changes = await db('fee_audit_log')
      .orderBy('changed_at', 'desc')
      .limit(20);

    reply.send({
      success: true,
      data: {
        fee_rate_buy: Number(config['fee_rate_buy'] ?? 0.008),
        fee_rate_sell: Number(config['fee_rate_sell'] ?? 0.008),
        recent_changes,
      },
    });
  });

}
