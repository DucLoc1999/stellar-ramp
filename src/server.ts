import 'dotenv/config';
import { buildApp } from './app';
import { logger } from './config/logger';
import { appConfig } from './config/app';
import { initStellarServer, loadHotWallet, hasTrustline, SUPPORTED_TOKEN_ISSUER, DEFAULT_ASSET_CODE } from './services/stellarService';
import { initKafka, disconnectKafka } from './services/queueService';
import { startSnapshotScheduler } from './services/snapshotLandingPageScheduler';
import db from './db';

let app: ReturnType<typeof buildApp> extends Promise<infer T> ? T : never;
let snapshotInterval: NodeJS.Timeout | undefined;

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

async function checkHotWalletTrustline() {
  try {
    const network = (process.env.STELLAR_NETWORK as 'testnet' | 'public') || 'testnet';
    initStellarServer(network);

    const wallet = await loadHotWallet();
    const hasTrust = await hasTrustline(wallet.publicKey, DEFAULT_ASSET_CODE, SUPPORTED_TOKEN_ISSUER);

    if (!hasTrust) {
      logger.warn(`Hot wallet ${wallet.publicKey} missing trustline for ${DEFAULT_ASSET_CODE}`);
    } else {
      logger.info(`Hot wallet trustline OK for ${DEFAULT_ASSET_CODE}`);
    }
  } catch (err) {
    logger.warn(`Hot wallet trustline check skipped: ${(err as Error).message}`);
  }
}

async function gracefulShutdown(signal: string) {
  logger.info(`Received ${signal}, shutting down gracefully...`);
  try {
    await disconnectKafka();
    if (snapshotInterval) clearInterval(snapshotInterval);
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
}

start();