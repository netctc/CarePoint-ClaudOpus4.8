# Sustained Operations Governance V32

V32 closes two operational governance gaps before expanding from canary/traffic promotion into sustained operations.

## 1. Compliance and privacy evidence

Before sustained traffic, attach sanitized evidence for:

- privacy preflight
- data retention
- audit trail review
- security posture review
- access control/BOLA review
- data quality review
- DPIA/privacy assessment state
- DPA/vendor processing state
- artifact redaction and piiClass metadata
- compliance/privacy owner approval

Blocking examples:

- missing required privacy/compliance gate evidence
- failing access-control or data-quality evidence
- artifact metadata without redaction
- disallowed piiClass
- unprotected artifact download links
- missing DPIA approval
- missing compliance/privacy owner approval

## 2. Runbook and drill verification

Before sustained operations, attach sanitized metadata for:

- rollback runbook
- incident runbook
- support escalation runbook
- artifact recovery runbook
- data privacy runbook
- rollback drill
- incident drill
- restore drill
- support escalation drill

Blocking examples:

- missing required runbook
- missing required drill
- failing drill
- no recent passing drill

Warning examples:

- stale runbook review date
- stale drill date
- missing owner acknowledgement
- missing runbook link or artifact reference

## Operating rule

Treat V32 outputs as release evidence. Do not use the Python worker to approve compliance, change artifact access, update runbooks, open tickets, page responders or mutate rollout state.
