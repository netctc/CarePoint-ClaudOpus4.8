#!/usr/bin/env bash
set -euo pipefail

ROOT="${1:-$(pwd)}"

say() { printf '\n[%s] %s\n' "normalize" "$1"; }
fail() { printf '\n[normalize][error] %s\n' "$1" >&2; exit 1; }
ensure_dir() { mkdir -p "$1"; }
write_file() {
  local path="$1"
  shift
  mkdir -p "$(dirname "$path")"
  cat > "$path"
}

[ -d "$ROOT" ] || fail "Repo root does not exist: $ROOT"

say "Preparing workspace folders"
ensure_dir "$ROOT/apps"
ensure_dir "$ROOT/packages"
ensure_dir "$ROOT/services"
ensure_dir "$ROOT/.bootstrap"

if [ -d "$ROOT/SPrrovider" ] && [ ! -d "$ROOT/apps/provider" ]; then
  say "Moving SPrrovider to apps/provider"
  mv "$ROOT/SPrrovider" "$ROOT/apps/provider"
fi

if [ -d "$ROOT/Administrator" ] && [ ! -d "$ROOT/apps/admin" ]; then
  say "Moving Administrator to apps/admin"
  mv "$ROOT/Administrator" "$ROOT/apps/admin"
fi

if [ -d "$ROOT/CarePoint" ] && [ ! -d "$ROOT/apps/mobile" ]; then
  say "Moving CarePoint to apps/mobile"
  mv "$ROOT/CarePoint" "$ROOT/apps/mobile"
fi

[ -d "$ROOT/apps/provider" ] || fail "apps/provider is missing"
[ -d "$ROOT/apps/admin" ] || fail "apps/admin is missing"
[ -d "$ROOT/apps/mobile" ] || fail "apps/mobile is missing"

say "Writing root workspace files"
cat > "$ROOT/package.json" <<'JSON'
{
  "name": "care-center-platform",
  "version": "0.1.0",
  "private": true,
  "workspaces": [
    "apps/*",
    "packages/*",
    "services/*"
  ],
  "scripts": {
    "dev:admin": "npm run dev --workspace @care-center/admin",
    "dev:provider": "npm run dev --workspace @care-center/provider",
    "dev:api": "npm run dev --workspace @care-center/api",
    "build:admin": "npm run build --workspace @care-center/admin",
    "build:provider": "npm run build --workspace @care-center/provider",
    "build:api": "npm run build --workspace @care-center/api",
    "build:web": "npm run build:admin && npm run build:provider",
    "build": "npm run build:web && npm run build:api"
  },
  "engines": {
    "node": ">=20.0.0"
  }
}
JSON

cat > "$ROOT/.gitignore" <<'TXT'
node_modules
dist
.next
coverage
.env
.env.*
!.env.example
.DS_Store
*.log
apps/mobile/.dart_tool
apps/mobile/build
apps/mobile/.flutter-plugins
apps/mobile/.flutter-plugins-dependencies
apps/mobile/.packages
apps/mobile/.metadata
services/api/generated
services/api/prisma/dev.db
TXT

cat > "$ROOT/.env.example" <<'TXT'
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/care_center
REDIS_URL=redis://localhost:6379
API_PORT=4000
JWT_ACCESS_SECRET=replace-me
JWT_REFRESH_SECRET=replace-me-too
JWT_ACCESS_TTL=15m
JWT_REFRESH_TTL=30d
FRONTEND_PROVIDER_URL=http://localhost:3000
FRONTEND_ADMIN_URL=http://localhost:3001
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
TELEHEALTH_VENDOR=daily
DAILY_API_KEY=
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
TXT

cat > "$ROOT/README.md" <<'MD'
# Care Center Platform

Monorepo layout created by the normalization bootstrap.

## Apps
- `apps/admin` - company administration portal (Next.js)
- `apps/provider` - healthcare provider portal (Next.js)
- `apps/mobile` - patient mobile app (Flutter)

## Services
- `services/api` - backend API (created by later bootstrap steps)

## Packages
- `packages/contracts` - shared TypeScript contracts (created by later bootstrap steps)
MD

say "Creating missing admin Next.js scaffold"
cat > "$ROOT/apps/admin/package.json" <<'JSON'
{
  "name": "@care-center/admin",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev -p 3001",
    "build": "next build",
    "start": "next start -p 3001",
    "lint": "next lint"
  },
  "dependencies": {
    "next": "14.2.5",
    "react": "18.3.1",
    "react-dom": "18.3.1"
  },
  "devDependencies": {
    "@types/node": "20.14.9",
    "@types/react": "18.3.3",
    "@types/react-dom": "18.3.0",
    "typescript": "5.5.3"
  }
}
JSON

cat > "$ROOT/apps/admin/next-env.d.ts" <<'TS'
/// <reference types="next" />
/// <reference types="next/image-types/global" />

// This file is auto-managed by Next.js.
TS

cat > "$ROOT/apps/admin/next.config.mjs" <<'JS'
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
};

export default nextConfig;
JS

cat > "$ROOT/apps/admin/tsconfig.json" <<'JSON'
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": false,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "baseUrl": ".",
    "plugins": [
      {
        "name": "next"
      }
    ]
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
JSON

cat > "$ROOT/apps/admin/README.md" <<'MD'
# Admin Portal

This app was normalized into the monorepo and given the missing Next.js root scaffold.
MD

say "Normalizing provider package metadata"
cat > "$ROOT/apps/provider/package.json" <<'JSON'
{
  "name": "@care-center/provider",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev -p 3000",
    "build": "next build",
    "start": "next start -p 3000",
    "lint": "next lint"
  },
  "dependencies": {
    "next": "14.2.5",
    "react": "18.3.1",
    "react-dom": "18.3.1"
  },
  "devDependencies": {
    "@types/node": "20.14.9",
    "@types/react": "18.3.3",
    "@types/react-dom": "18.3.0",
    "typescript": "5.5.3"
  }
}
JSON

say "Ensuring mobile scaffold can be completed locally"
if command -v flutter >/dev/null 2>&1; then
  if [ ! -d "$ROOT/apps/mobile/android" ] || [ ! -d "$ROOT/apps/mobile/ios" ]; then
    say "Running flutter create in apps/mobile"
    (
      cd "$ROOT/apps/mobile"
      flutter create . --platforms=android,ios,web
    )
  fi
else
  say "Flutter CLI not found; skipping platform bootstrap for apps/mobile"
fi

say "Writing helper docs"
cat > "$ROOT/.bootstrap/NORMALIZATION_NOTES.md" <<'MD'
## Normalization notes

- `SPrrovider` was moved to `apps/provider`.
- `Administrator` was moved to `apps/admin`.
- `CarePoint` was moved to `apps/mobile`.
- Admin received the missing Next.js root files so it can become buildable.
- Root workspaces were added with npm workspaces.
MD

say "Normalization complete"
