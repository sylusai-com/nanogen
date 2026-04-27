// src/app/api/banners/html/route.js
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateBannerTemplate } from "@/lib/bannerTemplate";

export const runtime = "nodejs";

// Returns an HTML banner template for the editor. When OPENROUTER_API_KEY is
// configured AND a default text model exists in the `models` table, this
// calls OpenRouter; otherwise it returns the styled fallback. The editor
// page consumes the response directly.
export async function POST(req) {
  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { prompt = "", style = "Modern", aspect = "16:9" } = body || {};
  const supabase = await createClient();
  const template = await generateBannerTemplate({ supabase, prompt, style, aspect });
  return NextResponse.json(template);
}
