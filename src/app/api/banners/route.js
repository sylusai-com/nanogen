// src/app/api/banners/route.js
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  bgFromTemplate,
  deriveTitle,
  generateBannerTemplate,
} from "@/lib/bannerTemplate";
import { scoreBannerTemplate } from "@/lib/scoreBanner";
import { SCORE_THRESHOLD } from "@/lib/models";
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

const VARIANT_COUNT = 3;
const ALLOWED_ASPECTS = ["1:1", "4:5", "9:16", "16:9"];

// Generate an HTML banner from a prompt, score N variants, and persist the
// winner. The winner is the highest-scoring variant whose score is
// >= SCORE_THRESHOLD; if no variant passes the threshold, the absolute top
// scorer is selected so the user always gets a banner back.
//
// Used by /dashboard/create. The user is then redirected to the editor.
export async function POST(req) {
  // CSRF: only accept same-origin browser requests.
  if (!originAllowed(req)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Rate limit per signed-in user. Banner generation is expensive
  // (3 model calls + 3 score calls per request). 12 / 5 minutes is
  // generous for normal use, lethal for abuse.
  const rl = rateLimit({
    key:      clientKey(req, user.id),
    max:      12,
    windowMs: 5 * 60_000,
  });
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many requests. Try again shortly." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } },
    );
  }

  let body;
  try { body = await readJson(req, { maxBytes: 16 * 1024 }); }
  catch (e) { return errorResponse(e); }

  let prompt, style, aspect;
  try {
    prompt = validateString(body.prompt, {
      name: "prompt",
      min: 3,
      max: 4000,
      required: true,
    });
    // Style and aspect are free-form labels but capped to keep the model
    // request body bounded.
    style  = validateString(body.style, { name: "style", max: 60 }) || "Modern";
    aspect = validateEnum(body.aspect, ALLOWED_ASPECTS, { name: "aspect" }) || "16:9";
  } catch (e) { return errorResponse(e); }

  // 1. Generate N variants in parallel — each gets a different archetype
  //    seed so the model is nudged toward different layouts.
  const variants = await Promise.all(
    Array.from({ length: VARIANT_COUNT }, (_, i) =>
      generateBannerTemplate({
        supabase,
        prompt,
        style,
        aspect,
        variantSeed: i,
      }),
    ),
  );

  // 2. Score each variant in parallel.
  const scored = await Promise.all(
    variants.map(async (t) => {
      const s = await scoreBannerTemplate({
        supabase,
        prompt,
        style,
        aspect,
        html: t.html || "",
        css:  t.css  || "",
      });
      return { template: t, score: s.score, scoreSource: s.source, scoreReason: s.reason };
    }),
  );

  // 3. Pick winner: top score >= threshold, else absolute top scorer.
  const ranked  = [...scored].sort((a, b) => b.score - a.score);
  const passing = ranked.filter((v) => v.score >= SCORE_THRESHOLD);
  const winner  = passing[0] || ranked[0];

  if (!winner) {
    return NextResponse.json(
      { error: "Failed to generate any banner variants." },
      { status: 500 },
    );
  }

  const template = winner.template;
  const passedThreshold = winner.score >= SCORE_THRESHOLD;

  // 4. Persist the winner.
  const bg       = bgFromTemplate(template);
  const headline = template.fields.find((f) => f.id === "headline");
  const title = headline?.value
    ? headline.value.length > 60
      ? headline.value.slice(0, 60) + "…"
      : headline.value
    : deriveTitle(prompt);

  const { data: banner, error } = await supabase
    .from("banners")
    .insert({
      user_id:          user.id,
      title,
      prompt,
      style,
      aspect,
      model_id:         template.modelId || null,
      model_label:      template.generator || "fallback",
      preview_gradient: template.styleRow?.gradient || null,
      score:            winner.score,
      html:             template.html,
      css:              template.css,
      fields:           template.fields,
      alignment:        template.alignment,
      canvas:           { background: bg, elements: [] },
    })
    .select("id, title, model_label")
    .single();

  if (error) {
    return NextResponse.json(
      { error: `Failed to save banner: ${error.message}` },
      { status: 500 },
    );
  }

  return NextResponse.json({
    banner,
    generator: template.generator,
    // Surface the fallback reason when the generator fell back so admin
    // can fix configuration. Null when a real model produced the banner.
    reason:    template.reason || null,
    score:     winner.score,
    threshold: SCORE_THRESHOLD,
    passedThreshold,
    scoring: {
      source: winner.scoreSource,
      reason: winner.scoreReason,
    },
    variants: scored.map((v) => ({
      score:     v.score,
      generator: v.template.generator,
      modelId:   v.template.modelId || null,
    })),
  });
}
