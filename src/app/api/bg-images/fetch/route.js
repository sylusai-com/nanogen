// src/app/api/bg-images/fetch/route.js
// Fetch background images from configured providers

import { NextResponse } from "next/server";
import { originAllowed, requireAuthenticatedUser } from "@/lib/server/security";
import { listBgImageProviders, fetchBgImageFromProvider } from "@/lib/db/bgImageProviders";
import { urlToBase64 } from "@/lib/imageGen";

export async function POST(req) {
  try {
    if (!originAllowed(req)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const gate = await requireAuthenticatedUser();
    if (gate.error) return gate.error;

    const { supabase } = gate;
    const { category, query, provider_type } = await req.json();

    if (!category && !query) {
      return Response.json({ error: "Must provide category or query" }, { status: 400 });
    }

    // Get enabled providers
    const providers = await listBgImageProviders(supabase);
    if (providers.length === 0) {
      return Response.json({ error: "No background image providers configured" }, { status: 400 });
    }

    // Filter by type if specified
    let targetProviders = providers;
    if (provider_type) {
      targetProviders = providers.filter((p) => p.type === provider_type);
      if (targetProviders.length === 0) {
        return Response.json({ error: `Provider type '${provider_type}' not found` }, { status: 404 });
      }
    }

    // Try each provider until one succeeds
    let lastError;
    for (const provider of targetProviders) {
      try {
        const imageData = await fetchBgImageFromProvider(provider, category, query);
        
        // Convert to base64 if needed
        let base64Data = imageData.url;
        if (imageData.url.startsWith("http")) {
          base64Data = await urlToBase64(imageData.url);
        }

        return Response.json({
          url: imageData.url,
          base64: base64Data,
          credit: imageData.credit,
          source: imageData.source,
          provider_name: provider.name,
        });
      } catch (error) {
        lastError = error;
        continue; // Try next provider
      }
    }

    throw lastError || new Error("All providers failed");
  } catch (error) {
    console.error("Error fetching background image:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
