import nodemailer, { type Transporter } from 'nodemailer';

// Transactional email (OTP verification codes).
//
// Two providers are supported, selected by environment variables:
//   1. Resend HTTP API (preferred) — set RESEND_API_KEY. Uses https and avoids
//      SMTP ports being blocked by the host/network. The sender defaults to
//      Resend's shared testing address "onboarding@resend.dev" (which can only
//      deliver to your own account email until you verify a domain).
//   2. SMTP via nodemailer (fallback) — set SMTP_HOST/SMTP_USER/SMTP_PASS.
//
// All credentials come from env vars so nothing is committed. If neither
// provider is configured, sending is a safe no-op (logs a warning).

const RESEND_ENDPOINT = 'https://api.resend.com/emails';

function getResendApiKey(): string | null {
  const key = process.env.RESEND_API_KEY?.trim();
  return key ? key : null;
}

function getFromAddress(): string {
  return (
    process.env.EMAIL_FROM?.trim() ||
    process.env.RESEND_FROM?.trim() ||
    process.env.SMTP_FROM?.trim() ||
    'CarePoint <onboarding@resend.dev>'
  );
}

// --- SMTP (fallback) ---------------------------------------------------------

let transporter: Transporter | null = null;
let smtpResolved = false;

function getTransporter(): Transporter | null {
  if (smtpResolved) return transporter;
  smtpResolved = true;

  const host = process.env.SMTP_HOST?.trim();
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS?.trim();
  const port = Number.parseInt(process.env.SMTP_PORT ?? '587', 10);

  if (!host || !user || !pass) {
    transporter = null;
    return null;
  }

  const securePort = Number.isFinite(port) ? port : 587;
  transporter = nodemailer.createTransport({
    host,
    port: securePort,
    // Port 465 is implicit TLS; 587 uses STARTTLS, so secure=false.
    secure: securePort === 465,
    auth: { user, pass },
  });
  return transporter;
}

export function isEmailConfigured(): boolean {
  return getResendApiKey() !== null || getTransporter() !== null;
}

type SendResult = { sent: true } | { sent: false; reason: 'not_configured' | 'send_failed' };

async function sendViaResend(opts: { to: string; subject: string; text: string; html?: string }): Promise<SendResult> {
  const apiKey = getResendApiKey();
  if (!apiKey) return { sent: false, reason: 'not_configured' };

  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: getFromAddress(),
        to: [opts.to],
        subject: opts.subject,
        text: opts.text,
        html: opts.html,
      }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      console.error(`[mailer] Resend API error ${res.status} sending to ${opts.to}: ${detail.slice(0, 300)}`);
      return { sent: false, reason: 'send_failed' };
    }
    return { sent: true };
  } catch (error) {
    console.error(`[mailer] Resend request failed for ${opts.to}:`, error instanceof Error ? error.message : error);
    return { sent: false, reason: 'send_failed' };
  }
}

async function sendViaSmtp(opts: { to: string; subject: string; text: string; html?: string }): Promise<SendResult> {
  const tx = getTransporter();
  if (!tx) return { sent: false, reason: 'not_configured' };

  try {
    await tx.sendMail({ from: getFromAddress(), to: opts.to, subject: opts.subject, text: opts.text, html: opts.html });
    return { sent: true };
  } catch (error) {
    console.error(`[mailer] SMTP send failed for ${opts.to}:`, error instanceof Error ? error.message : error);
    return { sent: false, reason: 'send_failed' };
  }
}

export async function sendEmail(opts: { to: string; subject: string; text: string; html?: string }): Promise<SendResult> {
  // Prefer Resend HTTP API; fall back to SMTP if configured.
  if (getResendApiKey()) {
    return sendViaResend(opts);
  }
  if (getTransporter()) {
    return sendViaSmtp(opts);
  }
  console.warn(`[mailer] No email provider configured (RESEND_API_KEY or SMTP_*); skipping email to ${opts.to}`);
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
