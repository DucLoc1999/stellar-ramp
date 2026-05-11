import { Kafka, Producer, logLevel } from 'kafkajs';

export interface DisburseCryptoEvent {
  orderId: number;
  recipientPublicKey: string;
  amount: string;
  paymentCode: string;
  tokenAddress: string;
  assetCode: string;
}

export interface OrderPaidEvent {
  orderId: number;
  amount: string;
  txHash: string;
  paymentCode: string;
}

let producer: Producer | null = null;
let kafkaAvailable: boolean | null = null;

export function isKafkaAvailable(): boolean {
  if (kafkaAvailable === null) {
    throw new Error('KAFKA_AVAILABLE not initialized. Call initKafka() first.');
  }
  return kafkaAvailable;
}

export async function initKafka(forceMode?: boolean): Promise<void> {
  const brokers = (process.env.KAFKA_BROKERS || 'localhost:9092').split(',');
  const clientId = process.env.KAFKA_CLIENT_ID || 'payment_svc';

  if (forceMode === false) {
    kafkaAvailable = false;
    console.log('[QueueService] Kafka disabled (forced)');
    return;
  }

  if (brokers[0] === 'localhost:9092' || brokers[0] === '127.0.0.1:9092' || brokers[0] === '') {
    kafkaAvailable = false;
    console.log('[QueueService] Kafka disabled (no broker configured)');
    return;
  }

  try {
    producer = new Kafka({
      clientId,
      brokers,
      logLevel: logLevel.WARN,
    }).producer();

    await producer.connect();
    kafkaAvailable = true;
    console.log('[QueueService] Kafka connected');
  } catch (error) {
    kafkaAvailable = false;
    console.log('[QueueService] Kafka unavailable, using direct mode:', error);
  }
}

export async function getProducer(): Promise<Producer | null> {
  if (!producer && kafkaAvailable) {
    await initKafka();
  }
  return producer;
}

export async function emitDisburseCrypto(event: DisburseCryptoEvent): Promise<void> {
  if (!kafkaAvailable) {
    console.log('[QueueService] Kafka unavailable, skipping emitDisburseCrypto');
    return;
  }
  const p = await getProducer();
  if (!p) return;
  const topic = process.env.KAFKA_DISBURSE_TOPIC || 'disburse_crypto';
  await p.send({
    topic,
    messages: [
      {
        key: String(event.orderId),
        value: JSON.stringify(event),
      },
    ],
  });
}

export async function emitOrderPaid(event: OrderPaidEvent): Promise<void> {
  if (!kafkaAvailable) {
    console.log('[QueueService] Kafka unavailable, skipping emitOrderPaid');
    return;
  }
  const p = await getProducer();
  if (!p) return;
  const topic = process.env.KAFKA_ORDER_PAID_TOPIC || 'order_paid';
  await p.send({
    topic,
    messages: [
      {
        key: String(event.orderId),
        value: JSON.stringify(event),
      },
    ],
  });
}

export async function disconnectKafka(): Promise<void> {
  if (producer) {
    await producer.disconnect();
    producer = null;
  }
}