# FUNCTIONALITY RESTORATION V18

## Scope
V18 continues the safe redesign plan from the V6 functional base and V17 package. This package focuses on Admin catalog and RBAC surfaces while preserving the original live/fallback loaders, API action components, route structure, and RBAC navigation behavior.

## Redesigned functional areas

### Admin Service Catalog
Routes updated:
- `/portal/catalog/services`
- `/portal/catalog/services/[serviceId]`

Functionality preserved:
- `loadIntegratedCatalogWorkspace()` remains the source for the catalog workspace.
- `ServiceCatalogTable` remains active and receives `result.data.items`.
- `CatalogAdminActions` remains active and continues to call the live catalog action endpoints.
- Service detail route remains available for each service definition.
- Selected service state, category tree, guardrails, downstream impact, API item lookup, tags, service modes, and duration profile remain visible.
- Live/fallback status remains shown through `DataSourceBanner`.

V18 visual layer added:
- Modern governance hero panel.
- Catalog intelligence strip for active services, draft queue, and guardrails.
- Refined functional table styling.
- Refined secondary grid and catalog guardrail cards.
- Fixed service detail copy initialization so the localized service detail page can render correctly.

### Admin Access / RBAC
Routes updated:
- `/portal/access/rbac`
- `/portal/access/rbac/roles/[roleId]`

Functionality preserved:
- `loadIntegratedRbacWorkspace()` remains the source for the RBAC workspace.
- `AccessReviewTable` remains active and receives `result.data.items`.
- `RbacAdminActions` remains active and continues to call role assignment and access review endpoints.
- Role detail drilldown remains available through `/portal/access/rbac/roles/[roleId]`.
- Selected grant, available roles, privileged controls, review queue, role matrix, linked risks, and certification evidence remain visible.
- Live/fallback status remains shown through `DataSourceBanner` on the RBAC workspace.

V18 visual layer added:
- Modern RBAC governance hero panel.
- Access governance intelligence strip for visible grants, linked risks, and available roles.
- Refined RBAC functional table styling.
- Refined role detail workspace and supporting evidence cards.

## Files changed
- `apps/admin/src/app/portal/catalog/services/page.tsx`
- `apps/admin/src/app/portal/catalog/services/[serviceId]/page.tsx`
- `apps/admin/src/app/portal/access/rbac/page.tsx`
- `apps/admin/src/app/portal/access/rbac/roles/[roleId]/page.tsx`
- `apps/admin/src/components/admin/service-catalog-table.tsx`
- `apps/admin/src/components/admin/access-review-table.tsx`
- `apps/admin/src/app/globals.css`

## Validation
- Installed admin dependencies locally for validation only.
- Ran `npm run build` inside `apps/admin`.
- Build completed successfully.
- Route inventory exported to `validation/v18/admin_route_files_v18.txt`.
- Build result recorded in `validation/v18/admin_v18_build_result.txt`.

## Preservation rule followed
V18 does not replace catalog or RBAC functionality with static screens. It keeps the existing functional pages, loaders, tables, action components, and detail routes, then applies the new shared visual layer around them.
