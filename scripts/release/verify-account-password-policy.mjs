import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(path, 'utf8');
const app = read('services/api/src/app.ts');
const policy = read('services/api/src/lib/account-password-policy.ts');
const guard = read('services/api/src/middleware/release-account-password-policy.ts');
const iamRouter = read('services/api/src/modules/admin-users/iam-users.routes.ts');
const accountsLayout = read('apps/admin/src/app/portal/accounts/layout.tsx');

const checks = [];
const assert = (condition, message) => checks.push({ passed: Boolean(condition), message });

assert(policy.includes('TEMPORARY_PASSWORD_MIN_LENGTH = 16'), 'temporary account passwords require at least 16 characters');
assert(policy.includes("forbiddenFragments = ['password', 'changeme', 'carepoint', 'temporary']"), 'temporary account passwords reject obvious shared/default terms');
assert(policy.includes('options.required === true'), 'password policy supports explicit required-on-create behavior');

for (const path of ["'/patients'", "'/providers'", "'/iam-users'", "'/import'"]) {
  assert(guard.includes(path), `release password guard covers ${path}`);
}
assert(guard.includes("method === 'PUT'") && guard.includes('/^\\/patients\\/[^/]+$/') && guard.includes('/^\\/providers\\/[^/]+$/'), 'release password guard validates requested patient/provider password resets');
assert(guard.includes('validateImportPasswords(req.body)'), 'release password guard validates every CSV/structured import row');
assert(guard.includes('validateTemporaryPassword(rowPassword(row), { required: true })'), 'account import requires an explicit password per row');

const guardMount = app.indexOf("app.use('/api/admin/users', releaseAccountPasswordPolicy)");
const iamMount = app.indexOf("app.use('/api/admin/users/iam-users', iamUsersRouter)");
const legacyMount = app.indexOf("app.use('/api/admin/users', adminUsersRouter)");
assert(guardMount >= 0 && iamMount >= 0 && legacyMount >= 0, 'admin user guard and routers are mounted');
assert(guardMount < iamMount && guardMount < legacyMount, 'release password guard runs before IAM and legacy account routers');

assert(iamRouter.includes("validateTemporaryPassword(req.body?.password, { required: true })"), 'isolated IAM create route independently requires governed temporary password');
assert(!iamRouter.includes("|| 'ChangeMe"), 'isolated IAM route contains no shared temporary-password fallback');

assert(accountsLayout.includes('There is no supported platform default.'), 'Admin Accounts visibly states that no shared password default is supported');
assert(accountsLayout.includes('at least 16 characters'), 'Admin Accounts visibly communicates the release minimum password length');
assert(accountsLayout.includes('legacy optional/default wording or template value'), 'Admin Accounts warns that legacy inline copy/templates are rejected by the release API');

const failed = checks.filter((check) => !check.passed);
for (const check of checks) console.log(`${check.passed ? 'PASS' : 'FAIL'} ${check.message}`);
if (failed.length > 0) {
  console.error(`Account password policy verification failed: ${failed.length}/${checks.length} checks failed.`);
  process.exit(1);
}
console.log(`Account password policy verification passed: ${checks.length}/${checks.length} checks.`);
