import type { FastifyRequest, FastifyReply } from 'fastify';
import { verifyAdminCredentials, createAdmin, findAdminByEmail, changeAdminPassword } from '../services/adminService';
import { getAllConfig, updateConfig } from '../services/configService';
import { getRate } from '../services/priceService';
import { signJwt } from '../utils/jwt';
import { createErrorReply } from '../middlewares/errorHandler';
import db from '../db';

const ACCESS_TOKEN_TTL_SEC = Number(process.env.ADMIN_JWT_TTL_SEC ?? 60 * 60 * 12);

export async function handleCmsLogin(
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

export async function handleCreateAdmin(
  req: FastifyRequest<{ Body: { key: string; email: string; password: string } }>,
  reply: FastifyReply,
) {
  const createAdminKey = process.env.CMS_CREATE_ADMIN_KEY;
  if (!createAdminKey) {
    reply.code(503).send({ success: false, error: 'Create admin not configured' });
    return;
  }

  const { key, email, password } = req.body ?? ({} as any);

  if (!key || key !== createAdminKey) {
    reply.code(401).send({ success: false, error: 'Invalid key' });
    return;
  }

  if (!email || typeof email !== 'string') {
    return createErrorReply(reply, 'VALIDATION_ERROR', 'Email is required', req.id);
  }

  if (!password || typeof password !== 'string' || password.length < 8) {
    return createErrorReply(reply, 'VALIDATION_ERROR', 'Password must be at least 8 characters', req.id);
  }

  const existing = await findAdminByEmail(email);
  if (existing) {
    return createErrorReply(reply, 'VALIDATION_ERROR', 'Email already in use', req.id);
  }

  const id = await createAdmin(email, password);
  return reply.code(201).send({ success: true, data: { id, email } });
}

const TOKENS = ['usdc', 'xlm'] as const;
type Token = typeof TOKENS[number];

const FIELD_KEYS = ['spread_buy', 'spread_sell', 'fee_rate_buy', 'fee_rate_sell', 'min_fee'] as const;
type FieldKey = typeof FIELD_KEYS[number];

const DEFAULTS: Record<FieldKey, number> = {
  spread_buy: 50,
  spread_sell: 50,
  fee_rate_buy: 0.008,
  fee_rate_sell: 0.008,
  min_fee: 5000,
};

type TokenConfig = Record<FieldKey, number>;
type AllTokenConfig = Record<Token, TokenConfig>;

type PatchBody = Partial<Record<Token, Partial<Record<FieldKey, number>>>>;

async function getOrCreateTokenConfig(changedBy: string): Promise<AllTokenConfig> {
  const config = await getAllConfig();
  const result = {} as AllTokenConfig;

  for (const token of TOKENS) {
    const tokenCfg = {} as TokenConfig;
    for (const field of FIELD_KEYS) {
      const key = `${token}_${field}`;
      if (config[key] === undefined) {
        await updateConfig(key, String(DEFAULTS[field]), changedBy);
        tokenCfg[field] = DEFAULTS[field];
      } else {
        tokenCfg[field] = Number(config[key]);
      }
    }
    result[token] = tokenCfg;
  }

  return result;
}

export async function handleGetConfig(
  req: FastifyRequest,
  reply: FastifyReply,
) {
  const data = await getOrCreateTokenConfig(req.admin?.email ?? 'cms');
  reply.send({ success: true, data });
}

export async function handlePatchCmsConfig(
  req: FastifyRequest<{ Body: PatchBody }>,
  reply: FastifyReply,
) {
  const body = req.body ?? {};
  const updates: Array<[string, number]> = [];

  for (const token of TOKENS) {
    const tokenBody = body[token];
    if (!tokenBody) continue;
    for (const field of FIELD_KEYS) {
      if (tokenBody[field] !== undefined) {
        updates.push([`${token}_${field}`, tokenBody[field]!]);
      }
    }
  }

  if (updates.length === 0) {
    return createErrorReply(reply, 'VALIDATION_ERROR', 'No config fields provided', req.id);
  }

  const changedBy = req.admin?.email ?? 'cms';
  for (const [key, val] of updates) {
    await updateConfig(key, String(val), changedBy);
  }

  const data = await getOrCreateTokenConfig(changedBy);
  reply.send({ success: true, data });
}

export async function handleChangePassword(
  req: FastifyRequest<{ Body: { currentPassword: string; newPassword: string } }>,
  reply: FastifyReply,
) {
  const { currentPassword, newPassword } = req.body ?? ({} as any);

  if (!currentPassword || !newPassword) {
    return createErrorReply(reply, 'VALIDATION_ERROR', 'currentPassword and newPassword are required', req.id);
  }
  if (newPassword.length < 8) {
    return createErrorReply(reply, 'VALIDATION_ERROR', 'New password must be at least 8 characters', req.id);
  }

  const email = req.admin!.email;
  const valid = await verifyAdminCredentials(email, currentPassword);
  if (!valid) {
    reply.code(401).send({ success: false, error: 'Current password is incorrect' });
    return;
  }

  await changeAdminPassword(email, newPassword);
  reply.send({ success: true });
}

export async function handleGetAuditLog(
  _req: FastifyRequest,
  reply: FastifyReply,
) {
  const rows = await db('fee_audit_log')
    .orderBy('changed_at', 'desc')
    .limit(50);

  const entries = rows.map((r: any) => ({
    id: String(r.id),
    action: 'UPDATE_CONFIG',
    details: JSON.stringify({ key: r.config_key, old: r.old_value, new: r.new_value }),
    createdAt: r.changed_at instanceof Date ? r.changed_at.toISOString() : String(r.changed_at),
    user: { name: r.changed_by ?? 'admin', email: r.changed_by ?? 'admin' },
  }));

  reply.send(entries);
}

export async function handleGetRates(
  _req: FastifyRequest,
  reply: FastifyReply,
) {
  const [usdc, xlm] = await Promise.all([getRate('USDC'), getRate('XLM')]);
  reply.send({
    success: true,
    data: {
      usdc: { buy: usdc.buy_price, sell: usdc.sell_price },
      xlm: { buy: xlm.buy_price, sell: xlm.sell_price },
    },
  });
}
