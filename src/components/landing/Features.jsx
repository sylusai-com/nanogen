import {
  PencilLine,
  Layers,
  Gauge,
  Trophy,
  PaintBucket,
  Workflow,
} from "lucide-react";
import Section from "@/components/ui/Section";
import FeatureCard from "./FeatureCard";

const iconCls = "h-5 w-5";

const features = [
  {
    icon: <PencilLine className={iconCls} strokeWidth={2} />,
    title: "Prompt-based generation",
    body: "Type what you want, optionally drop in a reference image. No design tools, no templates to wrestle with.",
  },
  {
    icon: <Layers className={iconCls} strokeWidth={2} />,
    title: "Multi-model selection",
    body: "Choose from several state-of-the-art image models — SDXL, Imagen, Flux, and more — and pick the one that fits your creative vision.",
  },
  {
    icon: <Gauge className={iconCls} strokeWidth={2} />,
    title: "Automated scoring",
    body: "An AI evaluator scores every output for composition, clarity, and on-brief accuracy. Only ≥ 80 are surfaced.",
  },
  {
    icon: <Trophy className={iconCls} strokeWidth={2} />,
    title: "Best-output selection",
    body: "Nanozen picks the winning banner automatically. Runners-up stay one click away when you want to compare.",
  },
  {
    icon: <PaintBucket className={iconCls} strokeWidth={2} />,
    title: "Dark-first interface",
    body: "Designed for long sessions. Crisp typography, calm contrast, and a one-click theme toggle when you need it.",
  },
  {
    icon: <Workflow className={iconCls} strokeWidth={2} />,
    title: "Built to scale",
    body: "Asynchronous model execution, efficient image processing, and storage for every asset you generate.",
  },
];

export default function Features() {
  return (
    <Section
      id="features"
      eyebrow="Capabilities"
      title="Everything you need to create stunning banners"
      description="A complete banner generation platform — from prompt to polished output, with built-in quality scoring and multi-model flexibility."
    >
      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {features.map((f, i) => (
          <FeatureCard key={f.title} {...f} delay={i * 0.05} />
        ))}
      </div>
    </Section>
  );
}
