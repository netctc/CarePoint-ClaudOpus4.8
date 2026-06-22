# CarePoint Option B - Validation V6

## Static checks

```bash
npm run check:secrets --silent
npm run verify:workspace --silent
npm run verify:python-worker --silent
cd services/python-worker && python3 -m pytest -q
```

## Coverage added

- Route-scoped canary plan/advance/pause/resume.
- Deterministic assignment using a non-default route.
- Release checklist generation.
- Evidence bundle generation with contract hash, rollout state and checklist.
