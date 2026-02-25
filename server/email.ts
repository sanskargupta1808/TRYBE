import nodemailer from "nodemailer";
import { Resend } from "resend";

const APP_URL = process.env.APP_URL || `https://${process.env.REPLIT_DOMAINS?.split(",")[0] || "trybe.health"}`;

const GMAIL_USER = process.env.GMAIL_USER;
const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD;
const FROM_ADDRESS = GMAIL_USER ? `TRYBE <${GMAIL_USER}>` : (process.env.FROM_EMAIL || "onboarding@resend.dev");

const gmailTransport = GMAIL_USER && GMAIL_APP_PASSWORD
  ? nodemailer.createTransport({
      service: "gmail",
      auth: { user: GMAIL_USER, pass: GMAIL_APP_PASSWORD },
    })
  : null;

const resend = !gmailTransport && process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

export function emailEnabled(): boolean {
  return !!(gmailTransport || resend);
}

export function emailProvider(): string {
  if (gmailTransport) return "gmail";
  if (resend) return "resend";
  return "none";
}

function htmlToPlainText(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&mdash;/g, "—")
    .replace(/&middot;/g, "·")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s{2,}/g, " ")
    .trim();
}

async function sendEmail(to: string, subject: string, html: string): Promise<{ sent: boolean; error?: string }> {
  if (gmailTransport) {
    try {
      await gmailTransport.sendMail({
        from: FROM_ADDRESS,
        to,
        subject,
        html,
        text: htmlToPlainText(html),
        headers: {
          "X-Mailer": "TRYBE Platform",
          "Precedence": "bulk",
        },
      });
      console.log(`[Email/Gmail] Sent to ${to}`);
      return { sent: true };
    } catch (err: any) {
      console.error("[Email/Gmail] Failed:", err?.message || err);
      return { sent: false, error: err?.message || "Gmail send failed" };
    }
  }

  if (resend) {
    try {
      const { error } = await resend.emails.send({ from: FROM_ADDRESS, to, subject, html });
      if (error) {
        console.error("[Email/Resend] Failed:", error);
        return { sent: false, error: (error as any).message || "Resend send failed" };
      }
      console.log(`[Email/Resend] Sent to ${to}`);
      return { sent: true };
    } catch (err: any) {
      console.error("[Email/Resend] Error:", err?.message || err);
      return { sent: false, error: err?.message || "Resend error" };
    }
  }

  console.log(`[Email] No provider configured. Would have sent to ${to}: ${subject}`);
  return { sent: false, error: "No email provider configured" };
}

function buildInviteEmail(name: string | undefined, token: string): string {
  const registerUrl = `${APP_URL}/register?invite=${token}`;
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Your TRYBE Invitation</title>
  <style>
    body { margin: 0; padding: 0; background: #f9f8f6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; }
    .wrapper { max-width: 560px; margin: 48px auto; background: #ffffff; border: 1px solid #e8e6e1; border-radius: 8px; overflow: hidden; }
    .header { background: #1a1a1a; padding: 32px 40px; }
    .logo { display: flex; align-items: center; gap: 10px; }
    .logo-mark { width: 32px; height: 32px; background: #c2692e; border-radius: 6px; display: inline-flex; align-items: center; justify-content: center; color: #fff; font-weight: 700; font-size: 14px; line-height: 32px; text-align: center; }
    .logo-name { color: #ffffff; font-size: 18px; font-weight: 600; letter-spacing: -0.3px; }
    .logo-tag { color: #9a9a9a; font-size: 11px; margin-top: 2px; }
    .body { padding: 40px 40px 32px; }
    h1 { font-size: 22px; font-weight: 600; color: #111111; margin: 0 0 12px; letter-spacing: -0.3px; }
    p { font-size: 15px; line-height: 1.65; color: #555555; margin: 0 0 20px; }
    .cta { display: block; background: #c2692e; color: #ffffff; text-decoration: none; text-align: center; font-size: 15px; font-weight: 600; padding: 14px 24px; border-radius: 6px; margin: 28px 0; letter-spacing: 0.1px; }
    .code-block { background: #f4f2ee; border: 1px solid #e0ddd8; border-radius: 6px; padding: 14px 18px; font-family: 'SF Mono', 'Fira Code', monospace; font-size: 17px; letter-spacing: 2px; color: #333; text-align: center; margin: 16px 0 24px; }
    .note { font-size: 13px; color: #888888; line-height: 1.6; }
    .divider { border: none; border-top: 1px solid #e8e6e1; margin: 28px 0; }
    .footer { padding: 20px 40px; background: #f9f8f6; border-top: 1px solid #e8e6e1; }
    .footer p { font-size: 12px; color: #aaaaaa; margin: 0; line-height: 1.6; }
    .footer a { color: #aaaaaa; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <div class="logo">
        <div class="logo-mark">T</div>
        <div>
          <div class="logo-name">TRYBE</div>
          <div class="logo-tag">Alpha</div>
        </div>
      </div>
    </div>
    <div class="body">
      <h1>You're invited to TRYBE${name ? `, ${name.split(" ")[0]}` : ""}</h1>
      <p>
        TRYBE is a private collaboration platform for global health professionals.
        We've reserved a place for you at the table.
      </p>
      <p>Use the link below to create your account. Your invitation code is embedded — no need to copy it separately.</p>

      <a href="${registerUrl}" class="cta">Accept invitation and create account</a>

      <p class="note">Or register manually using this invite code:</p>
      <div class="code-block">${token}</div>

      <p class="note">
        This invitation is personal and non-transferable. It expires in 30 days.<br />
        TRYBE is invite-only and all accounts are reviewed before access is granted.
      </p>
      <hr class="divider" />
      <p class="note">
        If you weren't expecting this invitation or believe it was sent in error,
        you can safely ignore this email. No account will be created without your action.
      </p>
    </div>
    <div class="footer">
      <p>
        TRYBE &mdash; Private Global Health Collaboration &nbsp;&middot;&nbsp;
        <a href="${APP_URL}/privacy">Privacy</a> &nbsp;&middot;&nbsp;
        <a href="${APP_URL}/code-of-conduct">Code of Conduct</a>
      </p>
    </div>
  </div>
</body>
</html>
  `.trim();
}

function buildApprovalEmail(name: string, token: string): string {
  const registerUrl = `${APP_URL}/register?invite=${token}`;
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Your TRYBE request has been approved</title>
  <style>
    body { margin: 0; padding: 0; background: #f9f8f6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; }
    .wrapper { max-width: 560px; margin: 48px auto; background: #ffffff; border: 1px solid #e8e6e1; border-radius: 8px; overflow: hidden; }
    .header { background: #1a1a1a; padding: 32px 40px; }
    .logo-mark { width: 32px; height: 32px; background: #c2692e; border-radius: 6px; display: inline-flex; align-items: center; justify-content: center; color: #fff; font-weight: 700; font-size: 14px; line-height: 32px; text-align: center; }
    .logo-name { color: #ffffff; font-size: 18px; font-weight: 600; letter-spacing: -0.3px; }
    .body { padding: 40px 40px 32px; }
    h1 { font-size: 22px; font-weight: 600; color: #111111; margin: 0 0 12px; letter-spacing: -0.3px; }
    p { font-size: 15px; line-height: 1.65; color: #555555; margin: 0 0 20px; }
    .cta { display: block; background: #c2692e; color: #ffffff; text-decoration: none; text-align: center; font-size: 15px; font-weight: 600; padding: 14px 24px; border-radius: 6px; margin: 28px 0; letter-spacing: 0.1px; }
    .code-block { background: #f4f2ee; border: 1px solid #e0ddd8; border-radius: 6px; padding: 14px 18px; font-family: 'SF Mono', 'Fira Code', monospace; font-size: 17px; letter-spacing: 2px; color: #333; text-align: center; margin: 16px 0 24px; }
    .note { font-size: 13px; color: #888888; line-height: 1.6; }
    .divider { border: none; border-top: 1px solid #e8e6e1; margin: 28px 0; }
    .footer { padding: 20px 40px; background: #f9f8f6; border-top: 1px solid #e8e6e1; }
    .footer p { font-size: 12px; color: #aaaaaa; margin: 0; line-height: 1.6; }
    .footer a { color: #aaaaaa; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <div style="display:flex;align-items:center;gap:10px;">
        <div class="logo-mark">T</div>
        <div>
          <div class="logo-name">TRYBE</div>
          <div style="color:#9a9a9a;font-size:11px;margin-top:2px;">Alpha</div>
        </div>
      </div>
    </div>
    <div class="body">
      <h1>Your invitation request has been approved${name ? `, ${name.split(" ")[0]}` : ""}</h1>
      <p>
        We reviewed your request to join TRYBE and we're pleased to confirm that
        a place has been reserved for you.
      </p>
      <p>Click below to create your account and begin your TRYBE journey.</p>

      <a href="${registerUrl}" class="cta">Create your account</a>

      <p class="note">Or use this invite code when registering:</p>
      <div class="code-block">${token}</div>

      <p class="note">
        Your invitation expires in 30 days. TRYBE is a private, professional space &mdash;
        please review the Code of Conduct before your first contribution.
      </p>
      <hr class="divider" />
      <p class="note">
        If you didn't request an invitation to TRYBE, please ignore this email.
      </p>
    </div>
    <div class="footer">
      <p>
        TRYBE &mdash; Private Global Health Collaboration &nbsp;&middot;&nbsp;
        <a href="${APP_URL}/privacy">Privacy</a> &nbsp;&middot;&nbsp;
        <a href="${APP_URL}/code-of-conduct">Code of Conduct</a>
      </p>
    </div>
  </div>
</body>
</html>
  `.trim();
}

function buildApprovalPendingEmail(name: string): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>TRYBE — Account approved</title>
  <style>
    body { margin: 0; padding: 0; background: #f9f8f6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; }
    .wrapper { max-width: 560px; margin: 48px auto; background: #ffffff; border: 1px solid #e8e6e1; border-radius: 8px; overflow: hidden; }
    .header { background: #1a1a1a; padding: 32px 40px; }
    .logo-name { color: #ffffff; font-size: 18px; font-weight: 600; }
    .body { padding: 40px; }
    h1 { font-size: 22px; font-weight: 600; color: #111111; margin: 0 0 16px; }
    p { font-size: 15px; line-height: 1.65; color: #555555; margin: 0 0 20px; }
    .cta { display: block; background: #c2692e; color: #fff; text-decoration: none; text-align: center; font-size: 15px; font-weight: 600; padding: 14px 24px; border-radius: 6px; margin: 28px 0; }
    .footer { padding: 20px 40px; background: #f9f8f6; border-top: 1px solid #e8e6e1; }
    .footer p { font-size: 12px; color: #aaaaaa; margin: 0; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header"><div class="logo-name">TRYBE</div></div>
    <div class="body">
      <h1>Your account has been approved${name ? `, ${name.split(" ")[0]}` : ""}</h1>
      <p>
        The TRYBE admin team has reviewed your profile and your account is now active.
        You can sign in and begin contributing to the tables you care about.
      </p>
      <a href="${APP_URL}/login" class="cta">Sign in to TRYBE</a>
      <p style="font-size:13px;color:#888;">
        If you have questions, use the Feedback section inside the platform.
      </p>
    </div>
    <div class="footer"><p>TRYBE &mdash; Private Global Health Collaboration</p></div>
  </div>
</body>
</html>
  `.trim();
}

export async function sendInviteEmail(recipientEmail: string, recipientName: string | undefined, token: string): Promise<{ sent: boolean; error?: string }> {
  return sendEmail(
    recipientEmail,
    "You're invited to TRYBE — Private Global Health Collaboration",
    buildInviteEmail(recipientName, token)
  );
}

export async function sendInviteRequestApprovedEmail(recipientEmail: string, recipientName: string, token: string): Promise<boolean> {
  const result = await sendEmail(
    recipientEmail,
    "Your TRYBE invitation request has been approved",
    buildApprovalEmail(recipientName, token)
  );
  return result.sent;
}

export async function sendAccountApprovedEmail(recipientEmail: string, recipientName: string): Promise<boolean> {
  const result = await sendEmail(
    recipientEmail,
    "Your TRYBE account has been approved",
    buildApprovalPendingEmail(recipientName)
  );
  return result.sent;
}
