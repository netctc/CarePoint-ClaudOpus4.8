# UX-V3 Component Normalization

UX-V3 continues the CarePoint Phase 2 design refinement track after UX-V2 layout/navigation stabilization.

## Scope

UX-V3 standardizes the component layer used most often across Admin and Provider surfaces:

- forms and filter toolbars;
- table containers and data-table readability;
- empty states;
- dashboard/KPI cards;
- disabled-control affordances;
- mobile stacking behavior for dense controls.

## Implementation boundary

No backend, database, hybrid Python worker, or Option B contract changes are included. The Option B technical implementation remains closed at V64.

## Added primitives

- `packages/design-system/css/carepoint-component-primitives.css`
- shared CSS variables for control height, table spacing, empty-state height, and stat-card sizing;
- global Admin/Provider CSS normalization targeting existing classes such as `toolbar`, `toolbar-card`, `table-wrap`, `table-card`, `data-table`, `field`, `label`, `input`, and `select`;
- semantic `cp-dashboard-card`, `cp-kpi-label`, and `cp-kpi-value` classes on shared stat-card components;
- `cp-empty-state` treatment for prominent provider queue empty states.

## Priority surfaces detected for follow-up visual QA

The UX-V3 audit ranks high-density files by form, button, table, empty-state, and stat-card usage. These should be reviewed first during UX-V4 responsive/accessibility QA.
