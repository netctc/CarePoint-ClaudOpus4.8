import bcrypt from 'bcryptjs';
import { SignUpInput, LoginInput } from '@care-center/contracts';
import { prisma } from '../../lib/prisma';
import { badRequest, unauthorized } from '../../lib/http';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../../lib/jwt';
import { writeAuditLog } from '../../lib/audit';
import { OtpChannel, getAuthChallengeStoreMode, issueOtpChallenge, issuePrivilegedSignInChallenge, resendPrivilegedSignInChallenge, verifyOtpChallenge, verifyPrivilegedSignInChallenge } from '../../lib/auth-otp-store';
import { buildPrivilegedRiskAssessment, enforceApprovedPrivilegedDomain } from '../../lib/auth-risk';
import { buildSsoAuthorizeUrl, getSsoConfiguration, type SsoRoleHint } from '../../lib/auth-sso';
import { sendOtpEmail } from '../../lib/mailer';

const PRIVILEGED_SIGN_IN_ROLES = new Set(['SUPER_ADMIN', 'COMPANY_ADMIN', 'COMPANY_SUPPORT', 'PROVIDER', 'NURSE', 'PHARMACIST', 'LAB_TECH', 'FINANCE']);

async function createUserProfile(
  userId: string,
  role: string,
  organizationId: string,
) {
  if (role === 'PATIENT') {
    await prisma.patientProfile.create({
      data: {
        userId,
        organizationId,
        preferences: {},
      },
    });
  }

  if (role === 'PROVIDER' || role === 'NURSE' || role === 'PHARMACIST' || role === 'LAB_TECH') {
    await prisma.providerProfile.create({
      data: {
        userId,
        organizationId,
        specialty: null,
        licenseNumber: null,
        services: [],
      },
    });
  }
}

async function createSessionForUser(user: { id: string; email: string; role: string; organizationId?: string | null }) {
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

async function completeLoginForUser(user: { id: string; email: string; role: string; organizationId?: string | null }) {
  const session = await createSessionForUser(user);

  await writeAuditLog({
    actorId: user.id,
    organizationId: user.organizationId ?? undefined,
    action: 'auth.logged_in',
    resource: 'user',
    resourceId: user.id,
  });

  return session;
}

function toSsoRoleHint(role: string): SsoRoleHint {
  return role === 'PROVIDER' || role === 'NURSE' || role === 'PHARMACIST' || role === 'LAB_TECH' ? 'provider' : 'admin';
}

export function getPrivilegedSsoConfig(roleHint?: SsoRoleHint | null) {
  return getSsoConfiguration(roleHint ?? null);
}

export async function startSsoHandoff(input: { email?: string; roleHint?: SsoRoleHint | null; returnTo?: string | null }) {
  const configuration = getSsoConfiguration(input.roleHint ?? null);
  if (!configuration.available) {
    throw badRequest('Enterprise SSO is not configured for this environment.');
  }

  if (input.email?.trim()) {
    try {
      enforceApprovedPrivilegedDomain(input.email.trim().toLowerCase());
    } catch (error) {
      throw badRequest(error instanceof Error ? error.message : 'The supplied email is not approved for privileged sign-in.');
    }
  }

  const authorizeUrl = buildSsoAuthorizeUrl(input);
  await writeAuditLog({
    actorId: null,
    organizationId: null,
    action: 'auth.sso_handoff_started',
    resource: 'sso',
    resourceId: configuration.providerName,
    details: {
      email: input.email?.trim().toLowerCase() || null,
      roleHint: input.roleHint ?? null,
      returnTo: input.returnTo ?? null,
      providerName: configuration.providerName,
    },
  });

  return {
    providerName: configuration.providerName,
    authorizeUrl,
    callbackUrl: configuration.callbackUrl,
    roleHint: input.roleHint ?? null,
  };
}

export async function registerUser(input: SignUpInput) {
  const existing = await prisma.user.findUnique({
    where: { email: input.email },
  });

  if (existing) {
    throw badRequest('A user with that email already exists');
  }

  const organization =
    input.organizationName
      ? await prisma.organization.create({ data: { name: input.organizationName } })
      : await prisma.organization.findFirst();

  if (!organization) {
    throw badRequest('No organization available. Provide organizationName for first admin bootstrap.');
  }

  const passwordHash = await bcrypt.hash(input.password, 10);

  const user = await prisma.user.create({
    data: {
      email: input.email,
      passwordHash,
      firstName: input.firstName,
      lastName: input.lastName,
      role: input.role,
      organizationId: organization.id,
    },
  });

  await createUserProfile(user.id, user.role, organization.id);
  const session = await createSessionForUser(user);

  await writeAuditLog({
    actorId: user.id,
    organizationId: organization.id,
    action: 'auth.registered',
    resource: 'user',
    resourceId: user.id,
    details: { role: user.role },
  });
  return session;
}

export async function loginUser(input: LoginInput) {
  const user = await prisma.user.findUnique({
    where: { email: input.email },
  });

  if (!user) {
    throw unauthorized('Invalid email or password');
  }

  const isValid = await bcrypt.compare(input.password, user.passwordHash);
  if (!isValid) {
    throw unauthorized('Invalid email or password');
  }

  return completeLoginForUser(user);
}

export async function startPrivilegedSignInChallenge(input: {
  email: string;
  password: string;
  managedDevice?: boolean;
  riskAcknowledged?: boolean;
  channel?: OtpChannel;
}) {
  const email = input.email.trim().toLowerCase();
  const user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    throw unauthorized('Invalid email or password');
  }

  const isValid = await bcrypt.compare(input.password, user.passwordHash);
  if (!isValid) {
    throw unauthorized('Invalid email or password');
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
    channel: input.channel ?? 'totp',
  });

  if (risk.requiresAcknowledgement && !input.riskAcknowledged) {
    throw badRequest('Acknowledge the privileged access notice before continuing.');
  }

  const issued = await issuePrivilegedSignInChallenge({
    identifier: email,
    userId: user.id,
    role: user.role,
    organizationId: user.organizationId ?? undefined,
    channel: input.channel ?? 'totp',
    metadata: {
      managedDevice: true,
      riskLevel: risk.level,
      riskReasons: risk.reasons,
      riskAcknowledged: Boolean(input.riskAcknowledged),
    },
  });

  const challengeStoreMode = await getAuthChallengeStoreMode();

  await writeAuditLog({
    actorId: user.id,
    organizationId: user.organizationId ?? undefined,
    action: issued.isNew ? 'auth.privileged_challenge_started' : 'auth.privileged_challenge_resend_blocked',
    resource: 'user',
    resourceId: user.id,
    details: {
      channel: issued.challenge.channel,
      resendAfterSeconds: issued.resendAfterSeconds,
      expiresInSeconds: issued.expiresInSeconds,
      managedDevice: true,
      risk,
      challengeStoreMode,
    },
  });

  if (issued.isNew && issued.challenge.channel === 'email') {
    await sendOtpEmail({
      to: issued.challenge.identifier,
      code: issued.challenge.code,
      expiresInSeconds: issued.expiresInSeconds,
      purpose: 'privileged sign-in',
    });
  }

  return {
    challengeId: issued.challenge.id,
    channel: issued.challenge.channel,
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
  };
}

export async function resendPrivilegedChallenge(input: { challengeId: string }) {
  const issued = await resendPrivilegedSignInChallenge(input.challengeId);
  if (!issued) {
    throw badRequest('The privileged sign-in challenge is no longer available. Start again.');
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
      channel: issued.challenge.channel,
      resendAfterSeconds: issued.resendAfterSeconds,
      expiresInSeconds: issued.expiresInSeconds,
      challengeStoreMode,
    },
  });

  if (issued.isNew && issued.challenge.channel === 'email') {
    await sendOtpEmail({
      to: issued.challenge.identifier,
      code: issued.challenge.code,
      expiresInSeconds: issued.expiresInSeconds,
      purpose: 'privileged sign-in',
    });
  }

  return {
    challengeId: issued.challenge.id,
    channel: issued.challenge.channel,
    expiresInSeconds: issued.expiresInSeconds,
    resendAfterSeconds: issued.resendAfterSeconds,
    challengeStoreMode,
    devCode: process.env.NODE_ENV === 'production' ? undefined : issued.challenge.code,
  };
}

export async function verifyPrivilegedChallenge(input: { challengeId: string; code: string }) {
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
  if (!user) {
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

  return completeLoginForUser(user);
}

export async function requestPatientOtp(input: { identifier: string; channel?: OtpChannel }) {
  const identifier = input.identifier.trim().toLowerCase();
  const user = await prisma.user.findUnique({ where: { email: identifier } });
  if (!user || user.role !== 'PATIENT') {
    console.warn(
      `[otp] requestPatientOtp: no se envia email — identifier "${identifier}" ${
        user ? `existe pero su rol es ${user.role} (se requiere PATIENT)` : 'no existe como usuario'
      }. Respuesta neutra para no filtrar cuentas.`,
    );
    return {
      challengeId: identifier,
      channel: input.channel ?? 'email',
      expiresInSeconds: 300,
      resendAfterSeconds: 60,
    };
  }

  const issued = await issueOtpChallenge({
    identifier,
    userId: user.id,
    role: user.role,
    organizationId: user.organizationId ?? undefined,
    channel: input.channel ?? 'email',
  });

  const challengeStoreMode = await getAuthChallengeStoreMode();

  await writeAuditLog({
    actorId: user.id,
    organizationId: user.organizationId ?? undefined,
    action: issued.isNew ? 'auth.otp_requested' : 'auth.otp_resend_blocked',
    resource: 'user',
    resourceId: user.id,
    details: {
      channel: issued.challenge.channel,
      resendAfterSeconds: issued.resendAfterSeconds,
      expiresInSeconds: issued.expiresInSeconds,
      challengeStoreMode,
    },
  });

  if (issued.isNew && issued.challenge.channel === 'email') {
    await sendOtpEmail({
      to: issued.challenge.identifier,
      code: issued.challenge.code,
      expiresInSeconds: issued.expiresInSeconds,
      purpose: 'patient sign-in',
    });
  } else {
    console.warn(
      `[otp] requestPatientOtp: no se envia email para ${identifier} — ${
        !issued.isNew
          ? 'reutilizando challenge reciente (ventana de reenvio de 60s activa)'
          : `canal=${issued.challenge.channel} (solo se envia email cuando canal=email)`
      }`,
    );
  }

  return {
    challengeId: identifier,
    channel: issued.challenge.channel,
    expiresInSeconds: issued.expiresInSeconds,
    resendAfterSeconds: issued.resendAfterSeconds,
    challengeStoreMode,
    devCode: process.env.NODE_ENV === 'production' ? undefined : issued.challenge.code,
  };
}

export async function verifyPatientOtp(input: { identifier: string; code: string }) {
  const result = await verifyOtpChallenge(input.identifier, input.code);

  if (!result.ok) {
    if (result.reason === 'locked') {
      throw badRequest(`Too many failed attempts. Retry in ${result.retryAfterSeconds ?? 0} seconds.`);
    }
    if (result.reason === 'expired') {
      throw badRequest('The verification code expired. Request a new code.');
    }
    if (result.reason === 'invalid') {
      throw unauthorized(`The verification code was not accepted. ${result.attemptsRemaining ?? 0} attempt(s) remaining.`);
    }
    throw unauthorized('No active verification challenge was found. Request a new code.');
  }

  const user = await prisma.user.findUnique({ where: { id: result.challenge.userId } });
  if (!user) {
    throw unauthorized('The verification session is no longer available.');
  }

  await writeAuditLog({
    actorId: user.id,
    organizationId: user.organizationId ?? undefined,
    action: 'auth.otp_verified',
    resource: 'user',
    resourceId: user.id,
    details: { channel: result.challenge.channel },
  });

  return completeLoginForUser(user);
}

export async function refreshUserToken(rawRefreshToken: string) {
  const payload = verifyRefreshToken(rawRefreshToken);

  const stored = await prisma.refreshToken.findMany({
    where: {
      userId: payload.sub,
      revokedAt: null,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: 'desc' },
  });

  let matched = false;
  for (const entry of stored) {
    const ok = await bcrypt.compare(rawRefreshToken, entry.tokenHash);
    if (ok) {
      matched = true;
      break;
    }
  }

  if (!matched) {
    throw unauthorized('Refresh token is invalid or revoked');
  }

  const nextAccessToken = signAccessToken({
    sub: payload.sub,
    role: payload.role,
    organizationId: payload.organizationId,
  });

  return {
    accessToken: nextAccessToken,
    user: {
      id: payload.sub,
      role: payload.role,
      organizationId: payload.organizationId,
    },
  };
}

export async function logoutUser(rawRefreshToken: string | undefined) {
  if (!rawRefreshToken) {
    return;
  }

  const payload = verifyRefreshToken(rawRefreshToken);
  const stored = await prisma.refreshToken.findMany({
    where: {
      userId: payload.sub,
      revokedAt: null,
    },
  });

  for (const entry of stored) {
    const ok = await bcrypt.compare(rawRefreshToken, entry.tokenHash);
    if (ok) {
      await prisma.refreshToken.update({
        where: { id: entry.id },
        data: { revokedAt: new Date() },
      });
    }
  }

  await writeAuditLog({
    actorId: payload.sub,
    organizationId: payload.organizationId,
    action: 'auth.logged_out',
    resource: 'user',
    resourceId: payload.sub,
  });
}


// --- Patient self-registration via OTP (passwordless) ---
// The mobile patient app uses this to sign up AND sign in. If the email
// already exists as PATIENT, it behaves like requestPatientOtp (just issues
// the OTP). If it doesn't exist, it creates the PATIENT user first. The
// verify step (/api/auth/otp/verify) remains the same for both flows.
export async function registerPatientViaOtp(input: {
  email: string;
  firstName: string;
  lastName: string;
  channel?: OtpChannel;
}) {
  const identifier = input.email.trim().toLowerCase();
  let user = await prisma.user.findUnique({ where: { email: identifier } });
  let isNewUser = false;

  if (user && user.role !== 'PATIENT') {
    // Email exists but belongs to a non-patient (provider, admin, etc.)
    throw badRequest(
      'This email is already associated with a non-patient account. Please use a different email or contact support.',
    );
  }

  if (!user) {
    // Auto-register as PATIENT with no password (OTP-only).
    const defaultOrg = await prisma.organization.findFirst();
    if (!defaultOrg) {
      throw badRequest('System not initialized: no organization available. Contact support.');
    }

    user = await prisma.user.create({
      data: {
        email: identifier,
        passwordHash: '', // Passwordless (OTP-only patient)
        firstName: input.firstName.trim(),
        lastName: input.lastName.trim(),
        role: 'PATIENT',
        organizationId: defaultOrg.id,
      },
    });

    await createUserProfile(user.id, user.role, defaultOrg.id);
    isNewUser = true;

    await writeAuditLog({
      actorId: user.id,
      organizationId: defaultOrg.id,
      action: 'auth.patient_self_registered',
      resource: 'user',
      resourceId: user.id,
      details: { channel: input.channel ?? 'email' },
    });

    console.log(`[otp] registerPatientViaOtp: nuevo paciente creado — ${identifier} (${user.id})`);
  }

  // Now issue the OTP (exactly like requestPatientOtp for existing users).
  const issued = await issueOtpChallenge({
    identifier,
    userId: user.id,
    role: user.role,
    organizationId: user.organizationId ?? undefined,
    channel: input.channel ?? 'email',
  });

  const challengeStoreMode = await getAuthChallengeStoreMode();

  await writeAuditLog({
    actorId: user.id,
    organizationId: user.organizationId ?? undefined,
    action: issued.isNew ? 'auth.otp_requested' : 'auth.otp_resend_blocked',
    resource: 'user',
    resourceId: user.id,
    details: {
      channel: issued.challenge.channel,
      resendAfterSeconds: issued.resendAfterSeconds,
      expiresInSeconds: issued.expiresInSeconds,
      challengeStoreMode,
      isNewUser,
    },
  });

  if (issued.isNew && issued.challenge.channel === 'email') {
    await sendOtpEmail({
      to: issued.challenge.identifier,
      code: issued.challenge.code,
      expiresInSeconds: issued.expiresInSeconds,
      purpose: isNewUser ? 'patient registration' : 'patient sign-in',
    });
  }

  return {
    challengeId: identifier,
    channel: issued.challenge.channel,
    expiresInSeconds: issued.expiresInSeconds,
    resendAfterSeconds: issued.resendAfterSeconds,
    challengeStoreMode,
    isNewUser,
    devCode: process.env.NODE_ENV === 'production' ? undefined : issued.challenge.code,
  };
}
