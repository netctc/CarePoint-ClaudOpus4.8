# Validation V10

Commands executed locally for the package:

```bash
npm run check:secrets --silent
npm run verify:workspace --silent
python3 scripts/option_b/verify_python_worker.py
cd services/python-worker && python3 -m pytest -q
```

Expected Python result: all tests pass, including V10 contract replay and privacy preflight.
