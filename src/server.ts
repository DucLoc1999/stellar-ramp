import 'dotenv/config';
import { buildApp } from './app';
import { logger } from './config/logger';
import { appConfig } from './config/app';
import { initStellarServer, loadHotWallet, hasTrustline, SUPPORTED_TOKEN_ISSUER, DEFAULT_ASSET_CODE } from './services/stellarService';
import { initKafka } from './services/queueService';
import db from './db';

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
    console.log('Hot wallet:', wallet.publicKey);
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

async function start() {
  await healthCheck();
  await checkKafkaConnection();
  await checkHotWalletTrustline();

  const app = await buildApp();

  const port = appConfig.port;
  const host = appConfig.host;

  await app.listen({ port, host });
}

start();