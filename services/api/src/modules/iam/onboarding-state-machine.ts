import { prisma } from '../../lib/prisma';
import { badRequest, notFound } from '../../lib/http';

/**
 * Onboarding State Machine
 *
 * Enforces allowed transitions for provider onboarding status:
 *   DRAFT → READY_FOR_REVIEW
 *   READY_FOR_REVIEW → APPROVED | REJECTED | REQUEST_CHANGES
 *   REQUEST_CHANGES → READY_FOR_REVIEW
 *
 * Records decision note, reviewing actor, and timestamp on each transition.
 *
 * Requirements: 3.5, 3.8
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export const OnboardingStatus = {
  DRAFT: 'DRAFT',
  READY_FOR_REVIEW: 'READY_FOR_REVIEW',
  REQUEST_CHANGES: 'REQUEST_CHANGES',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
} as const;

export type OnboardingStatus = (typeof OnboardingStatus)[keyof typeof OnboardingStatus];

export interface TransitionInput {
  note?: string;
  actorId: string;
}

export interface OnboardingStateResult {
  id: string;
  providerId: string;
  organizationId: string;
  status: OnboardingStatus;
  decisionNote: string | null;
  lastActorId: string | null;
  submittedAt: Date | null;
  reviewedAt: Date | null;
  updatedAt: Date;
}

// ---------------------------------------------------------------------------
// Transition Map
// ---------------------------------------------------------------------------

/**
 * Defines the allowed outgoing transitions from each onboarding status.
 * Any transition not listed here is considered invalid.
 */
export const TRANSITION_MAP: Record<OnboardingStatus, OnboardingStatus[]> = {
  [OnboardingStatus.DRAFT]: [OnboardingStatus.READY_FOR_REVIEW],
  [OnboardingStatus.READY_FOR_REVIEW]: [
    OnboardingStatus.APPROVED,
    OnboardingStatus.REJECTED,
    OnboardingStatus.REQUEST_CHANGES,
  ],
  [OnboardingStatus.REQUEST_CHANGES]: [OnboardingStatus.READY_FOR_REVIEW],
  [OnboardingStatus.APPROVED]: [],
  [OnboardingStatus.REJECTED]: [],
};

// ---------------------------------------------------------------------------
// Core function
// ---------------------------------------------------------------------------

/**
 * Transitions a provider's onboarding status, enforcing the state machine rules.
 *
 * @param providerId - The ProviderProfile ID
 * @param newStatus - The target onboarding status
 * @param input - Decision note and actor ID
 * @returns The updated onboarding state record
 * @throws 404 if provider or onboarding state not found
 * @throws 400 if the transition is not allowed
 */
export async function transitionOnboardingStatus(
  providerId: string,
  newStatus: OnboardingStatus,
  input: TransitionInput,
): Promise<OnboardingStateResult> {
  // Validate newStatus is a known value
  const validStatuses = Object.values(OnboardingStatus);
  if (!validStatuses.includes(newStatus)) {
    throw badRequest(`Unknown onboarding status: ${newStatus}`);
  }

  // Fetch current onboarding state
  const currentState = await prisma.providerOnboardingState.findUnique({
    where: { providerId },
  });

  if (!currentState) {
    throw notFound('Provider onboarding state not found');
  }

  const currentStatus = currentState.status as OnboardingStatus;

  // Validate transition is allowed
  const allowedTransitions = TRANSITION_MAP[currentStatus];
  if (!allowedTransitions || !allowedTransitions.includes(newStatus)) {
    throw badRequest(
      `Invalid onboarding transition from ${currentStatus} to ${newStatus}`,
    );
  }

  // Determine timestamp fields based on transition
  const now = new Date();
  const isSubmission = newStatus === OnboardingStatus.READY_FOR_REVIEW;
  const isReviewDecision =
    newStatus === OnboardingStatus.APPROVED ||
    newStatus === OnboardingStatus.REJECTED ||
    newStatus === OnboardingStatus.REQUEST_CHANGES;

  // Update the onboarding state
  const updated = await prisma.providerOnboardingState.update({
    where: { providerId },
    data: {
      status: newStatus,
      decisionNote: input.note ?? null,
      lastActorId: input.actorId,
      lastAction: `admin.provider.onboarding_${newStatus.toLowerCase()}`,
      ...(isSubmission ? { submittedAt: now } : {}),
      ...(isReviewDecision ? { reviewedAt: now } : {}),
    },
  });

  return {
    id: updated.id,
    providerId: updated.providerId,
    organizationId: updated.organizationId,
    status: updated.status as OnboardingStatus,
    decisionNote: updated.decisionNote,
    lastActorId: updated.lastActorId,
    submittedAt: updated.submittedAt,
    reviewedAt: updated.reviewedAt,
    updatedAt: updated.updatedAt,
  };
}
