import bcrypt from 'bcryptjs';
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { badRequest, forbidden, unauthorized } from '../../lib/http';
import { writeAuditLog } from '../../lib/audit';
import { validateBody } from '../../middleware/validate';
import {
  getAuthChallengeStoreMode,
  issuePrivilegedSignInChallenge,
  resendPrivilegedSignInChallenge,
} from '../../lib/auth-otp-store';
import { buildPrivilegedRiskAssessment, enforceApprovedPrivilegedDomain } from '../../lib/auth-risk';
import { getSsoConfiguration, type SsoRoleHint } from '../../lib/auth-sso';
import { sendOtpEmail } from '../../lib/mailer';

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

const privilegedChallengeResendSchema = z.object({
  challengeId: z.string().trim().min(8),
});

type PrivilegedChallengeStartInput = z.infer<typeof privilegedChallengeStartSchema>;
type PrivilegedChallengeResendInput = z.infer<typeof privilegedChallengeResendSchema>;

function toSsoRoleHint(role: string): SsoRoleHint {
  return role === 'PROVIDER' || role === 'NURSE' || role === 'PHARMACIST' || role === 'LAB_TECH'
    ? 'provider'
    : 'admin';
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

// Password-only login remains available for non-privileged legacy flows, but a
// valid password for any privileged role must never mint a session directly.
authV1HardeningRouter.post('/login', async (req, _res, next) => {
  const email = String(req.body?.email ?? '').trim().toLowerCase();
  const password = String(req.body?.password ?? '');
  if (!email || !password) {
    next();
    return;
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !PRIVILEGED_SIGN_IN_ROLES.has(user.role)) {
    next();
    return;
  }

  const passwordValid = await bcrypt.compare(password, user.passwordHash);
  if (!passwordValid) {
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
