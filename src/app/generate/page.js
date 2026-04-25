"use client";

import { useState } from "react";
import { AlertCircle } from "lucide-react";
import Container from "@/components/ui/Container";
import Eyebrow from "@/components/ui/Eyebrow";
import PromptForm from "@/components/generate/PromptForm";
import ResultsPanel from "@/components/generate/ResultsPanel";

export default function GeneratePage() {
  const [status, setStatus] = useState("idle"); // idle | generating | done | error
  const [results, setResults] = useState([]);
  const [winnerId, setWinnerId] = useState(null);
  const [aspect, setAspect] = useState("16:9");
  const [error, setError] = useState(null);

  const handleSubmit = async (payload) => {
    setStatus("generating");
    setResults([]);
    setWinnerId(null);
    setError(null);
    setAspect(payload.aspect);

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      const data = await res.json();
      setResults(data.results || []);
      setWinnerId(data.winnerId || null);
      setStatus("done");
    } catch (e) {
      setError(e.message || "Something went wrong");
      setStatus("error");
    }
  };

  return (
    <div className="relative">
      <div className="absolute inset-x-0 top-0 h-72 bg-ambient pointer-events-none" />
      <Container className="relative py-12 md:py-16">
        <header className="mb-10 max-w-2xl">
          <Eyebrow tone="primary">Generation studio</Eyebrow>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight md:text-[40px] md:leading-[1.1]">
            Create a <span className="text-primary-gradient">banner</span>
          </h1>
          <p className="mt-3 text-muted">
            Describe the banner. Nanogen fans your prompt out across multiple models,
            scores each result, and surfaces the best one.
          </p>
        </header>

        {error && (
          <div className="mb-6 flex items-start gap-3 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
            <div>
              <div className="font-medium">Generation failed</div>
              <div className="text-red-300/80">{error}</div>
            </div>
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-[440px_1fr]">
          <div className="lg:sticky lg:top-24 lg:self-start">
            <PromptForm onSubmit={handleSubmit} isGenerating={status === "generating"} />
          </div>
          <ResultsPanel
            status={status}
            results={results}
            winnerId={winnerId}
            aspect={aspect}
          />
        </div>
      </Container>
    </div>
  );
}
