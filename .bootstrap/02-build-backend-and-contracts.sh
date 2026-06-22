#!/usr/bin/env bash
set -euo pipefail

ROOT="${1:-$(pwd)}"

say() { printf '\n[%s] %s\n' "backend" "$1"; }
fail() { printf '\n[backend][error] %s\n' "$1" >&2; exit 1; }
ensure_dir() { mkdir -p "$1"; }

[ -d "$ROOT/apps/admin" ] || fail "Run 01-normalize-repo.sh first"
[ -d "$ROOT/apps/provider" ] || fail "Run 01-normalize-repo.sh first"
[ -d "$ROOT/apps/mobile" ] || fail "Run 01-normalize-repo.sh first"

say "Creating shared contracts package"
ensure_dir "$ROOT/packages/contracts/src"

cat > "$ROOT/packages/contracts/package.json" <<'JSON'
{
  "name": "@care-center/contracts",
  "version": "0.1.0",
  "private": true,
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "files": ["dist"],
  "scripts": {
    "build": "tsc -p tsconfig.json"
  },
  "dependencies": {
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "typescript": "5.5.3"
  }
}
JSON

cat > "$ROOT/packages/contracts/tsconfig.json" <<'JSON'
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "declaration": true,
    "outDir": "dist",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "include": ["src/**/*.ts"]
}
JSON

cat > "$ROOT/packages/contracts/src/index.ts" <<'TS'
import { z } from 'zod';

export const userRoles = [
  'SUPER_ADMIN',
  'COMPANY_ADMIN',
  'COMPANY_SUPPORT',
  'PROVIDER',
  'NURSE',
  'PHARMACIST',
  'LAB_TECH',
  'FINANCE',
  'PATIENT',
] as const;

export const userRoleSchema = z.enum(userRoles);

export const signUpSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  role: userRoleSchema,
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  organizationName: z.string().min(2).optional(),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export const appointmentStatusSchema = z.enum([
  'REQUESTED',
  'CONFIRMED',
  'CANCELLED',
  'COMPLETED',
  'NO_SHOW',
]);

export const appointmentCreateSchema = z.object({
  patientId: z.string().min(1),
  providerId: z.string().min(1),
  organizationId: z.string().min(1),
  service: z.string().min(1),
  location: z.string().min(1),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  notes: z.string().optional(),
});

export const appointmentPatchSchema = z.object({
  status: appointmentStatusSchema.optional(),
  startsAt: z.string().datetime().optional(),
  endsAt: z.string().datetime().optional(),
  notes: z.string().optional(),
});

export const medicalRecordCreateSchema = z.object({
  patientId: z.string().min(1),
  providerId: z.string().optional(),
  appointmentId: z.string().optional(),
  summary: z.record(z.any()).default({}),
  content: z.record(z.any()).default({}),
});

export const threadCreateSchema = z.object({
  organizationId: z.string().min(1),
  patientId: z.string().optional(),
  providerId: z.string().optional(),
  subject: z.string().min(1),
  type: z.enum(['PATIENT_PROVIDER', 'INTERNAL']),
});

export const messageCreateSchema = z.object({
  threadId: z.string().min(1),
  body: z.string().min(1),
  attachments: z.array(z.string()).default([]),
});

export const telehealthSessionCreateSchema = z.object({
  appointmentId: z.string().min(1),
  scheduledAt: z.string().datetime().optional(),
});

export const paymentIntentCreateSchema = z.object({
  appointmentId: z.string().optional(),
  patientId: z.string().optional(),
  providerId: z.string().optional(),
  amountMinor: z.number().int().positive(),
  currency: z.string().length(3).default('USD'),
  metadata: z.record(z.any()).default({}),
});

export type UserRole = z.infer<typeof userRoleSchema>;
export type SignUpInput = z.infer<typeof signUpSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type AppointmentCreateInput = z.infer<typeof appointmentCreateSchema>;
export type AppointmentPatchInput = z.infer<typeof appointmentPatchSchema>;
export type MedicalRecordCreateInput = z.infer<typeof medicalRecordCreateSchema>;
export type ThreadCreateInput = z.infer<typeof threadCreateSchema>;
export type MessageCreateInput = z.infer<typeof messageCreateSchema>;
export type TelehealthSessionCreateInput = z.infer<typeof telehealthSessionCreateSchema>;
export type PaymentIntentCreateInput = z.infer<typeof paymentIntentCreateSchema>;
TS

say "Creating API service"
ensure_dir "$ROOT/services/api/src/lib"
ensure_dir "$ROOT/services/api/src/middleware"
ensure_dir "$ROOT/services/api/src/modules/health"
ensure_dir "$ROOT/services/api/src/modules/auth"
ensure_dir "$ROOT/services/api/src/modules/appointments"
ensure_dir "$ROOT/services/api/src/modules/records"
ensure_dir "$ROOT/services/api/src/modules/messaging"
ensure_dir "$ROOT/services/api/src/modules/telehealth"
ensure_dir "$ROOT/services/api/src/modules/payments"
ensure_dir "$ROOT/services/api/prisma"

cat > "$ROOT/services/api/package.json" <<'JSON'
{
  "name": "@care-center/api",
  "version": "0.1.0",
  "private": true,
  "main": "dist/index.js",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc -p tsconfig.json",
    "start": "node dist/index.js",
    "prisma:generate": "prisma generate",
    "prisma:migrate": "prisma migrate dev",
    "prisma:seed": "tsx prisma/seed.ts"
  },
  "dependencies": {
    "@care-center/contracts": "0.1.0",
    "@prisma/client": "^5.18.0",
    "bcryptjs": "^2.4.3",
    "cookie-parser": "^1.4.6",
    "cors": "^2.8.5",
    "dayjs": "^1.11.13",
    "dotenv": "^16.4.5",
    "express": "^4.19.2",
    "express-async-errors": "^3.1.1",
    "helmet": "^7.1.0",
    "http-status-codes": "^2.3.0",
    "jsonwebtoken": "^9.0.2",
    "morgan": "^1.10.0",
    "prisma": "^5.18.0",
    "redis": "^4.7.0",
    "socket.io": "^4.7.5",
    "stripe": "^16.8.0",
    "uuid": "^10.0.0",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "@types/bcryptjs": "^2.4.6",
    "@types/cookie-parser": "^1.4.7",
    "@types/cors": "^2.8.17",
    "@types/express": "^5.0.0",
    "@types/jsonwebtoken": "^9.0.6",
    "@types/morgan": "^1.9.9",
    "@types/node": "^22.1.0",
    "@types/uuid": "^10.0.0",
    "tsx": "^4.16.2",
    "typescript": "5.5.3"
  }
}
JSON

cat > "$ROOT/services/api/tsconfig.json" <<'JSON'
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "include": ["src/**/*.ts"]
}
JSON

cat > "$ROOT/services/api/.env.example" <<'TXT'
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/care_center
REDIS_URL=redis://localhost:6379
API_PORT=4000
JWT_ACCESS_SECRET=replace-me
JWT_REFRESH_SECRET=replace-me-too
JWT_ACCESS_TTL=15m
JWT_REFRESH_TTL=30d
FRONTEND_PROVIDER_URL=http://localhost:3000
FRONTEND_ADMIN_URL=http://localhost:3001
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
TELEHEALTH_VENDOR=daily
DAILY_API_KEY=
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TXT

cat > "$ROOT/services/api/prisma/schema.prisma" <<'PRISMA'
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum UserRole {
  SUPER_ADMIN
  COMPANY_ADMIN
  COMPANY_SUPPORT
  PROVIDER
  NURSE
  PHARMACIST
  LAB_TECH
  FINANCE
  PATIENT
}

enum AppointmentStatus {
  REQUESTED
  CONFIRMED
  CANCELLED
  COMPLETED
  NO_SHOW
}

enum MessageThreadType {
  PATIENT_PROVIDER
  INTERNAL
}

enum TelehealthStatus {
  SCHEDULED
  READY
  LIVE
  ENDED
}

enum PaymentStatus {
  PENDING
  AUTHORIZED
  CAPTURED
  REFUNDED
  FAILED
}

model Organization {
  id           String            @id @default(cuid())
  name         String
  createdAt    DateTime          @default(now())
  updatedAt    DateTime          @updatedAt
  users        User[]
  patients     PatientProfile[]
  providers    ProviderProfile[]
  appointments Appointment[]
  threads      MessageThread[]
  audits       AuditLog[]
}

model User {
  id              String           @id @default(cuid())
  email           String           @unique
  passwordHash    String
  firstName       String
  lastName        String
  role            UserRole
  organizationId  String?
  organization    Organization?    @relation(fields: [organizationId], references: [id])
  patientProfile  PatientProfile?
  providerProfile ProviderProfile?
  refreshTokens   RefreshToken[]
  createdAt       DateTime         @default(now())
  updatedAt       DateTime         @updatedAt
  sentMessages    Message[]
  audits          AuditLog[]
}

model PatientProfile {
  id              String         @id @default(cuid())
  userId          String         @unique
  organizationId  String
  dateOfBirth     DateTime?
  insuranceNumber String?
  preferences     Json?
  user            User           @relation(fields: [userId], references: [id])
  organization    Organization   @relation(fields: [organizationId], references: [id])
  appointments    Appointment[]  @relation("PatientAppointments")
  records         MedicalRecord[]
  threads         MessageThread[]
  payments        Payment[]
}

model ProviderProfile {
  id             String        @id @default(cuid())
  userId         String        @unique
  organizationId String
  specialty      String?
  licenseNumber  String?
  services       Json?
  user           User          @relation(fields: [userId], references: [id])
  organization   Organization  @relation(fields: [organizationId], references: [id])
  appointments   Appointment[] @relation("ProviderAppointments")
  threads        MessageThread[]
  payments       Payment[]     @relation("ProviderPayments")
}

model RefreshToken {
  id           String   @id @default(cuid())
  userId       String
  tokenHash    String
  expiresAt    DateTime
  revokedAt    DateTime?
  createdAt    DateTime @default(now())
  user         User     @relation(fields: [userId], references: [id])
}

model Appointment {
  id               String             @id @default(cuid())
  organizationId   String
  patientId        String
  providerId       String
  service          String
  location         String
  startsAt         DateTime
  endsAt           DateTime
  notes            String?
  status           AppointmentStatus  @default(REQUESTED)
  createdAt        DateTime           @default(now())
  updatedAt        DateTime           @updatedAt
  organization     Organization       @relation(fields: [organizationId], references: [id])
  patient          PatientProfile     @relation("PatientAppointments", fields: [patientId], references: [id])
  provider         ProviderProfile    @relation("ProviderAppointments", fields: [providerId], references: [id])
  telehealthSession TelehealthSession?
  records          MedicalRecord[]
  payments         Payment[]
}

model MedicalRecord {
  id            String          @id @default(cuid())
  patientId     String
  providerId    String?
  appointmentId String?
  summary       Json
  content       Json
  createdAt     DateTime        @default(now())
  updatedAt     DateTime        @updatedAt
  patient       PatientProfile  @relation(fields: [patientId], references: [id])
  appointment   Appointment?    @relation(fields: [appointmentId], references: [id])
}

model MessageThread {
  id             String            @id @default(cuid())
  organizationId String
  patientId      String?
  providerId     String?
  subject        String
  type           MessageThreadType
  createdAt      DateTime          @default(now())
  updatedAt      DateTime          @updatedAt
  organization   Organization      @relation(fields: [organizationId], references: [id])
  patient        PatientProfile?   @relation(fields: [patientId], references: [id])
  provider       ProviderProfile?  @relation(fields: [providerId], references: [id])
  messages       Message[]
}

model Message {
  id          String        @id @default(cuid())
  threadId    String
  senderId    String
  body        String
  attachments Json?
  createdAt   DateTime      @default(now())
  thread      MessageThread @relation(fields: [threadId], references: [id])
  sender      User          @relation(fields: [senderId], references: [id])
}

model TelehealthSession {
  id            String           @id @default(cuid())
  appointmentId String           @unique
  vendor        String
  meetingId     String
  joinUrl       String
  status        TelehealthStatus @default(SCHEDULED)
  scheduledAt   DateTime?
  startedAt     DateTime?
  endedAt       DateTime?
  createdAt     DateTime         @default(now())
  updatedAt     DateTime         @updatedAt
  appointment   Appointment      @relation(fields: [appointmentId], references: [id])
}

model Payment {
  id              String        @id @default(cuid())
  appointmentId   String?
  patientId       String?
  providerId      String?
  amountMinor     Int
  currency        String
  status          PaymentStatus @default(PENDING)
  gateway         String?
  externalId      String?
  commissionMinor Int?
  metadata        Json?
  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt
  appointment     Appointment?   @relation(fields: [appointmentId], references: [id])
  patient         PatientProfile? @relation(fields: [patientId], references: [id])
  provider        ProviderProfile? @relation("ProviderPayments", fields: [providerId], references: [id])
}

model AuditLog {
  id             String        @id @default(cuid())
  actorId        String?
  organizationId String?
  action         String
  resource       String
  resourceId     String?
  details        Json?
  createdAt      DateTime      @default(now())
  actor          User?         @relation(fields: [actorId], references: [id])
  organization   Organization? @relation(fields: [organizationId], references: [id])
}
PRISMA

cat > "$ROOT/services/api/prisma/seed.ts" <<'TS'
import { PrismaClient, UserRole } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const org = await prisma.organization.upsert({
    where: { id: 'seed-org' },
    update: {},
    create: {
      id: 'seed-org',
      name: 'Care Center Demo Org',
    },
  });

  const passwordHash = await bcrypt.hash('ChangeMe123!', 10);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@carecenter.local' },
    update: {},
    create: {
      email: 'admin@carecenter.local',
      passwordHash,
      firstName: 'System',
      lastName: 'Admin',
      role: UserRole.COMPANY_ADMIN,
      organizationId: org.id,
    },
  });

  const patientUser = await prisma.user.upsert({
    where: { email: 'patient@carecenter.local' },
    update: {},
    create: {
      email: 'patient@carecenter.local',
      passwordHash,
      firstName: 'Demo',
      lastName: 'Patient',
      role: UserRole.PATIENT,
      organizationId: org.id,
      patientProfile: {
        create: {
          organizationId: org.id,
          insuranceNumber: 'INS-1001',
          preferences: {},
        },
      },
    },
    include: { patientProfile: true },
  });

  const providerUser = await prisma.user.upsert({
    where: { email: 'provider@carecenter.local' },
    update: {},
    create: {
      email: 'provider@carecenter.local',
      passwordHash,
      firstName: 'Demo',
      lastName: 'Provider',
      role: UserRole.PROVIDER,
      organizationId: org.id,
      providerProfile: {
        create: {
          organizationId: org.id,
          specialty: 'Family Medicine',
          licenseNumber: 'LIC-1001',
          services: ['Consultation', 'Follow-up'],
        },
      },
    },
    include: { providerProfile: true },
  });

  const appointment = await prisma.appointment.create({
    data: {
      organizationId: org.id,
      patientId: patientUser.patientProfile!.id,
      providerId: providerUser.providerProfile!.id,
      service: 'Initial Consultation',
      location: 'Main Clinic',
      startsAt: new Date(Date.now() + 86400000),
      endsAt: new Date(Date.now() + 90000000),
    },
  });

  await prisma.auditLog.create({
    data: {
      actorId: admin.id,
      organizationId: org.id,
      action: 'seed.completed',
      resource: 'system',
      resourceId: appointment.id,
      details: { seeded: true },
    },
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
TS

cat > "$ROOT/services/api/src/lib/env.ts" <<'TS'
import dotenv from 'dotenv';

dotenv.config();

function required(name: string, fallback?: string) {
  const value = process.env[name] ?? fallback;
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const env = {
  apiPort: Number(process.env.API_PORT ?? 4000),
  databaseUrl: required('DATABASE_URL', 'postgresql://postgres:postgres@localhost:5432/care_center'),
  redisUrl: required('REDIS_URL', 'redis://localhost:6379'),
  jwtAccessSecret: required('JWT_ACCESS_SECRET', 'local-access-secret'),
  jwtRefreshSecret: required('JWT_REFRESH_SECRET', 'local-refresh-secret'),
  jwtAccessTtl: process.env.JWT_ACCESS_TTL ?? '15m',
  jwtRefreshTtl: process.env.JWT_REFRESH_TTL ?? '30d',
  frontendProviderUrl: process.env.FRONTEND_PROVIDER_URL ?? 'http://localhost:3000',
  frontendAdminUrl: process.env.FRONTEND_ADMIN_URL ?? 'http://localhost:3001',
  stripeSecretKey: process.env.STRIPE_SECRET_KEY ?? '',
  telehealthVendor: process.env.TELEHEALTH_VENDOR ?? 'daily',
  dailyApiKey: process.env.DAILY_API_KEY ?? '',
  twilioAccountSid: process.env.TWILIO_ACCOUNT_SID ?? '',
  twilioAuthToken: process.env.TWILIO_AUTH_TOKEN ?? '',
};
TS

cat > "$ROOT/services/api/src/lib/prisma.ts" <<'TS'
import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient();
TS

cat > "$ROOT/services/api/src/lib/http.ts" <<'TS'
import { StatusCodes } from 'http-status-codes';

export class HttpError extends Error {
  statusCode: number;
  details?: unknown;

  constructor(statusCode: number, message: string, details?: unknown) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
  }
}

export function notFound(message = 'Resource not found') {
  return new HttpError(StatusCodes.NOT_FOUND, message);
}

export function forbidden(message = 'Forbidden') {
  return new HttpError(StatusCodes.FORBIDDEN, message);
}

export function unauthorized(message = 'Unauthorized') {
  return new HttpError(StatusCodes.UNAUTHORIZED, message);
}

export function badRequest(message = 'Bad request', details?: unknown) {
  return new HttpError(StatusCodes.BAD_REQUEST, message, details);
}
TS

cat > "$ROOT/services/api/src/lib/audit.ts" <<'TS'
import { prisma } from './prisma';

type AuditInput = {
  actorId?: string;
  organizationId?: string;
  action: string;
  resource: string;
  resourceId?: string;
  details?: unknown;
};

export async function writeAuditLog(input: AuditInput) {
  return prisma.auditLog.create({
    data: {
      actorId: input.actorId,
      organizationId: input.organizationId,
      action: input.action,
      resource: input.resource,
      resourceId: input.resourceId,
      details: (input.details as object | null) ?? undefined,
    },
  });
}
TS

cat > "$ROOT/services/api/src/middleware/error-handler.ts" <<'TS'
import { NextFunction, Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { HttpError } from '../lib/http';

export function errorHandler(error: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (error instanceof HttpError) {
    return res.status(error.statusCode).json({
      error: error.message,
      details: error.details ?? null,
    });
  }

  const message = error instanceof Error ? error.message : 'Internal server error';
  return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
    error: message,
  });
}
TS

cat > "$ROOT/services/api/src/middleware/validate.ts" <<'TS'
import { NextFunction, Request, Response } from 'express';
import { ZodSchema } from 'zod';
import { badRequest } from '../lib/http';

export function validateBody<T>(schema: ZodSchema<T>) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const parsed = schema.safeParse(req.body);

    if (!parsed.success) {
      return next(badRequest('Request body validation failed', parsed.error.flatten()));
    }

    req.body = parsed.data;
    next();
  };
}
TS

cat > "$ROOT/services/api/src/middleware/auth.ts" <<'TS'
import { NextFunction, Request, Response } from 'express';

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

export function attachRequestUserPlaceholder(_req: Request, _res: Response, next: NextFunction) {
  next();
}
TS

cat > "$ROOT/services/api/src/middleware/rbac.ts" <<'TS'
import { NextFunction, Request, Response } from 'express';

export function allowRoles(_roles: string[]) {
  return (_req: Request, _res: Response, next: NextFunction) => {
    next();
  };
}
TS

cat > "$ROOT/services/api/src/modules/health/health.routes.ts" <<'TS'
import { Router } from 'express';
import { prisma } from '../../lib/prisma';

export const healthRouter = Router();

healthRouter.get('/', async (_req, res) => {
  await prisma.$queryRaw`SELECT 1`;
  res.json({ ok: true });
});
TS

cat > "$ROOT/services/api/src/modules/auth/auth.routes.ts" <<'TS'
import { Router } from 'express';

export const authRouter = Router();

authRouter.get('/status', (_req, res) => {
  res.json({ module: 'auth', configured: false });
});
TS

cat > "$ROOT/services/api/src/modules/appointments/appointments.routes.ts" <<'TS'
import { Router } from 'express';

export const appointmentsRouter = Router();

appointmentsRouter.get('/', (_req, res) => {
  res.json({ items: [], note: 'Appointment routes scaffolded. Run step 04 for functional handlers.' });
});
TS

cat > "$ROOT/services/api/src/modules/records/records.routes.ts" <<'TS'
import { Router } from 'express';

export const recordsRouter = Router();

recordsRouter.get('/', (_req, res) => {
  res.json({ items: [], note: 'Records routes scaffolded. Run step 04 for functional handlers.' });
});
TS

cat > "$ROOT/services/api/src/modules/messaging/messaging.routes.ts" <<'TS'
import { Router } from 'express';

export const messagingRouter = Router();

messagingRouter.get('/threads', (_req, res) => {
  res.json({ items: [], note: 'Messaging routes scaffolded. Run step 04 for functional handlers.' });
});
TS

cat > "$ROOT/services/api/src/modules/telehealth/telehealth.routes.ts" <<'TS'
import { Router } from 'express';

export const telehealthRouter = Router();

telehealthRouter.get('/sessions', (_req, res) => {
  res.json({ items: [], note: 'Telehealth routes scaffolded. Run step 04 for functional handlers.' });
});
TS

cat > "$ROOT/services/api/src/modules/payments/payments.routes.ts" <<'TS'
import { Router } from 'express';

export const paymentsRouter = Router();

paymentsRouter.get('/', (_req, res) => {
  res.json({ items: [], note: 'Payments routes scaffolded. Run step 04 for functional handlers.' });
});
TS

cat > "$ROOT/services/api/src/app.ts" <<'TS'
import 'express-async-errors';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import { env } from './lib/env';
import { errorHandler } from './middleware/error-handler';
import { healthRouter } from './modules/health/health.routes';
import { authRouter } from './modules/auth/auth.routes';
import { appointmentsRouter } from './modules/appointments/appointments.routes';
import { recordsRouter } from './modules/records/records.routes';
import { messagingRouter } from './modules/messaging/messaging.routes';
import { telehealthRouter } from './modules/telehealth/telehealth.routes';
import { paymentsRouter } from './modules/payments/payments.routes';

export function createApp() {
  const app = express();

  app.use(
    cors({
      origin: [env.frontendProviderUrl, env.frontendAdminUrl],
      credentials: true,
    }),
  );
  app.use(helmet());
  app.use(morgan('dev'));
  app.use(cookieParser());
  app.use(express.json());

  app.get('/healthz', (_req, res) => res.json({ ok: true }));
  app.use('/api/health', healthRouter);
  app.use('/api/auth', authRouter);
  app.use('/api/appointments', appointmentsRouter);
  app.use('/api/records', recordsRouter);
  app.use('/api/messaging', messagingRouter);
  app.use('/api/telehealth', telehealthRouter);
  app.use('/api/payments', paymentsRouter);

  app.use(errorHandler);

  return app;
}
TS

cat > "$ROOT/services/api/src/index.ts" <<'TS'
import http from 'http';
import { Server } from 'socket.io';
import { createApp } from './app';
import { env } from './lib/env';

const app = createApp();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: [env.frontendProviderUrl, env.frontendAdminUrl],
    credentials: true,
  },
});

io.on('connection', (socket) => {
  socket.on('thread:join', (threadId: string) => {
    socket.join(`thread:${threadId}`);
  });
});

app.use((req, _res, next) => {
  req.io = io;
  next();
});

server.listen(env.apiPort, () => {
  console.log(`API listening on http://localhost:${env.apiPort}`);
});
TS

say "Writing local infrastructure compose file"
cat > "$ROOT/compose.yml" <<'YAML'
services:
  postgres:
    image: postgres:16
    environment:
      POSTGRES_DB: care_center
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    ports:
      - "5432:5432"
    volumes:
      - postgres-data:/var/lib/postgresql/data

  redis:
    image: redis:7
    ports:
      - "6379:6379"

volumes:
  postgres-data:
YAML

say "Backend and contracts scaffolded"
