import type { FastifyRequest, FastifyReply } from 'fastify';

export async function sepayAuth(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  const provided = req.headers['x-secret-key'];
  if (!process.env.SEPAY_KEY || provided !== process.env.SEPAY_KEY) {
    reply.status(401).send({ success: false, error: 'Unauthorized' });
  }
}
