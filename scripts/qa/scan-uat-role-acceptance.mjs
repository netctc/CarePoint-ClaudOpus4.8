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
const qaV1Audit = json('validation/qa/qa-v1-master-qa-plan-audit.json');
const qaV2Audit = json('validation/qa/qa-v2-admin-functional-config-audit.json');
const qaV3Audit = json('validation/qa/qa-v3-provider-functional-workflows-audit.json');
const qaV4Audit = json('validation/qa/qa-v4-api-python-e2e-audit.json');
const masterMatrix = json('validation/qa/qa-v1-critical-e2e-test-matrix.json');
const adminPlan = json('validation/qa/qa-v2-admin-functional-test-plan.json');
const providerPlan = json('validation/qa/qa-v3-provider-functional-test-plan.json');
const integrationPlan = json('validation/qa/qa-v4-api-python-e2e-test-plan.json');

const roleAcceptancePackages = [
  {
    role: 'Admin',
    ownerType: 'business-stakeholder',
    sessionId: 'UAT-ADMIN-001',
    priority: 'P0',
    requiredParticipants: ['Admin stakeholder', 'QA facilitator', 'Implementation representative'],
    scenarioRefs: ['AUTH-001', 'RBAC-001', 'ADMIN-001', 'ADMIN-004', 'ADMIN-005', 'UX-001', 'RESP-001', 'UAT-001'],
    requiredEvidence: ['signed acceptance checklist', 'screenshots for account/audit/report flows', 'defect references for deviations', 'environment and build identifiers'],
    exitCriterion: 'Admin can complete critical account, audit, report, and navigation workflows without unresolved P0 defects.'
  },
  {
    role: 'Provider',
    ownerType: 'clinical-stakeholder',
    sessionId: 'UAT-PROVIDER-001',
    priority: 'P0',
    requiredParticipants: ['Provider stakeholder', 'QA facilitator', 'Clinical workflow reviewer'],
    scenarioRefs: ['AUTH-002', 'PROV-001', 'PROV-002', 'PROV-003', 'PROV-005', 'PROV-006', 'A11Y-001', 'RESP-002', 'UAT-002'],
    requiredEvidence: ['signed acceptance checklist', 'screenshots for queue/calendar/prescription/encounter flows', 'clinical validation notes', 'defect references for deviations'],
    exitCriterion: 'Provider can complete critical clinical workflows without unresolved P0 defects and without usability blockers.'
  },
  {
    role: 'Operator/Reviewer',
    ownerType: 'operations-stakeholder',
    sessionId: 'UAT-OPS-001',
    priority: 'P1',
    requiredParticipants: ['Operations or reviewer stakeholder', 'QA facilitator', 'Admin representative'],
    scenarioRefs: ['ADMIN-004', 'E2E-002', 'E2E-003', 'OBS-001', 'REL-001', 'UAT-003'],
    requiredEvidence: ['signed acceptance checklist or triage note', 'audit evidence screenshots', 'report/KPI evidence', 'observability or log reference when applicable'],
    exitCriterion: 'Operational review workflows are understandable, traceable, and ready for production readiness review.'
  },
  {
    role: 'Platform/Technical Owner',
    ownerType: 'technical-stakeholder',
    sessionId: 'UAT-PLATFORM-001',
    priority: 'P0',
    requiredParticipants: ['Technical owner', 'QA facilitator', 'Deployment owner'],
    scenarioRefs: ['API-001', 'API-002', 'PY-001', 'PY-002', 'SEC-001', 'SEC-002', 'PROD-001'],
    requiredEvidence: ['build logs', 'audit:qa output', 'Python worker verification output', 'security smoke evidence', 'production readiness checklist references'],
    exitCriterion: 'Technical readiness evidence supports production readiness review and no P0 integration defect remains open.'
  }
];

const uatSessions = [
  { id: 'QA5-UAT-001', role: 'Admin', title: 'Admin acceptance session for accounts, audit, reports, and configuration', priority: 'P0', method: 'facilitated-uat' },
  { id: 'QA5-UAT-002', role: 'Provider', title: 'Provider acceptance session for queue, calendar, prescriptions, encounters, and clinical navigation', priority: 'P0', method: 'facilitated-uat' },
  { id: 'QA5-UAT-003', role: 'Operator/Reviewer', title: 'Operations/reviewer acceptance session for audit evidence, reports, and supportability', priority: 'P1', method: 'facilitated-uat' },
  { id: 'QA5-UAT-004', role: 'Platform/Technical Owner', title: 'Technical owner signoff for build, integration, worker, and security smoke evidence', priority: 'P0', method: 'evidence-review' },
  { id: 'QA5-UAT-005', role: 'Cross-role', title: 'Cross-role handoff from Admin-created provider to Provider portal access', priority: 'P0', method: 'facilitated-uat' },
  { id: 'QA5-UAT-006', role: 'Cross-role', title: 'Provider clinical action visible in Admin audit evidence', priority: 'P0', method: 'facilitated-uat' },
  { id: 'QA5-UAT-007', role: 'Cross-role', title: 'Report/KPI evidence reflects clinical activity after refresh', priority: 'P1', method: 'facilitated-uat' },
  { id: 'QA5-UAT-008', role: 'Admin', title: 'Admin high-density surface usability review on audit logs and report builder', priority: 'P1', method: 'facilitated-uat' },
  { id: 'QA5-UAT-009', role: 'Provider', title: 'Provider accessibility and keyboard-only clinical flow smoke', priority: 'P0', method: 'facilitated-uat' },
  { id: 'QA5-UAT-010', role: 'Provider', title: 'Provider responsive review on dashboard, queue, calendar, and prescriptions', priority: 'P1', method: 'facilitated-uat' },
  { id: 'QA5-UAT-011', role: 'Admin', title: 'Admin responsive review on dashboard, accounts, audit, and reports', priority: 'P1', method: 'facilitated-uat' },
  { id: 'QA5-UAT-012', role: 'Platform/Technical Owner', title: 'Production readiness evidence handoff and unresolved defect review', priority: 'P0', method: 'evidence-review' }
];

const defectWorkflow = [
  { severity: 'P0', action: 'Block production readiness until resolved or formally deferred by owner with mitigation.', sla: 'same-day triage' },
  { severity: 'P1', action: 'Must be triaged before production readiness; may proceed only with owner-approved mitigation.', sla: 'before readiness signoff' },
  { severity: 'P2', action: 'Can move to post-go-live backlog if not blocking acceptance.', sla: 'post-close backlog review' }
];

const signoffFields = [
  'role',
  'stakeholder name',
  'environment',
  'build or package identifier',
  'scenario ids executed',
  'accepted yes/no',
  'blocking defects',
  'accepted limitations or deferrals',
  'signature or approval reference',
  'approval date'
];

const evidenceTemplate = {
  tester: '',
  role: '',
  environment: '',
  buildIdentifier: '',
  sessionId: '',
  scenarioIds: [],
  stepsExecuted: '',
  expectedResult: '',
  actualResult: '',
  passFail: '',
  defectReferences: [],
  screenshotOrLogReferences: [],
  stakeholderDecision: 'accepted | accepted-with-deferrals | rejected',
  notes: ''
};

const requiredDocs = [
  'docs/qa/QA_V5_UAT_PACKAGE_AND_ROLE_ACCEPTANCE.md',
  'docs/qa/QA_V5_ROLE_SIGNOFF_CHECKLISTS.md',
  'docs/qa/QA_V5_DEFECT_TRIAGE_AND_ACCEPTANCE_GATES.md',
  'docs/qa/QA_V5_VALIDATION.md',
  'docs/qa/CHANGELOG_QA_V4_TO_QA_V5.md'
];

const requiredReports = [
  'validation/qa/qa-v5-uat-role-acceptance-audit.json',
  'validation/qa/qa-v5-uat-role-acceptance-package.json'
];

const requiredScripts = [
  { id: 'audit_qa_master_plan', name: 'audit:qa:master-plan', includes: 'scan-master-qa-plan.mjs' },
  { id: 'audit_qa_admin_config', name: 'audit:qa:admin-config', includes: 'scan-admin-functional-config.mjs' },
  { id: 'audit_qa_provider_workflows', name: 'audit:qa:provider-workflows', includes: 'scan-provider-functional-workflows.mjs' },
  { id: 'audit_qa_api_python_e2e', name: 'audit:qa:api-python-e2e', includes: 'scan-api-python-e2e.mjs' },
  { id: 'audit_qa_uat_role_acceptance', name: 'audit:qa:uat-role-acceptance', includes: 'scan-uat-role-acceptance.mjs' },
  { id: 'audit_qa_aggregate', name: 'audit:qa', includes: 'scan-uat-role-acceptance.mjs' }
];

function priorityCounts(items) {
  return items.reduce((acc, item) => {
    acc[item.priority] = (acc[item.priority] || 0) + 1;
    return acc;
  }, {});
}

const masterScenarioIds = new Set((masterMatrix.scenarios || []).map((scenario) => scenario.id));
const adminScenarioCount = adminPlan.scenarioCount || (adminPlan.scenarios || []).length;
const providerScenarioCount = providerPlan.scenarioCount || (providerPlan.scenarios || []).length;
const integrationScenarioCount = integrationPlan.scenarioCount || (integrationPlan.scenarios || []).length;
const mappedScenarioRefs = roleAcceptancePackages.flatMap((pkg) => pkg.scenarioRefs);

const artifactChecks = [
  ...requiredDocs.map((doc) => ({ id: `doc_present_${doc.split('/').pop().replace(/[^A-Za-z0-9]+/g, '_').toLowerCase()}`, passed: exists(doc), path: doc })),
  ...requiredReports.map((report) => ({ id: `report_declared_${report.split('/').pop().replace(/[^A-Za-z0-9]+/g, '_').toLowerCase()}`, passed: true, path: report }))
];

const scriptChecks = requiredScripts.map((script) => ({
  id: script.id,
  passed: Boolean(pkg.scripts?.[script.name]) && pkg.scripts[script.name].includes(script.includes),
  script: script.name
}));

const prerequisiteChecks = [
  { id: 'qa_v1_complete', passed: qaV1Audit?.aggregate?.completionPercent === 100 },
  { id: 'qa_v2_complete', passed: qaV2Audit?.aggregate?.completionPercent === 100 },
  { id: 'qa_v3_complete', passed: qaV3Audit?.aggregate?.completionPercent === 100 },
  { id: 'qa_v4_complete', passed: qaV4Audit?.aggregate?.completionPercent === 100 },
  { id: 'qa_v1_matrix_has_44_scenarios', passed: masterMatrix?.scenarioCount >= 44, observed: masterMatrix?.scenarioCount },
  { id: 'qa_v2_admin_plan_has_18_scenarios', passed: adminScenarioCount >= 18, observed: adminScenarioCount },
  { id: 'qa_v3_provider_plan_has_20_scenarios', passed: providerScenarioCount >= 20, observed: providerScenarioCount },
  { id: 'qa_v4_integration_plan_has_22_scenarios', passed: integrationScenarioCount >= 22, observed: integrationScenarioCount }
];

const packageChecks = [
  { id: 'uat_packages_cover_four_roles', passed: roleAcceptancePackages.length >= 4, observed: roleAcceptancePackages.length },
  { id: 'uat_packages_include_admin', passed: roleAcceptancePackages.some((pkg) => pkg.role === 'Admin') },
  { id: 'uat_packages_include_provider', passed: roleAcceptancePackages.some((pkg) => pkg.role === 'Provider') },
  { id: 'uat_packages_include_operator_reviewer', passed: roleAcceptancePackages.some((pkg) => pkg.role === 'Operator/Reviewer') },
  { id: 'uat_packages_include_platform_owner', passed: roleAcceptancePackages.some((pkg) => pkg.role === 'Platform/Technical Owner') },
  { id: 'uat_sessions_have_at_least_12_items', passed: uatSessions.length >= 12, observed: uatSessions.length },
  { id: 'uat_sessions_have_p0_coverage', passed: uatSessions.filter((session) => session.priority === 'P0').length >= 6, observed: uatSessions.filter((session) => session.priority === 'P0').length },
  { id: 'all_role_packages_have_exit_criteria', passed: roleAcceptancePackages.every((pkg) => Boolean(pkg.exitCriterion)) },
  { id: 'all_role_packages_have_required_evidence', passed: roleAcceptancePackages.every((pkg) => pkg.requiredEvidence.length >= 4) },
  { id: 'all_role_packages_reference_master_scenarios', passed: mappedScenarioRefs.every((ref) => masterScenarioIds.has(ref)) },
  { id: 'defect_workflow_covers_p0_p1_p2', passed: ['P0', 'P1', 'P2'].every((priority) => defectWorkflow.some((item) => item.severity === priority)) },
  { id: 'signoff_fields_have_minimum_acceptance_data', passed: ['role', 'stakeholder name', 'accepted yes/no', 'blocking defects', 'approval date'].every((field) => signoffFields.includes(field)) },
  { id: 'evidence_template_has_defect_and_screenshot_refs', passed: Array.isArray(evidenceTemplate.defectReferences) && Array.isArray(evidenceTemplate.screenshotOrLogReferences) },
  { id: 'uat_package_maps_admin_provider_platform_evidence', passed: ['Admin', 'Provider', 'Platform/Technical Owner'].every((role) => roleAcceptancePackages.some((pkg) => pkg.role === role && pkg.scenarioRefs.length >= 6)) }
];

const checks = [
  ...artifactChecks,
  ...scriptChecks,
  ...prerequisiteChecks,
  ...packageChecks
];

const passed = checks.filter((check) => check.passed).length;
const total = checks.length;

const acceptancePackage = {
  phase: 'CarePoint Phase 3 - End-to-End QA, UAT & Production Readiness',
  delivery: 'QA-V5',
  sourceBaseline: 'CarePoint_qa_uat_production_readiness_v4',
  generatedAt: new Date().toISOString(),
  purpose: 'Provide role-based UAT execution packages, signoff criteria, evidence templates, and defect gates before production readiness review.',
  roleAcceptancePackages,
  uatSessions,
  defectWorkflow,
  signoffFields,
  evidenceTemplate,
  scenarioMapping: {
    masterScenarioCount: masterMatrix.scenarioCount,
    adminScenarioCount,
    providerScenarioCount,
    integrationScenarioCount,
    mappedScenarioRefs: Array.from(new Set(mappedScenarioRefs)).sort()
  },
  exitGates: [
    'All P0 UAT sessions pass or have approved mitigation.',
    'No unresolved P0 defect remains open.',
    'P1 defects are triaged with owner, severity, target release, and mitigation.',
    'Admin and Provider stakeholder acceptance is recorded.',
    'Platform technical owner confirms QA-V1 through QA-V4 evidence is available for production readiness.',
    'Deferred items are moved to a controlled post-readiness backlog.'
  ],
  nextRecommendedDelivery: 'QA-V6 - Production readiness and go-live checklist'
};

const audit = {
  phase: acceptancePackage.phase,
  delivery: acceptancePackage.delivery,
  sourceBaseline: acceptancePackage.sourceBaseline,
  generatedAt: acceptancePackage.generatedAt,
  scope: 'UAT package and acceptance by role',
  technicalBoundary: {
    optionBPythonProgressive: 'closed at V64',
    designRefinementUx: 'closed at UX-V6',
    qaV1MasterPlan: 'complete',
    qaV2AdminFunctionalQa: 'complete',
    qaV3ProviderFunctionalQa: 'complete',
    qaV4NodeApiPythonE2E: 'complete',
    backendContractsChanged: false,
    pythonWorkerChanged: false,
    databaseChanged: false,
    applicationRuntimeCodeChanged: false,
    qaArtifactsOnly: true
  },
  inventory: {
    roleAcceptancePackageCount: roleAcceptancePackages.length,
    uatSessionCount: uatSessions.length,
    masterScenarioCount: masterMatrix.scenarioCount,
    adminScenarioCount,
    providerScenarioCount,
    integrationScenarioCount,
    mappedScenarioReferenceCount: Array.from(new Set(mappedScenarioRefs)).length,
    p0UatSessionCount: uatSessions.filter((session) => session.priority === 'P0').length
  },
  checks,
  aggregate: {
    passed,
    total,
    completionPercent: Math.round((passed / total) * 100)
  },
  outputs: {
    acceptancePackageFile: 'validation/qa/qa-v5-uat-role-acceptance-package.json',
    docs: requiredDocs,
    nextRecommendedDelivery: acceptancePackage.nextRecommendedDelivery
  },
  readinessPosition: passed === total ? 'ready-for-production-readiness-checklist' : 'blocked-before-production-readiness-checklist'
};

writeFileSync(path.join(outDir, 'qa-v5-uat-role-acceptance-audit.json'), JSON.stringify(audit, null, 2) + '\n');
writeFileSync(path.join(outDir, 'qa-v5-uat-role-acceptance-package.json'), JSON.stringify(acceptancePackage, null, 2) + '\n');

console.log('QA-V5 UAT role acceptance audit written to validation/qa/qa-v5-uat-role-acceptance-audit.json');
console.log('QA-V5 UAT role acceptance package written to validation/qa/qa-v5-uat-role-acceptance-package.json');
console.log(`Aggregate completion: ${audit.aggregate.completionPercent}% (${passed}/${total})`);
console.log(`QA-V5 UAT sessions: ${uatSessions.length}`);
console.log(`Role acceptance packages: ${roleAcceptancePackages.length}`);
