// src/lib/bgQuery.js
// Generate a clean, vendor-friendly search query for stock-photo APIs
// (Unsplash, Pexels, Pixabay) from the user's brief plus any extracted
// reference / subject vision context. The vendors return the best
// results when given 1-3 noun phrases — they don't understand long
// marketing copy — so we delegate that condensation to a small LLM
// call and fall back to a heuristic when the model isn't reachable.

import { callOpenRouter, extractJson } from "@/lib/openrouter";
import { getDefaultTextModelWithSecrets } from "@/lib/db/models";
import { pickApiKey, pickEndpoint } from "@/lib/bannerTemplate";

const SYSTEM_PROMPT = `You translate marketing briefs into a stock-photo search query. The query will be sent verbatim to Unsplash / Pexels / Pixabay search APIs.

Rules:
- 1 to 3 short noun phrases, total length under 60 characters
- Concrete objects and scenes only (e.g. "mountain sunrise", "modern office desk")
- NO marketing words ("launch", "new", "best", "premium")
- NO brand names, NO people's names
- Pick a single category from: tech, food, travel, fashion, fitness, business, nature, art, lifestyle, product, abstract, other

Return ONLY a JSON object: { "query": string, "category": string }.`;

function fallbackQuery({ brief, referenceContext, subjectContext }) {
  const candidates = [
    referenceContext?.subject,
    subjectContext?.shortDescription,
    referenceContext?.subjectsToFeature?.slice(0, 2)?.join(" "),
    String(brief || "").split(/[.,;\n]/)[0] || brief,
  ]
    .map((s) => String(s || "").trim())
    .filter(Boolean);
  const query = (candidates[0] || "abstract background").slice(0, 60);

  const buckets = {
    tech: /\b(tech|software|app|ai|digital|saas|cloud|data|cyber)\b/i,
    food: /\b(food|restaurant|cafe|menu|recipe|cuisine|drink)\b/i,
    travel: /\b(travel|tour|destination|vacation|holiday|trip)\b/i,
    fashion: /\b(fashion|clothing|apparel|style|outfit|wear|dress)\b/i,
    fitness: /\b(fitness|gym|workout|yoga|running|sport)\b/i,
    business: /\b(business|corporate|finance|office|enterprise|startup)\b/i,
    nature: /\b(nature|forest|mountain|ocean|landscape|wildlife)\b/i,
    art: /\b(art|gallery|exhibit|design|creative|illustration)\b/i,
    product: /\b(product|launch|release|announcement|preview)\b/i,
  };
  let category = "abstract";
  const haystack = `${brief || ""} ${referenceContext?.subject || ""} ${subjectContext?.shortDescription || ""}`;
  for (const [cat, re] of Object.entries(buckets)) {
    if (re.test(haystack)) { category = cat; break; }
  }
  return { query, category };
}

// Returns { query, category } regardless of whether the model call
// succeeded — caller can hand the result straight to the provider
// search functions.
export async function buildBackgroundQuery({
  adminClient,
  brief,
  referenceContext,
  subjectContext,
}) {
  const fallback = fallbackQuery({ brief, referenceContext, subjectContext });

  let model;
  try { model = await getDefaultTextModelWithSecrets(adminClient); } catch { model = null; }
  if (!model) return fallback;

  const apiKey = pickApiKey(model);
  const endpoint = pickEndpoint(model);
  if (!apiKey) return fallback;
  if (!endpoint && model.provider !== "openrouter") return fallback;

  const userMsg = [
    `BRIEF: ${String(brief || "").slice(0, 600)}`,
    referenceContext?.subject ? `REFERENCE SUBJECT: ${referenceContext.subject}` : "",
    referenceContext?.category ? `REFERENCE CATEGORY: ${referenceContext.category}` : "",
    referenceContext?.mood?.length ? `MOOD: ${referenceContext.mood.join(", ")}` : "",
    subjectContext?.subjectType ? `SUBJECT TYPE: ${subjectContext.subjectType}` : "",
    subjectContext?.shortDescription ? `SUBJECT: ${subjectContext.shortDescription}` : "",
    "Return ONLY {\"query\": string, \"category\": string}.",
  ].filter(Boolean).join("\n");

  try {
    const { content } = await callOpenRouter({
      apiKey,
      endpoint: endpoint || undefined,
      model: model.modelId,
      jsonMode: true,
      temperature: 0.1,
      maxTokens: 120,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userMsg },
      ],
    });
    const parsed = extractJson(content);
    const query = typeof parsed?.query === "string" ? parsed.query.trim().slice(0, 60) : "";
    const category = typeof parsed?.category === "string" ? parsed.category.trim().toLowerCase().slice(0, 30) : "";
    if (!query) return fallback;
    return { query, category: category || fallback.category };
  } catch {
    return fallback;
  }
}
