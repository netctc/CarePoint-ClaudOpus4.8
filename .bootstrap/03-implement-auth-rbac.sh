#!/usr/bin/env bash
set -euo pipefail

ROOT="${1:-$(pwd)}"

say() { printf '\n[%s] %s\n' "auth-rbac" "$1"; }
fail() { printf '\n[auth-rbac][error] %s\n' "$1" >&2; exit 1; }
ensure_dir() { mkdir -p "$1"; }

[ -d "$ROOT/services/api" ] || fail "Run 02-build-backend-and-contracts.sh first"

ensure_dir "$ROOT/services/api/src/modules/auth"
ensure_dir "$ROOT/services/api/src/lib"
ensure_dir "$ROOT/apps/provider/lib/auth"
ensure_dir "$ROOT/apps/admin/src/lib/auth"

say "Upgrading backend auth and RBAC middleware"
cat > "$ROOT/services/api/src/lib/jwt.ts" <<'TS'
import jwt from 'jsonwebtoken';
import { env } from './env';

export type AccessTokenPayload = {
  sub: string;
  role: string;
  organizationId?: string;
};

export function signAccessToken(payload: AccessTokenPayload) {
  return jwt.sign(payload, env.jwtAccessSecret, {
    expiresIn: env.jwtAccessTtl,
  });
}

export function signRefreshToken(payload: AccessTokenPayload) {
  return jwt.sign(payload, env.jwtRefreshSecret, {
    expiresIn: env.jwtRefreshTtl,
  });
}

export function verifyAccessToken(token: string) {
  return jwt.verify(token, env.jwtAccessSecret) as AccessTokenPayload;
}

export function verifyRefreshToken(token: string) {
  return jwt.verify(token, env.jwtRefreshSecret) as AccessTokenPayload;
}
TS

cat > "$ROOT/services/api/src/middleware/auth.ts" <<'TS'
import { NextFunction, Request, Response } from 'express';
import { unauthorized } from '../lib/http';
import { verifyAccessToken } from '../lib/jwt';

export type RequestUser = {
  userId: string;
  role: string;
  organizationId?: string;
};

declare global {
  namespace Express {
    interface Request {
      user?: RequestUser;
      io?: import('socket.io').Server;
    }
  }
}

function extractBearerToken(req: Request) {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) {
    return header.slice('Bearer '.length);
  }
  if (typeof req.cookies?.accessToken === 'string') {
    return req.cookies.accessToken;
  }
  return null;
}

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    const token = extractBearerToken(req);
    if (!token) {
      return next(unauthorized('Missing access token'));
    }

    const payload = verifyAccessToken(token);
    req.user = {
      userId: payload.sub,
      role: payload.role,
      organizationId: payload.organizationId,
    };

    next();
  } catch {
    return next(unauthorized('Invalid access token'));
  }
}
TS

cat > "$ROOT/services/api/src/middleware/rbac.ts" <<'TS'
import { NextFunction, Request, Response } from 'express';
import { forbidden, unauthorized } from '../lib/http';

export function allowRoles(roles: string[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(unauthorized('Authentication required'));
    }

    if (!roles.includes(req.user.role)) {
      return next(forbidden('Role is not allowed to access this resource'));
    }

    next();
  };
}
TS

cat > "$ROOT/services/api/src/modules/auth/auth.service.ts" <<'TS'
import bcrypt from 'bcryptjs';
import { SignUpInput, LoginInput } from '@care-center/contracts';
import { prisma } from '../../lib/prisma';
import { badRequest, unauthorized } from '../../lib/http';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../../lib/jwt';
import { writeAuditLog } from '../../lib/audit';

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

  const payload = {
    sub: user.id,
    role: user.role,
    organizationId: organization.id,
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

  await writeAuditLog({
    actorId: user.id,
    organizationId: organization.id,
    action: 'auth.registered',
    resource: 'user',
    resourceId: user.id,
    details: { role: user.role },
  });

  return {
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      organizationId: organization.id,
    },
    accessToken,
    refreshToken,
  };
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

  await writeAuditLog({
    actorId: user.id,
    organizationId: user.organizationId ?? undefined,
    action: 'auth.logged_in',
    resource: 'user',
    resourceId: user.id,
  });

  return {
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      organizationId: user.organizationId,
    },
    accessToken,
    refreshToken,
  };
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

  return { accessToken: nextAccessToken };
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
TS

cat > "$ROOT/services/api/src/modules/auth/auth.routes.ts" <<'TS'
import { Router } from 'express';
import { loginSchema, signUpSchema } from '@care-center/contracts';
import { validateBody } from '../../middleware/validate';
import { requireAuth } from '../../middleware/auth';
import { prisma } from '../../lib/prisma';
import { loginUser, logoutUser, refreshUserToken, registerUser } from './auth.service';

export const authRouter = Router();

authRouter.post('/register', validateBody(signUpSchema), async (req, res) => {
  const result = await registerUser(req.body);
  res.cookie('accessToken', result.accessToken, {
    httpOnly: true,
    sameSite: 'lax',
  });
  res.cookie('refreshToken', result.refreshToken, {
    httpOnly: true,
    sameSite: 'lax',
  });
  res.status(201).json(result);
});

authRouter.post('/login', validateBody(loginSchema), async (req, res) => {
  const result = await loginUser(req.body);
  res.cookie('accessToken', result.accessToken, {
    httpOnly: true,
    sameSite: 'lax',
  });
  res.cookie('refreshToken', result.refreshToken, {
    httpOnly: true,
    sameSite: 'lax',
  });
  res.json(result);
});

authRouter.post('/refresh', async (req, res) => {
  const token = req.cookies.refreshToken || req.body?.refreshToken;
  const result = await refreshUserToken(token);
  res.cookie('accessToken', result.accessToken, {
    httpOnly: true,
    sameSite: 'lax',
  });
  res.json(result);
});

authRouter.post('/logout', async (req, res) => {
  const token = req.cookies.refreshToken || req.body?.refreshToken;
  await logoutUser(token);
  res.clearCookie('accessToken');
  res.clearCookie('refreshToken');
  res.status(204).send();
});

authRouter.get('/me', requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.userId },
    select: {
      id: true,
      email: true,
      role: true,
      organizationId: true,
      firstName: true,
      lastName: true,
    },
  });

  res.json(user);
});
TS

say "Adding frontend auth helpers for provider portal"
python3 - <<'PY' "$ROOT/apps/provider/package.json"
import json, sys, pathlib
path = pathlib.Path(sys.argv[1])
data = json.loads(path.read_text())
data.setdefault("dependencies", {})
data["dependencies"]["jose"] = "^5.6.3"
path.write_text(json.dumps(data, indent=2) + "\n")
PY

cat > "$ROOT/apps/provider/middleware.ts" <<'TS'
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const protectedPrefixes = ['/portal'];

export function middleware(request: NextRequest) {
  const token = request.cookies.get('cc_access_token')?.value;
  const pathname = request.nextUrl.pathname;

  const needsAuth = protectedPrefixes.some((prefix) => pathname.startsWith(prefix));
  if (needsAuth && !token) {
    const signInUrl = new URL('/sign-in', request.url);
    signInUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(signInUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/portal/:path*'],
};
TS

cat > "$ROOT/apps/provider/lib/auth/session.ts" <<'TS'
import { cookies } from 'next/headers';

export type ProviderSession = {
  token: string | null;
  role: string | null;
};

export function getProviderSession(): ProviderSession {
  const store = cookies();

  return {
    token: store.get('cc_access_token')?.value ?? null,
    role: store.get('cc_role')?.value ?? null,
  };
}
TS

say "Adding frontend auth helpers for admin portal"
python3 - <<'PY' "$ROOT/apps/admin/package.json"
import json, sys, pathlib
path = pathlib.Path(sys.argv[1])
data = json.loads(path.read_text())
data.setdefault("dependencies", {})
data["dependencies"]["jose"] = "^5.6.3"
path.write_text(json.dumps(data, indent=2) + "\n")
PY

cat > "$ROOT/apps/admin/middleware.ts" <<'TS'
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const protectedPrefixes = ['/console', '/providers', '/reports', '/settings'];

export function middleware(request: NextRequest) {
  const token = request.cookies.get('cc_access_token')?.value;
  const pathname = request.nextUrl.pathname;

  const needsAuth = protectedPrefixes.some((prefix) => pathname.startsWith(prefix));
  if (needsAuth && !token) {
    const signInUrl = new URL('/auth/sign-in', request.url);
    signInUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(signInUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/console/:path*', '/providers/:path*', '/reports/:path*', '/settings/:path*'],
};
TS

cat > "$ROOT/apps/admin/src/lib/auth/session.ts" <<'TS'
import { cookies } from 'next/headers';

export type AdminSession = {
  token: string | null;
  role: string | null;
};

export function getAdminSession(): AdminSession {
  const store = cookies();

  return {
    token: store.get('cc_access_token')?.value ?? null,
    role: store.get('cc_role')?.value ?? null,
  };
}
TS

say "Updating provider permissions to use real shared role names"
cat > "$ROOT/apps/provider/lib/permissions/roles.ts" <<'TS'
export type ProviderRole =
  | 'PROVIDER'
  | 'NURSE'
  | 'PHARMACIST'
  | 'LAB_TECH'
  | 'FINANCE'
  | 'COMPANY_ADMIN'
  | 'SUPER_ADMIN';

export const portalPermissions = {
  dashboard: ['PROVIDER', 'NURSE', 'FINANCE', 'COMPANY_ADMIN', 'SUPER_ADMIN'],
  calendar: ['PROVIDER', 'NURSE', 'COMPANY_ADMIN', 'SUPER_ADMIN'],
  queue: ['PROVIDER', 'NURSE', 'COMPANY_ADMIN', 'SUPER_ADMIN'],
  billing: ['FINANCE', 'COMPANY_ADMIN', 'SUPER_ADMIN'],
  compliance: ['COMPANY_ADMIN', 'SUPER_ADMIN'],
} as const;
TS

say "Auth and RBAC scaffold complete"
