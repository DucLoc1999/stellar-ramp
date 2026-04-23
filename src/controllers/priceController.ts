import type { FastifyRequest, FastifyReply } from 'fastify';
import { getRate } from '../services/priceService';

export async function handleGetRate(
  _req: FastifyRequest,
  reply: FastifyReply,
) {
  const rate = await getRate();
  reply.send({
    created_at: rate.updated_at,
    buy: rate.buy_price,
    sell: rate.sell_price,
  });
}