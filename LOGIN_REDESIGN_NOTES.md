# Provider + Admin Login Redesign

## What was updated
- Applied the new split-layout sign-in design to the **provider** login experience.
- Applied the same design system to the **admin** login experience.
- Preserved the existing live verification, resend-code, and enterprise SSO flows.
- Kept locale support in English and Arabic.

## Key files changed
- `apps/provider/app/sign-in/sign-in-form.tsx`
- `apps/provider/app/sign-in/page.tsx`
- `apps/provider/app/globals.css`
- `apps/provider/lib/i18n/provider-dictionary.ts`
- `apps/admin/src/app/auth/sign-in/sign-in-client.tsx`
- `apps/admin/src/app/auth/sign-in/page.tsx`
- `apps/admin/src/app/globals.css`

## Notes
- The provider login copy was extended to support the new visual sections.
- Build verification could not be executed in this environment because project dependencies are not installed (`next` is unavailable).
