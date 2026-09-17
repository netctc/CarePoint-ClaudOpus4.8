import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const read = (path) => readFileSync(path, 'utf8');
const compose = read('deploy/vps/docker-compose.yml');
const deploy = read('deploy/vps/deploy.sh');
const caddy = read('deploy/vps/Caddyfile');
const preflight = read('deploy/vps/preflight.sh');
const healthReport = read('deploy/vps/health-report.sh');
const adminBoundary = read('apps/admin/src/lib/api/admin-server.ts');
const appSource = read('services/api/src/app.ts');
const authRoutes = read('services/api/src/modules/auth/auth.routes.ts');
const incidentRunbook = read('docs/release/V1_INCIDENT_RUNBOOK.md');
const loadHarnessPath = 'scripts/release/pilot-load.mjs';
const loadHarness = read(loadHarnessPath);
const performanceRunbook = read('docs/release/V1_PERFORMANCE_RESILIENCE_RUNBOOK.md');

const checks = [];
const assert = (condition, message) => {
  checks.push({ passed: Boolean(condition), message });
};

assert(/\bedge:\s*[\s\S]*?image:\s*caddy:/m.test(compose), 'Caddy edge service is defined');
assert(/80:80/.test(compose) && /443:443/.test(compose), 'edge publishes HTTP/HTTPS');

for (const service of ['api', 'admin', 'provider', 'patient-web', 'provider-mobile-web']) {
  const escapedService = service.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`\\n  ${escapedService}:([\\s\\S]*?)(?=\\n  [A-Za-z0-9_-]+:|\\nvolumes:)`);
  const block = compose.match(pattern)?.[1] ?? '';
  assert(block.length > 0, `${service} service exists`);
  assert(!/\n\s+ports:\s*\n/.test(block), `${service} does not publish host ports directly`);
}

for (const hostVar of [
  'CAREPOINT_API_HOST',
  'CAREPOINT_ADMIN_HOST',
  'CAREPOINT_PROVIDER_HOST',
  'CAREPOINT_PATIENT_HOST',
  'CAREPOINT_PROVIDER_MOBILE_HOST',
]) {
  assert(caddy.includes(`{$${hostVar}}`), `Caddy routes ${hostVar}`);
  assert(preflight.includes(hostVar), `preflight validates ${hostVar}`);
}

assert(deploy.includes('ALLOW_LOCALHOST_CORS_WILDCARD=false'), 'deploy disables localhost CORS wildcard');
assert(deploy.includes('ALLOW_AUDIT_FALLBACK_IN_PRODUCTION=false'), 'deploy disables production audit fallback');
assert(deploy.includes('NEXT_PUBLIC_ALLOW_DEMO_SIGNIN=false'), 'deploy disables demo sign-in');
assert(deploy.includes('ADMIN_ALLOW_MOCK_DATA=false'), 'deploy disables Admin mock data');
assert(preflight.includes('require_exact ADMIN_ALLOW_MOCK_DATA false'), 'preflight requires Admin live-data mode');
assert(compose.includes('ADMIN_ALLOW_MOCK_DATA: ${ADMIN_ALLOW_MOCK_DATA:-false}'), 'Admin container defaults to live-data mode');
assert(adminBoundary.includes("tagged.source === 'mock'"), 'Admin release boundary rejects mock loader results');
assert(adminBoundary.includes("process.env.ADMIN_ALLOW_MOCK_DATA === 'true'"), 'Admin mock override is explicit');
assert(deploy.includes('EXPECTED_RELEASE_SHA'), 'deploy supports immutable SHA pinning');
assert(preflight.includes('EXPECTED_RELEASE_SHA is required'), 'preflight requires immutable SHA pinning');
assert(preflight.includes('docker compose') && preflight.includes('config --quiet'), 'preflight validates compose configuration');

assert(preflight.includes('validate_email_provider'), 'preflight requires a real OTP email provider');
assert(preflight.includes('validate_privileged_domains'), 'preflight requires an explicit privileged email-domain allowlist');
assert(authRoutes.includes("secure: process.env.NODE_ENV === 'production'"), 'production auth cookies use Secure');

assert(
  appSource.includes("? morgan(':method :status :response-time ms - :res[content-length]')") &&
    appSource.includes(": morgan('dev')"),
  'production access logs omit URL and query strings',
);
assert(!appSource.includes('Route not found: ${req.method} ${req.originalUrl}'), '404 responses do not echo query strings');

assert(healthReport.includes("restart_count=$(docker inspect --format '{{.RestartCount}}'"), 'health report records container restart counts');
assert(healthReport.includes("oom_killed=$(docker inspect --format '{{.State.OOMKilled}}'"), 'health report records container OOM state');
assert(healthReport.includes("echo 'host_resources:'"), 'health report includes host resource pressure');
assert(healthReport.includes('MEMORY_CRITICAL_PERCENT') && healthReport.includes('DISK_CRITICAL_PERCENT'), 'health report enforces memory and disk critical thresholds');

assert(incidentRunbook.includes('## 2. Severity model'), 'incident runbook defines severity model');
assert(incidentRunbook.includes('## 4. First 10 minutes'), 'incident runbook defines first-response triage');
assert(incidentRunbook.includes('## 6. Containment and rollback'), 'incident runbook defines containment and rollback');
assert(incidentRunbook.includes('Never include in operational logs/incident notes'), 'incident runbook defines PHI/secret logging restrictions');
assert(incidentRunbook.includes('TBD — required before Go/No-Go'), 'incident runbook keeps missing operational ownership as an explicit release blocker');

let loadHarnessSyntaxValid = true;
try {
  execFileSync(process.execPath, ['--check', loadHarnessPath], { stdio: 'pipe' });
} catch {
  loadHarnessSyntaxValid = false;
}
assert(loadHarnessSyntaxValid, 'pilot load harness parses successfully under the current Node runtime');
assert(loadHarness.includes("parseRate('CAREPOINT_LOAD_MAX_ERROR_RATE')"), 'load harness requires predeclared error-rate acceptance');
assert(loadHarness.includes("parsePositiveNumber('CAREPOINT_LOAD_MAX_P95_MS')"), 'load harness requires predeclared p95 acceptance');
assert(loadHarness.includes("parseIntBounded('CAREPOINT_LOAD_MAX_5XX'"), 'load harness gates 5xx count');
assert(loadHarness.includes("'find-care'") && loadHarness.includes("'/api/providers'"), 'load harness covers Find Care read pressure');
assert(loadHarness.includes("'patient-dashboard'") && loadHarness.includes("'/api/dashboard/patient'"), 'load harness covers patient dashboard read pressure');
assert(loadHarness.includes("'booking-summary'") && loadHarness.includes("'/api/bookings/summary'"), 'load harness covers booking read pressure');
assert(loadHarness.includes("'session-refresh'") && loadHarness.includes("'/api/auth/refresh'"), 'load harness covers auth/session refresh pressure without bulk OTP delivery');
assert(loadHarness.includes('Sensitive headers, tokens, request bodies and response bodies are never printed.'), 'load harness explicitly preserves sensitive-data output boundary');
assert(!loadHarness.includes('console.log(patientToken)') && !loadHarness.includes('console.log(staffToken)') && !loadHarness.includes('console.log(refreshToken)'), 'load harness does not print configured tokens');

assert(performanceRunbook.includes('## Controlled resilience exercises'), 'performance runbook defines controlled resilience exercises');
assert(performanceRunbook.includes('## Rollback drill'), 'performance runbook defines rollback evidence');
assert(performanceRunbook.includes('acceptance thresholds agreed **before** the load run'), 'performance runbook requires predeclared acceptance thresholds');
assert(performanceRunbook.includes('synthetic/test accounts only'), 'performance runbook prohibits real PHI test accounts');

const forbiddenFirewallRules = ['API_PORT', 'ADMIN_PORT', 'PROVIDER_PORT', 'PATIENT_PORT', 'PROVIDER_MOBILE_PORT']
  .filter((name) => deploy.includes('ufw allow ${' + name + '}'));
assert(forbiddenFirewallRules.length === 0, 'deploy does not open application ports in UFW');

const failed = checks.filter((check) => !check.passed);
for (const check of checks) {
  console.log(`${check.passed ? 'PASS' : 'FAIL'} ${check.message}`);
}

if (failed.length > 0) {
  console.error(`Release deployment verification failed: ${failed.length}/${checks.length} checks failed.`);
  process.exit(1);
}

console.log(`Release deployment verification passed: ${checks.length}/${checks.length} checks.`);
