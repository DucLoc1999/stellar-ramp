import dotenv from 'dotenv';
const result = dotenv.config({ path: './.env' });
if (result.error) {
  dotenv.config({ path: '../.env' });
}

import type { Knex } from 'knex';
import path from 'path';

const sslEnabled = process.env.DB_SSL !== 'false';

const config: Knex.Config = {
  client: 'pg',
  connection: {
    host: String(process.env.DB_HOST ?? 'localhost'),
    port: Number(process.env.DB_PORT ?? 5432),
    user: String(process.env.DB_USER ?? 'postgres'),
    password: String(process.env.DB_PASSWORD ?? ''),
    database: String(process.env.DB_NAME ?? 'orbitlabs'),
    ssl: sslEnabled ? { rejectUnauthorized: false } : false,
  },
  migrations: {
    directory: path.join(__dirname, 'migrations'),
    extension: 'ts',
  },
  searchPath: [process.env.DB_SCHEMA ?? 'payment_svc', 'public'],
};

export default config;
module.exports = config;
