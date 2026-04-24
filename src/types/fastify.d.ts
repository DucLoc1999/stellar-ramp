import 'fastify';

declare module 'fastify' {
  interface FastifyRequest {
    user?: unknown;
    admin?: { id: number; email: string };
  }
}
