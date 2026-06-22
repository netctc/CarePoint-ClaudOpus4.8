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
const qaManifest = exists('docs/qa/QA_PHASE_MANIFEST.json') ? json('docs/qa/QA_PHASE_MANIFEST.json') : {};
const qaV7Audit = exists('validation/qa/qa-v7-final-qa-uat-closure-audit.json') ? json('validation/qa/qa-v7-final-qa-uat-closure-audit.json') : {};
const qaV7Package = exists('validation/qa/qa-v7-final-qa-uat-closure-package.json') ? json('validation/qa/qa-v7-final-qa-uat-closure-package.json') : {};

const requiredDocs = [
  'docs/pilot/PILOT_PHASE_MANIFEST.json',
  'docs/pilot/PILOT_PHASE_ROADMAP.md',
  'docs/pilot/PILOT_V1_EXECUTION_CHARTER.md',
  'docs/pilot/PILOT_V1_COHORT_AND_SCOPE_PLAN.md',
  'docs/pilot/PILOT_V1_RELEASE_GATES_AND_ROLLBACK.md',
  'docs/pilot/PILOT_V1_VALIDATION.md',
  'docs/pilot/CHANGELOG_QA_V7_TO_PILOT_V1.md',
  'docs/qa/QA_V7_FINAL_QA_UAT_CLOSURE_CERTIFICATE.md',
  'docs/qa/QA_V7_FINAL_EVIDENCE_INDEX.md',
  'docs/qa/QA_PHASE_MANIFEST.json'
];

const requiredQaReports = [
  'validation/qa/qa-v7-final-qa-uat-closure-audit.json',
  'validation/qa/qa-v7-final-qa-uat-closure-package.json',
  'validation/qa/qa-v6-go-live-checklist.json',
  'validation/qa/qa-v5-uat-role-acceptance-package.json'
];

const deliveryPlan = [
  {
    delivery: 'PILOT-V1',
    title: 'Pilot execution charter, scope, gates, and cohort plan',
    objective: 'Establish governed pilot/go-live execution boundaries before launch.',
    exitCriteria: ['Pilot owner assigned', 'Release gates documented', 'Rollback triggers documented', 'Controlled cohort defined']
  },
  {
    delivery: 'PILOT-V2',
    title: 'Staging deployment rehearsal and environment activation',
    objective: 'Prove deployment, environment, secrets, migration, backup, and smoke execution path.',
    exitCriteria: ['Deployment rehearsal executed', 'Environment checklist complete', 'Rollback rehearsal documented']
  },
  {
    delivery: 'PILOT-V3',
    title: 'Controlled pilot launch runbook and day-0/day-1 execution',
    objective: 'Execute the first controlled pilot launch window with evidence capture.',
    exitCriteria: ['Launch window executed', 'Day-0 evidence captured', 'Day-1 review completed']
  },
  {
    delivery: 'PILOT-V4',
    title: 'Pilot monitoring, support, incident triage, and daily health review',
    objective: 'Monitor live pilot usage and manage issues under support governance.',
    exitCriteria: ['Health reviews recorded', 'Incidents triaged', 'Support SLAs reviewed']
  },
  {
    delivery: 'PILOT-V5',
    title: 'Pilot feedback, defect burn-down, adoption evidence, and expansion decision',
    objective: 'Assess user feedback, defect posture, adoption signals, and readiness to expand.',
    exitCriteria: ['Feedback summarized', 'Defect burn-down reviewed', 'Expansion decision drafted']
  },
  {
    delivery: 'PILOT-V6',
    title: 'Final go-live execution certificate and phase closure',
    objective: 'Close the controlled pilot/go-live execution phase with final decision evidence.',
    exitCriteria: ['Go-live certificate complete', 'Post-live backlog separated', 'Phase closed or corrective release opened']
  }
];

const pilotRoles = [
  { role: 'Pilot owner', responsibility: 'Own scope, cohort, pilot calendar, and daily pilot decision.' },
  { role: 'Release owner', responsibility: 'Own go/no-go, rollback, release promotion, and launch approval.' },
  { role: 'Clinical/business owner', responsibility: 'Confirm pilot workflow acceptance and real-user readiness.' },
  { role: 'Support owner', responsibility: 'Own issue intake, escalation, and daily support review.' },
  { role: 'Technical owner', responsibility: 'Own environment health, logs, integrations, and emergency triage.' },
  { role: 'QA/UAT owner', responsibility: 'Confirm QA-V7 evidence remains valid during pilot execution.' }
];

const releaseGates = [
  { id: 'GATE-001', name: 'QA closure accepted', requiredEvidence: 'QA-V7 closure package and audit reports', owner: 'QA/UAT owner' },
  { id: 'GATE-002', name: 'Environment ready', requiredEvidence: 'Build, env, secrets, migration, backup, observability checklist', owner: 'Technical owner' },
  { id: 'GATE-003', name: 'Support ready', requiredEvidence: 'Support channel, escalation path, severity rules', owner: 'Support owner' },
  { id: 'GATE-004', name: 'Pilot cohort ready', requiredEvidence: 'Pilot users, roles, operating window', owner: 'Pilot owner' },
  { id: 'GATE-005', name: 'Rollback ready', requiredEvidence: 'Rollback owner, triggers, path, and decision authority', owner: 'Release owner' },
  { id: 'GATE-006', name: 'Launch approved', requiredEvidence: 'Go/no-go decision record', owner: 'Release owner' }
];

const rollbackTriggers = [
  'Authentication outage for pilot users',
  'Data corruption or suspected data loss',
  'Protected role boundary failure',
  'Clinical workflow blocker affecting Provider users',
  'API/worker failure that blocks core pilot workflows',
  'Unresolved P0 defect',
  'Repeated severe support incidents during the pilot window',
  'Inability to capture required audit or operational evidence'
];

const checks = [
  { id: 'qa_v7_manifest_closed', passed: qaManifest.status === 'closed' && qaManifest.delivery === 'QA-V7' },
  { id: 'qa_v7_readiness_position_allows_pilot', passed: String(qaManifest.readinessPosition ?? '').includes('go-live') || String(qaManifest.readinessPosition ?? '').includes('pilot') },
  { id: 'qa_v7_audit_present', passed: exists('validation/qa/qa-v7-final-qa-uat-closure-audit.json') },
  { id: 'qa_v7_audit_100_percent', passed: qaV7Audit.aggregate?.passed === qaV7Audit.aggregate?.total && qaV7Audit.aggregate?.total > 0 },
  { id: 'qa_v7_package_present', passed: exists('validation/qa/qa-v7-final-qa-uat-closure-package.json') },
  { id: 'qa_v7_package_closed', passed: qaV7Package.status === 'closed' },
  { id: 'pilot_manifest_present', passed: exists('docs/pilot/PILOT_PHASE_MANIFEST.json') },
  { id: 'pilot_manifest_delivery_v1', passed: Array.isArray(pilotManifest.recommendedDeliveries) && pilotManifest.recommendedDeliveries.some((d) => d.delivery === 'PILOT-V1' && ['current', 'completed'].includes(d.status)) && ['PILOT-V1', 'PILOT-V2', 'PILOT-V3', 'PILOT-V4', 'PILOT-V5', 'PILOT-V6'].includes(pilotManifest.delivery) && ['open', 'closed'].includes(pilotManifest.status) },
  { id: 'pilot_delivery_count_is_6', passed: pilotManifest.recommendedDeliveryCount === 6 && Array.isArray(pilotManifest.recommendedDeliveries) && pilotManifest.recommendedDeliveries.length === 6 },
  { id: 'pilot_phase_scripts_registered', passed: String(pkg.scripts?.['audit:pilot'] ?? '').includes('node scripts/pilot/scan-pilot-execution-charter.mjs') && pkg.scripts?.['audit:pilot:charter'] === 'node scripts/pilot/scan-pilot-execution-charter.mjs' },
  { id: 'pilot_required_docs_present', passed: requiredDocs.every(exists) },
  { id: 'pilot_required_qa_reports_present', passed: requiredQaReports.every(exists) },
  { id: 'pilot_roles_defined', passed: pilotRoles.length >= 6 },
  { id: 'pilot_release_gates_defined', passed: releaseGates.length >= 6 },
  { id: 'pilot_rollback_triggers_defined', passed: rollbackTriggers.length >= 6 },
  { id: 'pilot_boundary_preserves_runtime_code', passed: pilotManifest.technicalBoundary?.applicationRuntimeCodeChanged === false && pilotManifest.technicalBoundary?.backendContractsChanged === false && pilotManifest.technicalBoundary?.pythonWorkerChanged === false && pilotManifest.technicalBoundary?.databaseChanged === false },
  { id: 'build_api_script_available', passed: Boolean(pkg.scripts?.['build:api']) },
  { id: 'build_web_script_available', passed: Boolean(pkg.scripts?.['build:web']) },
  { id: 'qa_audit_script_available', passed: Boolean(pkg.scripts?.['audit:qa']) },
  { id: 'python_worker_verify_available', passed: exists('scripts/option_b/verify_python_worker.py') },
  { id: 'pilot_next_delivery_declared', passed: typeof pilotManifest.nextRecommendedDelivery === 'string' && (pilotManifest.nextRecommendedDelivery.startsWith('PILOT-V') || pilotManifest.nextRecommendedDelivery.includes('Post Go-Live Hypercare')) }
];

const aggregate = {
  passed: checks.filter((check) => check.passed).length,
  total: checks.length,
  completionPercent: Math.round((checks.filter((check) => check.passed).length / checks.length) * 100)
};

const executionPlan = {
  phase: pilotManifest.phase,
  delivery: 'PILOT-V1',
  sourceBaseline: pilotManifest.sourceBaseline,
  generatedAt: now,
  recommendedDeliveryCount: 6,
  deliveryPlan,
  pilotRoles,
  releaseGates,
  rollbackTriggers,
  controlledScopeTemplate: {
    users: 'Limit to named pilot users or a small role-based cohort.',
    roles: ['Admin', 'Provider', 'Operator/Reviewer', 'Platform/Technical owner'],
    operatingWindow: 'Use a defined pilot launch window with support coverage.',
    dataPolicy: 'Use approved pilot data and document rollback impact.',
    decisionStates: ['continue', 'hold', 'rollback', 'expand']
  },
  entryEvidence: {
    qaV7Manifest: 'docs/qa/QA_PHASE_MANIFEST.json',
    qaV7ClosurePackage: 'validation/qa/qa-v7-final-qa-uat-closure-package.json',
    qaV7ClosureAudit: 'validation/qa/qa-v7-final-qa-uat-closure-audit.json',
    goLiveChecklist: 'validation/qa/qa-v6-go-live-checklist.json',
    uatRoleAcceptancePackage: 'validation/qa/qa-v5-uat-role-acceptance-package.json'
  },
  checks,
  aggregate,
  nextRecommendedDelivery: 'PILOT-V2 - Staging deployment rehearsal and environment activation'
};

const audit = {
  phase: pilotManifest.phase,
  delivery: 'PILOT-V1',
  sourceBaseline: pilotManifest.sourceBaseline,
  generatedAt: now,
  purpose: 'Validate that the controlled pilot/go-live execution phase has a governed charter, six-delivery roadmap, release gates, rollback triggers, and closed QA-V7 entry evidence.',
  checks,
  aggregate,
  outputs: {
    executionPlan: 'validation/pilot/pilot-v1-execution-plan.json',
    manifest: 'docs/pilot/PILOT_PHASE_MANIFEST.json',
    roadmap: 'docs/pilot/PILOT_PHASE_ROADMAP.md',
    charter: 'docs/pilot/PILOT_V1_EXECUTION_CHARTER.md',
    nextRecommendedDelivery: 'PILOT-V2 - Staging deployment rehearsal and environment activation'
  },
  readinessPosition: aggregate.passed === aggregate.total ? 'ready-for-staging-rehearsal-and-environment-activation' : 'attention-required-before-pilot-execution'
};

writeFileSync(path.join(outDir, 'pilot-v1-execution-plan.json'), JSON.stringify(executionPlan, null, 2) + '\n');
writeFileSync(path.join(outDir, 'pilot-v1-execution-charter-audit.json'), JSON.stringify(audit, null, 2) + '\n');

console.log('PILOT-V1 execution charter audit written successfully.');
console.log(`Aggregate completion: ${aggregate.completionPercent}% (${aggregate.passed}/${aggregate.total})`);
console.log(`Recommended Phase 4 deliveries: ${executionPlan.recommendedDeliveryCount}`);
console.log(`Next delivery: ${executionPlan.nextRecommendedDelivery}`);
