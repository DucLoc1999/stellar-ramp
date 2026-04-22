import Knex from 'knex';

const sslEnabled = process.env.DB_SSL !== 'false';

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
});

export default db;
