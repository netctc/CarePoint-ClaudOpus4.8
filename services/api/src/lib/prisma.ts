const { PrismaClient } = require('@prisma/client') as { PrismaClient: new (...args: any[]) => any };
import { env } from './env';
import { OperationTimeoutError, withTimeout } from '../utils/withTimeout';

const globalForPrisma = globalThis as typeof globalThis & { prisma?: any };

function withConnectionTuning(url: string) {
  try {
    const parsed = new URL(url);
    const isSupabaseSessionPooler = parsed.hostname.includes('pooler.supabase.com') && parsed.port === '5432';

    if (isSupabaseSessionPooler) {
      if (!parsed.searchParams.has('connection_limit')) {
        parsed.searchParams.set('connection_limit', process.env.PRISMA_CONNECTION_LIMIT ?? '1');
      }
      if (!parsed.searchParams.has('pool_timeout')) {
        parsed.searchParams.set('pool_timeout', process.env.PRISMA_POOL_TIMEOUT ?? '30');
      }
      if (!parsed.searchParams.has('connect_timeout')) {
        parsed.searchParams.set('connect_timeout', process.env.PRISMA_CONNECT_TIMEOUT ?? '30');
      }
    }

    return parsed.toString();
  } catch {
    return url;
  }
}

function createPrismaClient() {
  const url = env.databaseUrl;
  return new PrismaClient(
    url
      ? {
          datasources: {
            db: {
              url: withConnectionTuning(url),
            },
          },
        }
      : undefined,
  );
}

export const prisma: any = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export function getPrismaErrorCode(error: unknown) {
  if (error && typeof error === 'object' && 'code' in error && typeof (error as { code?: unknown }).code === 'string') {
    return (error as { code: string }).code;
  }
  return null;
}

export function isDatabaseUnavailableError(error: unknown) {
  const code = getPrismaErrorCode(error);
  if (code === 'P1001' || code === 'P1002' || code === 'P1017' || code === 'P2024') {
    return true;
  }

  if (error instanceof OperationTimeoutError) {
    return true;
  }

  const message = error instanceof Error ? error.message : String(error ?? '');
  return (
    message.includes("Can't reach database server") ||
    message.includes('Server has closed the connection') ||
    message.includes('MaxClientsInSessionMode') ||
    message.includes('max clients reached') ||
    message.includes('Timed out fetching a new connection from the connection pool') ||
    message.includes('Database health check exceeded')
  );
}

export async function getDatabaseHealth() {
  try {
    await withTimeout(prisma.$queryRaw`SELECT 1`, env.healthCheckTimeoutMs, 'Database health check');
    return {
      ok: true,
      code: null,
      message: 'Database reachable',
    };
  } catch (error) {
    return {
      ok: false,
      code: getPrismaErrorCode(error),
      message: error instanceof Error ? error.message : 'Database check failed',
    };
  }
}

export async function disconnectPrisma() {
  if (typeof prisma.$disconnect === 'function') {
    await prisma.$disconnect();
  }
}
