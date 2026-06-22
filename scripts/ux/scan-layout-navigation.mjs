#!/usr/bin/env node
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const outFile = 'validation/ux/ux-v2-layout-navigation-audit.json';

const surfaces = [
  {
    app: 'admin',
    files: {
      shell: 'apps/admin/src/components/layout/portal-shell.tsx',
      sidebar: 'apps/admin/src/components/layout/sidebar-nav.tsx',
      topbar: 'apps/admin/src/components/layout/topbar.tsx',
      css: 'apps/admin/src/app/globals.css'
    }
  },
  {
    app: 'provider',
    files: {
      shell: 'apps/provider/components/layout/portal-shell.tsx',
      sidebar: 'apps/provider/components/layout/sidebar-nav.tsx',
      topbar: 'apps/provider/components/layout/top-header.tsx',
      css: 'apps/provider/app/globals.css'
    }
  }
];

function count(text, pattern) {
  return [...text.matchAll(pattern)].length;
}

function includesAll(text, markers) {
  return markers.every((marker) => text.includes(marker));
}

function read(relPath) {
  return readFileSync(join(root, relPath), 'utf8');
}

const appReports = surfaces.map((surface) => {
  const shell = read(surface.files.shell);
  const sidebar = read(surface.files.sidebar);
  const topbar = read(surface.files.topbar);
  const css = read(surface.files.css);

  const checks = {
    hasSkipLink: shell.includes('skip-link') && shell.includes('href="#'),
    mainHasStableId: /<main\s+id=/.test(shell),
    mainIsFocusable: shell.includes('tabIndex={-1}'),
    sidebarHasAriaLabel: /<aside[^>]+aria-label=/.test(sidebar),
    primaryNavHasLabel: /aria-label="Primary/.test(sidebar),
    activeNavUsesAriaCurrent: sidebar.includes('aria-current'),
    topbarHasBannerRole: topbar.includes('role="banner"'),
    searchHasSearchRole: topbar.includes('role="search"'),
    cssHasResponsiveRules: count(css, /@media\s*\(max-width:/g) >= 2,
    cssHasSkipLinkStyle: css.includes('.skip-link'),
    cssHasNavigationAliases: includesAll(css, ['.cp-app-shell', '.cp-sidebar', '.cp-topbar', '.cp-main-content'])
  };

  const score = Object.values(checks).filter(Boolean).length;
  const maxScore = Object.keys(checks).length;

  return {
    app: surface.app,
    files: surface.files,
    checks,
    score,
    maxScore,
    completionPercent: Math.round((score / maxScore) * 100),
    counts: {
      navLinks: count(sidebar, /<Link\b/g),
      ariaCurrentReferences: count(sidebar, /aria-current/g),
      landmarks: count(sidebar + topbar, /aria-label=|role="banner"|role="search"/g),
      mediaQueries: count(css, /@media\s*\(/g),
      cpClassAliases: count(shell + sidebar + topbar + css, /cp-[a-z0-9-]+/g)
    }
  };
});

const aggregateChecks = appReports.reduce((acc, app) => {
  acc.score += app.score;
  acc.maxScore += app.maxScore;
  return acc;
}, { score: 0, maxScore: 0 });

const report = {
  phase: 'CarePoint Phase 2 - Design Refinement & UX Stabilization',
  delivery: 'UX-V2',
  sourceBaseline: 'CarePoint_design_refinement_phase_ux_v1',
  generatedAt: new Date().toISOString(),
  scope: {
    focus: 'Layout, sidebar/topbar navigation, hierarchy, responsive shell behavior',
    backendContractsChanged: false,
    pythonWorkerChanged: false,
    databaseChanged: false
  },
  aggregate: {
    score: aggregateChecks.score,
    maxScore: aggregateChecks.maxScore,
    completionPercent: Math.round((aggregateChecks.score / aggregateChecks.maxScore) * 100)
  },
  appReports,
  recommendedNextDelivery: 'UX-V3 - Forms, tables, empty states, and dashboard component normalization',
  residualDesignRisks: [
    'Visual QA in a browser is still required to validate exact spacing across viewport widths.',
    'Several high-density pages still need component-level table and form normalization in UX-V3.',
    'Mobile navigation is improved but not yet a full dedicated mobile drawer pattern.'
  ]
};

mkdirSync(join(root, 'validation/ux'), { recursive: true });
writeFileSync(join(root, outFile), JSON.stringify(report, null, 2) + '\n');
console.log(`UX-V2 layout/navigation audit written to ${outFile}`);
console.log(`Aggregate completion: ${report.aggregate.completionPercent}% (${report.aggregate.score}/${report.aggregate.maxScore})`);
for (const app of appReports) {
  console.log(`${app.app}: ${app.completionPercent}% (${app.score}/${app.maxScore})`);
}
