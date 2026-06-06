// src/app/dashboard/layout.js
"use client";

import { Home, Sparkles, Settings, Shield, Code2 } from "lucide-react";
import { useAuth } from "@/components/layout/AuthProvider";
import RouteGuard from "@/components/dashboard/RouteGuard";
import Sidebar from "@/components/dashboard/Sidebar";
import Avatar from "@/components/ui/Avatar";
import Link from "next/link";
import GenerationProvider from "@/components/generate/GenerationProvider";

const iconCls = "h-4 w-4";

export default function DashboardLayout({ children }) {
  const { user, isAdmin } = useAuth();

  const sections = [
    {
      title: "Workspace",
      items: [
        // Create-first ordering: the primary action of this app is
        // generating a banner, so the entry sits at the top of the nav.
        // /dashboard/banners is the unified hub — composer at top, gallery
        // below — so the same destination serves "make something new" and
        // "browse what I've made". Overview (stats / status) sits beneath.
        { href: "/dashboard/banners", label: "Create banner", icon: <Sparkles className={iconCls} /> },
        { href: "/dashboard/api", label: "API", icon: <Code2 className={iconCls} /> },
        { href: "/dashboard", label: "Overview", icon: <Home className={iconCls} />, exact: true },
      ],
    },
    {
      title: "Account",
      items: [
        { href: "/dashboard/settings", label: "Settings", icon: <Settings className={iconCls} /> },
        ...(isAdmin
          ? [{ href: "/admin", label: "Admin", icon: <Shield className={iconCls} /> }]
          : []),
      ],
    },
  ];

  const footer = user && (
    <Link
      href="/dashboard/settings"
      className="flex items-center gap-3 rounded-lg p-2 hover:bg-surface-2 transition-colors"
    >
      <Avatar name={user.name} size={32} />
      <div className="min-w-0">
        <div className="truncate text-sm font-medium text-foreground">{user.name}</div>
        <div className="truncate text-[11px] text-muted">{user.email}</div>
      </div>
    </Link>
  );

  return (
    <RouteGuard>
      <GenerationProvider>
        <div className="flex min-h-dvh items-start">
          <Sidebar sections={sections} footer={footer} />
          <div className="flex min-w-0 flex-1 flex-col">{children}</div>
        </div>
      </GenerationProvider>
    </RouteGuard>
  );
}
