// src/app/api/auth/resend-verification/route.js
//
// Resends the signup verification email for users who haven't confirmed yet.
// Generates a fresh magic link and sends via Resend.

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

    // Rate limit: 3 resend attempts per IP per 10 minutes.
    const key = clientKey(req);
    const { ok, retryAfter } = rateLimit({
      key: `resend-verify:${key}`,
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

    try {
      const admin = createAdminClient();

      // Generate a fresh signup confirmation link.
      const { data, error } = await admin.auth.admin.generateLink({
        type: "signup",
        email,
        options: {
          redirectTo: `${siteUrl}/auth/callback`,
        },
      });

      if (error) {
        console.log("[resend-verification] generateLink error:", error.message);
      } else if (data?.properties?.action_link) {
        const name = data.user?.user_metadata?.name || "";
        await sendVerificationEmail({
          to: email,
          name,
          verificationUrl: data.properties.action_link,
        });
      }
    } catch (e) {
      console.error("[resend-verification] Internal error:", e?.message || e);
    }

    // Always 200 for security.
    return NextResponse.json({
      message: "If your account is pending verification, we've sent a new link.",
    });
  } catch (e) {
    return errorResponse(e);
  }
}
