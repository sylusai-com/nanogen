"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { Loader2, Lock, ArrowRight, CheckCircle2 } from "lucide-react";
import { useAuth } from "@/components/layout/AuthProvider";
import AuthCard from "@/components/auth/AuthCard";
import { Input, Label } from "@/components/ui/Input";
import Button from "@/components/ui/Button";

export default function ResetPasswordPage() {
  const { supabase } = useAuth();
  const router = useRouter();

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    // Supabase admin.generateLink creates implicit grant links with tokens in the hash.
    // The SSR client might not automatically ingest these, so we do it manually.
    const hash = window.location.hash;
    if (hash && hash.includes("access_token=")) {
      const params = new URLSearchParams(hash.substring(1));
      const access_token = params.get("access_token");
      const refresh_token = params.get("refresh_token");
      if (access_token && refresh_token) {
        supabase.auth.setSession({ access_token, refresh_token }).then(({ error: sessionErr }) => {
          if (sessionErr) {
            console.error("Failed to set session from URL:", sessionErr);
          } else {
            // Clean up the URL hash
            window.history.replaceState(null, "", window.location.pathname + window.location.search);
          }
        });
      }
    }
  }, [supabase.auth]);

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!password || !confirm) return;
    if (password !== confirm) {
      setError("Passwords do not match");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password,
      });
      if (updateError) throw updateError;
      setDone(true);
      // Redirect to login after a brief delay.
      setTimeout(() => {
        router.push("/login?message=password_reset");
      }, 2000);
    } catch (e) {
      setError(e?.message || "Failed to reset password");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <AuthCard
        title={done ? "Password updated" : "Set a new password"}
        subtitle={
          done
            ? "You'll be redirected to sign in shortly"
            : "Choose a strong password for your account"
        }
      >
        {done ? (
          <div className="flex items-start gap-3 rounded-xl border border-green-500/20 bg-green-500/10 px-4 py-3.5">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-400" />
            <div>
              <p className="text-sm font-medium text-green-300">Password reset successfully</p>
              <p className="mt-0.5 text-xs text-green-300/70">
                Redirecting you to sign in…
              </p>
            </div>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">New password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
                leftIcon={<Lock className="h-4 w-4" />}
                autoComplete="new-password"
                minLength={8}
                autoFocus
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm">Confirm password</Label>
              <Input
                id="confirm"
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Repeat your password"
                leftIcon={<Lock className="h-4 w-4" />}
                autoComplete="new-password"
                minLength={8}
                required
              />
            </div>

            {error && (
              <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
                {error}
              </div>
            )}

            <Button
              type="submit"
              size="lg"
              className="w-full"
              disabled={submitting}
              rightIcon={
                submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ArrowRight className="h-4 w-4" strokeWidth={2.5} />
                )
              }
            >
              {submitting ? "Updating" : "Update password"}
            </Button>
          </form>
        )}
      </AuthCard>
    </motion.div>
  );
}
