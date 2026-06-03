import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { getLatestPrice, getHistory, type Exchange } from '../services/snapshotLandingPageDb';
import { getRate, getMinFee } from '../services/priceService';

async function handleAllRates(_request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const exchanges: Exchange[] = ['binance', 'okx', 'bybit'];
  const assets = ['USDC', 'XLM'] as const;

  const p2p: Record<string, Record<string, { bestBuyPrice: number | null; bestSellPrice: number | null }>> = {};
  for (const ex of exchanges) {
    p2p[ex] = {};
    for (const asset of assets) {
      p2p[ex][asset.toLowerCase()] = {
        bestBuyPrice: getLatestPrice(ex, 'buy', asset),
        bestSellPrice: getLatestPrice(ex, 'sell', asset),
      };
    }
  }

  const [usdcRate, xlmRate] = await Promise.all([getRate('USDC'), getRate('XLM')]);
  const [usdcMinFee, xlmMinFee] = await Promise.all([getMinFee('USDC'), getMinFee('XLM')]);

  const our = {
    usdc: {
      buy: usdcRate.buy_price,
      sell: usdcRate.sell_price,
      fee_rate_buy: usdcRate.fee_rate_buy,
      fee_rate_sell: usdcRate.fee_rate_sell,
      min_fee_vnd: usdcMinFee,
      created_at: usdcRate.updated_at,
    },
    xlm: {
      buy: xlmRate.buy_price,
      sell: xlmRate.sell_price,
      fee_rate_buy: xlmRate.fee_rate_buy,
      fee_rate_sell: xlmRate.fee_rate_sell,
      min_fee_vnd: xlmMinFee,
      created_at: xlmRate.updated_at,
    },
  };

  return reply.send({ ...p2p, our });
}

async function handleAllHistory(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const { days } = request.query as { days?: number };
  const d = Math.min(30, Math.max(1, Number(days) || 7));
  const exchanges: Exchange[] = ['binance', 'okx', 'bybit', 'our'];
  const result: Record<string, ReturnType<typeof getHistory>> = {};
  for (const ex of exchanges) {
    result[ex] = getHistory(ex, d);
  }
  return reply.send(result);
}

export async function landingRoutes(app: FastifyInstance): Promise<void> {
  app.get('/p2p-rates', {
    schema: {
      tags: ['Landing Page'],
      summary: 'Get all P2P rates (Binance, OKX, Bybit) and our price',
      response: {
        200: {
          type: 'object',
          properties: {
            binance: {
              type: 'object',
              properties: {
                usdc: {
                  type: 'object',
                  properties: {
                    bestBuyPrice: { type: ['number', 'null'] },
                    bestSellPrice: { type: ['number', 'null'] },
                  },
                },
                xlm: {
                  type: 'object',
                  properties: {
                    bestBuyPrice: { type: ['number', 'null'] },
                    bestSellPrice: { type: ['number', 'null'] },
                  },
                },
              },
            },
            okx: {
              type: 'object',
              properties: {
                usdc: {
                  type: 'object',
                  properties: {
                    bestBuyPrice: { type: ['number', 'null'] },
                    bestSellPrice: { type: ['number', 'null'] },
                  },
                },
                xlm: {
                  type: 'object',
                  properties: {
                    bestBuyPrice: { type: ['number', 'null'] },
                    bestSellPrice: { type: ['number', 'null'] },
                  },
                },
              },
            },
            bybit: {
              type: 'object',
              properties: {
                usdc: {
                  type: 'object',
                  properties: {
                    bestBuyPrice: { type: ['number', 'null'] },
                    bestSellPrice: { type: ['number', 'null'] },
                  },
                },
                xlm: {
                  type: 'object',
                  properties: {
                    bestBuyPrice: { type: ['number', 'null'] },
                    bestSellPrice: { type: ['number', 'null'] },
                  },
                },
              },
            },
            our: {
              type: 'object',
              properties: {
                usdc: {
                  type: 'object',
                  properties: {
                    buy: { type: 'number' },
                    sell: { type: 'number' },
                    fee_rate_buy: { type: 'number' },
                    fee_rate_sell: { type: 'number' },
                    min_fee_vnd: { type: 'number' },
                    created_at: { type: 'string' },
                  },
                },
                xlm: {
                  type: 'object',
                  properties: {
                    buy: { type: 'number' },
                    sell: { type: 'number' },
                    fee_rate_buy: { type: 'number' },
                    fee_rate_sell: { type: 'number' },
                    min_fee_vnd: { type: 'number' },
                    created_at: { type: 'string' },
                  },
                },
              },
            },
          },
        },
      },
    } as any,
  }, handleAllRates);

  app.get('/p2p-history', {
    schema: {
      tags: ['Landing Page'],
      summary: 'Get price history for all exchanges (Binance, OKX, Bybit, Our)',
      querystring: {
        type: 'object',
        properties: {
          days: { type: 'integer', minimum: 1, maximum: 30 },
        },
      },
    } as any,
  }, handleAllHistory);
}
