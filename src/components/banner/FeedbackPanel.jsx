import { useState, useEffect } from "react";
import { ThumbsUp, ThumbsDown, Loader2 } from "lucide-react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { updateBanner } from "@/lib/db/banners";
import { useAuth } from "@/components/layout/AuthProvider";

export default function FeedbackPanel({ banner, onUpdate }) {
  const { supabase, user } = useAuth();
  const userId = user?.id;

  const [rating, setRating] = useState(banner?.feedbackRating || null);
  const [text, setText] = useState(banner?.feedbackText || "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (banner) {
      setRating(banner.feedbackRating || null);
      setText(banner.feedbackText || "");
    }
  }, [banner]);

  const submitFeedback = async (newRating, newText) => {
    if (!banner || saving) return;
    setSaving(true);
    try {
      const next = await updateBanner(supabase, userId, banner.id, {
        feedback_rating: newRating,
        feedback_text: newText,
      });
      onUpdate?.(next);
    } catch (e) {
      alert(e.message || "Failed to save feedback");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card elevated className="p-5">
      <h3 className="text-sm font-semibold tracking-tight">Feedback</h3>
      <p className="text-xs text-muted mt-1 mb-4">
        How did we do? Your feedback helps us improve generation quality.
      </p>

      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              const r = rating === "good" ? null : "good";
              setRating(r);
              if (r === "good") submitFeedback("good", text);
            }}
            className={`inline-flex h-9 items-center justify-center gap-2 rounded-full border px-4 text-xs font-medium transition-colors flex-1 ${
              rating === "good"
                ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-500 hover:bg-emerald-500/25"
                : "border-border bg-surface text-muted-strong hover:bg-surface-2"
            }`}
          >
            <ThumbsUp className="h-3.5 w-3.5" />
            Good
          </button>
          <button
            type="button"
            onClick={() => {
              const r = rating === "bad" ? null : "bad";
              setRating(r);
              if (r === "bad") submitFeedback("bad", text);
            }}
            className={`inline-flex h-9 items-center justify-center gap-2 rounded-full border px-4 text-xs font-medium transition-colors flex-1 ${
              rating === "bad"
                ? "border-red-500/40 bg-red-500/15 text-red-500 hover:bg-red-500/25"
                : "border-border bg-surface text-muted-strong hover:bg-surface-2"
            }`}
          >
            <ThumbsDown className="h-3.5 w-3.5" />
            Poor
          </button>
        </div>

        <div className="space-y-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Tell us what you liked or how it could be better..."
            className="block w-full rounded-xl border border-border bg-surface p-3 text-sm text-foreground transition-colors placeholder:text-muted focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/50 resize-none min-h-[80px]"
          />
          <Button
            size="sm"
            onClick={() => submitFeedback(rating, text)}
            disabled={saving || (!rating && !text)}
            className="w-full"
            variant={rating || text ? "primary" : "secondary"}
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Save Feedback"}
          </Button>
        </div>
      </div>
    </Card>
  );
}
