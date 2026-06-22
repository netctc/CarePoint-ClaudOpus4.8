import { Router } from 'express';
import { requireAuth } from '../../middleware/auth';
import { allowRoles } from '../../middleware/rbac';
import { prisma } from '../../lib/prisma';
import {
  applyOrganizationBoundary,
  assertAccountMutationAllowed,
  forcedOrganizationIdForAccountMutation,
} from '../../lib/account-mutation-policy';
import { accountAuditRequestMetadata, writeAccountMutationAudit } from '../../lib/account-mutation-audit';
import {
  accountStatusReasonPhase30Schema,
  createAccountPhase30Schema,
  parsePhase30Body,
  updateAccountPhase30Schema,
} from './accounts.validation.phase30';

export const adminAccountsPhase30ExampleRouter = Router();

adminAccountsPhase30ExampleRouter.use(requireAuth);
adminAccountsPhase30ExampleRouter.use(allowRoles(['SUPER_ADMIN', 'COMPANY_ADMIN', 'SUPPORT']));

function actorFromReq(req: any) {
  return {
    id: req.user?.id ?? req.auth?.userId,
    role: req.user?.role ?? req.auth?.role,
    organizationId: req.user?.organizationId ?? req.auth?.organizationId,
  };
}

function accountSelect() {
  return {
    id: true,
    email: true,
    firstName: true,
    lastName: true,
    role: true,
    status: true,
    organizationId: true,
    createdAt: true,
    updatedAt: true,
  };
}

function serializeAccount(user: any) {
  return {
    id: user.id,
    email: user.email,
    name: `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() || user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role,
    status: user.status,
    organizationId: user.organizationId,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

function policyDenied(res: any, result: any) {
  return res.status(result.statusCode ?? 403).json({ error: result.message, code: result.code, details: null });
}

async function readTargetAccount(accountId: string) {
  return prisma.user.findUnique({ where: { id: accountId }, select: accountSelect() });
}

adminAccountsPhase30ExampleRouter.post('/accounts', async (req, res) => {
  const parsed = parsePhase30Body(createAccountPhase30Schema, req.body);
  if (!parsed.ok) return res.status(400).json({ error: 'Invalid account payload', details: parsed.error });

  const actor = actorFromReq(req);
  const payload = applyOrganizationBoundary(actor, parsed.data);
  const policy = assertAccountMutationAllowed({ actor, action: 'create', patch: payload, supportCanMutate: false });
  if (!policy.allowed) return policyDenied(res, policy);

  const existing = await prisma.user.findUnique({ where: { email: payload.email }, select: { id: true } });
  if (existing) return res.status(409).json({ error: 'Email already exists', code: 'EMAIL_EXISTS', details: null });

  const created = await prisma.user.create({
    data: {
      email: payload.email,
      firstName: payload.firstName ?? null,
      lastName: payload.lastName ?? null,
      role: payload.role,
      status: payload.status,
      organizationId: payload.organizationId ?? forcedOrganizationIdForAccountMutation(actor) ?? null,
      phone: payload.phone ?? null,
      locale: payload.locale ?? null,
    },
    select: accountSelect(),
  });

  const audit = await writeAccountMutationAudit({
    prisma,
    actorId: actor.id,
    organizationId: created.organizationId,
    targetAccountId: created.id,
    action: 'CREATE',
    after: serializeAccount(created),
    ...accountAuditRequestMetadata(req),
  });

  return res.status(201).json({ item: serializeAccount(created), audit });
});

adminAccountsPhase30ExampleRouter.patch('/accounts/:accountId', async (req, res) => {
  const parsed = parsePhase30Body(updateAccountPhase30Schema, req.body);
  if (!parsed.ok) return res.status(400).json({ error: 'Invalid account update payload', details: parsed.error });

  const actor = actorFromReq(req);
  const before = await readTargetAccount(req.params.accountId);
  if (!before) return res.status(404).json({ error: 'Account not found', code: 'ACCOUNT_NOT_FOUND', details: null });

  const payload = applyOrganizationBoundary(actor, parsed.data);
  const policy = assertAccountMutationAllowed({ actor, action: 'update', target: before, patch: payload, supportCanMutate: false });
  if (!policy.allowed) return policyDenied(res, policy);

  const updated = await prisma.user.update({
    where: { id: before.id },
    data: {
      ...payload,
      firstName: payload.firstName ?? undefined,
      lastName: payload.lastName ?? undefined,
      phone: payload.phone === undefined ? undefined : payload.phone,
      locale: payload.locale === undefined ? undefined : payload.locale,
    },
    select: accountSelect(),
  });

  const audit = await writeAccountMutationAudit({
    prisma,
    actorId: actor.id,
    organizationId: updated.organizationId,
    targetAccountId: updated.id,
    action: 'UPDATE',
    before: serializeAccount(before),
    after: serializeAccount(updated),
    ...accountAuditRequestMetadata(req),
  });

  return res.json({ item: serializeAccount(updated), audit });
});

adminAccountsPhase30ExampleRouter.post('/accounts/:accountId/deactivate', async (req, res) => {
  const parsed = parsePhase30Body(accountStatusReasonPhase30Schema, req.body ?? {});
  if (!parsed.ok) return res.status(400).json({ error: 'Invalid deactivate payload', details: parsed.error });

  const actor = actorFromReq(req);
  const before = await readTargetAccount(req.params.accountId);
  if (!before) return res.status(404).json({ error: 'Account not found', code: 'ACCOUNT_NOT_FOUND', details: null });

  const policy = assertAccountMutationAllowed({ actor, action: 'deactivate', target: before, patch: { status: 'DISABLED' } });
  if (!policy.allowed) return policyDenied(res, policy);

  const updated = await prisma.user.update({ where: { id: before.id }, data: { status: 'DISABLED' }, select: accountSelect() });
  const audit = await writeAccountMutationAudit({
    prisma,
    actorId: actor.id,
    organizationId: updated.organizationId,
    targetAccountId: updated.id,
    action: 'DEACTIVATE',
    before: serializeAccount(before),
    after: serializeAccount(updated),
    metadata: { reason: parsed.data.reason ?? null },
    ...accountAuditRequestMetadata(req),
  });

  return res.json({ item: serializeAccount(updated), audit });
});

adminAccountsPhase30ExampleRouter.post('/accounts/:accountId/reactivate', async (req, res) => {
  const parsed = parsePhase30Body(accountStatusReasonPhase30Schema, req.body ?? {});
  if (!parsed.ok) return res.status(400).json({ error: 'Invalid reactivate payload', details: parsed.error });

  const actor = actorFromReq(req);
  const before = await readTargetAccount(req.params.accountId);
  if (!before) return res.status(404).json({ error: 'Account not found', code: 'ACCOUNT_NOT_FOUND', details: null });

  const policy = assertAccountMutationAllowed({ actor, action: 'reactivate', target: before, patch: { status: 'ACTIVE' } });
  if (!policy.allowed) return policyDenied(res, policy);

  const updated = await prisma.user.update({ where: { id: before.id }, data: { status: 'ACTIVE' }, select: accountSelect() });
  const audit = await writeAccountMutationAudit({
    prisma,
    actorId: actor.id,
    organizationId: updated.organizationId,
    targetAccountId: updated.id,
    action: 'REACTIVATE',
    before: serializeAccount(before),
    after: serializeAccount(updated),
    metadata: { reason: parsed.data.reason ?? null },
    ...accountAuditRequestMetadata(req),
  });

  return res.json({ item: serializeAccount(updated), audit });
});

adminAccountsPhase30ExampleRouter.delete('/accounts/:accountId', async (req, res) => {
  const actor = actorFromReq(req);
  const before = await readTargetAccount(req.params.accountId);
  if (!before) return res.status(404).json({ error: 'Account not found', code: 'ACCOUNT_NOT_FOUND', details: null });

  const policy = assertAccountMutationAllowed({ actor, action: 'delete', target: before, allowHardDelete: false });
  if (!policy.allowed) return policyDenied(res, policy);

  // The policy above blocks hard delete by default. If your approved retention policy permits it,
  // enable allowHardDelete and replace this with prisma.user.delete.
  return res.status(409).json({
    error: 'Hard delete is disabled. Use deactivate instead.',
    code: 'HARD_DELETE_DISABLED',
    details: null,
  });
});
