# UX-V4 Responsive, Accessibility, and Visual QA Hardening

## Purpose

UX-V4 hardens the CarePoint Admin and Provider web portals for responsive behavior, keyboard accessibility, motion preferences, high-contrast environments, and visual QA readiness.

This delivery remains inside `CarePoint Phase 2 - Design Refinement & UX Stabilization` and does not reopen the closed `Option B Python Progressive` technical phase.

## Added design-system layer

- `packages/design-system/css/carepoint-responsive-a11y.css`
- accessibility tokens for touch targets, focus rings, scroll margin, disabled opacity, and reduced motion
- responsive tokens for compact mobile breakpoints and mobile table widths
- QA metadata for browser, keyboard, contrast, responsive, and print smoke checks

## Admin and Provider hardening

Both portals now include UX-V4 global rules for:

- visible `:focus-visible` rings;
- minimum touch target behavior for navigation, icon buttons, primary buttons, and interactive controls;
- mobile stacking at narrow widths;
- safer table overflow on small screens;
- reduced-motion support;
- forced-colors/high-contrast support;
- print CSS that removes shell chrome from printed clinical/admin content.

## Manual QA checklist

1. Keyboard tab through Admin and Provider portal shells.
2. Confirm focus order remains logical after skip-link activation.
3. Verify breakpoints around 1440px, 1100px, 900px, 540px, and 390px.
4. Confirm dense tables scroll horizontally on narrow screens.
5. Enable reduced motion and validate non-essential transitions are suppressed.
6. Enable high-contrast/forced-colors mode and verify controls remain visible.
7. Print representative Admin and Provider pages and verify navigation shell elements are hidden.
