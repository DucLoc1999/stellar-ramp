import type { FastifyRequest, FastifyReply } from 'fastify';
import { getAllTokenConfigs, upsertTokenConfig } from '../services/configService';

export async function handleGetFees(
  _req: FastifyRequest,
  reply: FastifyReply,
) {
  const tokenConfigs = await getAllTokenConfigs();
  const usdcBuy = tokenConfigs['USDC']?.buy;
  const usdcSell = tokenConfigs['USDC']?.sell;
  const xlmBuy = tokenConfigs['XLM']?.buy;
  const xlmSell = tokenConfigs['XLM']?.sell;

  reply.send({
    success: true,
    data: {
      usdc_spread_buy: usdcBuy?.spread ?? 50,
      usdc_spread_sell: usdcSell?.spread ?? 50,
      usdc_fee_rate_buy: usdcBuy?.fee_rate ?? 0.008,
      usdc_fee_rate_sell: usdcSell?.fee_rate ?? 0.008,
      usdc_min_fee: usdcBuy?.min_fee ?? 5000,
      usdc_min_order_amount: usdcBuy?.min_order_amount ?? 1,
      xlm_spread_buy: xlmBuy?.spread ?? 50,
      xlm_spread_sell: xlmSell?.spread ?? 50,
      xlm_fee_rate_buy: xlmBuy?.fee_rate ?? 0.008,
      xlm_fee_rate_sell: xlmSell?.fee_rate ?? 0.008,
      xlm_min_fee: xlmBuy?.min_fee ?? 5000,
      xlm_min_order_amount: xlmBuy?.min_order_amount ?? 1,
    },
  });
}

interface TokenSidePatch {
  spread?: number;
  fee_rate?: number;
  min_fee?: number;
  min_order_amount?: number;
}

interface PatchBody {
  USDC_buy?: TokenSidePatch;
  USDC_sell?: TokenSidePatch;
  XLM_buy?: TokenSidePatch;
  XLM_sell?: TokenSidePatch;
}

export async function handlePatchConfig(
  req: FastifyRequest<{ Body: PatchBody }>,
  reply: FastifyReply,
) {
  const body = req.body ?? {};
  const changedBy = typeof req.admin?.email === 'string' ? req.admin.email : 'admin';

  const tokenSidePairs: Array<[token: string, side: 'buy' | 'sell', patch: TokenSidePatch]> = [
    ['USDC', 'buy', body.USDC_buy!],
    ['USDC', 'sell', body.USDC_sell!],
    ['XLM', 'buy', body.XLM_buy!],
    ['XLM', 'sell', body.XLM_sell!],
  ];

  let updated = 0;
  for (const [token, side, patch] of tokenSidePairs) {
    if (patch && Object.keys(patch).length > 0) {
      await upsertTokenConfig(token, side, patch, changedBy);
      updated++;
    }
  }

  if (updated === 0) {
    reply.code(400).send({ success: false, error: 'No config fields provided' });
    return;
  }

  const tokenConfigs = await getAllTokenConfigs();
  const usdcBuy = tokenConfigs['USDC']?.buy;
  const usdcSell = tokenConfigs['USDC']?.sell;
  const xlmBuy = tokenConfigs['XLM']?.buy;
  const xlmSell = tokenConfigs['XLM']?.sell;

  reply.send({
    success: true,
    data: {
      usdc_spread_buy: usdcBuy?.spread ?? 50,
      usdc_spread_sell: usdcSell?.spread ?? 50,
      usdc_fee_rate_buy: usdcBuy?.fee_rate ?? 0.008,
      usdc_fee_rate_sell: usdcSell?.fee_rate ?? 0.008,
      usdc_min_fee: usdcBuy?.min_fee ?? 5000,
      usdc_min_order_amount: usdcBuy?.min_order_amount ?? 1,
      xlm_spread_buy: xlmBuy?.spread ?? 50,
      xlm_spread_sell: xlmSell?.spread ?? 50,
      xlm_fee_rate_buy: xlmBuy?.fee_rate ?? 0.008,
      xlm_fee_rate_sell: xlmSell?.fee_rate ?? 0.008,
      xlm_min_fee: xlmBuy?.min_fee ?? 5000,
      xlm_min_order_amount: xlmBuy?.min_order_amount ?? 1,
    },
  });
}