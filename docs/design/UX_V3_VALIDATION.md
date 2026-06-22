# UX-V3 Validation

Run from the repository root:

```bash
npm run audit:ux
node --check scripts/ux/scan-components.mjs
python3 -m json.tool packages/design-system/tokens/carepoint.tokens.json
python3 -m json.tool docs/design/UX_PHASE_MANIFEST.json
python3 -m json.tool validation/ux/ux-v3-component-normalization-audit.json
```

Expected result:

- UX-V1 design-surface audit succeeds;
- UX-V2 layout/navigation audit succeeds;
- UX-V3 component-normalization audit succeeds;
- component audit reports 100% completion across required UX-V3 instrumentation checks.

Build note:

UX-V3 does not require backend rebuilds and does not change Option B Python Progressive contracts. Frontend builds should be validated in the target environment with installed `node_modules`.
