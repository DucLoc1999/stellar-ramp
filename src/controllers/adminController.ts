import type { FastifyRequest, FastifyReply } from 'fastify';
import db from '../db';
import { verifyAdminCredentials } from '../services/adminService';
import { signJwt } from '../utils/jwt';

const ACCESS_TOKEN_TTL_SEC = Number(process.env.ADMIN_JWT_TTL_SEC ?? 60 * 60 * 12); // 12h

export async function handleLogin(
  req: FastifyRequest<{ Body: { email: string; password: string } }>,
  reply: FastifyReply,
) {
  const secret = process.env.ADMIN_JWT_SECRET;
  if (!secret) {
    reply.code(503).send({ success: false, error: 'Admin auth not configured' });
    return;
  }

  const { email, password } = req.body ?? ({} as any);
  if (!email || !password) {
    reply.code(400).send({ success: false, error: 'Missing email or password' });
    return;
  }

  const admin = await verifyAdminCredentials(email, password);
  if (!admin) {
    reply.code(401).send({ success: false, error: 'Invalid credentials' });
    return;
  }

  const access_token = signJwt({ sub: admin.id, email: admin.email }, secret, ACCESS_TOKEN_TTL_SEC);
  reply.send({
    success: true,
    data: {
      access_token,
      token_type: 'Bearer',
      expires_in: ACCESS_TOKEN_TTL_SEC,
    },
  });
}

export async function handleGetStats(
  req: FastifyRequest<{ Querystring: { from?: string; to?: string } }>,
  reply: FastifyReply,
) {
  const from = req.query?.from ? new Date(req.query.from) : undefined;
  const to = req.query?.to ? new Date(req.query.to) : undefined;
  if ((from && Number.isNaN(from.getTime())) || (to && Number.isNaN(to.getTime()))) {
    reply.code(400).send({ success: false, error: 'Invalid from/to date' });
    return;
  }

  const rows = await db('orders')
    .where({ payment_status: 'payment_received' })
    .whereNotNull('payment_confirmed_at')
    .modify((qb) => {
      if (from) qb.andWhere('payment_confirmed_at', '>=', from);
      if (to) qb.andWhere('payment_confirmed_at', '<=', to);
    })
    .select('direction')
    .count('* as count')
    .sum('net_vnd as net_vnd')
    .sum('fee_vnd as fee_vnd')
    .sum('usdt_amount as usdt_amount')
    .groupBy('direction');

  const byDirection: Record<string, unknown> = {};
  let totalCount = 0;
  let totalNetVnd = 0;
  let totalFeeVnd = 0;
  let totalUsdt = 0;

  for (const r of rows as any[]) {
    const count = Number(r.count ?? 0);
    const net_vnd = Number(r.net_vnd ?? 0);
    const fee_vnd = Number(r.fee_vnd ?? 0);
    const usdt_amount = Number(r.usdt_amount ?? 0);
    totalCount += count;
    totalNetVnd += net_vnd;
    totalFeeVnd += fee_vnd;
    totalUsdt += usdt_amount;
    byDirection[String(r.direction)] = { count, net_vnd, fee_vnd, usdt_amount };
  }

  reply.send({
    success: true,
    data: {
      from: from ? from.toISOString() : null,
      to: to ? to.toISOString() : null,
      totals: {
        count: totalCount,
        net_vnd: totalNetVnd,
        fee_vnd: totalFeeVnd,
        usdt_amount: totalUsdt,
      },
      by_direction: byDirection,
    },
  });
}

