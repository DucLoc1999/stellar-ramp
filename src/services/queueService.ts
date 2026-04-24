import { Kafka, Producer, logLevel } from 'kafkajs';

export interface DisburseCryptoEvent {
  orderId: number;
  recipientPublicKey: string;
  amount: string;
  paymentCode: string;
}

export interface OrderPaidEvent {
  orderId: number;
  amount: string;
  txHash: string;
  paymentCode: string;
}

let producer: Producer | null = null;

export async function initKafka(): Promise<Producer> {
  const brokers = (process.env.KAFKA_BROKERS || 'localhost:9092').split(',');
  const clientId = process.env.KAFKA_CLIENT_ID || 'payment_svc';

  producer = new Kafka({
    clientId,
    brokers,
    logLevel: logLevel.WARN,
  }).producer();

  await producer.connect();
  return producer;
}

export async function getProducer(): Promise<Producer> {
  if (!producer) {
    return initKafka();
  }
  return producer;
}

export async function emitDisburseCrypto(event: DisburseCryptoEvent): Promise<void> {
  const p = await getProducer();
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
  const p = await getProducer();
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