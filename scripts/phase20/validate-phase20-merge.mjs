#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = path.resolve(process.argv[2] || process.cwd());
const outDir = path.join(root, 'docs', 'validation');
const now = new Date().toISOString();

function rel(p) {
  return path.relative(root, p).replaceAll(path.sep, '/');
}

function exists(relativePath) {
  return fs.existsSync(path.join(root, relativePath));
}

function read(relativePath) {
  const full = path.join(root, relativePath);
  return fs.existsSync(full) ? fs.readFileSync(full, 'utf8') : '';
}

function listDirs(relativePath) {
  const full = path.join(root, relativePath);
  if (!fs.existsSync(full)) return [];
  return fs.readdirSync(full, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
}

function parseJson(relativePath) {
  try {
    return JSON.parse(read(relativePath));
  } catch {
    return null;
  }
}

function major(version) {
  if (!version || typeof version !== 'string') return null;
  const match = version.match(/(\d+)/);
  return match ? Number(match[1]) : null;
}

function addCheck(checks, id, title, severity, passed, detail, recommendation = '') {
  checks.push({ id, title, severity, passed: Boolean(passed), detail, recommendation });
}

const checks = [];

// Core files expected after phases 1-19.
const requiredFiles = [
  ['ADMIN_ACCOUNTS_PAGE', 'Admin patient/provider account governance page', 'apps/admin/src/app/portal/accounts/page.tsx'],
  ['ADMIN_ORGS_PAGE', 'Admin organization management page', 'apps/admin/src/app/portal/organizations/page.tsx'],
  ['ADMIN_AUDIT_LOGS_PAGE', 'Admin audit logs page', 'apps/admin/src/app/portal/audit/logs/page.tsx'],
  ['ADMIN_AUDIT_EXPORT_PROXY', 'Admin filtered audit export proxy', 'apps/admin/src/app/portal/audit/logs/export/route.ts'],
  ['ADMIN_USERS_ROUTES', 'Backend admin-users route module', 'services/api/src/modules/admin-users/admin-users.routes.ts'],
  ['PRISMA_SCHEMA', 'Prisma schema', 'services/api/prisma/schema.prisma'],
  ['PROVIDER_ROOT_REDIRECT', 'Provider root route', 'apps/provider/app/page.tsx'],
  ['PROVIDER_SIGNIN_PAGE', 'Provider sign-in page', 'apps/provider/app/sign-in/page.tsx'],
  ['PROVIDER_SIGNIN_FORM', 'Provider sign-in form', 'apps/provider/app/sign-in/sign-in-form.tsx'],
  ['PROVIDER_TOP_HEADER', 'Provider portal top header', 'apps/provider/components/layout/top-header.tsx'],
  ['PROVIDER_API_CLIENT', 'Provider API client', 'apps/provider/services/api-client.ts'],
];

for (const [id, title, file] of requiredFiles) {
  addCheck(checks, id, title, 'error', exists(file), file, `Apply the missing phase patch that provides ${file}.`);
}

const schema = read('services/api/prisma/schema.prisma');
const adminRoutes = read('services/api/src/modules/admin-users/admin-users.routes.ts');
const providerRoot = read('apps/provider/app/page.tsx');
const providerHeader = read('apps/provider/components/layout/top-header.tsx');
const providerApiClient = read('apps/provider/services/api-client.ts');
const providerSigninForm = read('apps/provider/app/sign-in/sign-in-form.tsx');
const accountsPage = read('apps/admin/src/app/portal/accounts/page.tsx');
const orgsPage = read('apps/admin/src/app/portal/organizations/page.tsx');
const auditPage = read('apps/admin/src/app/portal/audit/logs/page.tsx');

// Prisma model and enum checks.
const schemaTokens = [
  ['PRISMA_ACCOUNT_STATUS', 'Account lifecycle enum', /enum\s+AccountStatus\s*{[\s\S]*ACTIVE[\s\S]*SUSPENDED[\s\S]*ARCHIVED[\s\S]*}/],
  ['PRISMA_ONBOARDING_STATUS', 'Provider onboarding status enum', /enum\s+ProviderOnboardingStatus\s*{[\s\S]*READY_FOR_REVIEW[\s\S]*APPROVED[\s\S]*REJECTED[\s\S]*}/],
  ['PRISMA_CREDENTIAL_DOCUMENT', 'ProviderCredentialDocument model', /model\s+ProviderCredentialDocument\s*{/],
  ['PRISMA_REVIEW_TASK', 'ProviderCredentialReviewTask model', /model\s+ProviderCredentialReviewTask\s*{/],
  ['PRISMA_NOTIFICATION', 'ProviderCredentialNotification model', /model\s+ProviderCredentialNotification\s*{/],
  ['PRISMA_PROVIDER_RELATIONS', 'Provider profile credential relations', /model\s+ProviderProfile\s*{[\s\S]*credentialDocuments[\s\S]*credentialReviewTasks[\s\S]*credentialNotifications[\s\S]*}/],
  ['PRISMA_ORG_RELATIONS', 'Organization credential governance relations', /model\s+Organization\s*{[\s\S]*providerCredentialDocuments[\s\S]*providerCredentialReviewTasks[\s\S]*providerCredentialNotifications[\s\S]*}/],
];

for (const [id, title, regex] of schemaTokens) {
  addCheck(checks, id, title, 'error', regex.test(schema), 'services/api/prisma/schema.prisma', 'Confirm Phase 3-17 schema changes are merged before running Prisma migrations.');
}

// Migration order checks.
const expectedMigrations = [
  '20260428100000_provider_credential_documents',
  '20260428103000_provider_credential_review_tasks',
  '20260428110000_provider_credential_notifications',
  '20260428113000_provider_credential_notification_dispatch',
];
const migrations = listDirs('services/api/prisma/migrations');
for (const migration of expectedMigrations) {
  addCheck(
    checks,
    `MIGRATION_${migration}`,
    `Migration folder ${migration}`,
    'error',
    migrations.includes(migration),
    'services/api/prisma/migrations',
    `Add or re-apply migration ${migration} before running migrate deploy.`
  );
}
const migrationOrderOk = expectedMigrations.every((migration, index) => migrations.indexOf(migration) >= 0 && migrations.indexOf(migration) === migrations.sort().indexOf(migration));
addCheck(checks, 'MIGRATION_ORDER', 'Credential governance migration order', 'warning', migrationOrderOk, expectedMigrations.join(' -> '), 'Keep timestamped migration folders in chronological order and run them once in staging before production.');

// Backend route surface checks.
const routeTokens = [
  ['ROUTE_PATIENTS', 'Patient CRUD route surface', /patients/],
  ['ROUTE_PROVIDERS', 'Provider CRUD route surface', /providers/],
  ['ROUTE_ORGANIZATIONS', 'Organization management route surface', /organizations/],
  ['ROUTE_BULK_STATUS', 'Bulk lifecycle route surface', /bulk-status/],
  ['ROUTE_AUDIT_EXPORT', 'Filtered audit export route surface', /audit\/export|audit.*export/],
  ['ROUTE_DATA_QUALITY', 'Data-quality route surface', /data-quality/],
  ['ROUTE_GOVERNANCE_SWEEP', 'Credential governance sweep route surface', /credential-governance\/sweep|credential-governance/],
  ['ROUTE_PROVIDER_ONBOARDING', 'Provider onboarding route surface', /onboarding/],
  ['ROUTE_CREDENTIAL_DOCS', 'Credential documents route surface', /credentials/],
  ['ROUTE_REVIEW_TASKS', 'Credential review task route surface', /credential-review-tasks/],
  ['ROUTE_NOTIFICATIONS', 'Credential notifications route surface', /credential-notifications/],
];
for (const [id, title, regex] of routeTokens) {
  addCheck(checks, id, title, 'error', regex.test(adminRoutes), 'services/api/src/modules/admin-users/admin-users.routes.ts', 'Re-apply the relevant account governance phase patch.');
}

// Admin UI checks.
const uiTokens = [
  ['UI_ACCOUNT_AUDIT_LINKS', 'Account audit trail links visible', /Audit trail|Account audit|credential audit/i, accountsPage],
  ['UI_ORG_CREATE_MODIFY_DELETE', 'Organization create/modify/delete UI present', /Create organization|Modify|Delete|organization/i, orgsPage],
  ['UI_AUDIT_FILTERS', 'Audit page has filter/export support', /Export CSV|actor|date|resource/i, auditPage],
  ['UI_ORG_OPTIONAL', 'Accounts page supports unassigned organization handling', /Unassigned CarePoint Organization|organization.*optional|No organization/i, accountsPage],
];
for (const [id, title, regex, content] of uiTokens) {
  addCheck(checks, id, title, 'warning', regex.test(content), 'apps/admin/src/app/portal/*', 'Review the Admin account governance UI after merge.');
}

// Provider login/logout checks.
addCheck(
  checks,
  'PROVIDER_ROOT_REDIRECTS_SIGNIN',
  'Provider root redirects directly to sign-in',
  'error',
  /redirect\(['"]\/sign-in['"]\)/.test(providerRoot) || /permanentRedirect\(['"]\/sign-in['"]\)/.test(providerRoot),
  'apps/provider/app/page.tsx',
  'Phase 18 should replace the Provider landing page buttons with a direct /sign-in redirect.'
);
addCheck(
  checks,
  'PROVIDER_LANDING_BUTTONS_REMOVED',
  'Provider landing buttons removed',
  'error',
  !/Open Sign-In|Open Portal/.test(providerRoot),
  'apps/provider/app/page.tsx',
  'Remove the old landing page buttons and keep only the redirect.'
);
addCheck(
  checks,
  'PROVIDER_LOGOUT_BUTTON',
  'Provider top header has logout button',
  'error',
  /logout/i.test(providerHeader) && /button/i.test(providerHeader),
  'apps/provider/components/layout/top-header.tsx',
  'Phase 19 should add a visible logout button in the Provider portal header.'
);
addCheck(
  checks,
  'PROVIDER_LOGOUT_API',
  'Provider API client exposes logout',
  'error',
  /logout/i.test(providerApiClient) && /\/api\/auth\/logout|auth\/logout/i.test(providerApiClient),
  'apps/provider/services/api-client.ts',
  'Ensure logout calls POST /api/auth/logout and clears local cookies on failure.'
);
addCheck(
  checks,
  'PROVIDER_LOGIN_DEV_OTP',
  'Provider sign-in preserves development OTP display',
  'warning',
  /dev|development|otpCode|code/i.test(providerSigninForm),
  'apps/provider/app/sign-in/sign-in-form.tsx',
  'Confirm development/test OTP display is still present if your API returns it.'
);

// Documentation/test files.
const docsExpected = [
  ['DOC_PHASE13_MERGE', 'Phase 13 merge checklist', 'docs/merge-checklists/admin-accounts-phase13-merge-checklist.md'],
  ['DOC_PHASE17_MERGE', 'Phase 17 merge checklist', 'docs/merge-checklists/admin-accounts-phase17-merge-checklist.md'],
  ['DOC_PHASE19_MERGE', 'Phase 19 Provider logout merge checklist', 'docs/merge-checklists/provider-phase19-logout-merge-checklist.md'],
  ['HTTP_PHASE17_ORGS', 'Organization API test file', 'docs/api-tests/admin-accounts-phase17-organizations.http'],
  ['HTTP_PHASE19_LOGOUT', 'Provider logout API test file', 'docs/api-tests/provider-phase19-logout.http'],
];
for (const [id, title, file] of docsExpected) {
  addCheck(checks, id, title, 'warning', exists(file), file, 'Add documentation/test files from the phase patches for easier QA handoff.');
}

// Version compatibility checks.
const rootPkg = parseJson('package.json');
const apiPkg = parseJson('services/api/package.json');
const rootPrisma = rootPkg?.devDependencies?.prisma || rootPkg?.dependencies?.prisma;
const apiPrisma = apiPkg?.dependencies?.prisma || apiPkg?.devDependencies?.prisma;
const rootClient = rootPkg?.dependencies?.['@prisma/client'] || rootPkg?.devDependencies?.['@prisma/client'];
const apiClient = apiPkg?.dependencies?.['@prisma/client'] || apiPkg?.devDependencies?.['@prisma/client'];
const prismaMajors = [major(rootPrisma), major(apiPrisma), major(rootClient), major(apiClient)].filter((value) => value !== null);
const uniquePrismaMajors = [...new Set(prismaMajors)];
addCheck(
  checks,
  'PRISMA_VERSION_ALIGNMENT',
  'Root/API Prisma major versions are aligned',
  'warning',
  uniquePrismaMajors.length <= 1,
  `root prisma=${rootPrisma || 'n/a'}, root @prisma/client=${rootClient || 'n/a'}, api prisma=${apiPrisma || 'n/a'}, api @prisma/client=${apiClient || 'n/a'}`,
  'Align Prisma CLI and @prisma/client major versions before production migration. Current codebase historically mixes Prisma 7 at root and Prisma 5 in services/api.'
);

// Patch hygiene: no .env in this phase patch; in real workspace .env may legitimately exist.
const envLike = [];
function scanEnv(dir) {
  if (!fs.existsSync(dir)) return;
  const ignored = new Set(['node_modules', '.git', '.next', 'dist', 'build']);
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ignored.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) scanEnv(full);
    else if (/^\.env(\..*)?$/.test(entry.name) && entry.name !== '.env.example') envLike.push(rel(full));
  }
}
scanEnv(root);
addCheck(
  checks,
  'ENV_FILES_PRESENT_IN_WORKSPACE',
  'Workspace .env files detected only as local deployment files',
  'info',
  envLike.length === 0,
  envLike.length ? envLike.join(', ') : 'No .env files detected under scanned workspace.',
  'This is informational only. Do not package or commit .env files; keep secrets managed manually as requested.'
);

const errors = checks.filter((check) => check.severity === 'error' && !check.passed);
const warnings = checks.filter((check) => check.severity === 'warning' && !check.passed);
const passed = checks.filter((check) => check.passed);
const status = errors.length === 0 ? (warnings.length === 0 ? 'READY' : 'READY_WITH_WARNINGS') : 'BLOCKED';

const result = {
  generatedAt: now,
  root,
  status,
  totals: {
    checks: checks.length,
    passed: passed.length,
    errors: errors.length,
    warnings: warnings.length,
  },
  checks,
};

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'phase20-merge-readiness-report.json'), JSON.stringify(result, null, 2));

const lines = [];
lines.push('# Phase 20 Merge Readiness Report');
lines.push('');
lines.push(`Generated: ${now}`);
lines.push(`Workspace: \`${root}\``);
lines.push(`Status: **${status}**`);
lines.push('');
lines.push('## Summary');
lines.push('');
lines.push(`- Total checks: ${checks.length}`);
lines.push(`- Passed: ${passed.length}`);
lines.push(`- Errors: ${errors.length}`);
lines.push(`- Warnings: ${warnings.length}`);
lines.push('');
for (const severity of ['error', 'warning', 'info']) {
  const subset = checks.filter((check) => check.severity === severity && !check.passed);
  if (!subset.length) continue;
  lines.push(`## ${severity === 'error' ? 'Blocking errors' : severity === 'warning' ? 'Warnings' : 'Information'}`);
  lines.push('');
  for (const check of subset) {
    lines.push(`### ${check.id}: ${check.title}`);
    lines.push('');
    lines.push(`- Status: ${check.passed ? 'PASS' : 'FAIL'}`);
    lines.push(`- Detail: ${check.detail}`);
    if (check.recommendation) lines.push(`- Recommendation: ${check.recommendation}`);
    lines.push('');
  }
}
lines.push('## Passed checks');
lines.push('');
for (const check of passed) {
  lines.push(`- ${check.id}: ${check.title}`);
}
lines.push('');
fs.writeFileSync(path.join(outDir, 'phase20-merge-readiness-report.md'), lines.join('\n'));

console.log(`Phase 20 merge readiness status: ${status}`);
console.log(`Passed: ${passed.length}/${checks.length}; Errors: ${errors.length}; Warnings: ${warnings.length}`);
console.log(`Report: ${path.join(outDir, 'phase20-merge-readiness-report.md')}`);
process.exit(errors.length === 0 ? 0 : 1);
