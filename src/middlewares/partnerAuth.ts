import type { FastifyRequest, FastifyReply } from 'fastify';
import crypto from 'crypto';
import { createErrorReply, ErrorCodes } from './errorHandler';

export async function partnerAuth(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  const key = process.env.PARTNER_APP_KEY;

  if (!key) {
    return createErrorReply(reply, 'AUTH_NOT_CONFIGURED', 'Partner auth not configured', req.id);
  }

  const header = req.headers['partner-app-key'];

  if (!header || Array.isArray(header)) {
    return createErrorReply(reply, 'UNAUTHORIZED', 'Invalid partner key', req.id);
  }

  const headerBuf = Buffer.from(header, 'utf8');
  const keyBuf = Buffer.from(key, 'utf8');
  if (headerBuf.length !== keyBuf.length || !crypto.timingSafeEqual(headerBuf, keyBuf)) {
    return createErrorReply(reply, 'UNAUTHORIZED', 'Invalid partner key', req.id);
  }
}