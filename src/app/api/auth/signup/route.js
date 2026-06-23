import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendVerificationEmail } from "@/lib/mail";
import {
  readJson,
  originAllowed,
  rateLimit,
  clientKey,
  validateString,
  ValidationError,
  errorResponse
} from "@/lib/server/security";

export const runtime = "nodejs";

// Server-side signup. Creates the user with email_confirm: false so they
// must verify via the link we send through Resend. The handle_new_user
// trigger still fires, so the profile row + admin_emails check work.
export async function POST(req) {
  try {
    // 1. CSRF defence
    if (!originAllowed(req)) {
      throw new ValidationError("CSRF block: Request origin or referer not recognized.", 403);
    }

    // 2. Rate limiting: 5 signups per IP per 10 minutes (600,000 ms)
    const key = clientKey(req);
    const { ok, retryAfter } = rateLimit({ key: `signup:${key}`, max: 5, windowMs: 600_000 });
    if (!ok) {
      return NextResponse.json(
        { error: `Too many signups. Please try again after ${retryAfter} seconds.` },
        { status: 429, headers: { "Retry-After": String(retryAfter) } }
      );
    }

    // 3. Capped JSON parse (max 10 KB for signup request)
    const body = await readJson(req, { maxBytes: 10 * 1024 });

    // 4. Input validation
    const emailRaw = body.email;
    const passwordRaw = body.password;
    const nameRaw = body.name;

    const email = validateString(emailRaw, { name: "Email", required: true, max: 254 });
    const password = validateString(passwordRaw, { name: "Password", required: true, min: 8, max: 72 });
    const name = validateString(nameRaw, { name: "Name", required: false, max: 100 });

    // Simple email regex validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new ValidationError("Invalid email address format.");
    }

    let admin;
    try {
      admin = createAdminClient();
    } catch {
      throw new ValidationError(
        "Server is missing SUPABASE_SECRET_KEY — add it to .env.local from Supabase → Project Settings → API keys.",
        500
      );
    }

    // Create user WITHOUT email confirmation — they must click the link.
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: false,
      user_metadata: { name },
    });

    if (error) {
      throw new ValidationError(error.message, 400);
    }

    // Generate a signup verification magic link and send via Resend.
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
    try {
      const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
        type: "signup",
        email,
        options: {
          redirectTo: `${siteUrl}/auth/callback`,
        },
      });

      if (linkError) {
        console.error("[signup] Failed to generate verification link:", linkError.message);
      } else if (linkData?.properties?.action_link) {
        const mailResult = await sendVerificationEmail({
          to: email,
          name: name || "",
          verificationUrl: linkData.properties.action_link,
        });
        if (!mailResult.success) {
          console.warn("[signup] Verification email not sent:", mailResult.reason);
        }
      }
    } catch (e) {
      // Don't fail the signup — the user was created, they can request
      // a resend from the verify-email page.
      console.error("[signup] Error sending verification email:", e?.message || e);
    }

    return NextResponse.json({
      user: { id: data.user.id, email: data.user.email },
      requiresVerification: true,
    });
  } catch (e) {
    return errorResponse(e);
  }
}

