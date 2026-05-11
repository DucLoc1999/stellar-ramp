import type { FastifyRequest, FastifyReply } from 'fastify';
import crypto from 'crypto';
import { createErrorReply } from './errorHandler';

const CHAIN_WEBHOOK_SECRET = process.env.CHAIN_WEBHOOK_SECRET;
const REPLAY_WINDOW_MS = 300000;

export async function chainWebhookAuth(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  if (!CHAIN_WEBHOOK_SECRET) {
    return createErrorReply(reply, 'AUTH_NOT_CONFIGURED', 'Chain webhook auth not configured', req.id);
  }

  const timestampHeader = req.headers['x-webhook-timestamp'];
  const signatureHeader = req.headers['x-webhook-signature'];

  if (!timestampHeader || !signatureHeader) {
    return createErrorReply(reply, 'UNAUTHORIZED', 'Missing X-Webhook-Timestamp or X-Webhook-Signature', req.id);
  }

  const timestamp = String(timestampHeader);
  const signature = String(signatureHeader);
  const timestampNum = parseInt(timestamp, 10);

  if (isNaN(timestampNum)) {
    return createErrorReply(reply, 'VALIDATION_ERROR', 'Invalid X-Webhook-Timestamp format', req.id);
  }

  const now = Date.now();
  if (Math.abs(now - timestampNum) > REPLAY_WINDOW_MS) {
    return createErrorReply(reply, 'UNAUTHORIZED', 'Webhook timestamp expired', req.id);
  }

  const body = JSON.stringify(req.body);
  const expectedSignature = crypto
    .createHmac('sha256', CHAIN_WEBHOOK_SECRET)
    .update(`${timestamp}.${body}`)
    .digest('hex');

  const sigBuf = Buffer.from(signature, 'hex');
  const expectedBuf = Buffer.from(expectedSignature, 'hex');
  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
    return createErrorReply(reply, 'UNAUTHORIZED', 'Invalid webhook signature', req.id);
  }
}