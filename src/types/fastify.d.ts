import 'fastify';

declare module 'fastify' {
  interface FastifyRequest {
    user?: unknown;
    admin?: { id: number; email: string };
    partner?: { id: string; name: string; fee_buy: number; fee_sell: number };
  }
}
