import type { FastifyRequest, FastifyReply } from 'fastify';
import {
  createDeposit,
  createWithdrawal,
  getOrderByCode,
  cancelOrder,
  formatOrderResponse,
} from '../services/orderService';
import type { DepositRequest, WithdrawalRequest } from '../models/types';
import { createErrorReply, ErrorCodes } from '../middlewares/errorHandler';

export async function handleDeposit(
  req: FastifyRequest<{ Body: DepositRequest }>,
  reply: FastifyReply,
): Promise<void> {
  const amount = Number(req.body.amount);
  if (!amount || amount <= 0) {
    return createErrorReply(reply, 'INVALID_AMOUNT', 'Amount must be a positive number', req.id);
  }
  try {
    const data = await createDeposit(req.body, { clientIp: req.ip });
    return reply.send({ success: true, data });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    if (errMsg === 'RECIPIENT_NO_TRUSTLINE') {
      return createErrorReply(reply, 'RECIPIENT_NO_TRUSTLINE', 'Recipient wallet does not have a trustline for USDC. Please set up a trustline before depositing.', req.id);
    }
    if (errMsg === 'RECIPIENT_TRUSTLINE_NOT_AUTHORIZED') {
      return createErrorReply(reply, 'RECIPIENT_TRUSTLINE_NOT_AUTHORIZED', 'Recipient trustline is not authorized for receiving USDC', req.id);
    }
    if (errMsg === 'RECIPIENT_INSUFFICIENT_LIMIT') {
      return createErrorReply(reply, 'RECIPIENT_INSUFFICIENT_LIMIT', 'Recipient trustline limit is insufficient for this deposit amount', req.id);
    }
    if (errMsg === 'UNSUPPORTED_TOKEN') {
      return createErrorReply(reply, 'UNSUPPORTED_TOKEN', 'Token address not supported', req.id);
    }
    throw error;
  }
}

export async function handleWithdrawal(
  req: FastifyRequest<{ Body: WithdrawalRequest }>,
  reply: FastifyReply,
): Promise<void> {
  const amount = Number(req.body.amount);
  if (!amount || amount <= 0) {
    return createErrorReply(reply, 'INVALID_AMOUNT', 'Amount must be a positive number', req.id);
  }
  const data = await createWithdrawal(req.body, { clientIp: req.ip });
  return reply.send({ success: true, data });
}

export async function handleGetOrder(
  req: FastifyRequest<{ Params: { payment_code: string } }>,
  reply: FastifyReply,
): Promise<void> {
  const order = await getOrderByCode(req.params.payment_code);
  if (!order) {
    return createErrorReply(reply, 'ORDER_NOT_FOUND', 'Order not found', req.id);
  }
  return reply.send({ success: true, data: formatOrderResponse(order) });
}

export async function handleCancel(
  req: FastifyRequest<{ Params: { payment_code: string }; Body: { reason?: string } }>,
  reply: FastifyReply,
): Promise<void> {
  const result = await cancelOrder(req.params.payment_code, req.body?.reason);
  
  if (result.error) {
    const errorCode = result.error === 'ORDER_NOT_FOUND' ? 'ORDER_NOT_FOUND' : 
                      result.error === 'CANCEL_NOT_ALLOWED' ? 'CANCEL_NOT_ALLOWED' : 
                      'INTERNAL_ERROR';
    return createErrorReply(reply, errorCode, result.error, req.id);
  }
  
  return reply.send({ success: true, data: result.data });
}

export async function handleOrderSuccess(
  req: FastifyRequest<{ Params: { payment_code: string } }>,
  reply: FastifyReply,
): Promise<void> {
  const url = `${process.env.DOMAIN || ''}/order/${req.params.payment_code}?payment=success`;
  return reply.redirect(url, 302);
}

export async function handleOrderError(
  req: FastifyRequest<{ Params: { payment_code: string } }>,
  reply: FastifyReply,
): Promise<void> {
  const url = `${process.env.DOMAIN || ''}/order/${req.params.payment_code}?payment=error`;
  return reply.redirect(url, 302);
}

export async function handleOrderCancel(
  req: FastifyRequest<{ Params: { payment_code: string } }>,
  reply: FastifyReply,
): Promise<void> {
  const url = `${process.env.DOMAIN || ''}/order/${req.params.payment_code}?payment=cancel`;
  return reply.redirect(url, 302);
}
