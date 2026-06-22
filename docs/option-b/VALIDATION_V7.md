# CarePoint Option B - Validation V7

Validation executed for V7:

```bash
npm run check:secrets --silent
npm run verify:workspace --silent
npm run verify:python-worker --silent
cd services/python-worker && python3 -m pytest -q
```

Observed result:

```text
S0 secret/artifact check passed
S0 workspace verification passed
Option B Python worker v7 verification passed
25 passed
```

Build note:

The TypeScript workspace build still requires a full `npm ci` environment. The V7 package includes shared contracts and Node bridge route changes; validate in CI/dev with:

```bash
npm ci
npm run build:contracts
npm run build:api
```

Recommended manual smoke checks once services are up:

```bash
curl -s http://localhost:8010/livez
curl -s http://localhost:8010/readyz
curl -s http://localhost:8010/api/v1/contracts/manifest
```

For authenticated Node/API environments, smoke these routes through the admin bridge:

- `GET /api/hybrid-python/contracts/manifest`
- `POST /api/hybrid-python/admin/accounts/read-model/prepare`
- `POST /api/hybrid-python/admin/provider-roles/reconcile/prepare`
- `POST /api/hybrid-python/scheduling/availability/snapshot/prepare`
- `POST /api/hybrid-python/messaging/reminders/plan/prepare`
- `GET /api/hybrid-python/evidence/bundle`
