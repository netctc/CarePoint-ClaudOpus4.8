# Design: Admin Overhaul

## Overview
This design covers the comprehensive overhaul of the CarePoint Admin Web Application. The implementation is structured as incremental section-based deliverables — each section (Dashboard, Providers, Coverage, etc.) is a self-contained unit with its own backend endpoints and frontend components.

**Tech Stack**: Next.js 16 (App Router), TypeScript, React 18 — Frontend | Express + Prisma — Backend

---

## Architecture Decisions

### 1. Shared Data Table Component
A reusable `<AdminDataTable>` component will power all data tables across the application. It encapsulates search, sorting, multi-column filtering, pagination, export (Excel/PDF/CSV), column visibility, and saved filter presets. Each page passes column definitions and a data-fetching function.

### 2. API Pattern — Server Actions + API Routes
- Read operations use Next.js server components calling backend API directly (existing pattern with `loadIntegrated*` functions).
- Mutating operations (button clicks, form submissions) use client components that call `/api/*` endpoints through the existing `api-client.ts`.
- All mutating endpoints return structured responses: `{ success: boolean, data?: T, error?: { code: string, message: string } }`.

### 3. Notification System
A global `<ToastProvider>` in the portal layout provides `useToast()` hook to all pages. Toasts auto-dismiss after 5 seconds. Error toasts include a retry button.

### 4. Confirmation Dialog Pattern
A shared `<ConfirmDialog>` component is invoked before destructive operations. It accepts title, description, confirmLabel, and onConfirm callback.

### 5. Coverage Module — Greenfield
Since the Coverage module is entirely new, it follows the established pattern:
- Backend: `services/api/src/modules/coverage/` with routes, controller, service, and Prisma models.
- Frontend: `apps/admin/src/app/portal/coverage/` with sub-routes for each section.

---

## Component Design

### Shared Components (New)

| Component | Location | Purpose |
|-----------|----------|---------|
| `AdminDataTable` | `src/components/ui/admin-data-table.tsx` | Reusable table with search, sort, filter, paginate, export |
| `ToastProvider` / `useToast` | `src/components/ui/toast.tsx` | Global notification system |
| `ConfirmDialog` | `src/components/ui/confirm-dialog.tsx` | Confirmation before destructive actions |
| `LoadingButton` | `src/components/ui/loading-button.tsx` | Button with loading spinner state |
| `FilterPanel` | `src/components/ui/filter-panel.tsx` | Reusable multi-filter sidebar/drawer |
| `StatsGrid` | `src/components/ui/stats-grid.tsx` | Clickable stat cards grid |
| `ChartCard` | `src/components/ui/chart-card.tsx` | Wrapper for interactive charts with time toggles |
| `EmptyState` | `src/components/ui/empty-state.tsx` | Empty result placeholder |

### Page Layouts

Each overhauled page follows a consistent layout:
1. **Stats Bar** — Clickable stat cards at the top (using `StatsGrid`)
2. **Filter + Actions Bar** — Left-aligned filters, right-aligned action buttons
3. **Data Table** — Main content area with `AdminDataTable`
4. **Charts Section** — Below or beside the table where applicable

---

## Section-by-Section Design

### Section 1: Admin Welcome Page
- Mirror the Provider app's `DeviceApprovalCheckbox` component with identical styles.
- Navigation sidebar state defaults to `collapsed` via a localStorage-backed state.

### Section 2: Dashboard Overhaul
**Action Buttons**:
- Convert hero buttons to client component `DashboardActions` that calls:
  - `POST /api/admin/reports/generate` → downloads report blob
  - `POST /api/admin/system/sync` → triggers sync job
- Both use `LoadingButton` with toast feedback.

**Interactive Stats**:
- Wrap KPI cards in `<Link>` elements pointing to filtered pages.
- Replace `StatCard` with clickable variant that supports `href` prop.

**Patient Statistics Dashboard**:
- New server data loader: `loadPatientStatistics()` calling `GET /api/admin/patients/statistics`.
- Replace Subject Context Summary section with new `PatientStatsDashboard` component.
- Charts rendered with lightweight SVG (no heavy chart library — extend existing bar chart pattern).

**Provider Growth Chart**:
- Add time interval selector (daily/weekly/monthly/yearly) as client component.
- Fetch chart data from `GET /api/admin/providers/growth?interval={interval}`.

### Section 3: Provider Management Center
**Backend**:
- Extend `GET /api/admin/providers` with query params for all 20+ filters.
- Add `GET /api/admin/providers/statistics` for aggregate metrics.
- Add status indicator computation in provider service.

**Frontend**:
- Replace current Provider page with clean `ProviderManagementCenter` component.
- Use `AdminDataTable` with provider-specific column definitions.
- `FilterPanel` with all filter categories in collapsible groups.
- Provider row click → navigates to `/portal/providers/[providerId]`.

**Provider Profile** (`/portal/providers/[providerId]`):
- Tabbed layout: Overview | Schedule | Patients | Performance | Reviews.
- Each tab lazy-loads its data.
- Backend: Extend provider detail endpoint to include related data (appointments, patients, reviews).

### Section 4: Provider Queue & Review
- Strip all explanatory text.
- Add action bar with `Claim Selected`, `Reassign`, `Open SLA Lane` buttons.
- `Claim Selected` → `POST /api/admin/providers/queue/claim` with item IDs.
- `Reassign` → Opens modal, calls `POST /api/admin/providers/queue/reassign`.
- `Open SLA Lane` → Applies SLA-at-risk filter to existing table.

### Section 5: Service Catalog & Workspace
**Catalog**:
- Clean page with `AdminDataTable`, filters, and action buttons.
- `Inspect Dependencies` → Modal with dependency tree (API: `GET /api/admin/catalog/services/:id/dependencies`).
- `Clone Service` → `POST /api/admin/catalog/services/:id/clone`.
- `Archive Selected` → `POST /api/admin/catalog/services/archive` with confirmation.
- `Create Service` → Navigate to `/portal/catalog/services/create`.

**Workspace**:
- Statistics from `GET /api/admin/catalog/services/:id/metrics`.
- Charts for utilization and demand.

### Section 6: Coverage Module (New)
**Database Models** (Prisma):
- `InsuranceProvider`, `CoveragePlan`, `GeographicCoverage`, `ServiceCoverage`, `NetworkProvider`, `AuthorizationRequirement`, `CoveragePolicy`.

**API Routes** (`/api/admin/coverage/*`):
- CRUD for insurance providers, plans, policies.
- `POST /api/admin/coverage/validate` — validates coverage for a service/patient/plan combo.
- All mutations audit-logged.

**Frontend Pages**:
- `/portal/coverage` — Overview dashboard with tabs for each sub-section.
- Sub-routes: `/insurance-providers`, `/plans`, `/geographic`, `/services`, `/network`, `/authorization`, `/policies`.

### Section 7: Booking Control
- Clean page layout with `StatsGrid` for booking metrics.
- `AdminDataTable` with booking-specific columns and filters.
- Action buttons use `LoadingButton` + `ConfirmDialog` where destructive.
- Backend: `GET /api/admin/bookings` with filter params, plus action endpoints.

### Section 8: Telehealth Operations
- Dashboard stats from `GET /api/admin/telehealth/metrics`.
- Session table with `AdminDataTable`.
- Charts for daily usage and weekly trends.
- Action buttons: `Open Incident Detail` navigates to detail page, `Escalate` calls `POST /api/admin/telehealth/incidents/:id/escalate`.

---

## API Endpoints (New/Extended)

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/admin/reports/generate` | Generate downloadable report |
| POST | `/api/admin/system/sync` | Trigger system sync |
| GET | `/api/admin/patients/statistics` | Patient stats for dashboard |
| GET | `/api/admin/providers/growth` | Provider growth chart data |
| GET | `/api/admin/providers/statistics` | Provider aggregate metrics |
| POST | `/api/admin/providers/queue/claim` | Claim queue items |
| POST | `/api/admin/providers/queue/reassign` | Reassign queue items |
| GET | `/api/admin/catalog/services/:id/dependencies` | Service dependency graph |
| POST | `/api/admin/catalog/services/:id/clone` | Clone a service |
| POST | `/api/admin/catalog/services/archive` | Archive services |
| GET | `/api/admin/catalog/services/:id/metrics` | Service workspace metrics |
| CRUD | `/api/admin/coverage/*` | Full coverage module endpoints |
| POST | `/api/admin/coverage/validate` | Coverage validation |
| GET | `/api/admin/bookings` | Booking list with filters |
| POST | `/api/admin/bookings/bulk-notify` | Bulk notify bookings |
| POST | `/api/admin/bookings/:id/reassign` | Reassign provider |
| POST | `/api/admin/bookings/:id/cancel` | Cancel with reason |
| GET | `/api/admin/telehealth/metrics` | Telehealth dashboard metrics |
| POST | `/api/admin/telehealth/incidents/:id/escalate` | Escalate incident |

---

## File Structure (Key New Files)

```
apps/admin/src/
├── components/ui/
│   ├── admin-data-table.tsx
│   ├── toast.tsx
│   ├── confirm-dialog.tsx
│   ├── loading-button.tsx
│   ├── filter-panel.tsx
│   ├── stats-grid.tsx
│   ├── chart-card.tsx
│   └── empty-state.tsx
├── components/admin/
│   ├── dashboard-actions.tsx (client)
│   ├── patient-stats-dashboard.tsx
│   ├── provider-growth-chart.tsx (client)
│   ├── provider-management-table.tsx
│   └── booking-actions.tsx (client)
├── app/portal/
│   ├── dashboard/page.tsx (overhauled)
│   ├── providers/page.tsx (overhauled)
│   ├── providers/[providerId]/page.tsx (overhauled)
│   ├── providers/onboarding/page.tsx (queue - overhauled)
│   ├── catalog/services/page.tsx (overhauled)
│   ├── coverage/page.tsx (rebuilt)
│   ├── coverage/insurance-providers/page.tsx (new)
│   ├── coverage/plans/page.tsx (new)
│   ├── coverage/policies/page.tsx (new)
│   ├── bookings/control-tower/page.tsx (overhauled)
│   └── telehealth/operations/page.tsx (overhauled)
└── lib/api/
    ├── admin-server.ts (extended)
    └── coverage-api.ts (new)

services/api/src/modules/coverage/
├── coverage.routes.ts
├── coverage.controller.ts
├── coverage.service.ts
└── coverage.types.ts
```
