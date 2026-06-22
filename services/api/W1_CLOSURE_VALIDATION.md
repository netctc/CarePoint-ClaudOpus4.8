# CarePoint W1 closure validation guide

This pack closes the remaining W1 foundation items with four concrete additions:

1. Redis-backed auth-challenge persistence with file fallback.
2. Server-side privileged-risk enforcement for admin/provider sign-in.
3. Real enterprise SSO handoff endpoints for admin/provider portals.
4. Seed refresh behavior so demo credentials are updated on reseed.

## Recommended environment

```bash
AUTH_CHALLENGE_REDIS_ENABLED=true
REDIS_URL=redis://localhost:6379
PRIVILEGED_ALLOWED_EMAIL_DOMAINS=carecenter.local
SSO_ENABLED=true
SSO_PROVIDER_NAME=Azure AD
SSO_AUTHORIZE_URL=https://login.microsoftonline.com/<tenant>/oauth2/v2.0/authorize
SSO_CLIENT_ID=<client-id>
SSO_CALLBACK_URL=http://localhost:4000/api/auth/sso/callback
SSO_SCOPE=openid profile email offline_access
```

## Smoke checks

### 1. Refresh seeded credentials

```bash
npm run prisma:seed --workspace @care-center/api
```

Expected seeded credentials:
- admin@carecenter.local / ChangeMe123!
- provider@carecenter.local / ChangeMe123!
- patient@carecenter.local / ChangeMe123!

### 2. Check SSO configuration

```bash
curl http://localhost:4000/api/auth/sso/config?roleHint=admin
curl http://localhost:4000/api/auth/sso/config?roleHint=provider
```

### 3. Start a privileged challenge

```bash
curl -X POST http://localhost:4000/api/auth/challenge/start   -H 'Content-Type: application/json'   -d '{
    "email":"admin@carecenter.local",
    "password":"ChangeMe123!",
    "managedDevice":true,
    "riskAcknowledged":true,
    "channel":"totp"
  }'
```

Expect: 202 with `challengeId`, `risk`, `challengeStoreMode`, and optional `devCode` in non-production.

### 4. Verify OTP flow for patient onboarding

```bash
curl -X POST http://localhost:4000/api/auth/otp/request   -H 'Content-Type: application/json'   -d '{"identifier":"patient@carecenter.local","channel":"email"}'
```

### 5. Confirm export-purpose controls
- Admin portal audit export should require purpose of use.
- Provider compliance export should require purpose of use.
- Exports should include watermark metadata from the API response path.

## W1 completion checklist

- [ ] Admin sign-in challenge succeeds with risk acknowledgement.
- [ ] Provider sign-in challenge succeeds with risk acknowledgement.
- [ ] SSO handoff returns a real IdP authorize URL when enabled.
- [ ] Patient OTP request/verify works end to end.
- [ ] Language persists across patient sessions.
- [ ] Patient profile persists across sessions and devices.
- [ ] Consent choices and consent history are retrievable through the API.
- [ ] Seeded credentials are refreshed on reseed.
