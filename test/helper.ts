import 'dotenv/config';
import Fastify from 'fastify';
import { orderRoutes } from '../src/routes/orderRoutes';
import { sepayWebhookRoutes } from '../src/routes/sepayWebhookRoutes';
import db from '../src/db';

export async function buildApp() {
  const app = Fastify({ logger: false });
  await app.register(orderRoutes, { prefix: '/api/orders' });
  await app.register(sepayWebhookRoutes, { prefix: '/api/webhooks' });
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
