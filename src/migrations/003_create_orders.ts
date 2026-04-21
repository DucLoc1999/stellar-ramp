import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('orders', (t) => {
    t.increments('id');
    t.string('payment_code', 20).unique();
    t.string('checkout_url', 500);
    t.string('sepay_transaction_id', 100);
    t.bigInteger('vnd_received');
    t.timestamp('payment_confirmed_at');
    t.enum('direction', ['buy', 'sell']).notNullable();
    t.decimal('usdt_amount', 18, 8).notNullable();
    t.bigInteger('rate').notNullable();
    t.bigInteger('net_vnd').notNullable();
    t.decimal('fee_rate', 10, 6).notNullable();
    t.bigInteger('fee_vnd').notNullable();
    t.string('payment_status', 30).defaultTo('pending');
    t.timestamps(true, true);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('orders');
}
