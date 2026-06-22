# PILOT-V2 — Environment Activation Checklist

## Environment identity

| Check | Owner | Required before |
|---|---|---|
| Staging URL recorded | Release owner | Rehearsal |
| Environment owner assigned | Release owner | Rehearsal |
| Pilot support window defined | Pilot owner | Launch runbook |
| Data usage policy documented | Technical owner | Launch runbook |

## Configuration and secrets

| Check | Owner | Severity |
|---|---|---|
| `.env.example` reviewed against staging variables | Technical owner | P0 |
| Secret values are stored outside the repository | Technical owner | P0 |
| `npm run check:secrets` path remains available | Technical owner | P0 |
| Missing variables have owner/date before launch | Release owner | P0 |

## Build and service activation

| Check | Evidence |
|---|---|
| `npm install` passes | terminal log |
| `npm run build:api` passes | terminal log |
| `npm run build:web` passes | terminal log |
| API service package is present | `services/api/package.json` |
| Admin package is present | `apps/admin/package.json` |
| Provider package is present | `apps/provider/package.json` |
| Shared contracts package is present | `packages/contracts/package.json` |
| Python worker verification script is present | `scripts/option_b/verify_python_worker.py` |

## Data and rollback

| Check | Owner | Required evidence |
|---|---|---|
| Database backup timestamp recorded | Technical owner | backup proof |
| Migration command documented | Technical owner | command/log |
| Restore path documented | Technical owner | restore steps |
| Rollback owner assigned | Release owner | owner name |
| Rollback triggers reviewed | Release owner | trigger map |

## Support and observability

| Check | Owner |
|---|---|
| Support channel active | Support owner |
| Incident severity rules available | Support owner |
| Logs/observability location identified | Technical owner |
| Daily review window scheduled | Pilot owner |

## Activation outcome

Record one of:

```text
continue
hold
retry-rehearsal
rollback
```

The outcome becomes the entry signal for PILOT-V3.
