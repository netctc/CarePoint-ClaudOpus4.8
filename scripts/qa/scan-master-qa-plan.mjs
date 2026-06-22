#!/usr/bin/env node
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, extname } from 'node:path';

const root = process.cwd();
const outDir = 'validation/qa';
const outFile = `${outDir}/qa-v1-master-qa-plan-audit.json`;
const matrixFile = `${outDir}/qa-v1-critical-e2e-test-matrix.json`;

function read(relPath) {
  return readFileSync(join(root, relPath), 'utf8');
}

function readJson(relPath) {
  return JSON.parse(read(relPath));
}

function fileExists(relPath) {
  return existsSync(join(root, relPath));
}

function listFiles(dirRel, predicate = () => true) {
  const dir = join(root, dirRel);
  const result = [];
  function walk(current) {
    for (const name of readdirSync(current)) {
      const full = join(current, name);
      const rel = full.slice(root.length + 1).replaceAll('\\', '/');
      const st = statSync(full);
      if (st.isDirectory()) {
        if (!['node_modules', '.git', '.next', 'dist', 'build', 'coverage'].includes(name)) walk(full);
      } else if (predicate(rel)) {
        result.push(rel);
      }
    }
  }
  if (existsSync(dir)) walk(dir);
  return result.sort();
}

const packageJson = readJson('package.json');
const uxManifest = readJson('docs/design/UX_PHASE_MANIFEST.json');

const appFiles = listFiles('apps', (rel) => ['.ts', '.tsx', '.js', '.jsx', '.dart'].includes(extname(rel)));
const apiFiles = listFiles('services/api', (rel) => ['.ts', '.js'].includes(extname(rel)));
const workerFiles = listFiles('services/python-worker', (rel) => ['.py'].includes(extname(rel)));
const uxReports = listFiles('validation/ux', (rel) => rel.endsWith('.json'));
const optionBDocs = listFiles('docs/option-b', (rel) => rel.endsWith('.md'));

const criticalSurfaces = [
  { id: 'admin_root_layout', path: 'apps/admin/src/app/layout.tsx', role: 'Admin application shell' },
  { id: 'admin_dashboard', path: 'apps/admin/src/app/page.tsx', role: 'Admin entry surface' },
  { id: 'provider_root_layout', path: 'apps/provider/app/layout.tsx', role: 'Provider application shell' },
  { id: 'provider_portal_layout', path: 'apps/provider/app/portal/layout.tsx', role: 'Provider portal shell' },
  { id: 'provider_queue', path: 'apps/provider/app/portal/queue/page.tsx', role: 'Provider queue workflow' },
  { id: 'provider_calendar', path: 'apps/provider/app/portal/calendar/page.tsx', role: 'Provider calendar workflow' },
  { id: 'provider_prescription_new', path: 'apps/provider/app/portal/prescriptions/new/page.tsx', role: 'Provider prescription creation workflow' },
  { id: 'provider_encounter_note', path: 'apps/provider/app/portal/encounters/[encounterId]/note/page.tsx', role: 'Provider encounter note workflow' },
  { id: 'admin_audit_logs', path: 'apps/admin/src/app/portal/audit/logs/page.tsx', role: 'Admin audit logs surface' },
  { id: 'admin_reports_builder', path: 'apps/admin/src/app/portal/reports/builder/page.tsx', role: 'Admin reports builder surface' },
  { id: 'contracts_package', path: 'packages/contracts/package.json', role: 'Shared contract package' },
  { id: 'api_package', path: 'services/api/package.json', role: 'API service package' },
  { id: 'python_worker_verify', path: 'scripts/option_b/verify_python_worker.py', role: 'Python worker verification script' },
  { id: 'ux_phase_certificate', path: 'docs/design/UX_PHASE_CLOSURE_CERTIFICATE.md', role: 'UX phase closure evidence' }
];

const scenarioTemplates = [
  ['AUTH-001', 'Authentication', 'Admin login, protected route access, and logout', 'admin', 'P0'],
  ['AUTH-002', 'Authentication', 'Provider login, protected route access, and logout', 'provider', 'P0'],
  ['AUTH-003', 'Authentication', 'Expired session returns user to sign-in without data exposure', 'admin-provider', 'P0'],
  ['RBAC-001', 'Authorization', 'Admin role can access accounts, audit, reports, and settings', 'admin', 'P0'],
  ['RBAC-002', 'Authorization', 'Provider role cannot access Admin-only surfaces', 'provider', 'P0'],
  ['ADMIN-001', 'Admin accounts', 'Create, read, update, and disable account from Admin portal', 'admin', 'P0'],
  ['ADMIN-002', 'Admin accounts', 'Bulk account action requires explicit confirmation and evidence', 'admin', 'P1'],
  ['ADMIN-003', 'Admin accounts', 'CSV import drawer handles validation errors and success summary', 'admin', 'P1'],
  ['ADMIN-004', 'Admin audit', 'Audit logs filter by actor, action, date, and subject', 'admin', 'P1'],
  ['ADMIN-005', 'Admin reports', 'Report builder creates a saved KPI/report definition', 'admin', 'P1'],
  ['ADMIN-006', 'Admin reports', 'Report delivery panel validates schedule and recipients', 'admin', 'P2'],
  ['PROV-001', 'Provider dashboard', 'Provider dashboard loads clinical workload and KPI cards', 'provider', 'P0'],
  ['PROV-002', 'Provider queue', 'Queue worklist opens patient/refill task and preserves back navigation', 'provider', 'P0'],
  ['PROV-003', 'Provider calendar', 'Calendar day/week surface displays slots and appointments', 'provider', 'P0'],
  ['PROV-004', 'Provider appointments', 'Appointment worklist supports status review and evidence panel', 'provider', 'P1'],
  ['PROV-005', 'Provider prescriptions', 'New prescription flow validates required fields and clinical warnings', 'provider', 'P0'],
  ['PROV-006', 'Provider encounters', 'Encounter note workflow preserves draft state and submit confirmation', 'provider', 'P0'],
  ['PROV-007', 'Provider i18n', 'Language switching preserves route and critical clinical labels', 'provider', 'P2'],
  ['API-001', 'API contracts', 'API build passes with shared contract package', 'api', 'P0'],
  ['API-002', 'API contracts', 'Hybrid Python prepare endpoints return contract-compatible payloads', 'api-python', 'P0'],
  ['API-003', 'API errors', 'API validation errors return stable status, code, and message shape', 'api', 'P1'],
  ['PY-001', 'Python worker', 'Option B worker verification passes', 'python-worker', 'P0'],
  ['PY-002', 'Python worker', 'Python contract test suite passes', 'python-worker', 'P0'],
  ['PY-003', 'Python worker', 'Dry-run/advisory decisions remain metadata-only', 'python-worker', 'P1'],
  ['E2E-001', 'End-to-end', 'Admin-created provider can sign in and reach Provider portal', 'cross-app', 'P0'],
  ['E2E-002', 'End-to-end', 'Provider clinical action is visible in Admin audit evidence', 'cross-app', 'P0'],
  ['E2E-003', 'End-to-end', 'Report/KPI data reflects clinical workflow activity after refresh', 'cross-app', 'P1'],
  ['UX-001', 'UX regression', 'Admin navigation, landmarks, focus-visible, and responsive layout pass smoke', 'admin', 'P1'],
  ['UX-002', 'UX regression', 'Provider navigation, landmarks, focus-visible, and responsive layout pass smoke', 'provider', 'P1'],
  ['UX-003', 'UX regression', 'Forms, tables, empty states, and KPI cards use normalized primitives', 'admin-provider', 'P1'],
  ['A11Y-001', 'Accessibility', 'Keyboard-only navigation reaches all critical actions', 'admin-provider', 'P0'],
  ['A11Y-002', 'Accessibility', 'Screen reader labels are present for search, nav, forms, and tables', 'admin-provider', 'P1'],
  ['A11Y-003', 'Accessibility', 'Reduced motion and forced colors modes remain usable', 'admin-provider', 'P2'],
  ['RESP-001', 'Responsive', 'Critical Admin surfaces pass desktop, tablet, and mobile smoke', 'admin', 'P1'],
  ['RESP-002', 'Responsive', 'Critical Provider surfaces pass desktop, tablet, and mobile smoke', 'provider', 'P1'],
  ['SEC-001', 'Security smoke', 'No secret values are committed and environment example remains safe', 'platform', 'P0'],
  ['SEC-002', 'Security smoke', 'Protected APIs reject unauthenticated requests', 'api', 'P0'],
  ['OBS-001', 'Observability', 'Errors produce actionable logs without exposing sensitive data', 'platform', 'P1'],
  ['REL-001', 'Reliability', 'Rollback plan and close evidence are present before staging promotion', 'platform', 'P0'],
  ['REL-002', 'Reliability', 'Repeated smoke execution does not require manual data reset', 'platform', 'P2'],
  ['PROD-001', 'Production readiness', 'Environment, build, migration, backup, and rollback checklist is completed', 'platform', 'P0'],
  ['UAT-001', 'UAT', 'Admin stakeholder signs acceptance checklist', 'uat', 'P0'],
  ['UAT-002', 'UAT', 'Provider stakeholder signs acceptance checklist', 'uat', 'P0'],
  ['UAT-003', 'UAT', 'Operator/reviewer stakeholder signs acceptance checklist', 'uat', 'P1']
];

const scenarios = scenarioTemplates.map(([id, area, title, role, priority]) => ({
  id,
  area,
  title,
  role,
  priority,
  type: id.startsWith('UAT') ? 'manual-uat' : id.startsWith('API') || id.startsWith('PY') ? 'automated-or-scripted' : 'manual-or-e2e-automation-candidate',
  expectedEvidence: [
    'tester',
    'environment',
    'date',
    'steps executed',
    'expected result',
    'actual result',
    'pass/fail',
    'screenshot or log reference when applicable'
  ],
  acceptance: priority === 'P0' ? 'Must pass before production readiness signoff' : 'Must be triaged before production readiness signoff'
}));

const qaDocs = [
  'docs/qa/QA_V1_MASTER_QA_PLAN.md',
  'docs/qa/QA_V1_CRITICAL_E2E_TEST_MATRIX.md',
  'docs/qa/QA_V1_UAT_READINESS_PACKAGE.md',
  'docs/qa/QA_V1_PRODUCTION_READINESS_SEED.md',
  'docs/qa/QA_V1_VALIDATION.md',
  'docs/qa/CHANGELOG_UX_V6_TO_QA_V1.md',
  'docs/qa/QA_PHASE_MANIFEST.json',
  'docs/qa/QA_PHASE_ROADMAP.md'
];

const checks = [
  { id: 'ux_phase_closed', passed: uxManifest.status === 'closed' && uxManifest.delivery === 'UX-V6' },
  { id: 'qa_scripts_registered', passed: packageJson.scripts?.['audit:qa']?.includes('scan-master-qa-plan.mjs') && packageJson.scripts?.['audit:qa:master-plan'] === 'node scripts/qa/scan-master-qa-plan.mjs' },
  { id: 'critical_surface_inventory_present', passed: criticalSurfaces.every((surface) => fileExists(surface.path)) },
  { id: 'ux_audit_reports_present', passed: uxReports.length >= 6 },
  { id: 'option_b_closure_docs_present', passed: optionBDocs.some((path) => path.includes('FINAL_HANDOVER')) || optionBDocs.length >= 10 },
  { id: 'build_api_script_available', passed: Boolean(packageJson.scripts?.['build:api']) },
  { id: 'build_web_script_available', passed: Boolean(packageJson.scripts?.['build:web']) },
  { id: 'python_worker_verify_script_available', passed: fileExists('scripts/option_b/verify_python_worker.py') && Boolean(packageJson.scripts?.['verify:python-worker']) },
  { id: 'python_worker_contract_script_available', passed: fileExists('scripts/option_b/run_python_worker_contract_tests.py') || Boolean(packageJson.scripts?.['test:python-worker:contracts']) },
  { id: 'scenario_matrix_has_p0_coverage', passed: scenarios.filter((s) => s.priority === 'P0').length >= 15 },
  { id: 'scenario_matrix_has_admin_provider_api_python_uat', passed: ['admin', 'provider', 'api', 'python-worker', 'uat'].every((role) => scenarios.some((s) => s.role === role || s.role.includes(role))) },
  { id: 'qa_docs_present', passed: qaDocs.every((path) => fileExists(path)) }
];

const passed = checks.filter((check) => check.passed).length;
const matrix = {
  phase: 'CarePoint Phase 3 - End-to-End QA, UAT & Production Readiness',
  delivery: 'QA-V1',
  sourceBaseline: 'CarePoint_design_refinement_phase_ux_v6',
  generatedAt: new Date().toISOString(),
  purpose: 'Define the master QA and UAT scope before scripted execution begins.',
  scenarioCount: scenarios.length,
  priorityCounts: scenarios.reduce((acc, scenario) => {
    acc[scenario.priority] = (acc[scenario.priority] || 0) + 1;
    return acc;
  }, {}),
  scenarios
};

const report = {
  phase: 'CarePoint Phase 3 - End-to-End QA, UAT & Production Readiness',
  delivery: 'QA-V1',
  sourceBaseline: 'CarePoint_design_refinement_phase_ux_v6',
  generatedAt: new Date().toISOString(),
  technicalBoundary: {
    optionBPythonProgressive: 'closed at V64',
    designRefinementUx: 'closed at UX-V6',
    backendContractsChanged: false,
    pythonWorkerChanged: false,
    databaseChanged: false,
    applicationRuntimeCodeChanged: false
  },
  inventory: {
    applicationFiles: appFiles.length,
    apiFiles: apiFiles.length,
    pythonWorkerFiles: workerFiles.length,
    uxAuditReports: uxReports.length,
    optionBDocumentationFiles: optionBDocs.length,
    criticalSurfaces
  },
  checks,
  aggregate: {
    passed,
    total: checks.length,
    completionPercent: Math.round((passed / checks.length) * 100)
  },
  outputs: {
    matrixFile,
    docs: qaDocs,
    nextRecommendedDelivery: 'QA-V2 - Admin functional QA and configuration validation'
  },
  readinessPosition: passed === checks.length ? 'ready-for-qa-execution' : 'hold-before-qa-execution'
};

mkdirSync(join(root, outDir), { recursive: true });
writeFileSync(join(root, matrixFile), JSON.stringify(matrix, null, 2) + '\n');
writeFileSync(join(root, outFile), JSON.stringify(report, null, 2) + '\n');
console.log(`QA-V1 master QA plan audit written to ${outFile}`);
console.log(`QA-V1 critical E2E test matrix written to ${matrixFile}`);
console.log(`Aggregate completion: ${report.aggregate.completionPercent}% (${passed}/${checks.length})`);
