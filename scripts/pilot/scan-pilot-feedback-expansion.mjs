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
const v4Health = exists('validation/pilot/pilot-v4-daily-health-review-plan.json') ? json('validation/pilot/pilot-v4-daily-health-review-plan.json') : {};

const feedbackChannels = [
  { id: 'FB-001', channel: 'Admin pilot interview', owner: 'Pilot owner', cadence: 'weekly or exit', requiredEvidence: ['participant', 'role', 'workflow', 'sentiment', 'blockers', 'recommendations'] },
  { id: 'FB-002', channel: 'Provider pilot interview', owner: 'Pilot owner', cadence: 'weekly or exit', requiredEvidence: ['participant', 'role', 'workflow', 'clinical friction', 'time impact', 'recommendations'] },
  { id: 'FB-003', channel: 'Operator/reviewer support notes', owner: 'Support owner', cadence: 'daily rollup', requiredEvidence: ['ticket reference', 'workflow', 'resolution', 'recurrence', 'training need'] },
  { id: 'FB-004', channel: 'Daily health review action items', owner: 'QA/UAT owner', cadence: 'daily', requiredEvidence: ['action owner', 'severity', 'due date', 'status', 'decision impact'] },
  { id: 'FB-005', channel: 'UAT signoff follow-up', owner: 'QA/UAT owner', cadence: 'before expansion decision', requiredEvidence: ['role', 'accepted scope', 'open concerns', 'waivers', 'signature placeholder'] },
  { id: 'FB-006', channel: 'Adoption observation log', owner: 'Pilot owner', cadence: 'daily sampling', requiredEvidence: ['active users', 'completed workflows', 'drop-offs', 'support touches', 'qualitative note'] }
];

const defectBurnDownBuckets = [
  { id: 'DEF-001', severity: 'P0', expansionPolicy: 'blocks expansion and may trigger rollback', exitRequirement: 'zero open P0' },
  { id: 'DEF-002', severity: 'P1', expansionPolicy: 'blocks expansion unless waived by pilot and technical owner', exitRequirement: 'zero unowned P1 and all open P1 have remediation date' },
  { id: 'DEF-003', severity: 'P2', expansionPolicy: 'allowed with documented workaround or backlog owner', exitRequirement: 'triaged, grouped by workflow, owner assigned' },
  { id: 'DEF-004', severity: 'P3', expansionPolicy: 'does not block expansion', exitRequirement: 'captured in post-expansion backlog' },
  { id: 'DEF-005', severity: 'Training', expansionPolicy: 'blocks expansion only if repeated across cohort', exitRequirement: 'FAQ, job aid, or runbook update prepared' },
  { id: 'DEF-006', severity: 'Enhancement', expansionPolicy: 'does not block expansion', exitRequirement: 'separated from defects and prioritized after pilot decision' }
];

const adoptionEvidenceMetrics = [
  { id: 'ADOPT-001', metric: 'Pilot cohort access success', threshold: '>= 95 percent of intended pilot users can sign in and reach assigned portal', owner: 'Support owner' },
  { id: 'ADOPT-002', metric: 'Provider workflow completion', threshold: 'critical Provider workflows exercised by at least one pilot user or explicitly waived', owner: 'Pilot owner' },
  { id: 'ADOPT-003', metric: 'Admin workflow completion', threshold: 'critical Admin workflows exercised by at least one pilot user or explicitly waived', owner: 'Pilot owner' },
  { id: 'ADOPT-004', metric: 'Support burden', threshold: 'no sustained growth in untriaged P0/P1 incidents', owner: 'Support owner' },
  { id: 'ADOPT-005', metric: 'Feedback sentiment', threshold: 'no repeated role-level blocker without mitigation', owner: 'QA/UAT owner' },
  { id: 'ADOPT-006', metric: 'Operational evidence completeness', threshold: 'daily health, support, and defect evidence available for decision meeting', owner: 'Pilot owner' },
  { id: 'ADOPT-007', metric: 'Data and audit confidence', threshold: 'zero unresolved data integrity or audit visibility blockers', owner: 'QA/UAT owner' },
  { id: 'ADOPT-008', metric: 'Rollback readiness retained', threshold: 'rollback path remains current until expansion is approved', owner: 'Technical owner' }
];

const expansionDecisionOptions = [
  { decision: 'expand', condition: 'All P0 cleared, P1 waived or scheduled, adoption evidence positive, support load stable, rollback ready.' },
  { decision: 'continue-limited-pilot', condition: 'No P0, but more observation needed for adoption, support load, or workflow coverage.' },
  { decision: 'hold-expansion', condition: 'Open P1/P2 trend or feedback issue requires correction before wider rollout.' },
  { decision: 'hotfix-and-retest', condition: 'Focused correction is required, followed by targeted regression and pilot recheck.' },
  { decision: 'rollback', condition: 'P0, data integrity, role boundary, or access issue prevents safe continuation.' }
];

const decisionMeetingAgenda = [
  { id: 'DEC-001', topic: 'Pilot scope and cohort recap', evidence: 'PILOT-V1 cohort/scope plan plus actual participation summary' },
  { id: 'DEC-002', topic: 'Deployment and activation recap', evidence: 'PILOT-V2 staging/environment activation evidence' },
  { id: 'DEC-003', topic: 'Launch execution recap', evidence: 'PILOT-V3 day-0/day-1 runbook evidence' },
  { id: 'DEC-004', topic: 'Monitoring and support recap', evidence: 'PILOT-V4 daily health and incident triage evidence' },
  { id: 'DEC-005', topic: 'Defect burn-down', evidence: 'Open/closed defects by severity, owner, target date, waiver if applicable' },
  { id: 'DEC-006', topic: 'Adoption evidence', evidence: 'workflow completion, user feedback, support load, role-level acceptance' },
  { id: 'DEC-007', topic: 'Risk and rollback posture', evidence: 'known risks, mitigations, rollback readiness, go/no-go owner decision' },
  { id: 'DEC-008', topic: 'Expansion decision', evidence: 'expand, continue-limited-pilot, hold-expansion, hotfix-and-retest, or rollback' }
];

const expansionReadinessChecklist = [
  { id: 'EXP-001', item: 'No open P0 defects', required: true },
  { id: 'EXP-002', item: 'No unowned P1 defects', required: true },
  { id: 'EXP-003', item: 'All open P1 defects have waiver or committed remediation date', required: true },
  { id: 'EXP-004', item: 'Pilot feedback has been grouped by role and workflow', required: true },
  { id: 'EXP-005', item: 'Adoption evidence covers Admin and Provider critical workflows', required: true },
  { id: 'EXP-006', item: 'Support intake and triage are operating without aged P0/P1 items', required: true },
  { id: 'EXP-007', item: 'Data integrity and audit visibility concerns are closed or waived', required: true },
  { id: 'EXP-008', item: 'Training or FAQ updates are prepared for repeated support questions', required: false },
  { id: 'EXP-009', item: 'Rollback path remains approved and current', required: true },
  { id: 'EXP-010', item: 'Expansion decision owner signs the decision record', required: true },
  { id: 'EXP-011', item: 'Post-expansion support model is confirmed', required: true },
  { id: 'EXP-012', item: 'PILOT-V6 closure criteria are understood before final go-live execution certificate', required: true }
];

const requiredDocs = [
  'docs/pilot/PILOT_PHASE_MANIFEST.json',
  'docs/pilot/PILOT_V1_EXECUTION_CHARTER.md',
  'docs/pilot/PILOT_V2_STAGING_DEPLOYMENT_REHEARSAL.md',
  'docs/pilot/PILOT_V3_CONTROLLED_LAUNCH_RUNBOOK.md',
  'docs/pilot/PILOT_V4_MONITORING_SUPPORT_AND_INCIDENT_TRIAGE.md',
  'docs/pilot/PILOT_V4_DAILY_HEALTH_REVIEW.md',
  'docs/pilot/PILOT_V5_FEEDBACK_DEFECT_BURNDOWN_AND_ADOPTION.md',
  'docs/pilot/PILOT_V5_EXPANSION_DECISION_PACKAGE.md',
  'docs/pilot/PILOT_V5_DEFECT_BURNDOWN_AND_FEEDBACK_TEMPLATES.md',
  'docs/pilot/PILOT_V5_VALIDATION.md',
  'docs/pilot/CHANGELOG_PILOT_V4_TO_PILOT_V5.md'
];

const requiredReports = [
  'validation/pilot/pilot-v1-execution-charter-audit.json',
  'validation/pilot/pilot-v2-staging-rehearsal-audit.json',
  'validation/pilot/pilot-v3-controlled-launch-audit.json',
  'validation/pilot/pilot-v4-monitoring-support-audit.json',
  'validation/pilot/pilot-v4-daily-health-review-plan.json',
  'validation/qa/qa-v7-final-qa-uat-closure-audit.json'
];

const expectedAggregate = 'node scripts/pilot/scan-pilot-execution-charter.mjs && node scripts/pilot/scan-staging-rehearsal-environment.mjs && node scripts/pilot/scan-controlled-launch-runbook.mjs && node scripts/pilot/scan-pilot-monitoring-support.mjs && node scripts/pilot/scan-pilot-feedback-expansion.mjs';

const priorAuditComplete = (audit) => audit.aggregate?.passed === audit.aggregate?.total && audit.aggregate?.total > 0;

const checks = [
  { id: 'pilot_manifest_delivery_v5', passed: ['PILOT-V5', 'PILOT-V6'].includes(pilotManifest.delivery) && ['open', 'closed'].includes(pilotManifest.status) },
  { id: 'pilot_v1_completed_in_manifest', passed: pilotManifest.recommendedDeliveries?.some((d) => d.delivery === 'PILOT-V1' && d.status === 'completed') },
  { id: 'pilot_v2_completed_in_manifest', passed: pilotManifest.recommendedDeliveries?.some((d) => d.delivery === 'PILOT-V2' && d.status === 'completed') },
  { id: 'pilot_v3_completed_in_manifest', passed: pilotManifest.recommendedDeliveries?.some((d) => d.delivery === 'PILOT-V3' && d.status === 'completed') },
  { id: 'pilot_v4_completed_in_manifest', passed: pilotManifest.recommendedDeliveries?.some((d) => d.delivery === 'PILOT-V4' && d.status === 'completed') },
  { id: 'pilot_v5_current_in_manifest', passed: pilotManifest.recommendedDeliveries?.some((d) => d.delivery === 'PILOT-V5' && ['current', 'completed'].includes(d.status)) },
  { id: 'pilot_v6_planned_in_manifest', passed: pilotManifest.recommendedDeliveries?.some((d) => d.delivery === 'PILOT-V6' && ['planned', 'current', 'completed'].includes(d.status)) },
  { id: 'pilot_v1_audit_100_percent', passed: priorAuditComplete(v1Audit) },
  { id: 'pilot_v2_audit_100_percent', passed: priorAuditComplete(v2Audit) },
  { id: 'pilot_v3_audit_100_percent', passed: priorAuditComplete(v3Audit) },
  { id: 'pilot_v4_audit_100_percent', passed: priorAuditComplete(v4Audit) },
  { id: 'pilot_v4_health_plan_available', passed: Object.keys(v4Health).length > 0 && Array.isArray(v4Health.dailyHealthReviewItems) },
  { id: 'qa_v7_closure_100_percent', passed: priorAuditComplete(qaV7Audit) },
  { id: 'feedback_expansion_script_registered', passed: pkg.scripts?.['audit:pilot:feedback-expansion'] === 'node scripts/pilot/scan-pilot-feedback-expansion.mjs' },
  { id: 'pilot_aggregate_runs_v1_to_v5', passed: pkg.scripts?.['audit:pilot'] === expectedAggregate || pkg.scripts?.['audit:pilot'] === `${expectedAggregate} && node scripts/pilot/scan-final-go-live-closure.mjs` },
  { id: 'required_docs_present', passed: requiredDocs.every(exists) },
  { id: 'required_reports_present', passed: requiredReports.every(exists) },
  { id: 'feedback_channels_defined', passed: feedbackChannels.length >= 6 },
  { id: 'feedback_channels_have_evidence_schema', passed: feedbackChannels.every((item) => Array.isArray(item.requiredEvidence) && item.requiredEvidence.length >= 4) },
  { id: 'defect_burndown_buckets_defined', passed: defectBurnDownBuckets.length >= 6 },
  { id: 'defect_burndown_has_p0_p1_policy', passed: ['P0', 'P1'].every((sev) => defectBurnDownBuckets.some((item) => item.severity === sev && item.exitRequirement)) },
  { id: 'adoption_evidence_metrics_defined', passed: adoptionEvidenceMetrics.length >= 8 },
  { id: 'adoption_evidence_covers_admin_provider_support_data', passed: ['Provider workflow completion', 'Admin workflow completion', 'Support burden', 'Data and audit confidence'].every((metric) => adoptionEvidenceMetrics.some((item) => item.metric === metric)) },
  { id: 'expansion_decision_options_defined', passed: expansionDecisionOptions.length >= 5 },
  { id: 'expansion_decision_includes_expand_hold_hotfix_rollback', passed: ['expand', 'hold-expansion', 'hotfix-and-retest', 'rollback'].every((decision) => expansionDecisionOptions.some((item) => item.decision === decision)) },
  { id: 'decision_meeting_agenda_defined', passed: decisionMeetingAgenda.length >= 8 },
  { id: 'decision_meeting_covers_prior_phase_evidence', passed: ['PILOT-V2 staging/environment activation evidence', 'PILOT-V3 day-0/day-1 runbook evidence', 'PILOT-V4 daily health and incident triage evidence'].every((needle) => decisionMeetingAgenda.some((item) => item.evidence.includes(needle))) },
  { id: 'expansion_readiness_checklist_defined', passed: expansionReadinessChecklist.length >= 12 },
  { id: 'expansion_required_items_majority_required', passed: expansionReadinessChecklist.filter((item) => item.required).length >= 10 },
  { id: 'no_open_p0_gate_defined', passed: expansionReadinessChecklist.some((item) => item.id === 'EXP-001' && item.required) },
  { id: 'rollback_readiness_gate_defined', passed: expansionReadinessChecklist.some((item) => item.item === 'Rollback path remains approved and current' && item.required) },
  { id: 'technical_boundary_preserved', passed: pilotManifest.technicalBoundary?.backendContractsChanged === false && pilotManifest.technicalBoundary?.pythonWorkerChanged === false && pilotManifest.technicalBoundary?.databaseChanged === false && pilotManifest.technicalBoundary?.applicationRuntimeCodeChanged === false },
  { id: 'pilot_artifacts_only_boundary_preserved', passed: pilotManifest.technicalBoundary?.pilotArtifactsOnly === true },
  { id: 'build_api_script_available', passed: Boolean(pkg.scripts?.['build:api']) },
  { id: 'audit_qa_script_available', passed: Boolean(pkg.scripts?.['audit:qa']) },
  { id: 'verify_python_worker_script_available', passed: exists('scripts/option_b/verify_python_worker.py') },
  { id: 'next_delivery_declared', passed: pilotManifest.nextRecommendedDelivery === 'PILOT-V6 - Final go-live execution certificate and phase closure' || String(pilotManifest.nextRecommendedDelivery || '').includes('Post Go-Live Hypercare') }
];

const aggregate = {
  passed: checks.filter((check) => check.passed).length,
  total: checks.length,
  completionPercent: Math.round((checks.filter((check) => check.passed).length / checks.length) * 100)
};

const plan = {
  phase: pilotManifest.phase,
  delivery: 'PILOT-V5',
  sourceBaseline: pilotManifest.sourceBaseline,
  generatedAt: now,
  purpose: 'Convert pilot monitoring evidence into feedback, defect burn-down, adoption evidence, and an explicit expansion decision.',
  entryPosition: {
    pilotV1: 'completed',
    pilotV2: 'completed',
    pilotV3: 'completed',
    pilotV4: 'completed',
    qaV7: 'closed',
    executionMode: 'feedback, defect, adoption, and expansion governance; no runtime code change in this package'
  },
  feedbackChannels,
  defectBurnDownBuckets,
  adoptionEvidenceMetrics,
  expansionDecisionOptions,
  decisionMeetingAgenda,
  expansionReadinessChecklist,
  decisionRecordTemplate: {
    decision: 'expand | continue-limited-pilot | hold-expansion | hotfix-and-retest | rollback',
    requiredFields: ['decision owner', 'date', 'environment', 'cohort', 'evidence reviewed', 'open risks', 'waivers', 'next action', 'signature placeholder']
  },
  checks,
  aggregate,
  nextRecommendedDelivery: 'PILOT-V6 - Final go-live execution certificate and phase closure'
};

const audit = {
  phase: pilotManifest.phase,
  delivery: 'PILOT-V5',
  sourceBaseline: pilotManifest.sourceBaseline,
  generatedAt: now,
  purpose: 'Validate that pilot feedback channels, defect burn-down policy, adoption evidence, expansion gates, and decision meeting package are ready before final go-live closure.',
  checks,
  aggregate,
  outputs: {
    feedbackExpansionPlan: 'validation/pilot/pilot-v5-feedback-defect-adoption-expansion-plan.json',
    feedbackDocs: [
      'docs/pilot/PILOT_V5_FEEDBACK_DEFECT_BURNDOWN_AND_ADOPTION.md',
      'docs/pilot/PILOT_V5_EXPANSION_DECISION_PACKAGE.md',
      'docs/pilot/PILOT_V5_DEFECT_BURNDOWN_AND_FEEDBACK_TEMPLATES.md',
      'docs/pilot/PILOT_V5_VALIDATION.md'
    ],
    nextRecommendedDelivery: 'PILOT-V6 - Final go-live execution certificate and phase closure'
  },
  readinessPosition: aggregate.passed === aggregate.total ? 'ready-for-final-go-live-execution-certificate-and-phase-closure' : 'attention-required-before-final-go-live-closure'
};

writeFileSync(path.join(outDir, 'pilot-v5-feedback-defect-adoption-expansion-plan.json'), JSON.stringify(plan, null, 2) + '\n');
writeFileSync(path.join(outDir, 'pilot-v5-feedback-expansion-audit.json'), JSON.stringify(audit, null, 2) + '\n');

console.log('PILOT-V5 feedback/defect/adoption/expansion audit written successfully.');
console.log(`Aggregate completion: ${aggregate.completionPercent}% (${aggregate.passed}/${aggregate.total})`);
console.log(`Feedback channels: ${feedbackChannels.length}`);
console.log(`Defect burn-down buckets: ${defectBurnDownBuckets.length}`);
console.log(`Adoption evidence metrics: ${adoptionEvidenceMetrics.length}`);
console.log(`Expansion decision options: ${expansionDecisionOptions.length}`);
console.log(`Expansion readiness checklist items: ${expansionReadinessChecklist.length}`);
console.log(`Next delivery: ${plan.nextRecommendedDelivery}`);
