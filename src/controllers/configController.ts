import type { FastifyRequest, FastifyReply } from 'fastify';
import { getAllConfig } from '../services/configService';

export async function handleGetFees(
  _req: FastifyRequest,
  reply: FastifyReply,
) {
  const config = await getAllConfig();

  reply.send({
    success: true,
    data: {
      fee_rate_buy: Number(config['fee_rate_buy'] ?? 0.008),
      fee_rate_sell: Number(config['fee_rate_sell'] ?? 0.008),
    },
  });
}