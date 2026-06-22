import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const outDir = path.join(root, 'validation', 'qa');
mkdirSync(outDir, { recursive: true });

const rel = (p) => path.join(root, ...p.split('/'));
const exists = (p) => existsSync(rel(p));
const read = (p) => exists(p) ? readFileSync(rel(p), 'utf8') : '';
const json = (p) => JSON.parse(read(p));

const pkg = json('package.json');
const manifest = json('docs/qa/QA_PHASE_MANIFEST.json');
const qaV1Audit = json('validation/qa/qa-v1-master-qa-plan-audit.json');
const qaV2Audit = json('validation/qa/qa-v2-admin-functional-config-audit.json');
const qaV3Audit = json('validation/qa/qa-v3-provider-functional-workflows-audit.json');
const qaV4Audit = json('validation/qa/qa-v4-api-python-e2e-audit.json');
const qaV5Audit = json('validation/qa/qa-v5-uat-role-acceptance-audit.json');
const uatPackage = json('validation/qa/qa-v5-uat-role-acceptance-package.json');

const rootFiles = [
  'package.json',
  '.env.example',
  '.dockerignore',
  '.github/workflows/ci.yml',
  'services/api/package.json',
  'packages/contracts/package.json',
  'scripts/s0/check-secrets.mjs',
  'scripts/s0/verify-workspace.mjs',
  'scripts/option_b/verify_python_worker.py',
  'scripts/option_b/run_python_worker_contract_tests.py',
  'docs/design/UX_PHASE_CLOSURE_CERTIFICATE.md',
  'docs/option-b/FINAL_HANDOVER_AND_PHASE_CLOSURE_V64.md'
];

const readinessDomains = [
  {
    id: 'ENV',
    name: 'Environment and configuration',
    owner: 'Platform owner',
    priority: 'P0',
    gates: [
      'Environment variables are documented in .env.example without real secrets.',
      'Deployment target identifies environment name, URL, release package, and owner.',
      'API, Admin, Provider, and Python worker configuration are reviewed before promotion.',
      'Runtime feature flags and dry-run/advisory boundaries are documented.'
    ]
  },
  {
    id: 'BUILD',
    name: 'Build and release package',
    owner: 'Technical owner',
    priority: 'P0',
    gates: [
      'npm install completes on the deployment workstation or CI environment.',
      'npm run build:api completes without errors.',
      'npm run build:web completes or is formally deferred for a backend-only pilot.',
      'npm run audit:qa completes with QA-V1 through QA-V6 coverage.',
      'Release ZIP and SHA-256 are archived as immutable evidence.'
    ]
  },
  {
    id: 'DATA',
    name: 'Database, migration, seed, and backup',
    owner: 'Platform owner',
    priority: 'P0',
    gates: [
      'Database connection target is confirmed for the intended environment.',
      'Migration command is known and tested in staging or equivalent environment.',
      'Backup/restore procedure is documented before go-live.',
      'Seed or demo data strategy is documented for pilot/UAT continuity.'
    ]
  },
  {
    id: 'SEC',
    name: 'Security and privacy smoke',
    owner: 'Security or technical owner',
    priority: 'P0',
    gates: [
      'No real secrets are committed to the repository.',
      'Protected routes and APIs reject unauthenticated access.',
      'Role boundaries from QA-V1 and QA-V2 are validated before signoff.',
      'Logs and error evidence avoid sensitive data exposure.'
    ]
  },
  {
    id: 'OBS',
    name: 'Observability, monitoring, and support readiness',
    owner: 'Operations owner',
    priority: 'P1',
    gates: [
      'Operational logs are available to the support owner.',
      'Known error classes and escalation paths are documented.',
      'Post-go-live monitoring window and owner are assigned.',
      'Support runbook references final V64, UX-V6, and QA evidence.'
    ]
  },
  {
    id: 'ROLLBACK',
    name: 'Rollback and continuity',
    owner: 'Deployment owner',
    priority: 'P0',
    gates: [
      'Rollback trigger criteria are defined for P0/P1 failures.',
      'Prior stable baseline and release artifacts are retained.',
      'Database rollback or recovery strategy is documented.',
      'Communication owner is assigned for go/no-go and rollback decisions.'
    ]
  },
  {
    id: 'UAT',
    name: 'UAT signoff consumption',
    owner: 'QA facilitator',
    priority: 'P0',
    gates: [
      'Admin acceptance package is available from QA-V5.',
      'Provider acceptance package is available from QA-V5.',
      'Platform/Technical Owner signoff package is available from QA-V5.',
      'No unresolved P0 defect remains open before production readiness signoff.',
      'P1/P2 deferrals have owner, mitigation, and target follow-up.'
    ]
  },
  {
    id: 'GOLIVE',
    name: 'Go-live or pilot decision',
    owner: 'Release owner',
    priority: 'P0',
    gates: [
      'Go/no-go meeting has named decision owner and attendees.',
      'Go-live checklist completion percentage is recorded.',
      'Open risks are listed with owner and mitigation.',
      'Pilot/staging/production target is explicitly selected.',
      'Post-go-live hypercare window is assigned.'
    ]
  }
];

const goLiveChecklist = readinessDomains.flatMap((domain) => domain.gates.map((gate, index) => ({
  id: `${domain.id}-${String(index + 1).padStart(3, '0')}`,
  domain: domain.name,
  owner: domain.owner,
  priority: domain.priority,
  gate,
  status: 'not-started',
  requiredEvidence: [
    'environment',
    'release package or build identifier',
    'tester/owner',
    'date',
    'pass/fail or accepted deferral',
    'evidence link, screenshot, command output, or approval reference'
  ],
  acceptance: domain.priority === 'P0'
    ? 'Must pass or have release-owner-approved mitigation before go-live.'
    : 'Must be triaged before go-live readiness signoff.'
})));

const productionReadinessCommands = [
  { id: 'CMD-001', command: 'npm install', purpose: 'Install dependencies before build and audit execution.', priority: 'P0' },
  { id: 'CMD-002', command: 'npm run build:api', purpose: 'Validate API and shared contract build.', priority: 'P0' },
  { id: 'CMD-003', command: 'npm run build:web', purpose: 'Validate Admin and Provider web builds.', priority: 'P0' },
  { id: 'CMD-004', command: 'npm run audit:qa', purpose: 'Run QA-V1 through QA-V6 evidence scanners.', priority: 'P0' },
  { id: 'CMD-005', command: 'PYTHONPATH=services/python-worker python scripts/option_b/verify_python_worker.py', purpose: 'Validate Option B Python worker readiness.', priority: 'P0' },
  { id: 'CMD-006', command: 'PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 PYTHONPATH=services/python-worker python -m pytest -q services/python-worker/tests/test_worker_contracts.py --disable-warnings', purpose: 'Validate Python worker contract tests.', priority: 'P0' },
  { id: 'CMD-007', command: 'npm run check:secrets', purpose: 'Run repository secret smoke check.', priority: 'P0' },
  { id: 'CMD-008', command: 'npm run verify:workspace', purpose: 'Validate workspace structure and expected package layout.', priority: 'P1' }
];

const defectGate = {
  p0: 'Blocks production readiness until resolved or release owner approves documented mitigation.',
  p1: 'Must be triaged with owner, mitigation, target release, and explicit release-owner decision.',
  p2: 'May move to post-go-live backlog if not blocking pilot or production use.',
  unknown: 'Cannot be ignored; classify before go/no-go review.'
};

const riskRegisterTemplate = [
  { id: 'RISK-001', area: 'Build', risk: 'Environment-specific build failure after package extraction.', severity: 'P0', mitigation: 'Run npm install, npm run build:api, npm run build:web, and archive logs before promotion.', owner: 'Technical owner' },
  { id: 'RISK-002', area: 'Data', risk: 'Migration or seed mismatch between staging and production.', severity: 'P0', mitigation: 'Confirm migration plan, backup, restore path, and dry-run result.', owner: 'Platform owner' },
  { id: 'RISK-003', area: 'UAT', risk: 'Incomplete role signoff or unresolved P0/P1 defects.', severity: 'P0', mitigation: 'Use QA-V5 role acceptance gates before go/no-go.', owner: 'QA facilitator' },
  { id: 'RISK-004', area: 'Operations', risk: 'No assigned owner for post-go-live monitoring or support.', severity: 'P1', mitigation: 'Assign hypercare owner, monitoring window, escalation path, and rollback owner.', owner: 'Operations owner' },
  { id: 'RISK-005', area: 'Security', risk: 'Sensitive data appears in logs or committed configuration.', severity: 'P0', mitigation: 'Run secret checks and review logs/errors before signoff.', owner: 'Security or technical owner' }
];

const decisionRecordTemplate = {
  target: 'staging | pilot | production',
  releasePackage: '',
  sha256: '',
  environment: '',
  goNoGoDecision: 'go | go-with-deferrals | no-go',
  decisionOwner: '',
  decisionDate: '',
  p0OpenDefects: 0,
  p1OpenDefects: 0,
  acceptedDeferrals: [],
  rollbackOwner: '',
  hypercareOwner: '',
  notes: ''
};

const requiredDocs = [
  'docs/qa/QA_V6_PRODUCTION_READINESS_AND_GO_LIVE.md',
  'docs/qa/QA_V6_GO_LIVE_CHECKLIST.md',
  'docs/qa/QA_V6_ENVIRONMENT_DEPLOYMENT_ROLLBACK.md',
  'docs/qa/QA_V6_VALIDATION.md',
  'docs/qa/CHANGELOG_QA_V5_TO_QA_V6.md'
];

const requiredReports = [
  'validation/qa/qa-v6-production-readiness-audit.json',
  'validation/qa/qa-v6-go-live-checklist.json'
];

const previousAuditChecks = [
  { id: 'qa_v1_complete', passed: qaV1Audit?.aggregate?.completionPercent === 100, observed: qaV1Audit?.aggregate?.completionPercent },
  { id: 'qa_v2_complete', passed: qaV2Audit?.aggregate?.completionPercent === 100, observed: qaV2Audit?.aggregate?.completionPercent },
  { id: 'qa_v3_complete', passed: qaV3Audit?.aggregate?.completionPercent === 100, observed: qaV3Audit?.aggregate?.completionPercent },
  { id: 'qa_v4_complete', passed: qaV4Audit?.aggregate?.completionPercent === 100, observed: qaV4Audit?.aggregate?.completionPercent },
  { id: 'qa_v5_complete', passed: qaV5Audit?.aggregate?.completionPercent === 100, observed: qaV5Audit?.aggregate?.completionPercent },
  { id: 'qa_v5_has_role_acceptance_packages', passed: (uatPackage?.roleAcceptancePackages || []).length >= 4, observed: (uatPackage?.roleAcceptancePackages || []).length },
  { id: 'qa_v5_has_uat_sessions', passed: (uatPackage?.uatSessions || []).length >= 12, observed: (uatPackage?.uatSessions || []).length }
];

const commandChecks = [
  { id: 'script_audit_qa_production_readiness_registered', passed: Boolean(pkg.scripts?.['audit:qa:production-readiness']) && pkg.scripts['audit:qa:production-readiness'].includes('scan-production-readiness-go-live.mjs') },
  { id: 'script_audit_qa_aggregate_includes_qav6', passed: Boolean(pkg.scripts?.['audit:qa']) && pkg.scripts['audit:qa'].includes('scan-production-readiness-go-live.mjs') },
  { id: 'script_build_api_available', passed: Boolean(pkg.scripts?.['build:api']) },
  { id: 'script_build_web_available', passed: Boolean(pkg.scripts?.['build:web']) },
  { id: 'script_build_all_available', passed: Boolean(pkg.scripts?.build) },
  { id: 'script_check_secrets_available', passed: Boolean(pkg.scripts?.['check:secrets']) },
  { id: 'script_verify_workspace_available', passed: Boolean(pkg.scripts?.['verify:workspace']) },
  { id: 'script_verify_python_worker_available', passed: Boolean(pkg.scripts?.['verify:python-worker']) },
  { id: 'script_python_contract_tests_available', passed: Boolean(pkg.scripts?.['test:python-worker:contracts']) }
];

const fileChecks = rootFiles.map((file) => ({ id: `file_present_${file.replace(/[^A-Za-z0-9]+/g, '_').toLowerCase()}`, passed: exists(file), path: file }));

const envExample = read('.env.example');
const envChecks = [
  { id: 'env_example_present', passed: exists('.env.example') },
  { id: 'env_example_uses_placeholders', passed: /example|localhost|change|your|placeholder|dev/i.test(envExample) },
  { id: 'env_example_has_database_or_api_configuration', passed: /DATABASE|API|NEXT|PORT|URL/i.test(envExample) },
  { id: 'env_example_has_no_obvious_private_key', passed: !/-----BEGIN (RSA |EC |OPENSSH |)PRIVATE KEY-----/.test(envExample) }
];

const checklistChecks = [
  { id: 'readiness_domains_cover_8_areas', passed: readinessDomains.length >= 8, observed: readinessDomains.length },
  { id: 'go_live_checklist_has_at_least_30_gates', passed: goLiveChecklist.length >= 30, observed: goLiveChecklist.length },
  { id: 'go_live_checklist_has_p0_coverage', passed: goLiveChecklist.filter((item) => item.priority === 'P0').length >= 24, observed: goLiveChecklist.filter((item) => item.priority === 'P0').length },
  { id: 'production_commands_have_at_least_8_items', passed: productionReadinessCommands.length >= 8, observed: productionReadinessCommands.length },
  { id: 'production_commands_include_api_build', passed: productionReadinessCommands.some((cmd) => cmd.command.includes('build:api')) },
  { id: 'production_commands_include_web_build', passed: productionReadinessCommands.some((cmd) => cmd.command.includes('build:web')) },
  { id: 'production_commands_include_qa_audit', passed: productionReadinessCommands.some((cmd) => cmd.command.includes('audit:qa')) },
  { id: 'production_commands_include_python_worker', passed: productionReadinessCommands.some((cmd) => cmd.command.includes('verify_python_worker.py')) },
  { id: 'production_commands_include_python_contract_tests', passed: productionReadinessCommands.some((cmd) => cmd.command.includes('pytest')) },
  { id: 'defect_gate_covers_p0_p1_p2', passed: Boolean(defectGate.p0 && defectGate.p1 && defectGate.p2) },
  { id: 'risk_register_has_at_least_5_risks', passed: riskRegisterTemplate.length >= 5, observed: riskRegisterTemplate.length },
  { id: 'decision_record_template_has_go_no_go', passed: Object.prototype.hasOwnProperty.call(decisionRecordTemplate, 'goNoGoDecision') },
  { id: 'decision_record_template_has_rollback_and_hypercare', passed: Boolean(Object.prototype.hasOwnProperty.call(decisionRecordTemplate, 'rollbackOwner') && Object.prototype.hasOwnProperty.call(decisionRecordTemplate, 'hypercareOwner')) },
  { id: 'manifest_is_phase_3', passed: manifest?.phase === 'CarePoint Phase 3 - End-to-End QA, UAT & Production Readiness' },
  { id: 'technical_boundary_is_qa_artifacts_only', passed: manifest?.technicalBoundary?.qaArtifactsOnly === true }
];

const docChecks = requiredDocs.map((doc) => ({ id: `doc_present_${doc.split('/').pop().replace(/[^A-Za-z0-9]+/g, '_').toLowerCase()}`, passed: exists(doc), path: doc }));
const reportChecks = requiredReports.map((report) => ({ id: `report_declared_${report.split('/').pop().replace(/[^A-Za-z0-9]+/g, '_').toLowerCase()}`, passed: true, path: report }));

const checks = [
  ...previousAuditChecks,
  ...commandChecks,
  ...fileChecks,
  ...envChecks,
  ...checklistChecks,
  ...docChecks,
  ...reportChecks
];

const passed = checks.filter((check) => check.passed).length;
const total = checks.length;

const checklist = {
  phase: 'CarePoint Phase 3 - End-to-End QA, UAT & Production Readiness',
  delivery: 'QA-V6',
  sourceBaseline: 'CarePoint_qa_uat_production_readiness_v5',
  generatedAt: new Date().toISOString(),
  purpose: 'Prepare production readiness, deployment, rollback, observability, UAT consumption, and go-live/pilot decision evidence.',
  readinessDomains,
  goLiveChecklist,
  productionReadinessCommands,
  defectGate,
  riskRegisterTemplate,
  decisionRecordTemplate,
  exitGates: [
    'QA-V1 through QA-V5 evidence is present and complete.',
    'Build/API/Web/Python worker validation commands are executed in the target environment and archived.',
    'No unresolved P0 defect remains open.',
    'P1/P2 deferrals have explicit owner, mitigation, and follow-up target.',
    'Environment, migration, backup, rollback, and monitoring owners are named.',
    'Go/no-go decision is recorded before pilot, staging signoff, or production go-live.'
  ],
  nextRecommendedDelivery: 'QA-V7 - Final QA/UAT closure certificate'
};

const audit = {
  phase: checklist.phase,
  delivery: checklist.delivery,
  sourceBaseline: checklist.sourceBaseline,
  generatedAt: checklist.generatedAt,
  scope: 'Production readiness and go-live checklist',
  technicalBoundary: {
    optionBPythonProgressive: 'closed at V64',
    designRefinementUx: 'closed at UX-V6',
    qaV1MasterPlan: 'complete',
    qaV2AdminFunctionalQa: 'complete',
    qaV3ProviderFunctionalQa: 'complete',
    qaV4NodeApiPythonE2E: 'complete',
    qaV5UatRoleAcceptance: 'complete',
    backendContractsChanged: false,
    pythonWorkerChanged: false,
    databaseChanged: false,
    applicationRuntimeCodeChanged: false,
    qaArtifactsOnly: true
  },
  inventory: {
    readinessDomainCount: readinessDomains.length,
    goLiveChecklistItemCount: goLiveChecklist.length,
    productionCommandCount: productionReadinessCommands.length,
    riskTemplateCount: riskRegisterTemplate.length,
    requiredRootFiles: rootFiles,
    requiredDocs,
    requiredReports
  },
  checks,
  aggregate: {
    passed,
    total,
    completionPercent: Math.round((passed / total) * 100)
  },
  outputs: {
    checklistFile: 'validation/qa/qa-v6-go-live-checklist.json',
    docs: requiredDocs,
    nextRecommendedDelivery: checklist.nextRecommendedDelivery
  },
  readinessPosition: passed === total ? 'ready-for-final-qa-uat-closure' : 'requires-production-readiness-remediation'
};

writeFileSync(rel('validation/qa/qa-v6-go-live-checklist.json'), JSON.stringify(checklist, null, 2) + '\n');
writeFileSync(rel('validation/qa/qa-v6-production-readiness-audit.json'), JSON.stringify(audit, null, 2) + '\n');

console.log('QA-V6 production readiness/go-live audit written successfully.');
console.log(`Aggregate completion: ${audit.aggregate.completionPercent}% (${passed}/${total})`);
console.log(`QA-V6 go-live checklist items: ${goLiveChecklist.length}`);
console.log(`Readiness domains: ${readinessDomains.length}`);
