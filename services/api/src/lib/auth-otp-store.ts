import { mkdirSync, readFileSync, writeFileSync } from 'fs';
import path from 'path';
import { randomInt, randomUUID } from 'crypto';
import { createClient } from 'redis';
import { env } from './env';

export type OtpChannel = 'email' | 'sms' | 'totp';
export type OtpChallengeKind = 'patient_otp' | 'privileged_login';

export type OtpChallenge = {
  id: string;
  kind: OtpChallengeKind;
  identifier: string;
  userId: string;
  role: string;
  organizationId?: string;
  channel: OtpChannel;
  code: string;
  expiresAt: number;
  resendAvailableAt: number;
  attempts: number;
  lockedUntil?: number;
  createdAt: number;
  metadata?: Record<string, unknown>;
};

const OTP_TTL_MS = 5 * 60 * 1000;
const RESEND_WINDOW_MS = 60 * 1000;
const LOCK_WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const STORE_FILE = process.env.AUTH_CHALLENGE_STORE_PATH
  ? path.resolve(process.env.AUTH_CHALLENGE_STORE_PATH)
  : path.join(process.cwd(), '.runtime', 'auth-challenges.json');
const STORE_REDIS_KEY = `${env.authChallengeRedisPrefix}:store`;

const challengesById = new Map<string, OtpChallenge>();
const identifierIndex = new Map<string, string>();

let redisClientPromise: Promise<any | null> | null = null;
let redisUnavailableReason: string | null = null;

function normalizeIdentifier(identifier: string) {
  return identifier.trim().toLowerCase();
}

function compositeKey(kind: OtpChallengeKind, identifier: string) {
  return `${kind}:${normalizeIdentifier(identifier)}`;
}

function generateCode(channel: OtpChannel) {
  if (channel === 'totp') {
    return String(randomInt(0, 1000000)).padStart(6, '0');
  }
  return String(randomInt(0, 1000000)).padStart(6, '0');
}

function serializeStore() {
  return JSON.stringify(
    {
      challenges: Array.from(challengesById.values()),
    },
    null,
    2,
  );
}

function persistFileStore(serialized: string) {
  try {
    mkdirSync(path.dirname(STORE_FILE), { recursive: true });
    writeFileSync(STORE_FILE, serialized, 'utf8');
  } catch {
    // Best-effort persistence only.
  }
}

function readFileStore() {
  try {
    return readFileSync(STORE_FILE, 'utf8');
  } catch {
    return null;
  }
}

async function getRedisClient(): Promise<any | null> {
  if (!env.authChallengeRedisEnabled) {
    return null;
  }
  if (!redisClientPromise) {
    redisClientPromise = (async () => {
      try {
        const client = createClient({
          url: env.redisUrl,
          socket: { connectTimeout: 1000 },
        });
        client.on('error', (error) => {
          redisUnavailableReason = error instanceof Error ? error.message : 'Redis client error';
        });
        await client.connect();
        redisUnavailableReason = null;
        return client;
      } catch (error) {
        redisUnavailableReason = error instanceof Error ? error.message : 'Unable to connect to Redis';
        return null;
      }
    })();
  }
  return redisClientPromise;
}

function clearInMemoryStore() {
  challengesById.clear();
  identifierIndex.clear();
}

function applySerializedStore(raw: string | null) {
  clearInMemoryStore();
  if (!raw) return;
  try {
    const parsed = JSON.parse(raw) as { challenges?: OtpChallenge[] };
    const now = Date.now();
    for (const challenge of parsed.challenges ?? []) {
      const expired = challenge.expiresAt <= now && (!challenge.lockedUntil || challenge.lockedUntil <= now);
      if (expired) continue;
      challengesById.set(challenge.id, challenge);
      identifierIndex.set(compositeKey(challenge.kind, challenge.identifier), challenge.id);
    }
  } catch {
    clearInMemoryStore();
  }
}

async function hydrateStore() {
  const client = await getRedisClient();
  if (client) {
    try {
      const raw = await client.get(STORE_REDIS_KEY);
      applySerializedStore(raw);
      return;
    } catch (error) {
      redisUnavailableReason = error instanceof Error ? error.message : 'Unable to read Redis challenge store';
    }
  }
  applySerializedStore(readFileStore());
}

function cleanupExpired() {
  const now = Date.now();
  for (const [challengeId, challenge] of challengesById.entries()) {
    const expired = challenge.expiresAt <= now && (!challenge.lockedUntil || challenge.lockedUntil <= now);
    if (expired) {
      challengesById.delete(challengeId);
      identifierIndex.delete(compositeKey(challenge.kind, challenge.identifier));
    }
  }
}

async function persistStore() {
  cleanupExpired();
  const serialized = serializeStore();
  persistFileStore(serialized);
  const client = await getRedisClient();
  if (client) {
    try {
      await client.set(STORE_REDIS_KEY, serialized);
    } catch (error) {
      redisUnavailableReason = error instanceof Error ? error.message : 'Unable to write Redis challenge store';
    }
  }
}

async function refreshStore() {
  await hydrateStore();
  cleanupExpired();
}

function issueChallenge(kind: OtpChallengeKind, input: {
  identifier: string;
  userId: string;
  role: string;
  organizationId?: string;
  channel?: OtpChannel;
  metadata?: Record<string, unknown>;
}) {
  const now = Date.now();
  const identifier = normalizeIdentifier(input.identifier);
  const key = compositeKey(kind, identifier);
  const existingId = identifierIndex.get(key);
  const existing = existingId ? challengesById.get(existingId) : null;

  if (existing && existing.resendAvailableAt > now) {
    return {
      challenge: existing,
      isNew: false,
      resendAfterSeconds: Math.ceil((existing.resendAvailableAt - now) / 1000),
      expiresInSeconds: Math.max(0, Math.ceil((existing.expiresAt - now) / 1000)),
    };
  }

  const challenge: OtpChallenge = {
    id: randomUUID(),
    kind,
    identifier,
    userId: input.userId,
    role: input.role,
    organizationId: input.organizationId,
    channel: input.channel ?? 'email',
    code: generateCode(input.channel ?? 'email'),
    expiresAt: now + OTP_TTL_MS,
    resendAvailableAt: now + RESEND_WINDOW_MS,
    attempts: 0,
    createdAt: now,
    metadata: input.metadata,
  };

  if (existingId) {
    challengesById.delete(existingId);
  }
  challengesById.set(challenge.id, challenge);
  identifierIndex.set(key, challenge.id);

  return {
    challenge,
    isNew: true,
    resendAfterSeconds: Math.ceil(RESEND_WINDOW_MS / 1000),
    expiresInSeconds: Math.ceil(OTP_TTL_MS / 1000),
  };
}

function verifyChallenge(challenge: OtpChallenge | null | undefined, code: string) {
  const now = Date.now();
  if (!challenge) {
    return { ok: false as const, reason: 'missing' as const };
  }
  if (challenge.lockedUntil && challenge.lockedUntil > now) {
    return {
      ok: false as const,
      reason: 'locked' as const,
      retryAfterSeconds: Math.ceil((challenge.lockedUntil - now) / 1000),
    };
  }
  if (challenge.expiresAt <= now) {
    challengesById.delete(challenge.id);
    identifierIndex.delete(compositeKey(challenge.kind, challenge.identifier));
    return { ok: false as const, reason: 'expired' as const };
  }
  if (challenge.code !== code.trim()) {
    challenge.attempts += 1;
    if (challenge.attempts >= MAX_ATTEMPTS) {
      challenge.lockedUntil = now + LOCK_WINDOW_MS;
      challenge.resendAvailableAt = challenge.lockedUntil;
      challengesById.set(challenge.id, challenge);
      return {
        ok: false as const,
        reason: 'locked' as const,
        retryAfterSeconds: Math.ceil(LOCK_WINDOW_MS / 1000),
      };
    }
    challengesById.set(challenge.id, challenge);
    return {
      ok: false as const,
      reason: 'invalid' as const,
      attemptsRemaining: MAX_ATTEMPTS - challenge.attempts,
    };
  }

  challengesById.delete(challenge.id);
  identifierIndex.delete(compositeKey(challenge.kind, challenge.identifier));
  return { ok: true as const, challenge };
}

export async function getAuthChallengeStoreMode() {
  const client = await getRedisClient();
  return client ? 'redis+file' : 'file';
}

export function getAuthChallengeStoreHealth() {
  return {
    redisEnabled: env.authChallengeRedisEnabled,
    redisUnavailableReason,
  };
}

export async function issueOtpChallenge(input: {
  identifier: string;
  userId: string;
  role: string;
  organizationId?: string;
  channel?: OtpChannel;
}) {
  await refreshStore();
  const result = issueChallenge('patient_otp', input);
  await persistStore();
  return result;
}

export async function verifyOtpChallenge(identifier: string, code: string) {
  await refreshStore();
  const challengeId = identifierIndex.get(compositeKey('patient_otp', identifier));
  const challenge = challengeId ? challengesById.get(challengeId) : null;
  const result = verifyChallenge(challenge, code);
  await persistStore();
  return result;
}

export async function peekOtpChallenge(identifier: string) {
  await refreshStore();
  const challengeId = identifierIndex.get(compositeKey('patient_otp', identifier));
  return challengeId ? challengesById.get(challengeId) ?? null : null;
}

export async function issuePrivilegedSignInChallenge(input: {
  identifier: string;
  userId: string;
  role: string;
  organizationId?: string;
  channel?: OtpChannel;
  metadata?: Record<string, unknown>;
}) {
  await refreshStore();
  const result = issueChallenge('privileged_login', input);
  await persistStore();
  return result;
}

export async function resendPrivilegedSignInChallenge(challengeId: string) {
  await refreshStore();
  const existing = challengesById.get(challengeId);
  if (!existing || existing.kind !== 'privileged_login') {
    return null;
  }
  const result = issueChallenge('privileged_login', {
    identifier: existing.identifier,
    userId: existing.userId,
    role: existing.role,
    organizationId: existing.organizationId,
    channel: existing.channel,
    metadata: existing.metadata,
  });
  await persistStore();
  return result;
}

export async function verifyPrivilegedSignInChallenge(challengeId: string, code: string) {
  await refreshStore();
  const challenge = challengesById.get(challengeId);
  const result = challenge?.kind !== 'privileged_login'
    ? { ok: false as const, reason: 'missing' as const }
    : verifyChallenge(challenge, code);
  await persistStore();
  return result;
}
