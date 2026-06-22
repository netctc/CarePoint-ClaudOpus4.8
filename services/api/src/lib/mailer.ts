import nodemailer, { type Transporter } from 'nodemailer';

// SMTP mailer for transactional email (OTP verification codes).
// Configured entirely from environment variables so credentials are never
// committed. With Brevo: SMTP_HOST=smtp-relay.brevo.com, SMTP_PORT=587,
// SMTP_USER=<your brevo SMTP login>, SMTP_PASS=<your brevo SMTP key>,
// SMTP_FROM="CarePoint <verified-sender@your-domain>".

let transporter: Transporter | null = null;
let resolved = false;

function getTransporter(): Transporter | null {
  if (resolved) return transporter;
  resolved = true;

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
    // Port 465 is implicit TLS; 587 (Brevo) uses STARTTLS, so secure=false.
    secure: securePort === 465,
    auth: { user, pass },
  });
  return transporter;
}

export function isEmailConfigured(): boolean {
  return getTransporter() !== null;
}

type SendResult = { sent: true } | { sent: false; reason: 'smtp_not_configured' | 'send_failed' };

export async function sendEmail(opts: { to: string; subject: string; text: string; html?: string }): Promise<SendResult> {
  const tx = getTransporter();
  if (!tx) {
    console.warn(`[mailer] SMTP not configured (SMTP_HOST/SMTP_USER/SMTP_PASS); skipping email to ${opts.to}`);
    return { sent: false, reason: 'smtp_not_configured' };
  }

  const from = process.env.SMTP_FROM?.trim() || process.env.SMTP_USER?.trim() || 'no-reply@carepoint.local';
  try {
    await tx.sendMail({ from, to: opts.to, subject: opts.subject, text: opts.text, html: opts.html });
    return { sent: true };
  } catch (error) {
    console.error(`[mailer] Failed to send email to ${opts.to}:`, error instanceof Error ? error.message : error);
    return { sent: false, reason: 'send_failed' };
  }
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
