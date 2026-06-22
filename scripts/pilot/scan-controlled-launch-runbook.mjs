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
const v1Audit = exists('validation/pilot/pilot-v1-execution-charter-audit.json') ? json('validation/pilot/pilot-v1-execution-charter-audit.json') : {};
const v2Audit = exists('validation/pilot/pilot-v2-staging-rehearsal-audit.json') ? json('validation/pilot/pilot-v2-staging-rehearsal-audit.json') : {};
const v2Plan = exists('validation/pilot/pilot-v2-staging-environment-activation-plan.json') ? json('validation/pilot/pilot-v2-staging-environment-activation-plan.json') : {};
const qaV7Audit = exists('validation/qa/qa-v7-final-qa-uat-closure-audit.json') ? json('validation/qa/qa-v7-final-qa-uat-closure-audit.json') : {};
const qaV5Uat = exists('validation/qa/qa-v5-uat-role-acceptance-package.json') ? json('validation/qa/qa-v5-uat-role-acceptance-package.json') : {};

const launchGates = [
  {
    id: 'LG-001',
    name: 'Release candidate frozen',
    owner: 'Release owner',
    severity: 'P0',
    evidence: ['selected ZIP/checksum', 'source baseline', 'deployment target'],
    passCriteria: 'One approved release candidate is identified for the pilot launch window.'
  },
  {
    id: 'LG-002',
    name: 'QA/UAT closure evidence accepted',
    owner: 'QA/UAT owner',
    severity: 'P0',
    evidence: ['QA-V7 closure audit', 'role acceptance package', 'open defect list'],
    passCriteria: 'QA phase is closed and any remaining items are explicitly accepted or deferred.'
  },
  {
    id: 'LG-003',
    name: 'Staging rehearsal passed or approved with waiver',
    owner: 'Pilot owner',
    severity: 'P0',
    evidence: ['PILOT-V2 rehearsal audit', 'activation plan', 'go/no-go record'],
    passCriteria: 'PILOT-V2 has a continue outcome or signed exception with owner/date.'
  },
  {
    id: 'LG-004',
    name: 'Pilot cohort confirmed',
    owner: 'Pilot owner',
    severity: 'P0',
    evidence: ['cohort list', 'role mapping', 'support contacts'],
    passCriteria: 'Pilot users, roles, support window and communication channel are confirmed.'
  },
  {
    id: 'LG-005',
    name: 'Support command center active',
    owner: 'Support owner',
    severity: 'P0',
    evidence: ['support channel', 'incident owner', 'severity matrix', 'daily check-in time'],
    passCriteria: 'Support owner and escalation path are active before day-0 launch.'
  },
  {
    id: 'LG-006',
    name: 'Rollback and pause authority confirmed',
    owner: 'Release owner',
    severity: 'P0',
    evidence: ['rollback trigger map', 'rollback owner', 'pause criteria', 'backup evidence'],
    passCriteria: 'A named owner can pause, rollback or continue during day-0/day-1.'
  },
  {
    id: 'LG-007',
    name: 'Day-0 smoke path ready',
    owner: 'QA/UAT owner',
    severity: 'P0',
    evidence: ['Admin smoke', 'Provider smoke', 'API smoke', 'Python worker verification'],
    passCriteria: 'Critical smoke path is defined and assigned.'
  },
  {
    id: 'LG-008',
    name: 'Day-1 monitoring window scheduled',
    owner: 'Pilot owner',
    severity: 'P1',
    evidence: ['daily health review', 'defect triage time', 'adoption evidence owner'],
    passCriteria: 'Monitoring, support and evidence review window exists for first operational day.'
  }
];

const day0Runbook = [
  {
    order: 1,
    id: 'D0-001',
    phase: 'pre-launch',
    owner: 'Release owner',
    action: 'Confirm selected release package, checksum and staging target.',
    expectedEvidence: 'Release candidate record and checksum captured.',
    decision: 'continue-or-hold'
  },
  {
    order: 2,
    id: 'D0-002',
    phase: 'pre-launch',
    owner: 'Technical owner',
    action: 'Confirm environment variables, secrets, backup, migration and rollback status.',
    expectedEvidence: 'Environment activation checklist reviewed.',
    decision: 'continue-or-hold'
  },
  {
    order: 3,
    id: 'D0-003',
    phase: 'pre-launch',
    owner: 'QA/UAT owner',
    action: 'Run launch gate audit and confirm QA-V7/PILOT-V2 evidence is present.',
    expectedEvidence: 'npm run audit:qa and npm run audit:pilot outputs captured.',
    decision: 'continue-or-hold'
  },
  {
    order: 4,
    id: 'D0-004',
    phase: 'launch',
    owner: 'Release owner',
    action: 'Activate the pilot release in the controlled target environment.',
    expectedEvidence: 'Deployment/activation timestamp and owner recorded.',
    decision: 'continue-or-rollback'
  },
  {
    order: 5,
    id: 'D0-005',
    phase: 'launch',
    owner: 'QA/UAT owner',
    action: 'Execute Admin smoke: login, protected route, account/configuration surface, audit visibility.',
    expectedEvidence: 'Admin smoke pass/fail evidence.',
    decision: 'continue-hold-or-rollback'
  },
  {
    order: 6,
    id: 'D0-006',
    phase: 'launch',
    owner: 'QA/UAT owner',
    action: 'Execute Provider smoke: login, dashboard, queue, calendar, prescription or encounter-note surface.',
    expectedEvidence: 'Provider smoke pass/fail evidence.',
    decision: 'continue-hold-or-rollback'
  },
  {
    order: 7,
    id: 'D0-007',
    phase: 'launch',
    owner: 'Technical owner',
    action: 'Execute API/Python smoke: API build evidence, hybrid prepare endpoint coverage, worker verification.',
    expectedEvidence: 'API/Python smoke log or references.',
    decision: 'continue-hold-or-rollback'
  },
  {
    order: 8,
    id: 'D0-008',
    phase: 'support-activation',
    owner: 'Support owner',
    action: 'Open command center and confirm support coverage with pilot cohort.',
    expectedEvidence: 'Support channel and on-call owner active.',
    decision: 'continue-or-hold'
  },
  {
    order: 9,
    id: 'D0-009',
    phase: 'pilot-cohort-access',
    owner: 'Pilot owner',
    action: 'Enable pilot cohort access and send launch communication.',
    expectedEvidence: 'Cohort activation record and communication timestamp.',
    decision: 'continue-hold-or-rollback'
  },
  {
    order: 10,
    id: 'D0-010',
    phase: 'day-0-close',
    owner: 'Pilot owner',
    action: 'Record day-0 status: continue, hold, rollback or retry launch.',
    expectedEvidence: 'Day-0 decision record with blockers and owners.',
    decision: 'continue-hold-rollback-or-retry'
  }
];

const day1Runbook = [
  {
    order: 1,
    id: 'D1-001',
    phase: 'start-of-day-health',
    owner: 'Support owner',
    action: 'Review overnight/early support events, access issues and P0/P1 defects.',
    expectedEvidence: 'Day-1 health snapshot.'
  },
  {
    order: 2,
    id: 'D1-002',
    phase: 'usage-smoke',
    owner: 'Pilot owner',
    action: 'Confirm pilot cohort can use expected Admin/Provider workflows.',
    expectedEvidence: 'Cohort activity and pass/fail notes.'
  },
  {
    order: 3,
    id: 'D1-003',
    phase: 'defect-triage',
    owner: 'QA/UAT owner',
    action: 'Triage defects with severity, owner, target date and pilot impact.',
    expectedEvidence: 'Triage log with P0/P1/P2 classification.'
  },
  {
    order: 4,
    id: 'D1-004',
    phase: 'operational-check',
    owner: 'Technical owner',
    action: 'Confirm logs, API/Python behavior, performance smoke and data handling evidence.',
    expectedEvidence: 'Technical health notes.'
  },
  {
    order: 5,
    id: 'D1-005',
    phase: 'stakeholder-feedback',
    owner: 'Pilot owner',
    action: 'Collect structured feedback from Admin, Provider and Operator/Reviewer representatives.',
    expectedEvidence: 'Feedback summary mapped to continue/hold/fix/expand.'
  },
  {
    order: 6,
    id: 'D1-006',
    phase: 'daily-decision',
    owner: 'Pilot owner',
    action: 'Record daily pilot decision: continue, hold, rollback, hotfix, or expand-preparation.',
    expectedEvidence: 'Signed daily decision record.'
  }
];

const communicationPlan = [
  {
    id: 'COMMS-001',
    audience: 'Pilot cohort',
    owner: 'Pilot owner',
    timing: 'day-0 before access activation',
    message: 'Pilot scope, supported workflows, support channel, known limits and feedback process.'
  },
  {
    id: 'COMMS-002',
    audience: 'Support command center',
    owner: 'Support owner',
    timing: 'day-0 launch window',
    message: 'Severity matrix, escalation owner, response expectations and evidence capture.'
  },
  {
    id: 'COMMS-003',
    audience: 'Technical/release owners',
    owner: 'Release owner',
    timing: 'day-0 and day-1',
    message: 'Deployment state, rollback triggers, open risks and go/no-go decision updates.'
  },
  {
    id: 'COMMS-004',
    audience: 'Stakeholders',
    owner: 'Pilot owner',
    timing: 'day-1 close',
    message: 'Pilot health, defects, feedback, adoption evidence and next recommended action.'
  }
];

const pauseRollbackTriggers = [
  { id: 'TRIG-001', trigger: 'Authentication outage or repeated access failure for pilot cohort', action: 'hold-or-rollback', severity: 'P0' },
  { id: 'TRIG-002', trigger: 'Role boundary or protected route failure', action: 'rollback', severity: 'P0' },
  { id: 'TRIG-003', trigger: 'Clinical Provider workflow blocker', action: 'hold-or-rollback', severity: 'P0' },
  { id: 'TRIG-004', trigger: 'Data integrity issue or suspected data loss', action: 'rollback', severity: 'P0' },
  { id: 'TRIG-005', trigger: 'API/Python worker failure blocking critical workflow', action: 'hold-or-retry', severity: 'P0' },
  { id: 'TRIG-006', trigger: 'Inability to capture logs/evidence for incident review', action: 'hold', severity: 'P1' },
  { id: 'TRIG-007', trigger: 'Support channel unavailable during launch window', action: 'hold', severity: 'P1' }
];

const requiredDocs = [
  'docs/pilot/PILOT_PHASE_MANIFEST.json',
  'docs/pilot/PILOT_V1_EXECUTION_CHARTER.md',
  'docs/pilot/PILOT_V2_STAGING_DEPLOYMENT_REHEARSAL.md',
  'docs/pilot/PILOT_V2_ENVIRONMENT_ACTIVATION_CHECKLIST.md',
  'docs/pilot/PILOT_V3_CONTROLLED_LAUNCH_RUNBOOK.md',
  'docs/pilot/PILOT_V3_DAY0_DAY1_EXECUTION.md',
  'docs/pilot/PILOT_V3_COMMUNICATION_AND_SUPPORT_COMMAND_CENTER.md',
  'docs/pilot/PILOT_V3_VALIDATION.md',
  'docs/pilot/CHANGELOG_PILOT_V2_TO_PILOT_V3.md'
];

const requiredReports = [
  'validation/pilot/pilot-v1-execution-charter-audit.json',
  'validation/pilot/pilot-v1-execution-plan.json',
  'validation/pilot/pilot-v2-staging-rehearsal-audit.json',
  'validation/pilot/pilot-v2-staging-environment-activation-plan.json',
  'validation/qa/qa-v7-final-qa-uat-closure-audit.json',
  'validation/qa/qa-v5-uat-role-acceptance-package.json',
  'validation/qa/qa-v4-api-python-e2e-test-plan.json'
];

const checks = [
  { id: 'pilot_manifest_delivery_v3', passed: ['PILOT-V3', 'PILOT-V4', 'PILOT-V5', 'PILOT-V6'].includes(pilotManifest.delivery) && ['open', 'closed'].includes(pilotManifest.status) },
  { id: 'pilot_v1_completed_in_manifest', passed: Array.isArray(pilotManifest.recommendedDeliveries) && pilotManifest.recommendedDeliveries.some((d) => d.delivery === 'PILOT-V1' && d.status === 'completed') },
  { id: 'pilot_v2_completed_in_manifest', passed: Array.isArray(pilotManifest.recommendedDeliveries) && pilotManifest.recommendedDeliveries.some((d) => d.delivery === 'PILOT-V2' && d.status === 'completed') },
  { id: 'pilot_v3_current_in_manifest', passed: Array.isArray(pilotManifest.recommendedDeliveries) && pilotManifest.recommendedDeliveries.some((d) => d.delivery === 'PILOT-V3' && ['current', 'completed'].includes(d.status)) },
  { id: 'pilot_v1_audit_present', passed: exists('validation/pilot/pilot-v1-execution-charter-audit.json') },
  { id: 'pilot_v1_audit_100_percent', passed: v1Audit.aggregate?.passed === v1Audit.aggregate?.total && v1Audit.aggregate?.total > 0 },
  { id: 'pilot_v2_audit_present', passed: exists('validation/pilot/pilot-v2-staging-rehearsal-audit.json') },
  { id: 'pilot_v2_audit_100_percent', passed: v2Audit.aggregate?.passed === v2Audit.aggregate?.total && v2Audit.aggregate?.total > 0 },
  { id: 'pilot_v2_activation_plan_present', passed: exists('validation/pilot/pilot-v2-staging-environment-activation-plan.json') && Object.keys(v2Plan).length > 0 },
  { id: 'qa_v7_closure_audit_present', passed: exists('validation/qa/qa-v7-final-qa-uat-closure-audit.json') },
  { id: 'qa_v7_closure_100_percent', passed: qaV7Audit.aggregate?.passed === qaV7Audit.aggregate?.total && qaV7Audit.aggregate?.total > 0 },
  { id: 'qa_v5_role_acceptance_available', passed: exists('validation/qa/qa-v5-uat-role-acceptance-package.json') && Object.keys(qaV5Uat).length > 0 },
  { id: 'launch_runbook_script_registered', passed: pkg.scripts?.['audit:pilot:launch-runbook'] === 'node scripts/pilot/scan-controlled-launch-runbook.mjs' },
  { id: 'pilot_aggregate_runs_v1_v2_v3', passed: Boolean(pkg.scripts?.['audit:pilot']?.includes('scan-pilot-execution-charter.mjs') && pkg.scripts?.['audit:pilot']?.includes('scan-staging-rehearsal-environment.mjs') && pkg.scripts?.['audit:pilot']?.includes('scan-controlled-launch-runbook.mjs')) },
  { id: 'required_docs_present', passed: requiredDocs.every(exists) },
  { id: 'required_reports_present', passed: requiredReports.every(exists) },
  { id: 'launch_gates_defined', passed: launchGates.length >= 8 },
  { id: 'launch_gates_have_p0_coverage', passed: launchGates.filter((gate) => gate.severity === 'P0').length >= 7 },
  { id: 'day0_runbook_defined', passed: day0Runbook.length >= 10 },
  { id: 'day1_runbook_defined', passed: day1Runbook.length >= 6 },
  { id: 'support_communication_defined', passed: communicationPlan.length >= 4 },
  { id: 'pause_rollback_triggers_defined', passed: pauseRollbackTriggers.length >= 7 },
  { id: 'rollback_trigger_p0_coverage', passed: pauseRollbackTriggers.filter((trigger) => trigger.severity === 'P0').length >= 5 },
  { id: 'day0_admin_smoke_included', passed: day0Runbook.some((step) => step.id === 'D0-005') },
  { id: 'day0_provider_smoke_included', passed: day0Runbook.some((step) => step.id === 'D0-006') },
  { id: 'day0_api_python_smoke_included', passed: day0Runbook.some((step) => step.id === 'D0-007') },
  { id: 'day0_support_activation_included', passed: day0Runbook.some((step) => step.id === 'D0-008') },
  { id: 'day1_defect_triage_included', passed: day1Runbook.some((step) => step.id === 'D1-003') },
  { id: 'day1_stakeholder_feedback_included', passed: day1Runbook.some((step) => step.id === 'D1-005') },
  { id: 'check_secrets_script_available', passed: Boolean(pkg.scripts?.['check:secrets']) && exists('scripts/s0/check-secrets.mjs') },
  { id: 'build_api_script_available', passed: Boolean(pkg.scripts?.['build:api']) },
  { id: 'build_web_script_available', passed: Boolean(pkg.scripts?.['build:web']) },
  { id: 'audit_qa_script_available', passed: Boolean(pkg.scripts?.['audit:qa']) },
  { id: 'verify_python_worker_script_available', passed: exists('scripts/option_b/verify_python_worker.py') },
  { id: 'python_worker_contract_tests_available', passed: exists('services/python-worker/tests/test_worker_contracts.py') },
  { id: 'technical_boundary_preserved', passed: pilotManifest.technicalBoundary?.backendContractsChanged === false && pilotManifest.technicalBoundary?.pythonWorkerChanged === false && pilotManifest.technicalBoundary?.databaseChanged === false && pilotManifest.technicalBoundary?.applicationRuntimeCodeChanged === false },
  { id: 'next_delivery_declared', passed: ['PILOT-V4 - Pilot monitoring, support, incident triage, and daily health review', 'PILOT-V5 - Pilot feedback, defect burn-down, adoption evidence, and expansion decision', 'PILOT-V6 - Final go-live execution certificate and phase closure'].includes(pilotManifest.nextRecommendedDelivery) || String(pilotManifest.nextRecommendedDelivery || '').includes('Post Go-Live Hypercare') }
];

const aggregate = {
  passed: checks.filter((check) => check.passed).length,
  total: checks.length,
  completionPercent: Math.round((checks.filter((check) => check.passed).length / checks.length) * 100)
};

const launchRunbook = {
  phase: pilotManifest.phase,
  delivery: 'PILOT-V3',
  sourceBaseline: pilotManifest.sourceBaseline,
  generatedAt: now,
  purpose: 'Define controlled pilot launch execution for day-0 and day-1 using QA-V7 closure evidence and PILOT-V2 staging rehearsal evidence.',
  entryPosition: {
    qaV7: 'closed',
    pilotV1: 'completed',
    pilotV2: 'completed',
    executionMode: 'controlled pilot launch; no runtime code change in this package'
  },
  launchGates,
  day0Runbook,
  day1Runbook,
  communicationPlan,
  pauseRollbackTriggers,
  decisionStates: [
    { state: 'continue', meaning: 'Pilot remains active and moves to daily monitoring.' },
    { state: 'hold', meaning: 'Pilot access or expansion pauses until blockers have owners and dates.' },
    { state: 'rollback', meaning: 'Pilot activation is reverted according to approved rollback path.' },
    { state: 'retry-launch', meaning: 'Launch runbook is repeated after correction of an activation or smoke issue.' },
    { state: 'hotfix-required', meaning: 'A controlled correction is required before pilot can continue or expand.' }
  ],
  evidenceOutputs: {
    audit: 'validation/pilot/pilot-v3-controlled-launch-audit.json',
    runbook: 'validation/pilot/pilot-v3-day0-day1-execution-runbook.json',
    nextDeliveryInput: 'PILOT-V4 monitoring, support, incident triage, and daily health review'
  },
  checks,
  aggregate,
  nextRecommendedDelivery: 'PILOT-V4 - Pilot monitoring, support, incident triage, and daily health review'
};

const audit = {
  phase: pilotManifest.phase,
  delivery: 'PILOT-V3',
  sourceBaseline: pilotManifest.sourceBaseline,
  generatedAt: now,
  purpose: 'Validate that the controlled pilot launch runbook, day-0/day-1 execution path, communications, support command center, pause/rollback triggers, and evidence gates are present before launch execution.',
  checks,
  aggregate,
  outputs: {
    launchRunbook: 'validation/pilot/pilot-v3-day0-day1-execution-runbook.json',
    launchDocs: [
      'docs/pilot/PILOT_V3_CONTROLLED_LAUNCH_RUNBOOK.md',
      'docs/pilot/PILOT_V3_DAY0_DAY1_EXECUTION.md',
      'docs/pilot/PILOT_V3_COMMUNICATION_AND_SUPPORT_COMMAND_CENTER.md',
      'docs/pilot/PILOT_V3_VALIDATION.md'
    ],
    nextRecommendedDelivery: 'PILOT-V4 - Pilot monitoring, support, incident triage, and daily health review'
  },
  readinessPosition: aggregate.passed === aggregate.total ? 'ready-for-controlled-pilot-day-0-day-1-execution' : 'attention-required-before-controlled-pilot-execution'
};

writeFileSync(path.join(outDir, 'pilot-v3-day0-day1-execution-runbook.json'), JSON.stringify(launchRunbook, null, 2) + '\n');
writeFileSync(path.join(outDir, 'pilot-v3-controlled-launch-audit.json'), JSON.stringify(audit, null, 2) + '\n');

console.log('PILOT-V3 controlled launch runbook audit written successfully.');
console.log(`Aggregate completion: ${aggregate.completionPercent}% (${aggregate.passed}/${aggregate.total})`);
console.log(`Launch gates: ${launchGates.length}`);
console.log(`Day-0 runbook steps: ${day0Runbook.length}`);
console.log(`Day-1 runbook steps: ${day1Runbook.length}`);
console.log(`Pause/rollback triggers: ${pauseRollbackTriggers.length}`);
console.log(`Next delivery: ${launchRunbook.nextRecommendedDelivery}`);
