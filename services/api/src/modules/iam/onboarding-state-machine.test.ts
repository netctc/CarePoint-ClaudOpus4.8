import { describe, it, expect } from 'vitest';
import { TRANSITION_MAP, OnboardingStatus } from './onboarding-state-machine';

describe('Onboarding State Machine - TRANSITION_MAP', () => {
  describe('allowed transitions', () => {
    it('DRAFT can transition to READY_FOR_REVIEW only', () => {
      expect(TRANSITION_MAP[OnboardingStatus.DRAFT]).toEqual([
        OnboardingStatus.READY_FOR_REVIEW,
      ]);
    });

    it('READY_FOR_REVIEW can transition to APPROVED, REJECTED, or REQUEST_CHANGES', () => {
      const allowed = TRANSITION_MAP[OnboardingStatus.READY_FOR_REVIEW];
      expect(allowed).toContain(OnboardingStatus.APPROVED);
      expect(allowed).toContain(OnboardingStatus.REJECTED);
      expect(allowed).toContain(OnboardingStatus.REQUEST_CHANGES);
      expect(allowed).toHaveLength(3);
    });

    it('REQUEST_CHANGES can transition to READY_FOR_REVIEW only', () => {
      expect(TRANSITION_MAP[OnboardingStatus.REQUEST_CHANGES]).toEqual([
        OnboardingStatus.READY_FOR_REVIEW,
      ]);
    });

    it('APPROVED is a terminal state with no allowed transitions', () => {
      expect(TRANSITION_MAP[OnboardingStatus.APPROVED]).toEqual([]);
    });

    it('REJECTED is a terminal state with no allowed transitions', () => {
      expect(TRANSITION_MAP[OnboardingStatus.REJECTED]).toEqual([]);
    });
  });

  describe('disallowed transitions', () => {
    it('DRAFT cannot transition to APPROVED', () => {
      expect(TRANSITION_MAP[OnboardingStatus.DRAFT]).not.toContain(
        OnboardingStatus.APPROVED,
      );
    });

    it('DRAFT cannot transition to REJECTED', () => {
      expect(TRANSITION_MAP[OnboardingStatus.DRAFT]).not.toContain(
        OnboardingStatus.REJECTED,
      );
    });

    it('DRAFT cannot transition to REQUEST_CHANGES', () => {
      expect(TRANSITION_MAP[OnboardingStatus.DRAFT]).not.toContain(
        OnboardingStatus.REQUEST_CHANGES,
      );
    });

    it('READY_FOR_REVIEW cannot transition to DRAFT', () => {
      expect(TRANSITION_MAP[OnboardingStatus.READY_FOR_REVIEW]).not.toContain(
        OnboardingStatus.DRAFT,
      );
    });

    it('REQUEST_CHANGES cannot transition to APPROVED', () => {
      expect(TRANSITION_MAP[OnboardingStatus.REQUEST_CHANGES]).not.toContain(
        OnboardingStatus.APPROVED,
      );
    });

    it('REQUEST_CHANGES cannot transition to REJECTED', () => {
      expect(TRANSITION_MAP[OnboardingStatus.REQUEST_CHANGES]).not.toContain(
        OnboardingStatus.REJECTED,
      );
    });

    it('APPROVED cannot transition to any state', () => {
      expect(TRANSITION_MAP[OnboardingStatus.APPROVED]).toHaveLength(0);
    });

    it('REJECTED cannot transition to any state', () => {
      expect(TRANSITION_MAP[OnboardingStatus.REJECTED]).toHaveLength(0);
    });
  });

  describe('OnboardingStatus enum completeness', () => {
    it('TRANSITION_MAP covers all onboarding statuses', () => {
      const allStatuses = Object.values(OnboardingStatus);
      const mapKeys = Object.keys(TRANSITION_MAP);
      for (const status of allStatuses) {
        expect(mapKeys).toContain(status);
      }
    });

    it('all target transitions reference valid statuses', () => {
      const allStatuses = Object.values(OnboardingStatus);
      for (const targets of Object.values(TRANSITION_MAP)) {
        for (const target of targets) {
          expect(allStatuses).toContain(target);
        }
      }
    });
  });
});
