export type AccountMutationAction = 'create' | 'update' | 'deactivate' | 'reactivate' | 'delete';

export interface AccountActor {
  id?: string | null;
  role?: string | null;
  organizationId?: string | null;
}

export interface AccountMutationTarget {
  id?: string | null;
  role?: string | null;
  organizationId?: string | null;
  status?: string | null;
}

export interface AccountMutationPatch {
  role?: string | null;
  organizationId?: string | null;
  status?: string | null;
}

export interface AccountMutationPolicyResult {
  allowed: boolean;
  statusCode?: number;
  code?: string;
  message?: string;
}

const SUPER_ADMIN = 'SUPER_ADMIN';
const COMPANY_ADMIN = 'COMPANY_ADMIN';
const SUPPORT = 'SUPPORT';

const WRITE_ROLES = new Set([SUPER_ADMIN, COMPANY_ADMIN]);
const LIMITED_WRITE_ROLES = new Set([SUPPORT]);

function deny(statusCode: number, code: string, message: string): AccountMutationPolicyResult {
  return { allowed: false, statusCode, code, message };
}

export function assertAccountMutationAllowed(params: {
  actor?: AccountActor | null;
  action: AccountMutationAction;
  target?: AccountMutationTarget | null;
  patch?: AccountMutationPatch | null;
  supportCanMutate?: boolean;
  allowHardDelete?: boolean;
}): AccountMutationPolicyResult {
  const actor = params.actor;
  const target = params.target;
  const patch = params.patch ?? {};
  const actorRole = actor?.role ?? '';
  const actorOrg = actor?.organizationId ?? null;
  const targetOrg = target?.organizationId ?? null;

  if (!actor?.id) {
    return deny(401, 'AUTH_REQUIRED', 'Authentication is required.');
  }

  if (!WRITE_ROLES.has(actorRole)) {
    if (!(params.supportCanMutate && LIMITED_WRITE_ROLES.has(actorRole))) {
      return deny(403, 'ROLE_NOT_ALLOWED', 'Your role is not allowed to mutate accounts.');
    }
  }

  if (params.action === 'delete' && !params.allowHardDelete) {
    return deny(409, 'HARD_DELETE_DISABLED', 'Hard delete is disabled. Use deactivate instead.');
  }

  if ((params.action === 'deactivate' || params.action === 'delete') && target?.id && target.id === actor.id) {
    return deny(409, 'SELF_MUTATION_BLOCKED', 'You cannot deactivate or delete your own active account.');
  }

  if (actorRole !== SUPER_ADMIN) {
    if (!actorOrg) {
      return deny(403, 'ACTOR_ORG_REQUIRED', 'Your account is missing organization context.');
    }

    if (targetOrg && targetOrg !== actorOrg) {
      return deny(403, 'CROSS_ORG_BLOCKED', 'You cannot mutate accounts outside your organization.');
    }

    if (patch.organizationId && patch.organizationId !== actorOrg) {
      return deny(403, 'ORG_CHANGE_BLOCKED', 'You cannot move accounts to another organization.');
    }

    if (patch.role === SUPER_ADMIN) {
      return deny(403, 'ROLE_ESCALATION_BLOCKED', 'You cannot grant super-admin access.');
    }

    if (target?.role === SUPER_ADMIN) {
      return deny(403, 'SUPER_ADMIN_TARGET_BLOCKED', 'You cannot mutate a super-admin account.');
    }
  }

  return { allowed: true };
}

export function forcedOrganizationIdForAccountMutation(actor?: AccountActor | null): string | undefined {
  if (!actor?.id) return undefined;
  return actor.role === SUPER_ADMIN ? undefined : actor.organizationId ?? undefined;
}

export function applyOrganizationBoundary<T extends { organizationId?: string | null }>(
  actor: AccountActor | null | undefined,
  payload: T,
): T {
  if (actor?.role === SUPER_ADMIN) return payload;
  return { ...payload, organizationId: actor?.organizationId ?? payload.organizationId };
}
