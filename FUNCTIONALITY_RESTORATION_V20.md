# FUNCTIONALITY RESTORATION V20

## Scope
V20 continues the safe Admin redesign strategy from the functional V6/V12 base and builds on V19. This version applies the modern design layer to Admin audit, integrations, and policy-governance areas without replacing loaders, actions, tables, exports, or existing routes.

## Redesigned functional routes

### Audit and governance
- `/portal/audit/logs`
- `/portal/audit/refill-governance`

### Integrations
- `/portal/settings/integrations`

### Policy templates
- `/portal/policy/templates`
- `/portal/policy/templates/editor`

## Functionality preserved

### Audit logs
- `loadIntegratedAuditLogs(50)`
- filtered account audit loader against `/api/admin/users/audit`
- accountType/accountId/includeRelated/resource/resourceId/action/actor/from/to/limit filters
- saved audit views
- scoped CSV export link using `/portal/audit/logs/export`
- `AuditLogTable`
- `AuditExportActions`
- `DataSourceBanner`
- live/fallback behavior

### Refill governance audit
- `loadRefillGovernanceWorkspace()`
- saved scopes
- delivery failure drilldown
- selected scope details
- `RefillAuditExportActions`
- `DataSourceBanner`
- live/fallback behavior

### Integrations
- `loadIntegratedIntegrationsWorkspace()`
- localized integration copy through `getAdminPortalCopy(locale).integrations`
- `IntegrationsTable`
- selected integration details
- dependency and rotation checks
- `IntegrationAdminActions`
- platform dependencies and guardrails
- `DataSourceBanner`
- live/fallback behavior

### Policy templates
- `loadIntegratedPolicyWorkspace()`
- `PolicyTemplatesTable`
- `PolicyAdminActions`
- editor preview route
- usage map
- version history
- approval checklist
- publication/archive API controls
- live/fallback behavior

## Design work completed
- Added V20 governance design layer in `apps/admin/src/app/globals.css`.
- Applied modern hero panels, evidence cards, signal cards, tables, and responsive surfaces.
- Preserved original component boundaries and server/client action behavior.
- No functional routes were converted into redirects.

## Validation
- Admin app built successfully with `npm run build` from `apps/admin`.
- Build log saved at `validation/v20/admin_v20_build_result.txt`.
- Admin route inventory saved at `validation/v20/admin_route_files_v20.txt`.

## Notes
The first local build attempt used the default API base and reached page-data collection slowly. The successful validation build used `NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:9` to make live API fallback fail fast during static generation, preserving the same fallback behavior intended for unavailable APIs.
