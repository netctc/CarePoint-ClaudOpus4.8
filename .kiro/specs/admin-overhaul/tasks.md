# Tasks: Admin Overhaul

## Task 1: Shared UI Components Foundation
- [x] 1.1 Create `AdminDataTable` component (`src/components/ui/admin-data-table.tsx`) with props for columns, data, onFilter, onSort, onPageChange, onExport, searchable, pagination config; support Excel/PDF/CSV export, column visibility toggle, saved filter presets via localStorage
- [x] 1.2 Create `ToastProvider` and `useToast` hook (`src/components/ui/toast.tsx`) supporting success/error/info variants; success auto-dismisses in 5s; error includes retry button; add provider to portal layout
- [x] 1.3 Create `ConfirmDialog` component (`src/components/ui/confirm-dialog.tsx`) with title, description, confirmLabel, cancelLabel, onConfirm, onCancel props; renders as modal overlay with focus trap
- [x] 1.4 Create `LoadingButton` component (`src/components/ui/loading-button.tsx`) extending button with isLoading state showing spinner, disabled during loading
- [x] 1.5 Create `FilterPanel` component (`src/components/ui/filter-panel.tsx`) accepting filter definitions (select, multi-select, date range, text) and rendering collapsible groups
- [x] 1.6 Create `StatsGrid` component (`src/components/ui/stats-grid.tsx`) rendering clickable stat cards with label, value, trend, href props; navigates on click
- [x] 1.7 Create `ChartCard` component (`src/components/ui/chart-card.tsx`) with title, time interval selector (daily/weekly/monthly/yearly), and chart render area
- [x] 1.8 Create `EmptyState` component (`src/components/ui/empty-state.tsx`) with icon, title, description, and optional action button

## Task 2: Admin Welcome Page
- [x] 2.1 Update the admin welcome/portal entry page to display device approval checkboxes identical to the Provider app: same layout, spacing, typography, icons, colors, responsive behavior
- [x] 2.2 Implement left navigation sidebar default-collapsed state (persisted via localStorage), expand on hover or click interaction

## Task 3: Dashboard — Action Buttons (Backend)
- [x] 3.1 Create `POST /api/admin/reports/generate` endpoint in `services/api/src/modules/admin/` that generates a report (JSON/CSV format), returns downloadable response, and logs the action to audit
- [x] 3.2 Create `POST /api/admin/system/sync` endpoint that triggers a system sync operation, returns status, and logs the action to audit

## Task 4: Dashboard — Action Buttons (Frontend)
- [x] 4.1 Create `DashboardActions` client component (`src/components/admin/dashboard-actions.tsx`) with Download Report and System Sync buttons using `LoadingButton`; calls API endpoints; shows toast on success/error

## Task 5: Dashboard — Interactive Statistics
- [x] 5.1 Modify `StatCard` component to accept optional `href` prop; when provided, renders as clickable `<Link>` element
- [x] 5.2 Wire dashboard KPI stats: "Providers" links to `/portal/providers`, "Appointments" links to `/portal/bookings/control-tower`, "Active Providers" links to `/portal/providers?status=active`
- [x] 5.3 Create `GET /api/admin/providers/growth` endpoint accepting `interval` query param (daily/weekly/monthly/yearly), returning time-series data for provider registrations and activity
- [~] 5.4 Create `ProviderGrowthChart` client component (`src/components/admin/provider-growth-chart.tsx`) with time interval selector, fetches data from growth endpoint, renders interactive SVG bar chart with hover tooltips

## Task 6: Dashboard — Patient Statistics
- [x] 6.1 Create `GET /api/admin/patients/statistics` endpoint returning: totalPatients, newPatients, activePatients, chronicPatients, upcomingAppointments, telehealthUsage, avgVisitsPerMonth, satisfactionRating, emergencyCases, mostRequestedServices
- [~] 6.2 Create `PatientStatsDashboard` component (`src/components/admin/patient-stats-dashboard.tsx`) displaying all patient metrics with two charts (visits bar chart, services distribution donut)
- [~] 6.3 Replace "Subject Context Summary" section in dashboard page with `PatientStatsDashboard` component

## Task 7: Provider Section — UI Cleanup
- [~] 7.1 Remove `DataSourceBanner` usage from all provider pages
- [~] 7.2 Remove hero panel descriptive text, "Design Applied" tags, focus areas card, redesign feature lists, intelligence strip explanatory labels from provider directory page
- [~] 7.3 Remove design coverage section and evidence expected section from provider directory page

## Task 8: Provider Management Center (Backend)
- [~] 8.1 Extend `GET /api/admin/providers` to support query params: name, type, specialty, medicalCenter, department, license, email, phone, country, state, city, languages, gender, yearsOfExperience, availability (online/inPerson/homeVisit), status (active/inactive), verified, acceptingNewPatients, calendarAvailability; with pagination (page, limit) and sort
- [~] 8.2 Create `GET /api/admin/providers/statistics` endpoint returning: totalProviders, activeCount, onlineCount, availableTodayCount, avgRating, avgAppointmentDuration, cancellationRate, patientSatisfaction
- [~] 8.3 Add provider status indicator computation to provider service: Active, Inactive, Currently Online, Has Scheduled Appointments, No Scheduled Appointments, Available Today, Fully Booked, Available for New Patients

## Task 9: Provider Management Center (Frontend)
- [~] 9.1 Rebuild `/portal/providers/page.tsx` as Provider Management Center with: `StatsGrid` (provider statistics), `FilterPanel` (all filter categories), `AdminDataTable` (provider list with status indicators), action buttons (Add Provider, Export)
- [~] 9.2 Implement provider row click navigation to `/portal/providers/[providerId]`
- [~] 9.3 Implement provider status badge rendering with color-coded indicators for each status type

## Task 10: Provider Profile Page
- [~] 10.1 Extend provider detail API (`GET /api/admin/providers/:id`) to include: appointments (upcoming/past), assigned patients, medical centers, reviews, ratings, performance metrics
- [~] 10.2 Rebuild `/portal/providers/[providerId]/page.tsx` with tabbed layout: Overview (professional info, contact, licenses, certifications, specialties), Schedule (calendar, upcoming appointments), Patients (treated, upcoming, history), Performance (metrics, ratings), Reviews
- [~] 10.3 Implement lazy-loading for each tab's data (fetch on tab activation)

## Task 11: Provider Queue & Review
- [~] 11.1 Create `POST /api/admin/providers/queue/claim` endpoint accepting item IDs, assigns to current admin user, returns updated items
- [~] 11.2 Create `POST /api/admin/providers/queue/reassign` endpoint accepting item IDs and target admin user ID, reassigns and notifies
- [~] 11.3 Redesign Provider Queue page (`/portal/providers/onboarding`): remove all explanatory text, add action bar with Claim Selected, Reassign, Open SLA Lane buttons, improve filtering (status, SLA, risk, assignee, date)
- [~] 11.4 Redesign Provider Queue Review page: remove descriptive text, add clear status progression indicators, document review panels, and approval/rejection action buttons

## Task 12: Service Catalog (Backend)
- [~] 12.1 Extend `GET /api/admin/catalog/services` to support filters: category, providerType, specialty, department, availability, priceRange (min/max), insuranceCoverage, status (active/archived); with pagination and sort
- [~] 12.2 Create `GET /api/admin/catalog/services/:id/dependencies` endpoint returning dependency graph (services that depend on this service and services it depends on)
- [~] 12.3 Create `POST /api/admin/catalog/services/:id/clone` endpoint that duplicates a service with a new ID, returning the clone
- [~] 12.4 Create `POST /api/admin/catalog/services/archive` endpoint accepting service IDs array, archives them, audit logs the action

## Task 13: Service Catalog & Workspace (Frontend)
- [~] 13.1 Rebuild Service Catalog page (`/portal/catalog/services`): remove introductory text, add `FilterPanel`, `AdminDataTable`, and action buttons (Inspect Dependencies, Clone Service, Archive Selected, Create Service)
- [~] 13.2 Implement Inspect Dependencies modal showing dependency graph visualization
- [~] 13.3 Implement Clone Service flow with confirmation and navigation to cloned service
- [~] 13.4 Create `GET /api/admin/catalog/services/:id/metrics` endpoint returning: providerCount, appointmentCount, monthlyUtilization, yearlyUtilization, demandTrends, satisfactionScore, revenue
- [~] 13.5 Rebuild Service Workspace page: remove text, add statistics section and interactive charts for utilization/demand

## Task 14: Coverage Module — Database & Backend
- [~] 14.1 Create Prisma schema models: `InsuranceProvider` (id, name, code, type, contactInfo, status), `CoveragePlan` (id, insuranceProviderId, name, type, coverage, deductible, copay, coinsurance, status), `GeographicCoverage` (id, planId, country, state, city, zipCodes, radius), `ServiceCoverage` (id, planId, serviceId, covered, priorAuthRequired, copayAmount, limits), `NetworkProvider` (id, planId, providerId, inNetwork, tier, effectiveDate, terminationDate), `AuthorizationRequirement` (id, planId, serviceId, required, criteria, validDays), `CoveragePolicy` (id, name, rules, status, version, effectiveDate, auditTrail)
- [~] 14.2 Create and run Prisma migration for coverage models
- [~] 14.3 Create coverage module routes, controller, and service in `services/api/src/modules/coverage/`
- [~] 14.4 Implement CRUD endpoints: `GET/POST /api/admin/coverage/insurance-providers`, `GET/PUT/DELETE /api/admin/coverage/insurance-providers/:id`
- [~] 14.5 Implement CRUD endpoints: `GET/POST /api/admin/coverage/plans`, `GET/PUT/DELETE /api/admin/coverage/plans/:id`
- [~] 14.6 Implement CRUD endpoints for geographic coverage, service coverage, network providers, authorization requirements, and policies
- [~] 14.7 Create `POST /api/admin/coverage/validate` endpoint that accepts (patientId, serviceId, planId) and returns coverage validation result (covered, copay, priorAuthRequired, exclusions)
- [~] 14.8 Add audit logging to all coverage mutation endpoints (publish, suspend, archive, rollback)

## Task 15: Coverage Module — Frontend
- [~] 15.1 Rebuild `/portal/coverage/page.tsx` as Coverage overview dashboard with stats (active plans, insurance providers, pending validations, coverage rate) and navigation tabs to sub-sections
- [~] 15.2 Create `/portal/coverage/insurance-providers/page.tsx` with `AdminDataTable` for CRUD operations on insurance providers
- [~] 15.3 Create `/portal/coverage/plans/page.tsx` with `AdminDataTable` for coverage plans management, linked to insurance providers
- [~] 15.4 Create `/portal/coverage/policies/page.tsx` for policy management with version history and status controls (publish/suspend/archive/rollback)
- [~] 15.5 Create `/portal/coverage/geographic/page.tsx` for geographic coverage mapping
- [~] 15.6 Create `/portal/coverage/network/page.tsx` for network providers directory
- [~] 15.7 Create coverage API client (`src/lib/api/coverage-api.ts`) with functions for all coverage CRUD operations

## Task 16: Booking Control (Backend)
- [~] 16.1 Extend `GET /api/admin/bookings` to support filters: dateRange, provider, patient, status, service, medicalCenter, insurance, mode (telehealth/inPerson); return stats alongside results (totalBookings, upcoming, completed, cancelled, rescheduled, noShows, avgWaitingTime, successRate)
- [~] 16.2 Create action endpoints: `POST /api/admin/bookings/bulk-notify` (send notifications to selected bookings), `POST /api/admin/bookings/:id/reassign` (reassign provider with reason), `POST /api/admin/bookings/:id/cancel` (cancel with reason, audit log), `POST /api/admin/bookings/:id/refund-review` (open refund review)

## Task 17: Booking Control (Frontend)
- [~] 17.1 Rebuild Booking Control page (`/portal/bookings/control-tower`): remove text, add `StatsGrid` with booking metrics, `FilterPanel`, `AdminDataTable`
- [~] 17.2 Implement action buttons: Bulk Notify, Export Exceptions, Open Rebooking Queue, Reassign Provider, Cancel with Reason, Open Refund Review, Notify Support Owner — each with `ConfirmDialog` and `useToast` feedback
- [~] 17.3 Implement booking row links to provider and patient profiles

## Task 18: Telehealth Operations (Backend)
- [~] 18.1 Create `GET /api/admin/telehealth/metrics` endpoint returning: onlineConsultationsToday, ongoingSessions, completedSessions, failedSessions, avgDuration, waitingPatients, technicalIncidents, connectionQuality, dailyUsage (array), weeklyTrends (array)
- [~] 18.2 Create `POST /api/admin/telehealth/incidents/:id/escalate` endpoint that escalates a technical incident, notifies support team, and audit logs
- [~] 18.3 Create `GET /api/admin/telehealth/sessions` endpoint with filters: provider, patient, date, sessionStatus, connectionQuality, incidentType, medicalCenter, specialty

## Task 19: Telehealth Operations (Frontend)
- [~] 19.1 Rebuild Telehealth Operations page (`/portal/telehealth/operations`): remove text, add dashboard stats grid, charts (daily usage line chart, weekly trends bar chart), `FilterPanel`, `AdminDataTable` for sessions
- [~] 19.2 Implement action buttons: Open Incident Detail (navigates to detail), Export Monitor (downloads report), Open Support Handoff (opens modal), Escalate Technical Incident (with confirmation)

## Task 20: Global Polish & Integration
- [~] 20.1 Audit all pages for remaining placeholder/descriptive text and remove any found
- [~] 20.2 Verify all buttons across the application are functional (no non-functional buttons remain)
- [~] 20.3 Ensure all data tables implement empty states with `EmptyState` component
- [~] 20.4 Verify RBAC integration: all mutating endpoints check admin permissions via existing IAM middleware
- [~] 20.5 Add responsive styles ensuring all new components work on tablet and desktop viewports
- [~] 20.6 Run full build (`next build`) and fix any TypeScript or build errors
