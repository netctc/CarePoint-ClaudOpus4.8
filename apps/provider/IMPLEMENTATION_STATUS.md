# Provider Integration Slot 1 - Hybrid Pages Wired to Provider API

## Package
- provider-v0.6-integration-slot-1-provider-expansion.zip

## Included
- onboarding now uses `/api/provider/onboarding/me`, save-draft, and submit
- slot template editor now uses `/api/provider/calendar/templates` and publish
- orders composer now uses `/api/provider/orders/*`
- prescriptions composer now uses `/api/provider/prescriptions/*`
- labs inbox and results review now use `/api/provider/labs/*`
- RPM panel and patient detail now use `/api/provider/rpm/*`
- alerts now use `/api/provider/alerts/*`
- analytics now uses `/api/provider/analytics/overview`
- team now uses `/api/provider/team/*`
- settings now uses `/api/provider/settings/*`

## Notes
- no runtime `.env` is packaged
- existing live/fallback banners are preserved
- calendar overview page remains appointments-backed, while the template editor is now provider-calendar backed
- chart, encounter, queue, telehealth, messages, billing, and other previously live pages were left unchanged in this slot
