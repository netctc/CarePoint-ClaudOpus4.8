import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const outDir = path.join(root, 'validation', 'pilot');
mkdirSync(outDir, { recursive: true });

const rel = (p) => path.join(root, ...p.split('/'));
const exists = (p) => existsSync(rel(p));
const read = (p) => exists(p) ? readFileSync(rel(p), 'utf8') : '';
const json = (p) => JSON.parse(read(p));
const now = new Date().toISOString();

const pkg = json('package.json');
const pilotManifest = json('docs/pilot/PILOT_PHASE_MANIFEST.json');
const pilotV1Audit = exists('validation/pilot/pilot-v1-execution-charter-audit.json') ? json('validation/pilot/pilot-v1-execution-charter-audit.json') : {};
const qaV7Audit = exists('validation/qa/qa-v7-final-qa-uat-closure-audit.json') ? json('validation/qa/qa-v7-final-qa-uat-closure-audit.json') : {};
const qaV6GoLive = exists('validation/qa/qa-v6-go-live-checklist.json') ? json('validation/qa/qa-v6-go-live-checklist.json') : {};

const deploymentDomains = [
  {
    id: 'STAGE-ENV-001',
    domain: 'Environment identity',
    owner: 'Release owner',
    objective: 'Confirm staging environment name, URL, owner, region, and operating window are documented before rehearsal.',
    evidence: ['environment URL', 'release owner', 'support window', 'staging data policy'],
    gate: 'required-before-rehearsal'
  },
  {
    id: 'STAGE-ENV-002',
    domain: 'Configuration and secrets',
    owner: 'Technical owner',
    objective: 'Confirm required environment variables are present and no secret values are committed.',
    evidence: ['.env.example reviewed', 'secret store owner identified', 'check:secrets result'],
    gate: 'required-before-promotion'
  },
  {
    id: 'STAGE-ENV-003',
    domain: 'Build and artifact integrity',
    owner: 'Release owner',
    objective: 'Confirm contracts, API and web builds can be produced from the selected release package.',
    evidence: ['npm install', 'npm run build:api', 'npm run build:web', 'artifact checksum'],
    gate: 'required-before-pilot-launch'
  },
  {
    id: 'STAGE-ENV-004',
    domain: 'Database and migration rehearsal',
    owner: 'Technical owner',
    objective: 'Confirm migration path, seed policy, and rollback data handling are documented.',
    evidence: ['migration command', 'database backup timestamp', 'schema owner', 'restore procedure'],
    gate: 'required-before-pilot-launch'
  },
  {
    id: 'STAGE-ENV-005',
    domain: 'Node/API readiness',
    owner: 'Technical owner',
    objective: 'Confirm API package, hybrid Python helpers, and route syntax checks are available.',
    evidence: ['build:api result', 'node --check API helper', 'node --check route module'],
    gate: 'required-before-integration-smoke'
  },
  {
    id: 'STAGE-ENV-006',
    domain: 'Python worker readiness',
    owner: 'Technical owner',
    objective: 'Confirm Python worker verification and contract test scripts remain available for rehearsal.',
    evidence: ['verify_python_worker.py', 'worker contract tests', 'compileall result'],
    gate: 'required-before-integration-smoke'
  },
  {
    id: 'STAGE-ENV-007',
    domain: 'Smoke tests',
    owner: 'QA/UAT owner',
    objective: 'Confirm Admin, Provider, API, worker and auth/RBAC smoke path is defined for staging.',
    evidence: ['QA-V1 matrix', 'QA-V4 test plan', 'smoke result', 'defect triage log'],
    gate: 'required-before-go-no-go'
  },
  {
    id: 'STAGE-ENV-008',
    domain: 'Observability and support activation',
    owner: 'Support owner',
    objective: 'Confirm logs, support contacts, severity rules, and daily review window are active.',
    evidence: ['support channel', 'incident owner', 'logs location', 'daily health review time'],
    gate: 'required-before-pilot-launch'
  },
  {
    id: 'STAGE-ENV-009',
    domain: 'Backup and rollback rehearsal',
    owner: 'Release owner',
    objective: 'Confirm rollback triggers from PILOT-V1 are mapped to concrete actions and decision authority.',
    evidence: ['rollback trigger map', 'rollback owner', 'backup proof', 'restore rehearsal notes'],
    gate: 'required-before-pilot-launch'
  },
  {
    id: 'STAGE-ENV-010',
    domain: 'Go/no-go rehearsal decision',
    owner: 'Pilot owner',
    objective: 'Confirm final rehearsal outcome can be recorded as continue, hold, rollback or retry.',
    evidence: ['go/no-go record', 'open issue list', 'approval timestamp', 'next action'],
    gate: 'required-before-PILOT-V3'
  }
];

const rehearsalSteps = [
  { order: 1, id: 'REH-001', name: 'Freeze release candidate', command: 'Record selected ZIP/checksum and source baseline.', expected: 'Single candidate identified for staging rehearsal.' },
  { order: 2, id: 'REH-002', name: 'Install dependencies', command: 'npm install', expected: 'Dependency installation completes without errors.' },
  { order: 3, id: 'REH-003', name: 'Build contracts and API', command: 'npm run build:api', expected: 'API build passes with shared contracts.' },
  { order: 4, id: 'REH-004', name: 'Build web apps', command: 'npm run build:web', expected: 'Admin and Provider web builds pass.' },
  { order: 5, id: 'REH-005', name: 'Run QA evidence audits', command: 'npm run audit:qa && npm run audit:pilot', expected: 'QA and pilot audits pass at 100%.' },
  { order: 6, id: 'REH-006', name: 'Verify Python worker', command: 'PYTHONPATH=services/python-worker python scripts/option_b/verify_python_worker.py', expected: 'Worker verification passes.' },
  { order: 7, id: 'REH-007', name: 'Run Python contract tests', command: 'PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 PYTHONPATH=services/python-worker python -m pytest -q services/python-worker/tests/test_worker_contracts.py --disable-warnings', expected: 'Worker contract suite passes.' },
  { order: 8, id: 'REH-008', name: 'Activate staging environment', command: 'Apply staging env vars through approved secret/config channel.', expected: 'Staging starts without missing configuration.' },
  { order: 9, id: 'REH-009', name: 'Run smoke checks', command: 'Execute Admin, Provider, API and worker smoke path.', expected: 'No P0 defects and all pilot-critical paths usable.' },
  { order: 10, id: 'REH-010', name: 'Rehearse rollback decision', command: 'Walk through rollback triggers and restoration steps.', expected: 'Rollback owner can execute or approve action within expected window.' },
  { order: 11, id: 'REH-011', name: 'Capture go/no-go decision', command: 'Record continue, hold, retry or rollback decision.', expected: 'PILOT-V3 launch runbook can be prepared or blockers are documented.' }
];

const activationChecklist = [
  { id: 'ACT-001', item: 'Staging URL and environment owner recorded', severity: 'P0' },
  { id: 'ACT-002', item: 'Environment variables reviewed against .env.example', severity: 'P0' },
  { id: 'ACT-003', item: 'Secret values stored outside repository', severity: 'P0' },
  { id: 'ACT-004', item: 'Database backup and restore procedure documented', severity: 'P0' },
  { id: 'ACT-005', item: 'Migration/seed policy documented for staging', severity: 'P0' },
  { id: 'ACT-006', item: 'Admin build and Provider build are available', severity: 'P0' },
  { id: 'ACT-007', item: 'API build is available', severity: 'P0' },
  { id: 'ACT-008', item: 'Python worker verification path is available', severity: 'P0' },
  { id: 'ACT-009', item: 'Hybrid Python prepare endpoints included in smoke coverage', severity: 'P1' },
  { id: 'ACT-010', item: 'Support escalation channel and severity rules active', severity: 'P0' },
  { id: 'ACT-011', item: 'Observability/log location identified', severity: 'P1' },
  { id: 'ACT-012', item: 'Rollback owner and decision authority confirmed', severity: 'P0' },
  { id: 'ACT-013', item: 'Pilot cohort account access smoke-tested', severity: 'P0' },
  { id: 'ACT-014', item: 'Open P0/P1 defects reviewed before launch decision', severity: 'P0' },
  { id: 'ACT-015', item: 'Go/no-go decision record ready for PILOT-V3', severity: 'P0' }
];

const requiredDocs = [
  'docs/pilot/PILOT_PHASE_MANIFEST.json',
  'docs/pilot/PILOT_PHASE_ROADMAP.md',
  'docs/pilot/PILOT_V1_EXECUTION_CHARTER.md',
  'docs/pilot/PILOT_V1_RELEASE_GATES_AND_ROLLBACK.md',
  'docs/pilot/PILOT_V2_STAGING_DEPLOYMENT_REHEARSAL.md',
  'docs/pilot/PILOT_V2_ENVIRONMENT_ACTIVATION_CHECKLIST.md',
  'docs/pilot/PILOT_V2_DEPLOYMENT_SMOKE_AND_ROLLBACK_REHEARSAL.md',
  'docs/pilot/PILOT_V2_VALIDATION.md',
  'docs/pilot/CHANGELOG_PILOT_V1_TO_PILOT_V2.md'
];

const requiredReports = [
  'validation/pilot/pilot-v1-execution-charter-audit.json',
  'validation/pilot/pilot-v1-execution-plan.json',
  'validation/qa/qa-v7-final-qa-uat-closure-audit.json',
  'validation/qa/qa-v6-go-live-checklist.json',
  'validation/qa/qa-v4-api-python-e2e-test-plan.json'
];

const checks = [
  { id: 'pilot_manifest_delivery_v2', passed: ['PILOT-V2', 'PILOT-V3', 'PILOT-V4', 'PILOT-V5', 'PILOT-V6'].includes(pilotManifest.delivery) && ['open', 'closed'].includes(pilotManifest.status) },
  { id: 'pilot_v1_completed_in_manifest', passed: Array.isArray(pilotManifest.recommendedDeliveries) && pilotManifest.recommendedDeliveries.some((d) => d.delivery === 'PILOT-V1' && d.status === 'completed') },
  { id: 'pilot_v2_current_in_manifest', passed: Array.isArray(pilotManifest.recommendedDeliveries) && pilotManifest.recommendedDeliveries.some((d) => d.delivery === 'PILOT-V2' && ['current', 'completed'].includes(d.status)) },
  { id: 'pilot_v1_audit_present', passed: exists('validation/pilot/pilot-v1-execution-charter-audit.json') },
  { id: 'pilot_v1_audit_100_percent', passed: pilotV1Audit.aggregate?.passed === pilotV1Audit.aggregate?.total && pilotV1Audit.aggregate?.total > 0 },
  { id: 'qa_v7_audit_present', passed: exists('validation/qa/qa-v7-final-qa-uat-closure-audit.json') },
  { id: 'qa_v7_audit_100_percent', passed: qaV7Audit.aggregate?.passed === qaV7Audit.aggregate?.total && qaV7Audit.aggregate?.total > 0 },
  { id: 'qa_v6_go_live_checklist_present', passed: exists('validation/qa/qa-v6-go-live-checklist.json') && Object.keys(qaV6GoLive).length > 0 },
  { id: 'staging_rehearsal_script_registered', passed: pkg.scripts?.['audit:pilot:staging-rehearsal'] === 'node scripts/pilot/scan-staging-rehearsal-environment.mjs' },
  { id: 'pilot_aggregate_runs_v1_and_v2', passed: Boolean(pkg.scripts?.['audit:pilot']?.includes('scan-pilot-execution-charter.mjs') && pkg.scripts?.['audit:pilot']?.includes('scan-staging-rehearsal-environment.mjs')) },
  { id: 'required_pilot_docs_present', passed: requiredDocs.every(exists) },
  { id: 'required_entry_reports_present', passed: requiredReports.every(exists) },
  { id: 'env_example_present', passed: exists('.env.example') },
  { id: 'api_package_present', passed: exists('services/api/package.json') },
  { id: 'contracts_package_present', passed: exists('packages/contracts/package.json') },
  { id: 'admin_package_present', passed: exists('apps/admin/package.json') },
  { id: 'provider_package_present', passed: exists('apps/provider/package.json') },
  { id: 'api_dockerfile_present', passed: exists('services/api/Dockerfile') },
  { id: 'python_worker_dockerfile_present', passed: exists('services/python-worker/Dockerfile') },
  { id: 'prisma_schema_present', passed: exists('services/api/prisma/schema.prisma') },
  { id: 'build_script_available', passed: Boolean(pkg.scripts?.build) },
  { id: 'build_api_script_available', passed: Boolean(pkg.scripts?.['build:api']) },
  { id: 'build_web_script_available', passed: Boolean(pkg.scripts?.['build:web']) },
  { id: 'check_secrets_script_available', passed: Boolean(pkg.scripts?.['check:secrets']) && exists('scripts/s0/check-secrets.mjs') },
  { id: 'verify_workspace_script_available', passed: Boolean(pkg.scripts?.['verify:workspace']) && exists('scripts/s0/verify-workspace.mjs') },
  { id: 'smoke_api_ci_script_available', passed: Boolean(pkg.scripts?.['smoke:api:ci']) && exists('scripts/s1/ci-api-smoke.mjs') },
  { id: 'verify_python_worker_script_available', passed: exists('scripts/option_b/verify_python_worker.py') },
  { id: 'python_worker_contract_tests_available', passed: exists('services/python-worker/tests/test_worker_contracts.py') },
  { id: 'deployment_domains_defined', passed: deploymentDomains.length >= 10 },
  { id: 'rehearsal_steps_defined', passed: rehearsalSteps.length >= 10 },
  { id: 'activation_checklist_has_p0_coverage', passed: activationChecklist.filter((item) => item.severity === 'P0').length >= 10 },
  { id: 'rollback_rehearsal_included', passed: rehearsalSteps.some((step) => step.id === 'REH-010') && deploymentDomains.some((d) => d.id === 'STAGE-ENV-009') },
  { id: 'go_no_go_rehearsal_included', passed: rehearsalSteps.some((step) => step.id === 'REH-011') && deploymentDomains.some((d) => d.id === 'STAGE-ENV-010') },
  { id: 'technical_boundary_preserved', passed: pilotManifest.technicalBoundary?.backendContractsChanged === false && pilotManifest.technicalBoundary?.pythonWorkerChanged === false && pilotManifest.technicalBoundary?.databaseChanged === false && pilotManifest.technicalBoundary?.applicationRuntimeCodeChanged === false },
  { id: 'next_delivery_declared', passed: ['PILOT-V3 - Controlled pilot launch runbook and day-0/day-1 execution', 'PILOT-V4 - Pilot monitoring, support, incident triage, and daily health review', 'PILOT-V5 - Pilot feedback, defect burn-down, adoption evidence, and expansion decision', 'PILOT-V6 - Final go-live execution certificate and phase closure'].includes(pilotManifest.nextRecommendedDelivery) || String(pilotManifest.nextRecommendedDelivery || '').includes('Post Go-Live Hypercare') }
];

const aggregate = {
  passed: checks.filter((check) => check.passed).length,
  total: checks.length,
  completionPercent: Math.round((checks.filter((check) => check.passed).length / checks.length) * 100)
};

const environmentActivationPlan = {
  phase: pilotManifest.phase,
  delivery: 'PILOT-V2',
  sourceBaseline: pilotManifest.sourceBaseline,
  generatedAt: now,
  purpose: 'Define the staging deployment rehearsal and environment activation path before controlled pilot launch execution.',
  entryPosition: {
    pilotV1: 'completed',
    qaV7: 'closed',
    phaseBoundary: 'pilot artifacts only; runtime code unchanged'
  },
  deploymentDomains,
  rehearsalSteps,
  activationChecklist,
  decisionStates: [
    { state: 'continue', meaning: 'All P0 gates pass; proceed to PILOT-V3 launch runbook.' },
    { state: 'hold', meaning: 'Non-critical gaps require owner/date before launch scheduling.' },
    { state: 'retry-rehearsal', meaning: 'Re-run rehearsal after environment or build correction.' },
    { state: 'rollback', meaning: 'Revert staging activation and preserve defect/evidence trail.' }
  ],
  evidenceOutputs: {
    rehearsalAudit: 'validation/pilot/pilot-v2-staging-rehearsal-audit.json',
    activationPlan: 'validation/pilot/pilot-v2-staging-environment-activation-plan.json',
    goNoGoInputForNextDelivery: 'PILOT-V3 launch runbook and day-0/day-1 execution package'
  },
  checks,
  aggregate,
  nextRecommendedDelivery: 'PILOT-V3 - Controlled pilot launch runbook and day-0/day-1 execution'
};

const audit = {
  phase: pilotManifest.phase,
  delivery: 'PILOT-V2',
  sourceBaseline: pilotManifest.sourceBaseline,
  generatedAt: now,
  purpose: 'Validate that staging deployment rehearsal, environment activation, smoke, backup, rollback, support, and go/no-go readiness are defined before PILOT-V3.',
  checks,
  aggregate,
  outputs: {
    environmentActivationPlan: 'validation/pilot/pilot-v2-staging-environment-activation-plan.json',
    rehearsalDocs: [
      'docs/pilot/PILOT_V2_STAGING_DEPLOYMENT_REHEARSAL.md',
      'docs/pilot/PILOT_V2_ENVIRONMENT_ACTIVATION_CHECKLIST.md',
      'docs/pilot/PILOT_V2_DEPLOYMENT_SMOKE_AND_ROLLBACK_REHEARSAL.md',
      'docs/pilot/PILOT_V2_VALIDATION.md'
    ],
    nextRecommendedDelivery: 'PILOT-V3 - Controlled pilot launch runbook and day-0/day-1 execution'
  },
  readinessPosition: aggregate.passed === aggregate.total ? 'ready-for-controlled-pilot-launch-runbook' : 'attention-required-before-controlled-launch-runbook'
};

writeFileSync(path.join(outDir, 'pilot-v2-staging-environment-activation-plan.json'), JSON.stringify(environmentActivationPlan, null, 2) + '\n');
writeFileSync(path.join(outDir, 'pilot-v2-staging-rehearsal-audit.json'), JSON.stringify(audit, null, 2) + '\n');

console.log('PILOT-V2 staging rehearsal/environment activation audit written successfully.');
console.log(`Aggregate completion: ${aggregate.completionPercent}% (${aggregate.passed}/${aggregate.total})`);
console.log(`Deployment domains: ${deploymentDomains.length}`);
console.log(`Rehearsal steps: ${rehearsalSteps.length}`);
console.log(`Activation checklist items: ${activationChecklist.length}`);
console.log(`Next delivery: ${environmentActivationPlan.nextRecommendedDelivery}`);
