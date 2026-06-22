#!/usr/bin/env bash
set -euo pipefail

ROOT="${1:-$(pwd)}"

say() { printf '\n[%s] %s\n' "core-workflows" "$1"; }
fail() { printf '\n[core-workflows][error] %s\n' "$1" >&2; exit 1; }
ensure_dir() { mkdir -p "$1"; }

[ -d "$ROOT/services/api" ] || fail "Run 02-build-backend-and-contracts.sh first"

ensure_dir "$ROOT/apps/provider/services"
ensure_dir "$ROOT/apps/admin/src/lib"
ensure_dir "$ROOT/apps/mobile/lib/core/network"

say "Implementing appointment, record, messaging, telehealth, and payments modules"

cat > "$ROOT/services/api/src/modules/appointments/appointments.routes.ts" <<'TS'
import { Router } from 'express';
import { appointmentCreateSchema, appointmentPatchSchema } from '@care-center/contracts';
import { allowRoles } from '../../middleware/rbac';
import { requireAuth } from '../../middleware/auth';
import { validateBody } from '../../middleware/validate';
import { prisma } from '../../lib/prisma';
import { notFound } from '../../lib/http';
import { writeAuditLog } from '../../lib/audit';

export const appointmentsRouter = Router();

appointmentsRouter.use(requireAuth);

appointmentsRouter.get('/', async (req, res) => {
  const organizationId = req.user?.organizationId;
  const items = await prisma.appointment.findMany({
    where: organizationId ? { organizationId } : undefined,
    include: {
      patient: { include: { user: true } },
      provider: { include: { user: true } },
      telehealthSession: true,
      payments: true,
    },
    orderBy: { startsAt: 'asc' },
  });

  res.json({ items });
});

appointmentsRouter.post(
  '/',
  allowRoles(['PATIENT', 'COMPANY_ADMIN', 'COMPANY_SUPPORT', 'PROVIDER', 'NURSE']),
  validateBody(appointmentCreateSchema),
  async (req, res) => {
    const created = await prisma.appointment.create({
      data: {
        ...req.body,
        startsAt: new Date(req.body.startsAt),
        endsAt: new Date(req.body.endsAt),
      },
    });

    await writeAuditLog({
      actorId: req.user?.userId,
      organizationId: req.body.organizationId,
      action: 'appointment.created',
      resource: 'appointment',
      resourceId: created.id,
      details: req.body,
    });

    res.status(201).json(created);
  },
);

appointmentsRouter.patch(
  '/:appointmentId',
  allowRoles(['COMPANY_ADMIN', 'COMPANY_SUPPORT', 'PROVIDER', 'NURSE']),
  validateBody(appointmentPatchSchema),
  async (req, res) => {
    const existing = await prisma.appointment.findUnique({
      where: { id: req.params.appointmentId },
    });

    if (!existing) {
      throw notFound('Appointment not found');
    }

    const updated = await prisma.appointment.update({
      where: { id: existing.id },
      data: {
        status: req.body.status,
        startsAt: req.body.startsAt ? new Date(req.body.startsAt) : undefined,
        endsAt: req.body.endsAt ? new Date(req.body.endsAt) : undefined,
        notes: req.body.notes,
      },
    });

    await writeAuditLog({
      actorId: req.user?.userId,
      organizationId: req.user?.organizationId,
      action: 'appointment.updated',
      resource: 'appointment',
      resourceId: updated.id,
      details: req.body,
    });

    res.json(updated);
  },
);

appointmentsRouter.post(
  '/:appointmentId/confirm',
  allowRoles(['COMPANY_ADMIN', 'COMPANY_SUPPORT', 'PROVIDER', 'NURSE']),
  async (req, res) => {
    const updated = await prisma.appointment.update({
      where: { id: req.params.appointmentId },
      data: { status: 'CONFIRMED' },
    });

    await writeAuditLog({
      actorId: req.user?.userId,
      organizationId: req.user?.organizationId,
      action: 'appointment.confirmed',
      resource: 'appointment',
      resourceId: updated.id,
    });

    res.json(updated);
  },
);

appointmentsRouter.post(
  '/:appointmentId/cancel',
  allowRoles(['PATIENT', 'COMPANY_ADMIN', 'COMPANY_SUPPORT', 'PROVIDER', 'NURSE']),
  async (req, res) => {
    const updated = await prisma.appointment.update({
      where: { id: req.params.appointmentId },
      data: { status: 'CANCELLED' },
    });

    await writeAuditLog({
      actorId: req.user?.userId,
      organizationId: req.user?.organizationId,
      action: 'appointment.cancelled',
      resource: 'appointment',
      resourceId: updated.id,
    });

    res.json(updated);
  },
);
TS

cat > "$ROOT/services/api/src/modules/records/records.routes.ts" <<'TS'
import { Router } from 'express';
import { medicalRecordCreateSchema } from '@care-center/contracts';
import { allowRoles } from '../../middleware/rbac';
import { requireAuth } from '../../middleware/auth';
import { validateBody } from '../../middleware/validate';
import { prisma } from '../../lib/prisma';
import { writeAuditLog } from '../../lib/audit';

export const recordsRouter = Router();

recordsRouter.use(requireAuth);

recordsRouter.get('/', async (req, res) => {
  const patientId = String(req.query.patientId ?? '');
  const items = await prisma.medicalRecord.findMany({
    where: patientId ? { patientId } : undefined,
    orderBy: { createdAt: 'desc' },
  });

  res.json({ items });
});

recordsRouter.post(
  '/',
  allowRoles(['PROVIDER', 'NURSE', 'COMPANY_ADMIN']),
  validateBody(medicalRecordCreateSchema),
  async (req, res) => {
    const created = await prisma.medicalRecord.create({
      data: req.body,
    });

    await writeAuditLog({
      actorId: req.user?.userId,
      organizationId: req.user?.organizationId,
      action: 'medical_record.created',
      resource: 'medical_record',
      resourceId: created.id,
      details: req.body,
    });

    res.status(201).json(created);
  },
);
TS

cat > "$ROOT/services/api/src/modules/messaging/messaging.routes.ts" <<'TS'
import { Router } from 'express';
import { messageCreateSchema, threadCreateSchema } from '@care-center/contracts';
import { requireAuth } from '../../middleware/auth';
import { validateBody } from '../../middleware/validate';
import { prisma } from '../../lib/prisma';
import { writeAuditLog } from '../../lib/audit';

export const messagingRouter = Router();

messagingRouter.use(requireAuth);

messagingRouter.get('/threads', async (req, res) => {
  const items = await prisma.messageThread.findMany({
    where: req.user?.organizationId ? { organizationId: req.user.organizationId } : undefined,
    include: {
      messages: {
        orderBy: { createdAt: 'asc' },
      },
    },
    orderBy: { updatedAt: 'desc' },
  });

  res.json({ items });
});

messagingRouter.post('/threads', validateBody(threadCreateSchema), async (req, res) => {
  const created = await prisma.messageThread.create({
    data: req.body,
  });

  await writeAuditLog({
    actorId: req.user?.userId,
    organizationId: req.user?.organizationId,
    action: 'thread.created',
    resource: 'message_thread',
    resourceId: created.id,
    details: req.body,
  });

  res.status(201).json(created);
});

messagingRouter.post('/messages', validateBody(messageCreateSchema), async (req, res) => {
  const created = await prisma.message.create({
    data: {
      threadId: req.body.threadId,
      senderId: req.user!.userId,
      body: req.body.body,
      attachments: req.body.attachments,
    },
    include: {
      sender: {
        select: {
          firstName: true,
          lastName: true,
          role: true,
        },
      },
    },
  });

  req.io?.to(`thread:${created.threadId}`).emit('message:created', created);

  await prisma.messageThread.update({
    where: { id: created.threadId },
    data: { updatedAt: new Date() },
  });

  await writeAuditLog({
    actorId: req.user?.userId,
    organizationId: req.user?.organizationId,
    action: 'message.sent',
    resource: 'message',
    resourceId: created.id,
    details: { threadId: created.threadId },
  });

  res.status(201).json(created);
});
TS

cat > "$ROOT/services/api/src/modules/telehealth/telehealth.routes.ts" <<'TS'
import { Router } from 'express';
import { telehealthSessionCreateSchema } from '@care-center/contracts';
import { requireAuth } from '../../middleware/auth';
import { allowRoles } from '../../middleware/rbac';
import { validateBody } from '../../middleware/validate';
import { prisma } from '../../lib/prisma';
import { env } from '../../lib/env';
import { writeAuditLog } from '../../lib/audit';

function buildJoinUrl(meetingId: string) {
  if (env.telehealthVendor === 'daily') {
    return `https://your-daily-domain.daily.co/${meetingId}`;
  }
  return `https://telehealth.local/session/${meetingId}`;
}

export const telehealthRouter = Router();

telehealthRouter.use(requireAuth);

telehealthRouter.get('/sessions', async (_req, res) => {
  const items = await prisma.telehealthSession.findMany({
    include: { appointment: true },
    orderBy: { createdAt: 'desc' },
  });

  res.json({ items });
});

telehealthRouter.post(
  '/sessions',
  allowRoles(['PROVIDER', 'NURSE', 'COMPANY_ADMIN', 'COMPANY_SUPPORT']),
  validateBody(telehealthSessionCreateSchema),
  async (req, res) => {
    const meetingId = `appt-${req.body.appointmentId}`;
    const created = await prisma.telehealthSession.upsert({
      where: { appointmentId: req.body.appointmentId },
      update: {
        status: 'READY',
        joinUrl: buildJoinUrl(meetingId),
        scheduledAt: req.body.scheduledAt ? new Date(req.body.scheduledAt) : undefined,
      },
      create: {
        appointmentId: req.body.appointmentId,
        vendor: env.telehealthVendor,
        meetingId,
        joinUrl: buildJoinUrl(meetingId),
        status: 'READY',
        scheduledAt: req.body.scheduledAt ? new Date(req.body.scheduledAt) : undefined,
      },
    });

    await writeAuditLog({
      actorId: req.user?.userId,
      organizationId: req.user?.organizationId,
      action: 'telehealth.session_prepared',
      resource: 'telehealth_session',
      resourceId: created.id,
      details: { appointmentId: req.body.appointmentId },
    });

    res.status(201).json(created);
  },
);

telehealthRouter.post('/sessions/:sessionId/start', allowRoles(['PROVIDER', 'NURSE']), async (req, res) => {
  const updated = await prisma.telehealthSession.update({
    where: { id: req.params.sessionId },
    data: {
      status: 'LIVE',
      startedAt: new Date(),
    },
  });

  res.json(updated);
});

telehealthRouter.post('/sessions/:sessionId/end', allowRoles(['PROVIDER', 'NURSE']), async (req, res) => {
  const updated = await prisma.telehealthSession.update({
    where: { id: req.params.sessionId },
    data: {
      status: 'ENDED',
      endedAt: new Date(),
    },
  });

  res.json(updated);
});
TS

cat > "$ROOT/services/api/src/modules/payments/payments.routes.ts" <<'TS'
import { Router } from 'express';
import Stripe from 'stripe';
import { paymentIntentCreateSchema } from '@care-center/contracts';
import { requireAuth } from '../../middleware/auth';
import { allowRoles } from '../../middleware/rbac';
import { validateBody } from '../../middleware/validate';
import { prisma } from '../../lib/prisma';
import { env } from '../../lib/env';
import { writeAuditLog } from '../../lib/audit';

const stripe = env.stripeSecretKey ? new Stripe(env.stripeSecretKey) : null;

export const paymentsRouter = Router();

paymentsRouter.use(requireAuth);

paymentsRouter.get('/', allowRoles(['FINANCE', 'COMPANY_ADMIN', 'SUPER_ADMIN']), async (_req, res) => {
  const items = await prisma.payment.findMany({
    orderBy: { createdAt: 'desc' },
  });

  res.json({ items });
});

paymentsRouter.post(
  '/intent',
  allowRoles(['PATIENT', 'FINANCE', 'COMPANY_ADMIN', 'COMPANY_SUPPORT']),
  validateBody(paymentIntentCreateSchema),
  async (req, res) => {
    let externalId: string | null = null;
    let clientSecret: string | null = null;
    let status: 'AUTHORIZED' | 'PENDING' = 'PENDING';

    if (stripe) {
      const intent = await stripe.paymentIntents.create({
        amount: req.body.amountMinor,
        currency: req.body.currency.toLowerCase(),
        metadata: Object.fromEntries(
          Object.entries(req.body.metadata ?? {}).map(([k, v]) => [k, String(v)]),
        ),
        automatic_payment_methods: { enabled: true },
      });

      externalId = intent.id;
      clientSecret = intent.client_secret;
      status = 'AUTHORIZED';
    }

    const payment = await prisma.payment.create({
      data: {
        appointmentId: req.body.appointmentId,
        patientId: req.body.patientId,
        providerId: req.body.providerId,
        amountMinor: req.body.amountMinor,
        currency: req.body.currency,
        status,
        gateway: stripe ? 'stripe' : 'manual',
        externalId: externalId ?? undefined,
        metadata: req.body.metadata,
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

    res.status(201).json({
      payment,
      clientSecret,
    });
  },
);

paymentsRouter.post(
  '/:paymentId/settle',
  allowRoles(['FINANCE', 'COMPANY_ADMIN']),
  async (req, res) => {
    const updated = await prisma.payment.update({
      where: { id: req.params.paymentId },
      data: {
        status: 'CAPTURED',
        commissionMinor: Math.round((await prisma.payment.findUniqueOrThrow({
          where: { id: req.params.paymentId },
        })).amountMinor * 0.1),
      },
    });

    res.json(updated);
  },
);

paymentsRouter.post(
  '/:paymentId/refund',
  allowRoles(['FINANCE', 'COMPANY_ADMIN']),
  async (req, res) => {
    const payment = await prisma.payment.findUniqueOrThrow({
      where: { id: req.params.paymentId },
    });

    if (stripe && payment.externalId) {
      await stripe.refunds.create({ payment_intent: payment.externalId });
    }

    const updated = await prisma.payment.update({
      where: { id: payment.id },
      data: { status: 'REFUNDED' },
    });

    res.json(updated);
  },
);
TS

say "Adding simple shared web API clients"
cat > "$ROOT/apps/provider/services/api-client.ts" <<'TS'
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    throw new Error(`API request failed: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export const providerApi = {
  me: () => request('/api/auth/me'),
  appointments: () => request('/api/appointments'),
  records: (patientId?: string) =>
    request(`/api/records${patientId ? `?patientId=${encodeURIComponent(patientId)}` : ''}`),
  threads: () => request('/api/messaging/threads'),
  telehealthSessions: () => request('/api/telehealth/sessions'),
};
TS

cat > "$ROOT/apps/admin/src/lib/api-client.ts" <<'TS'
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    throw new Error(`API request failed: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export const adminApi = {
  me: () => request('/api/auth/me'),
  payments: () => request('/api/payments'),
  appointments: () => request('/api/appointments'),
  threads: () => request('/api/messaging/threads'),
};
TS

say "Adding mobile API client starter"
cat > "$ROOT/apps/mobile/lib/core/network/api_client.dart" <<'DART'
import 'dart:convert';
import 'package:http/http.dart' as http;

class ApiClient {
  ApiClient({required this.baseUrl, this.accessToken});

  final String baseUrl;
  String? accessToken;

  Map<String, String> _headers() {
    return {
      'Content-Type': 'application/json',
      if (accessToken != null) 'Authorization': 'Bearer $accessToken',
    };
  }

  Future<Map<String, dynamic>> getJson(String path) async {
    final response = await http.get(
      Uri.parse('$baseUrl$path'),
      headers: _headers(),
    );

    if (response.statusCode >= 400) {
      throw Exception('GET $path failed: ${response.statusCode}');
    }

    return jsonDecode(response.body) as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> postJson(String path, Map<String, dynamic> body) async {
    final response = await http.post(
      Uri.parse('$baseUrl$path'),
      headers: _headers(),
      body: jsonEncode(body),
    );

    if (response.statusCode >= 400) {
      throw Exception('POST $path failed: ${response.statusCode}');
    }

    if (response.body.isEmpty) {
      return <String, dynamic>{};
    }

    return jsonDecode(response.body) as Map<String, dynamic>;
  }
}
DART

python3 - <<'PY' "$ROOT/apps/mobile/pubspec.yaml"
from pathlib import Path
import sys
path = Path(sys.argv[1])
text = path.read_text()
if "\n  http: ^1.2.2" not in text:
    text = text.replace("  intl: ^0.19.0\n", "  intl: ^0.19.0\n  http: ^1.2.2\n")
path.write_text(text)
PY

say "Core workflow modules are now scaffolded with functional backend endpoints"
