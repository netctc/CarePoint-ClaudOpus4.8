# Web Portal Multilingual Implementation – Phase 4

This pass extends multilingual support beyond shell navigation and dashboard pages into deeper Admin and Provider drilldown workspaces.

## Provider portal coverage extended

### Clinical detail routes localized in this pass
- `apps/provider/app/portal/appointments/[id]/page.tsx`
- `apps/provider/app/portal/labs/inbox/page.tsx`
- `apps/provider/app/portal/labs/results/[id]/page.tsx`
- `apps/provider/app/portal/telehealth/live/[appointmentId]/page.tsx`
- `apps/provider/app/portal/telehealth/waiting/[appointmentId]/page.tsx`
- `apps/provider/app/portal/messages/[threadId]/page.tsx`
- `apps/provider/app/portal/rpm/[patientId]/page.tsx`
- `apps/provider/lib/i18n/provider-detail-copy.ts`

### What changed
- added a dedicated provider detail-route dictionary for English and Arabic
- localized page titles, subtitles, banners, action buttons, section headers, state-strip labels, and core guidance cards
- made date/time formatting locale-aware on the updated detail pages
- preserved existing persisted locale and RTL/LTR behavior through the provider locale provider

## Admin portal coverage extended

### Detail drilldowns localized in this pass
- `apps/admin/src/app/portal/providers/[providerId]/page.tsx`
- `apps/admin/src/app/portal/catalog/services/[serviceId]/page.tsx`
- `apps/admin/src/app/portal/support/console/[ticketId]/page.tsx`
- `apps/admin/src/app/portal/telehealth/operations/[sessionId]/page.tsx`
- `apps/admin/src/app/portal/access/rbac/roles/[roleId]/page.tsx`
- `apps/admin/src/lib/i18n/admin-detail-copy.ts`

### What changed
- added a dedicated Admin detail-route dictionary for English and Arabic
- wired server-rendered detail pages to the shared `cc_locale` cookie
- localized breadcrumbs, page eyebrow labels, hero titles, hero subtitles, primary navigation actions, and key summary/detail labels

## Validation performed
- syntax-level TypeScript transpilation check passed for every file changed in this phase

## Important note
This phase deepens multilingual coverage substantially, but it does not yet translate every remaining Admin and Provider route. Some clinical detail pages such as chart, encounter note, order composer/detail, and prescription composer/detail still need the same dictionary-driven conversion.

## Recommended next step
- finish the remaining Provider clinical detail routes: chart, encounter note, orders, prescriptions
- then localize the remaining Admin detail pages: onboarding detail, refund detail, moderation detail, safety incident detail, reconciliation detail
- finally sweep shared tables and data-driven labels that still display raw English source text
