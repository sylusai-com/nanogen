// src/app/api/auth/forgot-password/route.js
//
// Generates a password-reset magic link via Supabase admin API,
// then sends it through Resend. Always returns 200 to avoid
// revealing whether the email exists.

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendPasswordResetEmail } from "@/lib/mail";
import {
  readJson,
  originAllowed,
  rateLimit,
  clientKey,
  validateString,
  ValidationError,
  errorResponse,
} from "@/lib/server/security";

export const runtime = "nodejs";

export async function POST(req) {
  try {
    if (!originAllowed(req)) {
      throw new ValidationError("Forbidden", 403);
    }

    const body = await readJson(req, { maxBytes: 2 * 1024 });
    const email = validateString(body.email, {
      name: "email",
      required: true,
      max: 254,
    });

    // Rate limit: 3 reset requests per IP per 10 minutes.
    const key = clientKey(req);
    const { ok, retryAfter } = rateLimit({
      key: `forgot:${key}`,
      max: 3,
      windowMs: 600_000,
    });
    if (!ok) {
      return NextResponse.json(
        { error: `Too many requests. Try again in ${retryAfter}s.` },
        { status: 429, headers: { "Retry-After": String(retryAfter) } },
      );
    }

    const siteUrl =
      process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

    // Fire-and-forget: don't reveal whether email exists.
    // We catch all errors and still return 200.
    try {
      const admin = createAdminClient();

      // Generate the recovery link. Supabase returns the full redirect URL
      // with token_hash + type params.
      const { data, error } = await admin.auth.admin.generateLink({
        type: "recovery",
        email,
        options: {
          redirectTo: `${siteUrl}/auth/callback?next=/reset-password`,
        },
      });

      if (error) {
        // User doesn't exist or other error — silently ignore.
        console.log("[forgot-password] generateLink error (expected for unknown emails):", error.message);
      } else if (data?.properties?.action_link) {
        // Look up user name for the email template.
        const { data: userData } = await admin.auth.admin.getUserById(data.user.id);
        const name = userData?.user?.user_metadata?.name || "";

        await sendPasswordResetEmail({
          to: email,
          name,
          resetUrl: data.properties.action_link,
        });
      }
    } catch (e) {
      // Swallow — never reveal errors to the client.
      console.error("[forgot-password] Internal error:", e?.message || e);
    }

    // Always 200 — "If an account exists, we sent an email."
    return NextResponse.json({
      message: "If an account exists with that email, we've sent a password reset link.",
    });
  } catch (e) {
    return errorResponse(e);
  }
}
