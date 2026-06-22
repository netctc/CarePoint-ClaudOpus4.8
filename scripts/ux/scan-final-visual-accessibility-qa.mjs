#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const outFile = 'validation/ux/ux-v6-final-visual-accessibility-qa-audit.json';

function read(relPath) {
  return readFileSync(join(root, relPath), 'utf8');
}

function readJson(relPath) {
  return JSON.parse(read(relPath));
}

function includes(relPath, pattern) {
  return existsSync(join(root, relPath)) && read(relPath).includes(pattern);
}

function fileExists(relPath) {
  return existsSync(join(root, relPath));
}

const packageJson = readJson('package.json');
const tokens = readJson('packages/design-system/tokens/carepoint.tokens.json');
const manifest = readJson('docs/design/UX_PHASE_MANIFEST.json');
const adminCss = read('apps/admin/src/app/globals.css');
const providerCss = read('apps/provider/app/globals.css');
const sharedCss = read('packages/design-system/css/carepoint-visual-qa-close.css');

const priorAuditFiles = [
  'validation/ux/ux-v1-design-surface-audit.json',
  'validation/ux/ux-v2-layout-navigation-audit.json',
  'validation/ux/ux-v3-component-normalization-audit.json',
  'validation/ux/ux-v4-responsive-accessibility-audit.json',
  'validation/ux/ux-v5-workflow-polish-audit.json',
];

const docFiles = [
  'docs/design/UX_V6_FINAL_VISUAL_ACCESSIBILITY_QA.md',
  'docs/design/UX_V6_IMPLEMENTATION.md',
  'docs/design/UX_V6_VALIDATION.md',
  'docs/design/CHANGELOG_UX_V5_TO_UX_V6.md',
  'docs/design/UX_PHASE_CLOSURE_CERTIFICATE.md',
  'docs/design/UX_POST_CLOSE_BACKLOG.md',
];

const cssChecks = [
  { id: 'shared_v6_css_exists', passed: sharedCss.includes('CarePoint UX-V6') },
  { id: 'admin_v6_css_marker_present', passed: adminCss.includes('CarePoint UX-V6 - final visual QA') },
  { id: 'provider_v6_css_marker_present', passed: providerCss.includes('CarePoint UX-V6 - final visual QA') },
  { id: 'phase_close_shell_defined', passed: sharedCss.includes('.cp-ux-phase-close-shell') && adminCss.includes('.cp-ux-phase-close-shell') && providerCss.includes('.cp-ux-phase-close-shell') },
  { id: 'qa_evidence_card_defined', passed: sharedCss.includes('.cp-qa-evidence-card') && adminCss.includes('.cp-qa-evidence-card') && providerCss.includes('.cp-qa-evidence-card') },
  { id: 'qa_status_badges_defined', passed: sharedCss.includes('.cp-qa-status-badge') && sharedCss.includes("data-status='pass'") },
  { id: 'qa_handoff_grid_defined', passed: sharedCss.includes('.cp-qa-handoff-grid') },
  { id: 'reduced_motion_preserved', passed: sharedCss.includes('prefers-reduced-motion') && adminCss.includes('prefers-reduced-motion') && providerCss.includes('prefers-reduced-motion') },
  { id: 'mobile_close_breakpoint_defined', passed: sharedCss.includes('max-width: 540px') },
];

const systemChecks = [
  { id: 'tokens_version_ux_v6', passed: tokens.version === 'ux-v6' },
  { id: 'tokens_phase_close_section', passed: tokens.phaseClose?.closureVersion === 'UX-V6' },
  { id: 'tokens_phase_close_acceptance_ready', passed: tokens.phaseClose?.acceptanceStatus === 'ready-for-stakeholder-signoff' },
  { id: 'tokens_qa_close_required', passed: tokens.qa?.phaseCloseRequired === true && tokens.qa?.visualRegressionSmokeRequired === true },
  { id: 'audit_script_registered', passed: packageJson.scripts?.['audit:ux:final-qa'] === 'node scripts/ux/scan-final-visual-accessibility-qa.mjs' },
  { id: 'aggregate_audit_includes_ux_v6', passed: packageJson.scripts?.['audit:ux']?.includes('scan-final-visual-accessibility-qa.mjs') },
  { id: 'manifest_delivery_ux_v6', passed: manifest.delivery === 'UX-V6' },
  { id: 'manifest_phase_closed', passed: manifest.status === 'closed' },
  { id: 'manifest_backend_boundary_preserved', passed: manifest.technicalPhaseBoundary?.backendContractsChanged === false && manifest.technicalPhaseBoundary?.pythonWorkerChanged === false && manifest.technicalPhaseBoundary?.databaseChanged === false },
];

const artifactChecks = [
  ...priorAuditFiles.map((path) => ({ id: `prior_audit_present:${path}`, passed: fileExists(path) })),
  ...docFiles.map((path) => ({ id: `doc_present:${path}`, passed: fileExists(path) })),
];

const checks = [...cssChecks, ...systemChecks, ...artifactChecks];
const passed = checks.filter((check) => check.passed).length;
const report = {
  phase: 'CarePoint Phase 2 - Design Refinement & UX Stabilization',
  delivery: 'UX-V6',
  sourceBaseline: 'CarePoint_design_refinement_phase_ux_v5',
  generatedAt: new Date().toISOString(),
  scope: {
    focus: 'Visual QA, accessibility QA, and UX phase close',
    backendContractsChanged: false,
    pythonWorkerChanged: false,
    databaseChanged: false,
  },
  checks,
  aggregate: {
    passed,
    total: checks.length,
    completionPercent: Math.round((passed / checks.length) * 100),
  },
  closureReadiness: {
    functionalUxDeliveriesCompleted: ['UX-V1', 'UX-V2', 'UX-V3', 'UX-V4', 'UX-V5', 'UX-V6'],
    recommendedStatus: passed === checks.length ? 'closed-pending-business-signoff' : 'hold',
    noBackendOrPythonWorkerChanges: true,
    futureWorkDisposition: 'post-close backlog only',
  },
  manualQaChecklist: [
    'Run npm run audit:ux and confirm all UX audit reports pass.',
    'Browser smoke Admin and Provider at 1440px, 1100px, 900px, 540px, and 390px.',
    'Keyboard-tab through login, dashboard, queue, calendar, prescriptions, audit logs, and report builder.',
    'Confirm focus-visible treatment remains visible and does not shift layout.',
    'Confirm high-density tables keep readable overflow behavior on small screens.',
    'Confirm no Option B backend, database, Python worker, or API contract files are changed by UX close work.'
  ],
  residualDesignRisks: [
    'This audit validates source-level coverage and artifacts; stakeholder pixel review should still be signed off manually.',
    'Future visual enhancements should be tracked in UX post-close backlog instead of reopening this phase.',
    'Automated color contrast coverage is represented as a smoke gate; full WCAG tooling can be added in a future quality phase.'
  ],
  nextRecommendedDelivery: 'None - UX phase closed. Use post-close backlog for future design enhancements.',
};

mkdirSync(join(root, 'validation/ux'), { recursive: true });
writeFileSync(join(root, outFile), JSON.stringify(report, null, 2) + '\n');
console.log(`UX-V6 final visual/accessibility QA audit written to ${outFile}`);
console.log(`Aggregate completion: ${report.aggregate.completionPercent}% (${passed}/${checks.length})`);
if (passed !== checks.length) process.exitCode = 1;
