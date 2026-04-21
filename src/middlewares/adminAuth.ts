import type { FastifyRequest, FastifyReply } from 'fastify';

export async function adminAuth(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  const key = req.headers['x-admin-key'];
  if (!process.env.ADMIN_API_KEY || key !== process.env.ADMIN_API_KEY) {
    reply.status(401).send({ success: false, error: 'Unauthorized' });
  }
}
