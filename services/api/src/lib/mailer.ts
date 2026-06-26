// Transactional email (OTP verification codes).
//
// Two providers supported:
//   1. Resend HTTP API (preferred) — set RESEND_API_KEY.
//   2. SMTP via nodemailer (fallback, lazily loaded) — set SMTP_HOST/SMTP_USER/SMTP_PASS.
//
// If neither is configured, sending is a safe no-op (logs a warning).

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

export function isEmailConfigured(): boolean {
  return getResendApiKey() !== null || getSmtpConfig() !== null;
}

type SendResult = { sent: true; provider: 'resend' | 'smtp'; id?: string } | { sent: false; reason: 'not_configured' | 'send_failed' };

async function sendViaResend(opts: { to: string; subject: string; text: string; html?: string }): Promise<SendResult> {
  const apiKey = getResendApiKey();
  if (!apiKey) return { sent: false, reason: 'not_configured' };
  const from = getFromAddress();
  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: [opts.to], subject: opts.subject, text: opts.text, html: opts.html }),
    });
    const bodyText = await res.text().catch(() => '');
    if (!res.ok) {
      console.error(`[mailer] Resend API error ${res.status} to ${opts.to}: ${bodyText.slice(0, 300)}`);
      return { sent: false, reason: 'send_failed' };
    }
    let id: string | undefined;
    try { id = (JSON.parse(bodyText) as { id?: string }).id; } catch { /* ignore */ }
    console.log(`[mailer] Resend accepted email to ${opts.to} id=${id ?? 'n/a'}`);
    return { sent: true, provider: 'resend', id };
  } catch (error) {
    console.error(`[mailer] Resend failed for ${opts.to}:`, error instanceof Error ? error.message : error);
    return { sent: false, reason: 'send_failed' };
  }
}

let smtpTransporter: unknown = null;
let smtpInitTried = false;

async function getSmtpTransporter(): Promise<any | null> {
  if (smtpInitTried) return smtpTransporter as any;
  smtpInitTried = true;
  const config = getSmtpConfig();
  if (!config) { smtpTransporter = null; return null; }
  try {
    const nodemailer = (await import('nodemailer')).default;
    smtpTransporter = nodemailer.createTransport({
      host: config.host, port: config.port, secure: config.port === 465,
      auth: { user: config.user, pass: config.pass },
      tls: { rejectUnauthorized: false },
    });
    return smtpTransporter as any;
  } catch (error) {
    console.error('[mailer] nodemailer not available:', error instanceof Error ? error.message : error);
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
    console.log(`[mailer] SMTP accepted email to ${opts.to} id=${info?.messageId ?? 'n/a'}`);
    return { sent: true, provider: 'smtp', id: info?.messageId };
  } catch (error) {
    console.error(`[mailer] SMTP failed for ${opts.to}:`, error instanceof Error ? error.message : error);
    return { sent: false, reason: 'send_failed' };
  }
}

export async function sendEmail(opts: { to: string; subject: string; text: string; html?: string }): Promise<SendResult> {
  if (getResendApiKey()) return sendViaResend(opts);
  if (getSmtpConfig()) return sendViaSmtp(opts);
  console.warn(`[mailer] No email provider configured; skipping email to ${opts.to}`);
  return { sent: false, reason: 'not_configured' };
}

export async function sendOtpEmail(params: { to: string; code: string; expiresInSeconds: number; purpose?: string }): Promise<SendResult> {
  const minutes = Math.max(1, Math.round((params.expiresInSeconds || 300) / 60));
  const purpose = params.purpose ?? 'sign-in';
  const subject = `CarePoint verification code: ${params.code}`;
  const text = `Your CarePoint ${purpose} verification code is ${params.code}.\nIt expires in ${minutes} minute(s).\n\nIf you did not request this code, you can safely ignore this email.`;
  const html = `<div style="font-family:Arial,sans-serif;font-size:15px;color:#1a1a1a"><p>Your CarePoint <strong>${purpose}</strong> verification code is:</p><p style="font-size:28px;font-weight:700;letter-spacing:4px;margin:16px 0">${params.code}</p><p>It expires in ${minutes} minute(s).</p><p style="color:#666">If you did not request this code, you can safely ignore this email.</p></div>`;
  return sendEmail({ to: params.to, subject, text, html });
}
