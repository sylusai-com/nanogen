// src/components/banner/ReferencePanel.jsx
"use client";

import { Image as ImageIcon, Palette, UserSquare } from "lucide-react";
import Card from "@/components/ui/Card";

// Renders the reference image the user attached when generating a banner,
// plus the structured context the vision model extracted from it (subject,
// palette, mood, composition, vibe). Hidden when no reference exists.
//
// Also renders a sibling card for the SUBJECT image when one was supplied —
// the subject is the photo embedded INTO the banner, while the reference
// is inspiration only, so they get distinct cards to keep the distinction
// visible to the user.
//
// Used on /dashboard/banners/[id] (detail view) and /dashboard/banners/[id]/edit.
export default function ReferencePanel({
  imageUrl,
  context,
  subjectImageUrl,
  subjectContext,
}) {
  const hasReference = !!(imageUrl || context);
  const hasSubject   = !!(subjectImageUrl || subjectContext);
  if (!hasReference && !hasSubject) return null;
  return (
    <div className="space-y-4">
      {hasReference && <ReferenceCard imageUrl={imageUrl} context={context} />}
      {hasSubject && (
        <SubjectCard imageUrl={subjectImageUrl} context={subjectContext} />
      )}
    </div>
  );
}

function ReferenceCard({ imageUrl, context }) {
  if (!imageUrl && !context) return null;

  const palette = Array.isArray(context?.palette) ? context.palette : [];
  const mood    = Array.isArray(context?.mood)    ? context.mood    : [];
  const motifs  = Array.isArray(context?.subjectsToFeature)
    ? context.subjectsToFeature
    : [];

  return (
    <Card elevated className="p-5">
      <div className="flex items-center gap-2">
        <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-[color-mix(in_oklab,var(--primary)_14%,transparent)] text-primary">
          <ImageIcon className="h-3.5 w-3.5" />
        </span>
        <h3 className="text-sm font-semibold tracking-tight">Reference</h3>
      </div>

      {imageUrl && (
        <div className="mt-3 overflow-hidden rounded-lg border border-border bg-surface-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrl}
            alt="User-uploaded reference"
            className="h-auto w-full object-cover"
          />
        </div>
      )}

      {context && (
        <dl className="mt-4 space-y-3 text-xs">
          {context.subject && (
            <Row label="Subject">
              <span className="text-foreground">{context.subject}</span>
            </Row>
          )}
          {context.category && (
            <Row label="Category">
              <span className="font-mono text-foreground">{context.category}</span>
            </Row>
          )}
          {mood.length > 0 && (
            <Row label="Mood">
              <span className="flex flex-wrap gap-1">
                {mood.map((m) => (
                  <Chip key={m}>{m}</Chip>
                ))}
              </span>
            </Row>
          )}
          {palette.length > 0 && (
            <Row label="Palette" icon={<Palette className="h-3 w-3" />}>
              <span className="flex flex-wrap items-center gap-1.5">
                {palette.map((c) => (
                  <span
                    key={c}
                    title={c}
                    className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-1.5 py-0.5 font-mono text-[10px] text-muted-strong"
                  >
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-full ring-1 ring-inset ring-border"
                      style={{ background: c }}
                    />
                    {c}
                  </span>
                ))}
              </span>
            </Row>
          )}
          {motifs.length > 0 && (
            <Row label="Motifs">
              <span className="flex flex-wrap gap-1">
                {motifs.map((m) => (
                  <Chip key={m}>{m}</Chip>
                ))}
              </span>
            </Row>
          )}
          {context.composition && (
            <Row label="Composition">
              <span className="text-muted-strong leading-snug">{context.composition}</span>
            </Row>
          )}
          {context.vibe && (
            <Row label="Vibe">
              <span className="text-muted-strong leading-snug italic">{context.vibe}</span>
            </Row>
          )}
        </dl>
      )}

      <p className="mt-4 border-t border-border pt-3 text-[10px] leading-snug text-muted">
        The AI used this image only as inspiration — the rendered banner is
        HTML + CSS generated from your prompt and the extracted context.
      </p>
    </Card>
  );
}

function Row({ label, icon, children }) {
  return (
    <div className="grid grid-cols-[88px_1fr] items-start gap-3">
      <dt className="inline-flex items-center gap-1 text-[10px] uppercase tracking-widest text-muted">
        {icon}
        {label}
      </dt>
      <dd className="min-w-0">{children}</dd>
    </div>
  );
}

function Chip({ children }) {
  return (
    <span className="inline-flex items-center rounded-full border border-border bg-background px-2 py-0.5 text-[10px] text-muted-strong">
      {children}
    </span>
  );
}

const TREATMENT_LABELS = {
  "feather-mask":   "Feather mask",
  "circular-crop":  "Circular crop",
  "soft-vignette":  "Soft vignette",
  "blend-multiply": "Multiply blend",
  "blend-screen":   "Screen blend",
  "as-is":          "As-is",
};

function SubjectCard({ imageUrl, context }) {
  if (!imageUrl && !context) return null;

  const colors = Array.isArray(context?.dominantColors) ? context.dominantColors : [];
  const treatment = context?.suggestedTreatment;
  const needsRemoval = !!context?.needsBackgroundRemoval;

  return (
    <Card elevated className="p-5">
      <div className="flex items-center gap-2">
        <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-[color-mix(in_oklab,var(--primary)_14%,transparent)] text-primary">
          <UserSquare className="h-3.5 w-3.5" />
        </span>
        <h3 className="text-sm font-semibold tracking-tight">Subject</h3>
      </div>

      {imageUrl && (
        <div className="mt-3 overflow-hidden rounded-lg border border-border bg-surface-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrl}
            alt="Subject featured in banner"
            className="h-auto w-full object-cover"
          />
        </div>
      )}

      {context && (
        <dl className="mt-4 space-y-3 text-xs">
          {context.shortDescription && (
            <Row label="Shows">
              <span className="text-foreground">{context.shortDescription}</span>
            </Row>
          )}
          {context.subjectType && (
            <Row label="Type">
              <span className="font-mono text-foreground">{context.subjectType}</span>
            </Row>
          )}
          {context.framing && (
            <Row label="Framing">
              <span className="font-mono text-foreground">{context.framing}</span>
            </Row>
          )}
          {context.placement && (
            <Row label="Placement">
              <span className="font-mono text-foreground">{context.placement}</span>
            </Row>
          )}
          {treatment && (
            <Row label="Treatment">
              <Chip>{TREATMENT_LABELS[treatment] || treatment}</Chip>
            </Row>
          )}
          <Row label="BG removal">
            <span className="text-muted-strong">
              {context.hasCleanBackground
                ? "not needed — already clean"
                : needsRemoval
                ? "applied via CSS mask / blend"
                : "not flagged"}
            </span>
          </Row>
          {context.backgroundDescription && (
            <Row label="BG details">
              <span className="text-muted-strong leading-snug">
                {context.backgroundDescription}
              </span>
            </Row>
          )}
          {colors.length > 0 && (
            <Row label="Subject palette" icon={<Palette className="h-3 w-3" />}>
              <span className="flex flex-wrap items-center gap-1.5">
                {colors.map((c) => (
                  <span
                    key={c}
                    title={c}
                    className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-1.5 py-0.5 font-mono text-[10px] text-muted-strong"
                  >
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-full ring-1 ring-inset ring-border"
                      style={{ background: c }}
                    />
                    {c}
                  </span>
                ))}
              </span>
            </Row>
          )}
        </dl>
      )}

      <p className="mt-4 border-t border-border pt-3 text-[10px] leading-snug text-muted">
        Unlike the reference image, this photo IS rendered IN the banner — the
        AI applied the recommended CSS treatment to integrate it cleanly.
      </p>
    </Card>
  );
}
