# Web Portal Multilingual Implementation – Phase 3

This pass continues the Admin and Provider multilingual rollout by targeting the deepest remaining operational workspaces rather than only the shell and top-level pages.

## Provider portal coverage extended

### Deep multilingual workspaces updated
- `apps/provider/app/portal/queue/page.tsx`
- `apps/provider/app/portal/calendar/page.tsx`
- `apps/provider/lib/i18n/provider-portal-copy.ts`

### What changed
- expanded queue and calendar dictionaries for English and Arabic
- localized fallback/live banners, stats, workboard cards, filter labels, action labels, and section headers
- localized refill-queue controls, governance metrics, escalation labels, and operational history summaries
- localized calendar publishing controls, policy-preview labels, slot actions, active holds, and scheduling guidance
- kept locale-aware RTL/LTR behavior through the existing provider locale provider

## Admin portal coverage extended

### High-priority operational pages updated
- `apps/admin/src/app/portal/access/rbac/page.tsx`
- `apps/admin/src/app/portal/audit/refill-governance/page.tsx`
- `apps/admin/src/app/portal/support/console/page.tsx`
- `apps/admin/src/app/portal/telehealth/operations/page.tsx`
- `apps/admin/src/app/portal/settings/integrations/page.tsx`
- `apps/admin/src/app/portal/payments/refunds/page.tsx`
- `apps/admin/src/lib/i18n/admin-portal-copy.ts`

### What changed
- added locale-aware page copy for the most sensitive governance and operations modules
- localized page hero titles, subtitles, key CTA buttons, selected-item summary cards, and major section headers
- wired these server-rendered Admin pages to the shared `cc_locale` cookie so language persists across navigation

## Validation performed
- syntax-level TypeScript transpilation check on all modified files passed

## Important note
A full project-wide TypeScript check still reports many pre-existing repository issues unrelated to this multilingual pass, including missing workspace dependencies and older typing problems in untouched files. This phase was validated at the edited-file syntax level.

## Remaining multilingual work
The remaining visible gaps are mostly:
- additional Admin module pages and detail pages not yet converted to dictionary-driven copy
- some Admin and Provider table/component internals that still render source labels directly from mock/live data
- provider detail routes such as chart, orders, prescriptions, labs, telehealth room details, and encounter note flows

Recommended next step:
- complete route-detail localization for Provider clinical workspaces, then finish remaining Admin module pages and shared component/table internals until every visible label is locale-backed.
