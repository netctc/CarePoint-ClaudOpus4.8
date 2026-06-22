#!/usr/bin/env node
import { spawn } from 'node:child_process';

const apiPort = process.env.API_PORT ?? '4000';
const baseUrl = process.env.API_BASE_URL ?? `http://localhost:${apiPort}`;
const startupTimeoutMs = Number(process.env.API_STARTUP_TIMEOUT_MS ?? 20000);
const smokeTimeoutMs = Number(process.env.SMOKE_TIMEOUT_MS ?? 5000);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithTimeout(url, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function waitForLivez() {
  const started = Date.now();
  let lastError = '';
  while (Date.now() - started < startupTimeoutMs) {
    try {
      const response = await fetchWithTimeout(`${baseUrl}/livez`, 2500);
      if (response.status === 200) return;
      lastError = `status ${response.status}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    await sleep(500);
  }
  throw new Error(`API did not become live within ${startupTimeoutMs}ms. Last error: ${lastError}`);
}

function runSmoke() {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['scripts/s1/smoke-api.mjs'], {
      stdio: 'inherit',
      env: { ...process.env, API_BASE_URL: baseUrl, SMOKE_TIMEOUT_MS: String(smokeTimeoutMs) },
    });
    child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`smoke-api exited with ${code}`))));
    child.on('error', reject);
  });
}

const api = spawn(process.execPath, ['services/api/dist/index.js'], {
  stdio: 'inherit',
  env: { ...process.env, API_PORT: apiPort },
});

let apiExited = false;
api.on('exit', (code, signal) => {
  apiExited = true;
  if (code !== 0 && signal !== 'SIGTERM' && signal !== 'SIGINT') {
    console.error(`API process exited unexpectedly with code=${code} signal=${signal}`);
  }
});

try {
  await waitForLivez();
  await runSmoke();
} finally {
  if (!apiExited) {
    api.kill('SIGTERM');
    await sleep(1000);
    if (!apiExited) api.kill('SIGKILL');
  }
}
