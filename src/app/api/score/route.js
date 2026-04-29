// src/app/api/score/route.js
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { scoreBannerImage, scoreBannerTemplate } from "@/lib/scoreBanner";
import { SCORE_THRESHOLD } from "@/lib/models";
import {
  clientKey,
  errorResponse,
  originAllowed,
  rateLimit,
  readJson,
  validateString,
} from "@/lib/server/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const URL_RE = /^https?:\/\/[^\s<>"'`]+$/i;

// Banner scoring endpoint. Accepts either:
//
//   { imageUrl, prompt? }                         → vision-model scoring
//   { html, css, prompt?, style?, aspect? }       → text-model design critique
//
// Returns:
//
//   { score, source, breakdown?, reason?, threshold, passes }
export async function POST(req) {
  if (!originAllowed(req)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const rl = rateLimit({
    key:      clientKey(req, user?.id),
    max:      60,
    windowMs: 60_000,
  });
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } },
    );
  }

  let body;
  try { body = await readJson(req, { maxBytes: 256 * 1024 }); }
  catch (e) { return errorResponse(e); }

  const imageUrl = body.imageUrl;
  const html     = body.html;
  if (!imageUrl && !html) {
    return NextResponse.json(
      { error: "Provide either { imageUrl } or { html, css }." },
      { status: 400 },
    );
  }

  // Validate fields explicitly so a hostile body can't enlarge our LLM
  // request payload arbitrarily.
  let prompt, style, aspect, css;
  try {
    prompt = validateString(body.prompt, { name: "prompt", max: 4000 });
    style  = validateString(body.style,  { name: "style",  max: 60 });
    aspect = validateString(body.aspect, { name: "aspect", max: 10 });
    css    = validateString(body.css,    { name: "css",    max: 200_000 });
  } catch (e) { return errorResponse(e); }

  if (imageUrl) {
    if (typeof imageUrl !== "string" || !URL_RE.test(imageUrl)) {
      return NextResponse.json({ error: "Invalid imageUrl" }, { status: 400 });
    }
  } else if (typeof html !== "string" || html.length > 200_000) {
    return NextResponse.json({ error: "Invalid html (max 200KB)" }, { status: 400 });
  }

  const result = imageUrl
    ? await scoreBannerImage({ supabase, prompt, imageUrl })
    : await scoreBannerTemplate({ supabase, prompt, style, aspect, html, css });

  const res = NextResponse.json({
    ...result,
    threshold: SCORE_THRESHOLD,
    passes:    result.score >= SCORE_THRESHOLD,
  });
  res.headers.set("Cache-Control", "private, no-store");
  return res;
}
