# Phase 24 Merge Checklist — Provider Create Runtime Fix

1. Copy the patch files into the workspace.
2. Restart the API and Admin web app.
3. Clear the browser cache for `localhost:3001` if the runtime overlay remains cached.
4. Open `/portal/accounts`.
5. Create a provider with:
   - first name
   - last name
   - email
   - role `PROVIDER`
   - optional organization
6. Confirm one of the following:
   - provider is created successfully and the success notice appears, or
   - a readable in-page error appears instead of a Next.js runtime overlay.
7. If the error mentions missing migrations, run Prisma generate/migrate and restart the API.
8. Verify patient create/update still works.
9. Verify provider update and status change still work.
