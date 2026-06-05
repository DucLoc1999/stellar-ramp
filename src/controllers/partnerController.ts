import type { FastifyReply, FastifyRequest } from 'fastify';
import { createPartner, findPartnerById, listPartners, type PartnerRecord } from '../services/partnerService';
import { createErrorReply } from '../middlewares/errorHandler';

type PartnerBody = {
  name: string;
  fee_buy: number;
  fee_sell: number;
  active?: boolean;
};

function serializePartner(partner: PartnerRecord) {
  return {
    id: partner.id,
    name: partner.name,
    key: partner.key,
    fee_buy: partner.fee_buy,
    fee_sell: partner.fee_sell,
    active: partner.active,
    created_at: partner.created_at instanceof Date ? partner.created_at.toISOString() : String(partner.created_at),
    updated_at: partner.updated_at instanceof Date
      ? partner.updated_at.toISOString()
      : partner.updated_at
        ? String(partner.updated_at)
        : null,
  };
}

export async function handleCreatePartner(
  req: FastifyRequest<{ Body: PartnerBody }>,
  reply: FastifyReply,
): Promise<void> {
  const body = req.body ?? ({} as PartnerBody);

  if (!body.name || typeof body.name !== 'string') {
    return createErrorReply(reply, 'VALIDATION_ERROR', 'name is required', req.id);
  }
  if (typeof body.fee_buy !== 'number' || body.fee_buy < 0) {
    return createErrorReply(reply, 'VALIDATION_ERROR', 'fee_buy must be a non-negative number', req.id);
  }
  if (typeof body.fee_sell !== 'number' || body.fee_sell < 0) {
    return createErrorReply(reply, 'VALIDATION_ERROR', 'fee_sell must be a non-negative number', req.id);
  }

  const partner = await createPartner({
    name: body.name,
    fee_buy: body.fee_buy,
    fee_sell: body.fee_sell,
    active: body.active ?? true,
  });

  reply.code(201).send({ success: true, data: serializePartner(partner) });
}

export async function handleListPartners(
  _req: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const partners = await listPartners();
  reply.send({ success: true, data: partners.map(serializePartner) });
}

export async function handleGetPartner(
  req: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
): Promise<void> {
  const partner = await findPartnerById(req.params.id);
  if (!partner) {
    return createErrorReply(reply, 'PARTNER_NOT_FOUND', 'Partner not found', req.id);
  }

  reply.send({ success: true, data: serializePartner(partner) });
}
