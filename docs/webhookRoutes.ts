import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import webhookController from '../controllers/webhookController';

export const webhookRoutes: FastifyPluginAsync = async (
  fastify: FastifyInstance
): Promise<void> => {
  fastify.post(
    '/webhooks/payment',
    {
      schema: {
        body: {
          type: 'object',
          required: ['id', 'topic', 'ts', 'payload'],
          properties: {
            id: {
              type: 'string',
            },
            topic: {
              type: 'string',
            },
            ts: {
              type: 'string',
            },
            payload: {
              type: 'object',
              required: ['order_id', 'old_order_state', 'new_order_state'],
              properties: {
                order_id: {
                  type: 'string',
                },
                old_order_state: {
                  type: 'number',
                },
                new_order_state: {
                  type: 'number',
                },
                old_order_processing_state: {
                  type: 'number',
                },
                new_order_processing_state: {
                  type: 'number',
                },
              },
            },
          },
        },
        headers: {
          type: 'object',
          properties: {
            'Content-Type': {
              type: 'string',
            },
            'User-Agent': {
              type: 'string',
            },
            'X-HSPay-Event-Topic': {
              type: 'string',
            },
            'X-HSPay-Event-Signature': {
              type: 'string',
            },
          },
        },
      },
    },
    webhookController.handlePaymentWebhook.bind(webhookController)
  );

  return Promise.resolve();
};

export default webhookRoutes;
