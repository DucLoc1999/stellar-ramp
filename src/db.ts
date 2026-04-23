import Knex from 'knex';
import path from 'path';
import fs from 'fs';
import { databaseConfig } from './config/database';

const sslEnabled = process.env.DB_SSL !== 'false';

// Knex stores migration names with the source extension (.ts from dev runs).
// In prod the files are compiled to .js — this source maps .ts names → .js files.
const migrationSource = {
  getMigrations(): Promise<string[]> {
    const dir = path.join(__dirname, 'migrations');
    const files = fs.readdirSync(dir)
      .filter(f => /\.(js|ts)$/.test(f) && !f.endsWith('.d.ts'))
      .sort()
      .map(f => f.replace(/\.(js|ts)$/, '.ts'));
    return Promise.resolve([...new Set(files)]);
  },
  getMigrationName(migration: string): string {
    return migration;
  },
  getMigration(migration: string): Promise<{ up: (knex: Knex.Knex) => Promise<void>; down: (knex: Knex.Knex) => Promise<void> }> {
    const base = migration.replace(/\.ts$/, '');
    const jsFile = path.join(__dirname, 'migrations', base + '.js');
    const tsFile = path.join(__dirname, 'migrations', base + '.ts');
    return Promise.resolve(require(fs.existsSync(jsFile) ? jsFile : tsFile));
  },
};

const db = Knex({
  client: 'pg',
  connection: {
    host: databaseConfig.host,
    port: databaseConfig.port,
    user: databaseConfig.user,
    password: databaseConfig.password,
    database: databaseConfig.database,
    ssl: databaseConfig.ssl,
  },
  pool: { min: 2, max: 10 },
  searchPath: [databaseConfig.schema, 'public'],
  migrations: { migrationSource },
});

export default db;
