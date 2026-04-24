import type { FastifyRequest, FastifyReply } from 'fastify';
import { getAllConfig, updateConfig } from '../services/configService';

export async function handleGetFees(
  _req: FastifyRequest,
  reply: FastifyReply,
) {
  const config = await getAllConfig();

  reply.send({
    success: true,
    data: {
      spread_buy: Number(config['spread_buy'] ?? 50),
      spread_sell: Number(config['spread_sell'] ?? 50),
      fee_rate_buy: Number(config['fee_rate_buy'] ?? 0.008),
      fee_rate_sell: Number(config['fee_rate_sell'] ?? 0.008),
    },
  });
}

export async function handlePatchConfig(
  req: FastifyRequest<{
    Body: Partial<{
      spread_buy: number;
      spread_sell: number;
      fee_rate_buy: number;
      fee_rate_sell: number;
    }>;
  }>,
  reply: FastifyReply,
) {
  const body = req.body ?? {};

  const updates: Array<[string, number]> = [];
  if (body.spread_buy !== undefined) updates.push(['spread_buy', body.spread_buy]);
  if (body.spread_sell !== undefined) updates.push(['spread_sell', body.spread_sell]);
  if (body.fee_rate_buy !== undefined) updates.push(['fee_rate_buy', body.fee_rate_buy]);
  if (body.fee_rate_sell !== undefined) updates.push(['fee_rate_sell', body.fee_rate_sell]);

  if (updates.length === 0) {
    reply.code(400).send({ success: false, error: 'No config fields provided' });
    return;
  }

  const changedBy = typeof req.admin?.email === 'string' ? req.admin.email : 'admin';
  for (const [key, val] of updates) {
    await updateConfig(key, String(val), changedBy);
  }

  const config = await getAllConfig();
  reply.send({
    success: true,
    data: {
      spread_buy: Number(config['spread_buy'] ?? 50),
      spread_sell: Number(config['spread_sell'] ?? 50),
      fee_rate_buy: Number(config['fee_rate_buy'] ?? 0.008),
      fee_rate_sell: Number(config['fee_rate_sell'] ?? 0.008),
    },
  });
}
