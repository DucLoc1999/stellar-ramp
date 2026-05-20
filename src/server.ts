import 'dotenv/config';
import { buildApp } from './app';
import { logger } from './config/logger';
import { appConfig } from './config/app';
import { initStellarServer } from './services/stellarService';
import { initKafka, disconnectKafka } from './services/queueService';
import { startSnapshotScheduler } from './services/snapshotLandingPageScheduler';
import { startOrderExpiryScheduler } from './services/orderExpiryScheduler';
import db from './db';

let app: ReturnType<typeof buildApp> extends Promise<infer T> ? T : never;
let snapshotInterval: NodeJS.Timeout | undefined;
let expiryInterval: NodeJS.Timeout | undefined;

async function healthCheck() {
  try {
    await db.raw('SELECT 1');
    logger.info('DB connection OK');
  } catch (err) {
    throw new Error(`DB connection failed: ${(err as Error).message}`);
  }
}

async function checkKafkaConnection() {
  await initKafka();
}


async function gracefulShutdown(signal: string) {
  logger.info(`Received ${signal}, shutting down gracefully...`);
  try {
    await disconnectKafka();
    if (snapshotInterval) clearInterval(snapshotInterval);
    if (expiryInterval) clearInterval(expiryInterval);
    await db.destroy();
    if (app && app.close) {
      await app.close();
    }
    logger.info('Graceful shutdown complete');
    process.exit(0);
  } catch (err) {
    logger.error({ err }, 'Error during graceful shutdown');
    process.exit(1);
  }
}

async function start() {
  await healthCheck();
  await checkKafkaConnection();
  // await checkHotWalletTrustline();

  const builtApp = await buildApp();
  app = builtApp as typeof app;

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  const port = appConfig.port;
  const host = appConfig.host;

  await app.listen({ port, host });
  snapshotInterval = startSnapshotScheduler();
  expiryInterval = startOrderExpiryScheduler();
}

start();