/**
 * Email delivery doctor.
 *
 * Tests the email provider (Resend or SMTP) in isolation from the OTP flow, so
 * you can tell whether a missing OTP email is a provider/config problem or a
 * problem in the sign-in flow (e.g. the email is not a PATIENT in the DB, or a
 * portal requested channel=totp instead of email).
 *
 * Usage (from repo root):
 *   npm run email:doctor -- you@example.com
 *   npm run email:doctor                 # only prints config, does not send
 */
import path from 'node:path';
import fs from 'node:fs';
import dotenv from 'dotenv';
import { getEmailProviderStatus, sendOtpEmail } from '../src/lib/mailer';

function loadEnv(): string[] {
  // scripts/ -> services/api ; repo root is two levels up.
  const serviceDir = path.resolve(__dirname, '..');
  const repoRoot = path.resolve(serviceDir, '../..');
  const candidates = [
    path.join(repoRoot, '.env'),
    path.join(repoRoot, '.env.local'),
    path.join(serviceDir, '.env'),
    path.join(serviceDir, '.env.local'),
  ];
  const loaded: string[] = [];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      dotenv.config({ path: candidate, override: true });
      loaded.push(path.relative(repoRoot, candidate));
    }
  }
  return loaded;
}

async function main(): Promise<void> {
  const loaded = loadEnv();
  const to = process.argv[2];

  console.log('=== CarePoint email doctor ===');
  console.log('NODE_ENV          :', process.env.NODE_ENV ?? '(unset, dev)');
  console.log('.env files loaded :', loaded.length ? loaded.join(', ') : '(none found)');

  const status = getEmailProviderStatus();
  console.log('Selected provider :', status.provider);
  console.log('EMAIL_FROM        :', status.from);
  console.log('Resend configured :', status.resendConfigured);
  console.log('SMTP configured   :', status.smtpConfigured, status.smtpHost ? `(host=${status.smtpHost})` : '');

  if (status.provider === 'none') {
    console.error(
      '\n[FAIL] No email provider configured. Set RESEND_API_KEY (preferred) or SMTP_HOST/SMTP_USER/SMTP_PASS in your .env.',
    );
    process.exit(2);
  }

  if (!to) {
    console.log('\nNo recipient given. Config looks reachable. To actually send a test message:');
    console.log('  npm run email:doctor -- you@example.com');
    process.exit(0);
  }

  console.log(`\nSending a test verification code to ${to} ...`);
  const result = await sendOtpEmail({ to, code: '123456', expiresInSeconds: 300, purpose: 'email delivery test' });
  console.log('Send result       :', JSON.stringify(result));

  if (result.sent) {
    console.log(
      '\n[OK] The provider ACCEPTED the message.' +
        '\n - If it still does not arrive: check spam, and the provider dashboard delivery logs.' +
        '\n - Resend test sender onboarding@resend.dev only delivers to your own Resend account email' +
        '\n   until you verify a domain and set EMAIL_FROM to an address on that domain.',
    );
    process.exit(0);
  }

  console.error('\n[FAIL] Send failed. The [mailer] line above shows the exact provider response (HTTP status / message).');
  process.exit(1);
}

main().catch((error) => {
  console.error('email-doctor crashed:', error);
  process.exit(1);
});
