// src/lib/db/stageModels.js
//
// Resolves which AI model to use for each stage of the banner-generation
// pipeline. Stage overrides are stored in the `app_settings` table as
// key-value pairs with key pattern `workflow_stage_model:<stage_id>` and
// value = the model's UUID from the `models` table.
//
// When no override is set for a stage, the resolver falls back to
// `getDefaultTextModelWithSecrets()` — the same behavior the pipeline
// had before multi-model support was introduced. This makes the feature
// fully backward-compatible: zero-config deployments keep working
// unchanged.

import { getDefaultTextModelWithSecrets } from "@/lib/db/models";
import { pickApiKey } from "@/lib/bannerTemplate";

// ─────────────────────────────────────────────────────────────────────────
// Stage registry — single source of truth for all pipeline stages.
// Adding a new stage is just adding a row here; the admin UI and the
// resolver pick it up automatically.
// ─────────────────────────────────────────────────────────────────────────

export const WORKFLOW_STAGES = {
  reference_analysis: {
    id: "reference_analysis",
    label: "Reference Image Analysis",
    description: "Extracts palette, mood, motifs from the reference image (vision model).",
    tier: "lightweight",
    requiresVision: true,
  },
  subject_analysis: {
    id: "subject_analysis",
    label: "Subject Image Analysis",
    description: "Classifies subject type, framing, placement from the subject image (vision model).",
    tier: "lightweight",
    requiresVision: true,
  },
  prompt_enhancement: {
    id: "prompt_enhancement",
    label: "Prompt Enhancement",
    description: "Rewrites the user's brief with composition guidance and placement decisions.",
    tier: "standard",
    requiresVision: false,
  },
  bg_query: {
    id: "bg_query",
    label: "Background Query Builder",
    description: "Generates a stock-photo search query (~120 output tokens).",
    tier: "lightweight",
    requiresVision: false,
  },
  category_detection: {
    id: "category_detection",
    label: "Category & Style Detection",
    description: "Classifies the winning banner's category, theme, style, and mood.",
    tier: "lightweight",
    requiresVision: false,
  },
  banner_scoring: {
    id: "banner_scoring",
    label: "Banner Scoring",
    description: "Evaluates generated banners with a structured rubric (0–100).",
    tier: "standard",
    requiresVision: false,
  },
};

// Ordered list for the admin UI.
export const WORKFLOW_STAGE_LIST = Object.values(WORKFLOW_STAGES);

const SETTINGS_KEY_PREFIX = "workflow_stage_model:";

// ─────────────────────────────────────────────────────────────────────────
// Reads — server-only. Callers must pass the admin (service-role) client.
// ─────────────────────────────────────────────────────────────────────────

const ADMIN_COLUMNS = `
  id,
  slug,
  label,
  kind,
  provider,
  modelId:model_id,
  enabled,
  isDefault:is_default,
  sortOrder:sort_order,
  previewGradient:preview_gradient,
  config,
  createdAt:created_at,
  updatedAt:updated_at
`;

/**
 * Resolve the model for a single pipeline stage.
 *
 * Resolution order:
 *   1. Check app_settings for `workflow_stage_model:<stageId>` → model UUID
 *   2. If found: load the model row (with secrets). If it's enabled + has
 *      an API key → return it.
 *   3. Else → fall back to `getDefaultTextModelWithSecrets()`.
 */
export async function getModelForStage(adminClient, stageId) {
  if (!WORKFLOW_STAGES[stageId]) {
    // Unknown stage — fall back to default.
    return getDefaultTextModelWithSecrets(adminClient);
  }

  try {
    const { data: setting } = await adminClient
      .from("app_settings")
      .select("value")
      .eq("key", `${SETTINGS_KEY_PREFIX}${stageId}`)
      .maybeSingle();

    if (setting?.value) {
      const modelId = setting.value.trim();
      if (modelId) {
        const { data: model } = await adminClient
          .from("models")
          .select(ADMIN_COLUMNS)
          .eq("id", modelId)
          .eq("enabled", true)
          .maybeSingle();

        if (model && pickApiKey(model)) {
          return model;
        }
        // Model not found / disabled / no key → fall through to default.
      }
    }
  } catch {
    // Settings table may not exist on older installs — fall back silently.
  }

  return getDefaultTextModelWithSecrets(adminClient);
}

/**
 * Pre-fetch all stage model assignments in bulk. Returns a Map<stageId, model>
 * that can be passed to pipeline stages instead of hitting the DB per-stage.
 *
 * This is the recommended path for the /api/banners route: call once at the
 * start, then pass the resolved models into each stage function. Saves ~5 DB
 * round-trips per generation request.
 */
export async function prefetchStageModels(adminClient) {
  const resolved = new Map();

  // Load default model once.
  const defaultModel = await getDefaultTextModelWithSecrets(adminClient).catch(() => null);

  // Bulk-load all stage settings in one query.
  let settingsRows = [];
  try {
    const keys = Object.keys(WORKFLOW_STAGES).map((s) => `${SETTINGS_KEY_PREFIX}${s}`);
    const { data } = await adminClient
      .from("app_settings")
      .select("key, value")
      .in("key", keys);
    settingsRows = data || [];
  } catch {
    // Fall back: every stage uses the default model.
    for (const stageId of Object.keys(WORKFLOW_STAGES)) {
      resolved.set(stageId, defaultModel);
    }
    return resolved;
  }

  // Build a set of referenced model UUIDs to load in one shot.
  const modelUUIDs = new Set();
  const stageToModelId = {};
  for (const row of settingsRows) {
    const stageId = row.key.replace(SETTINGS_KEY_PREFIX, "");
    const modelId = (row.value || "").trim();
    if (modelId) {
      stageToModelId[stageId] = modelId;
      modelUUIDs.add(modelId);
    }
  }

  // Bulk-load the referenced models.
  let modelsMap = {};
  if (modelUUIDs.size > 0) {
    try {
      const { data: models } = await adminClient
        .from("models")
        .select(ADMIN_COLUMNS)
        .in("id", [...modelUUIDs])
        .eq("enabled", true);
      for (const m of models || []) {
        modelsMap[m.id] = m;
      }
    } catch {
      // Ignore — stages will use default.
    }
  }

  // Resolve each stage.
  for (const stageId of Object.keys(WORKFLOW_STAGES)) {
    const assignedId = stageToModelId[stageId];
    const assignedModel = assignedId ? modelsMap[assignedId] : null;
    if (assignedModel && pickApiKey(assignedModel)) {
      resolved.set(stageId, assignedModel);
    } else {
      resolved.set(stageId, defaultModel);
    }
  }

  return resolved;
}

/**
 * Get all stage assignments for the admin UI.
 * Returns an array of { stage, model } objects.
 * `model` is null when using the default.
 */
export async function getAllStageAssignments(adminClient) {
  const keys = Object.keys(WORKFLOW_STAGES).map((s) => `${SETTINGS_KEY_PREFIX}${s}`);
  let settingsRows = [];
  try {
    const { data } = await adminClient
      .from("app_settings")
      .select("key, value")
      .in("key", keys);
    settingsRows = data || [];
  } catch {
    settingsRows = [];
  }

  // Build stageId → modelId map.
  const stageToModelId = {};
  for (const row of settingsRows) {
    const stageId = row.key.replace(SETTINGS_KEY_PREFIX, "");
    const modelId = (row.value || "").trim();
    if (modelId) stageToModelId[stageId] = modelId;
  }

  // Load referenced models (public shape — no secrets for admin UI).
  const modelUUIDs = [...new Set(Object.values(stageToModelId))];
  let modelsMap = {};
  if (modelUUIDs.length > 0) {
    try {
      const { data: models } = await adminClient
        .from("models")
        .select("id, slug, label, kind, provider, model_id, enabled")
        .in("id", modelUUIDs);
      for (const m of models || []) {
        modelsMap[m.id] = {
          id: m.id,
          slug: m.slug,
          label: m.label,
          provider: m.provider,
          modelId: m.model_id,
          enabled: m.enabled,
        };
      }
    } catch {
      // Ignore.
    }
  }

  return WORKFLOW_STAGE_LIST.map((stage) => ({
    stage: {
      id: stage.id,
      label: stage.label,
      description: stage.description,
      tier: stage.tier,
      requiresVision: stage.requiresVision,
    },
    modelId: stageToModelId[stage.id] || null,
    model: stageToModelId[stage.id] ? (modelsMap[stageToModelId[stage.id]] || null) : null,
  }));
}

// ─────────────────────────────────────────────────────────────────────────
// Writes — admin-only. RLS on app_settings enforces admin role.
// ─────────────────────────────────────────────────────────────────────────

/**
 * Assign a model to a workflow stage.
 */
export async function setStageModel(adminClient, stageId, modelId, updatedBy = null) {
  if (!WORKFLOW_STAGES[stageId]) {
    throw new Error(`Unknown workflow stage: ${stageId}`);
  }
  if (!modelId) {
    throw new Error("modelId is required — use clearStageModel() to remove an override");
  }

  const key = `${SETTINGS_KEY_PREFIX}${stageId}`;
  const row = {
    key,
    value: modelId,
    description: `Model override for pipeline stage: ${WORKFLOW_STAGES[stageId].label}`,
    ...(updatedBy ? { updated_by: updatedBy } : {}),
  };
  const { error } = await adminClient
    .from("app_settings")
    .upsert(row, { onConflict: "key" });
  if (error) throw error;
}

/**
 * Clear a stage's model override (revert to default).
 */
export async function clearStageModel(adminClient, stageId) {
  if (!WORKFLOW_STAGES[stageId]) {
    throw new Error(`Unknown workflow stage: ${stageId}`);
  }

  const key = `${SETTINGS_KEY_PREFIX}${stageId}`;
  const { error } = await adminClient
    .from("app_settings")
    .delete()
    .eq("key", key);
  if (error) throw error;
}
