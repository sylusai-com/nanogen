// src/components/dashboard/RouteGuard.jsx
"use client";

import { useRouter, usePathname } from "next/navigation";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/components/layout/AuthProvider";

export default function RouteGuard({ children, requireAdmin = false }) {
  const { user, isLoading, isAdmin } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    } else if (requireAdmin && !isAdmin) {
      router.replace("/dashboard");
    }
  }, [isLoading, user, isAdmin, requireAdmin, pathname, router]);

  if (isLoading || !user || (requireAdmin && !isAdmin)) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted" />
      </div>
    );
  }

  return children;
}
