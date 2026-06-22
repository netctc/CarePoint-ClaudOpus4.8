# QA-V7 Post-Close Backlog

## Purpose

This backlog separates future work from the closed QA/UAT phase. Items here should not reopen QA-V7 unless they represent a blocking closure defect.

## Recommended next phase

Controlled pilot, staging signoff, or production go-live execution.

## Candidate post-close work

| Area | Item | Recommended handling |
|---|---|---|
| Pilot execution | Capture real user feedback from first controlled users | New pilot/go-live phase |
| Automation | Convert high-value manual QA scenarios to Playwright/Cypress | Post-close automation backlog |
| Observability | Add richer dashboards and alert thresholds | Operations backlog |
| Performance | Execute load/performance baseline under realistic data | Production readiness extension or performance phase |
| Accessibility | Conduct full manual screen-reader audit with target assistive technology | Accessibility follow-up |
| Security | Perform formal penetration test or third-party security review | Security validation phase |
| Product analytics | Add event tracking for adoption and funnel analysis | Product operations backlog |

## Reopen criteria

Create a corrective QA-V8 only if:

1. QA-V7 artifacts are missing or corrupt.
2. `npm run audit:qa` cannot execute after applying QA-V7.
3. A final closure document contains materially incorrect readiness information.
4. A P0 defect is discovered that invalidates the closure package.

Otherwise, continue as a new phase rather than extending QA.
