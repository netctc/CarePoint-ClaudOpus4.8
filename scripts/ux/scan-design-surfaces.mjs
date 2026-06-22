#!/usr/bin/env node
import { readdirSync, readFileSync, statSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = process.cwd();
const webRoots = ['apps/admin', 'apps/provider'];
const cssFiles = ['apps/admin/src/app/globals.css', 'apps/provider/app/globals.css'];
const outFile = 'validation/ux/ux-v1-design-surface-audit.json';
const sourceExtensions = new Set(['.ts', '.tsx', '.css', '.mjs', '.js']);

function walk(dir, files = []) {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '.next' || entry === 'dist' || entry === '.git') continue;
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      walk(full, files);
    } else {
      files.push(full);
    }
  }
  return files;
}

function extensionOf(file) {
  const match = file.match(/\.[^.]+$/);
  return match ? match[0] : '';
}

function countMatches(text, pattern) {
  return [...text.matchAll(pattern)].length;
}

function uniqueMatches(text, pattern, group = 1) {
  return [...new Set([...text.matchAll(pattern)].map((match) => match[group]).filter(Boolean))].sort();
}

const files = webRoots.flatMap((dir) => walk(join(root, dir))).filter((file) => sourceExtensions.has(extensionOf(file)));
const cssSummaries = cssFiles.map((file) => {
  const text = readFileSync(join(root, file), 'utf8');
  return {
    file,
    lines: text.split('\n').length,
    cssVariables: uniqueMatches(text, /--([a-zA-Z0-9-]+)\s*:/g).length,
    classSelectors: uniqueMatches(text, /\.([a-zA-Z0-9_-]+)\s*[,{]/g).length,
    mediaQueries: countMatches(text, /@media\s*\(/g),
    focusVisibleRules: countMatches(text, /:focus-visible/g),
    reducedMotionRules: countMatches(text, /prefers-reduced-motion/g),
    hardCodedHexValues: countMatches(text, /#[0-9a-fA-F]{3,8}\b/g)
  };
});

const tsxFiles = files.filter((file) => file.endsWith('.tsx'));
const designSurfaceHints = tsxFiles.map((file) => {
  const text = readFileSync(file, 'utf8');
  return {
    file: relative(root, file),
    buttons: countMatches(text, /<button\b/g),
    inputs: countMatches(text, /<input\b/g),
    selects: countMatches(text, /<select\b/g),
    tables: countMatches(text, /<table\b/g),
    forms: countMatches(text, /<form\b/g),
    classNameCount: countMatches(text, /className=/g),
    ariaReferences: countMatches(text, /aria-/g)
  };
}).filter((item) => item.buttons || item.inputs || item.selects || item.tables || item.forms || item.classNameCount);

const totals = designSurfaceHints.reduce((acc, item) => {
  for (const key of ['buttons', 'inputs', 'selects', 'tables', 'forms', 'classNameCount', 'ariaReferences']) {
    acc[key] = (acc[key] || 0) + item[key];
  }
  return acc;
}, {});

const highPriorityFiles = designSurfaceHints
  .map((item) => ({
    ...item,
    uxWeight: item.buttons * 3 + item.inputs * 4 + item.selects * 4 + item.tables * 5 + item.forms * 5 + item.classNameCount
  }))
  .sort((a, b) => b.uxWeight - a.uxWeight)
  .slice(0, 20);

const report = {
  phase: 'CarePoint Phase 2 - Design Refinement & UX Stabilization',
  delivery: 'UX-V1',
  sourceBaseline: 'CarePoint_option_B_python_progressive_v64',
  generatedAt: new Date().toISOString(),
  scope: {
    webRoots,
    cssFiles,
    backendContractsChanged: false,
    pythonWorkerChanged: false
  },
  totals: {
    scannedFiles: files.length,
    tsxFiles: tsxFiles.length,
    ...totals
  },
  cssSummaries,
  highPriorityFiles,
  recommendations: [
    'Start with shared layout/navigation refinements in Admin and Provider portals.',
    'Normalize buttons, fields, tables, empty states, and status badges against the UX-V1 token set.',
    'Prioritize responsive behavior for dashboards, data tables, provider queue, calendar, billing, and admin account surfaces.',
    'Increase aria coverage in interactive table, drawer, and form surfaces during UX-V2 and UX-V3.',
    'Reduce hard-coded hex values progressively after visual QA confirms token mapping.'
  ]
};

mkdirSync(join(root, 'validation/ux'), { recursive: true });
writeFileSync(join(root, outFile), JSON.stringify(report, null, 2) + '\n');
console.log(`UX design surface audit written to ${outFile}`);
console.log(`Scanned ${report.totals.scannedFiles} web files; priority surfaces: ${highPriorityFiles.length}`);
