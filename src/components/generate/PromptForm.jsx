"use client";

import { useState } from "react";
import { ArrowRight, Loader2 } from "lucide-react";
import { MODELS, STYLES } from "@/lib/models";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import PromptInput from "./PromptInput";
import ReferenceUpload from "./ReferenceUpload";
import AspectSelector from "./AspectSelector";
import StyleSelector from "./StyleSelector";
import ModelSelector from "./ModelSelector";

const enabledIds = MODELS.filter((m) => m.enabled).map((m) => m.id);

export default function PromptForm({ onSubmit, isGenerating }) {
  const [prompt, setPrompt] = useState("");
  const [aspect, setAspect] = useState("16:9");
  const [style, setStyle] = useState(STYLES[0]);
  const [selected, setSelected] = useState(enabledIds);
  const [referenceImage, setReferenceImage] = useState(null);

  const toggleModel = (id) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!prompt.trim() || selected.length === 0) return;
    onSubmit({
      prompt: prompt.trim(),
      aspect,
      style,
      models: selected,
      referenceImage,
    });
  };

  const canSubmit = !isGenerating && prompt.trim() && selected.length > 0;

  return (
    <Card elevated as="form" className="p-5 md:p-6 space-y-6">
      <PromptInput value={prompt} onChange={setPrompt} />
      <ReferenceUpload value={referenceImage} onChange={setReferenceImage} />

      <div className="grid gap-5 md:grid-cols-2">
        <AspectSelector value={aspect} onChange={setAspect} />
        <StyleSelector value={style} onChange={setStyle} />
      </div>

      <ModelSelector selected={selected} onToggle={toggleModel} />

      <div className="divider-soft" />

      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] text-muted">
          Outputs scoring &lt; 80 are filtered automatically.
        </p>
        <Button
          type="submit"
          size="lg"
          disabled={!canSubmit}
          onClick={handleSubmit}
          rightIcon={
            isGenerating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ArrowRight className="h-4 w-4" strokeWidth={2.5} />
            )
          }
        >
          {isGenerating ? "Generating" : "Generate"}
        </Button>
      </div>
    </Card>
  );
}
