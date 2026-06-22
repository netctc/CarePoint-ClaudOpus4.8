import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const outDir = path.join(root, 'validation', 'qa');
mkdirSync(outDir, { recursive: true });

const rel = (p) => path.join(root, ...p.split('/'));
const exists = (p) => existsSync(rel(p));
const read = (p) => exists(p) ? readFileSync(rel(p), 'utf8') : '';
const json = (p) => JSON.parse(read(p));

const now = new Date().toISOString();
const manifest = json('docs/qa/QA_PHASE_MANIFEST.json');
const pkg = json('package.json');

const priorAudits = [
  { id: 'QA-V1', path: 'validation/qa/qa-v1-master-qa-plan-audit.json', kind: 'master QA plan' },
  { id: 'QA-V2', path: 'validation/qa/qa-v2-admin-functional-config-audit.json', kind: 'Admin functional/config QA' },
  { id: 'QA-V3', path: 'validation/qa/qa-v3-provider-functional-workflows-audit.json', kind: 'Provider functional workflow QA' },
  { id: 'QA-V4', path: 'validation/qa/qa-v4-api-python-e2e-audit.json', kind: 'Node/API/Python E2E QA' },
  { id: 'QA-V5', path: 'validation/qa/qa-v5-uat-role-acceptance-audit.json', kind: 'UAT role acceptance QA' },
  { id: 'QA-V6', path: 'validation/qa/qa-v6-production-readiness-audit.json', kind: 'Production readiness QA' }
].map((entry) => {
  const present = exists(entry.path);
  const data = present ? json(entry.path) : null;
  const aggregate = data?.aggregate ?? {};
  return {
    ...entry,
    present,
    passed: present && aggregate.passed === aggregate.total && aggregate.total > 0,
    aggregate,
    generatedAt: data?.generatedAt ?? null
  };
});

const requiredDocs = [
  'docs/qa/QA_V1_MASTER_QA_PLAN.md',
  'docs/qa/QA_V2_ADMIN_FUNCTIONAL_QA.md',
  'docs/qa/QA_V3_PROVIDER_FUNCTIONAL_QA.md',
  'docs/qa/QA_V4_NODE_API_PYTHON_E2E_VALIDATION.md',
  'docs/qa/QA_V5_UAT_PACKAGE_AND_ROLE_ACCEPTANCE.md',
  'docs/qa/QA_V6_PRODUCTION_READINESS_AND_GO_LIVE.md',
  'docs/qa/QA_V7_FINAL_QA_UAT_CLOSURE_CERTIFICATE.md',
  'docs/qa/QA_V7_FINAL_EVIDENCE_INDEX.md',
  'docs/qa/QA_V7_POST_CLOSE_BACKLOG.md',
  'docs/qa/QA_V7_VALIDATION.md',
  'docs/design/UX_PHASE_CLOSURE_CERTIFICATE.md',
  'docs/option-b/FINAL_HANDOVER_AND_PHASE_CLOSURE_V64.md'
];

const requiredReports = [
  'validation/qa/qa-v1-critical-e2e-test-matrix.json',
  'validation/qa/qa-v2-admin-functional-test-plan.json',
  'validation/qa/qa-v3-provider-functional-test-plan.json',
  'validation/qa/qa-v4-api-python-e2e-test-plan.json',
  'validation/qa/qa-v5-uat-role-acceptance-package.json',
  'validation/qa/qa-v6-go-live-checklist.json'
];

const finalQaCommands = [
  { id: 'FINAL-CMD-001', command: 'npm install', expected: 'Dependencies install successfully in the target environment.' },
  { id: 'FINAL-CMD-002', command: 'npm run build:api', expected: 'API and shared contracts build successfully.' },
  { id: 'FINAL-CMD-003', command: 'npm run build:web', expected: 'Admin and Provider builds complete or have accepted deferral for a non-web pilot.' },
  { id: 'FINAL-CMD-004', command: 'npm run audit:qa', expected: 'QA-V1 through QA-V7 audit package completes with 100% scanner coverage.' },
  { id: 'FINAL-CMD-005', command: 'PYTHONPATH=services/python-worker python scripts/option_b/verify_python_worker.py', expected: 'Python worker verification passes.' },
  { id: 'FINAL-CMD-006', command: 'PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 PYTHONPATH=services/python-worker python -m pytest -q services/python-worker/tests/test_worker_contracts.py --disable-warnings', expected: 'Python worker contract suite passes.' }
];

const roleSignoffChecklist = [
  { role: 'Admin stakeholder', source: 'QA-V5 Admin acceptance package', requiredBeforeGoLive: true },
  { role: 'Provider stakeholder', source: 'QA-V5 Provider acceptance package', requiredBeforeGoLive: true },
  { role: 'Operator/Reviewer stakeholder', source: 'QA-V5 Operator/Reviewer package', requiredBeforeGoLive: true },
  { role: 'Platform/Technical owner', source: 'QA-V5 platform and QA-V6 production readiness package', requiredBeforeGoLive: true },
  { role: 'Release owner', source: 'QA-V6 go/no-go decision record', requiredBeforeGoLive: true }
];

const defectClosureRules = [
  { severity: 'P0', rule: 'No open P0 defects are allowed at final closure.' },
  { severity: 'P1', rule: 'Open P1 defects require owner, mitigation, target release, and release-owner acceptance.' },
  { severity: 'P2', rule: 'Open P2 defects may move to post-close backlog when they do not block pilot or production use.' },
  { severity: 'Unclassified', rule: 'Unclassified defects must be classified before final go/no-go.' }
];

const evidenceIndex = [
  ...priorAudits.map((a) => ({ id: `${a.id}-AUDIT`, type: 'validation-report', path: a.path, status: a.passed ? 'accepted' : 'attention-required' })),
  ...requiredReports.map((p, i) => ({ id: `QA-REPORT-${String(i + 1).padStart(3, '0')}`, type: 'validation-report', path: p, status: exists(p) ? 'accepted' : 'missing' })),
  ...requiredDocs.map((p, i) => ({ id: `QA-DOC-${String(i + 1).padStart(3, '0')}`, type: 'documentation', path: p, status: exists(p) ? 'accepted' : 'missing' }))
];

const checks = [
  { id: 'qa_v1_through_v6_audits_present', passed: priorAudits.every((a) => a.present) },
  { id: 'qa_v1_through_v6_audits_100_percent', passed: priorAudits.every((a) => a.passed) },
  { id: 'qa_v7_script_registered', passed: pkg.scripts?.['audit:qa:final-closure'] === 'node scripts/qa/scan-final-qa-uat-closure.mjs' },
  { id: 'aggregate_qa_script_includes_v7', passed: String(pkg.scripts?.['audit:qa'] ?? '').includes('scan-final-qa-uat-closure.mjs') },
  { id: 'qa_phase_manifest_closed', passed: manifest.status === 'closed' && manifest.delivery === 'QA-V7' },
  { id: 'option_b_phase_closed_reference_present', passed: manifest.technicalBoundary?.optionBPythonProgressive === 'closed at V64' },
  { id: 'ux_phase_closed_reference_present', passed: manifest.technicalBoundary?.designRefinementUx === 'closed at UX-V6' },
  { id: 'qa_artifacts_only_boundary_preserved', passed: manifest.technicalBoundary?.backendContractsChanged === false && manifest.technicalBoundary?.pythonWorkerChanged === false && manifest.technicalBoundary?.databaseChanged === false },
  { id: 'required_final_docs_present', passed: requiredDocs.every(exists) },
  { id: 'required_final_reports_present', passed: requiredReports.every(exists) },
  { id: 'uat_acceptance_package_present', passed: exists('validation/qa/qa-v5-uat-role-acceptance-package.json') },
  { id: 'go_live_checklist_present', passed: exists('validation/qa/qa-v6-go-live-checklist.json') },
  { id: 'final_closure_certificate_doc_present', passed: exists('docs/qa/QA_V7_FINAL_QA_UAT_CLOSURE_CERTIFICATE.md') },
  { id: 'post_close_backlog_present', passed: exists('docs/qa/QA_V7_POST_CLOSE_BACKLOG.md') },
  { id: 'phase_roadmap_present', passed: exists('docs/qa/QA_PHASE_ROADMAP.md') },
  { id: 'audit_qa_command_available', passed: Boolean(pkg.scripts?.['audit:qa']) },
  { id: 'build_api_script_available', passed: Boolean(pkg.scripts?.['build:api']) },
  { id: 'build_web_script_available', passed: Boolean(pkg.scripts?.['build:web']) },
  { id: 'python_worker_verification_available', passed: exists('scripts/option_b/verify_python_worker.py') },
  { id: 'python_worker_contract_tests_available', passed: exists('services/python-worker/tests/test_worker_contracts.py') },
  { id: 'qa_v7_no_runtime_code_required', passed: manifest.technicalBoundary?.applicationRuntimeCodeChanged === false },
  { id: 'qa_v7_readiness_position_finalized', passed: manifest.readinessPosition === 'qa-uat-closed-ready-for-controlled-go-live-or-pilot' }
];

const aggregate = {
  passed: checks.filter((check) => check.passed).length,
  total: checks.length,
  completionPercent: Math.round((checks.filter((check) => check.passed).length / checks.length) * 100)
};

const finalClosurePackage = {
  phase: 'CarePoint Phase 3 - End-to-End QA, UAT & Production Readiness',
  delivery: 'QA-V7',
  sourceBaseline: 'CarePoint_qa_uat_production_readiness_v6',
  generatedAt: now,
  status: aggregate.passed === aggregate.total ? 'closed' : 'attention-required',
  closureDecision: aggregate.passed === aggregate.total ? 'QA/UAT phase evidence package is complete and ready for controlled go-live or pilot decision.' : 'Final closure requires attention before go-live decision.',
  closedPredecessorPhases: {
    optionBPythonProgressive: 'V64',
    designRefinementUx: 'UX-V6',
    qaUatProductionReadiness: 'QA-V7'
  },
  technicalBoundary: manifest.technicalBoundary,
  priorAuditSummary: priorAudits,
  finalQaCommands,
  roleSignoffChecklist,
  defectClosureRules,
  evidenceIndex,
  postCloseGuidance: {
    doNotContinueAs: ['V65 unless a technical defect is discovered', 'UX-V7 unless a design defect is discovered', 'QA-V8 unless a closure defect is discovered'],
    recommendedNextPhase: 'Controlled pilot, staging signoff, or production go-live execution phase',
    backlogFile: 'docs/qa/QA_V7_POST_CLOSE_BACKLOG.md'
  },
  checks,
  aggregate
};

const audit = {
  phase: finalClosurePackage.phase,
  delivery: finalClosurePackage.delivery,
  sourceBaseline: finalClosurePackage.sourceBaseline,
  generatedAt: now,
  technicalBoundary: manifest.technicalBoundary,
  checks,
  aggregate,
  outputs: {
    finalClosurePackage: 'validation/qa/qa-v7-final-qa-uat-closure-package.json',
    closureCertificate: 'docs/qa/QA_V7_FINAL_QA_UAT_CLOSURE_CERTIFICATE.md',
    evidenceIndex: 'docs/qa/QA_V7_FINAL_EVIDENCE_INDEX.md',
    postCloseBacklog: 'docs/qa/QA_V7_POST_CLOSE_BACKLOG.md'
  },
  readinessPosition: finalClosurePackage.postCloseGuidance.recommendedNextPhase
};

writeFileSync(path.join(outDir, 'qa-v7-final-qa-uat-closure-package.json'), JSON.stringify(finalClosurePackage, null, 2) + '\n');
writeFileSync(path.join(outDir, 'qa-v7-final-qa-uat-closure-audit.json'), JSON.stringify(audit, null, 2) + '\n');

console.log('QA-V7 final QA/UAT closure audit written successfully.');
console.log(`Aggregate completion: ${aggregate.completionPercent}% (${aggregate.passed}/${aggregate.total})`);
console.log(`Final status: ${finalClosurePackage.status}`);
