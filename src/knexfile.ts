import dotenv from 'dotenv';
const result = dotenv.config({ path: './.env' });
if (result.error) {
  dotenv.config({ path: '../.env' });
}

import type { Knex } from 'knex';
import path from 'path';
import { databaseConfig } from './config/database';

const config: Knex.Config = {
  client: 'pg',
  connection: {
    host: databaseConfig.host,
    port: databaseConfig.port,
    user: databaseConfig.user,
    password: databaseConfig.password,
    database: databaseConfig.database,
    ssl: databaseConfig.ssl,
  },
  migrations: {
    directory: path.join(__dirname, 'migrations'),
    loadExtensions: ['.ts', '.js'],
  },
  searchPath: [databaseConfig.schema, 'public'],
};

export default config;
module.exports = config;
