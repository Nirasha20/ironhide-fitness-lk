import * as nodemailer from 'nodemailer';

const APP_URL = process.env.APP_URL || 'http://localhost:5173';

// Read credentials lazily at call time (not at module load)
// This ensures Firebase Secrets are available when functions execute
function getCredentials() {
  const user = (process.env.GMAIL_USER || '').trim();
  const pass = (process.env.GMAIL_PASS || process.env.GMAIL_APP_PASSWORD || '').replace(/\s+/g, '');
  return { user, pass };
}

export function createTransporter() {
  const { user, pass } = getCredentials();
  return nodemailer.createTransport({
    service: 'gmail',
    auth: { user, pass },
  });
}

export function isEmailConfigured(): boolean {
  const { user, pass } = getCredentials();
  return !!user && !!pass;
}

export function getMailFromEmail(): string {
  return (process.env.GMAIL_USER || '').trim();
}

// Keep this for backward compatibility with invoiceService.ts
export const MAIL_FROM_EMAIL = '';  // deprecated — use getMailFromEmail() instead

/**
 * Send initial verification email to new member
 */
export async function sendInitialVerificationEmail(
  userEmail: string,
  fullName: string
): Promise<void> {
  const { user, pass } = getCredentials();
  if (!user || !pass) {
    console.warn('[EmailService] Gmail not configured. Skipping email.');
    return;
  }

  const firstName = fullName.split(' ')[0];
  const verificationLink = `${APP_URL}/verify-email`;

  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #cc0000; color: white; padding: 20px; text-align: center; margin-bottom: 30px; }
          .header h1 { margin: 0; font-size: 28px; }
          .content { background: #f9f9f9; padding: 20px; border-left: 4px solid #cc0000; margin-bottom: 20px; }
          .button { display: inline-block; background: #cc0000; color: white; padding: 12px 30px; text-decoration: none; margin: 20px 0; border-radius: 4px; font-weight: bold; }
          .footer { font-size: 12px; color: #666; text-align: center; border-top: 1px solid #ddd; padding-top: 20px; }
          .code { background: #f0f0f0; padding: 10px; border-radius: 4px; font-family: monospace; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header"><h1>IRONHIDE FITNESS</h1></div>
          <p>Hi ${firstName},</p>
          <p>Welcome to IronHide Fitness! 🏋️ Your account has been created successfully.</p>
          <div class="content">
            <p><strong>Verify Your Email Address</strong></p>
            <p>To complete your registration and activate your membership, please verify your email:</p>
            <p style="text-align: center;">
              <a href="${verificationLink}" class="button">VERIFY EMAIL ADDRESS</a>
            </p>
            <p style="color: #666; font-size: 12px; text-align: center;">
              If the button doesn't work, copy and paste this link:<br>
              <span class="code">${verificationLink}</span>
            </p>
          </div>
          <p style="margin-top: 30px; color: #666; font-size: 14px;">
            Questions? Contact us:<br>
            📞 +94 70 322 2211<br>
            📧 support@ironhidefitness.lk<br>
            🕐 Mon–Sat: 6:00 AM – 10:00 PM | Sun: 8:00 AM – 8:00 PM
          </p>
          <div class="footer">
            <p>© 2026 IronHide Fitness. All rights reserved.</p>
          </div>
        </div>
      </body>
    </html>
  `;

  try {
    await createTransporter().sendMail({
      from: `IronHide Fitness <${user}>`,
      to: userEmail,
      subject: 'Verify Your Email - IronHide Fitness',
      html: htmlContent,
    });
    console.log(`[EmailService] Initial verification email sent to ${userEmail}`);
  } catch (err) {
    console.error('[EmailService] Failed to send initial verification email:', err);
    throw err;
  }
}

/**
 * Send verification email after payment confirmed (bank transfer / cash)
 */
export async function sendVerificationEmailAfterPayment(
  userEmail: string,
  fullName: string,
  paymentMethod: string,
  plan: string
): Promise<void> {
  const { user, pass } = getCredentials();
  if (!user || !pass) {
    console.warn('[EmailService] Gmail not configured. Skipping email.');
    return;
  }

  const firstName = fullName.split(' ')[0];
  const methodText =
    paymentMethod === 'bank_transfer'
      ? 'bank transfer receipt has been verified'
      : 'cash payment has been confirmed';

  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #cc0000; color: white; padding: 20px; text-align: center; margin-bottom: 30px; }
          .header h1 { margin: 0; font-size: 28px; }
          .content { background: #f9f9f9; padding: 20px; border-left: 4px solid #cc0000; margin-bottom: 20px; }
          .button { display: inline-block; background: #cc0000; color: white; padding: 12px 30px; text-decoration: none; margin: 20px 0; border-radius: 4px; font-weight: bold; }
          .footer { font-size: 12px; color: #666; text-align: center; border-top: 1px solid #ddd; padding-top: 20px; }
          .badge { background: #4caf50; color: white; display: inline-block; padding: 4px 12px; border-radius: 20px; font-weight: bold; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header"><h1>IRONHIDE FITNESS</h1></div>
          <p>Hi ${firstName},</p>
          <p>Great news! Your ${plan} membership ${methodText}. 🎉</p>
          <div class="content">
            <p><strong>Your membership is now active!</strong></p>
            <ul>
              <li>📅 Plan: ${plan}</li>
              <li>✅ Status: <span class="badge">ACTIVE</span></li>
              <li>📍 Gym: 114C Negombo Rd, Wattala</li>
            </ul>
          </div>
          <p><a href="${APP_URL}/dashboard" class="button">GO TO YOUR DASHBOARD</a></p>
          <p style="margin-top: 30px; color: #666; font-size: 14px;">
            📞 +94 70 322 2211 | 📧 support@ironhidefitness.lk
          </p>
          <div class="footer"><p>© 2026 IronHide Fitness. All rights reserved.</p></div>
        </div>
      </body>
    </html>
  `;

  try {
    await createTransporter().sendMail({
      from: `IronHide Fitness <${user}>`,
      to: userEmail,
      subject: 'Membership Activated - IronHide Fitness',
      html: htmlContent,
    });
    console.log(`[EmailService] Verification email sent to ${userEmail}`);
  } catch (err) {
    console.error('[EmailService] Failed to send verification email:', err);
    throw err;
  }
}

/**
 * Send payment confirmation email
 */
export async function sendPaymentConfirmationEmail(
  userEmail: string,
  fullName: string,
  plan: string,
  amount: number,
  expiryDate: Date
): Promise<void> {
  const { user, pass } = getCredentials();
  if (!user || !pass) {
    console.warn('[EmailService] Gmail not configured. Skipping email.');
    return;
  }

  const firstName = fullName.split(' ')[0];

  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #cc0000; color: white; padding: 20px; text-align: center; margin-bottom: 30px; }
          .header h1 { margin: 0; font-size: 28px; }
          .receipt { background: white; padding: 15px; border: 1px solid #ddd; margin: 20px 0; }
          .receipt-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #eee; }
          .receipt-row.total { border-bottom: none; font-weight: bold; font-size: 16px; }
          .button { display: inline-block; background: #cc0000; color: white; padding: 12px 30px; text-decoration: none; margin: 20px 0; border-radius: 4px; font-weight: bold; }
          .footer { font-size: 12px; color: #666; text-align: center; border-top: 1px solid #ddd; padding-top: 20px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header"><h1>IRONHIDE FITNESS</h1></div>
          <p>Hi ${firstName},</p>
          <p>Thank you for your payment! Your ${plan} membership is now confirmed.</p>
          <div class="receipt">
            <h3 style="margin-top: 0;">Payment Receipt</h3>
            <div class="receipt-row"><span>Membership Plan:</span><span>${plan}</span></div>
            <div class="receipt-row"><span>Amount Paid:</span><span>LKR ${amount.toLocaleString()}</span></div>
            <div class="receipt-row"><span>Valid Until:</span><span>${expiryDate.toDateString()}</span></div>
            <div class="receipt-row total"><span>Status:</span><span style="color: #4caf50;">✓ CONFIRMED</span></div>
          </div>
          <p><a href="${APP_URL}/dashboard" class="button">VIEW YOUR MEMBERSHIP</a></p>
          <p style="color: #666; font-size: 14px;">
            Questions? Call +94 70 322 2211 or email support@ironhidefitness.lk
          </p>
          <div class="footer"><p>© 2026 IronHide Fitness. All rights reserved.</p></div>
        </div>
      </body>
    </html>
  `;

  try {
    await createTransporter().sendMail({
      from: `IronHide Fitness <${user}>`,
      to: userEmail,
      subject: 'Payment Confirmed - IronHide Fitness Membership',
      html: htmlContent,
    });
    console.log(`[EmailService] Payment confirmation email sent to ${userEmail}`);
  } catch (err) {
    console.error('[EmailService] Failed to send payment confirmation email:', err);
    throw err;
  }
}