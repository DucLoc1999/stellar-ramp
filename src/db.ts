import Knex from 'knex';
import path from 'path';
import fs from 'fs';

const sslEnabled = process.env.DB_SSL !== 'false';

// Knex stores migration names with the source extension (.ts from dev runs).
// In prod the files are compiled to .js — this source maps .ts names → .js files.
const migrationSource = {
  getMigrations(): Promise<string[]> {
    const dir = path.join(__dirname, 'migrations');
    const files = fs.readdirSync(dir)
      .filter(f => f.endsWith('.js'))
      .sort()
      .map(f => f.replace(/\.js$/, '.ts'));
    return Promise.resolve(files);
  },
  getMigrationName(migration: string): string {
    return migration;
  },
  getMigration(migration: string): Promise<{ up: (knex: Knex.Knex) => Promise<void>; down: (knex: Knex.Knex) => Promise<void> }> {
    const jsFile = path.join(__dirname, 'migrations', migration.replace(/\.ts$/, '.js'));
    return Promise.resolve(require(jsFile));
  },
};

const db = Knex({
  client: 'pg',
  connection: {
    host: process.env.DB_HOST ?? 'localhost',
    port: Number(process.env.DB_PORT ?? 5432),
    user: process.env.DB_USER ?? 'postgres',
    password: process.env.DB_PASSWORD ?? '',
    database: process.env.DB_NAME ?? 'orbitlabs',
    ssl: sslEnabled ? { rejectUnauthorized: false } : false,
  },
  pool: { min: 2, max: 10 },
  searchPath: [process.env.DB_SCHEMA ?? 'payment_svc', 'public'],
  migrations: { migrationSource },
});

export default db;
