# Expanded Test Data Seed

This workspace includes an expanded demo dataset for local testing.

## Local credentials

All seeded users use:

- Password: `ChangeMe123!`

Primary quick-login accounts:

- Admin: `admin@carecenter.local`
- Support: `support@carecenter.local`
- Finance: `finance@carecenter.local`
- Default provider mobile account: `provider@carecenter.local`
- Default patient mobile account: `patient@carecenter.local`

## Seed coverage

The seed now prepares at least:

- 10 provider accounts across different specialties
- 20 patient accounts
- 36 appointments with a mix of requested, confirmed, completed, cancelled, and no-show states
- released and unreleased lab items
- multiple clinical orders
- multiple prescription drafts
- RPM enrollments
- provider alerts
- facility settings
- provider schedule templates
- patient-provider message threads
- encounter and lab-result medical records

## Example provider specialties

- Family Medicine
- Dermatology
- Pediatrics
- Cardiology
- Endocrinology
- Orthopedics
- Neurology
- Obstetrics & Gynecology
- Psychiatry

## After extracting the workspace

Run the usual local refresh steps:

```bash
npm run prisma:generate --workspace @care-center/api
npm run prisma:seed --workspace @care-center/api
```

For a clean schedule-state refresh, this workspace also resets:

- `services/api/data/scheduling-store.json`

That allows published slots to be regenerated from the seeded schedule templates.
