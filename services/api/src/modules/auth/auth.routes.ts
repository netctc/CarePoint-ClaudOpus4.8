import { Router } from 'express';
import { z } from 'zod';
import { loginSchema, signUpSchema } from '@care-center/contracts';
import { validateBody } from '../../middleware/validate';
import { requireAuth } from '../../middleware/auth';
import { prisma } from '../../lib/prisma';
import { buildHspAccessSummary } from '../../lib/hsp-access';
import { getPrivilegedSsoConfig, loginUser, logoutUser, refreshUserToken, registerPatientViaOtp, registerUser, requestPatientOtp, resendPrivilegedChallenge, startPrivilegedSignInChallenge, startSsoHandoff, verifyPatientOtp, verifyPrivilegedChallenge } from './auth.service';

export const authRouter = Router();

function writeCookie(res: import('express').Response, name: string, value: string, httpOnly: boolean) {
  res.cookie(name, value, {
    httpOnly,
    sameSite: 'lax',
  });
}

function getRoleCookieScope(role?: string) {
  const normalized = String(role ?? '').trim().toUpperCase();
  if (['PROVIDER', 'NURSE', 'PHARMACIST', 'LAB_TECH'].includes(normalized)) return 'provider';
  if (['SUPER_ADMIN', 'COMPANY_ADMIN', 'COMPANY_SUPPORT', 'FINANCE'].includes(normalized)) return 'admin';
  if (normalized === 'PATIENT') return 'patient';
  return null;
}

function writeSessionCookies(res: import('express').Response, accessToken: string, refreshToken?: string, role?: string) {
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

function buildPatientProfileResponse(user: any) {
  const patientProfile = user?.patientProfile;
  if (!patientProfile) return null;
  const preferences = patientProfile.preferences && typeof patientProfile.preferences === 'object' ? patientProfile.preferences : {};
  const profile = (preferences as any).profile && typeof (preferences as any).profile === 'object' ? (preferences as any).profile : {};
  return {
    id: patientProfile.id,
    insuranceNumber: patientProfile.insuranceNumber ?? null,
    dateOfBirth: patientProfile.dateOfBirth ?? null,
    locale: (preferences as any).locale ?? 'en',
    gender: profile.gender ?? null,
    nationality: profile.nationality ?? null,
    countryRegion: profile.countryRegion ?? null,
    emergencyContact: profile.emergencyContact ?? null,
    nationalId: profile.nationalId ?? null,
    fullName: `${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim() || null,
  };
}

authRouter.post('/register', validateBody(signUpSchema), async (req: any, res: any) => {
  const result = await registerUser(req.body);
  writeSessionCookies(res, result.accessToken, result.refreshToken, result.user.role);
  res.status(201).json(result);
});

authRouter.post('/login', validateBody(loginSchema), async (req: any, res: any) => {
  const result = await loginUser(req.body);
  writeSessionCookies(res, result.accessToken, result.refreshToken, result.user.role);
  res.json(result);
});

const privilegedChallengeStartSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(8),
  managedDevice: z.boolean().default(false),
  riskAcknowledged: z.boolean().default(false),
  channel: z.enum(['email', 'sms', 'totp']).default('totp'),
});

const privilegedChallengeVerifySchema = z.object({
  challengeId: z.string().trim().min(8),
  code: z.string().trim().min(4).max(8),
});

const privilegedChallengeResendSchema = z.object({
  challengeId: z.string().trim().min(8),
});

const ssoRoleSchema = z.enum(['admin', 'provider']);
const ssoConfigQuerySchema = z.object({
  roleHint: ssoRoleSchema.optional(),
});
const ssoStartSchema = z.object({
  email: z.string().trim().email().optional().or(z.literal('')),
  roleHint: ssoRoleSchema.optional(),
  returnTo: z.string().trim().max(500).optional(),
});

// v1 supports patient OTP delivery by email only. SMS remains OUT until a real
// SMS delivery adapter is implemented and validated in staging.
const otpRequestSchema = z.object({
  identifier: z.string().trim().min(3),
  channel: z.literal('email').default('email'),
});
const otpVerifySchema = z.object({
  identifier: z.string().trim().min(3),
  code: z.string().trim().min(1).max(20),
});

authRouter.get('/sso/config', async (req: any, res: any) => {
  const query = ssoConfigQuerySchema.parse(req.query ?? {});
  res.json(getPrivilegedSsoConfig(query.roleHint ?? null));
});

authRouter.post('/sso/start', async (req: any, res: any) => {
  const payload = ssoStartSchema.parse(req.body ?? {});
  const result = await startSsoHandoff({
    email: payload.email?.trim() || undefined,
    roleHint: payload.roleHint ?? null,
    returnTo: payload.returnTo,
  });
  res.status(202).json(result);
});

authRouter.post('/challenge/start', validateBody(privilegedChallengeStartSchema), async (req: any, res: any) => {
  const result = await startPrivilegedSignInChallenge(req.body);
  res.status(202).json(result);
});

authRouter.post('/challenge/verify', validateBody(privilegedChallengeVerifySchema), async (req: any, res: any) => {
  const result = await verifyPrivilegedChallenge(req.body);
  writeSessionCookies(res, result.accessToken, result.refreshToken, result.user.role);
  res.json(result);
});

authRouter.post('/challenge/resend', validateBody(privilegedChallengeResendSchema), async (req: any, res: any) => {
  const result = await resendPrivilegedChallenge(req.body);
  res.status(202).json(result);
});

authRouter.post('/otp/request', async (req: any, res: any) => {
  const payload = otpRequestSchema.parse(req.body) as { identifier: string; channel?: 'email' };
  const result = await requestPatientOtp(payload);
  res.status(202).json(result);
});

authRouter.post('/otp/verify', async (req: any, res: any) => {
  const payload = otpVerifySchema.parse(req.body) as { identifier: string; code: string };
  const result = await verifyPatientOtp(payload);
  writeSessionCookies(res, result.accessToken, result.refreshToken, result.user.role);
  res.json(result);
});

authRouter.post('/otp/resend', async (req: any, res: any) => {
  const payload = otpRequestSchema.parse(req.body) as { identifier: string; channel?: 'email' };
  const result = await requestPatientOtp(payload);
  res.status(202).json(result);
});

const otpRegisterSchema = z.object({
  email: z.string().trim().email(),
  firstName: z.string().trim().min(1),
  lastName: z.string().trim().min(1),
  channel: z.literal('email').default('email'),
});

authRouter.post('/otp/register', async (req: any, res: any) => {
  const payload = otpRegisterSchema.parse(req.body);
  const result = await registerPatientViaOtp({
    email: payload.email,
    firstName: payload.firstName,
    lastName: payload.lastName,
    channel: payload.channel,
  });
  res.status(202).json(result);
});

authRouter.post('/refresh', async (req: any, res: any) => {
  const token = req.cookies.refreshToken || req.body?.refreshToken;
  const result = await refreshUserToken(token);
  writeSessionCookies(res, result.accessToken, undefined, result.user?.role);
  res.json(result);
});

authRouter.post('/logout', async (req: any, res: any) => {
  const token = req.cookies.refreshToken || req.body?.refreshToken;
  await logoutUser(token);
  for (const name of [
    'accessToken',
    'refreshToken',
    'cc_access_token',
    'cc_role',
    'cc_provider_access_token',
    'cc_provider_role',
    'cc_admin_access_token',
    'cc_admin_role',
    'cc_patient_access_token',
    'cc_patient_role',
    'refreshToken_provider',
    'refreshToken_admin',
    'refreshToken_patient',
  ]) {
    res.clearCookie(name);
  }
  res.status(204).send();
});

authRouter.get('/me', requireAuth, async (req: any, res: any) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.userId },
    include: {
      patientProfile: {
        select: {
          id: true,
          insuranceNumber: true,
          dateOfBirth: true,
          preferences: true,
        },
      },
      providerProfile: { select: { id: true, specialty: true, services: true, licenseNumber: true } },
      organization: { select: { name: true } },
    },
  });

  const hspAccess = user?.providerProfile
    ? buildHspAccessSummary({
        organizationId: user.organizationId ?? null,
        organizationName: user.organization?.name ?? null,
        role: user.role,
      })
    : null;

  res.json({
    id: user?.id,
    email: user?.email,
    role: user?.role,
    organizationId: user?.organizationId,
    organizationName: user?.organization?.name ?? null,
    firstName: user?.firstName,
    lastName: user?.lastName,
    fullName: `${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim(),
    patientProfile: buildPatientProfileResponse(user),
    providerProfile: user?.providerProfile ?? null,
    hspAccess,
  });
});
