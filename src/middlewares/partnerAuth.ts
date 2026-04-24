import type { FastifyRequest, FastifyReply } from 'fastify';
import { createErrorReply, ErrorCodes } from './errorHandler';

export async function partnerAuth(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  const key = process.env.PARTNER_APP_KEY;

  if (!key) {
    return createErrorReply(reply, 'AUTH_NOT_CONFIGURED', 'Partner auth not configured', req.id);
  }

  const header = req.headers['partner-app-key'];

  if (!header || header !== key) {
    return createErrorReply(reply, 'UNAUTHORIZED', 'Invalid partner key', req.id);
  }
}