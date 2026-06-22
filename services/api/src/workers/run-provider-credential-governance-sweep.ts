import 'dotenv/config';
import { runProviderCredentialGovernanceSweep } from '../lib/provider-credential-governance-sweeper';

function booleanFlag(name: string, fallback = false) {
  const value = process.env[name];
  if (value === undefined) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
}

function numberFlag(name: string, fallback: number) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) ? value : fallback;
}

async function main() {
  const result = await runProviderCredentialGovernanceSweep({
    organizationId: process.env.CREDENTIAL_SWEEP_ORGANIZATION_ID || null,
    dryRun: booleanFlag('CREDENTIAL_SWEEP_DRY_RUN', false),
    markExpired: !booleanFlag('CREDENTIAL_SWEEP_SKIP_MARK_EXPIRED', false),
    createReviewTasks: !booleanFlag('CREDENTIAL_SWEEP_SKIP_TASKS', false),
    queueReminders: !booleanFlag('CREDENTIAL_SWEEP_SKIP_REMINDERS', false),
    expiringSoonDays: numberFlag('CREDENTIAL_SWEEP_EXPIRING_SOON_DAYS', 30),
    dueInDays: numberFlag('CREDENTIAL_SWEEP_DUE_IN_DAYS', 7),
    limit: numberFlag('CREDENTIAL_SWEEP_LIMIT', 250),
  });
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
