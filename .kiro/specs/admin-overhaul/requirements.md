# Requirements: Admin Overhaul

## Overview
Comprehensive overhaul of the CarePoint Admin Web Application covering UI/UX improvements, functional implementation of non-working features, removal of placeholder content, and building the unimplemented Coverage module. The admin app is built with Next.js 16 (App Router) + TypeScript frontend and Express + Prisma backend.

---

## Requirement 1: Admin Welcome Page — Device Approval
### Acceptance Criteria
- 1.1 The Admin Welcome Page displays two device approval checkboxes with identical layout, spacing, typography, icons, colors, and responsive behavior to the Provider Web Application Welcome Page.
- 1.2 Checkbox 1 reads: "I confirm this device is approved for privileged CarePoint administration."
- 1.3 Checkbox 2 reads: "I acknowledge that privileged access is monitored and elevated-risk sessions may require SSO or additional review."
- 1.4 The left navigation menu is collapsed by default and expands only upon user interaction (hover or click).

## Requirement 2: Dashboard — Action Buttons
### Acceptance Criteria
- 2.1 The "Download Report" button triggers a backend API call, displays a loading spinner during execution, shows a success toast on completion, and shows an error notification with retry option on failure.
- 2.2 The "System Sync" button triggers a backend API call, displays a loading spinner during execution, shows a success toast on completion, and shows an error notification with retry option on failure.

## Requirement 3: Dashboard — Interactive Statistics
### Acceptance Criteria
- 3.1 Clicking "Providers" stat navigates to a Provider Directory page with filters: Provider Type (Physician, Nurse, Therapist, Laboratory, Radiology, Pharmacy, Home Care, Others), Specialty, License Number, Provider Name, Medical Center, City, State, Country, Online Availability, In-Person, Home Visit, Active/Inactive status.
- 3.2 Clicking "Appointments" stat navigates to an Appointments management page with filters: provider, provider type, specialty, status, date range, and links to provider/patient profiles.
- 3.3 Clicking "Active Providers" stat navigates to the Provider Directory pre-filtered to show only active providers.
- 3.4 The "Provider Growth & Activity" chart supports time interval toggles (daily/weekly/monthly/yearly), real-time or scheduled data updates, interactive hover tooltips, and drill-down by clicking chart segments.

## Requirement 4: Dashboard — Patient Statistics
### Acceptance Criteria
- 4.1 The "Subject Context Summary" section is replaced with a Patient Statistics Dashboard showing: Total Patients, New Patients, Active Patients, Chronic Patients, Patients with Upcoming Appointments, Telehealth Usage, Average Visits/Month, Satisfaction Rating, Emergency Cases, Most Requested Services.
- 4.2 The Patient Statistics Dashboard includes at least two charts (e.g., bar chart for visits, donut chart for service distribution).

## Requirement 5: Provider Section — UI Cleanup
### Acceptance Criteria
- 5.1 All banner text, placeholder text, and implementation notes (e.g., "Live API data loaded", "A-02", "Directory focus areas", "Design Applied" tags, redesign feature lists) are removed from the Provider pages.
- 5.2 The DataSourceBanner component is removed from production Provider views.

## Requirement 6: Provider Management Center
### Acceptance Criteria
- 6.1 The Provider Directory is redesigned as a "Provider Management Center" with a data table supporting all filters: Name, Type, Specialty, Medical Center, Department, License, Email, Phone, Country, State, City, Languages, Gender, Years of Experience, Online/In-Person/Home Visits, Active/Inactive, Verified, Accepting New Patients, Calendar Availability.
- 6.2 Provider status indicators display: Active, Inactive, Currently Online, Has Scheduled Appointments, No Scheduled Appointments, Available Today, Fully Booked, Available for New Patients.
- 6.3 A statistics section shows: Total Providers, Active, Online, Available Today, Avg Rating, Avg Appointment Duration, Cancellation Rate, Patient Satisfaction.
- 6.4 The data table supports search, sorting, multi-column filtering, pagination, export (Excel/PDF/CSV), column visibility toggling, and saved filter presets.

## Requirement 7: Provider Profile
### Acceptance Criteria
- 7.1 The "Open Profile" action navigates to a comprehensive Provider Profile page showing: professional info, contact details, licenses, certifications, specialties, schedule, calendar, upcoming/past appointments, assigned patients, medical centers, reviews, ratings, and performance metrics.
- 7.2 The Provider Profile includes a dedicated patient section showing: patients treated, patients with upcoming appointments, and full appointment history.

## Requirement 8: Provider Queue
### Acceptance Criteria
- 8.1 All explanatory/descriptive text is removed from the Provider Queue page.
- 8.2 The Provider Queue is redesigned for operational efficiency with improved filtering (by status, SLA, risk, assignee, date).
- 8.3 Action buttons are functional: "Claim Selected" (assigns queue items to current admin), "Reassign" (opens modal to select new assignee), "Open SLA Lane" (filters to SLA-at-risk items).

## Requirement 9: Provider Queue Review
### Acceptance Criteria
- 9.1 The Provider Queue Review page is redesigned with all descriptive text removed, focusing on workflow efficiency with clear status progression, document review panels, and approval/rejection actions.

## Requirement 10: Service Catalog
### Acceptance Criteria
- 10.1 All introductory/explanatory content is removed from the Service Catalog page.
- 10.2 The Service Catalog supports filters: Service Category, Provider Type, Specialty, Department, Availability, Price Range, Insurance Coverage, Active/Archived.
- 10.3 Action buttons are functional: "Inspect Dependencies" (shows service dependency graph), "Clone Service" (creates duplicate with editable fields), "Archive Selected" (archives with confirmation dialog), "Create Service" (opens service creation form).
- 10.4 The data table supports search, sorting, pagination, export, and column visibility.

## Requirement 11: Service Workspace
### Acceptance Criteria
- 11.1 All descriptive/placeholder text is removed from the Service Workspace page.
- 11.2 Statistics section shows: providers offering service, total appointments, monthly/yearly utilization, patient demand trends, satisfaction score, revenue.
- 11.3 Interactive charts display utilization trends and demand patterns.

## Requirement 12: Coverage Module (New Implementation)
### Acceptance Criteria
- 12.1 A complete Coverage module is implemented with sections: Insurance Providers list, Coverage Plans management, Geographic Coverage mapping, Service Coverage matrix, Network Providers directory, Authorization Requirements, Coverage Validation engine, and Policy Management.
- 12.2 The Coverage module includes CRUD operations for insurance providers, plans, and policies.
- 12.3 Coverage validation is available as an API that booking and payment workflows can query.
- 12.4 All coverage actions (publish, suspend, archive, rollback) are audit-logged.

## Requirement 13: Booking Control
### Acceptance Criteria
- 13.1 All descriptive/placeholder text is removed from the Booking Control page.
- 13.2 Dashboard statistics display: Total Bookings, Upcoming, Completed, Cancelled, Rescheduled, No Shows, Avg Waiting Time, Booking Success Rate.
- 13.3 Filters include: Date range, Provider, Patient, Status, Service, Medical Center, Insurance, Telehealth/In-Person.
- 13.4 Action buttons are functional with confirmation dialogs and audit logging: Bulk Notify, Export Exceptions, Open Rebooking Queue, Reassign Provider, Cancel with Reason, Open Refund Review, Notify Support Owner.

## Requirement 14: Telehealth Operations
### Acceptance Criteria
- 14.1 All descriptive/placeholder text is removed from the Telehealth Operations page.
- 14.2 Dashboard displays: Online Consultations Today, Ongoing/Completed/Failed Sessions, Avg Duration, Waiting Patients, Technical Incidents, Connection Quality, Daily Usage, Weekly Trends with charts.
- 14.3 Filters include: Provider, Patient, Date, Session Status, Connection Quality, Incident Type, Medical Center, Specialty.
- 14.4 Action buttons are functional: Open Incident Detail, Export Monitor, Open Support Handoff, Escalate Technical Incident.

## Requirement 15: Global — Data Table Standard
### Acceptance Criteria
- 15.1 All data tables across the application support: text search, column sorting, multi-column filtering, pagination (configurable page size), export to Excel/PDF/CSV, column visibility toggling, and saved filter presets.
- 15.2 All data tables display empty states with clear messaging when no results match filters.
- 15.3 All data tables implement lazy loading or server-side pagination for datasets exceeding 100 rows.

## Requirement 16: Global — Notifications & Error Handling
### Acceptance Criteria
- 16.1 All mutating actions (buttons, form submissions) display loading indicators during execution.
- 16.2 Success operations show toast notifications that auto-dismiss after 5 seconds.
- 16.3 Error states show error notifications with a descriptive message and a retry action.
- 16.4 Confirmation dialogs are shown before destructive operations (delete, archive, cancel, suspend).

## Requirement 17: Global — Security & Audit
### Acceptance Criteria
- 17.1 All admin actions respect RBAC permissions defined in the existing IAM module.
- 17.2 Elevated operations (bulk actions, status changes, deletions) create audit log entries with actor, action, target, timestamp, and reason.
- 17.3 API endpoints validate input and return structured error responses.
