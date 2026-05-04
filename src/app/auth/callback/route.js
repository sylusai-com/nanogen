import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Exchanges the OAuth/email-confirmation code for a session cookie.
//
// The Google / GitHub sign-in flow lands here after Supabase finishes the OAuth
// dance. We:
//   1. Read the auth code from the query string and trade it for a session.
//   2. Honour `?next=…` if the caller passed one through (the SocialAuth
//      button forwards the original /login?next=… target).
//   3. If no `next` is provided, route admins to /admin and everyone else
//      to /dashboard — keeps OAuth role-routing consistent with the
//      email/password path.
//   4. On error (provider denied, code exchange failed, OAuth provider
//      reported `error_description`), redirect to /login with a readable
//      message so the user isn't left on a blank page.
//
// IMPORTANT: register `<your-site>/auth/callback` in:
//   - Supabase: Authentication → URL Configuration → Redirect URLs
//   - Google Cloud and/or GitHub OAuth app: set the provider callback to the
//     Supabase project callback URL `<project>.supabase.co/auth/v1/callback`
export async function GET(request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = sanitizeNext(searchParams.get("next"));

  // Provider-side errors arrive with `error` + `error_description` in the
  // query string when the user denies consent or the OAuth provider rejects
  // the request.
  const providerError =
    searchParams.get("error_description") || searchParams.get("error");
  if (providerError) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(providerError)}`,
    );
  }

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=missing_code`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(error.message)}`,
    );
  }

  // Decide where to land. An explicit ?next=… always wins (lets users
  // bookmark deep links). Otherwise, route admins to /admin like the
  // email/password sign-in path does.
  if (next) {
    return NextResponse.redirect(`${origin}${next}`);
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  let destination = "/dashboard";
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    if (profile?.role === "admin") destination = "/admin";
  }
  return NextResponse.redirect(`${origin}${destination}`);
}

// Only allow same-origin path redirects. Protects against open-redirects
// where an attacker sends a victim to /auth/callback?next=https://evil.example.
function sanitizeNext(value) {
  if (!value || typeof value !== "string") return null;
  if (!value.startsWith("/") || value.startsWith("//")) return null;
  return value;
}
