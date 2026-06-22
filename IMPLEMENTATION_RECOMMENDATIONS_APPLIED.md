# Applied recommendation changes

This update applies a first production-hardening pass directly in the codebase.

## 1) Shared contracts expanded
- Added shared locale contract and normalization helpers.
- Added shared provider portal permission matrix.
- Added shared limited-PHI role rules.
- Added shared workflow status catalogs.
- Added shared access role-assignment schemas.
- Added shared release-request schemas.

## 2) API hardening
- Request locale normalization now uses the shared contracts package.
- Patient preference, patient consent, and telehealth locale validation now use the same shared locale schema.
- Added `/api/system/catalog` to expose route groups, critical journeys, supported locales, and workflow/status baselines.

## 3) Provider web alignment
- Provider role and feature-access helpers now consume shared contracts instead of a local permission matrix.

## 4) Mobile multilingual foundation
- Added application localization layer for English and Arabic.
- Wired locale and Flutter localization delegates into `MaterialApp.router`.
- Added `Accept-Language` propagation to the mobile API client.
- Localized the highest-priority patient flow screens:
  - language selection
  - sign in
  - OTP verification
  - profile setup
  - consent center
  - home dashboard

## Notes
- This is an implementation pass, not a complete platform-wide translation of every screen.
- The repository still contains legacy/incomplete backend modules that need a separate stabilization pass before a clean full-repo build can be guaranteed.
