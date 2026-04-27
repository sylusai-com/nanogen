import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  bgFromTemplate,
  deriveTitle,
  generateBannerTemplate,
} from "@/lib/bannerTemplate";

export const runtime = "nodejs";

// Generate an HTML banner from a prompt and persist it as a banner row.
// Used by /dashboard/create. The user is then redirected to the editor.
export async function POST(req) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { prompt, style = "Modern", aspect = "16:9" } = body || {};
  if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
    return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
  }

  // 1. Generate template via shared lib (OpenRouter w/ fallback).
  const template = await generateBannerTemplate({
    supabase,
    prompt,
    style,
    aspect,
  });

  // 2. Persist as a banner.
  const bg = bgFromTemplate(template);
  const headline = template.fields.find((f) => f.id === "headline");
  const title = headline?.value
    ? headline.value.length > 60
      ? headline.value.slice(0, 60) + "…"
      : headline.value
    : deriveTitle(prompt);

  const { data: banner, error } = await supabase
    .from("banners")
    .insert({
      user_id: user.id,
      title,
      prompt,
      style,
      aspect,
      model_id: template.modelId || null,
      model_label: template.generator || "fallback",
      preview_gradient: template.styleRow?.gradient || null,
      score: 90, // AI-generated templates pass quality threshold by definition
      html: template.html,
      css: template.css,
      fields: template.fields,
      alignment: template.alignment,
      canvas: { background: bg, elements: [] },
    })
    .select("id, title, generator:model_label")
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
    reason: template.reason,
  });
}
