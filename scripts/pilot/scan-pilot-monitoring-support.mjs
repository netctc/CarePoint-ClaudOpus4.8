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
const v3Audit = exists('validation/pilot/pilot-v3-controlled-launch-audit.json') ? json('validation/pilot/pilot-v3-controlled-launch-audit.json') : {};
const v3Runbook = exists('validation/pilot/pilot-v3-day0-day1-execution-runbook.json') ? json('validation/pilot/pilot-v3-day0-day1-execution-runbook.json') : {};
const qaV7Audit = exists('validation/qa/qa-v7-final-qa-uat-closure-audit.json') ? json('validation/qa/qa-v7-final-qa-uat-closure-audit.json') : {};

const monitoringDomains = [
  { id: 'MON-001', domain: 'Availability', owner: 'Technical owner', cadence: 'continuous during support window', signal: 'app reachable, login reachable, Admin/Provider shells reachable', threshold: 'no repeated P0 access failures' },
  { id: 'MON-002', domain: 'Authentication and RBAC', owner: 'QA/UAT owner', cadence: 'daily plus incident-triggered', signal: 'login, logout, protected route, role boundary smoke', threshold: 'zero known role-boundary breach' },
  { id: 'MON-003', domain: 'Provider clinical workflows', owner: 'Pilot owner', cadence: 'daily', signal: 'dashboard, queue, calendar, prescriptions, encounter notes', threshold: 'no P0 clinical workflow blocker' },
  { id: 'MON-004', domain: 'Admin operational workflows', owner: 'Pilot owner', cadence: 'daily', signal: 'accounts, audit logs, reports, settings/configuration', threshold: 'no P0 admin blocker' },
  { id: 'MON-005', domain: 'API and Python worker', owner: 'Technical owner', cadence: 'daily and after support incidents', signal: 'build/API smoke, hybrid prepare endpoints, worker verification evidence', threshold: 'all critical smoke checks pass or have owner-approved waiver' },
  { id: 'MON-006', domain: 'Data integrity and audit evidence', owner: 'QA/UAT owner', cadence: 'daily', signal: 'audit visibility, evidence completeness, no data loss indicators', threshold: 'zero unresolved data integrity incidents' },
  { id: 'MON-007', domain: 'UX/accessibility smoke', owner: 'QA/UAT owner', cadence: 'daily sampling', signal: 'critical navigation, focus, responsive layout, forms/tables', threshold: 'no P0 usability blocker for pilot cohort' },
  { id: 'MON-008', domain: 'Support load and incident aging', owner: 'Support owner', cadence: 'daily', signal: 'open incidents, time to owner assignment, time to triage, escalation count', threshold: 'no unowned P0/P1 incidents' },
  { id: 'MON-009', domain: 'Adoption and usage evidence', owner: 'Pilot owner', cadence: 'daily', signal: 'pilot user activity, workflow completion, stakeholder feedback', threshold: 'sufficient activity to support continue/hold/expand decision' }
];

const supportWorkflows = [
  { id: 'SUP-001', name: 'Intake', owner: 'Support owner', expectedEvidence: ['reporter', 'role', 'environment', 'workflow', 'timestamp', 'severity candidate'] },
  { id: 'SUP-002', name: 'Classify severity', owner: 'Support owner', expectedEvidence: ['P0/P1/P2/P3 classification', 'impact summary', 'pilot cohort affected'] },
  { id: 'SUP-003', name: 'Assign owner', owner: 'Support owner', expectedEvidence: ['named owner', 'target update time', 'escalation path'] },
  { id: 'SUP-004', name: 'Reproduce or verify', owner: 'QA/UAT owner', expectedEvidence: ['steps attempted', 'actual result', 'expected result', 'screenshot/log reference'] },
  { id: 'SUP-005', name: 'Technical diagnosis', owner: 'Technical owner', expectedEvidence: ['logs reviewed', 'API/Python signal', 'data/audit signal', 'probable cause'] },
  { id: 'SUP-006', name: 'Decision', owner: 'Pilot owner', expectedEvidence: ['continue', 'hold', 'hotfix', 'rollback', 'defer', 'close'] },
  { id: 'SUP-007', name: 'Resolution evidence', owner: 'Assigned owner', expectedEvidence: ['fix/waiver/defer rationale', 'verification evidence', 'user confirmation if applicable'] },
  { id: 'SUP-008', name: 'Daily rollup', owner: 'Pilot owner', expectedEvidence: ['open incidents', 'closed incidents', 'aged items', 'next action summary'] }
];

const incidentTriageRules = [
  { id: 'TRIAGE-001', severity: 'P0', condition: 'Authentication outage blocks pilot cohort', decision: 'hold-or-rollback', sla: 'immediate owner assignment' },
  { id: 'TRIAGE-002', severity: 'P0', condition: 'Role boundary failure or data exposure risk', decision: 'rollback', sla: 'immediate owner assignment' },
  { id: 'TRIAGE-003', severity: 'P0', condition: 'Clinical workflow blocker for Provider pilot flow', decision: 'hold-or-hotfix', sla: 'same support window' },
  { id: 'TRIAGE-004', severity: 'P0', condition: 'Data integrity issue or suspected loss', decision: 'rollback-or-pause', sla: 'immediate escalation' },
  { id: 'TRIAGE-005', severity: 'P1', condition: 'Admin/reporting blocker with workaround', decision: 'continue-with-fix-owner', sla: 'same day triage' },
  { id: 'TRIAGE-006', severity: 'P1', condition: 'API/Python warning affecting non-blocking path', decision: 'continue-with-monitoring', sla: 'same day triage' },
  { id: 'TRIAGE-007', severity: 'P1', condition: 'Support/evidence capture gap', decision: 'hold-expansion', sla: 'same day correction' },
  { id: 'TRIAGE-008', severity: 'P2', condition: 'UX polish or minor usability issue', decision: 'track-for-burn-down', sla: 'prioritize before expansion if repeated' },
  { id: 'TRIAGE-009', severity: 'P2', condition: 'Documentation or training clarification', decision: 'update-runbook-or-FAQ', sla: 'before next daily review' },
  { id: 'TRIAGE-010', severity: 'P3', condition: 'Non-blocking enhancement request', decision: 'post-close-backlog', sla: 'review in PILOT-V5 feedback package' }
];

const dailyHealthReviewItems = [
  { id: 'DHR-001', section: 'Pilot status', owner: 'Pilot owner', evidence: 'continue/hold/hotfix/rollback/expand-prep decision state' },
  { id: 'DHR-002', section: 'Cohort access', owner: 'Support owner', evidence: 'access issues count and status' },
  { id: 'DHR-003', section: 'Admin workflow health', owner: 'QA/UAT owner', evidence: 'Admin smoke result and blockers' },
  { id: 'DHR-004', section: 'Provider workflow health', owner: 'QA/UAT owner', evidence: 'Provider smoke result and blockers' },
  { id: 'DHR-005', section: 'API/Python health', owner: 'Technical owner', evidence: 'API/Python smoke or verification reference' },
  { id: 'DHR-006', section: 'Incident register', owner: 'Support owner', evidence: 'new/open/closed incidents by severity' },
  { id: 'DHR-007', section: 'P0/P1 aging', owner: 'Support owner', evidence: 'unresolved P0/P1 age and owner' },
  { id: 'DHR-008', section: 'Data/audit integrity', owner: 'QA/UAT owner', evidence: 'audit/evidence visibility and data integrity note' },
  { id: 'DHR-009', section: 'User feedback', owner: 'Pilot owner', evidence: 'representative feedback from Admin/Provider/Operator' },
  { id: 'DHR-010', section: 'Adoption evidence', owner: 'Pilot owner', evidence: 'usage/workflow completion observations' },
  { id: 'DHR-011', section: 'Risks and mitigations', owner: 'Pilot owner', evidence: 'new risks, owner, mitigation, decision needed' },
  { id: 'DHR-012', section: 'Next 24 hours', owner: 'Pilot owner', evidence: 'planned actions and next review time' }
];

const healthDecisionStates = [
  { state: 'green', meaning: 'Pilot continues; no P0/P1 blockers; support and monitoring are stable.' },
  { state: 'yellow', meaning: 'Pilot continues with active P1/P2 monitoring or limited workaround.' },
  { state: 'red-hold', meaning: 'Pilot remains deployed but access/expansion pauses until blocker is resolved.' },
  { state: 'rollback', meaning: 'Pilot should be reverted according to approved rollback path.' },
  { state: 'hotfix-window', meaning: 'A controlled correction is required before normal continuation.' }
];

const requiredDocs = [
  'docs/pilot/PILOT_PHASE_MANIFEST.json',
  'docs/pilot/PILOT_V1_EXECUTION_CHARTER.md',
  'docs/pilot/PILOT_V2_STAGING_DEPLOYMENT_REHEARSAL.md',
  'docs/pilot/PILOT_V3_CONTROLLED_LAUNCH_RUNBOOK.md',
  'docs/pilot/PILOT_V4_MONITORING_SUPPORT_AND_INCIDENT_TRIAGE.md',
  'docs/pilot/PILOT_V4_DAILY_HEALTH_REVIEW.md',
  'docs/pilot/PILOT_V4_INCIDENT_TRIAGE_AND_SUPPORT_MODEL.md',
  'docs/pilot/PILOT_V4_VALIDATION.md',
  'docs/pilot/CHANGELOG_PILOT_V3_TO_PILOT_V4.md'
];

const requiredReports = [
  'validation/pilot/pilot-v1-execution-charter-audit.json',
  'validation/pilot/pilot-v2-staging-rehearsal-audit.json',
  'validation/pilot/pilot-v3-controlled-launch-audit.json',
  'validation/pilot/pilot-v3-day0-day1-execution-runbook.json',
  'validation/qa/qa-v7-final-qa-uat-closure-audit.json',
  'validation/qa/qa-v6-go-live-checklist.json',
  'validation/qa/qa-v5-uat-role-acceptance-package.json'
];

const expectedAggregatePrefix = 'node scripts/pilot/scan-pilot-execution-charter.mjs && node scripts/pilot/scan-staging-rehearsal-environment.mjs && node scripts/pilot/scan-controlled-launch-runbook.mjs && node scripts/pilot/scan-pilot-monitoring-support.mjs';

const checks = [
  { id: 'pilot_manifest_delivery_v4_or_later', passed: ['PILOT-V4', 'PILOT-V5', 'PILOT-V6'].includes(pilotManifest.delivery) && ['open', 'closed'].includes(pilotManifest.status) },
  { id: 'pilot_v1_completed_in_manifest', passed: Array.isArray(pilotManifest.recommendedDeliveries) && pilotManifest.recommendedDeliveries.some((d) => d.delivery === 'PILOT-V1' && d.status === 'completed') },
  { id: 'pilot_v2_completed_in_manifest', passed: Array.isArray(pilotManifest.recommendedDeliveries) && pilotManifest.recommendedDeliveries.some((d) => d.delivery === 'PILOT-V2' && d.status === 'completed') },
  { id: 'pilot_v3_completed_in_manifest', passed: Array.isArray(pilotManifest.recommendedDeliveries) && pilotManifest.recommendedDeliveries.some((d) => d.delivery === 'PILOT-V3' && d.status === 'completed') },
  { id: 'pilot_v4_current_or_completed_in_manifest', passed: Array.isArray(pilotManifest.recommendedDeliveries) && pilotManifest.recommendedDeliveries.some((d) => d.delivery === 'PILOT-V4' && ['current', 'completed'].includes(d.status)) },
  { id: 'pilot_v1_audit_100_percent', passed: v1Audit.aggregate?.passed === v1Audit.aggregate?.total && v1Audit.aggregate?.total > 0 },
  { id: 'pilot_v2_audit_100_percent', passed: v2Audit.aggregate?.passed === v2Audit.aggregate?.total && v2Audit.aggregate?.total > 0 },
  { id: 'pilot_v3_audit_100_percent', passed: v3Audit.aggregate?.passed === v3Audit.aggregate?.total && v3Audit.aggregate?.total > 0 },
  { id: 'pilot_v3_runbook_available', passed: exists('validation/pilot/pilot-v3-day0-day1-execution-runbook.json') && Object.keys(v3Runbook).length > 0 },
  { id: 'qa_v7_closure_100_percent', passed: qaV7Audit.aggregate?.passed === qaV7Audit.aggregate?.total && qaV7Audit.aggregate?.total > 0 },
  { id: 'monitoring_support_script_registered', passed: pkg.scripts?.['audit:pilot:monitoring-support'] === 'node scripts/pilot/scan-pilot-monitoring-support.mjs' },
  { id: 'pilot_aggregate_runs_v1_v2_v3_v4', passed: Boolean(pkg.scripts?.['audit:pilot']?.startsWith(expectedAggregatePrefix)) },
  { id: 'required_docs_present', passed: requiredDocs.every(exists) },
  { id: 'required_reports_present', passed: requiredReports.every(exists) },
  { id: 'monitoring_domains_defined', passed: monitoringDomains.length >= 9 },
  { id: 'monitoring_domains_have_owners', passed: monitoringDomains.every((item) => Boolean(item.owner && item.threshold)) },
  { id: 'support_workflows_defined', passed: supportWorkflows.length >= 8 },
  { id: 'support_workflows_have_evidence_schema', passed: supportWorkflows.every((item) => Array.isArray(item.expectedEvidence) && item.expectedEvidence.length >= 3) },
  { id: 'incident_triage_rules_defined', passed: incidentTriageRules.length >= 10 },
  { id: 'incident_triage_has_p0_coverage', passed: incidentTriageRules.filter((item) => item.severity === 'P0').length >= 4 },
  { id: 'incident_triage_has_p1_p2_p3_coverage', passed: ['P1', 'P2', 'P3'].every((sev) => incidentTriageRules.some((item) => item.severity === sev)) },
  { id: 'daily_health_review_items_defined', passed: dailyHealthReviewItems.length >= 12 },
  { id: 'daily_health_covers_admin_provider_api_python', passed: ['Admin workflow health', 'Provider workflow health', 'API/Python health'].every((section) => dailyHealthReviewItems.some((item) => item.section === section)) },
  { id: 'daily_health_covers_incidents_and_feedback', passed: ['Incident register', 'User feedback', 'Adoption evidence'].every((section) => dailyHealthReviewItems.some((item) => item.section === section)) },
  { id: 'health_decision_states_defined', passed: healthDecisionStates.length >= 5 },
  { id: 'rollback_state_available', passed: healthDecisionStates.some((item) => item.state === 'rollback') },
  { id: 'check_secrets_script_available', passed: Boolean(pkg.scripts?.['check:secrets']) && exists('scripts/s0/check-secrets.mjs') },
  { id: 'build_api_script_available', passed: Boolean(pkg.scripts?.['build:api']) },
  { id: 'build_web_script_available', passed: Boolean(pkg.scripts?.['build:web']) },
  { id: 'audit_qa_script_available', passed: Boolean(pkg.scripts?.['audit:qa']) },
  { id: 'verify_python_worker_script_available', passed: exists('scripts/option_b/verify_python_worker.py') },
  { id: 'python_worker_contract_tests_available', passed: exists('services/python-worker/tests/test_worker_contracts.py') },
  { id: 'go_live_checklist_available', passed: exists('validation/qa/qa-v6-go-live-checklist.json') },
  { id: 'uat_acceptance_package_available', passed: exists('validation/qa/qa-v5-uat-role-acceptance-package.json') },
  { id: 'technical_boundary_preserved', passed: pilotManifest.technicalBoundary?.backendContractsChanged === false && pilotManifest.technicalBoundary?.pythonWorkerChanged === false && pilotManifest.technicalBoundary?.databaseChanged === false && pilotManifest.technicalBoundary?.applicationRuntimeCodeChanged === false },
  { id: 'pilot_artifacts_only_boundary_preserved', passed: pilotManifest.technicalBoundary?.pilotArtifactsOnly === true },
  { id: 'next_delivery_declared', passed: ['PILOT-V5 - Pilot feedback, defect burn-down, adoption evidence, and expansion decision', 'PILOT-V6 - Final go-live execution certificate and phase closure'].includes(pilotManifest.nextRecommendedDelivery) || String(pilotManifest.nextRecommendedDelivery || '').includes('Post Go-Live Hypercare') }
];

const aggregate = {
  passed: checks.filter((check) => check.passed).length,
  total: checks.length,
  completionPercent: Math.round((checks.filter((check) => check.passed).length / checks.length) * 100)
};

const dailyHealthReviewPlan = {
  phase: pilotManifest.phase,
  delivery: 'PILOT-V4',
  sourceBaseline: pilotManifest.sourceBaseline,
  generatedAt: now,
  purpose: 'Operate the controlled pilot after day-0/day-1 launch using monitoring, support intake, incident triage, and daily health review evidence.',
  entryPosition: {
    pilotV1: 'completed',
    pilotV2: 'completed',
    pilotV3: 'completed',
    qaV7: 'closed',
    executionMode: 'monitoring and support governance; no runtime code change in this package'
  },
  monitoringDomains,
  supportWorkflows,
  incidentTriageRules,
  dailyHealthReviewItems,
  healthDecisionStates,
  evidenceOutputs: {
    audit: 'validation/pilot/pilot-v4-monitoring-support-audit.json',
    dailyHealthReviewPlan: 'validation/pilot/pilot-v4-daily-health-review-plan.json',
    nextDeliveryInput: 'PILOT-V5 pilot feedback, defect burn-down, adoption evidence, and expansion decision'
  },
  checks,
  aggregate,
  nextRecommendedDelivery: 'PILOT-V5 - Pilot feedback, defect burn-down, adoption evidence, and expansion decision'
};

const audit = {
  phase: pilotManifest.phase,
  delivery: 'PILOT-V4',
  sourceBaseline: pilotManifest.sourceBaseline,
  generatedAt: now,
  purpose: 'Validate that pilot monitoring, support intake, incident triage, daily health review, decision states, and evidence gates are present after controlled launch execution.',
  checks,
  aggregate,
  outputs: {
    dailyHealthReviewPlan: 'validation/pilot/pilot-v4-daily-health-review-plan.json',
    monitoringDocs: [
      'docs/pilot/PILOT_V4_MONITORING_SUPPORT_AND_INCIDENT_TRIAGE.md',
      'docs/pilot/PILOT_V4_DAILY_HEALTH_REVIEW.md',
      'docs/pilot/PILOT_V4_INCIDENT_TRIAGE_AND_SUPPORT_MODEL.md',
      'docs/pilot/PILOT_V4_VALIDATION.md'
    ],
    nextRecommendedDelivery: 'PILOT-V5 - Pilot feedback, defect burn-down, adoption evidence, and expansion decision'
  },
  readinessPosition: aggregate.passed === aggregate.total ? 'ready-for-pilot-feedback-defect-burndown-and-expansion-decision' : 'attention-required-before-feedback-and-expansion-decision'
};

writeFileSync(path.join(outDir, 'pilot-v4-daily-health-review-plan.json'), JSON.stringify(dailyHealthReviewPlan, null, 2) + '\n');
writeFileSync(path.join(outDir, 'pilot-v4-monitoring-support-audit.json'), JSON.stringify(audit, null, 2) + '\n');

console.log('PILOT-V4 monitoring/support/incident triage audit written successfully.');
console.log(`Aggregate completion: ${aggregate.completionPercent}% (${aggregate.passed}/${aggregate.total})`);
console.log(`Monitoring domains: ${monitoringDomains.length}`);
console.log(`Support workflows: ${supportWorkflows.length}`);
console.log(`Incident triage rules: ${incidentTriageRules.length}`);
console.log(`Daily health review items: ${dailyHealthReviewItems.length}`);
console.log(`Next delivery: ${dailyHealthReviewPlan.nextRecommendedDelivery}`);
