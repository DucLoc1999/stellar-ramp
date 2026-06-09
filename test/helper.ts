import crypto from 'crypto';
import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import { orderRoutes } from '../src/routes/orderRoutes';
import { webhookRoutes } from '../src/routes/webhookRoutes';
import { configRoutes } from '../src/routes/configRoutes';
import { adminRoutes } from '../src/routes/adminRoutes';
import { bypassRoutes } from '../src/routes/bypassRoutes';
import { cmsRoutes } from '../src/routes/cmsRoutes';
import { errorHandler } from '../src/middlewares/errorHandler';
import db from '../src/db';

export async function buildApp() {
  const app = Fastify({ logger: false });
  
  await app.register(cors, {
    origin: true,
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'partner-app-key', 'X-Webhook-Signature', 'X-Webhook-Timestamp'],
    credentials: true,
  });
  
  await app.register(errorHandler);
  
  await app.register(adminRoutes);
  await app.register(bypassRoutes);
  await app.register(cmsRoutes, { prefix: '/cms' });
  await app.register(configRoutes, { prefix: '/config' });
  await app.register(orderRoutes, { prefix: '/api/orders' });
  await app.register(webhookRoutes, { prefix: '/api/webhooks' });
  await app.ready();
  return app;
}

export async function runMigrations() {
  if (process.env.NODE_ENV === 'test') {
    // Use SQLite-compatible test setup (no PostgreSQL-specific features)
    await setupTestTables();
  } else {
    await db.migrate.latest();
  }
}

async function setupTestTables() {
  // Config table
  await db.schema.createTable('config', (t) => {
    t.increments('id');
    t.string('key', 100).notNullable().unique();
    t.string('value', 255).notNullable();
    t.string('description', 500);
    t.timestamp('updated_at').defaultTo(db.fn.now());
  });

  // Fee audit log
  await db.schema.createTable('fee_audit_log', (t) => {
    t.increments('id');
    t.string('config_key', 100).notNullable();
    t.string('old_value', 255);
    t.string('new_value', 255).notNullable();
    t.string('changed_by', 100);
    t.timestamp('changed_at').defaultTo(db.fn.now());
  });

  // Partners table
  await db.schema.createTable('partners', (t) => {
    t.string('id', 36).primary();
    t.string('name', 255).notNullable();
    t.string('key', 255).notNullable().unique();
    t.decimal('fee_buy', 10, 6).notNullable().defaultTo(0);
    t.decimal('fee_sell', 10, 6).notNullable().defaultTo(0);
    t.boolean('active').notNullable().defaultTo(true);
    t.timestamp('created_at').defaultTo(db.fn.now());
    t.timestamp('updated_at').defaultTo(db.fn.now());
  });
  // Orders table
  await db.schema.createTable('orders', (t) => {
    t.increments('id');
    t.string('payment_code', 20).unique();
    t.bigInteger('vnd_received');
    t.timestamp('payment_confirmed_at');
    t.string('direction', 10).notNullable();
    t.decimal('usdt_amount', 18, 8).notNullable();
    t.bigInteger('rate').notNullable();
    t.bigInteger('net_vnd').notNullable();
    t.decimal('fee_rate', 10, 6).notNullable();
    t.bigInteger('fee_vnd').notNullable();
    t.string('payment_status', 30).defaultTo('pending');
    t.timestamp('created_at').defaultTo(db.fn.now());
    t.timestamp('updated_at').defaultTo(db.fn.now());
    t.string('chain_id', 20);
    t.string('token_address', 100);
    t.string('asset_code', 20);
    t.string('recipient', 100);
    t.string('callback', 500);
    t.integer('order_state').defaultTo(1);
    t.integer('processing_state').defaultTo(10);
    t.timestamp('expired_at');
    t.string('va_number', 50);
    t.string('transfer_content', 50);
    t.decimal('amount', 18, 2);
    t.text('payment_info');
    t.text('payment_data');
    t.text('body');
    t.text('pay_data');
    t.string('state', 20);
    t.text('sepay_order');
    t.string('tx_hash', 100);
    t.string('cancelled_at');
    t.string('cancel_reason', 500);
    t.text('api_data');
    t.string('last_webhook_id', 100);
    t.string('partner_id', 36);
    // Withdrawal-specific fields
    t.string('bank_id', 50);
    t.string('bank_account_name', 100);
    t.string('bank_account_no', 50);
  });

  // Webhook logs
  await db.schema.createTable('webhook_logs', (t) => {
    t.increments('id');
    t.bigInteger('sepay_transaction_id').nullable().unique();
    t.string('tx_hash', 128).nullable().unique();
    t.string('source', 20);
    t.text('body');  // JSON stored as text in SQLite
    t.timestamp('created_at').defaultTo(db.fn.now());
  });

  // Admins table
  await db.schema.createTable('admins', (t) => {
    t.increments('id');
    t.string('email', 255).notNullable().unique();
    t.string('password_hash', 255).notNullable();
    t.string('password_salt', 255);
    t.string('role', 50).defaultTo('admin');
    t.timestamp('created_at').defaultTo(db.fn.now());
  });

  // System wallets
  await db.schema.createTable('system_wallets', (t) => {
    t.increments('id');
    t.string('name', 100).notNullable().unique();
    t.string('public_key', 255);
    t.text('encrypted_secret');
    t.string('network', 20);
    t.boolean('is_active').defaultTo(true);
    t.timestamp('created_at').defaultTo(db.fn.now());
  });

  // Callback logs
  await db.schema.createTable('callback_logs', (t) => {
    t.increments('id');
    t.string('order_id', 50);
    t.string('url', 500);
    t.text('payload');
    t.integer('attempt').defaultTo(1);
    t.string('response', 1000);
    t.string('status_code', 10);
    t.string('status', 20).defaultTo('pending');
    t.timestamp('created_at').defaultTo(db.fn.now());
  });

  // Insert default config values
  await db('config').insert([
    { key: 'spread_buy',     value: '50',    description: 'VND added to Binance P2P price for buy orders' },
    { key: 'spread_sell',    value: '50',    description: 'VND subtracted from Binance P2P price for sell orders' },
    { key: 'fee_rate_buy',   value: '0.008', description: 'Fee rate for buy orders (0.8%)' },
    { key: 'fee_rate_sell',  value: '0.008', description: 'Fee rate for sell orders (0.8%)' },
  ]);

  const partnerKey = process.env.PARTNER_APP_KEY;
  if (partnerKey) {
    await db('partners').insert({
      id: crypto.randomUUID(),
      name: process.env.PARTNER_BOOTSTRAP_NAME || 'default-partner',
      key: partnerKey,
      fee_buy: Number(process.env.PARTNER_BOOTSTRAP_FEE_BUY ?? 0),
      fee_sell: Number(process.env.PARTNER_BOOTSTRAP_FEE_SELL ?? 0),
      active: true,
    }).onConflict('key').ignore();
  }
}

export async function cleanOrders() {
  await db('webhook_logs').del();
  await db('callback_logs').del();
  await db('orders').del();
}

export async function destroyDb() {
  await db.destroy();
}

export { db };
