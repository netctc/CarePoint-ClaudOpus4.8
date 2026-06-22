# CarePoint V22.2 - Provider Prescription Controlled Input Fix

## Issue addressed
React warned that `apps/provider/app/portal/prescriptions/new/page.tsx` was changing an uncontrolled input to a controlled input.

The warning was caused by prescription composer form state being initialized from fallback values that could be `undefined`:

- `drug`
- `dosage`
- `frequency`
- `duration`
- `pharmacyName`

## Fix applied
The prescription composer now initializes every text-input state with a stable string value using `?? ''`, and each input renders a safe string value for its full lifecycle.

Updated file:

- `apps/provider/app/portal/prescriptions/new/page.tsx`

## Functional impact
No business logic was removed or replaced.

Preserved functionality:

- provider prescription composer
- live prescription loading
- refill request list
- pharmacy queue list
- create and sign prescription flow
- compliance preview
- patient / appointment context parameters

## Validation
- `npm install --ignore-scripts` completed in the package workspace.
- `npm run build:provider` reached successful Next.js compilation.
- The container wrapper timed out during static page generation, after the build had already printed `Compiled successfully`.

## Runtime recommendation
Restart the provider dev server after applying this package:

```powershell
Ctrl+C
npm run dev:provider
```
