# Admin Accounts CRUD Phase 5 — CSV Import/Export Operations

## Scope

This phase extends the Admin Patient & Provider Accounts workspace with operational bulk onboarding and data extraction capabilities. It builds on Phase 4 lifecycle and audit controls.

## Added API capabilities

- `GET /api/admin/users/export?type=PATIENT|PROVIDER&q=&status=`
  - Exports patient or provider accounts as CSV.
  - Honors organization scope for non-Super Admin users.
  - Honors optional search and status filters.
  - Returns attachment filenames `carepoint-patient-accounts.csv` or `carepoint-provider-accounts.csv`.

- `POST /api/admin/users/import`
  - Accepts `{ type, csv }` or `{ type, rows }`.
  - Supports `PATIENT` and `PROVIDER` imports.
  - Create-only behavior to prevent accidental overwrites.
  - All-or-nothing validation: if any row is invalid, no accounts are created.
  - Checks required names, email, duplicate emails inside the file, existing emails in the database, valid organization scope, provider role, status, and row limits.
  - Limit: 200 rows per request.
  - Writes audit events using `admin.patient.imported` or `admin.provider.imported`.

## Added Admin UI capabilities

- Export buttons for filtered Patient and Provider account CSV files.
- New Admin route handler: `/portal/accounts/export` to securely proxy CSV downloads using the admin access token cookie.
- CSV import panels for patients and providers with starter templates.
- Import guidance for scoped admins and Super Admins.

## Files changed

- `services/api/src/modules/admin-users/admin-users.routes.ts`
- `apps/admin/src/app/portal/accounts/page.tsx`
- `apps/admin/src/app/portal/accounts/export/route.ts`
- `apps/admin/src/app/globals.css`

## CSV templates

### Patients

```csv
organizationId,firstName,lastName,email,dateOfBirth,insuranceNumber,status,password
org-id,Amina,Haddad,amina.patient@example.com,1990-05-12,INS-1001,ACTIVE,ChangeMe123!
```

### Providers

```csv
organizationId,firstName,lastName,email,role,specialty,licenseNumber,services,status,password
org-id,Karim,Nasser,karim.provider@example.com,PROVIDER,Cardiology,LIC-1001,"Consultation|Telehealth",ACTIVE,ChangeMe123!
```

## Notes

- No `.env` file is included.
- The feature assumes Phase 3 lifecycle schema fields are already applied to the database.
- Full build validation was not run because dependencies are not installed in this extracted workspace.
