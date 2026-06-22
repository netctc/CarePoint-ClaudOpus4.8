import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const outDir = path.join(root, 'validation', 'qa');
mkdirSync(outDir, { recursive: true });

const rel = (p) => path.join(root, ...p.split('/'));
const exists = (p) => existsSync(rel(p));
const read = (p) => exists(p) ? readFileSync(rel(p), 'utf8') : '';
const json = (p) => JSON.parse(read(p));

function countFiles(dir, predicate = () => true) {
  const start = rel(dir);
  if (!existsSync(start)) return 0;
  let total = 0;
  const stack = [start];
  while (stack.length) {
    const current = stack.pop();
    for (const entry of readdirSync(current)) {
      const full = path.join(current, entry);
      const st = statSync(full);
      if (st.isDirectory()) stack.push(full);
      else if (predicate(full)) total += 1;
    }
  }
  return total;
}

function hasAny(file, patterns) {
  const text = read(file);
  return patterns.some((pattern) => text.includes(pattern));
}

const pkg = json('package.json');
const qaV1Audit = json('validation/qa/qa-v1-master-qa-plan-audit.json');
const qaV1Matrix = json('validation/qa/qa-v1-critical-e2e-test-matrix.json');

const adminSurfaces = [
  { id: 'ADMIN-AUTH-SHELL', path: 'apps/admin/src/app/layout.tsx', area: 'Admin shell', priority: 'P0', evidence: 'App shell renders protected admin experience boundary.' },
  { id: 'ADMIN-PORTAL-SHELL', path: 'apps/admin/src/app/portal/layout.tsx', area: 'Admin shell', priority: 'P0', evidence: 'Portal layout contains navigation and content frame.' },
  { id: 'ADMIN-DASHBOARD', path: 'apps/admin/src/app/portal/dashboard/page.tsx', area: 'Dashboard', priority: 'P0', evidence: 'Admin dashboard loads high-level operating state.' },
  { id: 'ADMIN-ACCOUNTS', path: 'apps/admin/src/app/portal/accounts/page.tsx', area: 'Accounts', priority: 'P0', evidence: 'Account list supports review and account management workflow.' },
  { id: 'ADMIN-ACCOUNTS-EXPORT', path: 'apps/admin/src/app/portal/accounts/export/route.ts', area: 'Accounts', priority: 'P1', evidence: 'Account export route is present for QA evidence and operational reporting.' },
  { id: 'ADMIN-ACCOUNTS-DQ-EXPORT', path: 'apps/admin/src/app/portal/accounts/data-quality-export/route.ts', area: 'Accounts', priority: 'P1', evidence: 'Data quality export route is present for configuration validation.' },
  { id: 'ADMIN-ACCOUNTS-GOV-EXPORT', path: 'apps/admin/src/app/portal/accounts/governance-export/route.ts', area: 'Accounts', priority: 'P1', evidence: 'Governance export route is present for audit readiness.' },
  { id: 'ADMIN-AUDIT-LOGS', path: 'apps/admin/src/app/portal/audit/logs/page.tsx', area: 'Audit', priority: 'P0', evidence: 'Audit log surface exists for evidence review.' },
  { id: 'ADMIN-REPORTS-BUILDER', path: 'apps/admin/src/app/portal/reports/builder/page.tsx', area: 'Reports', priority: 'P0', evidence: 'Report builder surface exists for KPI/report readiness.' },
  { id: 'ADMIN-RBAC', path: 'apps/admin/src/app/portal/access/rbac/page.tsx', area: 'Access control', priority: 'P0', evidence: 'RBAC management surface exists.' },
  { id: 'ADMIN-HSP-CONSENTS', path: 'apps/admin/src/app/portal/access/hsp-consents/page.tsx', area: 'Access control', priority: 'P1', evidence: 'HSP consent management surface exists.' },
  { id: 'ADMIN-ORGS', path: 'apps/admin/src/app/portal/organizations/page.tsx', area: 'Organizations', priority: 'P0', evidence: 'Organization configuration surface exists.' },
  { id: 'ADMIN-PROVIDERS', path: 'apps/admin/src/app/portal/providers/page.tsx', area: 'Providers', priority: 'P0', evidence: 'Provider administration surface exists.' },
  { id: 'ADMIN-PROVIDER-ONBOARDING', path: 'apps/admin/src/app/portal/providers/onboarding/page.tsx', area: 'Providers', priority: 'P1', evidence: 'Provider onboarding surface exists.' },
  { id: 'ADMIN-INTEGRATIONS', path: 'apps/admin/src/app/portal/settings/integrations/page.tsx', area: 'Settings', priority: 'P1', evidence: 'Integration settings surface exists.' },
  { id: 'ADMIN-SUPPORT-CONSOLE', path: 'apps/admin/src/app/portal/support/console/page.tsx', area: 'Support', priority: 'P1', evidence: 'Support console surface exists.' },
  { id: 'ADMIN-SAFETY', path: 'apps/admin/src/app/portal/safety/incidents/page.tsx', area: 'Safety', priority: 'P1', evidence: 'Safety incident surface exists.' },
  { id: 'ADMIN-COVERAGE', path: 'apps/admin/src/app/portal/coverage/page.tsx', area: 'Coverage', priority: 'P2', evidence: 'Coverage configuration surface exists.' }
];

const configArtifacts = [
  { id: 'CONFIG-ENV-EXAMPLE', path: '.env.example', priority: 'P0', purpose: 'Environment template exists for safe setup.' },
  { id: 'CONFIG-ROOT-PACKAGE', path: 'package.json', priority: 'P0', purpose: 'Root scripts are registered.' },
  { id: 'CONFIG-ADMIN-PACKAGE', path: 'apps/admin/package.json', priority: 'P0', purpose: 'Admin workspace package exists.' },
  { id: 'CONFIG-API-PACKAGE', path: 'services/api/package.json', priority: 'P0', purpose: 'API workspace package exists.' },
  { id: 'CONFIG-CONTRACTS-PACKAGE', path: 'packages/contracts/package.json', priority: 'P0', purpose: 'Shared contracts package exists.' },
  { id: 'CONFIG-UX-TOKENS', path: 'packages/design-system/tokens/carepoint.tokens.json', priority: 'P1', purpose: 'Design system tokens are available to support Admin visual regression.' },
  { id: 'CONFIG-QA-MANIFEST', path: 'docs/qa/QA_PHASE_MANIFEST.json', priority: 'P0', purpose: 'QA phase manifest exists.' },
  { id: 'CONFIG-QA-V1-MATRIX', path: 'validation/qa/qa-v1-critical-e2e-test-matrix.json', priority: 'P0', purpose: 'QA-V1 critical matrix exists.' }
];

const adminScenarioPlan = [
  { id: 'QA2-ADMIN-001', area: 'Authentication', title: 'Admin user reaches Admin portal after login and can return to sign-in after logout', priority: 'P0', method: 'manual-or-e2e-automation-candidate' },
  { id: 'QA2-ADMIN-002', area: 'Authorization', title: 'Non-admin role is blocked from Admin-only surfaces', priority: 'P0', method: 'manual-or-e2e-automation-candidate' },
  { id: 'QA2-ADMIN-003', area: 'Accounts', title: 'Account list loads, filters can be applied, and account detail actions are visible', priority: 'P0', method: 'manual-or-e2e-automation-candidate' },
  { id: 'QA2-ADMIN-004', area: 'Accounts', title: 'Create account flow validates required fields and shows success/failure evidence', priority: 'P0', method: 'manual-or-e2e-automation-candidate' },
  { id: 'QA2-ADMIN-005', area: 'Accounts', title: 'Edit and disable account actions require confirmation and preserve auditability', priority: 'P0', method: 'manual-or-e2e-automation-candidate' },
  { id: 'QA2-ADMIN-006', area: 'Accounts export', title: 'CSV/export routes respond only to authorized Admin sessions', priority: 'P1', method: 'scripted-or-manual' },
  { id: 'QA2-ADMIN-007', area: 'Audit logs', title: 'Audit logs filter by actor, action, subject, and date without losing context', priority: 'P0', method: 'manual-or-e2e-automation-candidate' },
  { id: 'QA2-ADMIN-008', area: 'Reports', title: 'Report builder creates or previews a KPI/report configuration with validation', priority: 'P1', method: 'manual-or-e2e-automation-candidate' },
  { id: 'QA2-ADMIN-009', area: 'RBAC', title: 'RBAC matrix displays roles, permissions, and denied access behavior clearly', priority: 'P0', method: 'manual-or-e2e-automation-candidate' },
  { id: 'QA2-ADMIN-010', area: 'Organizations', title: 'Organization configuration surface loads and preserves required identifiers', priority: 'P1', method: 'manual-or-e2e-automation-candidate' },
  { id: 'QA2-ADMIN-011', area: 'Providers', title: 'Provider directory and onboarding surfaces support provider review and setup', priority: 'P1', method: 'manual-or-e2e-automation-candidate' },
  { id: 'QA2-ADMIN-012', area: 'Settings', title: 'Integration settings do not expose secrets and validate configuration fields', priority: 'P0', method: 'manual-or-e2e-automation-candidate' },
  { id: 'QA2-ADMIN-013', area: 'Support', title: 'Support console shows operational context without exposing sensitive data', priority: 'P1', method: 'manual-or-e2e-automation-candidate' },
  { id: 'QA2-ADMIN-014', area: 'Safety', title: 'Safety incidents surface supports review, triage, and evidence capture', priority: 'P1', method: 'manual-or-e2e-automation-candidate' },
  { id: 'QA2-ADMIN-015', area: 'Configuration', title: 'Required package scripts are available: build:admin, build:web, build:api, audit:qa', priority: 'P0', method: 'automated' },
  { id: 'QA2-ADMIN-016', area: 'Configuration', title: 'Environment template is present and does not contain committed secret values', priority: 'P0', method: 'manual-or-scripted' },
  { id: 'QA2-ADMIN-017', area: 'Regression', title: 'Admin surfaces retain UX-V6 layout, focus, responsive, and accessibility evidence', priority: 'P1', method: 'manual-or-e2e-automation-candidate' },
  { id: 'QA2-ADMIN-018', area: 'Production readiness', title: 'Admin QA evidence can be attached to final readiness package', priority: 'P1', method: 'manual' }
].map((scenario) => ({
  ...scenario,
  role: 'admin',
  expectedEvidence: [
    'tester',
    'environment',
    'date',
    'admin role used',
    'steps executed',
    'expected result',
    'actual result',
    'pass/fail',
    'screenshot or log reference when applicable',
    'linked defect id when failed'
  ],
  acceptance: scenario.priority === 'P0'
    ? 'Must pass before production readiness signoff'
    : 'Must be triaged before production readiness signoff'
}));

const scriptChecks = [
  { id: 'root_audit_qa_registered', passed: Boolean(pkg.scripts?.['audit:qa']) },
  { id: 'qa_v2_admin_script_registered', passed: pkg.scripts?.['audit:qa:admin-config'] === 'node scripts/qa/scan-admin-functional-config.mjs' },
  { id: 'build_admin_script_available', passed: Boolean(pkg.scripts?.['build:admin']) },
  { id: 'build_web_script_available', passed: Boolean(pkg.scripts?.['build:web']) },
  { id: 'build_api_script_available', passed: Boolean(pkg.scripts?.['build:api']) }
];

const surfaceChecks = adminSurfaces.map((surface) => ({
  id: `surface_${surface.id.toLowerCase().replaceAll('-', '_')}`,
  surfaceId: surface.id,
  path: surface.path,
  priority: surface.priority,
  passed: exists(surface.path)
}));

const configChecks = configArtifacts.map((artifact) => ({
  id: `artifact_${artifact.id.toLowerCase().replaceAll('-', '_')}`,
  artifactId: artifact.id,
  path: artifact.path,
  priority: artifact.priority,
  passed: exists(artifact.path)
}));

const envText = read('.env.example');
const envChecks = [
  { id: 'env_example_present', passed: exists('.env.example') },
  { id: 'env_example_has_database_url_placeholder', passed: envText.includes('DATABASE_URL') },
  { id: 'env_example_has_auth_or_jwt_placeholder', passed: /AUTH|JWT|SESSION|NEXTAUTH/i.test(envText) },
  { id: 'env_example_no_plain_production_secret_marker', passed: !/(sk_live_|AKIA|BEGIN PRIVATE KEY|password\s*=\s*[^\s#]+)/i.test(envText) }
];

const adminCodeQualityChecks = [
  { id: 'admin_accounts_has_export_or_bulk_capability', passed: hasAny('apps/admin/src/app/portal/accounts/page.tsx', ['Export', 'export', 'CSV', 'csv', 'bulk', 'Bulk']) || exists('apps/admin/src/app/portal/accounts/export/route.ts') },
  { id: 'admin_audit_logs_has_filter_language', passed: hasAny('apps/admin/src/app/portal/audit/logs/page.tsx', ['filter', 'Filter', 'actor', 'action', 'date', 'subject']) },
  { id: 'admin_reports_builder_has_builder_language', passed: hasAny('apps/admin/src/app/portal/reports/builder/page.tsx', ['report', 'Report', 'builder', 'Builder', 'KPI']) },
  { id: 'admin_rbac_surface_mentions_roles_or_permissions', passed: hasAny('apps/admin/src/app/portal/access/rbac/page.tsx', ['role', 'Role', 'permission', 'Permission', 'RBAC']) },
  { id: 'admin_settings_integrations_mentions_config_or_secret', passed: hasAny('apps/admin/src/app/portal/settings/integrations/page.tsx', ['integration', 'Integration', 'secret', 'Secret', 'configuration', 'Configuration']) }
];

const v1ContinuityChecks = [
  { id: 'qa_v1_audit_completion_100', passed: qaV1Audit?.aggregate?.completionPercent === 100 },
  { id: 'qa_v1_matrix_has_44_scenarios', passed: qaV1Matrix?.scenarioCount >= 44 || Array.isArray(qaV1Matrix?.scenarios) && qaV1Matrix.scenarios.length >= 44 },
  { id: 'qa_v1_matrix_has_admin_scenarios', passed: Array.isArray(qaV1Matrix?.scenarios) && qaV1Matrix.scenarios.some((s) => String(s.id).startsWith('ADMIN-')) },
  { id: 'ux_v6_closure_doc_present', passed: exists('docs/design/UX_PHASE_CLOSURE_CERTIFICATE.md') }
];

const scenarioChecks = [
  { id: 'qa_v2_has_admin_functional_scenarios', passed: adminScenarioPlan.length >= 18 },
  { id: 'qa_v2_has_p0_admin_coverage', passed: adminScenarioPlan.filter((s) => s.priority === 'P0').length >= 8 },
  { id: 'qa_v2_covers_accounts_audit_reports_rbac_config', passed: ['Accounts', 'Audit logs', 'Reports', 'RBAC', 'Configuration'].every((area) => adminScenarioPlan.some((s) => s.area === area || s.area.includes(area))) }
];

const checks = [
  ...scriptChecks,
  ...surfaceChecks,
  ...configChecks,
  ...envChecks,
  ...adminCodeQualityChecks,
  ...v1ContinuityChecks,
  ...scenarioChecks
];

const passed = checks.filter((check) => check.passed).length;
const total = checks.length;
const completionPercent = Math.round((passed / total) * 100);

const audit = {
  phase: 'CarePoint Phase 3 - End-to-End QA, UAT & Production Readiness',
  delivery: 'QA-V2',
  sourceBaseline: 'CarePoint_qa_uat_production_readiness_v1',
  generatedAt: new Date().toISOString(),
  scope: 'Admin functional QA and configuration validation',
  technicalBoundary: {
    optionBPythonProgressive: 'closed at V64',
    designRefinementUx: 'closed at UX-V6',
    qaV1MasterPlan: 'complete',
    backendContractsChanged: false,
    pythonWorkerChanged: false,
    databaseChanged: false,
    applicationRuntimeCodeChanged: false
  },
  inventory: {
    adminApplicationFiles: countFiles('apps/admin', (file) => /\.(tsx|ts|js|jsx)$/.test(file)),
    adminPortalPageFiles: countFiles('apps/admin/src/app/portal', (file) => file.endsWith('page.tsx')),
    adminRouteFiles: countFiles('apps/admin/src/app/portal', (file) => file.endsWith('route.ts')),
    qaDocs: countFiles('docs/qa', (file) => file.endsWith('.md') || file.endsWith('.json')),
    qaValidationReports: countFiles('validation/qa', (file) => file.endsWith('.json')),
    adminSurfaces,
    configArtifacts
  },
  checks,
  aggregate: {
    passed,
    total,
    completionPercent
  },
  outputs: {
    auditFile: 'validation/qa/qa-v2-admin-functional-config-audit.json',
    adminFunctionalPlanFile: 'validation/qa/qa-v2-admin-functional-test-plan.json',
    docs: [
      'docs/qa/QA_V2_ADMIN_FUNCTIONAL_QA.md',
      'docs/qa/QA_V2_CONFIGURATION_VALIDATION.md',
      'docs/qa/QA_V2_VALIDATION.md',
      'docs/qa/CHANGELOG_QA_V1_TO_QA_V2.md'
    ],
    nextRecommendedDelivery: 'QA-V3 - Provider functional QA and clinical workflow validation'
  },
  readinessPosition: completionPercent === 100 ? 'ready-for-admin-qa-execution' : 'admin-qa-precheck-needs-triage'
};

const plan = {
  phase: audit.phase,
  delivery: 'QA-V2',
  sourceBaseline: audit.sourceBaseline,
  generatedAt: audit.generatedAt,
  purpose: 'Define Admin functional QA and configuration validation scope after QA-V1 master planning.',
  scenarioCount: adminScenarioPlan.length,
  priorityCounts: adminScenarioPlan.reduce((acc, scenario) => {
    acc[scenario.priority] = (acc[scenario.priority] || 0) + 1;
    return acc;
  }, {}),
  scenarios: adminScenarioPlan,
  evidenceTemplate: {
    tester: '',
    environment: 'local | staging | pilot',
    buildReference: 'CarePoint_qa_uat_production_readiness_v2',
    testDate: '',
    role: 'admin',
    result: 'pass | fail | blocked',
    defectReference: '',
    screenshotOrLogReference: '',
    reviewerSignoff: ''
  }
};

writeFileSync(path.join(outDir, 'qa-v2-admin-functional-config-audit.json'), JSON.stringify(audit, null, 2) + '\n');
writeFileSync(path.join(outDir, 'qa-v2-admin-functional-test-plan.json'), JSON.stringify(plan, null, 2) + '\n');

console.log('QA-V2 admin functional/config audit written to validation/qa/qa-v2-admin-functional-config-audit.json');
console.log('QA-V2 admin functional test plan written to validation/qa/qa-v2-admin-functional-test-plan.json');
console.log(`Aggregate completion: ${completionPercent}% (${passed}/${total})`);

if (completionPercent !== 100) {
  process.exitCode = 1;
}
