#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const requiredFiles = [
  'services/api/src/index.ts',
  'services/api/src/modules/health/health.routes.ts',
  'scripts/s1/smoke-api.mjs',
  'scripts/s1/ci-api-smoke.mjs',
  '.github/workflows/ci.yml',
];

const failures = [];
for (const file of requiredFiles) {
  if (!fs.existsSync(file)) failures.push(`Missing required S1 file: ${file}`);
}

const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
for (const scriptName of ['prisma:generate', 'smoke:api', 'smoke:api:ci', 'verify:s1']) {
  if (!packageJson.scripts?.[scriptName]) failures.push(`Missing package script: ${scriptName}`);
}

const index = fs.readFileSync('services/api/src/index.ts', 'utf8');
if (!index.includes('export function startServer')) failures.push('services/api/src/index.ts must export startServer for runtime smoke tests.');
if (!index.includes('SIGTERM') || !index.includes('disconnectPrisma')) failures.push('API server must handle graceful shutdown and Prisma disconnect.');

const healthRoutes = fs.readFileSync('services/api/src/modules/health/health.routes.ts', 'utf8');
for (const marker of ['/live', '/ready', '/dependencies']) {
  if (!healthRoutes.includes(marker)) failures.push(`Health router missing ${marker}`);
}

const app = fs.readFileSync('services/api/src/app.ts', 'utf8');
for (const marker of ['/livez', '/readyz', '/healthz']) {
  if (!app.includes(marker)) failures.push(`App missing root health endpoint ${marker}`);
}
if (!app.includes('Route not found')) failures.push('App should return a JSON 404 through the centralized error handler.');

const envExample = fs.readFileSync('.env.example', 'utf8');
if (!envExample.includes('HEALTH_CHECK_TIMEOUT_MS')) failures.push('.env.example must document HEALTH_CHECK_TIMEOUT_MS.');

const ci = fs.readFileSync('.github/workflows/ci.yml', 'utf8');
if (!ci.includes('npm run smoke:api:ci')) failures.push('CI must run API runtime smoke test.');

if (failures.length) {
  console.error('S1 configuration verification failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('S1 configuration verification passed.');
