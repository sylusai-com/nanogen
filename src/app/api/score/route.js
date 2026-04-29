// src/app/api/score/route.js
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { scoreBannerImage, scoreBannerTemplate } from "@/lib/scoreBanner";
import { SCORE_THRESHOLD } from "@/lib/models";

export const runtime = "nodejs";

// Banner scoring endpoint. Accepts either:
//
//   { imageUrl, prompt? }                         → vision-model scoring
//   { html, css, prompt?, style?, aspect? }       → text-model design critique
//
// Returns:
//
//   { score, source, breakdown?, reason?, threshold, passes }
//
// The scoring model is the same admin-configured default text model used
// for banner generation — admins manage the API key + endpoint per row in
// /admin/models. When no model is configured (or the call fails), a
// heuristic score derived from element density + CSS technique coverage
// is returned so the endpoint always works.
export async function POST(req) {
  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { imageUrl, html, css, prompt = "", style = "", aspect = "" } = body || {};

  if (!imageUrl && !html) {
    return NextResponse.json(
      { error: "Provide either { imageUrl } or { html, css }." },
      { status: 400 },
    );
  }

  const supabase = await createClient();

  const result = imageUrl
    ? await scoreBannerImage({ supabase, prompt, imageUrl })
    : await scoreBannerTemplate({ supabase, prompt, style, aspect, html, css: css || "" });

  return NextResponse.json({
    ...result,
    threshold: SCORE_THRESHOLD,
    passes:    result.score >= SCORE_THRESHOLD,
  });
}
