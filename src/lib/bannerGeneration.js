// src/lib/bannerGeneration.js
// Sequential banner generation service with progress tracking

import { callOpenRouter } from "@/lib/openrouter";

const GenerationSteps = {
  ANALYZE_REFERENCE: { id: 1, name: "analyze_reference", label: "Analyzing reference image", progress: 15 },
  ANALYZE_SUBJECT: { id: 2, name: "analyze_subject", label: "Analyzing subject image", progress: 30 },
  GENERATE_TEMPLATE: { id: 3, name: "generate_template", label: "Generating banner template", progress: 60 },
  FETCH_BACKGROUND: { id: 4, name: "fetch_background", label: "Fetching background image", progress: 75 },
  SCORE_BANNER: { id: 5, name: "score_banner", label: "Scoring banner quality", progress: 90 },
  SAVE: { id: 6, name: "save", label: "Saving banner", progress: 100 },
};

export { GenerationSteps };

export async function generateBannerSequentially(
  {
    prompt,
    referenceImageUrl,
    subjectImageUrl,
    aspectRatio,
    model,
    style,
    supabase,
    userId,
  },
  onProgress
) {
  const steps = [];

  try {
    // Step 1: Analyze reference image
    onProgress(GenerationSteps.ANALYZE_REFERENCE);
    steps.push("reference_analysis");
    const referenceContext = await analyzeImage(referenceImageUrl, "reference image");

    // Step 2: Analyze subject image
    onProgress(GenerationSteps.ANALYZE_SUBJECT);
    steps.push("subject_analysis");
    const subjectContext = await analyzeImage(subjectImageUrl, "subject image");

    // Step 3: Generate template
    onProgress(GenerationSteps.GENERATE_TEMPLATE);
    steps.push("template_generation");
    const templateResult = await generateBannerTemplate({
      prompt,
      referenceContext,
      subjectContext,
      aspectRatio,
      model,
      style,
    });

    // Step 4: Fetch background if configured
    let backgroundImage = null;
    try {
      onProgress(GenerationSteps.FETCH_BACKGROUND);
      steps.push("background_fetch");
      
      // Extract category from template or use default
      const category = templateResult.suggestedCategory || "banner background";
      const bgResponse = await fetch("/api/bg-images/fetch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category }),
      });

      if (bgResponse.ok) {
        backgroundImage = await bgResponse.json();
      }
    } catch (error) {
      console.warn("Background image fetch failed, continuing:", error);
    }

    // Step 5: Score banner
    onProgress(GenerationSteps.SCORE_BANNER);
    steps.push("scoring");
    const score = await scoreBanner({
      html: templateResult.html,
      css: templateResult.css,
      model,
    });

    // Step 6: Save banner
    onProgress(GenerationSteps.SAVE);
    steps.push("save");
    const banner = await saveBannerToDb(supabase, userId, {
      ...templateResult,
      background: backgroundImage,
      score,
      referenceImageUrl,
      subjectImageUrl,
      aspectRatio,
      model,
      style,
    });

    return { success: true, banner, steps };
  } catch (error) {
    console.error("Banner generation failed:", error);
    throw new Error(`Banner generation failed at step: ${steps[steps.length - 1] || "init"}. ${error.message}`);
  }
}

async function analyzeImage(imageUrl, type) {
  try {
    const response = await callOpenRouter({
      model: "openrouter/auto",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              image: imageUrl,
            },
            {
              type: "text",
              text: `Analyze this ${type} and provide:
1. Main subjects/objects visible
2. Color palette (primary, secondary, accent colors)
3. Style/mood (e.g., professional, creative, minimalist, vibrant)
4. Recommended text positioning and alignment
5. Suggested design elements

Respond in JSON format: { subjects: [], colors: [], style: "", positioning: "", elements: [] }`,
            },
          ],
        },
      ],
    });

    const content = response.choices[0].message.content;
    try {
      return JSON.parse(content);
    } catch {
      return { raw: content };
    }
  } catch (error) {
    console.warn(`Failed to analyze ${type}:`, error);
    return { error: error.message };
  }
}

async function generateBannerTemplate({ prompt, referenceContext, subjectContext, aspectRatio, model, style }) {
  const response = await callOpenRouter({
    model: model || "openrouter/auto",
    messages: [
      {
        role: "user",
        content: `Generate an HTML/CSS banner based on these requirements:
Prompt: ${prompt}
Reference Analysis: ${JSON.stringify(referenceContext)}
Subject Analysis: ${JSON.stringify(subjectContext)}
Aspect Ratio: ${aspectRatio}
Style: ${style}

Generate complete HTML and CSS for the banner. Return JSON:
{
  "html": "<div>...</div>",
  "css": "/* styles */",
  "fields": [{ id, type, cssVar, label, value }],
  "suggestedCategory": "category for background image"
}`,
      },
    ],
  });

  const content = response.choices[0].message.content;
  try {
    return JSON.parse(content);
  } catch {
    throw new Error("Failed to parse banner template response");
  }
}

async function scoreBanner({ html, css, model }) {
  try {
    const response = await callOpenRouter({
      model: model || "openrouter/auto",
      messages: [
        {
          role: "user",
          content: `Score this banner on a scale of 1-100 based on design quality, readability, and effectiveness:
HTML: ${html}
CSS: ${css}

Return JSON: { score: number, reasoning: string, recommendations: string[] }`,
        },
      ],
    });

    const content = response.choices[0].message.content;
    try {
      const result = JSON.parse(content);
      return result.score || 75;
    } catch {
      return 75; // Default score if parsing fails
    }
  } catch (error) {
    console.warn("Banner scoring failed:", error);
    return 75;
  }
}

async function saveBannerToDb(supabase, userId, bannerData) {
  // This should integrate with existing saveBanner function
  // For now, return mock data structure
  return {
    id: `banner_${Date.now()}`,
    user_id: userId,
    title: bannerData.title || "Generated Banner",
    html: bannerData.html,
    css: bannerData.css,
    fields: bannerData.fields || [],
    canvas: {
      background: bannerData.background,
      elements: [],
    },
    reference_image_url: bannerData.referenceImageUrl,
    subject_image_url: bannerData.subjectImageUrl,
    score: bannerData.score,
    created_at: new Date().toISOString(),
  };
}
