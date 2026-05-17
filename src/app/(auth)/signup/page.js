"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, Mail, Lock, User, ArrowRight } from "lucide-react";
import { useAuth } from "@/components/layout/AuthProvider";
import AuthCard from "@/components/auth/AuthCard";
import SocialAuth from "@/components/auth/SocialAuth";
import { Input, Label } from "@/components/ui/Input";
import Button from "@/components/ui/Button";

export default function SignupPage() {
  const { signIn, supabase } = useAuth();
  const router = useRouter();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password || !name) return;
    setSubmitting(true);
    setError(null);
    try {
      // 1. Server-side create with email_confirm: true (bypasses confirmation).
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, name }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `Signup failed (${res.status})`);

      // 2. Establish a browser session.
      const { user } = await signIn({ email, password });

      // 3. Route by role (admin_emails trigger may have already promoted us).
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();
      router.push(profile?.role === "admin" ? "/admin" : "/dashboard/banners");
    } catch (e) {
      setError(e?.message || "Sign-up failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthCard
      title="Create your account"
      subtitle="Start generating banners in under a minute"
      footer={
        <>
          Already have an account?{" "}
          <Link href="/login" className="text-foreground underline-offset-2 hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <SocialAuth disabled={submitting} />

      <div className="my-5 flex items-center gap-3 text-[10px] uppercase tracking-[0.14em] text-muted">
        <span className="h-px flex-1 bg-border" />
        or with email
        <span className="h-px flex-1 bg-border" />
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name">Full name</Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Aman Bhatt"
            leftIcon={<User className="h-4 w-4" />}
            autoComplete="name"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
            leftIcon={<Mail className="h-4 w-4" />}
            autoComplete="email"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 8 characters"
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
          {submitting ? "Creating account" : "Create account"}
        </Button>

        <p className="text-center text-[11px] text-muted">
          By signing up you agree to the Terms and Privacy Policy.
        </p>
      </form>
    </AuthCard>
  );
}
