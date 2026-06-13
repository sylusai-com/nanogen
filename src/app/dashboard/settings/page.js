"use client";

import { useState } from "react";
import { Save, LogOut } from "lucide-react";
import { useAuth } from "@/components/layout/AuthProvider";
import TopBar from "@/components/dashboard/TopBar";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Avatar from "@/components/ui/Avatar";
import { Input, Label } from "@/components/ui/Input";

export default function SettingsPage() {
  const { user, signOut } = useAuth();
  const [name, setName] = useState(user?.name || "");
  const [email, setEmail] = useState(user?.email || "");
  const [notify, setNotify] = useState({
    weekly: true,
    productUpdates: false,
    failures: true,
  });

  return (
    <>
      <TopBar title="Settings" action={null} />
      <div className="mx-auto w-full max-w-3xl space-y-6 px-5 py-8 md:px-8 md:py-10">
        <Card elevated className="p-6">
          <h2 className="text-base font-semibold tracking-tight">Profile</h2>
          <p className="mt-1 text-xs text-muted">Update how you appear inside Nanozen.</p>

          <div className="mt-6 flex items-center gap-4">
            <Avatar name={user?.name || ""} size={64} />
            <div className="text-xs text-muted">
              Avatars are generated from your initials.<br />
              Image uploads coming soon.
            </div>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
          </div>

          <div className="mt-6 flex justify-end">
            <Button leftIcon={<Save className="h-3.5 w-3.5" />}>Save changes</Button>
          </div>
        </Card>

        <Card elevated className="p-6">
          <h2 className="text-base font-semibold tracking-tight">Notifications</h2>
          <p className="mt-1 text-xs text-muted">What we&apos;ll email you about.</p>

          <ul className="mt-5 space-y-3">
            {[
              { id: "weekly", label: "Weekly summary", body: "Your generations + best-performing banners." },
              { id: "productUpdates", label: "Product updates", body: "New features, models, and improvements." },
              { id: "failures", label: "Generation failures", body: "Get notified when a run errors out." },
            ].map((n) => (
              <li key={n.id} className="flex items-center justify-between gap-3 rounded-xl border border-border bg-background px-4 py-3">
                <div className="min-w-0">
                  <div className="text-sm text-foreground">{n.label}</div>
                  <div className="text-[11px] text-muted">{n.body}</div>
                </div>
                <button
                  type="button"
                  onClick={() => setNotify((s) => ({ ...s, [n.id]: !s[n.id] }))}
                  aria-pressed={notify[n.id]}
                  className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
                    notify[n.id] ? "bg-primary" : "bg-surface-2"
                  }`}
                >
                  <span
                    className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
                      notify[n.id] ? "translate-x-5" : "translate-x-1"
                    }`}
                  />
                </button>
              </li>
            ))}
          </ul>
        </Card>

        <Card elevated className="p-6">
          <h2 className="text-base font-semibold tracking-tight">Danger zone</h2>
          <p className="mt-1 text-xs text-muted">Sign out from this browser.</p>
          <div className="mt-4">
            <button
              type="button"
              onClick={signOut}
              className="inline-flex items-center gap-2 rounded-full border border-red-500/30 bg-red-500/5 px-4 py-2 text-xs text-red-400 hover:bg-red-500/10 transition-colors"
            >
              <LogOut className="h-3.5 w-3.5" />
              Sign out
            </button>
          </div>
        </Card>
      </div>
    </>
  );
}
