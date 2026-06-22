# Phase 34 — Admin Coverage Route Recovery + Latency Diagnostics

## Purpose

This package fixes the confirmed Admin routing problem that remains after the route tree was verified under `apps/admin/src/app`.

The package restores the missing Admin page:

```text
apps/admin/src/app/portal/coverage/page.tsx
```

It also adds route-tree and latency diagnostic scripts that use the correct Admin route root:

```text
apps/admin/src/app
```

## What this phase does not do

- It does not add `Frontend/` or `Backend/` wrapper folders.
- It does not move routes to `apps/admin/app`.
- It does not include or modify `.env`.
- It does not replace the existing dashboard, accounts, organizations, sign-in, or support pages.

## Install

Extract this ZIP at the repository root:

```powershell
C:\Users\MA\Desktop\dev\care-center-work-HSP
```

Then run:

```powershell
Remove-Item -Recurse -Force .\apps\admin\.next -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force .\.turbo -ErrorAction SilentlyContinue
npm run dev:admin
```

## Verify route files

```powershell
.\scripts\check-admin-src-route-tree.ps1
```

Expected: the main Admin routes should be OK. `apps/admin/app` should not exist unless it is intentional.

## Measure latency

With Admin running on port 3001:

```powershell
.\scripts\measure-admin-routes.ps1
```

Use the output to identify remaining SSR/API latency after `/portal/coverage` is restored.

## Remaining known work

The latest runtime log still shows slow Admin pages:

- `/portal/dashboard`: about 21.7 seconds
- `/portal/organizations`: about 20.9 seconds
- `/portal/catalog/services`: about 5.9 seconds

Those should be handled in the next phase with API query optimization, server fetch timeouts, and non-blocking Admin page loading.
