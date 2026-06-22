import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const targets = [
  {
    id: 'provider-queue',
    path: 'apps/provider/app/portal/queue/page.tsx',
    required: ['cp-provider-queue-flow', 'cp-workflow-kpi-strip', 'cp-workflow-filter-bar', 'cp-refill-worklist', 'cp-appointment-worklist', 'cp-clinical-table'],
  },
  {
    id: 'provider-calendar',
    path: 'apps/provider/app/portal/calendar/page.tsx',
    required: ['cp-calendar-flow', 'cp-workflow-kpi-strip', 'cp-workflow-filter-bar', 'cp-calendar-board'],
  },
  {
    id: 'provider-prescriptions',
    path: 'apps/provider/app/portal/prescriptions/new/page.tsx',
    required: ['cp-prescription-flow', 'cp-clinical-worklist', 'cp-workflow-card'],
  },
  {
    id: 'admin-audit-logs',
    path: 'apps/admin/src/app/portal/audit/logs/page.tsx',
    required: ['cp-admin-density-flow', 'cp-audit-evidence-flow', 'cp-admin-density-shell', 'cp-density-filter-bar', 'cp-density-record-card'],
  },
  {
    id: 'admin-reports-builder',
    path: 'apps/admin/src/app/portal/reports/builder/page.tsx',
    required: ['cp-admin-density-flow', 'cp-report-builder-flow', 'cp-density-kpi-strip', 'cp-report-density-shell'],
  },
];

const cssTargets = [
  'packages/design-system/css/carepoint-workflow-polish.css',
  'apps/admin/src/app/globals.css',
  'apps/provider/app/globals.css',
];

const cssRequired = [
  '--cp-clinical-task-card-min-height',
  '.cp-clinical-flow',
  '.cp-admin-density-flow',
  '.cp-calendar-board',
  '.cp-admin-density-shell',
  '.cp-workflow-card:focus-within',
];

const targetResults = targets.map((target) => {
  const content = readFileSync(join(root, target.path), 'utf8');
  const checks = target.required.map((pattern) => ({ pattern, present: content.includes(pattern) }));
  return {
    id: target.id,
    path: target.path,
    checks,
    passed: checks.every((check) => check.present),
  };
});

const cssResults = cssTargets.map((path) => {
  const content = readFileSync(join(root, path), 'utf8');
  const checks = cssRequired.map((pattern) => ({ pattern, present: content.includes(pattern) }));
  return { path, checks, passed: checks.every((check) => check.present) };
});

const tokenContent = JSON.parse(readFileSync(join(root, 'packages/design-system/tokens/carepoint.tokens.json'), 'utf8'));
const tokenChecks = [
  ['version', ['ux-v5', 'ux-v6'].includes(tokenContent.version)],
  ['workflow.clinical', Boolean(tokenContent.workflow?.clinical)],
  ['workflow.calendar', Boolean(tokenContent.workflow?.calendar)],
  ['workflow.adminDensity', Boolean(tokenContent.workflow?.adminDensity)],
  ['workflow.visualQa', Boolean(tokenContent.workflow?.visualQa)],
].map(([pattern, present]) => ({ pattern, present }));

const totalChecks = targetResults.flatMap((item) => item.checks).length + cssResults.flatMap((item) => item.checks).length + tokenChecks.length;
const passedChecks = targetResults.flatMap((item) => item.checks).filter((item) => item.present).length + cssResults.flatMap((item) => item.checks).filter((item) => item.present).length + tokenChecks.filter((item) => item.present).length;
const report = {
  delivery: 'UX-V5',
  focus: 'Provider clinical workflow polish and Admin high-density surface refinement',
  phaseBoundary: {
    optionBPythonProgressive: 'closed at V64',
    backendContractsChanged: false,
    pythonWorkerChanged: false,
    databaseChanged: false,
  },
  generatedAt: new Date().toISOString(),
  aggregate: {
    passedChecks,
    totalChecks,
    completionPercent: Number(((passedChecks / totalChecks) * 100).toFixed(2)),
  },
  targetResults,
  cssResults,
  tokenChecks,
};

mkdirSync(join(root, 'validation/ux'), { recursive: true });
writeFileSync(join(root, 'validation/ux/ux-v5-workflow-polish-audit.json'), `${JSON.stringify(report, null, 2)}\n`);

if (passedChecks !== totalChecks) {
  console.error(JSON.stringify(report, null, 2));
  process.exit(1);
}

console.log('UX-V5 workflow polish audit written successfully.');
console.log(`Aggregate completion: ${report.aggregate.completionPercent}% (${passedChecks}/${totalChecks})`);
