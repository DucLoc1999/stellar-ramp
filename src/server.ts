import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { priceRoutes } from './routes/priceRoutes';
import { adminRoutes } from './routes/adminRoutes';
import { orderRoutes } from './routes/orderRoutes';
import { sepayWebhookRoutes } from './routes/sepayWebhookRoutes';
import db from './db';

async function start() {
  const app = Fastify({ logger: true });

  await app.register(cors);

  await app.register(swagger, {
    openapi: {
      info: {
        title: 'Payment Service API',
        description: 'Price engine, fee management and SePay payment integration',
        version: '1.0.0',
      },
      components: {
        securitySchemes: {
          AdminKey: { type: 'apiKey', in: 'header', name: 'x-admin-key' },
          SepayKey: { type: 'apiKey', in: 'header', name: 'x-secret-key' },
        },
      },
    },
  });

  await app.register(swaggerUi, { routePrefix: '/docs' });

  app.get('/health', async () => ({ status: 'ok' }));
  await app.register(priceRoutes, { prefix: '/api/rate' });
  await app.register(adminRoutes, { prefix: '/config' });
  await app.register(orderRoutes, { prefix: '/api/orders' });
  await app.register(sepayWebhookRoutes, { prefix: '/api/webhooks' });

  app.addHook('onReady', async () => {
    const [, migrations] = await db.migrate.latest() as [number, string[]];
    if (migrations.length > 0) {
      app.log.info({ migrations }, 'Ran migrations');
    }
  });

  const port = Number(process.env.PORT ?? 3000);
  const host = process.env.HOST ?? '0.0.0.0';

  await app.listen({ port, host });
}

start();