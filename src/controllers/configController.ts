import type { FastifyRequest, FastifyReply } from 'fastify';
import { getAllConfig, getConfigNumber, updateConfig } from '../services/configService';

export async function handleGetFees(
  _req: FastifyRequest,
  reply: FastifyReply,
) {
  const [spreadBuy, spreadSell, feeRateBuy, feeRateSell, usdcSpreadBuy, usdcSpreadSell, usdcFeeRateBuy, usdcFeeRateSell, xlmSpreadBuy, xlmSpreadSell, xlmFeeRateBuy, xlmFeeRateSell, usdcMinFee, xlmMinFee] = await Promise.all([
    getConfigNumber('spread_buy', 50),
    getConfigNumber('spread_sell', 50),
    getConfigNumber('fee_rate_buy', 0.008),
    getConfigNumber('fee_rate_sell', 0.008),
    getConfigNumber('usdc_spread_buy', 50),
    getConfigNumber('usdc_spread_sell', 50),
    getConfigNumber('usdc_fee_rate_buy', 0.008),
    getConfigNumber('usdc_fee_rate_sell', 0.008),
    getConfigNumber('xlm_spread_buy', 50),
    getConfigNumber('xlm_spread_sell', 50),
    getConfigNumber('xlm_fee_rate_buy', 0.008),
    getConfigNumber('xlm_fee_rate_sell', 0.008),
    getConfigNumber('usdc_min_fee', 5000),
    getConfigNumber('xlm_min_fee', 5000),
  ]);

  reply.send({
    success: true,
    data: {
      spread_buy: spreadBuy,
      spread_sell: spreadSell,
      fee_rate_buy: feeRateBuy,
      fee_rate_sell: feeRateSell,
      usdc_spread_buy: usdcSpreadBuy,
      usdc_spread_sell: usdcSpreadSell,
      usdc_fee_rate_buy: usdcFeeRateBuy,
      usdc_fee_rate_sell: usdcFeeRateSell,
      xlm_spread_buy: xlmSpreadBuy,
      xlm_spread_sell: xlmSpreadSell,
      xlm_fee_rate_buy: xlmFeeRateBuy,
      xlm_fee_rate_sell: xlmFeeRateSell,
      usdc_min_fee: usdcMinFee,
      xlm_min_fee: xlmMinFee,
    },
  });
}

interface PatchBody {
  spread_buy?: number;
  spread_sell?: number;
  fee_rate_buy?: number;
  fee_rate_sell?: number;
  usdc_spread_buy?: number;
  usdc_spread_sell?: number;
  usdc_fee_rate_buy?: number;
  usdc_fee_rate_sell?: number;
  xlm_spread_buy?: number;
  xlm_spread_sell?: number;
  xlm_fee_rate_buy?: number;
  xlm_fee_rate_sell?: number;
  usdc_min_fee?: number;
  xlm_min_fee?: number;
}

export async function handlePatchConfig(
  req: FastifyRequest<{ Body: PatchBody }>,
  reply: FastifyReply,
) {
  const body = req.body ?? {};

  const updates: Array<{ key: string; val: number }> = [];
  const pairs: Array<[key: string, val: number | undefined]> = [
    ['spread_buy', body.spread_buy],
    ['spread_sell', body.spread_sell],
    ['fee_rate_buy', body.fee_rate_buy],
    ['fee_rate_sell', body.fee_rate_sell],
    ['usdc_spread_buy', body.usdc_spread_buy],
    ['usdc_spread_sell', body.usdc_spread_sell],
    ['usdc_fee_rate_buy', body.usdc_fee_rate_buy],
    ['usdc_fee_rate_sell', body.usdc_fee_rate_sell],
    ['xlm_spread_buy', body.xlm_spread_buy],
    ['xlm_spread_sell', body.xlm_spread_sell],
    ['xlm_fee_rate_buy', body.xlm_fee_rate_buy],
    ['xlm_fee_rate_sell', body.xlm_fee_rate_sell],
    ['usdc_min_fee', body.usdc_min_fee],
    ['xlm_min_fee', body.xlm_min_fee],
  ];
  for (const [key, val] of pairs) {
    if (val !== undefined) updates.push({ key, val });
  }

  if (updates.length === 0) {
    reply.code(400).send({ success: false, error: 'No config fields provided' });
    return;
  }

  const changedBy = typeof req.admin?.email === 'string' ? req.admin.email : 'admin';
  for (const { key, val } of updates) {
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