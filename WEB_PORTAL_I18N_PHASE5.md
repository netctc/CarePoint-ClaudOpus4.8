# Web Portal Multilingual Implementation – Phase 5

This phase extends multilingual support into the remaining high-impact Admin and Provider detail routes.

## Provider portal

Implemented locale-aware English/Arabic support for:
- `apps/provider/app/portal/chart/[patientId]/page.tsx`
- `apps/provider/app/portal/encounters/[encounterId]/note/page.tsx`
- `apps/provider/app/portal/orders/[orderId]/page.tsx`
- `apps/provider/app/portal/orders/new/page.tsx`
- `apps/provider/app/portal/prescriptions/[prescriptionId]/page.tsx`
- `apps/provider/app/portal/prescriptions/new/page.tsx`

Added shared phase-5 copy module:
- `apps/provider/lib/i18n/provider-phase5-copy.ts`

Coverage added:
- chart workspace shell, actions, state strips, evidence labels, and chart note composer
- encounter note editor rail, SOAP sections, validation panel, and side guidance cards
- order detail and order composer labels, banners, actions, and key list states
- prescription detail and prescription composer labels, refill actions, and queue visibility headings
- persisted locale and RTL/LTR behavior remain driven by the existing provider locale provider

## Admin portal

Implemented locale-aware English/Arabic support for:
- `apps/admin/src/app/portal/providers/onboarding/[providerId]/page.tsx`
- `apps/admin/src/app/portal/payments/reconciliation/[batchId]/page.tsx`
- `apps/admin/src/app/portal/payments/refunds/[caseId]/page.tsx`
- `apps/admin/src/app/portal/reviews/moderation/[reviewId]/page.tsx`
- `apps/admin/src/app/portal/safety/incidents/[caseId]/page.tsx`

Added shared phase-5 copy module:
- `apps/admin/src/lib/i18n/admin-phase5-copy.ts`

Coverage added:
- locale bootstrapping from `cc_locale` cookie on server-rendered detail pages
- translated breadcrumbs, hero headings, primary actions, state-strip labels, and major card headings
- onboarding review, reconciliation, refund, moderation, and safety detail drilldowns now persist Arabic/English correctly on navigation

## Validation

Targeted syntax-level transpilation check passed for all changed files in this phase.

## Remaining multilingual gaps

The portals now cover the shell, major workspaces, and most high-value detail routes. Remaining gaps are primarily:
- smaller Admin routes and internal table-cell value labels
- some Provider data-driven free text coming directly from mock/API payloads
- optional deeper translation of domain-specific bullet text inside evidence cards
