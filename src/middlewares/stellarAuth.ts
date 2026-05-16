import type { FastifyRequest, FastifyReply } from 'fastify';

export async function stellarAuth(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  const apiKey = process.env.STELLAR_LISTENER_FALLBACK_AUTH_TOKEN;
  if (!apiKey) {
    reply.status(401).send({ success: false, error: 'Unauthorized: STELLAR_LISTENER_FALLBACK_AUTH_TOKEN not set' });
    return;
  }

  const header = req.headers['authorization'];
  if (header !== `Bearer ${apiKey}`) {
    reply.status(401).send({ success: false, error: 'Unauthorized' });
  }
}