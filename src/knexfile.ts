import type { Knex } from 'knex';
import path from 'path';

const config: Knex.Config = {
  client: 'mysql2',
  connection: {
    host: process.env.DB_HOST ?? 'localhost',
    port: Number(process.env.DB_PORT ?? 3306),
    user: process.env.DB_USER ?? 'root',
    password: process.env.DB_PASSWORD ?? '',
    database: process.env.DB_NAME ?? 'payment_svc',
  },
  migrations: {
    directory: path.join(__dirname, 'migrations'),
    extension: 'ts',
  },
};

export default config;
module.exports = config;
