import 'dotenv/config';
import { Kafka, Consumer, logLevel } from 'kafkajs';
import { disburseUSDC } from '../services/stellarService';
import { emitOrderPaid, OrderPaidEvent } from '../services/queueService';
import { OrderState } from '../models/types';
import db from '../db';

const MAX_RETRIES = 3;
const RETRY_DELAYS = [1000, 5000, 15000];

interface DisburseMessage {
  orderId: number;
  recipientPublicKey: string;
  amount: string;
  paymentCode: string;
  tokenAddress: string;
}

const retries = new Map<number, number>();

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function processDisburseEvent(message: DisburseMessage): Promise<void> {
  const { orderId, recipientPublicKey, amount, paymentCode, tokenAddress } = message;
  const attempt = retries.get(orderId) || 0;

  console.log(`[DisburseWorker] Processing order ${orderId}, attempt ${attempt + 1}/${MAX_RETRIES}`);

  try {
    const result = await disburseUSDC(orderId, recipientPublicKey, amount, paymentCode, tokenAddress);

    if (result.success) {
      console.log(`[DisburseWorker] Success for order ${orderId}, hash: ${result.hash}`);

      await emitOrderPaid({
        orderId,
        amount,
        txHash: result.hash,
        paymentCode,
      } as OrderPaidEvent);

      retries.delete(orderId);
    } else {
      console.error(`[DisburseWorker] Failed for order ${orderId}: ${result.error}`);

      if (attempt + 1 < MAX_RETRIES) {
        retries.set(orderId, attempt + 1);
        const delay = RETRY_DELAYS[attempt] || RETRY_DELAYS[RETRY_DELAYS.length - 1];
        console.log(`[DisburseWorker] Retrying order ${orderId} in ${delay}ms`);
        await sleep(delay);
        await processDisburseEvent(message);
      } else {
        console.error(`[DisburseWorker] Max retries reached for order ${orderId}, marking FAILED`);

        await db('orders')
          .where({ id: orderId })
          .update({
            order_state: OrderState.FAILED,
            error_message: result.error,
          });

        retries.delete(orderId);
      }
    }
  } catch (error) {
    console.error(`[DisburseWorker] Exception for order ${orderId}:`, error);

    if (attempt + 1 < MAX_RETRIES) {
      retries.set(orderId, attempt + 1);
      const delay = RETRY_DELAYS[attempt] || RETRY_DELAYS[RETRY_DELAYS.length - 1];
      await sleep(delay);
      await processDisburseEvent(message);
    } else {
      await db('orders')
        .where({ id: orderId })
        .update({
          order_state: OrderState.FAILED,
          error_message: String(error),
        });

      retries.delete(orderId);
    }
  }
}

async function startWorker(): Promise<void> {
  console.log('[DisburseWorker] Starting worker, connecting to Kafka...');

  const brokers = (process.env.KAFKA_BROKERS || 'localhost:9092').split(',');
  const clientId = process.env.KAFKA_CLIENT_ID || 'payment_svc';
  const topic = process.env.KAFKA_DISBURSE_TOPIC || 'disburse_crypto';

  const kafka = new Kafka({
    clientId: `${clientId}-worker`,
    brokers,
    logLevel: logLevel.WARN,
  });

  const consumer = kafka.consumer({ groupId: `${clientId}-disburse-group` });
  await consumer.connect();
  await consumer.subscribe({ topic, fromBeginning: true });

  await consumer.run({
    eachMessage: async ({ message }) => {
      console.log('[DisburseWorker] Received message:', message.value?.toString());
      if (!message.value) return;

      try {
        const event: DisburseMessage = JSON.parse(message.value.toString());
        await processDisburseEvent(event);
      } catch (error) {
        console.error('[DisburseWorker] Failed to parse message:', error);
      }
    },
  });

  console.log(`[DisburseWorker] Listening on topic: ${topic}`);

  process.on('SIGINT', async () => {
    console.log('[DisburseWorker] Shutting down...');
    await consumer.disconnect();
    process.exit(0);
  });
}

startWorker().catch(console.error);