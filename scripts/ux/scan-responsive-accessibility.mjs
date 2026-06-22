#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = process.cwd();
const outFile = 'validation/ux/ux-v4-responsive-accessibility-audit.json';

function read(relPath) {
  return readFileSync(join(root, relPath), 'utf8');
}

function count(text, pattern) {
  return [...text.matchAll(pattern)].length;
}

function walk(dir, files = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === '.next' || entry.name === 'dist') continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full, files);
    else if (/\.(tsx|ts|css)$/.test(entry.name)) files.push(full);
  }
  return files;
}

function readMaybe(relPath) {
  const full = join(root, relPath);
  return existsSync(full) ? readFileSync(full, 'utf8') : '';
}

const packageJson = JSON.parse(read('package.json'));
const tokens = JSON.parse(read('packages/design-system/tokens/carepoint.tokens.json'));
const sharedCss = readMaybe('packages/design-system/css/carepoint-responsive-a11y.css');
const adminCss = read('apps/admin/src/app/globals.css');
const providerCss = read('apps/provider/app/globals.css');
const webFiles = ['apps/admin/src', 'apps/provider/app', 'apps/provider/components']
  .filter((rel) => existsSync(join(root, rel)))
  .flatMap((rel) => walk(join(root, rel)));
const tsxFiles = webFiles.filter((file) => file.endsWith('.tsx'));

let interactiveCounts = {
  buttons: 0,
  links: 0,
  ariaLabels: 0,
  ariaCurrent: 0,
  focusableMainRegions: 0,
  tables: 0,
  tableOverflowSurfaces: 0,
  images: 0,
  imagesWithAlt: 0,
  typeButton: 0,
};
const denseResponsiveSurfaces = [];

for (const file of tsxFiles) {
  const text = readFileSync(file, 'utf8');
  const metrics = {
    buttons: count(text, /<button\b/g),
    links: count(text, /<Link\b|<a\b/g),
    ariaLabels: count(text, /aria-label=/g),
    ariaCurrent: count(text, /aria-current=/g),
    focusableMainRegions: count(text, /<main[^>]+tabIndex=\{?-1\}?/g),
    tables: count(text, /<table\b/g),
    tableOverflowSurfaces: count(text, /cp-table-surface|table-wrap|table-card/g),
    images: count(text, /<img\b/g),
    imagesWithAlt: count(text, /<img\b[^>]*\salt=/g),
    typeButton: count(text, /<button\b[^>]*type=/g),
  };
  for (const key of Object.keys(interactiveCounts)) interactiveCounts[key] += metrics[key] || 0;
  const responsiveWeight = metrics.buttons * 2 + metrics.links + metrics.tables * 6 + metrics.ariaLabels * 2;
  if (responsiveWeight >= 14) {
    denseResponsiveSurfaces.push({ file: relative(root, file), responsiveWeight, ...metrics });
  }
}

denseResponsiveSurfaces.sort((a, b) => b.responsiveWeight - a.responsiveWeight || a.file.localeCompare(b.file));

const cssChecks = [
  { id: 'shared_responsive_a11y_css_exists', passed: sharedCss.includes('CarePoint UX-V4 responsive') },
  { id: 'admin_ux_v4_marker_present', passed: adminCss.includes('UX-V4 - responsive accessibility visual QA hardening') },
  { id: 'provider_ux_v4_marker_present', passed: providerCss.includes('UX-V4 - responsive accessibility visual QA hardening') },
  { id: 'focus_visible_hardened', passed: adminCss.includes(':focus-visible') && providerCss.includes(':focus-visible') && sharedCss.includes(':focus-visible') },
  { id: 'touch_targets_defined', passed: adminCss.includes('--cp-touch-target-min') && providerCss.includes('--cp-touch-target-min') && sharedCss.includes('--cp-touch-target-min') },
  { id: 'mobile_540_breakpoint_defined', passed: count(adminCss + providerCss + sharedCss, /max-width:\s*540px/g) >= 3 },
  { id: 'mobile_480_table_breakpoint_defined', passed: count(adminCss + providerCss + sharedCss, /max-width:\s*480px/g) >= 3 },
  { id: 'forced_colors_supported', passed: adminCss.includes('forced-colors') && providerCss.includes('forced-colors') && sharedCss.includes('forced-colors') },
  { id: 'reduced_motion_supported', passed: adminCss.includes('prefers-reduced-motion') && providerCss.includes('prefers-reduced-motion') && sharedCss.includes('prefers-reduced-motion') },
  { id: 'print_qa_rules_present', passed: adminCss.includes('@media print') && providerCss.includes('@media print') && sharedCss.includes('@media print') },
  { id: 'scroll_margin_defined', passed: adminCss.includes('scroll-margin-top') && providerCss.includes('scroll-margin-top') && sharedCss.includes('scroll-margin-top') },
];

const systemChecks = [
  { id: 'tokens_version_ux_v4_or_later', passed: ['ux-v4', 'ux-v5', 'ux-v6'].includes(tokens.version) },
  { id: 'tokens_accessibility_section', passed: tokens.accessibility?.touchTargetMin === '44px' && tokens.accessibility?.focusOutlineWidth === '3px' },
  { id: 'tokens_responsive_section', passed: tokens.responsive?.mobileCompact === '540px' && tokens.responsive?.mobileNarrow === '480px' },
  { id: 'tokens_qa_section', passed: tokens.qa?.visualAuditRequired === true && tokens.qa?.keyboardSmokeRequired === true },
  { id: 'audit_script_registered', passed: packageJson.scripts?.['audit:ux:responsive-a11y'] === 'node scripts/ux/scan-responsive-accessibility.mjs' },
  { id: 'aggregate_audit_includes_ux_v4', passed: packageJson.scripts?.['audit:ux']?.includes('scan-responsive-accessibility.mjs') },
];

const checks = [...cssChecks, ...systemChecks];
const passed = checks.filter((check) => check.passed).length;
const report = {
  phase: 'CarePoint Phase 2 - Design Refinement & UX Stabilization',
  delivery: 'UX-V4',
  sourceBaseline: 'CarePoint_design_refinement_phase_ux_v3',
  generatedAt: new Date().toISOString(),
  scope: {
    focus: 'Responsive, accessibility, and visual QA hardening',
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
  interactiveCounts,
  densitySample: denseResponsiveSurfaces.slice(0, 16),
  manualQaChecklist: [
    'Keyboard tab through Admin and Provider portals and confirm visible focus order.',
    'Check widths near 1440px, 1100px, 900px, 540px, and 390px.',
    'Validate high-density tables remain horizontally scrollable on mobile.',
    'Run a contrast smoke check on primary, warning, danger, muted, and disabled states.',
    'Confirm reduced-motion OS setting disables non-essential animation.',
    'Print one representative Admin report and Provider queue page to confirm shell elements are hidden.'
  ],
  residualDesignRisks: [
    'Automated script validates source coverage; pixel-perfect browser QA is still required.',
    'Some page-level tables may still require bespoke column prioritization in UX-V5.',
    'No functional backend, worker, database, or API contract changes are included in this UX delivery.'
  ],
  nextRecommendedDelivery: 'UX-V5 - Provider clinical workflow polish and Admin high-density surface refinement',
};

mkdirSync(join(root, 'validation/ux'), { recursive: true });
writeFileSync(join(root, outFile), JSON.stringify(report, null, 2) + '\n');
console.log(`UX-V4 responsive/accessibility audit written to ${outFile}`);
console.log(`Aggregate completion: ${report.aggregate.completionPercent}% (${passed}/${checks.length})`);
if (passed !== checks.length) process.exitCode = 1;
