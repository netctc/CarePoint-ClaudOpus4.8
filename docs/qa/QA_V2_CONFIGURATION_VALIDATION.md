# QA-V2 - Configuration Validation

## Purpose

This document defines configuration validation for the Admin QA stage.

## Configuration checks

QA-V2 verifies the presence of:

- root `package.json`;
- Admin workspace package;
- API workspace package;
- shared contracts package;
- `.env.example`;
- QA phase manifest;
- QA-V1 critical E2E matrix;
- UX-V6 closure evidence;
- design system tokens for Admin visual regression.

## Required scripts

The following scripts should be available from the root workspace:

```bash
npm run audit:qa
npm run audit:qa:master-plan
npm run audit:qa:admin-config
npm run build:admin
npm run build:web
npm run build:api
```

## Environment safety

The `.env.example` file is treated as a template and must not contain production secrets.

QA-V2 checks for obvious committed secret markers such as live secret keys, cloud access keys, private key blocks, and plain password assignments.

## Validation command

```bash
npm run audit:qa
```

Expected result:

```text
QA-V2 admin functional/config audit written to validation/qa/qa-v2-admin-functional-config-audit.json
QA-V2 admin functional test plan written to validation/qa/qa-v2-admin-functional-test-plan.json
Aggregate completion: 100%
```
