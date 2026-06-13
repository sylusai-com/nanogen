import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request) {
  const { searchParams } = new URL(request.url);

  const code = searchParams.get("code");
  const next = sanitizeNext(searchParams.get("next"));

  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    "https://nanozen-app-758484459646.asia-south2.run.app";

  const providerError =
    searchParams.get("error_description") || searchParams.get("error");

  if (providerError) {
    return NextResponse.redirect(
      new URL(
        `/login?error=${encodeURIComponent(providerError)}`,
        siteUrl,
      ),
    );
  }

  if (!code) {
    return NextResponse.redirect(
      new URL("/login?error=missing_code", siteUrl),
    );
  }

  const supabase = await createClient();

  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(
      new URL(
        `/login?error=${encodeURIComponent(error.message)}`,
        siteUrl,
      ),
    );
  }

  // Explicit next destination always wins.
  if (next) {
    return NextResponse.redirect(new URL(next, siteUrl));
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let destination = "/dashboard/banners";

  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (profile?.role === "admin") {
      destination = "/admin";
    }
  }

  return NextResponse.redirect(new URL(destination, siteUrl));
}

// Only allow same-origin path redirects.
function sanitizeNext(value) {
  if (!value || typeof value !== "string") return null;
  if (!value.startsWith("/") || value.startsWith("//")) return null;
  return value;
}