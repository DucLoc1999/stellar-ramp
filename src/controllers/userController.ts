import type { FastifyRequest, FastifyReply } from 'fastify';
import { createErrorReply } from '../middlewares/errorHandler';
import * as userService from '../services/userService';
import * as paymentMethodService from '../services/paymentMethodService';
import * as s3Service from '../services/s3Service';
import * as fptAiVisionService from '../services/fptAiVisionService';

interface KycIdCardBody {
  image_front: string;
  image_back: string;
  phone?: string;
  email?: string;
}

function formatUserResponse(user: Record<string, unknown>) {
  const { kyc_image_front, kyc_image_back, ...rest } = user;
  return rest;
}

interface GetUserParams {
  identifier: string;
}

interface GetUserQuery {
  type?: string;
}

interface PaymentParams {
  user_id: string;
}

interface PaymentItemParams {
  user_id: string;
  payment_id: string;
}

export async function handleGetUser(
  req: FastifyRequest<{ Params: GetUserParams; Querystring: GetUserQuery }>,
  reply: FastifyReply,
): Promise<void> {
  const { identifier } = req.params;
  const type = req.query.type || 'id';

  let user;
  switch (type) {
    case 'id':
      user = await userService.findById(Number(identifier));
      break;
    case 'phone':
      user = await userService.findByPhone(identifier);
      break;
    case 'email':
      user = await userService.findByEmail(identifier);
      break;
    case 'cccd':
      user = await userService.findByIdNumber(identifier);
      break;
    default:
      return createErrorReply(reply, 'VALIDATION_ERROR', 'Invalid type param. Use: id, phone, email, cccd', req.id);
  }

  if (!user) {
    return createErrorReply(reply, 'USER_NOT_FOUND', 'User not found', req.id);
  }

  return reply.send({ success: true, data: formatUserResponse(user as unknown as Record<string, unknown>) });
}

export async function handleKycIdCard(
  req: FastifyRequest<{ Body: KycIdCardBody }>,
  reply: FastifyReply,
): Promise<void> {
  const { image_front, image_back, phone, email } = req.body;

  if (!phone && !email) {
    return createErrorReply(reply, 'VALIDATION_ERROR', 'At least one of phone or email is required', req.id);
  }

  if (!image_front || !image_back) {
    return createErrorReply(reply, 'VALIDATION_ERROR', 'Both image_front and image_back are required', req.id);
  }

  const timestamp = Date.now();
  const frontKey = `kyc/${timestamp}_front.jpg`;
  const backKey = `kyc/${timestamp}_back.jpg`;

  const [frontUrl, backUrl] = await Promise.all([
    s3Service.uploadBase64Image(image_front, frontKey, 'image/jpeg'),
    s3Service.uploadBase64Image(image_back, backKey, 'image/jpeg'),
  ]);

  const [frontData, backData] = await Promise.all([
    fptAiVisionService.recognizeIdCard(frontUrl),
    fptAiVisionService.recognizeIdCard(backUrl),
  ]);

  const idNumber = frontData.id;
  if (!idNumber) {
    return createErrorReply(reply, 'VALIDATION_ERROR', 'Could not extract ID number from front image', req.id);
  }

  const existing = await userService.findByIdNumber(idNumber);
  if (existing) {
    return reply.send({ success: true, data: formatUserResponse(existing as unknown as Record<string, unknown>) });
  }

  const dob = fptAiVisionService.parseDate(frontData.dob);
  if (!dob) {
    return createErrorReply(reply, 'VALIDATION_ERROR', 'Could not parse date of birth from ID card', req.id);
  }

  const doe = fptAiVisionService.parseDate(backData.issue_date || backData.doe || frontData.doe);

  const user = await userService.create({
    id_number: idNumber,
    name: frontData.name,
    dob,
    sex: frontData.sex || null,
    nationality: frontData.nationality || null,
    home: frontData.home || null,
    address: frontData.address || null,
    doe: doe || null,
    phone: phone || null,
    email: email || null,
    kyc_image_front: frontUrl,
    kyc_image_back: backUrl,
  });

  return reply.status(201).send({ success: true, data: formatUserResponse(user as unknown as Record<string, unknown>) });
}

export async function handleListPayment(
  req: FastifyRequest<{ Params: PaymentParams }>,
  reply: FastifyReply,
): Promise<void> {
  const userId = Number(req.params.user_id);
  const user = await userService.findById(userId);
  if (!user) {
    return createErrorReply(reply, 'USER_NOT_FOUND', 'User not found', req.id);
  }

  const methods = await paymentMethodService.listByUserId(userId);
  return reply.send({ success: true, data: methods });
}

export async function handleAddPayment(
  req: FastifyRequest<{ Params: PaymentParams; Body: paymentMethodService.CreatePaymentMethodInput }>,
  reply: FastifyReply,
): Promise<void> {
  const userId = Number(req.params.user_id);
  const user = await userService.findById(userId);
  if (!user) {
    return createErrorReply(reply, 'USER_NOT_FOUND', 'User not found', req.id);
  }

  const method = await paymentMethodService.create(userId, req.body);
  return reply.status(201).send({ success: true, data: method });
}

export async function handleUpdatePayment(
  req: FastifyRequest<{ Params: PaymentItemParams; Body: paymentMethodService.UpdatePaymentMethodInput }>,
  reply: FastifyReply,
): Promise<void> {
  const userId = Number(req.params.user_id);
  const paymentId = Number(req.params.payment_id);

  const existing = await paymentMethodService.findById(paymentId);
  if (!existing || existing.user_id !== userId) {
    return createErrorReply(reply, 'PAYMENT_METHOD_NOT_FOUND', 'Payment method not found', req.id);
  }

  const updated = await paymentMethodService.update(paymentId, req.body);
  return reply.send({ success: true, data: updated });
}

export async function handleDeletePayment(
  req: FastifyRequest<{ Params: PaymentItemParams }>,
  reply: FastifyReply,
): Promise<void> {
  const userId = Number(req.params.user_id);
  const paymentId = Number(req.params.payment_id);

  const existing = await paymentMethodService.findById(paymentId);
  if (!existing || existing.user_id !== userId) {
    return createErrorReply(reply, 'PAYMENT_METHOD_NOT_FOUND', 'Payment method not found', req.id);
  }

  await paymentMethodService.remove(paymentId);
  return reply.send({ success: true, data: { id: paymentId, deleted: true } });
}
