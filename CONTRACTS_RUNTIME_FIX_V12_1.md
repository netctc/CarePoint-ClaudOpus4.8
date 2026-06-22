# Contracts Runtime Fix V12.1

## Issue
The API could fail on startup with:

`ReferenceError: hybridPythonJobTypeSchema is not defined`

The failing file was `packages/contracts/dist/index.js`.

## Cause
The distributed CommonJS build inside `packages/contracts/dist/index.js` was stale/corrupted for two hybrid Python schemas and referenced `hybridPythonJobTypeSchema` as a local variable instead of `exports.hybridPythonJobTypeSchema`.

## Fix applied
- Rebuilt `packages/contracts/dist` from `packages/contracts/src/index.ts` using the contracts TypeScript build.
- Verified the generated runtime export with:
  - `require('./packages/contracts/dist/index.js')`
  - `hybridPythonJobTypeSchema` loads successfully.

## Local recovery command
If this appears in an existing local checkout, run:

```powershell
npm run build:contracts
```

Then restart the API service.
