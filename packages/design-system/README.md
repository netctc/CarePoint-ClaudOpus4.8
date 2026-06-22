# CarePoint Design System Foundation UX-V6

This package contains the shared design-system foundation for the post-V64 UX phase. It remains intentionally non-invasive: it adds visual tokens, layout primitives, component conventions, responsive/a11y hardening, workflow polish, and final QA close artifacts without changing backend contracts, Python worker behavior, database schema, or API semantics.

## Contents

- `tokens/carepoint.tokens.json` — canonical token source for CarePoint UX work.
- `css/carepoint-design-tokens.css` — CSS custom properties and compatibility aliases for existing web portals.
- `css/carepoint-layout-primitives.css` — framework-agnostic shell, sidebar, topbar, skip-link, and responsive layout primitives introduced in UX-V2.
- `css/carepoint-component-primitives.css` — framework-agnostic forms, tables, empty states, and dashboard KPI primitives introduced in UX-V3.
- `css/carepoint-responsive-a11y.css` — responsive, accessibility, focus, high-contrast, reduced-motion, and print QA primitives introduced in UX-V4.
- `css/carepoint-workflow-polish.css` — provider clinical workflow and admin density primitives introduced in UX-V5.
- `css/carepoint-visual-qa-close.css` — final visual QA, accessibility QA, evidence, and handover primitives introduced in UX-V6.

## Adoption rule

UX-V1 established the design token source of truth. UX-V2 added the shared layout/navigation layer, UX-V3 normalized core components, UX-V4 hardened responsive and accessibility behavior, UX-V5 polished clinical and high-density workflows, and UX-V6 closes the design refinement phase with evidence, QA gates, and post-close backlog separation.

## Phase boundary

This package belongs to `CarePoint Phase 2 — Design Refinement & UX Stabilization`. It does not reopen `Option B Python Progressive`, which remains closed at V64. Future visual work should be tracked in the post-close UX backlog instead of extending this closed phase.
