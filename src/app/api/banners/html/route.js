// src/app/api/banners/html/route.js
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateBannerTemplate } from "@/lib/bannerTemplate";
import {
  clientKey,
  errorResponse,
  originAllowed,
  rateLimit,
  readJson,
  validateEnum,
  validateString,
} from "@/lib/server/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_ASPECTS = ["1:1", "4:5", "9:16", "16:9"];

// Returns an HTML banner template for the editor — same generation path
// as /api/banners but without persistence. Used when the editor needs a
// fresh template (e.g. older banner without stored html).
export async function POST(req) {
  if (!originAllowed(req)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const rl = rateLimit({
    key:      clientKey(req, user?.id),
    max:      20,
    windowMs: 5 * 60_000,
  });
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } },
    );
  }

  let body;
  try { body = await readJson(req, { maxBytes: 16 * 1024 }); }
  catch (e) { return errorResponse(e); }

  let prompt, style, aspect;
  try {
    prompt = validateString(body.prompt, { name: "prompt", max: 4000 });
    style  = validateString(body.style,  { name: "style",  max: 60  }) || "Modern";
    aspect = validateEnum(body.aspect, ALLOWED_ASPECTS, { name: "aspect" }) || "16:9";
  } catch (e) { return errorResponse(e); }

  const template = await generateBannerTemplate({ supabase, prompt, style, aspect });
  const res = NextResponse.json(template);
  res.headers.set("Cache-Control", "private, no-store");
  return res;
}
