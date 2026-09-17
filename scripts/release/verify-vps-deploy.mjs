import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(path, 'utf8');
const compose = read('deploy/vps/docker-compose.yml');
const deploy = read('deploy/vps/deploy.sh');
const caddy = read('deploy/vps/Caddyfile');
const preflight = read('deploy/vps/preflight.sh');
const adminBoundary = read('apps/admin/src/lib/api/admin-server.ts');

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
