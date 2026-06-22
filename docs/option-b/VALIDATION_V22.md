# Option B validation V22

Expected validation commands:

```bash
npm run check:secrets --silent
npm run verify:workspace --silent
npm run verify:python-worker --silent
cd services/python-worker && python3 -m pytest -q
unzip -tq /mnt/data/CarePoint_option_B_python_progressive_v22.zip
```

Expected Python result: `78 passed` or higher.

V22 verifies:

- `platform.legacy_path_decommission` returns `ready` with zero traffic, fallback plan and clean evidence.
- `platform.steady_state_operations_review` returns `operate` with runbook, dashboard, alerts, on-call and clean SLO evidence.
- Contract manifest uses `schemaVersion=2026-05-option-b-v22`.
- Contract vectors include both V22 jobs.
