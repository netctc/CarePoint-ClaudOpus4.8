# Fix Notes — 2026-04-16

## Issue fixed
Patient dashboard was failing with a PrismaClientValidationError because `services/api/src/modules/dashboard/dashboard.routes.ts` selected `telehealthSession.meetingUrl`, but the Prisma schema for `TelehealthSession` only contains `joinUrl`.

## Applied change
- Replaced `item.telehealthSession?.meetingUrl ?? item.telehealthSession?.joinUrl ?? null` with `item.telehealthSession?.joinUrl ?? null`
- Replaced Prisma select `{ meetingUrl: true, joinUrl: true }` with `{ joinUrl: true }`

## Expected result
- `GET /api/dashboard/patient` should stop returning `500` for this schema mismatch.
