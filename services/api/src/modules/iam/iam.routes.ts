import { Router } from 'express';
import { invitationRouter } from './invitation.routes';
import { accessReviewRouter } from './access-review.routes';
import { scheduleRouter } from './schedule.routes';
import { availabilityRouter } from './availability.routes';

// ---------------------------------------------------------------------------
// IAM Module Router — aggregates all IAM sub-routes under /api/iam
// ---------------------------------------------------------------------------

export const iamRouter = Router();

// Invitations: /api/iam/invitations
iamRouter.use('/invitations', invitationRouter);

// Access Review: /api/iam/access-review
iamRouter.use('/access-review', accessReviewRouter);

// Schedules: /api/iam/schedules
iamRouter.use('/schedules', scheduleRouter);

// Availability: /api/iam/availability
iamRouter.use('/availability', availabilityRouter);
