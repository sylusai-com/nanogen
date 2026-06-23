// src/lib/mail.js
//
// Email service using Resend. All outbound emails go through this module.
//
// Environment variables:
//   RESEND_API_KEY     — from https://resend.com/api-keys
//   RESEND_FROM_EMAIL  — e.g. "Nanozen <noreply@yourdomain.com>"
//                        Use "onboarding@resend.dev" for local testing.

import { Resend } from "resend";

let _resend;

function getResend() {
  if (_resend) return _resend;
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  _resend = new Resend(key);
  return _resend;
}

function getFromEmail() {
  return process.env.RESEND_FROM_EMAIL || "Nanozen <onboarding@resend.dev>";
}

// ─────────────────────────────────────────────────────────────────────────
// Shared email wrapper (branded layout)
// ─────────────────────────────────────────────────────────────────────────

function emailLayout({ preheader, heading, body, buttonText, buttonUrl, footer }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="color-scheme" content="dark" />
  <title>${heading}</title>
  <!--[if !mso]><!-->
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap');
  </style>
  <!--<![endif]-->
</head>
<body style="margin:0;padding:0;background-color:#0a0a0f;font-family:'Inter',ui-sans-serif,system-ui,-apple-system,sans-serif;">
  ${preheader ? `<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${preheader}</div>` : ""}
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#0a0a0f;">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;width:100%;">
          <!-- Logo -->
          <tr>
            <td style="padding-bottom:32px;text-align:center;">
              <span style="font-size:20px;font-weight:700;color:#ffffff;letter-spacing:-0.02em;">Nano<span style="color:#a78bfa;">zen</span></span>
            </td>
          </tr>
          <!-- Card -->
          <tr>
            <td style="background-color:#111116;border:1px solid rgba(255,255,255,0.08);border-radius:16px;padding:40px 32px;">
              <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#ffffff;line-height:1.3;">${heading}</h1>
              <div style="font-size:14px;line-height:1.6;color:rgba(255,255,255,0.65);">${body}</div>
              ${buttonText && buttonUrl ? `
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:28px 0 0;">
                <tr>
                  <td style="border-radius:999px;background:linear-gradient(135deg,#a78bfa,#7c5cbf);text-align:center;">
                    <a href="${buttonUrl}" target="_blank" style="display:inline-block;padding:14px 32px;font-size:14px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:999px;">${buttonText}</a>
                  </td>
                </tr>
              </table>
              ` : ""}
              ${footer ? `<div style="margin-top:24px;font-size:12px;color:rgba(255,255,255,0.4);line-height:1.5;">${footer}</div>` : ""}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding-top:24px;text-align:center;">
              <p style="margin:0;font-size:11px;color:rgba(255,255,255,0.3);">
                &copy; ${new Date().getFullYear()} Nanozen &middot; AI Banner Generation Platform
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ─────────────────────────────────────────────────────────────────────────
// Public senders
// ─────────────────────────────────────────────────────────────────────────

/**
 * Send a signup email verification link.
 *
 * @param {{ to: string, name?: string, verificationUrl: string }} opts
 */
export async function sendVerificationEmail({ to, name, verificationUrl }) {
  const resend = getResend();
  if (!resend) {
    console.warn("[mail] RESEND_API_KEY not set — skipping verification email to", to);
    console.log("[mail] Verification URL:", verificationUrl);
    return { success: false, reason: "RESEND_API_KEY not configured" };
  }

  const firstName = (name || "").split(" ")[0] || "there";
  const html = emailLayout({
    preheader: "Verify your email to start creating AI-powered banners",
    heading: "Verify your email",
    body: `
      <p style="margin:0 0 16px;">Hi ${firstName},</p>
      <p style="margin:0 0 16px;">Welcome to Nanozen! Click the button below to verify your email address and start creating stunning AI-powered banners.</p>
    `,
    buttonText: "Verify email address",
    buttonUrl: verificationUrl,
    footer: `If you didn't create an account, you can safely ignore this email.<br/>This link expires in 24 hours.`,
  });

  try {
    const { data, error } = await resend.emails.send({
      from: getFromEmail(),
      to,
      subject: "Verify your email — Nanozen",
      html,
    });
    if (error) {
      console.error("[mail] Resend error (verification):", error);
      return { success: false, reason: error.message };
    }
    return { success: true, id: data?.id };
  } catch (e) {
    console.error("[mail] Failed to send verification email:", e);
    return { success: false, reason: e?.message || "Unknown error" };
  }
}

/**
 * Send a password-reset link.
 *
 * @param {{ to: string, name?: string, resetUrl: string }} opts
 */
export async function sendPasswordResetEmail({ to, name, resetUrl }) {
  const resend = getResend();
  if (!resend) {
    console.warn("[mail] RESEND_API_KEY not set — skipping reset email to", to);
    console.log("[mail] Reset URL:", resetUrl);
    return { success: false, reason: "RESEND_API_KEY not configured" };
  }

  const firstName = (name || "").split(" ")[0] || "there";
  const html = emailLayout({
    preheader: "Reset your Nanozen password",
    heading: "Reset your password",
    body: `
      <p style="margin:0 0 16px;">Hi ${firstName},</p>
      <p style="margin:0 0 16px;">We received a request to reset your password. Click the button below to choose a new one.</p>
    `,
    buttonText: "Reset password",
    buttonUrl: resetUrl,
    footer: `If you didn't request a password reset, you can safely ignore this email. Your password won't change.<br/>This link expires in 1 hour.`,
  });

  try {
    const { data, error } = await resend.emails.send({
      from: getFromEmail(),
      to,
      subject: "Reset your password — Nanozen",
      html,
    });
    if (error) {
      console.error("[mail] Resend error (reset):", error);
      return { success: false, reason: error.message };
    }
    return { success: true, id: data?.id };
  } catch (e) {
    console.error("[mail] Failed to send reset email:", e);
    return { success: false, reason: e?.message || "Unknown error" };
  }
}
