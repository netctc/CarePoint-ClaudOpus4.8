# CarePoint / Dokploy deployment assets

This folder contains the Dokploy-ready assets for the CarePoint monorepo.

## Files
- `docker-compose.dokploy.yml`: deploy all services in one Dokploy Compose application.
- `.env.example`: copy into Dokploy Environment and replace all placeholders.

## Services included
- `postgres` (PostgreSQL 16)
- `redis` (Redis 7)
- `api` (Express/Prisma on port 4000)
- `admin` (Next.js on port 3001)
- `provider` (Next.js on port 3000)
- `patient_web` (Flutter Web on port 80)
- `provider_mobile_web` (Flutter Web on port 80)

## Important note
The repository contains `apps/provider_mobile`, not `apps/admin_mobile`.
If you intended a sixth application, add it later using the same Flutter-web pattern.
