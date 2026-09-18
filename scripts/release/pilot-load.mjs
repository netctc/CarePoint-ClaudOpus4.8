#!/usr/bin/env node

const env = process.env;

function fail(message) {
  console.error(`LOAD HARNESS FAILED: ${message}`);
  process.exit(2);
}

function parseIntBounded(name, fallback, min, max) {
  const raw = env[name];
  const value = raw == null || raw === '' ? fallback : Number(raw);
  if (!Number.isInteger(value) || value < min || value > max) {
    fail(`${name} must be an integer between ${min} and ${max}`);
  }
  return value;
}

function parseRate(name) {
  const raw = env[name];
  if (raw == null || raw === '') fail(`${name} must be defined before the staging run`);
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0 || value > 1) fail(`${name} must be between 0 and 1`);
  return value;
}

function parsePositiveNumber(name) {
  const raw = env[name];
  if (raw == null || raw === '') fail(`${name} must be defined before the staging run`);
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) fail(`${name} must be greater than 0`);
  return value;
}

function parsePath(name, fallback) {
  const raw = String(env[name] ?? fallback).trim();
  if (!raw.startsWith('/') || raw.startsWith('//') || raw.includes('://')) {
    fail(`${name} must be an API path beginning with /`);
  }
  return raw;
}

function redactPath(path) {
  return path.split('?')[0];
}

const baseUrlRaw = String(env.CAREPOINT_LOAD_BASE_URL ?? '').trim();
if (!baseUrlRaw) fail('CAREPOINT_LOAD_BASE_URL is required');

let baseUrl;
try {
  baseUrl = new URL(baseUrlRaw);
} catch {
  fail('CAREPOINT_LOAD_BASE_URL must be a valid absolute URL');
}

const allowLocal = env.CAREPOINT_LOAD_ALLOW_LOCAL === 'true';
if (baseUrl.protocol !== 'https:' && !allowLocal) {
  fail('CAREPOINT_LOAD_BASE_URL must use https:// unless CAREPOINT_LOAD_ALLOW_LOCAL=true');
}
if (!allowLocal && ['localhost', '127.0.0.1', '::1'].includes(baseUrl.hostname)) {
  fail('local targets require CAREPOINT_LOAD_ALLOW_LOCAL=true');
}

const durationSeconds = parseIntBounded('CAREPOINT_LOAD_DURATION_SECONDS', 60, 10, 900);
const concurrency = parseIntBounded('CAREPOINT_LOAD_CONCURRENCY', 4, 1, 50);
const timeoutMs = parseIntBounded('CAREPOINT_LOAD_TIMEOUT_MS', 10000, 1000, 60000);
const maxErrorRate = parseRate('CAREPOINT_LOAD_MAX_ERROR_RATE');
const maxP95Ms = parsePositiveNumber('CAREPOINT_LOAD_MAX_P95_MS');
const max5xx = parseIntBounded('CAREPOINT_LOAD_MAX_5XX', 0, 0, 1000000);

const requestedScenarioNames = String(env.CAREPOINT_LOAD_SCENARIOS ?? 'health')
  .split(',')
  .map((value) => value.trim().toLowerCase())
  .filter(Boolean);

const supportedScenarios = new Set([
  'health',
  'find-care',
  'patient-dashboard',
  'booking-summary',
  'session-refresh',
]);
for (const name of requestedScenarioNames) {
  if (!supportedScenarios.has(name)) fail(`unsupported scenario: ${name}`);
}

const patientToken = String(env.CAREPOINT_LOAD_PATIENT_TOKEN ?? '').trim();
const staffToken = String(env.CAREPOINT_LOAD_STAFF_TOKEN ?? '').trim();
const refreshToken = String(env.CAREPOINT_LOAD_REFRESH_TOKEN ?? '').trim();

const requests = [];
function addRequest(definition) {
  requests.push(definition);
}

if (requestedScenarioNames.includes('health')) {
  addRequest({ label: 'health_livez', method: 'GET', path: parsePath('CAREPOINT_LOAD_LIVEZ_PATH', '/livez') });
  addRequest({ label: 'health_readyz', method: 'GET', path: parsePath('CAREPOINT_LOAD_READYZ_PATH', '/readyz') });
}

if (requestedScenarioNames.includes('find-care')) {
  if (!patientToken) fail('CAREPOINT_LOAD_PATIENT_TOKEN is required for find-care');
  addRequest({
    label: 'find_care',
    method: 'GET',
    path: parsePath('CAREPOINT_LOAD_FIND_CARE_PATH', '/api/providers'),
    bearerToken: patientToken,
  });
}

if (requestedScenarioNames.includes('patient-dashboard')) {
  if (!patientToken) fail('CAREPOINT_LOAD_PATIENT_TOKEN is required for patient-dashboard');
  addRequest({
    label: 'patient_dashboard',
    method: 'GET',
    path: parsePath('CAREPOINT_LOAD_PATIENT_DASHBOARD_PATH', '/api/dashboard/patient'),
    bearerToken: patientToken,
  });
}

if (requestedScenarioNames.includes('booking-summary')) {
  if (!staffToken) fail('CAREPOINT_LOAD_STAFF_TOKEN is required for booking-summary');
  addRequest({
    label: 'booking_summary',
    method: 'GET',
    path: parsePath('CAREPOINT_LOAD_BOOKING_SUMMARY_PATH', '/api/bookings/summary'),
    bearerToken: staffToken,
  });
}

if (requestedScenarioNames.includes('session-refresh')) {
  if (!refreshToken) fail('CAREPOINT_LOAD_REFRESH_TOKEN is required for session-refresh');
  addRequest({
    label: 'session_refresh',
    method: 'POST',
    path: parsePath('CAREPOINT_LOAD_REFRESH_PATH', '/api/auth/refresh'),
    jsonBody: { refreshToken },
  });
}

if (requests.length === 0) fail('at least one load scenario is required');

function percentile(values, p) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[index];
}

function newStats(label) {
  return {
    label,
    count: 0,
    success: 0,
    errors: 0,
    server5xx: 0,
    client4xx: 0,
    transportErrors: 0,
    latenciesMs: [],
  };
}

const stats = new Map(requests.map((request) => [request.label, newStats(request.label)]));
let sequence = 0;
const deadline = Date.now() + durationSeconds * 1000;

async function executeRequest(definition) {
  const scenarioStats = stats.get(definition.label);
  const headers = { Accept: 'application/json' };
  if (definition.bearerToken) headers.Authorization = `Bearer ${definition.bearerToken}`;
  if (definition.jsonBody) headers['Content-Type'] = 'application/json';

  const started = performance.now();
  scenarioStats.count += 1;
  try {
    const response = await fetch(new URL(definition.path, baseUrl), {
      method: definition.method,
      headers,
      body: definition.jsonBody ? JSON.stringify(definition.jsonBody) : undefined,
      signal: AbortSignal.timeout(timeoutMs),
      redirect: 'error',
    });
    const elapsed = performance.now() - started;
    scenarioStats.latenciesMs.push(elapsed);

    // Consume and discard without printing response bodies. Pilot responses may
    // contain patient/provider data and must never become benchmark output.
    await response.arrayBuffer();

    if (response.status >= 500) {
      scenarioStats.server5xx += 1;
      scenarioStats.errors += 1;
    } else if (response.status >= 400) {
      scenarioStats.client4xx += 1;
      scenarioStats.errors += 1;
    } else {
      scenarioStats.success += 1;
    }
  } catch {
    scenarioStats.latenciesMs.push(performance.now() - started);
    scenarioStats.transportErrors += 1;
    scenarioStats.errors += 1;
  }
}

async function worker() {
  while (Date.now() < deadline) {
    const request = requests[sequence % requests.length];
    sequence += 1;
    await executeRequest(request);
  }
}

console.log('CarePoint staging pilot load harness');
console.log(`target_origin=${baseUrl.origin}`);
console.log(`duration_seconds=${durationSeconds}`);
console.log(`concurrency=${concurrency}`);
console.log(`scenario_labels=${requests.map((item) => item.label).join(',')}`);
console.log(`acceptance_max_error_rate=${maxErrorRate}`);
console.log(`acceptance_max_p95_ms=${maxP95Ms}`);
console.log(`acceptance_max_5xx=${max5xx}`);
console.log('Sensitive headers, tokens, request bodies and response bodies are never printed.');

const wallStarted = performance.now();
await Promise.all(Array.from({ length: concurrency }, () => worker()));
const wallSeconds = Math.max((performance.now() - wallStarted) / 1000, 0.001);

let totalCount = 0;
let totalErrors = 0;
let total5xx = 0;
let failed = false;

for (const scenarioStats of stats.values()) {
  totalCount += scenarioStats.count;
  totalErrors += scenarioStats.errors;
  total5xx += scenarioStats.server5xx;
  const errorRate = scenarioStats.count === 0 ? 1 : scenarioStats.errors / scenarioStats.count;
  const p50 = percentile(scenarioStats.latenciesMs, 50);
  const p95 = percentile(scenarioStats.latenciesMs, 95);
  const max = scenarioStats.latenciesMs.length ? Math.max(...scenarioStats.latenciesMs) : 0;

  const scenarioFailed = errorRate > maxErrorRate || p95 > maxP95Ms || scenarioStats.server5xx > max5xx;
  failed ||= scenarioFailed;

  console.log(JSON.stringify({
    scenario: scenarioStats.label,
    requests: scenarioStats.count,
    success: scenarioStats.success,
    errors: scenarioStats.errors,
    errorRate: Number(errorRate.toFixed(4)),
    http4xx: scenarioStats.client4xx,
    http5xx: scenarioStats.server5xx,
    transportErrors: scenarioStats.transportErrors,
    p50Ms: Number(p50.toFixed(1)),
    p95Ms: Number(p95.toFixed(1)),
    maxMs: Number(max.toFixed(1)),
    passed: !scenarioFailed,
  }));
}

const totalErrorRate = totalCount === 0 ? 1 : totalErrors / totalCount;
console.log(JSON.stringify({
  summary: true,
  requests: totalCount,
  requestsPerSecond: Number((totalCount / wallSeconds).toFixed(2)),
  errors: totalErrors,
  errorRate: Number(totalErrorRate.toFixed(4)),
  http5xx: total5xx,
  passed: !failed,
}));

if (failed) {
  console.error('Pilot load acceptance thresholds were not met.');
  process.exit(1);
}

console.log('Pilot load acceptance thresholds passed.');
