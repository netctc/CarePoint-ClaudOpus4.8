# Care Center bootstrap scripts

These scripts are designed for the ZIP you uploaded. They do **not** claim to finish the whole healthcare platform automatically; they generate a buildable monorepo foundation and the first working backend/auth/domain modules needed to replace the current starter-only state.

## Files

- `01-normalize-repo.sh`
  - Moves the current three codebases into a monorepo layout.
  - Fixes the `SPrrovider` naming issue.
  - Adds the missing Next.js scaffold for the admin app.
  - Adds root workspace files.
  - Bootstraps missing Flutter platform folders if Flutter is installed.

- `02-build-backend-and-contracts.sh`
  - Creates `packages/contracts`.
  - Creates `services/api` with Express + TypeScript + Prisma + Socket.IO.
  - Adds Docker Compose for PostgreSQL and Redis.
  - Adds a real database schema instead of mock-only models.

- `03-implement-auth-rbac.sh`
  - Adds JWT auth, refresh tokens, password hashing, audit logging, RBAC middleware, and guarded frontend middleware/hooks.

- `04-enable-core-workflows.sh`
  - Adds functional endpoints for appointments, medical records, messaging, telehealth session orchestration, and payments.
  - Adds API clients for provider/admin web apps and a Dart API client starter for the mobile app.

- `bootstrap-all.sh`
  - Runs all four scripts in order.

## Suggested usage

From the extracted project root:

```bash
chmod +x ./.bootstrap/*.sh
./.bootstrap/bootstrap-all.sh .
```

Or run each step manually:

```bash
./.bootstrap/01-normalize-repo.sh .
./.bootstrap/02-build-backend-and-contracts.sh .
./.bootstrap/03-implement-auth-rbac.sh .
./.bootstrap/04-enable-core-workflows.sh .
```

## Assumptions

- Current folders at the repo root are `Administrator`, `SPrrovider`, and `CarePoint`.
- Preferred backend stack:
  - Node.js 20+
  - npm workspaces
  - Express
  - Prisma
  - PostgreSQL
  - Redis
  - Socket.IO
- Third-party services are optional at scaffold time:
  - Stripe for payments
  - Daily or Twilio for telehealth
  - SMTP/SMS/push providers can be added later

## What these scripts do not finish for you

- Full UI wiring of every existing page
- Real lab/EHR/FHIR integrations
- Full HIPAA/GDPR program implementation
- Mobile platform signing, certificates, store deployment
- Production DevOps, observability, and end-to-end tests

Those still need follow-up engineering after the scaffold is generated.
