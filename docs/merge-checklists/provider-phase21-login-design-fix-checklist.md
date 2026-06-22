# Provider Phase 21 Login Design Fix — Merge Checklist

## Apply files
Copy the included files into the project root, preserving paths:

- `apps/provider/app/page.tsx`
- `apps/provider/app/sign-in/page.tsx`
- `apps/provider/app/sign-in/sign-in-form.tsx`
- `apps/provider/app/globals.css`

## Commands

```powershell
npm run dev:provider
```

Optional production check after dependencies are installed:

```powershell
npm run build:provider
```

## Browser checks

1. Open `http://localhost:3000/`.
   - Expected: redirect to `/sign-in`.
2. Open `http://localhost:3000/sign-in`.
   - Expected: two-panel Admin-style Provider login page.
3. Open `http://localhost:3000/portal/dashboard` while logged out.
   - Expected: redirect to `/sign-in?next=/portal/dashboard`.
4. Submit credentials without ticking confirmation boxes.
   - Expected: validation messages appear.
5. Tick both confirmation boxes and send OTP.
   - Expected: OTP challenge screen appears.
6. In development, confirm the OTP code is displayed if the API returns `devCode`.
7. Verify OTP.
   - Expected: session is persisted and browser redirects to the requested Provider portal path.
8. Check responsive layout in browser dev tools:
   - Desktop
   - Tablet
   - Mobile

## Notes
- No `.env` file is included.
- No new required environment variables were added.
