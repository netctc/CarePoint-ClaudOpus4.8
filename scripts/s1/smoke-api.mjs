#!/usr/bin/env node
const baseUrl = process.env.API_BASE_URL ?? 'http://localhost:4000';
const timeoutMs = Number(process.env.SMOKE_TIMEOUT_MS ?? 5000);
const endpoints = [
  { path: '/livez', allowedStatuses: [200], json: true, requiresDatabase: false },
  { path: '/readyz', allowedStatuses: [200, 503], json: true, requiresDatabase: true },
  { path: '/healthz', allowedStatuses: [200, 503], json: true, requiresDatabase: true },
  { path: '/api/health/live', allowedStatuses: [200], json: true, requiresDatabase: false },
  { path: '/api/health/ready', allowedStatuses: [200, 503], json: true, requiresDatabase: true },
];

async function fetchWithTimeout(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

const results = [];
for (const endpoint of endpoints) {
  const url = `${baseUrl}${endpoint.path}`;
  try {
    const response = await fetchWithTimeout(url);
    const contentType = response.headers.get('content-type') ?? '';
    const body = endpoint.json && contentType.includes('application/json') ? await response.json() : await response.text();
    const okStatus = endpoint.allowedStatuses.includes(response.status);
    const okShape = typeof body === 'object' && body !== null && 'ok' in body;
    results.push({ url, status: response.status, ok: okStatus && okShape, body });
  } catch (error) {
    results.push({ url, status: 0, ok: false, error: error instanceof Error ? error.message : String(error) });
  }
}

for (const result of results) {
  console.log(`${result.ok ? 'PASS' : 'FAIL'} ${result.status} ${result.url}`);
}

if (results.some((result) => !result.ok)) {
  console.error('API smoke test failed. Start the API first with npm run dev:api, then rerun npm run smoke:api.');
  process.exit(1);
}

const readiness = results.find((result) => result.url.endsWith('/readyz'));
if (readiness?.status === 503) {
  console.warn('WARN readiness returned 503. API process is alive, but at least one dependency is not ready.');
}

console.log('API smoke test passed.');
