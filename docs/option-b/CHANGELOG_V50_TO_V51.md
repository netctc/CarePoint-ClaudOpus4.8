# Changelog V50 to V51

## Added

- Cross-platform dependency installer for Python worker local/dev test dependencies.
- Cross-platform Python worker contract test runner that sets `PYTHONPATH` without shell-specific syntax.
- Root npm scripts for Python worker setup and contract-test execution.

## Changed

- Clarified why `httpx` is required in the Python worker requirements file.

## Not changed

- No new Python worker gates.
- No new TypeScript contracts.
- No worker manifest bump beyond the existing V49 schema, because V51 is a test-environment repair release.
