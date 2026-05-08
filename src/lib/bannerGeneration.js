// src/lib/bannerGeneration.js
// Sequential banner generation service with progress tracking and parallel model support

import { callOpenRouter } from "@/lib/openrouter";
import { GenerationJobSteps } from "@/lib/generationQueue";

export { GenerationJobSteps as GenerationSteps };

export async function generateBannerSequentially(
  {
    prompt,
    referenceImageUrl,
    subjectImageUrl,
    aspectRatio,
    models,
    style,
    supabase,
    userId,
  },
  onProgress,
  job
) {
  try {
    // Step 1: Upload and validate images
    if (onProgress) onProgress(GenerationJobSteps.UPLOAD_IMAGES);
    if (job) job.setStep(GenerationJobSteps.UPLOAD_IMAGES);
    
    const refDetails = await validateImageUrl(referenceImageUrl);
    const subDetails = await validateImageUrl(subjectImageUrl);
    
    if (job) {
      job.results.referenceImage = refDetails;
      job.results.subjectImage = subDetails;
    }

    // Step 2: Analyze images in parallel
    if (onProgress) onProgress(GenerationJobSteps.ANALYZE_IMAGES);
    if (job) job.setStep(GenerationJobSteps.ANALYZE_IMAGES);
    
    const [refContext, subContext] = await Promise.all([
      analyzeImage(referenceImageUrl, "reference"),
      analyzeImage(subjectImageUrl, "subject"),
    ]);

    if (job) {
      job.results.referenceContext = refContext;
      job.results.subjectContext = subContext;
    }

    // Step 3: Fetch background image based on prompt and analysis
    if (onProgress) onProgress(GenerationJobSteps.FETCH_BG_IMAGE);
    if (job) job.setStep(GenerationJobSteps.FETCH_BG_IMAGE);
    
    let backgroundImage = null;
    try {
      const category = subContext?.suggestedCategory || extractCategoryFromPrompt(prompt);
      backgroundImage = await fetchBackgroundImage(category, prompt);
      if (job) job.results.backgroundImage = backgroundImage;
    } catch (error) {
      console.warn("Background image fetch failed, continuing:", error);
    }

    // Step 4: Generate banners from all models in parallel
    if (onProgress) onProgress(GenerationJobSteps.GENERATE_MODELS);
    if (job) job.setStep(GenerationJobSteps.GENERATE_MODELS);
    
    if (!models || models.length === 0) {
      throw new Error("No models configured for generation");
    }

    const generationPromises = models.map(modelId =>
      generateFromModel(modelId, {
        prompt,
        referenceContext: refContext,
        subjectContext: subContext,
        aspectRatio,
        backgroundImage,
        style,
      }).catch(err => ({
        error: err.message,
        modelId,
      }))
    );

    const results = await Promise.all(generationPromises);
    const successfulResults = results.filter(r => !r.error);
    
    if (successfulResults.length === 0) {
      throw new Error("All models failed to generate banner");
    }

    if (job) {
      job.results.generatedBanners = successfulResults;
      job.results.modelErrors = results.filter(r => r.error);
    }

    // Step 5: Score and select best
    if (onProgress) onProgress(GenerationJobSteps.SCORE_BANNERS);
    if (job) job.setStep(GenerationJobSteps.SCORE_BANNERS);
    
    const scoredBanners = await Promise.all(
      successfulResults.map(async (banner) => ({
        ...banner,
        score: await scoreBanner(banner),
      }))
    );

    const winner = scoredBanners.reduce((prev, current) =>
      (prev.score > current.score) ? prev : current
    );

    if (job) {
      job.results.winner = winner;
      job.results.allScores = scoredBanners.map(b => ({ modelId: b.modelId, score: b.score }));
    }

    // Step 6: Save to database
    if (onProgress) onProgress(GenerationJobSteps.SAVE_BANNER);
    if (job) job.setStep(GenerationJobSteps.SAVE_BANNER);
    
    const banner = await saveBannerToDb(supabase, userId, {
      ...winner,
      referenceImageUrl,
      subjectImageUrl,
      backgroundImage,
      aspectRatio,
      allVariants: scoredBanners,
    });

    if (job) job.setBanner(banner);

    return {
      success: true,
      banner,
      allBanners: scoredBanners,
      backgroundImage,
    };
  } catch (error) {
    console.error("Banner generation failed:", error);
    if (job) job.setError(error.message);
    throw error;
  }
}

async function validateImageUrl(url) {
  try {
    const response = await fetch(url, { method: "HEAD" });
    if (!response.ok) throw new Error("Image not accessible");
    return {
      url,
      size: response.headers.get("content-length"),
      type: response.headers.get("content-type"),
      valid: true,
    };
  } catch (error) {
    throw new Error(`Invalid image: ${error.message}`);
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
              text: `Analyze this ${type} image and provide:
1. Main subjects/objects visible
2. Color palette (primary, secondary, accent colors)
3. Style/mood (e.g., professional, creative, minimalist, vibrant)
4. Recommended text positioning
5. Suggested design elements
6. Category for background (e.g., tech, nature, business, abstract)

Respond in JSON format: { subjects: [], colors: [], style: "", positioning: "", elements: [], suggestedCategory: "" }`,
            },
          ],
        },
      ],
    });

    const content = response.choices[0].message.content;
    try {
      return JSON.parse(content);
    } catch {
      return { raw: content, suggestedCategory: "general" };
    }
  } catch (error) {
    console.warn(`Failed to analyze ${type} image:`, error);
    return { error: error.message, suggestedCategory: "general" };
  }
}

function extractCategoryFromPrompt(prompt) {
  const categories = {
    tech: /tech|software|app|digital|computer|ai|data/i,
    nature: /nature|outdoor|green|landscape|forest|mountain/i,
    business: /business|corporate|professional|office|finance|commerce/i,
    creative: /creative|art|design|abstract|illustration/i,
    food: /food|restaurant|chef|cooking|culinary|recipe/i,
    health: /health|medical|wellness|fitness|exercise/i,
  };

  for (const [cat, regex] of Object.entries(categories)) {
    if (regex.test(prompt)) return cat;
  }
  return "general";
}

async function fetchBackgroundImage(category, query) {
  try {
    const response = await fetch("/api/bg-images/fetch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category, query }),
    });

    if (!response.ok) {
      throw new Error("Background fetch failed");
    }

    return await response.json();
  } catch (error) {
    console.warn("Background image fetch error:", error);
    return null;
  }
}

async function generateFromModel(modelId, context) {
  try {
    const response = await callOpenRouter({
      model: modelId,
      messages: [
        {
          role: "user",
          content: `Generate an HTML/CSS banner based on these requirements:
          
Prompt: ${context.prompt}
Reference Analysis: ${JSON.stringify(context.referenceContext)}
Subject Analysis: ${JSON.stringify(context.subjectContext)}
Aspect Ratio: ${context.aspectRatio}
Style: ${context.style}
Background: ${context.backgroundImage ? "Available" : "Not available"}

Generate complete HTML and CSS for the banner. Return JSON:
{
  "html": "<div>...</div>",
  "css": "/* styles */",
  "fields": [{ id, type, cssVar, label, value }],
  "modelId": "${modelId}"
}`,
        },
      ],
    });

    const content = response.choices[0].message.content;
    try {
      return JSON.parse(content);
    } catch {
      throw new Error("Invalid JSON response from model");
    }
  } catch (error) {
    throw new Error(`Model ${modelId} failed: ${error.message}`);
  }
}

async function scoreBanner(banner) {
  try {
    const response = await callOpenRouter({
      model: "openrouter/auto",
      messages: [
        {
          role: "user",
          content: `Score this banner on a scale of 1-100 based on design quality, readability, and effectiveness:
HTML: ${banner.html}
CSS: ${banner.css}

Return JSON: { score: number (1-100) }`,
        },
      ],
    });

    const content = response.choices[0].message.content;
    try {
      const result = JSON.parse(content);
      return Math.min(100, Math.max(1, result.score || 75));
    } catch {
      return 75;
    }
  } catch (error) {
    console.warn("Banner scoring failed:", error);
    return 75;
  }
}

async function saveBannerToDb(supabase, userId, bannerData) {
  try {
    const { data, error } = await supabase
      .from("banners")
      .insert([{
        user_id: userId,
        title: "Generated Banner",
        html: bannerData.html,
        css: bannerData.css,
        fields: bannerData.fields || [],
        canvas: {
          background: bannerData.backgroundImage,
          elements: [],
        },
        reference_image_url: bannerData.referenceImageUrl,
        subject_image_url: bannerData.subjectImageUrl,
        score: bannerData.score || 75,
        created_at: new Date().toISOString(),
      }])
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error("Failed to save banner to DB:", error);
    throw new Error(`Database save failed: ${error.message}`);
  }
}
