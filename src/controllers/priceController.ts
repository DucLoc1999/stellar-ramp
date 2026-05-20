import type { FastifyRequest, FastifyReply } from 'fastify';
import { getRate, getMinFee } from '../services/priceService';

export async function handleGetRate(
  _req: FastifyRequest,
  reply: FastifyReply,
) {
  const rate = await getRate('USDC');
  const minFee = await getMinFee('USDC');
  reply.send({
    created_at: rate.updated_at,
    buy: rate.buy_price,
    sell: rate.sell_price,
    fee_rate_buy: rate.fee_rate_buy,
    fee_rate_sell: rate.fee_rate_sell,
    min_fee_vnd: minFee,
  });
}

export async function handleGetXlmRate(
  _req: FastifyRequest,
  reply: FastifyReply,
) {
  const rate = await getRate('XLM');
  const minFee = await getMinFee('XLM');
  reply.send({
    created_at: rate.updated_at,
    buy: rate.buy_price,
    sell: rate.sell_price,
    fee_rate_buy: rate.fee_rate_buy,
    fee_rate_sell: rate.fee_rate_sell,
    min_fee_vnd: minFee,
  });
}