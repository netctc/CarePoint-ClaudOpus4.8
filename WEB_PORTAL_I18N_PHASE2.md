# Web Portal Multilingual Implementation – Phase 2

This pass extends multilingual support across additional Admin and Provider portal routes beyond the initial shell/sign-in/dashboard rollout.

## Added locale copy modules
- `apps/provider/lib/i18n/provider-portal-copy.ts`
- `apps/admin/src/lib/i18n/admin-portal-copy.ts`

## Admin coverage expanded
### Pages
- `apps/admin/src/app/portal/providers/page.tsx`
- `apps/admin/src/app/portal/providers/onboarding/page.tsx`

### Components
- `apps/admin/src/components/admin/data-source-banner.tsx`
- `apps/admin/src/components/admin/provider-directory-table.tsx`
- `apps/admin/src/components/admin/provider-onboarding-table.tsx`

### What changed
- Arabic/English hero content for provider directory and onboarding queue pages
- localized data source banner messaging
- localized provider directory table toolbar, filters, and action text
- localized provider onboarding table toolbar, filters, and action text

## Provider coverage expanded
### Fully dictionary-driven route text
- `apps/provider/app/portal/alerts/page.tsx`
- `apps/provider/app/portal/analytics/page.tsx`
- `apps/provider/app/portal/billing/page.tsx`
- `apps/provider/app/portal/compliance/page.tsx`
- `apps/provider/app/portal/messages/page.tsx`
- `apps/provider/app/portal/rpm/page.tsx`
- `apps/provider/app/portal/settings/page.tsx`
- `apps/provider/app/portal/team/page.tsx`
- `apps/provider/app/portal/telehealth/page.tsx`

### Extended partial localization on complex pages
- `apps/provider/app/portal/queue/page.tsx`
- `apps/provider/app/portal/calendar/page.tsx`

### What changed
- localized page titles, subtitles, banners, toolbar labels, section labels, key CTA text, and common table headers
- locale-aware date/time formatting on newly updated pages
- RTL-compatible rendering via existing locale provider context

## Validation performed
- syntax-level TypeScript transpilation check across all modified files

## Remaining work
The portals now have broader multilingual coverage, but some deep module text remains hardcoded, especially in:
- the more complex Provider queue/calendar subsections
- additional Admin route modules outside provider directory/onboarding
- route detail pages and some embedded evidence/workspace copy

Recommended next step:
- continue the same dictionary-driven pattern across all remaining Admin route modules and the deepest Provider queue/calendar/evidence subsections until every visible label is locale-backed.
