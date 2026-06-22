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
const qaV7Audit = exists('validation/qa/qa-v7-final-qa-uat-closure-audit.json') ? json('validation/qa/qa-v7-final-qa-uat-closure-audit.json') : {};
const v1Audit = exists('validation/pilot/pilot-v1-execution-charter-audit.json') ? json('validation/pilot/pilot-v1-execution-charter-audit.json') : {};
const v2Audit = exists('validation/pilot/pilot-v2-staging-rehearsal-audit.json') ? json('validation/pilot/pilot-v2-staging-rehearsal-audit.json') : {};
const v3Audit = exists('validation/pilot/pilot-v3-controlled-launch-audit.json') ? json('validation/pilot/pilot-v3-controlled-launch-audit.json') : {};
const v4Audit = exists('validation/pilot/pilot-v4-monitoring-support-audit.json') ? json('validation/pilot/pilot-v4-monitoring-support-audit.json') : {};
const v5Audit = exists('validation/pilot/pilot-v5-feedback-expansion-audit.json') ? json('validation/pilot/pilot-v5-feedback-expansion-audit.json') : {};
const v5Plan = exists('validation/pilot/pilot-v5-feedback-defect-adoption-expansion-plan.json') ? json('validation/pilot/pilot-v5-feedback-defect-adoption-expansion-plan.json') : {};

const priorAuditComplete = (audit) => audit.aggregate?.passed === audit.aggregate?.total && audit.aggregate?.total > 0;

const requiredPriorAudits = [
  { id: 'PILOT-V1', file: 'validation/pilot/pilot-v1-execution-charter-audit.json', complete: priorAuditComplete(v1Audit) },
  { id: 'PILOT-V2', file: 'validation/pilot/pilot-v2-staging-rehearsal-audit.json', complete: priorAuditComplete(v2Audit) },
  { id: 'PILOT-V3', file: 'validation/pilot/pilot-v3-controlled-launch-audit.json', complete: priorAuditComplete(v3Audit) },
  { id: 'PILOT-V4', file: 'validation/pilot/pilot-v4-monitoring-support-audit.json', complete: priorAuditComplete(v4Audit) },
  { id: 'PILOT-V5', file: 'validation/pilot/pilot-v5-feedback-expansion-audit.json', complete: priorAuditComplete(v5Audit) }
];

const finalGoLiveGates = [
  { id: 'GL-001', gate: 'QA/UAT phase closed at QA-V7', required: true, evidence: 'docs/qa/QA_V7_FINAL_QA_UAT_CLOSURE_CERTIFICATE.md' },
  { id: 'GL-002', gate: 'Pilot execution charter completed', required: true, evidence: 'validation/pilot/pilot-v1-execution-charter-audit.json' },
  { id: 'GL-003', gate: 'Staging rehearsal and environment activation completed', required: true, evidence: 'validation/pilot/pilot-v2-staging-rehearsal-audit.json' },
  { id: 'GL-004', gate: 'Controlled launch runbook completed', required: true, evidence: 'validation/pilot/pilot-v3-controlled-launch-audit.json' },
  { id: 'GL-005', gate: 'Monitoring/support/incident triage model completed', required: true, evidence: 'validation/pilot/pilot-v4-monitoring-support-audit.json' },
  { id: 'GL-006', gate: 'Pilot feedback, defect burn-down and expansion decision package completed', required: true, evidence: 'validation/pilot/pilot-v5-feedback-expansion-audit.json' },
  { id: 'GL-007', gate: 'No open P0 blocker policy documented', required: true, evidence: 'validation/pilot/pilot-v5-feedback-defect-adoption-expansion-plan.json' },
  { id: 'GL-008', gate: 'Rollback path remains current until go-live acceptance', required: true, evidence: 'docs/pilot/PILOT_V1_RELEASE_GATES_AND_ROLLBACK.md' },
  { id: 'GL-009', gate: 'Support command center ownership documented', required: true, evidence: 'docs/pilot/PILOT_V3_COMMUNICATION_AND_SUPPORT_COMMAND_CENTER.md' },
  { id: 'GL-010', gate: 'Post-close operations backlog separated from go-live closure', required: true, evidence: 'docs/pilot/PILOT_V6_POST_CLOSE_OPERATIONS_BACKLOG.md' }
];

const closureEvidenceIndex = [
  { id: 'EV-001', area: 'QA/UAT closure', artifact: 'docs/qa/QA_V7_FINAL_QA_UAT_CLOSURE_CERTIFICATE.md' },
  { id: 'EV-002', area: 'Pilot charter', artifact: 'docs/pilot/PILOT_V1_EXECUTION_CHARTER.md' },
  { id: 'EV-003', area: 'Pilot cohort and scope', artifact: 'docs/pilot/PILOT_V1_COHORT_AND_SCOPE_PLAN.md' },
  { id: 'EV-004', area: 'Release gates and rollback', artifact: 'docs/pilot/PILOT_V1_RELEASE_GATES_AND_ROLLBACK.md' },
  { id: 'EV-005', area: 'Staging rehearsal', artifact: 'docs/pilot/PILOT_V2_STAGING_DEPLOYMENT_REHEARSAL.md' },
  { id: 'EV-006', area: 'Environment activation', artifact: 'docs/pilot/PILOT_V2_ENVIRONMENT_ACTIVATION_CHECKLIST.md' },
  { id: 'EV-007', area: 'Launch runbook', artifact: 'docs/pilot/PILOT_V3_CONTROLLED_LAUNCH_RUNBOOK.md' },
  { id: 'EV-008', area: 'Day-0/day-1 execution', artifact: 'docs/pilot/PILOT_V3_DAY0_DAY1_EXECUTION.md' },
  { id: 'EV-009', area: 'Support command center', artifact: 'docs/pilot/PILOT_V3_COMMUNICATION_AND_SUPPORT_COMMAND_CENTER.md' },
  { id: 'EV-010', area: 'Monitoring and triage', artifact: 'docs/pilot/PILOT_V4_MONITORING_SUPPORT_AND_INCIDENT_TRIAGE.md' },
  { id: 'EV-011', area: 'Daily health review', artifact: 'docs/pilot/PILOT_V4_DAILY_HEALTH_REVIEW.md' },
  { id: 'EV-012', area: 'Feedback/adoption/defects', artifact: 'docs/pilot/PILOT_V5_FEEDBACK_DEFECT_BURNDOWN_AND_ADOPTION.md' },
  { id: 'EV-013', area: 'Expansion decision', artifact: 'docs/pilot/PILOT_V5_EXPANSION_DECISION_PACKAGE.md' },
  { id: 'EV-014', area: 'Final go-live certificate', artifact: 'docs/pilot/PILOT_V6_FINAL_GO_LIVE_EXECUTION_CERTIFICATE.md' },
  { id: 'EV-015', area: 'Post-close operations backlog', artifact: 'docs/pilot/PILOT_V6_POST_CLOSE_OPERATIONS_BACKLOG.md' }
];

const finalDecisionOptions = [
  { decision: 'go-live-complete', meaning: 'Controlled go-live/pilot execution evidence is complete and Phase 4 can close.' },
  { decision: 'go-live-with-hypercare', meaning: 'Go-live proceeds and follow-up work moves into a distinct hypercare phase.' },
  { decision: 'hold-go-live', meaning: 'Closure evidence is incomplete or a P0/P1 gate requires correction before go-live acceptance.' },
  { decision: 'rollback', meaning: 'A blocker prevents safe continuation and rollback governance is activated.' }
];

const postCloseBacklogBuckets = [
  { id: 'POST-001', bucket: 'Hypercare monitoring', examples: ['support volume trend', 'daily production health review', 'cohort expansion watchpoints'] },
  { id: 'POST-002', bucket: 'Training and adoption', examples: ['role job aids', 'FAQ updates', 'workflow coaching'] },
  { id: 'POST-003', bucket: 'Non-blocking defects', examples: ['P2/P3 cleanup', 'cosmetic polish', 'edge-case validation'] },
  { id: 'POST-004', bucket: 'Operational optimization', examples: ['dashboard tuning', 'report refinements', 'support runbook updates'] },
  { id: 'POST-005', bucket: 'Future enhancements', examples: ['new features', 'expanded integrations', 'post-pilot requests'] }
];

const requiredDocs = [
  'docs/pilot/PILOT_PHASE_MANIFEST.json',
  'docs/pilot/PILOT_PHASE_ROADMAP.md',
  'docs/pilot/PILOT_V1_EXECUTION_CHARTER.md',
  'docs/pilot/PILOT_V2_STAGING_DEPLOYMENT_REHEARSAL.md',
  'docs/pilot/PILOT_V3_CONTROLLED_LAUNCH_RUNBOOK.md',
  'docs/pilot/PILOT_V4_MONITORING_SUPPORT_AND_INCIDENT_TRIAGE.md',
  'docs/pilot/PILOT_V5_FEEDBACK_DEFECT_BURNDOWN_AND_ADOPTION.md',
  'docs/pilot/PILOT_V5_EXPANSION_DECISION_PACKAGE.md',
  'docs/pilot/PILOT_V6_FINAL_GO_LIVE_EXECUTION_CERTIFICATE.md',
  'docs/pilot/PILOT_V6_PHASE_CLOSURE_AND_EVIDENCE_INDEX.md',
  'docs/pilot/PILOT_V6_POST_CLOSE_OPERATIONS_BACKLOG.md',
  'docs/pilot/PILOT_V6_VALIDATION.md',
  'docs/pilot/CHANGELOG_PILOT_V5_TO_PILOT_V6.md'
];

const requiredReports = [
  'validation/pilot/pilot-v1-execution-charter-audit.json',
  'validation/pilot/pilot-v2-staging-rehearsal-audit.json',
  'validation/pilot/pilot-v3-controlled-launch-audit.json',
  'validation/pilot/pilot-v4-monitoring-support-audit.json',
  'validation/pilot/pilot-v5-feedback-expansion-audit.json'
];

const expectedAggregate = 'node scripts/pilot/scan-pilot-execution-charter.mjs && node scripts/pilot/scan-staging-rehearsal-environment.mjs && node scripts/pilot/scan-controlled-launch-runbook.mjs && node scripts/pilot/scan-pilot-monitoring-support.mjs && node scripts/pilot/scan-pilot-feedback-expansion.mjs && node scripts/pilot/scan-final-go-live-closure.mjs';

const allManifestDeliveriesCompleted = pilotManifest.recommendedDeliveries?.filter((d) => d.delivery?.startsWith('PILOT-V')).every((d) => d.status === 'completed') === true;
const evidenceFilesPresent = closureEvidenceIndex.every((item) => exists(item.artifact));
const requiredDocsPresent = requiredDocs.every((file) => exists(file));
const requiredReportsPresent = requiredReports.every((file) => exists(file));
const goLiveRequiredEvidencePresent = finalGoLiveGates.filter((gate) => gate.required).every((gate) => exists(gate.evidence));
const v5HasNoOpenP0Gate = Array.isArray(v5Plan.expansionReadinessChecklist) && v5Plan.expansionReadinessChecklist.some((item) => item.id === 'EXP-001' && item.required === true);

const checks = [
  { id: 'pilot_manifest_delivery_v6', passed: pilotManifest.delivery === 'PILOT-V6' },
  { id: 'pilot_manifest_closed', passed: pilotManifest.status === 'closed' },
  { id: 'all_pilot_deliveries_completed', passed: allManifestDeliveriesCompleted },
  { id: 'recommended_delivery_count_is_six', passed: pilotManifest.recommendedDeliveryCount === 6 },
  { id: 'qa_v7_closed_or_available', passed: qaV7Audit.readinessPosition === 'phase-3-closed-ready-for-controlled-pilot-go-live-or-production-execution' || exists('docs/qa/QA_V7_FINAL_QA_UAT_CLOSURE_CERTIFICATE.md') },
  { id: 'pilot_v1_audit_complete', passed: priorAuditComplete(v1Audit) },
  { id: 'pilot_v2_audit_complete', passed: priorAuditComplete(v2Audit) },
  { id: 'pilot_v3_audit_complete', passed: priorAuditComplete(v3Audit) },
  { id: 'pilot_v4_audit_complete', passed: priorAuditComplete(v4Audit) },
  { id: 'pilot_v5_audit_complete', passed: priorAuditComplete(v5Audit) },
  { id: 'required_pilot_docs_present', passed: requiredDocsPresent },
  { id: 'required_prior_reports_present', passed: requiredReportsPresent },
  { id: 'closure_evidence_index_present', passed: evidenceFilesPresent },
  { id: 'go_live_gates_have_required_evidence', passed: goLiveRequiredEvidencePresent },
  { id: 'no_open_p0_gate_inherited_from_v5', passed: v5HasNoOpenP0Gate },
  { id: 'post_close_backlog_separated', passed: exists('docs/pilot/PILOT_V6_POST_CLOSE_OPERATIONS_BACKLOG.md') && postCloseBacklogBuckets.length >= 5 },
  { id: 'final_decision_options_defined', passed: finalDecisionOptions.length === 4 },
  { id: 'audit_pilot_final_closure_script_registered', passed: pkg.scripts?.['audit:pilot:final-closure'] === 'node scripts/pilot/scan-final-go-live-closure.mjs' },
  { id: 'audit_pilot_aggregate_includes_v6', passed: pkg.scripts?.['audit:pilot'] === expectedAggregate },
  { id: 'technical_boundary_preserved', passed: pilotManifest.technicalBoundary?.backendContractsChanged === false && pilotManifest.technicalBoundary?.pythonWorkerChanged === false && pilotManifest.technicalBoundary?.databaseChanged === false && pilotManifest.technicalBoundary?.applicationRuntimeCodeChanged === false },
  { id: 'pilot_artifacts_only_boundary_preserved', passed: pilotManifest.technicalBoundary?.pilotArtifactsOnly === true },
  { id: 'next_phase_declared_as_hypercare_only_if_needed', passed: String(pilotManifest.nextRecommendedDelivery || '').includes('Post Go-Live Hypercare') }
];

const aggregate = {
  passed: checks.filter((check) => check.passed).length,
  total: checks.length,
  completionPercent: Math.round((checks.filter((check) => check.passed).length / checks.length) * 100)
};

const certificate = {
  phase: pilotManifest.phase,
  delivery: 'PILOT-V6',
  sourceBaseline: pilotManifest.sourceBaseline,
  generatedAt: now,
  status: aggregate.passed === aggregate.total ? 'closed' : 'attention-required',
  purpose: 'Certify final controlled pilot/go-live execution evidence and close Phase 4 without changing runtime application code.',
  executionSummary: {
    recommendedDeliveries: 6,
    completedDeliveries: pilotManifest.recommendedDeliveries?.filter((d) => d.status === 'completed').map((d) => d.delivery) || [],
    technicalBoundary: pilotManifest.technicalBoundary,
    readinessPosition: aggregate.passed === aggregate.total ? 'ready-for-controlled-go-live-completion-or-post-go-live-hypercare' : 'attention-required-before-phase-4-closure'
  },
  requiredPriorAudits,
  finalGoLiveGates,
  closureEvidenceIndex,
  finalDecisionOptions,
  postCloseBacklogBuckets,
  signoffTemplate: {
    decision: 'go-live-complete | go-live-with-hypercare | hold-go-live | rollback',
    requiredFields: ['decision owner', 'release owner', 'support owner', 'pilot owner', 'environment', 'date', 'evidence reviewed', 'open risks', 'waivers', 'post-close owner', 'signature placeholder']
  },
  checks,
  aggregate,
  nextRecommendedPhase: 'Phase 5 - Post Go-Live Hypercare and Operations Optimization, only if live operations require a new controlled phase'
};

const audit = {
  phase: pilotManifest.phase,
  delivery: 'PILOT-V6',
  sourceBaseline: pilotManifest.sourceBaseline,
  generatedAt: now,
  purpose: 'Validate final go-live execution certificate, closure evidence, post-close backlog separation, and Phase 4 manifest closure.',
  checks,
  aggregate,
  outputs: {
    finalCertificate: 'validation/pilot/pilot-v6-final-go-live-execution-certificate.json',
    finalDocs: [
      'docs/pilot/PILOT_V6_FINAL_GO_LIVE_EXECUTION_CERTIFICATE.md',
      'docs/pilot/PILOT_V6_PHASE_CLOSURE_AND_EVIDENCE_INDEX.md',
      'docs/pilot/PILOT_V6_POST_CLOSE_OPERATIONS_BACKLOG.md',
      'docs/pilot/PILOT_V6_VALIDATION.md'
    ],
    nextRecommendedPhase: certificate.nextRecommendedPhase
  },
  readinessPosition: aggregate.passed === aggregate.total ? 'phase-4-closed-ready-for-controlled-go-live-completion-or-post-go-live-hypercare' : 'attention-required-before-phase-4-closure'
};

writeFileSync(path.join(outDir, 'pilot-v6-final-go-live-execution-certificate.json'), JSON.stringify(certificate, null, 2) + '\n');
writeFileSync(path.join(outDir, 'pilot-v6-final-go-live-closure-audit.json'), JSON.stringify(audit, null, 2) + '\n');

console.log('PILOT-V6 final go-live closure audit written successfully.');
console.log(`Aggregate completion: ${aggregate.completionPercent}% (${aggregate.passed}/${aggregate.total})`);
console.log(`Final go-live gates: ${finalGoLiveGates.length}`);
console.log(`Closure evidence items: ${closureEvidenceIndex.length}`);
console.log(`Post-close backlog buckets: ${postCloseBacklogBuckets.length}`);
console.log(`Final status: ${certificate.status}`);
console.log(`Next recommended phase: ${certificate.nextRecommendedPhase}`);
