# Changelog V49 to V50

## Summary

V50 repairs the Node API build errors reported after V49.

## Fixed

- Fixed TypeScript compile failure caused by missing generated Prisma enum exports in provider credential governance code.
- Fixed TypeScript compile failure caused by missing generated Prisma enum exports in admin account governance code.
- Fixed Prisma known request error type narrowing by using the stable runtime error class import.
- Confirmed `coverageRouter` is imported and mounted in `src/app.ts`.

## Not changed

- No new Python worker job types were added.
- No new contract vectors were added.
- Python worker contract schema remains `2026-05-option-b-v49`.

## Validation

- `npm run build:api` passed.
- Python worker verification passed.
- Python worker contract tests passed.
- Final ZIP integrity check passed.
