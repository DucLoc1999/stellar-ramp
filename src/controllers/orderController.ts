import type { FastifyRequest, FastifyReply } from 'fastify';
import {
  createDeposit,
  createWithdrawal,
  getOrderById,
  getOrderByCode,
  cancelOrder,
  formatOrderResponse,
} from '../services/orderService';
import type { DepositRequest, WithdrawalRequest } from '../models/types';
import { createErrorReply } from '../middlewares/errorHandler';

async function resolveOrderByParam(id: string) {
  const trimmed = id.trim();
  const numeric = Number(trimmed);

  if (Number.isInteger(numeric) && String(numeric) === trimmed) {
    const byId = await getOrderById(numeric);
    if (byId) return byId;
  }

  const byCode = await getOrderByCode(trimmed);
  if (byCode) return byCode;

  if (Number.isInteger(numeric)) {
    return await getOrderById(numeric);
  }

  return null;
}

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
    if (errMsg === 'XLM_MIN_AMOUNT_1') {
      return createErrorReply(reply, 'INVALID_AMOUNT', 'Minimum XLM amount is 1 (required to activate new Stellar accounts)', req.id);
    }
    if (errMsg === 'INSUFFICIENT_LIQUIDITY') {
      return createErrorReply(reply, 'INSUFFICIENT_LIQUIDITY', 'Insufficient available liquidity for this order', req.id);
    }
    if (errMsg === 'RESERVATION_NOT_READY') {
      return createErrorReply(reply, 'RESERVATION_NOT_READY', 'Liquidity reservation service is not ready', req.id);
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
  try {
    const data = await createWithdrawal(req.body, { clientIp: req.ip });
    return reply.send({ success: true, data });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    if (errMsg === 'INSUFFICIENT_LIQUIDITY') {
      return createErrorReply(reply, 'INSUFFICIENT_LIQUIDITY', 'Insufficient available liquidity for this order', req.id);
    }
    if (errMsg === 'RESERVATION_NOT_READY') {
      return createErrorReply(reply, 'RESERVATION_NOT_READY', 'Liquidity reservation service is not ready', req.id);
    }
    throw error;
  }
}

export async function handleGetOrder(
  req: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
): Promise<void> {
  const order = await resolveOrderByParam(req.params.id);
  if (!order) {
    return createErrorReply(reply, 'ORDER_NOT_FOUND', 'Order not found', req.id);
  }
  const data = await formatOrderResponse(order);
  return reply.send({ success: true, data });
}

export async function handleCancel(
  req: FastifyRequest<{ Params: { id: string }; Body: { reason?: string } }>,
  reply: FastifyReply,
): Promise<void> {
  const order = await resolveOrderByParam(req.params.id);
  if (!order) {
    return createErrorReply(reply, 'ORDER_NOT_FOUND', 'Order not found', req.id);
  }

  const result = await cancelOrder(order.payment_code, req.body?.reason);

  if (result.error) {
    const errorCode = result.error === 'ORDER_NOT_FOUND' ? 'ORDER_NOT_FOUND' :
                      result.error === 'CANCEL_NOT_ALLOWED' ? 'CANCEL_NOT_ALLOWED' :
                      'INTERNAL_ERROR';
    return createErrorReply(reply, errorCode, result.error, req.id);
  }

  return reply.send({ success: true, data: result.data });
}

export async function handleOrderSuccess(
  req: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
): Promise<void> {
  const order = await resolveOrderByParam(req.params.id);
  const paymentCode = order?.payment_code || req.params.id;
  const url = `${process.env.DOMAIN || ''}/order/${paymentCode}?payment=success`;
  return reply.redirect(url, 302);
}

export async function handleOrderError(
  req: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
): Promise<void> {
  const order = await resolveOrderByParam(req.params.id);
  const paymentCode = order?.payment_code || req.params.id;
  const url = `${process.env.DOMAIN || ''}/order/${paymentCode}?payment=error`;
  return reply.redirect(url, 302);
}

export async function handleOrderCancel(
  req: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
): Promise<void> {
  const order = await resolveOrderByParam(req.params.id);
  const paymentCode = order?.payment_code || req.params.id;
  const url = `${process.env.DOMAIN || ''}/order/${paymentCode}?payment=cancel`;
  return reply.redirect(url, 302);
}
