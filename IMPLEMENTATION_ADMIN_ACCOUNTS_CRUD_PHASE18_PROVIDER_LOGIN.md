# Phase 18 — Provider Web Login Flow Alignment

## Scope
This phase updates the Provider web application startup and sign-in experience.

## Requirements implemented
1. The Provider web start page no longer shows the two landing buttons:
   - `Open Sign-In`
   - `Open Portal`
2. `/` in the Provider app now redirects directly to `/sign-in`.
3. The Provider sign-in page layout now follows the Admin web login design pattern:
   - two-panel card layout
   - left-side security/branding hero
   - right-side credential and OTP challenge panel
   - language switcher in the hero header
   - admin-style metric cards, breadcrumb steps, option cards, and controlled action row
4. The existing provider authentication business logic is preserved:
   - managed-device confirmation
   - privileged-access acknowledgement
   - OTP/challenge start
   - OTP verification
   - resend challenge
   - development OTP code display when returned by the API
   - enterprise SSO option when available

## Files changed
- `apps/provider/app/page.tsx`
- `apps/provider/app/sign-in/page.tsx`
- `apps/provider/app/sign-in/sign-in-form.tsx`
- `apps/provider/app/globals.css`

## Notes
- No API behavior was changed in this phase.
- No database migration was added.
- No `.env` file is included.
- No new required environment variables were added.

## Validation performed
- TypeScript/TSX syntax transpile diagnostics passed for:
  - `apps/provider/app/page.tsx`
  - `apps/provider/app/sign-in/page.tsx`
  - `apps/provider/app/sign-in/sign-in-form.tsx`

## Recommended manual verification
1. Start Provider web:
   ```bash
   npm run dev:provider
   ```
2. Open:
   ```text
   http://localhost:3000/
   ```
   Expected result: automatic redirect to `/sign-in`.
3. Verify `/sign-in` shows the Admin-like two-panel login layout.
4. Verify Provider OTP flow still works:
   - enter provider email/password
   - check managed-device confirmation
   - acknowledge privileged access
   - click Send OTP
   - verify OTP page appears
   - verify development code appears when the API returns `devCode`
5. Verify language switcher still works.
