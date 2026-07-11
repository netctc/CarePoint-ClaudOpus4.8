import { describe, it, expect } from 'vitest';
import {
  computeCredentialVerificationStatus,
  CredentialStatusInput,
} from './credential-status';

describe('computeCredentialVerificationStatus', () => {
  // Fixed reference date for deterministic tests
  const now = new Date('2024-06-15T12:00:00.000Z');

  describe('EXPIRED status', () => {
    it('returns EXPIRED when expiresAt is in the past (verified credential)', () => {
      const credential: CredentialStatusInput = {
        status: 'VERIFIED',
        expiresAt: new Date('2024-06-14T00:00:00.000Z'), // yesterday
      };
      expect(computeCredentialVerificationStatus(credential, now)).toBe('EXPIRED');
    });

    it('returns EXPIRED when expiresAt is in the past (non-verified credential)', () => {
      const credential: CredentialStatusInput = {
        status: 'UPLOADED',
        expiresAt: new Date('2024-01-01T00:00:00.000Z'), // months ago
      };
      expect(computeCredentialVerificationStatus(credential, now)).toBe('EXPIRED');
    });

    it('returns EXPIRED when expiresAt is exactly one millisecond before now', () => {
      const credential: CredentialStatusInput = {
        status: 'VERIFIED',
        expiresAt: new Date(now.getTime() - 1),
      };
      expect(computeCredentialVerificationStatus(credential, now)).toBe('EXPIRED');
    });

    it('returns EXPIRED for rejected credential with past expiresAt', () => {
      const credential: CredentialStatusInput = {
        status: 'REJECTED',
        expiresAt: new Date('2024-05-01T00:00:00.000Z'),
      };
      expect(computeCredentialVerificationStatus(credential, now)).toBe('EXPIRED');
    });
  });

  describe('EXPIRING_SOON status', () => {
    it('returns EXPIRING_SOON when verified and expiresAt is within 30 days', () => {
      const credential: CredentialStatusInput = {
        status: 'VERIFIED',
        expiresAt: new Date('2024-07-01T00:00:00.000Z'), // 16 days from now
      };
      expect(computeCredentialVerificationStatus(credential, now)).toBe('EXPIRING_SOON');
    });

    it('returns EXPIRING_SOON when verified and expiresAt is exactly 30 days from now', () => {
      const thirtyDaysFromNow = new Date(now.getTime());
      thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

      const credential: CredentialStatusInput = {
        status: 'VERIFIED',
        expiresAt: thirtyDaysFromNow,
      };
      expect(computeCredentialVerificationStatus(credential, now)).toBe('EXPIRING_SOON');
    });

    it('returns EXPIRING_SOON when verified and expiresAt is exactly now (boundary)', () => {
      const credential: CredentialStatusInput = {
        status: 'VERIFIED',
        expiresAt: new Date(now.getTime()), // exactly now — not past, within 30 days
      };
      expect(computeCredentialVerificationStatus(credential, now)).toBe('EXPIRING_SOON');
    });

    it('returns EXPIRING_SOON when verified and expiresAt is 1 day from now', () => {
      const tomorrow = new Date(now.getTime());
      tomorrow.setDate(tomorrow.getDate() + 1);

      const credential: CredentialStatusInput = {
        status: 'VERIFIED',
        expiresAt: tomorrow,
      };
      expect(computeCredentialVerificationStatus(credential, now)).toBe('EXPIRING_SOON');
    });
  });

  describe('VALID status', () => {
    it('returns VALID when verified and expiresAt is more than 30 days in the future', () => {
      const credential: CredentialStatusInput = {
        status: 'VERIFIED',
        expiresAt: new Date('2024-12-31T00:00:00.000Z'), // ~6 months from now
      };
      expect(computeCredentialVerificationStatus(credential, now)).toBe('VALID');
    });

    it('returns VALID when verified and expiresAt is 31 days from now', () => {
      const thirtyOneDays = new Date(now.getTime());
      thirtyOneDays.setDate(thirtyOneDays.getDate() + 31);

      const credential: CredentialStatusInput = {
        status: 'VERIFIED',
        expiresAt: thirtyOneDays,
      };
      expect(computeCredentialVerificationStatus(credential, now)).toBe('VALID');
    });

    it('returns VALID when verified with no expiresAt (no expiration)', () => {
      const credential: CredentialStatusInput = {
        status: 'VERIFIED',
        expiresAt: null,
      };
      expect(computeCredentialVerificationStatus(credential, now)).toBe('VALID');
    });

    it('returns VALID when verified with undefined expiresAt', () => {
      const credential: CredentialStatusInput = {
        status: 'VERIFIED',
        expiresAt: undefined,
      };
      expect(computeCredentialVerificationStatus(credential, now)).toBe('VALID');
    });
  });

  describe('null result (status not applicable)', () => {
    it('returns null for UPLOADED credential with future expiresAt', () => {
      const credential: CredentialStatusInput = {
        status: 'UPLOADED',
        expiresAt: new Date('2025-01-01T00:00:00.000Z'),
      };
      expect(computeCredentialVerificationStatus(credential, now)).toBeNull();
    });

    it('returns null for MISSING credential with no expiresAt', () => {
      const credential: CredentialStatusInput = {
        status: 'MISSING',
        expiresAt: null,
      };
      expect(computeCredentialVerificationStatus(credential, now)).toBeNull();
    });

    it('returns null for REJECTED credential with future expiresAt', () => {
      const credential: CredentialStatusInput = {
        status: 'REJECTED',
        expiresAt: new Date('2025-06-01T00:00:00.000Z'),
      };
      expect(computeCredentialVerificationStatus(credential, now)).toBeNull();
    });
  });

  describe('string date handling', () => {
    it('accepts ISO string for expiresAt', () => {
      const credential: CredentialStatusInput = {
        status: 'VERIFIED',
        expiresAt: '2024-12-31T00:00:00.000Z',
      };
      expect(computeCredentialVerificationStatus(credential, now)).toBe('VALID');
    });

    it('handles expired ISO string dates', () => {
      const credential: CredentialStatusInput = {
        status: 'VERIFIED',
        expiresAt: '2024-01-01T00:00:00.000Z',
      };
      expect(computeCredentialVerificationStatus(credential, now)).toBe('EXPIRED');
    });
  });

  describe('boundary: exactly 30 days + 1 ms from now', () => {
    it('returns VALID when expiresAt is one millisecond past the 30-day threshold', () => {
      const thirtyDays = new Date(now.getTime());
      thirtyDays.setDate(thirtyDays.getDate() + 30);
      const justPastThreshold = new Date(thirtyDays.getTime() + 1);

      const credential: CredentialStatusInput = {
        status: 'VERIFIED',
        expiresAt: justPastThreshold,
      };
      expect(computeCredentialVerificationStatus(credential, now)).toBe('VALID');
    });
  });
});
