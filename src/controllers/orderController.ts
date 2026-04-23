import type { FastifyRequest, FastifyReply } from 'fastify';
import {
  createDeposit,
  createWithdrawal,
  getOrderByCode,
} from '../services/orderService';
import type { DepositRequest, WithdrawalRequest } from '../models/types';

export async function handleDeposit(
  req: FastifyRequest<{ Body: DepositRequest }>,
  reply: FastifyReply,
): Promise<void> {
  const amount = Number(req.body.amount);
  if (!amount || amount <= 0) {
    reply.status(400).send({ success: false, error: 'amount must be a positive number' });
    return;
  }
  const data = await createDeposit(req.body);
  reply.send({ success: true, data });
}

export async function handleWithdrawal(
  req: FastifyRequest<{ Body: WithdrawalRequest }>,
  reply: FastifyReply,
): Promise<void> {
  const amount = Number(req.body.amount);
  if (!amount || amount <= 0) {
    reply.status(400).send({ success: false, error: 'amount must be a positive number' });
    return;
  }
  const data = await createWithdrawal(req.body);
  reply.send({ success: true, data });
}

export async function handleGetOrder(
  req: FastifyRequest<{ Params: { payment_code: string } }>,
  reply: FastifyReply,
): Promise<void> {
  const order = await getOrderByCode(req.params.payment_code);
  if (!order) {
    reply.status(404).send({ success: false, error: 'Order not found' });
    return;
  }
  reply.send({ success: true, data: order });
}
