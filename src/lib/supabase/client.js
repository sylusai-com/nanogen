"use client";

import { createBrowserClient } from "@supabase/ssr";

// Browser-side Supabase client. Uses the publishable key — RLS is enforced.
// Safe to call from any "use client" component.
let client;

export function createClient() {
  if (client) return client;
  client = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
  return client;
}
