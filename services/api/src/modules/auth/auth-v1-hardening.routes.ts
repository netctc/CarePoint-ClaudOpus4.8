import bcrypt from 'bcryptjs';
import { Router, type Response } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { badRequest, forbidden, unauthorized } from '../../lib/http';
import { writeAuditLog } from '../../lib/audit';
import { validateBody } from '../../middleware/validate';
import {
  getAuthChallengeStoreMode,
  issuePrivilegedSignInChallenge,
  resendPrivilegedSignInChallenge,
  verifyPrivilegedSignInChallenge,
} from '../../lib/auth-otp-store';
import { buildPrivilegedRiskAssessment, enforceApprovedPrivilegedDomain } from '../../lib/auth-risk';
import { getSsoConfiguration, type SsoRoleHint } from '../../lib/auth-sso';
import { sendOtpEmail } from '../../lib/mailer';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../../lib/jwt';

export const authV1HardeningRouter = Router();

const PRIVILEGED_SIGN_IN_ROLES = new Set([
  'SUPER_ADMIN',
  'COMPANY_ADMIN',
  'COMPANY_SUPPORT',
  'PROVIDER',
  'NURSE',
  'PHARMACIST',
  'LAB_TECH',
  'FINANCE',
]);

const privilegedChallengeStartSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(8),
  managedDevice: z.boolean().default(false),
  riskAcknowledged: z.boolean().default(false),
  // Compatibility: existing web clients may still send "totp". For v1 we
  // deliberately ignore the requested channel and use delivered email OTP.
  channel: z.enum(['email', 'sms', 'totp']).optional(),
});

const privilegedChallengeVerifySchema = z.object({
  challengeId: z.string().trim().min(8),
  code: z.string().trim().min(4).max(8),
});

const privilegedChallengeResendSchema = z.object({
  challengeId: z.string().trim().min(8),
});

type PrivilegedChallengeStartInput = z.infer<typeof privilegedChallengeStartSchema>;
type PrivilegedChallengeVerifyInput = z.infer<typeof privilegedChallengeVerifySchema>;
type PrivilegedChallengeResendInput = z.infer<typeof privilegedChallengeResendSchema>;

type SessionUser = {
  id: string;
  email: string;
  role: string;
  status: string;
  organizationId?: string | null;
};

function toSsoRoleHint(role: string): SsoRoleHint {
  return role === 'PROVIDER' || role === 'NURSE' || role === 'PHARMACIST' || role === 'LAB_TECH'
    ? 'provider'
    : 'admin';
}

function getRoleCookieScope(role?: string) {
  const normalized = String(role ?? '').trim().toUpperCase();
  if (['PROVIDER', 'NURSE', 'PHARMACIST', 'LAB_TECH'].includes(normalized)) return 'provider';
  if (['SUPER_ADMIN', 'COMPANY_ADMIN', 'COMPANY_SUPPORT', 'FINANCE'].includes(normalized)) return 'admin';
  if (normalized === 'PATIENT') return 'patient';
  return null;
}

function writeCookie(res: Response, name: string, value: string, httpOnly: boolean) {
  res.cookie(name, value, {
    httpOnly,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  });
}

function writeSessionCookies(res: Response, accessToken: string, refreshToken?: string, role?: string) {
  writeCookie(res, 'accessToken', accessToken, true);
  writeCookie(res, 'cc_access_token', accessToken, false);

  const scope = getRoleCookieScope(role);
  if (scope) {
    writeCookie(res, `cc_${scope}_access_token`, accessToken, false);
  }

  if (refreshToken) {
    writeCookie(res, 'refreshToken', refreshToken, true);
    if (scope) {
      writeCookie(res, `refreshToken_${scope}`, refreshToken, true);
    }
  }
  if (role) {
    writeCookie(res, 'cc_role', role, false);
    if (scope) {
      writeCookie(res, `cc_${scope}_role`, role, false);
    }
  }
}

async function revokeActiveRefreshTokens(userId: string) {
  await prisma.refreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

async function createSessionForActiveUser(user: SessionUser) {
  if (user.status !== 'ACTIVE') {
    await revokeActiveRefreshTokens(user.id);
    throw unauthorized('Account is not active');
  }

  const payload = {
    sub: user.id,
    role: user.role,
    organizationId: user.organizationId ?? undefined,
  };
  const accessToken = signAccessToken(payload);
  const refreshToken = signRefreshToken(payload);
  const refreshHash = await bcrypt.hash(refreshToken, 10);

  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      tokenHash: refreshHash,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  });

  return {
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      organizationId: user.organizationId ?? undefined,
    },
    accessToken,
    refreshToken,
  };
}

async function findUserByIdentifier(value: unknown) {
  const identifier = String(value ?? '').trim().toLowerCase();
  if (!identifier || !identifier.includes('@')) return null;
  return prisma.user.findUnique({ where: { email: identifier } });
}

// Public registration must never bootstrap a privileged account. Privileged
// users are provisioned through governed IAM/invite flows instead.
authV1HardeningRouter.post('/register', (req, _res, next) => {
  const role = String(req.body?.role ?? '').trim().toUpperCase();
  if (PRIVILEGED_SIGN_IN_ROLES.has(role)) {
    next(forbidden('Privileged accounts cannot be created through public registration. Use the governed IAM/invite flow.'));
    return;
  }
  next();
});

// Password-only login remains available for non-privileged legacy flows, but
// inactive accounts are denied and privileged roles must use delivered MFA.
authV1HardeningRouter.post('/login', async (req, _res, next) => {
  const email = String(req.body?.email ?? '').trim().toLowerCase();
  const password = String(req.body?.password ?? '');
  if (!email || !password) {
    next();
    return;
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    next();
    return;
  }

  const passwordValid = await bcrypt.compare(password, user.passwordHash);
  if (!passwordValid) {
    next();
    return;
  }

  if (user.status !== 'ACTIVE') {
    await revokeActiveRefreshTokens(user.id);
    await writeAuditLog({
      actorId: user.id,
      organizationId: user.organizationId ?? undefined,
      action: 'auth.inactive_login_blocked',
      resource: 'user',
      resourceId: user.id,
      details: { status: user.status },
    });
    next(unauthorized('Invalid email or password'));
    return;
  }

  if (!PRIVILEGED_SIGN_IN_ROLES.has(user.role)) {
    next();
    return;
  }

  await writeAuditLog({
    actorId: user.id,
    organizationId: user.organizationId ?? undefined,
    action: 'auth.privileged_password_login_blocked',
    resource: 'user',
    resourceId: user.id,
    details: { requiredFactor: 'email_otp' },
  });

  next(forbidden('Privileged accounts require the managed-device email verification flow.'));
});

authV1HardeningRouter.post(
  '/challenge/start',
  validateBody(privilegedChallengeStartSchema),
  async (req, res) => {
    const input = req.body as PrivilegedChallengeStartInput;
    const email = input.email.trim().toLowerCase();
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) throw unauthorized('Invalid email or password');
    const passwordValid = await bcrypt.compare(input.password, user.passwordHash);
    if (!passwordValid) throw unauthorized('Invalid email or password');
    if (user.status !== 'ACTIVE') {
      await revokeActiveRefreshTokens(user.id);
      throw forbidden('Account is not active');
    }
    if (!PRIVILEGED_SIGN_IN_ROLES.has(user.role)) {
      throw badRequest('This account does not require the privileged sign-in flow.');
    }
    if (!input.managedDevice) {
      throw badRequest('Managed-device confirmation is required for privileged sign-in.');
    }

    try {
      enforceApprovedPrivilegedDomain(email);
    } catch (error) {
      throw unauthorized(error instanceof Error ? error.message : 'The email domain is not approved for privileged sign-in.');
    }

    const risk = buildPrivilegedRiskAssessment({
      email,
      role: user.role,
      managedDevice: input.managedDevice,
      channel: 'email',
    });
    if (risk.requiresAcknowledgement && !input.riskAcknowledged) {
      throw badRequest('Acknowledge the privileged access notice before continuing.');
    }

    const issued = await issuePrivilegedSignInChallenge({
      identifier: email,
      userId: user.id,
      role: user.role,
      organizationId: user.organizationId ?? undefined,
      channel: 'email',
      metadata: {
        managedDevice: true,
        riskLevel: risk.level,
        riskReasons: risk.reasons,
        riskAcknowledged: Boolean(input.riskAcknowledged),
        requestedChannel: input.channel ?? null,
        enforcedChannel: 'email',
      },
    });

    if (issued.isNew) {
      await sendOtpEmail({
        to: issued.challenge.identifier,
        code: issued.challenge.code,
        expiresInSeconds: issued.expiresInSeconds,
        purpose: 'privileged sign-in',
      });
    }

    const challengeStoreMode = await getAuthChallengeStoreMode();
    await writeAuditLog({
      actorId: user.id,
      organizationId: user.organizationId ?? undefined,
      action: issued.isNew ? 'auth.privileged_challenge_started' : 'auth.privileged_challenge_resend_blocked',
      resource: 'user',
      resourceId: user.id,
      details: {
        channel: 'email',
        resendAfterSeconds: issued.resendAfterSeconds,
        expiresInSeconds: issued.expiresInSeconds,
        managedDevice: true,
        risk,
        challengeStoreMode,
      },
    });

    res.status(202).json({
      challengeId: issued.challenge.id,
      channel: 'email',
      expiresInSeconds: issued.expiresInSeconds,
      resendAfterSeconds: issued.resendAfterSeconds,
      challengeStoreMode,
      risk,
      sso: getSsoConfiguration(toSsoRoleHint(user.role)),
      user: {
        email: user.email,
        role: user.role,
        organizationId: user.organizationId ?? undefined,
      },
      devCode: process.env.NODE_ENV === 'production' ? undefined : issued.challenge.code,
    });
  },
);

authV1HardeningRouter.post(
  '/challenge/verify',
  validateBody(privilegedChallengeVerifySchema),
  async (req, res) => {
    const input = req.body as PrivilegedChallengeVerifyInput;
    const result = await verifyPrivilegedSignInChallenge(input.challengeId, input.code);

    if (!result.ok) {
      if (result.reason === 'locked') {
        throw badRequest(`Too many failed attempts. Retry in ${result.retryAfterSeconds ?? 0} seconds.`);
      }
      if (result.reason === 'expired') {
        throw badRequest('The verification code expired. Start the privileged sign-in flow again.');
      }
      if (result.reason === 'invalid') {
        throw unauthorized(`The verification code was not accepted. ${result.attemptsRemaining ?? 0} attempt(s) remaining.`);
      }
      throw unauthorized('No active privileged sign-in challenge was found. Start again.');
    }

    const user = await prisma.user.findUnique({ where: { id: result.challenge.userId } });
    if (!user || user.status !== 'ACTIVE' || !PRIVILEGED_SIGN_IN_ROLES.has(user.role)) {
      if (user) await revokeActiveRefreshTokens(user.id);
      throw unauthorized('The verification session is no longer available.');
    }

    await writeAuditLog({
      actorId: user.id,
      organizationId: user.organizationId ?? undefined,
      action: 'auth.privileged_challenge_verified',
      resource: 'user',
      resourceId: user.id,
      details: { channel: result.challenge.channel, metadata: result.challenge.metadata ?? null },
    });

    const session = await createSessionForActiveUser(user);
    writeSessionCookies(res, session.accessToken, session.refreshToken, session.user.role);
    res.json(session);
  },
);

authV1HardeningRouter.post(
  '/challenge/resend',
  validateBody(privilegedChallengeResendSchema),
  async (req, res) => {
    const input = req.body as PrivilegedChallengeResendInput;
    const issued = await resendPrivilegedSignInChallenge(input.challengeId);
    if (!issued) {
      throw badRequest('The privileged sign-in challenge is no longer available. Start again.');
    }

    if (issued.challenge.channel !== 'email') {
      throw badRequest('Legacy non-email privileged challenges are no longer valid. Start the sign-in flow again.');
    }

    const user = await prisma.user.findUnique({ where: { id: issued.challenge.userId } });
    if (!user || user.status !== 'ACTIVE' || !PRIVILEGED_SIGN_IN_ROLES.has(user.role)) {
      if (user) await revokeActiveRefreshTokens(user.id);
      throw unauthorized('The privileged sign-in challenge is no longer available. Start again.');
    }

    if (issued.isNew) {
      await sendOtpEmail({
        to: issued.challenge.identifier,
        code: issued.challenge.code,
        expiresInSeconds: issued.expiresInSeconds,
        purpose: 'privileged sign-in',
      });
    }

    const challengeStoreMode = await getAuthChallengeStoreMode();
    await writeAuditLog({
      actorId: issued.challenge.userId,
      organizationId: issued.challenge.organizationId,
      action: issued.isNew ? 'auth.privileged_challenge_resent' : 'auth.privileged_challenge_resend_blocked',
      resource: 'user',
      resourceId: issued.challenge.userId,
      details: {
        challengeId: issued.challenge.id,
        channel: 'email',
        resendAfterSeconds: issued.resendAfterSeconds,
        expiresInSeconds: issued.expiresInSeconds,
        challengeStoreMode,
      },
    });

    res.status(202).json({
      challengeId: issued.challenge.id,
      channel: 'email',
      expiresInSeconds: issued.expiresInSeconds,
      resendAfterSeconds: issued.resendAfterSeconds,
      challengeStoreMode,
      devCode: process.env.NODE_ENV === 'production' ? undefined : issued.challenge.code,
    });
  },
);

// Existing/inactive PATIENT accounts receive a neutral response for OTP issue
// endpoints so account status is not exposed and no challenge is created.
authV1HardeningRouter.post(['/otp/request', '/otp/resend', '/otp/register'], async (req, res, next) => {
  const identifier = req.path === '/otp/register' ? req.body?.email : req.body?.identifier;
  const user = await findUserByIdentifier(identifier);
  if (!user || user.role !== 'PATIENT' || user.status === 'ACTIVE') {
    next();
    return;
  }

  await revokeActiveRefreshTokens(user.id);
  const normalized = String(identifier ?? '').trim().toLowerCase();
  res.status(202).json({
    challengeId: normalized,
    channel: 'email',
    expiresInSeconds: 300,
    resendAfterSeconds: 60,
    ...(req.path === '/otp/register' ? { isNewUser: false } : {}),
  });
});

authV1HardeningRouter.post('/otp/verify', async (req, _res, next) => {
  const user = await findUserByIdentifier(req.body?.identifier);
  if (user?.role === 'PATIENT' && user.status !== 'ACTIVE') {
    await revokeActiveRefreshTokens(user.id);
    next(unauthorized('No active verification challenge was found. Request a new code.'));
    return;
  }
  next();
});

// Refresh is handled completely here so an old token can never restore an
// archived/suspended account or re-emit stale role/organization claims.
authV1HardeningRouter.post('/refresh', async (req, res) => {
  const rawRefreshToken = req.cookies?.refreshToken || req.body?.refreshToken;
  if (typeof rawRefreshToken !== 'string' || !rawRefreshToken) {
    throw unauthorized('Refresh token is invalid or revoked');
  }

  let payload: ReturnType<typeof verifyRefreshToken>;
  try {
    payload = verifyRefreshToken(rawRefreshToken);
  } catch {
    throw unauthorized('Refresh token is invalid or revoked');
  }

  const user = await prisma.user.findUnique({ where: { id: payload.sub } });
  if (!user || user.status !== 'ACTIVE') {
    if (user) await revokeActiveRefreshTokens(user.id);
    throw unauthorized('Refresh token is invalid or revoked');
  }

  const stored = await prisma.refreshToken.findMany({
    where: {
      userId: user.id,
      revokedAt: null,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: 'desc' },
  });

  let matched = false;
  for (const entry of stored) {
    if (await bcrypt.compare(rawRefreshToken, entry.tokenHash)) {
      matched = true;
      break;
    }
  }
  if (!matched) {
    throw unauthorized('Refresh token is invalid or revoked');
  }

  const accessToken = signAccessToken({
    sub: user.id,
    role: user.role,
    organizationId: user.organizationId ?? undefined,
  });
  writeSessionCookies(res, accessToken, undefined, user.role);
  res.json({
    accessToken,
    user: {
      id: user.id,
      role: user.role,
      organizationId: user.organizationId ?? undefined,
    },
  });
});
