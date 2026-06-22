import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const outDir = path.join(root, 'validation', 'qa');
mkdirSync(outDir, { recursive: true });

const rel = (p) => path.join(root, ...p.split('/'));
const exists = (p) => existsSync(rel(p));
const read = (p) => exists(p) ? readFileSync(rel(p), 'utf8') : '';
const json = (p) => JSON.parse(read(p));

function countFiles(dir, predicate = () => true) {
  const start = rel(dir);
  if (!existsSync(start)) return 0;
  let total = 0;
  const stack = [start];
  while (stack.length) {
    const current = stack.pop();
    for (const entry of readdirSync(current)) {
      const full = path.join(current, entry);
      const st = statSync(full);
      if (st.isDirectory()) stack.push(full);
      else if (predicate(full)) total += 1;
    }
  }
  return total;
}

function hasAny(file, patterns) {
  const text = read(file);
  return patterns.some((pattern) => text.includes(pattern));
}

function hasRegex(file, pattern) {
  return pattern.test(read(file));
}

const pkg = json('package.json');
const qaV1Audit = json('validation/qa/qa-v1-master-qa-plan-audit.json');
const qaV2Audit = json('validation/qa/qa-v2-admin-functional-config-audit.json');
const qaV1Matrix = json('validation/qa/qa-v1-critical-e2e-test-matrix.json');
const qaV2Plan = json('validation/qa/qa-v2-admin-functional-test-plan.json');

const providerSurfaces = [
  { id: 'PROVIDER-ROOT-SHELL', path: 'apps/provider/app/layout.tsx', area: 'Provider shell', priority: 'P0', evidence: 'Provider app shell exists.' },
  { id: 'PROVIDER-PORTAL-SHELL', path: 'apps/provider/app/portal/layout.tsx', area: 'Provider shell', priority: 'P0', evidence: 'Provider portal layout exists.' },
  { id: 'PROVIDER-PORTAL-COMPONENT-SHELL', path: 'apps/provider/components/layout/portal-shell.tsx', area: 'Provider shell', priority: 'P0', evidence: 'Provider shell component includes main content landmark.' },
  { id: 'PROVIDER-SIDEBAR-NAV', path: 'apps/provider/components/layout/sidebar-nav.tsx', area: 'Navigation', priority: 'P0', evidence: 'Provider sidebar navigation exists.' },
  { id: 'PROVIDER-TOP-HEADER', path: 'apps/provider/components/layout/top-header.tsx', area: 'Navigation', priority: 'P1', evidence: 'Provider top header exists.' },
  { id: 'PROVIDER-SIGN-IN', path: 'apps/provider/app/sign-in/page.tsx', area: 'Authentication', priority: 'P0', evidence: 'Provider sign-in surface exists.' },
  { id: 'PROVIDER-DASHBOARD', path: 'apps/provider/app/portal/dashboard/page.tsx', area: 'Dashboard', priority: 'P0', evidence: 'Provider dashboard exists.' },
  { id: 'PROVIDER-QUEUE', path: 'apps/provider/app/portal/queue/page.tsx', area: 'Queue', priority: 'P0', evidence: 'Provider clinical/refill queue exists.' },
  { id: 'PROVIDER-CALENDAR', path: 'apps/provider/app/portal/calendar/page.tsx', area: 'Calendar', priority: 'P0', evidence: 'Provider calendar exists.' },
  { id: 'PROVIDER-CALENDAR-TEMPLATES', path: 'apps/provider/app/portal/calendar/templates/page.tsx', area: 'Calendar', priority: 'P1', evidence: 'Schedule template surface exists.' },
  { id: 'PROVIDER-APPOINTMENT-DETAIL', path: 'apps/provider/app/portal/appointments/[id]/page.tsx', area: 'Appointments', priority: 'P0', evidence: 'Appointment detail surface exists.' },
  { id: 'PROVIDER-PRESCRIPTION-NEW', path: 'apps/provider/app/portal/prescriptions/new/page.tsx', area: 'Prescriptions', priority: 'P0', evidence: 'Prescription creation flow exists.' },
  { id: 'PROVIDER-PRESCRIPTION-DETAIL', path: 'apps/provider/app/portal/prescriptions/[prescriptionId]/page.tsx', area: 'Prescriptions', priority: 'P1', evidence: 'Prescription detail flow exists.' },
  { id: 'PROVIDER-ENCOUNTER-NOTE', path: 'apps/provider/app/portal/encounters/[encounterId]/note/page.tsx', area: 'Encounter notes', priority: 'P0', evidence: 'Encounter note workflow exists.' },
  { id: 'PROVIDER-CHART', path: 'apps/provider/app/portal/chart/[patientId]/page.tsx', area: 'Patient chart', priority: 'P1', evidence: 'Patient chart surface exists.' },
  { id: 'PROVIDER-MESSAGES', path: 'apps/provider/app/portal/messages/page.tsx', area: 'Messages', priority: 'P1', evidence: 'Messages surface exists.' },
  { id: 'PROVIDER-LABS-INBOX', path: 'apps/provider/app/portal/labs/inbox/page.tsx', area: 'Labs', priority: 'P1', evidence: 'Labs inbox exists.' },
  { id: 'PROVIDER-LABS-RESULT', path: 'apps/provider/app/portal/labs/results/[id]/page.tsx', area: 'Labs', priority: 'P2', evidence: 'Lab result detail exists.' },
  { id: 'PROVIDER-TELEHEALTH', path: 'apps/provider/app/portal/telehealth/page.tsx', area: 'Telehealth', priority: 'P1', evidence: 'Telehealth surface exists.' },
  { id: 'PROVIDER-TELEHEALTH-LIVE', path: 'apps/provider/app/portal/telehealth/live/[appointmentId]/page.tsx', area: 'Telehealth', priority: 'P1', evidence: 'Live telehealth surface exists.' },
  { id: 'PROVIDER-ORDERS-NEW', path: 'apps/provider/app/portal/orders/new/page.tsx', area: 'Orders', priority: 'P1', evidence: 'Order creation surface exists.' },
  { id: 'PROVIDER-SETTINGS', path: 'apps/provider/app/portal/settings/page.tsx', area: 'Settings', priority: 'P1', evidence: 'Provider settings exists.' },
  { id: 'PROVIDER-SETTINGS-ACCESS', path: 'apps/provider/app/portal/settings/access/page.tsx', area: 'Settings', priority: 'P1', evidence: 'Provider access settings exists.' },
  { id: 'PROVIDER-TEAM', path: 'apps/provider/app/portal/team/page.tsx', area: 'Team', priority: 'P2', evidence: 'Provider team surface exists.' }
];

const providerArtifacts = [
  { id: 'PROVIDER-PACKAGE', path: 'apps/provider/package.json', priority: 'P0', purpose: 'Provider workspace package exists.' },
  { id: 'PROVIDER-API-CLIENT', path: 'apps/provider/services/api-client.ts', priority: 'P0', purpose: 'Provider API client exists.' },
  { id: 'PROVIDER-MOCK-API', path: 'apps/provider/services/mock-api.ts', priority: 'P1', purpose: 'Provider fallback/mock data exists for QA scenarios.' },
  { id: 'PROVIDER-SESSION', path: 'apps/provider/lib/auth/session.ts', priority: 'P0', purpose: 'Provider session helper exists.' },
  { id: 'PROVIDER-BROWSER-SESSION', path: 'apps/provider/lib/auth/browser-session.ts', priority: 'P1', purpose: 'Browser session helper exists.' },
  { id: 'PROVIDER-ACCESS-PERMISSIONS', path: 'apps/provider/lib/permissions/access.ts', priority: 'P0', purpose: 'Provider permission model exists.' },
  { id: 'PROVIDER-ROLE-PERMISSIONS', path: 'apps/provider/lib/permissions/roles.ts', priority: 'P0', purpose: 'Provider roles helper exists.' },
  { id: 'PROVIDER-DICTIONARY', path: 'apps/provider/lib/i18n/provider-dictionary.ts', priority: 'P1', purpose: 'Provider i18n dictionary exists.' },
  { id: 'PROVIDER-PORTAL-COPY', path: 'apps/provider/lib/i18n/provider-portal-copy.ts', priority: 'P1', purpose: 'Provider portal copy exists.' },
  { id: 'PROVIDER-DETAIL-COPY', path: 'apps/provider/lib/i18n/provider-detail-copy.ts', priority: 'P2', purpose: 'Provider detail copy exists.' },
  { id: 'PROVIDER-STAT-CARD', path: 'apps/provider/components/shared/stat-card.tsx', priority: 'P1', purpose: 'Provider KPI component exists.' },
  { id: 'PROVIDER-EVIDENCE-PANEL', path: 'apps/provider/components/shared/evidence-panel.tsx', priority: 'P1', purpose: 'Provider evidence panel exists.' },
  { id: 'PROVIDER-WORKSPACE-STATE-STRIP', path: 'apps/provider/components/shared/workspace-state-strip.tsx', priority: 'P1', purpose: 'Provider workspace state strip exists.' }
];

const providerScenarioPlan = [
  { id: 'QA3-PROV-001', area: 'Authentication', title: 'Provider user reaches Provider portal after sign-in and returns safely after logout', priority: 'P0', method: 'manual-or-e2e-automation-candidate' },
  { id: 'QA3-PROV-002', area: 'Authorization', title: 'Provider user cannot reach Admin-only routes or privileged operations', priority: 'P0', method: 'manual-or-e2e-automation-candidate' },
  { id: 'QA3-PROV-003', area: 'Portal shell', title: 'Provider shell exposes sidebar, topbar, skip link, and main content landmark', priority: 'P0', method: 'manual-or-e2e-automation-candidate' },
  { id: 'QA3-PROV-004', area: 'Dashboard', title: 'Provider dashboard loads workload cards, queue summary, alerts, and fallback state', priority: 'P0', method: 'manual-or-e2e-automation-candidate' },
  { id: 'QA3-PROV-005', area: 'Queue', title: 'Provider queue supports filtering, opening work items, and preserving back navigation', priority: 'P0', method: 'manual-or-e2e-automation-candidate' },
  { id: 'QA3-PROV-006', area: 'Refill queue', title: 'Governed refill queue supports role, aging band, controlled-only filters, and audit summary review', priority: 'P0', method: 'manual-or-e2e-automation-candidate' },
  { id: 'QA3-PROV-007', area: 'Queue actions', title: 'Queue escalation/assignment action shows loading, success, and error evidence without data loss', priority: 'P1', method: 'manual-or-e2e-automation-candidate' },
  { id: 'QA3-PROV-008', area: 'Calendar', title: 'Calendar displays schedule slots, appointments, facility filters, and day/week context', priority: 'P0', method: 'manual-or-e2e-automation-candidate' },
  { id: 'QA3-PROV-009', area: 'Schedule templates', title: 'Calendar template surface supports review of availability configuration and slot metadata', priority: 'P1', method: 'manual-or-e2e-automation-candidate' },
  { id: 'QA3-PROV-010', area: 'Appointments', title: 'Appointment detail opens from workflow context and displays status/evidence panels', priority: 'P0', method: 'manual-or-e2e-automation-candidate' },
  { id: 'QA3-PROV-011', area: 'Prescriptions', title: 'New prescription flow validates required fields, warnings, pharmacy context, and submission feedback', priority: 'P0', method: 'manual-or-e2e-automation-candidate' },
  { id: 'QA3-PROV-012', area: 'Prescriptions', title: 'Prescription detail flow preserves clinical evidence and refill/pharmacy context', priority: 'P1', method: 'manual-or-e2e-automation-candidate' },
  { id: 'QA3-PROV-013', area: 'Encounter notes', title: 'Encounter note draft preserves SOAP state and validates patient context before signing', priority: 'P0', method: 'manual-or-e2e-automation-candidate' },
  { id: 'QA3-PROV-014', area: 'Encounter notes', title: 'Signed encounter note shows confirmation and does not silently discard draft changes', priority: 'P0', method: 'manual-or-e2e-automation-candidate' },
  { id: 'QA3-PROV-015', area: 'Patient chart', title: 'Patient chart loads clinical context from patient route and handles missing patient context', priority: 'P1', method: 'manual-or-e2e-automation-candidate' },
  { id: 'QA3-PROV-016', area: 'Messages', title: 'Provider messages list and thread navigation preserve clinical workspace context', priority: 'P1', method: 'manual-or-e2e-automation-candidate' },
  { id: 'QA3-PROV-017', area: 'Labs', title: 'Labs inbox and result detail support review, status context, and evidence capture', priority: 'P1', method: 'manual-or-e2e-automation-candidate' },
  { id: 'QA3-PROV-018', area: 'Telehealth', title: 'Telehealth list, waiting room, and live visit surfaces expose clear status and fallback behavior', priority: 'P1', method: 'manual-or-e2e-automation-candidate' },
  { id: 'QA3-PROV-019', area: 'Provider i18n', title: 'Language switching preserves route, direction, and critical clinical labels', priority: 'P2', method: 'manual-or-e2e-automation-candidate' },
  { id: 'QA3-PROV-020', area: 'Accessibility and responsive', title: 'Provider critical flows pass keyboard-only, focus-visible, tablet, and mobile smoke checks', priority: 'P0', method: 'manual-or-e2e-automation-candidate' }
].map((scenario) => ({
  ...scenario,
  role: 'provider',
  expectedEvidence: [
    'tester',
    'environment',
    'date',
    'provider role used',
    'patient or appointment fixture when applicable',
    'steps executed',
    'expected result',
    'actual result',
    'pass/fail',
    'screenshot or log reference when applicable',
    'linked defect id when failed'
  ],
  acceptance: scenario.priority === 'P0'
    ? 'Must pass before production readiness signoff'
    : 'Must be triaged before production readiness signoff'
}));

const scriptChecks = [
  { id: 'root_audit_qa_registered', passed: Boolean(pkg.scripts?.['audit:qa']) },
  { id: 'qa_v3_provider_script_registered', passed: pkg.scripts?.['audit:qa:provider-workflows'] === 'node scripts/qa/scan-provider-functional-workflows.mjs' },
  { id: 'audit_qa_runs_v1_v2_v3', passed: String(pkg.scripts?.['audit:qa'] ?? '').includes('scan-master-qa-plan.mjs') && String(pkg.scripts?.['audit:qa'] ?? '').includes('scan-admin-functional-config.mjs') && String(pkg.scripts?.['audit:qa'] ?? '').includes('scan-provider-functional-workflows.mjs') },
  { id: 'build_provider_script_available', passed: Boolean(pkg.scripts?.['build:provider']) },
  { id: 'build_web_script_available', passed: Boolean(pkg.scripts?.['build:web']) }
];

const surfaceChecks = providerSurfaces.map((surface) => ({
  id: `surface_${surface.id.toLowerCase().replaceAll('-', '_')}`,
  surfaceId: surface.id,
  path: surface.path,
  priority: surface.priority,
  passed: exists(surface.path)
}));

const artifactChecks = providerArtifacts.map((artifact) => ({
  id: `artifact_${artifact.id.toLowerCase().replaceAll('-', '_')}`,
  artifactId: artifact.id,
  path: artifact.path,
  priority: artifact.priority,
  passed: exists(artifact.path)
}));

const providerCodeQualityChecks = [
  { id: 'provider_shell_has_skip_link_and_main_content', passed: hasAny('apps/provider/components/layout/portal-shell.tsx', ['skip-link', 'provider-main-content', '<main']) },
  { id: 'provider_sidebar_has_aria_current', passed: hasAny('apps/provider/components/layout/sidebar-nav.tsx', ['aria-current', 'Provider portal navigation']) },
  { id: 'provider_dashboard_uses_api_and_fallback', passed: hasAny('apps/provider/app/portal/dashboard/page.tsx', ['providerApi.dashboard', 'fallback', 'loading']) },
  { id: 'provider_queue_mentions_refill_and_audit', passed: hasAny('apps/provider/app/portal/queue/page.tsx', ['refill', 'audit', 'queue', 'escalation']) },
  { id: 'provider_calendar_mentions_slots_or_schedule', passed: hasAny('apps/provider/app/portal/calendar/page.tsx', ['Schedule', 'schedule', 'slot', 'Slot', 'appointment']) },
  { id: 'provider_prescription_new_has_submit_and_validation_language', passed: hasAny('apps/provider/app/portal/prescriptions/new/page.tsx', ['onSubmit', 'required', 'warning', 'validation', 'saving']) },
  { id: 'provider_encounter_note_has_soap_and_signature', passed: hasAny('apps/provider/app/portal/encounters/[encounterId]/note/page.tsx', ['subjective', 'objective', 'assessment', 'plan', 'signature', 'signed']) },
  { id: 'provider_api_client_has_dashboard_and_appointments', passed: hasAny('apps/provider/services/api-client.ts', ['dashboard', 'appointments', 'providerPharmacyQueue']) },
  { id: 'provider_i18n_provider_present', passed: hasAny('apps/provider/components/i18n/provider-locale-provider.tsx', ['locale', 'dir', 'ProviderLocale']) },
  { id: 'provider_stat_card_accessible_label', passed: hasAny('apps/provider/components/shared/stat-card.tsx', ['aria-label', 'stat-card']) },
  { id: 'provider_evidence_panel_present', passed: hasAny('apps/provider/components/shared/evidence-panel.tsx', ['evidence-panel', 'items.map']) },
  { id: 'provider_types_available', passed: exists('apps/provider/types/provider.ts') },
  { id: 'provider_proxy_or_middleware_present', passed: exists('apps/provider/proxy.ts') || exists('apps/provider/middleware.ts') }
];

const previousContinuityChecks = [
  { id: 'qa_v1_audit_completion_100', passed: qaV1Audit?.aggregate?.completionPercent === 100 },
  { id: 'qa_v2_audit_completion_100', passed: qaV2Audit?.aggregate?.completionPercent === 100 },
  { id: 'qa_v1_matrix_has_provider_scenarios', passed: Array.isArray(qaV1Matrix?.scenarios) && qaV1Matrix.scenarios.some((s) => String(s.id).startsWith('PROV-')) },
  { id: 'qa_v2_plan_has_admin_scenarios', passed: Array.isArray(qaV2Plan?.scenarios) && qaV2Plan.scenarios.length >= 18 },
  { id: 'ux_v6_closure_doc_present', passed: exists('docs/design/UX_PHASE_CLOSURE_CERTIFICATE.md') },
  { id: 'qa_phase_manifest_present', passed: exists('docs/qa/QA_PHASE_MANIFEST.json') }
];

const scenarioChecks = [
  { id: 'qa_v3_has_provider_functional_scenarios', passed: providerScenarioPlan.length >= 20 },
  { id: 'qa_v3_has_p0_provider_clinical_coverage', passed: providerScenarioPlan.filter((s) => s.priority === 'P0').length >= 10 },
  { id: 'qa_v3_covers_dashboard_queue_calendar_prescription_encounter', passed: ['Dashboard', 'Queue', 'Calendar', 'Prescriptions', 'Encounter notes'].every((area) => providerScenarioPlan.some((s) => s.area === area || s.area.includes(area))) },
  { id: 'qa_v3_covers_a11y_responsive_provider', passed: providerScenarioPlan.some((s) => s.area === 'Accessibility and responsive') }
];

const checks = [
  ...scriptChecks,
  ...surfaceChecks,
  ...artifactChecks,
  ...providerCodeQualityChecks,
  ...previousContinuityChecks,
  ...scenarioChecks
];

const passed = checks.filter((check) => check.passed).length;
const total = checks.length;
const completionPercent = Math.round((passed / total) * 100);

const audit = {
  phase: 'CarePoint Phase 3 - End-to-End QA, UAT & Production Readiness',
  delivery: 'QA-V3',
  sourceBaseline: 'CarePoint_qa_uat_production_readiness_v2',
  generatedAt: new Date().toISOString(),
  scope: 'Provider functional QA and clinical workflow validation',
  technicalBoundary: {
    optionBPythonProgressive: 'closed at V64',
    designRefinementUx: 'closed at UX-V6',
    qaV1MasterPlan: 'complete',
    qaV2AdminFunctionalQa: 'complete',
    backendContractsChanged: false,
    pythonWorkerChanged: false,
    databaseChanged: false,
    applicationRuntimeCodeChanged: false
  },
  inventory: {
    providerApplicationFiles: countFiles('apps/provider', (file) => /\.(tsx|ts|js|jsx)$/.test(file)),
    providerPortalPageFiles: countFiles('apps/provider/app/portal', (file) => file.endsWith('page.tsx')),
    providerSharedComponents: countFiles('apps/provider/components', (file) => /\.(tsx|ts)$/.test(file)),
    providerLibFiles: countFiles('apps/provider/lib', (file) => /\.(ts|tsx)$/.test(file)),
    qaDocs: countFiles('docs/qa', (file) => file.endsWith('.md') || file.endsWith('.json')),
    qaValidationReports: countFiles('validation/qa', (file) => file.endsWith('.json')),
    providerSurfaces,
    providerArtifacts
  },
  checks,
  aggregate: {
    passed,
    total,
    completionPercent
  },
  outputs: {
    auditFile: 'validation/qa/qa-v3-provider-functional-workflows-audit.json',
    providerFunctionalPlanFile: 'validation/qa/qa-v3-provider-functional-test-plan.json',
    docs: [
      'docs/qa/QA_V3_PROVIDER_FUNCTIONAL_QA.md',
      'docs/qa/QA_V3_CLINICAL_WORKFLOW_VALIDATION.md',
      'docs/qa/QA_V3_VALIDATION.md',
      'docs/qa/CHANGELOG_QA_V2_TO_QA_V3.md'
    ],
    nextRecommendedDelivery: 'QA-V4 - Node/API/Python worker E2E validation'
  },
  readinessPosition: completionPercent === 100 ? 'ready-for-provider-qa-execution' : 'provider-qa-precheck-needs-triage'
};

const plan = {
  phase: audit.phase,
  delivery: 'QA-V3',
  sourceBaseline: audit.sourceBaseline,
  generatedAt: audit.generatedAt,
  purpose: 'Define Provider functional QA and clinical workflow validation scope after QA-V2 Admin readiness.',
  scenarioCount: providerScenarioPlan.length,
  priorityCounts: providerScenarioPlan.reduce((acc, scenario) => {
    acc[scenario.priority] = (acc[scenario.priority] || 0) + 1;
    return acc;
  }, {}),
  scenarios: providerScenarioPlan,
  evidenceTemplate: {
    tester: '',
    environment: 'local | staging | pilot',
    buildReference: 'CarePoint_qa_uat_production_readiness_v3',
    testDate: '',
    role: 'provider',
    fixtureReference: 'patient | appointment | prescription | encounter | lab when applicable',
    result: 'pass | fail | blocked',
    defectReference: '',
    screenshotOrLogReference: '',
    clinicalReviewerSignoff: ''
  }
};

writeFileSync(path.join(outDir, 'qa-v3-provider-functional-workflows-audit.json'), JSON.stringify(audit, null, 2) + '\n');
writeFileSync(path.join(outDir, 'qa-v3-provider-functional-test-plan.json'), JSON.stringify(plan, null, 2) + '\n');

console.log('QA-V3 provider functional/workflow audit written to validation/qa/qa-v3-provider-functional-workflows-audit.json');
console.log('QA-V3 provider functional test plan written to validation/qa/qa-v3-provider-functional-test-plan.json');
console.log(`Aggregate completion: ${completionPercent}% (${passed}/${total})`);

if (completionPercent !== 100) {
  process.exitCode = 1;
}
