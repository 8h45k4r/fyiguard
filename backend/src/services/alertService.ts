/**
 * FYI Guard - Admin Alert Service
 *
 * Sends email notifications to org admins when:
 * - Critical data (credentials, PII, financial) is detected
 * - Users repeatedly attempt to send sensitive data
 * - High-risk prompts are blocked
 * - Policy override attempts occur
 *
 * Supports: SMTP, SendGrid, webhook integrations
 */
import { prisma } from '../lib/prisma';

export interface AlertPayload {
  userId: string;
  userEmail: string;
  orgId?: string;
  alertType: 'CRITICAL_DATA_LEAK' | 'REPEATED_VIOLATION' | 'NEW_PATTERN_DETECTED' | 'POLICY_OVERRIDE_ATTEMPT' | 'HIGH_RISK_PROMPT';
  severity: 'INFO' | 'WARNING' | 'CRITICAL' | 'EMERGENCY';
  category: string;
  description: string;
  matchedContent: string;
  platform: string;
  url?: string;
  action: string;
}

export interface EmailConfig {
  provider: 'smtp' | 'sendgrid' | 'webhook';
  smtpHost?: string;
  smtpPort?: number;
  smtpUser?: string;
  smtpPass?: string;
  sendgridApiKey?: string;
  webhookUrl?: string;
  fromEmail: string;
  fromName: string;
}

const getEmailConfig = (): EmailConfig => ({
  provider: (process.env['EMAIL_PROVIDER'] as EmailConfig['provider']) || 'smtp',
  smtpHost: process.env['SMTP_HOST'] || 'smtp.gmail.com',
  smtpPort: parseInt(process.env['SMTP_PORT'] || '587', 10),
  smtpUser: process.env['SMTP_USER'],
  smtpPass: process.env['SMTP_PASS'],
  sendgridApiKey: process.env['SENDGRID_API_KEY'],
  webhookUrl: process.env['ALERT_WEBHOOK_URL'],
  fromEmail: process.env['ALERT_FROM_EMAIL'] || 'alerts@fyiguard.io',
  fromName: process.env['ALERT_FROM_NAME'] || 'FYI Guard Alerts',
});

/**
 * Determine severity based on detection category and risk
 */
export function determineSeverity(
  category: string,
  riskLevel: string,
  isRepeated: boolean
): AlertPayload['severity'] {
  if (category === 'CREDENTIALS' || category === 'PRIVATE_KEY') return 'EMERGENCY';
  if (riskLevel === 'CRITICAL' || isRepeated) return 'CRITICAL';
  if (riskLevel === 'HIGH') return 'WARNING';
  return 'INFO';
}

/**
 * Check if this user has had repeated violations in the last hour
 */
async function checkRepeatedViolation(userId: string): Promise<{ isRepeated: boolean; count: number }> {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const count = await prisma.detectionEvent.count({
    where: {
      userId,
      eventType: { in: ['BLOCK', 'WARN'] },
      createdAt: { gte: oneHourAgo },
    },
  });
  return { isRepeated: count >= 3, count };
}

/**
 * Get org admin emails for the user's organization
 */
async function getOrgAdminEmails(orgId: string): Promise<string[]> {
  const admins = await prisma.orgMember.findMany({
    where: { orgId, role: 'admin' },
    include: { user: { select: { email: true } } },
  });
  return admins.map(a => a.user.email);
}

/**
 * Get alert email from user settings
 */
async function getUserAlertConfig(userId: string): Promise<{ alertEmail?: string; emailAlerts: boolean }> {
  const settings = await prisma.userSettings.findUnique({
    where: { userId },
    select: { emailAlerts: true, alertEmail: true },
  });
  return { alertEmail: settings?.alertEmail ?? undefined, emailAlerts: settings?.emailAlerts ?? false };
}

/**
 * Send email via configured provider
 */
async function sendEmail(to: string[], subject: string, htmlBody: string): Promise<boolean> {
  const config = getEmailConfig();
  try {
    if (config.provider === 'sendgrid' && config.sendgridApiKey) {
      const resp = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.sendgridApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          personalizations: [{ to: to.map(email => ({ email })) }],
          from: { email: config.fromEmail, name: config.fromName },
          subject,
          content: [{ type: 'text/html', value: htmlBody }],
        }),
      });
      return resp.ok;
    }

    if (config.provider === 'webhook' && config.webhookUrl) {
      const resp = await fetch(config.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to, subject, html: htmlBody, timestamp: new Date().toISOString() }),
      });
      return resp.ok;
    }

    // SMTP fallback using nodemailer (lazy import)
    if (config.provider === 'smtp' && config.smtpUser) {
      const nodemailer = await import('nodemailer');
      const transporter = nodemailer.createTransport({
        host: config.smtpHost,
        port: config.smtpPort,
        secure: config.smtpPort === 465,
        auth: { user: config.smtpUser, pass: config.smtpPass },
      });
      await transporter.sendMail({
        from: `"${config.fromName}" <${config.fromEmail}>`,
        to: to.join(', '),
        subject,
        html: htmlBody,
      });
      return true;
    }

    console.warn('[FYI Guard] No email provider configured. Alert logged but not sent.');
    return false;
  } catch (err) {
    console.error('[FYI Guard] Email send failed:', err);
    return false;
  }
}

/**
 * Build HTML email body for alert
 */
function buildAlertEmail(alert: AlertPayload): string {
  const severityColors: Record<string, string> = {
    INFO: '#3B82F6', WARNING: '#F59E0B', CRITICAL: '#EF4444', EMERGENCY: '#991B1B',
  };
  const color = severityColors[alert.severity] || '#6B7280';
  return `
    <div style="font-family: 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: ${color}; color: #fff; padding: 16px 24px; border-radius: 8px 8px 0 0;">
        <h2 style="margin: 0;">FYI Guard Alert: ${alert.severity}</h2>
      </div>
      <div style="border: 1px solid #e5e7eb; border-top: none; padding: 24px; border-radius: 0 0 8px 8px;">
        <p><strong>Type:</strong> ${alert.alertType.replace(/_/g, ' ')}</p>
        <p><strong>User:</strong> ${alert.userEmail}</p>
        <p><strong>Category:</strong> ${alert.category}</p>
        <p><strong>Platform:</strong> ${alert.platform}</p>
        <p><strong>Action Taken:</strong> ${alert.action}</p>
        <p><strong>Description:</strong> ${alert.description}</p>
        <div style="background: #FEF2F2; border: 1px solid #FECACA; padding: 12px; border-radius: 6px; margin: 16px 0;">
          <strong>Matched Content (sanitized):</strong><br/>
          <code style="font-size: 13px;">${alert.matchedContent}</code>
        </div>
        ${alert.url ? `<p><strong>URL:</strong> ${alert.url}</p>` : ''}
        <p style="color: #6B7280; font-size: 12px; margin-top: 24px;">This alert was generated by FYI Guard. Review in your admin dashboard.</p>
      </div>
    </div>
  `;
}

/**
 * Main alert processing function.
 * Creates alert record + sends email to org admin(s).
 */
export async function processAlert(payload: AlertPayload): Promise<string> {
  // Check for repeated violations
  const { isRepeated, count } = await checkRepeatedViolation(payload.userId);
  if (isRepeated && payload.alertType !== 'REPEATED_VIOLATION') {
    payload.alertType = 'REPEATED_VIOLATION';
    payload.description = `User has ${count} violations in the last hour. ${payload.description}`;
    payload.severity = 'CRITICAL';
  }

  // Collect recipient emails
  const recipients: string[] = [];

  // 1. Org admin emails
  if (payload.orgId) {
    const adminEmails = await getOrgAdminEmails(payload.orgId);
    recipients.push(...adminEmails);
  }

  // 2. User-configured alert email
  const userConfig = await getUserAlertConfig(payload.userId);
  if (userConfig.emailAlerts && userConfig.alertEmail) {
    recipients.push(userConfig.alertEmail);
  }

  // 3. Global alert email from env
  if (process.env['GLOBAL_ALERT_EMAIL']) {
    recipients.push(process.env['GLOBAL_ALERT_EMAIL']);
  }

  // Deduplicate
  const uniqueRecipients = [...new Set(recipients)];

  // Create DB record
  const alert = await prisma.adminAlert.create({
    data: {
      orgId: payload.orgId,
      userId: payload.userId,
      userEmail: payload.userEmail,
      alertType: payload.alertType,
      severity: payload.severity,
      category: payload.category,
      description: payload.description,
      matchedContent: payload.matchedContent,
      platform: payload.platform,
      url: payload.url,
      action: payload.action,
      notifiedEmails: uniqueRecipients,
    },
  });

  // Send email if recipients exist
  if (uniqueRecipients.length > 0) {
    const subject = `[FYI Guard ${payload.severity}] ${payload.alertType.replace(/_/g, ' ')} - ${payload.category}`;
    const html = buildAlertEmail(payload);
    await sendEmail(uniqueRecipients, subject, html);
  }

  console.log(`[FYI Guard] Alert ${alert.id} created. Severity: ${payload.severity}. Notified: ${uniqueRecipients.length} recipients.`);
  return alert.id;
}

/**
 * Check if an event warrants an admin alert
 */
export function shouldAlert(category: string, riskLevel: string, eventType: string): boolean {
  // Always alert on CRITICAL risk or CREDENTIALS/PRIVATE_KEY
  if (riskLevel === 'CRITICAL') return true;
  if (['CREDENTIALS', 'PRIVATE_KEY', 'DB_CREDENTIALS'].includes(category)) return true;
  // Alert on HIGH risk blocks
  if (riskLevel === 'HIGH' && eventType === 'BLOCK') return true;
  return false;
}