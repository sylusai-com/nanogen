// src/app/api/admin/models/stages/route.js
//
// Admin-only endpoint for managing per-stage model assignments in the
// banner generation pipeline.
//
// GET  — returns all workflow stages with their current model assignments
//        and the list of available text models.
// PUT  — sets or clears a stage's model assignment.
//
// Auth: cookie-bound server client → admin role verified from `profiles`.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  readJson,
  originAllowed,
  rateLimit,
  clientKey,
  ValidationError,
  errorResponse
} from "@/lib/server/security";
import {
  WORKFLOW_STAGES,
  getAllStageAssignments,
  setStageModel,
  clearStageModel,
} from "@/lib/db/stageModels";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.role !== "admin") {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { user };
}

export async function GET() {
  try {
    const gate = await requireAdmin();
    if (gate.error) return gate.error;

    const adminDb = createAdminClient();

    // Load stage assignments + available text models in parallel.
    const [assignments, modelsResult] = await Promise.all([
      getAllStageAssignments(adminDb),
      adminDb
        .from("models")
        .select("id, slug, label, kind, provider, model_id, enabled")
        .eq("kind", "text")
        .eq("enabled", true)
        .order("is_default", { ascending: false })
        .order("sort_order", { ascending: true })
        .then(({ data, error }) => {
          if (error) return [];
          return (data || []).map((m) => ({
            id: m.id,
            slug: m.slug,
            label: m.label,
            provider: m.provider,
            modelId: m.model_id,
          }));
        }),
    ]);

    // Load default model info for display.
    let defaultModel = null;
    try {
      const { data } = await adminDb
        .from("models")
        .select("id, slug, label, provider, model_id")
        .eq("kind", "text")
        .eq("enabled", true)
        .eq("is_default", true)
        .maybeSingle();
      if (data) {
        defaultModel = {
          id: data.id,
          slug: data.slug,
          label: data.label,
          provider: data.provider,
          modelId: data.model_id,
        };
      }
    } catch {
      // Best effort.
    }

    const res = NextResponse.json({
      stages: assignments,
      availableModels: modelsResult,
      defaultModel,
    });
    res.headers.set("Cache-Control", "private, no-store");
    return res;
  } catch (e) {
    return errorResponse(e);
  }
}

const VALID_STAGE_IDS = new Set(Object.keys(WORKFLOW_STAGES));
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function PUT(req) {
  try {
    // 1. CSRF check
    if (!originAllowed(req)) {
      throw new ValidationError("CSRF block: Origin or referer not allowed", 403);
    }

    const gate = await requireAdmin();
    if (gate.error) return gate.error;
    const { user } = gate;

    // 2. Rate Limit (60 requests per minute)
    const key = clientKey(req, user.id);
    const { ok, retryAfter } = rateLimit({ key: `admin-stages-put:${key}`, max: 60, windowMs: 60_000 });
    if (!ok) {
      return NextResponse.json({ error: `Too many requests. Retry after ${retryAfter} seconds.` }, { status: 429 });
    }

    // 3. Capped JSON parse (max 16 KB for stage models config update)
    const body = await readJson(req, { maxBytes: 16 * 1024 });

    const { stageId, modelId } = body;

    if (!stageId || typeof stageId !== "string" || !VALID_STAGE_IDS.has(stageId)) {
      throw new ValidationError(`Invalid stageId. Valid stages: ${[...VALID_STAGE_IDS].join(", ")}`, 400);
    }

    const adminDb = createAdminClient();

    if (modelId === null || modelId === "") {
      // Clear the override — revert to default.
      await clearStageModel(adminDb, stageId);
    } else {
      if (typeof modelId !== "string" || !UUID_RE.test(modelId)) {
        throw new ValidationError("Invalid modelId (expected UUID)", 400);
      }
      // Verify the model exists and is enabled.
      const { data: model } = await adminDb
        .from("models")
        .select("id, label, enabled")
        .eq("id", modelId)
        .maybeSingle();
      if (!model) {
        throw new ValidationError("Model not found", 404);
      }
      if (!model.enabled) {
        throw new ValidationError("Model is disabled", 400);
      }
      await setStageModel(adminDb, stageId, modelId, gate.user.id);
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
