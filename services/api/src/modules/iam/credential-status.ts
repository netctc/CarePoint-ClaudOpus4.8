/**
 * Credential Verification Status Computation
 *
 * Computes a display-level verification status for a provider credential document
 * based on its verification state and expiration date.
 *
 * Rules (from Requirement 3.7):
 * - EXPIRED:        expiresAt date has passed (expiresAt < now)
 * - EXPIRING_SOON:  credential is verified AND expiresAt is within 30 days from now
 * - VALID:          credential is verified AND expiresAt is more than 30 days in the future
 *
 * The function is pure — it accepts a `now` parameter for deterministic testing.
 */

export type CredentialVerificationStatus = 'VALID' | 'EXPIRING_SOON' | 'EXPIRED';

export interface CredentialStatusInput {
  /** The document-level status from Prisma (e.g., VERIFIED, UPLOADED, REJECTED, etc.) */
  status: string;
  /** The credential expiration date, or null/undefined if no expiration is set */
  expiresAt: Date | string | null | undefined;
}

/** Number of days ahead to consider "expiring soon" */
const EXPIRING_SOON_THRESHOLD_DAYS = 30;

/**
 * Computes the credential verification status for display purposes.
 *
 * @param credential - The credential document with status and expiresAt fields
 * @param now - The current date (injected for testability)
 * @returns The computed verification status, or null if the credential is not in
 *          a state where a verification status applies (e.g., not yet verified and not expired)
 */
export function computeCredentialVerificationStatus(
  credential: CredentialStatusInput,
  now: Date = new Date(),
): CredentialVerificationStatus | null {
  const expiresAt = credential.expiresAt
    ? credential.expiresAt instanceof Date
      ? credential.expiresAt
      : new Date(credential.expiresAt)
    : null;

  // EXPIRED: expiresAt date has passed regardless of document status
  if (expiresAt && expiresAt < now) {
    return 'EXPIRED';
  }

  // Only VERIFIED credentials can be VALID or EXPIRING_SOON
  if (credential.status !== 'VERIFIED') {
    return null;
  }

  // If no expiresAt is set on a verified credential, treat as VALID (no expiration)
  if (!expiresAt) {
    return 'VALID';
  }

  // Calculate the threshold date (now + 30 days)
  const thresholdDate = new Date(now.getTime());
  thresholdDate.setDate(thresholdDate.getDate() + EXPIRING_SOON_THRESHOLD_DAYS);

  // EXPIRING_SOON: verified and expiresAt is within 30 days from now
  if (expiresAt <= thresholdDate) {
    return 'EXPIRING_SOON';
  }

  // VALID: verified and expiresAt is more than 30 days in the future
  return 'VALID';
}
