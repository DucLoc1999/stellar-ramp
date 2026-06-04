import 'dotenv/config';
import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { priceRoutes } from './routes/priceRoutes';
import { configRoutes } from './routes/configRoutes';
import { orderRoutes } from './routes/orderRoutes';
import { webhookRoutes } from './routes/webhookRoutes';
import { adminRoutes } from './routes/adminRoutes';
import { bypassRoutes } from './routes/bypassRoutes';
import { cmsRoutes } from './routes/cmsRoutes';
import { landingRoutes } from './routes/landingRoutes';
import { errorHandler } from './middlewares/errorHandler';
import db from './db';
import { runMigrations } from './utils/migrationRunner';
import { testConnection } from './config/database';
import { logger } from './config/logger';
import { ensureBootstrapAdmin } from './services/adminService';

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: true });

  await app.register(cors, {
    origin: true,
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'partner-app-key'],
    credentials: true,
  });

  await app.register(swagger, {
    openapi: {
      info: {
        title: 'Payment Service API',
        description: 'Price engine, fee management and SePay payment integration',
        version: '1.0.0',
      },
      components: {
        securitySchemes: {
          SepayWebhookKey: { type: 'apiKey', in: 'header', name: 'Authorization' },
          BearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
          PartnerAppKey: { type: 'apiKey', in: 'header', name: 'partner-app-key', description: 'Partner App Key for client authentication' },
        },
      },
    },
  });
  app.get('/openapi.json', async () => {
    return app.swagger();
  });
  await app.register(swaggerUi, { routePrefix: '/docs' });

  await app.register(errorHandler);

  app.get('/health', async () => ({ status: 'ok' }));

  await app.register(adminRoutes);
  await app.register(bypassRoutes);
  await app.register(cmsRoutes, { prefix: '/cms' });
  await app.register(landingRoutes, { prefix: '/landing' });
  await app.register(priceRoutes, { prefix: '/api/rate' });
  await app.register(configRoutes, { prefix: '/config' });
  await app.register(orderRoutes, { prefix: '/api/orders' });
  await app.register(webhookRoutes, { prefix: '/api/webhooks' });

  app.addHook('onReady', async () => {
    try {
      await runMigrations();
      await ensureBootstrapAdmin();

      await testConnection(db);
      logger.info('Database connection verified');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error({ error: errorMessage }, 'Failed to connect to database');
      throw error;
    }
  });

  return app;
}
