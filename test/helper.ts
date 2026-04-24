import 'dotenv/config';
import Fastify from 'fastify';
import { orderRoutes } from '../src/routes/orderRoutes';
import { webhookRoutes } from '../src/routes/webhookRoutes';
import { configRoutes } from '../src/routes/configRoutes';
import { adminRoutes } from '../src/routes/adminRoutes';
import db from '../src/db';

export async function buildApp() {
  const app = Fastify({ logger: false });
  await app.register(adminRoutes);
  await app.register(configRoutes, { prefix: '/config' });
  await app.register(orderRoutes, { prefix: '/api/orders' });
  await app.register(webhookRoutes, { prefix: '/api/webhooks' });
  await app.ready();
  return app;
}

export async function runMigrations() {
  await db.migrate.latest();
}

export async function cleanOrders() {
  await db('webhook_logs').del();
  await db('orders').del();
}

export async function destroyDb() {
  await db.destroy();
}

export { db };
