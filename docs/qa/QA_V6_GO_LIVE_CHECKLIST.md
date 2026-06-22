# QA-V6 - Go-Live Checklist

## Checklist usage

Use `validation/qa/qa-v6-go-live-checklist.json` as the canonical machine-readable checklist. Each item includes:

- checklist ID;
- readiness domain;
- owner;
- priority;
- required evidence;
- acceptance rule.

## Go/no-go decision model

| Decision | Meaning |
| --- | --- |
| `go` | All P0 gates pass and no unresolved blocking defect remains. |
| `go-with-deferrals` | P0 gates pass or have approved mitigation; P1/P2 issues have owners and dates. |
| `no-go` | One or more P0 gates fail without accepted mitigation. |

## Required evidence fields

- environment;
- release package or build identifier;
- owner/tester;
- date;
- pass/fail or accepted deferral;
- evidence link, screenshot, command output, or approval reference.

## Recommended meeting agenda

1. Confirm release package and SHA-256.
2. Review build and QA command evidence.
3. Review UAT signoff from QA-V5.
4. Review P0/P1/P2 defect status.
5. Confirm backup, rollback, monitoring, and hypercare owners.
6. Record go/no-go decision.
