import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';

function loadEnvFiles() {
  const serviceDir = path.resolve(__dirname, '../..');
  const repoRoot = path.resolve(serviceDir, '../..');
  const candidates = [
    path.join(repoRoot, '.env'),
    path.join(repoRoot, '.env.local'),
    path.join(serviceDir, '.env'),
    path.join(serviceDir, '.env.local'),
  ];

  for (const filePath of candidates) {
    if (fs.existsSync(filePath)) {
      dotenv.config({ path: filePath, override: true });
    }
  }
}

loadEnvFiles();

const isProduction = process.env.NODE_ENV === 'production';

function required(name: string, fallback?: string) {
  const value = process.env[name];
  if (value !== undefined && value !== '') {
    return value;
  }

  if (fallback !== undefined && !isProduction) {
    return fallback;
  }

  throw new Error(`Missing required environment variable: ${name}`);
}

const insecureProductionValues = new Set([
  'replace-me',
  'replace-me-too',
  'local-access-secret',
  'local-refresh-secret',
  'change-me-local-access-secret-min-32-chars',
  'change-me-local-refresh-secret-min-32-chars',
  'change-me-local-medical-key-min-32-chars',
  'local-medical-profile-encryption-key',
]);

function secret(name: string, fallback?: string) {
  const value = required(name, fallback);
  if (isProduction) {
    if (value.length < 32 || insecureProductionValues.has(value)) {
      throw new Error(`${name} must be a unique production secret with at least 32 characters`);
    }
  }
  return value;
}

function asBoolean(name: string, fallback = false) {
  const value = process.env[name];
  if (value === undefined) return fallback;
  return ['1', 'true', 'yes', 'y', 'on'].includes(value.trim().toLowerCase());
}

function asPort(name: string, fallback: number) {
  const raw = process.env[name] ?? String(fallback);
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1 || value > 65535) {
    throw new Error(`${name} must be a valid TCP port number. Received: ${raw}`);
  }
  return value;
}

function asPositiveInteger(name: string, fallback: number) {
  const raw = process.env[name] ?? String(fallback);
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`${name} must be a positive integer. Received: ${raw}`);
  }
  return value;
}

function asIntegerRange(name: string, fallback: number, min: number, max: number) {
  const raw = process.env[name] ?? String(fallback);
  const value = Number(raw);
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${name} must be an integer between ${min} and ${max}. Received: ${raw}`);
  }
  return value;
}

function parseList(value?: string) {
  if (!value) return [] as string[];
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function unique(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

function validateHttpUrl(name: string, value: string) {
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new Error('unsupported protocol');
    }
    return value;
  } catch {
    throw new Error(`${name} must be a valid http(s) URL. Received: ${value}`);
  }
}

const frontendProviderUrl = validateHttpUrl('FRONTEND_PROVIDER_URL', process.env.FRONTEND_PROVIDER_URL ?? 'http://localhost:3000');
const frontendAdminUrl = validateHttpUrl('FRONTEND_ADMIN_URL', process.env.FRONTEND_ADMIN_URL ?? 'http://localhost:3001');
const frontendPatientUrl = validateHttpUrl('FRONTEND_PATIENT_URL', process.env.FRONTEND_PATIENT_URL ?? 'http://localhost:3002');
const frontendProviderMobileUrl = validateHttpUrl('FRONTEND_PROVIDER_MOBILE_URL', process.env.FRONTEND_PROVIDER_MOBILE_URL ?? 'http://localhost:8081');
const allowedCorsOrigins = unique([
  frontendProviderUrl,
  frontendAdminUrl,
  frontendPatientUrl,
  frontendProviderMobileUrl,
  ...parseList(process.env.FRONTEND_ALLOWED_ORIGINS).map((origin) => validateHttpUrl('FRONTEND_ALLOWED_ORIGINS', origin)),
]);

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  isProduction,
  apiPort: asPort('API_PORT', 4000),
  healthCheckTimeoutMs: asPositiveInteger('HEALTH_CHECK_TIMEOUT_MS', 2500),
  databaseUrl: required('DATABASE_URL', 'postgresql://postgres:postgres@localhost:5432/care_center'),
  directUrl: process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/care_center',
  redisUrl: required('REDIS_URL', 'redis://localhost:6379'),
  jwtAccessSecret: secret('JWT_ACCESS_SECRET', 'local-access-secret'),
  jwtRefreshSecret: secret('JWT_REFRESH_SECRET', 'local-refresh-secret'),
  jwtAccessTtl: process.env.JWT_ACCESS_TTL ?? '15m',
  jwtRefreshTtl: process.env.JWT_REFRESH_TTL ?? '30d',
  frontendProviderUrl,
  frontendAdminUrl,
  frontendPatientUrl,
  frontendProviderMobileUrl,
  frontendAllowedOrigins: allowedCorsOrigins,
  allowLocalhostCorsWildcard: asBoolean('ALLOW_LOCALHOST_CORS_WILDCARD', !isProduction),
  stripeSecretKey: process.env.STRIPE_SECRET_KEY ?? '',
  telehealthVendor: process.env.TELEHEALTH_VENDOR ?? 'daily',
  dailyApiKey: process.env.DAILY_API_KEY ?? '',
  twilioAccountSid: process.env.TWILIO_ACCOUNT_SID ?? '',
  twilioAuthToken: process.env.TWILIO_AUTH_TOKEN ?? '',
  medicalProfileEncryptionKey: secret('MEDICAL_PROFILE_ENCRYPTION_KEY', 'local-medical-profile-encryption-key'),
  authChallengeRedisEnabled: asBoolean('AUTH_CHALLENGE_REDIS_ENABLED', false),
  authChallengeRedisPrefix: process.env.AUTH_CHALLENGE_REDIS_PREFIX ?? 'carepoint:auth:challenge',
  privilegedAllowedEmailDomains: process.env.PRIVILEGED_ALLOWED_EMAIL_DOMAINS ?? '',
  ssoEnabled: asBoolean('SSO_ENABLED', false),
  ssoProviderName: process.env.SSO_PROVIDER_NAME ?? 'Enterprise SSO',
  ssoAuthorizeUrl: process.env.SSO_AUTHORIZE_URL ?? '',
  ssoClientId: process.env.SSO_CLIENT_ID ?? '',
  ssoCallbackUrl: process.env.SSO_CALLBACK_URL ?? '',
  ssoScope: process.env.SSO_SCOPE ?? 'openid profile email',
  pythonServicesBaseUrl: validateHttpUrl('PYTHON_SERVICES_BASE_URL', process.env.PYTHON_SERVICES_BASE_URL ?? 'http://localhost:8010'),
  pythonServicesSharedSecret: process.env.PYTHON_SERVICES_SHARED_SECRET ?? '',
  pythonServicesTimeoutMs: asIntegerRange('PYTHON_SERVICES_TIMEOUT_MS', 2500, 250, 30000),
  pythonServicesSignRequests: asBoolean('PYTHON_SERVICES_SIGN_REQUESTS', true),
  pythonServicesUseHmacSignature: asBoolean('PYTHON_SERVICES_USE_HMAC_SIGNATURE', Boolean(process.env.PYTHON_SERVICES_SHARED_SECRET)),
  hybridPythonEnabled: asBoolean('HYBRID_PYTHON_ENABLED', false),
  hybridPythonCanaryPercent: asIntegerRange('HYBRID_PYTHON_CANARY_PERCENT', 0, 0, 100),
  hybridPythonShadowMode: asBoolean('HYBRID_PYTHON_SHADOW_MODE', true),
  hybridPythonShadowFailOpen: asBoolean('HYBRID_PYTHON_SHADOW_FAIL_OPEN', true),
  hybridPythonUseControlPlaneAssignment: asBoolean('HYBRID_PYTHON_USE_CONTROL_PLANE_ASSIGNMENT', false),
  hybridPythonControlPlaneFailOpen: asBoolean('HYBRID_PYTHON_CONTROL_PLANE_FAIL_OPEN', false),
  hybridPythonDefaultRoute: process.env.HYBRID_PYTHON_DEFAULT_ROUTE ?? '/api/hybrid-python/jobs',
};
