# HSP Role Implementation — Phase 6 Audit/Compliance Facility Scope + Legacy Route Normalization

## What this phase implements

### 1) Facility-aware audit metadata
- Added `services/api/src/lib/audit-facility-context.ts`
- Audit events now carry normalized `facilityContext` whenever possible
- `writeAuditLog()` now enriches events with:
  - existing location/facility values from request details
  - inferred appointment location for common resources:
    - `appointment`
    - `medical_record`
    - `telehealth_session`
    - `telehealth_ops`
    - `telehealth_session_policy`
    - `telehealth_patient_readiness`
    - `payment`

### 2) Provider compliance / audit exports
- Provider compliance summary, logs, and export endpoints now accept `location`
- HSP facility enforcement is applied before location-filtered compliance access
- Provider compliance payloads now return:
  - `locationFilter`
  - `facilityBreakdown`
  - `scopeIntegrity` (`facilityTagged` vs `unscoped` counts)

### 3) Admin audit exports/logs
- Admin audit logs and export APIs now accept `location`
- Audit responses now surface `facilityContext`
- Admin audit logs response now includes `facilityBreakdown`
- Admin audit page adds facility/location filter UI

### 4) Legacy provider route normalization
- Provider alerts route now accepts `location` and applies HSP facility scope
- Telehealth session listing now includes appointment `location`
- Telehealth session listing now accepts `location` and applies HSP facility scope for provider/nurse users

### 5) Provider web UI
- Provider compliance page now supports facility/location filtering
- Facility column added to compliance audit table
- Facility breakdown rendered in summary card

## Notes
- This phase improves facility tagging significantly, but records without reliable facility or appointment linkage can still appear as `Unassigned`
- That ambiguity is now surfaced explicitly through `scopeIntegrity` and facility breakdown output instead of being hidden inside organization-wide exports
