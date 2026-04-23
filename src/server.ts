import 'dotenv/config';
import { buildApp } from './app';
import { logger } from './config/logger';
import { appConfig } from './config/app';

async function start() {
  const app = await buildApp();

  const port = appConfig.port;
  const host = appConfig.host;

  await app.listen({ port, host });
}

start();