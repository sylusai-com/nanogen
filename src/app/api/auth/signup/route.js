import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

// Server-side signup that bypasses email confirmation. Uses the admin client
// (SUPABASE_SECRET_KEY) so users are created with email_confirm = true and can
// sign in immediately. The handle_new_user trigger still fires, so the
// profile row + admin_emails check both work as before.
export async function POST(req) {
  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { email, password, name } = body || {};
  if (!email || !password) {
    return NextResponse.json(
      { error: "Email and password are required" },
      { status: 400 },
    );
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json(
      {
        error:
          "Server is missing SUPABASE_SECRET_KEY — add it to .env.local from Supabase → Project Settings → API keys.",
      },
      { status: 500 },
    );
  }

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name },
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({
    user: { id: data.user.id, email: data.user.email },
  });
}
