# CarePoint Admin — Integration Slot 5 Status

Version: `admin-v1.1-integration-slot-5-growth-reporting-integrations.zip`

Included in this slot:
- wired `/portal/reports/builder` to live API reads and report workflow mutations
- wired `/portal/notifications/campaigns` to live API reads and campaign workflow mutations
- wired `/portal/settings/integrations` to live API reads and integration control mutations
- wired `/portal/reviews/moderation` to live API reads and moderation workflow mutations
- added page-level fallback banners and preserved mock fallback behavior when the backend is unavailable
- added client-side mutation controls for reports, campaigns, integrations, and moderation workflows
- extended the shared Admin browser API client and server data loaders for the Slot E API surfaces

Validation performed:
- changed TS/TSX files passed file-level TypeScript transpile validation
- archive sanity-checked for the updated pages, helpers, action components, and status file
- no runtime `.env` is packaged
