# CarePoint v1 — Integration Scope

## Purpose

This document freezes the external-integration scope for the controlled v1 pilot tracked by #17. The production release must fail closed: **the presence of a credential or provider configuration never expands the approved pilot scope.** Any change from OUT to IN requires an explicit release change, review, green CI, updated staging evidence, and an updated version of this document.

Do not record secret values, access tokens, webhook secrets, private keys, signed URLs, provider payloads, or PHI in git, issues, PR comments, screenshots, or test evidence.

## Closed v1 matrix

| Integration | v1 decision | Production behavior | Required staging evidence |
| --- | --- | --- | --- |
| Email OTP | **IN** | Real email delivery provider is required for privileged MFA. Authentication fails closed when delivery is unavailable. | Successful delivered OTP/challenge with synthetic privileged account; controlled provider-failure test; no OTP value in logs/evidence. |
| Patient SMS OTP / Twilio | **OUT** | No production SMS OTP adapter is enabled. Twilio credential presence does not make SMS OTP part of v1. | Confirm runtime inventory reports OUT and the user flow does not claim SMS delivery success. |
| Daily telehealth | **OUT** | Production placeholder/vendor room flow remains blocked for v1. `DAILY_API_KEY` presence does not enable pilot telehealth. | Confirm runtime inventory reports OUT and any telehealth entry point fails/degrades explicitly rather than simulating a live vendor session. |
| Stripe payments | **OUT** | Production payment intent creation remains in explicit manual-review mode. `STRIPE_SECRET_KEY` presence is ignored by the production runtime for v1. | Confirm runtime inventory reports OUT; create a synthetic non-cash payment and verify `gateway=manual`, pending/manual-review next action, and no external Stripe operation. |
| Enterprise SSO | **OUT** | Production SSO handoff is unavailable for v1 even if `SSO_ENABLED` and SSO URLs/client ID are configured. | Confirm runtime inventory reports OUT and a synthetic SSO handoff attempt fails explicitly without redirecting to an external IdP. |

## Repository enforcement

The source of truth is `services/api/src/lib/release-integration-scope.ts`:

- `patientEmailOtp: IN`
- `patientSmsOtp: OUT`
- `telehealth: OUT`
- `stripePayments: OUT`
- `enterpriseSso: OUT`

Production runtime enforcement is intentionally separate from credential detection:

- `services/api/src/lib/env.ts` records whether Stripe/SSO configuration is present, but exposes Stripe and SSO as runtime-enabled only when the release policy allows them.
- `services/api/src/modules/payments/payments.routes.ts` consumes `env.stripeSecretKey`; for the v1 production runtime that value is empty, so non-cash payment flows use the existing explicit manual-review path and cannot call Stripe.
- `services/api/src/lib/auth-sso.ts` consumes the scope-gated SSO configuration; production v1 cannot produce an SSO authorize redirect.
- `services/api/src/modules/integrations/integration.routes.ts` reports `inScope`, `configured`, and `runtimeEnabled` separately. A configured OUT integration must never be represented as IN or healthy merely because credentials exist.
- `services/api/src/__tests__/release-integration-scope.test.ts` locks the matrix and production fail-closed behavior.
- `scripts/release/verify-vps-deploy.mjs` statically guards the production wiring and this document.

## Required non-secret configuration names for the only IN integration

Email delivery must use one of the repository-supported provider paths configured through the approved runtime secret channel. Record only the provider choice and non-sensitive status; never record values.

Relevant names may include:

- `RESEND_API_KEY`
- SMTP-related runtime configuration supported by the mailer
- `PRIVILEGED_ALLOWED_EMAIL_DOMAINS`

The exact deployed secret values are operational data and must stay outside git.

## Staging execution for #17

Execute against the exact SHA deployed by #13 using synthetic accounts/data only.

### Email OTP — IN

1. Confirm the production preflight detects a real email delivery provider.
2. Start a privileged challenge for a synthetic allowed-domain account.
3. Verify the message is delivered through the real provider.
4. Complete the challenge using the delivered code without placing that code in GitHub evidence.
5. Trigger one controlled provider failure/unavailability case and confirm authentication fails closed with no bypass.
6. Review application/provider logs for secrets, OTP values and personal data; none may be exposed.

### OUT integrations

For SMS, Daily, Stripe and SSO:

1. Check `/api/integrations/runtime-capabilities` with an authorized synthetic admin account.
2. Confirm `inScope=false` for each OUT integration.
3. Where safe, deliberately leave/configure a staging credential through the approved secret channel and verify this does **not** change `inScope` or enable the production path.
4. Exercise the relevant user path:
   - SMS: no fake successful SMS delivery.
   - telehealth: no fake vendor session.
   - Stripe: manual-review payment path, no provider capture/intent request.
   - SSO: no external IdP redirect.
5. Remove any unnecessary OUT credentials after the test unless the platform owner has a documented reason to retain them.

## Evidence template for #17

Post only non-sensitive evidence:

```text
Release SHA: <40-char SHA>
CI run: <run number>
Email OTP decision: IN
Email provider configured: PASS/FAIL
Delivered privileged OTP flow: PASS/FAIL
Email provider failure is fail-closed: PASS/FAIL
OTP/secret values absent from evidence/log review: PASS/FAIL
Patient SMS OTP decision/runtime: OUT / PASS|FAIL
Daily telehealth decision/runtime: OUT / PASS|FAIL
Stripe decision/runtime: OUT / PASS|FAIL
Stripe synthetic payment gateway=manual: PASS/FAIL
Enterprise SSO decision/runtime: OUT / PASS|FAIL
SSO external redirect blocked: PASS/FAIL
Unexpected external calls: NONE / <redacted defect issue reference>
```

## Closure rule

#17 may close only when:

- the exact deployed release SHA reports the matrix above;
- real Email OTP delivery and one controlled failure case pass in staging;
- every OUT integration is confirmed disabled/fail-closed in the production-mode staging deployment;
- a configured credential cannot silently turn an OUT integration into IN;
- no provider secret, OTP value, webhook payload, token or PHI appears in stored evidence;
- any discovered P0/P1 defect is fixed and revalidated.

Repository CI proves the policy wiring but cannot substitute for the real staging/provider evidence required to close #17.
