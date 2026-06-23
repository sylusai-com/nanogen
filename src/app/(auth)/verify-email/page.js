"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { motion } from "motion/react";
import { Loader2, Mail, MailCheck, ArrowLeft, RefreshCw } from "lucide-react";
import AuthCard from "@/components/auth/AuthCard";
import Button from "@/components/ui/Button";

function VerifyEmailContent() {
  const params = useSearchParams();
  const email = params.get("email") || "";
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);
  const [error, setError] = useState(null);

  const onResend = async () => {
    if (!email) return;
    setResending(true);
    setError(null);
    setResent(false);
    try {
      const res = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || `Request failed (${res.status})`);
      }
      setResent(true);
    } catch (e) {
      setError(e?.message || "Something went wrong");
    } finally {
      setResending(false);
    }
  };

  return (
    <AuthCard
      title="Check your email"
      subtitle="We've sent a verification link to complete your signup"
      footer={
        <Link href="/login" className="inline-flex items-center gap-1.5 text-foreground font-medium underline-offset-4 hover:underline">
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to sign in
        </Link>
      }
    >
      <div className="space-y-5">
        {/* Email icon + message */}
        <div className="flex flex-col items-center text-center space-y-4 py-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10">
            <MailCheck className="h-8 w-8 text-primary" />
          </div>
          <div className="space-y-1.5">
            <p className="text-sm text-muted-strong">
              We sent a verification link to
            </p>
            {email && (
              <p className="text-sm font-semibold text-foreground">{email}</p>
            )}
            <p className="text-xs text-muted">
              Click the link in the email to verify your account and start creating banners.
            </p>
          </div>
        </div>

        {/* Success / error states */}
        {resent && (
          <div className="rounded-lg border border-green-500/20 bg-green-500/10 px-3 py-2 text-xs text-green-300 text-center">
            Verification email resent! Check your inbox.
          </div>
        )}
        {error && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300 text-center">
            {error}
          </div>
        )}

        {/* Resend button */}
        {email && (
          <Button
            type="button"
            variant="secondary"
            className="w-full"
            disabled={resending}
            onClick={onResend}
            leftIcon={
              resending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )
            }
          >
            {resending ? "Resending…" : "Resend verification email"}
          </Button>
        )}

        {/* Help text */}
        <div className="space-y-2 rounded-xl border border-border bg-surface-2/50 p-4 text-[11px] text-muted">
          <div className="flex items-start gap-2">
            <Mail className="mt-0.5 h-3 w-3 shrink-0" />
            <span>The email may take a minute to arrive. Check your spam or junk folder.</span>
          </div>
          <div className="flex items-start gap-2">
            <Mail className="mt-0.5 h-3 w-3 shrink-0" />
            <span>The verification link expires in 24 hours.</span>
          </div>
        </div>
      </div>
    </AuthCard>
  );
}

export default function VerifyEmailPage() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <Suspense fallback={<div className="h-96" />}>
        <VerifyEmailContent />
      </Suspense>
    </motion.div>
  );
}
