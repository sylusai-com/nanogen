import Section from "@/components/ui/Section";
import StepCard from "./StepCard";

const steps = [
  { title: "Describe your banner", body: "Write a prompt and optionally attach a reference. Pick aspect ratio and tone." },
  { title: "Multi-model fan-out", body: "Nanogen runs your prompt through several image generation models in parallel." },
  { title: "Score & rank", body: "Every output is scored for visual quality. Anything below 80 is filtered out." },
  { title: "Pick the winner", body: "The top-scoring banner is selected automatically. Runners-up stay one click away." },
];

export default function HowItWorks() {
  return (
    <Section
      id="how-it-works"
      eyebrow="Workflow"
      title="From prompt to banner in four steps"
      description="The pipeline is fully automated. You stay in the loop only when you want to."
    >
      <ol className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {steps.map((s, i) => (
          <StepCard
            key={s.title}
            index={i + 1}
            total={steps.length}
            title={s.title}
            body={s.body}
            delay={i * 0.06}
          />
        ))}
      </ol>
    </Section>
  );
}
