"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { Loader2, Mail, ArrowLeft, ArrowRight, CheckCircle2 } from "lucide-react";
import AuthCard from "@/components/auth/AuthCard";
import { Input, Label } from "@/components/ui/Input";
import Button from "@/components/ui/Button";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState(null);

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!email) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || `Request failed (${res.status})`);
      }
      setSent(true);
    } catch (e) {
      setError(e?.message || "Something went wrong");
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
        title={sent ? "Check your email" : "Forgot password?"}
        subtitle={
          sent
            ? "We've sent a password reset link to your email"
            : "Enter your email and we'll send you a reset link"
        }
        footer={
          <Link href="/login" className="inline-flex items-center gap-1.5 text-foreground font-medium underline-offset-4 hover:underline">
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to sign in
          </Link>
        }
      >
        {sent ? (
          <div className="space-y-5">
            <div className="flex items-start gap-3 rounded-xl border border-green-500/20 bg-green-500/10 px-4 py-3.5">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-400" />
              <div>
                <p className="text-sm font-medium text-green-300">Email sent</p>
                <p className="mt-0.5 text-xs text-green-300/70">
                  If an account exists for <span className="font-medium text-green-200">{email}</span>, you&apos;ll receive a reset link shortly. Check your spam folder too.
                </p>
              </div>
            </div>

            <Button
              type="button"
              variant="secondary"
              className="w-full"
              onClick={() => { setSent(false); setEmail(""); }}
            >
              Try a different email
            </Button>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email address</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                leftIcon={<Mail className="h-4 w-4" />}
                autoComplete="email"
                autoFocus
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
              {submitting ? "Sending" : "Send reset link"}
            </Button>
          </form>
        )}
      </AuthCard>
    </motion.div>
  );
}
