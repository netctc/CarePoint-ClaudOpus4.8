import { Router } from 'express';
import Stripe from 'stripe';
import { z } from 'zod';
import { paymentIntentCreateSchema } from '@care-center/contracts';
import { requireAuth } from '../../middleware/auth';
import { allowRoles } from '../../middleware/rbac';
import { validateBody } from '../../middleware/validate';
import { badRequest, notFound } from '../../lib/http';
import { prisma } from '../../lib/prisma';
import { env } from '../../lib/env';
import { writeAuditLog } from '../../lib/audit';
import { createWalletMethod, deleteWalletMethod, getWalletMethod, listWalletMethods, setDefaultWalletMethod } from '../../lib/payment-wallet-store';

const stripe = env.stripeSecretKey ? new Stripe(env.stripeSecretKey) : null;

const walletMethodSchema = z.object({
  type: z.enum(['CARD', 'APPLE_PAY', 'MADA', 'STC_PAY']).default('CARD'),
  brand: z.string().trim().min(2).max(40).optional(),
  label: z.string().trim().min(2).max(80).optional(),
  last4: z.string().trim().regex(/^\d{4}$/),
  setDefault: z.boolean().optional(),
});

export const paymentsRouter = Router();
const paymentAdminReadRoles = ['SUPER_ADMIN', 'COMPANY_ADMIN', 'COMPANY_SUPPORT', 'FINANCE'];
const paymentAdminWriteRoles = ['SUPER_ADMIN', 'COMPANY_ADMIN', 'FINANCE'];

paymentsRouter.use(requireAuth);

paymentsRouter.get('/wallet-methods', allowRoles(['PATIENT', 'COMPANY_ADMIN', 'COMPANY_SUPPORT', 'FINANCE']), async (req, res) => {
  const patientId = req.user?.role === 'PATIENT' ? await getPatientProfileId(req.user.userId) : String(req.query.patientId ?? '').trim();
  if (!patientId) throw badRequest('Patient profile is required');
  const items = await listWalletMethods({ organizationId: req.user?.organizationId ?? '', patientId });
  res.json({ items: items.map(sanitizeWalletMethod), count: items.length });
});

paymentsRouter.post('/wallet-methods', allowRoles(['PATIENT', 'COMPANY_ADMIN', 'COMPANY_SUPPORT']), validateBody(walletMethodSchema), async (req, res) => {
  const patientId = req.user?.role === 'PATIENT' ? await getPatientProfileId(req.user.userId) : String(req.body?.patientId ?? '').trim();
  if (!patientId) throw badRequest('Patient profile is required');
  const item = await createWalletMethod({
    organizationId: req.user?.organizationId ?? '',
    patientId,
    actorId: req.user?.userId,
    type: req.body.type,
    brand: req.body.brand,
    label: req.body.label,
    last4: req.body.last4,
    setDefault: req.body.setDefault,
    metadata: { source: 'wallet_methods_api' },
  });
  await writeAuditLog({
    actorId: req.user?.userId,
    organizationId: req.user?.organizationId,
    action: 'payment.wallet_method_added',
    resource: 'payment_wallet_method',
    resourceId: item.id,
    details: { patientId, type: item.type, label: item.label },
  });
  res.status(201).json({ item: sanitizeWalletMethod(item) });
});

paymentsRouter.post('/wallet-methods/:methodId/default', allowRoles(['PATIENT', 'COMPANY_ADMIN', 'COMPANY_SUPPORT']), async (req, res) => {
  const patientId = req.user?.role === 'PATIENT' ? await getPatientProfileId(req.user.userId) : String(req.body?.patientId ?? '').trim();
  if (!patientId) throw badRequest('Patient profile is required');
  const item = await setDefaultWalletMethod({ organizationId: req.user?.organizationId ?? '', patientId, methodId: req.params.methodId });
  if (!item) throw notFound('Wallet method not found');
  await writeAuditLog({
    actorId: req.user?.userId,
    organizationId: req.user?.organizationId,
    action: 'payment.wallet_method_defaulted',
    resource: 'payment_wallet_method',
    resourceId: item.id,
    details: { patientId },
  });
  res.json({ item: sanitizeWalletMethod(item) });
});

paymentsRouter.delete('/wallet-methods/:methodId', allowRoles(['PATIENT', 'COMPANY_ADMIN', 'COMPANY_SUPPORT']), async (req, res) => {
  const patientId = req.user?.role === 'PATIENT' ? await getPatientProfileId(req.user.userId) : String(req.body?.patientId ?? '').trim();
  if (!patientId) throw badRequest('Patient profile is required');
  const item = await deleteWalletMethod({ organizationId: req.user?.organizationId ?? '', patientId, methodId: req.params.methodId });
  if (!item) throw notFound('Wallet method not found');
  await writeAuditLog({
    actorId: req.user?.userId,
    organizationId: req.user?.organizationId,
    action: 'payment.wallet_method_deleted',
    resource: 'payment_wallet_method',
    resourceId: item.id,
    details: { patientId },
  });
  res.json({ item: sanitizeWalletMethod(item) });
});


async function getPatientProfileId(userId: string) {
  const profile = await prisma.patientProfile.findUnique({ where: { userId }, select: { id: true } });
  return profile?.id;
}

async function getProviderProfileId(userId: string) {
  const profile = await prisma.providerProfile.findUnique({ where: { userId }, select: { id: true } });
  return profile?.id;
}

function sanitizeWalletMethod(method: any) {
  return {
    id: method.id,
    type: method.type,
    brand: method.brand,
    label: method.label,
    last4: method.last4,
    isDefault: method.isDefault,
    status: method.status,
    createdAt: method.createdAt,
    updatedAt: method.updatedAt,
  };
}

async function getScopedPayment(paymentId: string, organizationId?: string) {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: {
      appointment: { select: { organizationId: true } },
      patient: { select: { organizationId: true } },
      provider: { select: { organizationId: true } },
    },
  });

  if (!payment) {
    throw notFound('Payment not found');
  }

  if (organizationId) {
    const matches = [
      payment.appointment?.organizationId,
      payment.patient?.organizationId,
      payment.provider?.organizationId,
    ].includes(organizationId);
    if (!matches) {
      throw notFound('Payment not found');
    }
  }

  return payment;
}

function asObject(value: unknown) {
  if (!value || Array.isArray(value) || typeof value !== 'object') {
    return {} as Record<string, any>;
  }
  return { ...(value as Record<string, any>) };
}

function getHoldState(metadata: unknown) {
  const data = asObject(metadata);
  const hold = asObject(data.adminHold);
  return {
    active: Boolean(hold.active),
    heldAt: hold.heldAt ?? null,
    heldBy: hold.heldBy ?? null,
    reasonCode: hold.reasonCode ?? null,
    note: hold.note ?? null,
    releasedAt: hold.releasedAt ?? null,
    releasedBy: hold.releasedBy ?? null,
  };
}

function applyAdminHold(metadata: unknown, patch: Record<string, any>) {
  const data = asObject(metadata);
  const current = asObject(data.adminHold);
  data.adminHold = { ...current, ...patch };
  return data;
}

function buildPaymentNextAction(params: {
  paymentMethod: string;
  reviewReasonCodes: string[];
  authorizationRequired: boolean;
}) {
  if (!params.reviewReasonCodes.length) {
    return {
      status: 'AUTHORIZED',
      title: 'Payment authorized',
      message: 'Payment authorization completed and the booking can proceed without manual review.',
      steps: ['No further payment action is required before the visit.'],
    };
  }

  const steps: string[] = [];
  if (params.reviewReasonCodes.includes('AUTHORIZATION_REQUIRED')) {
    steps.push('Upload or confirm prior authorization before finance review is completed.');
  }
  if (params.reviewReasonCodes.includes('CASH_COLLECTION_REQUIRED')) {
    steps.push('Pay at check-in or follow the payment instructions from support.');
  }
  if (params.reviewReasonCodes.includes('WALLET_CAPTURE_PENDING')) {
    steps.push('The saved wallet method is attached, but capture will be finalized during manual review.');
  }
  if (params.reviewReasonCodes.includes('GATEWAY_CAPTURE_PENDING')) {
    steps.push('Payment capture is pending because the gateway is running in manual review mode.');
  }
  if (!steps.length) {
    steps.push('Wait for operations or finance review before the booking is fully settled.');
  }

  return {
    status: 'PENDING',
    title: params.paymentMethod === 'CASH' ? 'Payment pending at visit' : 'Payment pending review',
    message: params.authorizationRequired
      ? 'The booking is created, but final payment settlement still depends on authorization and payment review.'
      : 'The booking is created, but final payment settlement still depends on payment review.',
    steps,
  };
}

function mapPaymentItem(item: any) {
  const hold = getHoldState(item.metadata);
  return {
    id: item.id,
    appointmentId: item.appointmentId,
    amountMinor: item.amountMinor,
    currency: item.currency,
    status: item.status,
    gateway: item.gateway,
    commissionMinor: item.commissionMinor,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    patientName: item.appointment?.patient ? `${item.appointment.patient.user.firstName} ${item.appointment.patient.user.lastName}`.trim() : null,
    providerName: item.appointment?.provider ? `${item.appointment.provider.user.firstName} ${item.appointment.provider.user.lastName}`.trim() : null,
    service: item.appointment?.service ?? null,
    hold,
    metadata: item.metadata,
  };
}

async function getPaymentsForOrg(organizationId?: string) {
  return prisma.payment.findMany({
    where: organizationId
      ? {
          OR: [
            { appointment: { is: { organizationId } } },
            { patient: { is: { organizationId } } },
            { provider: { is: { organizationId } } },
          ],
        }
      : undefined,
    include: {
      appointment: {
        include: {
          patient: { include: { user: true } },
          provider: { include: { user: true } },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
}

paymentsRouter.get('/', async (req, res) => {
  const role = req.user!.role;
  const where: Record<string, any> = {};

  if (role === 'PATIENT') {
    where.patientId = (await getPatientProfileId(req.user!.userId)) ?? '__none__';
  } else if (['PROVIDER', 'NURSE'].includes(role)) {
    where.providerId = (await getProviderProfileId(req.user!.userId)) ?? '__none__';
  }

  const items = await prisma.payment.findMany({
    where,
    include: {
      appointment: {
        include: {
          patient: { include: { user: true } },
          provider: { include: { user: true } },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  res.json({
    items: items.map(mapPaymentItem),
  });
});

paymentsRouter.get('/admin/summary', allowRoles(paymentAdminReadRoles), async (req, res) => {
  const items = await getPaymentsForOrg(req.user?.organizationId);
  const summary = items.reduce(
    (acc, payment) => {
      acc.totalPayments += 1;
      acc.totalAmountMinor += payment.amountMinor;
      acc.byStatus[payment.status] = (acc.byStatus[payment.status] ?? 0) + 1;
      if (getHoldState(payment.metadata).active) {
        acc.heldPayments += 1;
      }
      if (payment.status === 'CAPTURED') {
        acc.capturedAmountMinor += payment.amountMinor;
      }
      if (payment.status === 'REFUNDED') {
        acc.refundedAmountMinor += payment.amountMinor;
      }
      return acc;
    },
    {
      totalPayments: 0,
      totalAmountMinor: 0,
      capturedAmountMinor: 0,
      refundedAmountMinor: 0,
      heldPayments: 0,
      byStatus: {} as Record<string, number>,
    },
  );

  res.json({ summary });
});

paymentsRouter.get('/reconciliation', allowRoles(paymentAdminReadRoles), async (req, res) => {
  const q = String(req.query.q ?? '').trim().toLowerCase();
  const status = String(req.query.status ?? '').trim().toUpperCase();
  const holdFilter = String(req.query.hold ?? '').trim().toLowerCase();
  const limit = Math.min(Math.max(Number(req.query.limit ?? 100), 1), 250);

  const items = (await getPaymentsForOrg(req.user?.organizationId))
    .map(mapPaymentItem)
    .filter((item) => {
      if (status && item.status !== status) {
        return false;
      }
      if (holdFilter === 'active' && !item.hold.active) {
        return false;
      }
      if (holdFilter === 'clear' && item.hold.active) {
        return false;
      }
      if (!q) {
        return true;
      }
      return [item.id, item.patientName ?? '', item.providerName ?? '', item.service ?? '', item.status]
        .join(' ')
        .toLowerCase()
        .includes(q);
    })
    .slice(0, limit);

  res.json({ items, count: items.length });
});

paymentsRouter.get('/refunds', allowRoles(paymentAdminReadRoles), async (req, res) => {
  const q = String(req.query.q ?? '').trim().toLowerCase();
  const statusFilter = String(req.query.status ?? '').trim().toUpperCase();
  const items = (await getPaymentsForOrg(req.user?.organizationId))
    .map(mapPaymentItem)
    .filter((item) => {
      const refundMeta = asObject(asObject(item.metadata).refund);
      const refundStatus = item.status === 'REFUNDED' ? 'REFUNDED' : refundMeta.requestedAt ? 'REQUESTED' : 'NONE';
      if (refundStatus === 'NONE') {
        return false;
      }
      if (statusFilter && refundStatus !== statusFilter) {
        return false;
      }
      if (!q) {
        return true;
      }
      return [item.id, item.patientName ?? '', item.providerName ?? '', refundStatus, refundMeta.reasonCode ?? '']
        .join(' ')
        .toLowerCase()
        .includes(q);
    })
    .map((item) => ({
      ...item,
      refund: asObject(asObject(item.metadata).refund),
    }));

  res.json({ items, count: items.length });
});

paymentsRouter.post(
  '/intent',
  allowRoles(['PATIENT', 'FINANCE', 'COMPANY_ADMIN', 'COMPANY_SUPPORT']),
  validateBody(paymentIntentCreateSchema),
  async (req, res) => {
    let patientId = req.body.patientId;
    let providerId = req.body.providerId;

    if (req.body.appointmentId) {
      const appointment = await prisma.appointment.findUnique({ where: { id: req.body.appointmentId } });
      patientId = patientId ?? appointment?.patientId;
      providerId = providerId ?? appointment?.providerId;
    }


    const paymentMetadata = asObject(req.body.metadata);
    const paymentMethod = String(paymentMetadata.paymentMethod ?? 'CARD').toUpperCase();
    const authorizationRequired = paymentMetadata.authorizationRequired === true;
    const authorizationConfirmed = paymentMetadata.authorizationConfirmed === true;
    let walletMethod = null as Awaited<ReturnType<typeof getWalletMethod>>;
    if (paymentMethod === 'WALLET') {
      if (!patientId) throw badRequest('Patient profile is required to use a wallet payment method.');
      walletMethod = await getWalletMethod({
        organizationId: req.user?.organizationId ?? '',
        patientId,
        methodId: typeof paymentMetadata.walletMethodId === 'string' ? paymentMetadata.walletMethodId : null,
      });
      if (!walletMethod) {
        throw badRequest('No saved wallet payment method is available. Add a wallet method before confirming this booking.');
      }
    }

    if (req.user?.role === 'PATIENT') {
      patientId = patientId ?? (await getPatientProfileId(req.user.userId));
    }

    const reviewReasonCodes: string[] = [];
    if (authorizationRequired && !authorizationConfirmed) {
      reviewReasonCodes.push('AUTHORIZATION_REQUIRED');
    }
    if (paymentMethod === 'CASH') {
      reviewReasonCodes.push('CASH_COLLECTION_REQUIRED');
    } else if (!stripe) {
      reviewReasonCodes.push(paymentMethod === 'WALLET' ? 'WALLET_CAPTURE_PENDING' : 'GATEWAY_CAPTURE_PENDING');
    }

    let externalId: string | null = null;
    let clientSecret: string | null = null;
    let status: 'AUTHORIZED' | 'PENDING' = reviewReasonCodes.length ? 'PENDING' : 'AUTHORIZED';

    if (stripe && paymentMethod !== 'CASH') {
      const intent = await stripe.paymentIntents.create({
        amount: req.body.amountMinor,
        currency: req.body.currency.toLowerCase(),
        metadata: Object.fromEntries(Object.entries({ ...paymentMetadata, ...(walletMethod ? { walletMethodId: walletMethod.id, walletMethodLabel: walletMethod.label, walletMethodLast4: walletMethod.last4 } : {}), reviewReasonCodes: reviewReasonCodes.join('|') }).map(([k, v]) => [k, String(v)])),
        automatic_payment_methods: { enabled: true },
      });
      externalId = intent.id;
      clientSecret = intent.client_secret;
    }

    const nextAction = buildPaymentNextAction({
      paymentMethod,
      reviewReasonCodes,
      authorizationRequired,
    });

    const payment = await prisma.payment.create({
      data: {
        appointmentId: req.body.appointmentId,
        patientId,
        providerId,
        amountMinor: req.body.amountMinor,
        currency: req.body.currency,
        status,
        gateway: stripe && paymentMethod !== 'CASH' ? 'stripe' : 'manual',
        externalId: externalId ?? undefined,
        metadata: {
        ...paymentMetadata,
        ...(walletMethod ? { walletMethodId: walletMethod.id, walletMethodLabel: walletMethod.label, walletMethodLast4: walletMethod.last4 } : {}),
        reviewReasonCodes,
        nextAction,
      },
      },
    });

    await writeAuditLog({
      actorId: req.user?.userId,
      organizationId: req.user?.organizationId,
      action: 'payment.intent_created',
      resource: 'payment',
      resourceId: payment.id,
      details: { gateway: payment.gateway, externalId },
    });

    res.status(201).json({ payment, clientSecret, nextAction });
  },
);

paymentsRouter.post('/:paymentId/hold', allowRoles(paymentAdminWriteRoles), async (req, res) => {
  const payment = await getScopedPayment(req.params.paymentId, req.user?.organizationId);
  const metadata = applyAdminHold(payment.metadata, {
    active: true,
    heldAt: new Date().toISOString(),
    heldBy: req.user?.userId ?? null,
    reasonCode: req.body?.reasonCode ?? null,
    note: req.body?.note ?? null,
    releasedAt: null,
    releasedBy: null,
  });

  const updated = await prisma.payment.update({
    where: { id: payment.id },
    data: { metadata },
  });

  await writeAuditLog({
    actorId: req.user?.userId,
    organizationId: req.user?.organizationId,
    action: 'payment.hold_applied',
    resource: 'payment',
    resourceId: updated.id,
    details: { reasonCode: req.body?.reasonCode ?? null, note: req.body?.note ?? null },
  });

  res.json(mapPaymentItem(updated));
});

paymentsRouter.post('/:paymentId/release-hold', allowRoles(paymentAdminWriteRoles), async (req, res) => {
  const payment = await getScopedPayment(req.params.paymentId, req.user?.organizationId);
  const metadata = applyAdminHold(payment.metadata, {
    active: false,
    releasedAt: new Date().toISOString(),
    releasedBy: req.user?.userId ?? null,
    releaseNote: req.body?.note ?? null,
  });

  const updated = await prisma.payment.update({
    where: { id: payment.id },
    data: { metadata },
  });

  await writeAuditLog({
    actorId: req.user?.userId,
    organizationId: req.user?.organizationId,
    action: 'payment.hold_released',
    resource: 'payment',
    resourceId: updated.id,
    details: { note: req.body?.note ?? null },
  });

  res.json(mapPaymentItem(updated));
});

paymentsRouter.post('/:paymentId/settle', allowRoles(paymentAdminWriteRoles), async (req, res) => {
  const existing = await getScopedPayment(req.params.paymentId, req.user?.organizationId);
  if (getHoldState(existing.metadata).active) {
    throw badRequest('Payment cannot be settled while an admin hold is active');
  }

  const updated = await prisma.payment.update({
    where: { id: req.params.paymentId },
    data: {
      status: 'CAPTURED',
      commissionMinor: Math.round(existing.amountMinor * 0.1),
      metadata: {
        ...asObject(existing.metadata),
        settlement: {
          settledAt: new Date().toISOString(),
          settledBy: req.user?.userId ?? null,
          note: req.body?.note ?? null,
        },
      },
    },
  });

  await writeAuditLog({
    actorId: req.user?.userId,
    organizationId: req.user?.organizationId,
    action: 'payment.settled',
    resource: 'payment',
    resourceId: updated.id,
    details: { note: req.body?.note ?? null },
  });

  res.json(updated);
});

paymentsRouter.post('/:paymentId/refund', allowRoles(paymentAdminWriteRoles), async (req, res) => {
  const payment = await getScopedPayment(req.params.paymentId, req.user?.organizationId);
  if (payment.status === 'REFUNDED') {
    throw badRequest('Payment has already been refunded');
  }

  const refundMeta = {
    requestedAt: new Date().toISOString(),
    requestedBy: req.user?.userId ?? null,
    reasonCode: req.body?.reasonCode ?? null,
    note: req.body?.note ?? null,
    amountMinor: typeof req.body?.amountMinor === 'number' ? req.body.amountMinor : payment.amountMinor,
  };

  if (stripe && payment.externalId) {
    await stripe.refunds.create({
      payment_intent: payment.externalId,
      amount: refundMeta.amountMinor,
      reason: req.body?.reasonCode === 'FRAUD' ? 'fraudulent' : undefined,
      metadata: {
        note: String(refundMeta.note ?? ''),
      },
    });
  }

  const updated = await prisma.payment.update({
    where: { id: payment.id },
    data: {
      status: 'REFUNDED',
      metadata: {
        ...asObject(payment.metadata),
        refund: refundMeta,
      },
    },
  });

  await writeAuditLog({
    actorId: req.user?.userId,
    organizationId: req.user?.organizationId,
    action: 'payment.refunded',
    resource: 'payment',
    resourceId: updated.id,
    details: refundMeta,
  });

  res.json(updated);
});
