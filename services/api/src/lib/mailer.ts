// Transactional email (OTP verification codes).
//
// Two providers are supported, selected by environment variables:
//   1. Resend HTTP API (preferred) — set RESEND_API_KEY. Uses https and avoids
//      SMTP ports being blocked by the host/network. The sender defaults to
//      Resend's shared testing address "onboarding@resend.dev" (which can only
//      deliver to your own account email until you verify a domain).
//   2. SMTP via nodemailer (fallback) — set SMTP_HOST/SMTP_USER/SMTP_PASS.
//      nodemailer is imported lazily so the Resend path never depends on it
//      being installed.
//
// All credentials come from env vars so nothing is committed. If neither
// provider is configured, sending is a safe no-op (logs a warning).

const RESEND_ENDPOINT = 'https://api.resend.com/emails';

function getResendApiKey(): string | null {
  const key = process.env.RESEND_API_KEY?.trim();
  return key ? key : null;
}

function getSmtpConfig(): { host: string; port: number; user: string; pass: string } | null {
  const host = process.env.SMTP_HOST?.trim();
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS?.trim();
  if (!host || !user || !pass) return null;
  const parsedPort = Number.parseInt(process.env.SMTP_PORT ?? '587', 10);
  return { host, user, pass, port: Number.isFinite(parsedPort) ? parsedPort : 587 };
}

function getFromAddress(): string {
  return (
    process.env.EMAIL_FROM?.trim() ||
    process.env.RESEND_FROM?.trim() ||
    process.env.SMTP_FROM?.trim() ||
    'CarePoint <onboarding@resend.dev>'
  );
}

export type EmailProviderStatus = {
  provider: 'resend' | 'smtp' | 'none';
  from: string;
  resendConfigured: boolean;
  smtpConfigured: boolean;
  smtpHost?: string;
};

export function getEmailProviderStatus(): EmailProviderStatus {
  const resendConfigured = getResendApiKey() !== null;
  const smtp = getSmtpConfig();
  return {
    provider: resendConfigured ? 'resend' : smtp ? 'smtp' : 'none',
    from: getFromAddress(),
    resendConfigured,
    smtpConfigured: smtp !== null,
    smtpHost: smtp?.host,
  };
}

export function isEmailConfigured(): boolean {
  return getResendApiKey() !== null || getSmtpConfig() !== null;
}

type SendResult = { sent: true; provider: 'resend' | 'smtp'; id?: string } | { sent: false; reason: 'not_configured' | 'send_failed' };

// --- Resend HTTP API (preferred) --------------------------------------------

async function sendViaResend(opts: { to: string; subject: string; text: string; html?: string }): Promise<SendResult> {
  const apiKey = getResendApiKey();
  if (!apiKey) return { sent: false, reason: 'not_configured' };

  const from = getFromAddress();
  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [opts.to],
        subject: opts.subject,
        text: opts.text,
        html: opts.html,
      }),
    });

    const bodyText = await res.text().catch(() => '');
    if (!res.ok) {
      console.error(
        `[mailer] Resend API rejected email to ${opts.to} (from="${from}") — HTTP ${res.status}: ${bodyText.slice(0, 500)}`,
      );
      return { sent: false, reason: 'send_failed' };
    }
    let id: string | undefined;
    try {
      id = (JSON.parse(bodyText) as { id?: string }).id;
    } catch {
      /* ignore parse issues */
    }
    console.log(`[mailer] Resend accepted email to ${opts.to} (from="${from}") id=${id ?? 'n/a'}`);
    return { sent: true, provider: 'resend', id };
  } catch (error) {
    console.error(
      `[mailer] Resend request failed for ${opts.to} (network/DNS?):`,
      error instanceof Error ? error.message : error,
    );
    return { sent: false, reason: 'send_failed' };
  }
}

// --- SMTP via nodemailer (fallback, lazily loaded) ---------------------------

let smtpTransporter: unknown = null;
let smtpInitTried = false;

async function getSmtpTransporter(): Promise<any | null> {
  if (smtpInitTried) return smtpTransporter as any;
  smtpInitTried = true;

  const config = getSmtpConfig();
  if (!config) {
    smtpTransporter = null;
    return null;
  }

  try {
    // Lazy import: the Resend path never requires nodemailer to be installed.
    const nodemailer = (await import('nodemailer')).default;
    smtpTransporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      // Port 465 is implicit TLS; 587 uses STARTTLS, so secure=false.
      secure: config.port === 465,
      auth: { user: config.user, pass: config.pass },
    });
    return smtpTransporter as any;
  } catch (error) {
    console.error(
      '[mailer] SMTP requested but nodemailer is not available (run npm install). ' +
        'Prefer Resend by setting RESEND_API_KEY. Error:',
      error instanceof Error ? error.message : error,
    );
    smtpTransporter = null;
    return null;
  }
}

async function sendViaSmtp(opts: { to: string; subject: string; text: string; html?: string }): Promise<SendResult> {
  const tx = await getSmtpTransporter();
  if (!tx) return { sent: false, reason: 'not_configured' };

  const from = getFromAddress();
  try {
    const info = await tx.sendMail({ from, to: opts.to, subject: opts.subject, text: opts.text, html: opts.html });
    console.log(`[mailer] SMTP accepted email to ${opts.to} (from="${from}") id=${info?.messageId ?? 'n/a'}`);
    return { sent: true, provider: 'smtp', id: info?.messageId };
  } catch (error) {
    console.error(`[mailer] SMTP send failed for ${opts.to} (from="${from}"):`, error instanceof Error ? error.message : error);
    return { sent: false, reason: 'send_failed' };
  }
}

// --- Public API --------------------------------------------------------------

export async function sendEmail(opts: { to: string; subject: string; text: string; html?: string }): Promise<SendResult> {
  // Prefer Resend HTTP API; fall back to SMTP if configured.
  if (getResendApiKey()) {
    return sendViaResend(opts);
  }
  if (getSmtpConfig()) {
    return sendViaSmtp(opts);
  }
  console.warn(`[mailer] No email provider configured (set RESEND_API_KEY or SMTP_*); skipping email to ${opts.to}`);
  return { sent: false, reason: 'not_configured' };
}

export async function sendOtpEmail(params: {
  to: string;
  code: string;
  expiresInSeconds: number;
  purpose?: string;
}): Promise<SendResult> {
  const minutes = Math.max(1, Math.round((params.expiresInSeconds || 300) / 60));
  const purpose = params.purpose ?? 'sign-in';
  const subject = `CarePoint verification code: ${params.code}`;
  const text =
    `Your CarePoint ${purpose} verification code is ${params.code}.\n` +
    `It expires in ${minutes} minute(s).\n\n` +
    `If you did not request this code, you can safely ignore this email.`;
  const html =
    `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#1a1a1a">` +
    `<p>Your CarePoint <strong>${purpose}</strong> verification code is:</p>` +
    `<p style="font-size:28px;font-weight:700;letter-spacing:4px;margin:16px 0">${params.code}</p>` +
    `<p>It expires in ${minutes} minute(s).</p>` +
    `<p style="color:#666">If you did not request this code, you can safely ignore this email.</p>` +
    `</div>`;
  return sendEmail({ to: params.to, subject, text, html });
}
