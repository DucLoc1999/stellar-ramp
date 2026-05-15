import 'dotenv/config';
import { Kafka, Consumer, logLevel } from 'kafkajs';
import { processSellPayment } from '../services/orderService';
import { emitOrderPaid, OrderPaidEvent } from '../services/queueService';
import { OrderState } from '../models/types';
import db from '../db';

const MAX_RETRIES = 3;
const RETRY_DELAYS = [1000, 5000, 15000];

interface StellarTokenInEvent {
  txHash: string;
  from: string;
  to: string;
  amount: string;
  asset: string;
  tokenIssuer: string;
  memo?: string;
  walletLabel: string;
}

const retries = new Map<number, number>();

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function processVndPayoutEvent(message: StellarTokenInEvent): Promise<void> {
  const { txHash, from, amount, asset, tokenIssuer, memo } = message;

  try {
    const result = await processSellPayment({ txHash, from, amount, asset, tokenIssuer, memo });

    if (result.success) {
      console.log(`[VndPayoutWorker] Success for tx ${txHash}`);

      const order = await db('orders').where({ transaction_hash: txHash }).first();
      if (order) {
        await emitOrderPaid({
          orderId: order.id,
          amount,
          txHash,
          paymentCode: order.payment_code,
        } as OrderPaidEvent);
      }

      retries.delete(order.id);
    } else {
      console.error(`[VndPayoutWorker] Failed for tx ${txHash}: ${result.error}`);
    }
  } catch (error) {
    console.error(`[VndPayoutWorker] Exception for tx ${txHash}:`, error);
  }
}

async function startWorker(): Promise<void> {
  console.log('[VndPayoutWorker] Starting worker, connecting to Kafka...');

  const brokers = (process.env.KAFKA_BROKERS || 'localhost:9092').split(',');
  const clientId = process.env.KAFKA_CLIENT_ID || 'payment_svc';
  const topic = process.env.KAFKA_TOKEN_IN_TOPIC || 'stellar_token_in';

  const kafka = new Kafka({
    clientId: `${clientId}-worker`,
    brokers,
    logLevel: logLevel.WARN,
  });

  const consumer = kafka.consumer({ groupId: `${clientId}-vnd-payout-group` });
  await consumer.connect();
  await consumer.subscribe({ topic, fromBeginning: true });

  await consumer.run({
    eachMessage: async ({ message }) => {
      console.log('[VndPayoutWorker] Received message:', message.value?.toString());
      if (!message.value) return;

      try {
        const event: StellarTokenInEvent = JSON.parse(message.value.toString());
        await processVndPayoutEvent(event);
      } catch (error) {
        console.error('[VndPayoutWorker] Failed to parse message:', error);
      }
    },
  });

  console.log(`[VndPayoutWorker] Listening on topic: ${topic}`);

  process.on('SIGINT', async () => {
    console.log('[VndPayoutWorker] Shutting down...');
    await consumer.disconnect();
    process.exit(0);
  });
}

startWorker().catch(console.error);