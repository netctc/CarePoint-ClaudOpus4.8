import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = process.cwd();
const webRoots = ['apps/admin/src', 'apps/provider/app', 'apps/provider/components'];
const outDir = join(root, 'validation/ux');
const outFile = join(outDir, 'ux-v3-component-normalization-audit.json');

function walk(dir, files = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === '.next') continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) walk(path, files);
    else if (/\.(tsx|ts|css)$/.test(entry.name)) files.push(path);
  }
  return files;
}

const files = webRoots.flatMap((dir) => existsSync(join(root, dir)) ? walk(join(root, dir)) : []);
const tsxFiles = files.filter((file) => file.endsWith('.tsx'));
const cssFiles = files.filter((file) => file.endsWith('.css'));

const counts = {
  scannedFiles: files.length,
  tsxFiles: tsxFiles.length,
  cssFiles: cssFiles.length,
  formTags: 0,
  labeledFields: 0,
  inputs: 0,
  selects: 0,
  textareas: 0,
  buttons: 0,
  tables: 0,
  tableSurfaces: 0,
  emptyStates: 0,
  statCards: 0,
  normalizedDashboardCards: 0,
  disabledControls: 0,
};

const prioritySurfaces = [];

for (const file of tsxFiles) {
  const text = readFileSync(file, 'utf8');
  const rel = relative(root, file);
  const fileCounts = {
    forms: (text.match(/<form\b/g) || []).length,
    labels: (text.match(/<label\b/g) || []).length,
    inputs: (text.match(/<input\b/g) || []).length,
    selects: (text.match(/<select\b/g) || []).length,
    textareas: (text.match(/<textarea\b/g) || []).length,
    buttons: (text.match(/<button\b/g) || []).length,
    tables: (text.match(/<table\b/g) || []).length,
    tableSurfaces: (text.match(/className=[{]?['"][^'"]*(table-wrap|table-card|cp-table-surface|data-table)/g) || []).length,
    emptyStates: (text.match(/(No |لا توجد|empty-state|cp-empty-state|No .* match|No .* found)/gi) || []).length,
    statCards: (text.match(/<StatCard\b|stat-card|provider-stat-card|cp-dashboard-card/g) || []).length,
    normalizedDashboardCards: (text.match(/cp-dashboard-card/g) || []).length,
    disabledControls: (text.match(/disabled=/g) || []).length,
  };

  counts.formTags += fileCounts.forms;
  counts.labeledFields += fileCounts.labels;
  counts.inputs += fileCounts.inputs;
  counts.selects += fileCounts.selects;
  counts.textareas += fileCounts.textareas;
  counts.buttons += fileCounts.buttons;
  counts.tables += fileCounts.tables;
  counts.tableSurfaces += fileCounts.tableSurfaces;
  counts.emptyStates += fileCounts.emptyStates;
  counts.statCards += fileCounts.statCards;
  counts.normalizedDashboardCards += fileCounts.normalizedDashboardCards;
  counts.disabledControls += fileCounts.disabledControls;

  const score = fileCounts.inputs + fileCounts.selects + fileCounts.textareas + fileCounts.buttons + (fileCounts.tables * 5) + (fileCounts.emptyStates * 2) + (fileCounts.statCards * 3);
  if (score >= 12) {
    prioritySurfaces.push({ file: rel, score, ...fileCounts });
  }
}

prioritySurfaces.sort((a, b) => b.score - a.score || a.file.localeCompare(b.file));

const readMaybe = (path) => existsSync(join(root, path)) ? readFileSync(join(root, path), 'utf8') : '';
const adminCss = readMaybe('apps/admin/src/app/globals.css');
const providerCss = readMaybe('apps/provider/app/globals.css');
const componentCss = readMaybe('packages/design-system/css/carepoint-component-primitives.css');
const packageJson = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));

const checks = [
  { id: 'component_primitives_file_exists', passed: componentCss.includes('CarePoint UX-V3 component primitives') },
  { id: 'admin_globals_include_ux_v3', passed: adminCss.includes('UX-V3 - forms, tables, empty states') },
  { id: 'provider_globals_include_ux_v3', passed: providerCss.includes('UX-V3 - forms, tables, empty states') },
  { id: 'form_controls_have_normalization', passed: adminCss.includes('--cp-control-height') && providerCss.includes('--cp-control-height') },
  { id: 'tables_have_responsive_surfaces', passed: adminCss.includes('overflow-x: auto') && providerCss.includes('overflow-x: auto') },
  { id: 'empty_states_have_shared_class', passed: adminCss.includes('.cp-empty-state') && providerCss.includes('.cp-empty-state') },
  { id: 'dashboard_cards_have_shared_class', passed: counts.normalizedDashboardCards >= 2 },
  { id: 'audit_script_registered', passed: packageJson.scripts?.['audit:ux:components'] === 'node scripts/ux/scan-components.mjs' },
];

const passed = checks.filter((check) => check.passed).length;
const report = {
  delivery: 'UX-V3',
  scope: 'Forms, tables, empty states, and dashboard component normalization',
  generatedAt: new Date().toISOString(),
  technicalPhaseBoundary: {
    optionBPythonProgressive: 'closed at V64',
    backendContractsChanged: false,
    pythonWorkerChanged: false,
    databaseChanged: false,
  },
  counts,
  checks,
  aggregate: {
    passed,
    total: checks.length,
    completionPercent: Math.round((passed / checks.length) * 100),
  },
  prioritySurfaces: prioritySurfaces.slice(0, 16),
  nextRecommendedDelivery: 'UX-V4 - Responsive, accessibility, and visual QA hardening',
};

mkdirSync(outDir, { recursive: true });
writeFileSync(outFile, JSON.stringify(report, null, 2) + '\n');
console.log(`UX-V3 component normalization audit written successfully. Aggregate completion: ${report.aggregate.completionPercent}% (${passed}/${checks.length})`);
if (passed !== checks.length) process.exitCode = 1;
