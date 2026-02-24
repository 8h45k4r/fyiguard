/**
 * FYI Guard - Email Service
 *
 * Handles all transactional emails:
 * - Welcome / email verification on signup
 * - Password reset
 * - Admin notifications (new signup, alerts)
 *
 * Uses Nodemailer with SMTP (configurable via env vars).
 * Falls back gracefully when SMTP is not configured.
 */
import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

// ---------------------------------------------------------------------------
// Config helpers
// ---------------------------------------------------------------------------
const env = (key: string, fallback = ''): string =>
  process.env[key] ?? fallback;

const SMTP_HOST = env('SMTP_HOST', 'smtp.gmail.com');
const SMTP_PORT = parseInt(env('SMTP_PORT', '587'), 10);
const SMTP_USER = env('SMTP_USER');
const SMTP_PASS = env('SMTP_PASS');
const FROM_EMAIL = env('SMTP_FROM_EMAIL', 'noreply@fyiguard.io');
const FROM_NAME = env('SMTP_FROM_NAME', 'FYI Guard');
const APP_URL = env('APP_URL', 'http://localhost:3001');
const ADMIN_EMAIL = env('ADMIN_NOTIFICATION_EMAIL');

// ---------------------------------------------------------------------------
// Transporter singleton (lazy)
// ---------------------------------------------------------------------------
let _transporter: Transporter | null = null;

function getTransporter(): Transporter | null {
  if (!SMTP_USER || !SMTP_PASS) {
    console.warn('[FYI Guard] SMTP not configured - emails will be logged only');
    return null;
  }
  if (!_transporter) {
    _transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_PORT === 465,
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    });
  }
  return _transporter;
}

// ---------------------------------------------------------------------------
// Low-level send
// ---------------------------------------------------------------------------
async function send(
  to: string,
  subject: string,
  html: string,
): Promise<boolean> {
  const t = getTransporter();
  if (!t) {
    console.log(`[FYI Guard][email-dry] To: ${to} | Subject: ${subject}`);
    return false;
  }
  try {
    await t.sendMail({
      from: `"${FROM_NAME}" <${FROM_EMAIL}>`,
      to,
      subject,
      html,
    });
    console.log(`[FYI Guard] Email sent to ${to}: ${subject}`);
    return true;
  } catch (err) {
    console.error('[FYI Guard] Email send failed:', err);
    return false;
  }
}

// ---------------------------------------------------------------------------
// HTML helpers
// ---------------------------------------------------------------------------
const BRAND_COLOR = '#368F4D';

function wrap(title: string, body: string): string {
  return `
  <div style="font-family:'Outfit','Segoe UI',sans-serif;max-width:600px;margin:0 auto;background:#fff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden">
    <div style="background:${BRAND_COLOR};padding:24px 32px">
      <h1 style="margin:0;color:#fff;font-size:22px">FYI Guard</h1>
    </div>
    <div style="padding:32px">
      <h2 style="margin:0 0 16px;color:#1a1a2e;font-size:20px">${title}</h2>
      ${body}
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:32px 0 16px">
      <p style="color:#9ca3af;font-size:12px;margin:0">FYI Guard - AI Prompt Guardian &bull; <a href="https://fyiguard.io" style="color:${BRAND_COLOR}">fyiguard.io</a></p>
    </div>
  </div>`;
}

function btn(label: string, url: string): string {
  return `<a href="${url}" style="display:inline-block;background:${BRAND_COLOR};color:#fff;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;margin:16px 0">${label}</a>`;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Send welcome + email-verification link */
export async function sendVerificationEmail(
  to: string,
  token: string,
  name?: string,
): Promise<boolean> {
  const verifyUrl = `${APP_URL}/api/v1/auth/verify-email?token=${token}`;
  const greeting = name ? `Hi ${name},` : 'Hi there,';
  const html = wrap('Verify Your Email', `
    <p style="color:#374151;line-height:1.6">${greeting}</p>
    <p style="color:#374151;line-height:1.6">Welcome to <strong>FYI Guard</strong>! Please verify your email address to activate your account and start protecting your AI prompts.</p>
    <div style="text-align:center">${btn('Verify Email Address', verifyUrl)}</div>
    <p style="color:#6b7280;font-size:13px">Or copy this link: <a href="${verifyUrl}" style="color:${BRAND_COLOR};word-break:break-all">${verifyUrl}</a></p>
    <p style="color:#6b7280;font-size:13px">This link expires in 24 hours. If you did not create an account, please ignore this email.</p>
  `);
  return send(to, 'Verify your FYI Guard account', html);
}

/** Send password-reset link */
export async function sendPasswordResetEmail(
  to: string,
  token: string,
): Promise<boolean> {
  const resetUrl = `${APP_URL}/api/v1/auth/reset-password?token=${token}`;
  const html = wrap('Reset Your Password', `
    <p style="color:#374151;line-height:1.6">We received a request to reset your FYI Guard password.</p>
    <div style="text-align:center">${btn('Reset Password', resetUrl)}</div>
    <p style="color:#6b7280;font-size:13px">Or copy this link: <a href="${resetUrl}" style="color:${BRAND_COLOR};word-break:break-all">${resetUrl}</a></p>
    <p style="color:#6b7280;font-size:13px">This link expires in 1 hour. If you did not request a password reset, please ignore this email.</p>
  `);
  return send(to, 'Reset your FYI Guard password', html);
}

/** Notify admin about a new user signup */
export async function sendAdminNewSignupNotification(
  userEmail: string,
  userName?: string,
): Promise<boolean> {
  if (!ADMIN_EMAIL) return false;
  const html = wrap('New User Signup', `
    <p style="color:#374151;line-height:1.6">A new user has registered on FYI Guard:</p>
    <table style="border-collapse:collapse;width:100%;margin:16px 0">
      <tr><td style="padding:8px 12px;border:1px solid #e5e7eb;font-weight:600;background:#f9fafb">Email</td><td style="padding:8px 12px;border:1px solid #e5e7eb">${userEmail}</td></tr>
      <tr><td style="padding:8px 12px;border:1px solid #e5e7eb;font-weight:600;background:#f9fafb">Name</td><td style="padding:8px 12px;border:1px solid #e5e7eb">${userName || 'Not provided'}</td></tr>
      <tr><td style="padding:8px 12px;border:1px solid #e5e7eb;font-weight:600;background:#f9fafb">Time</td><td style="padding:8px 12px;border:1px solid #e5e7eb">${new Date().toISOString()}</td></tr>
    </table>
    <p style="color:#6b7280;font-size:13px">User must verify their email before they can log in.</p>
  `);
  return send(ADMIN_EMAIL, `[FYI Guard] New signup: ${userEmail}`, html);
}

/** Notify admin about a security alert */
export async function sendAdminAlertNotification(
  userEmail: string,
  alertType: string,
  description: string,
  severity: string,
): Promise<boolean> {
  if (!ADMIN_EMAIL) return false;
  const severityColors: Record<string, string> = {
    INFO: '#3B82F6', WARNING: '#F59E0B', CRITICAL: '#EF4444', EMERGENCY: '#991B1B',
  };
  const color = severityColors[severity] || '#6B7280';
  const html = wrap(`Security Alert: ${severity}`, `
    <div style="background:${color};color:#fff;padding:8px 16px;border-radius:6px;display:inline-block;font-weight:600;margin-bottom:16px">${severity}</div>
    <p style="color:#374151;line-height:1.6"><strong>Type:</strong> ${alertType}</p>
    <p style="color:#374151;line-height:1.6"><strong>User:</strong> ${userEmail}</p>
    <p style="color:#374151;line-height:1.6"><strong>Description:</strong> ${description}</p>
  `);
  return send(ADMIN_EMAIL, `[FYI Guard ${severity}] ${alertType}`, html);
}