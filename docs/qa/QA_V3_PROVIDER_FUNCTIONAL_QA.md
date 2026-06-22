# QA-V3 Provider Functional QA

## Purpose

QA-V3 prepares the Provider application for structured functional QA execution after QA-V1 master planning and QA-V2 Admin readiness.

## Scope

Provider QA covers:

- provider sign-in and protected portal access;
- portal shell, sidebar, topbar, skip link, and main content landmark;
- dashboard workload and KPI cards;
- queue and governed refill worklist;
- calendar, slots, schedule templates, and appointments;
- prescription creation and prescription detail review;
- encounter note drafting, validation, and signing;
- patient chart context;
- messages, labs, telehealth, orders, settings, and team surfaces;
- Provider responsive, accessibility, and i18n smoke checks.

## Evidence expectations

Each Provider scenario should capture:

- tester and date;
- environment and build reference;
- provider role or fixture used;
- test steps executed;
- expected and actual result;
- pass, fail, or blocked status;
- screenshots, logs, or linked defect IDs when applicable.

## Boundary

QA-V3 does not modify backend contracts, Python worker logic, database schema, or application runtime behavior. It adds QA planning, validation scripts, and evidence artifacts only.
