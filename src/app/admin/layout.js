// src/app/admin/layout.js
"use client";

import { ArrowLeft, Boxes, Cpu, Image as ImageIcon, LayoutDashboard, LayoutTemplate, MessageSquareCode, Palette, Plug, Sparkles, Users } from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/components/layout/AuthProvider";
import RouteGuard from "@/components/dashboard/RouteGuard";
import Sidebar from "@/components/dashboard/Sidebar";
import Avatar from "@/components/ui/Avatar";
import Badge from "@/components/ui/Badge";

const iconCls = "h-4 w-4";

export default function AdminLayout({ children }) {
  const { user } = useAuth();

  const sections = [
    {
      title: "Admin",
      items: [
        {
          href: "/admin",
          label: "Overview",
          icon: <LayoutDashboard className={iconCls} />,
          exact: true,
        },
        {
          href: "/admin/users",
          label: "Users",
          icon: <Users className={iconCls} />,
        },
        {
          href: "/admin/models",
          label: "Models",
          icon: <Cpu className={iconCls} />,
        },
        {
          href: "/admin/bg-image-providers",
          label: "BG Providers",
          icon: <Sparkles className={iconCls} />,
        },
        {
          href: "/admin/prompt",
          label: "Prompt",
          icon: <MessageSquareCode className={iconCls} />,
        },
        {
          href: "/admin/outputs",
          label: "Outputs",
          icon: <ImageIcon className={iconCls} />,
        },
        {
          href: "/admin/connections",
          label: "Connections",
          icon: <Plug className={iconCls} />,
        },
      ],
    },
    {
      title: "Catalog",
      items: [
        {
          href: "/admin/aspects",
          label: "Aspect Ratios",
          icon: <LayoutTemplate className={iconCls} />,
        },
        {
          href: "/admin/styles",
          label: "Banner Styles",
          icon: <Palette className={iconCls} />,
        },
      ],
    },
    {
      title: "Workspace",
      items: [
        {
          href: "/dashboard",
          label: "Back to studio",
          icon: <Boxes className={iconCls} />,
        },
      ],
    },
  ];

  const footer = user && (
    <Link
      href="/dashboard"
      className="flex items-center gap-3 rounded-lg p-2 hover:bg-surface-2 transition-colors"
    >
      <Avatar name={user.name} size={32} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <div className="truncate text-sm font-medium text-foreground">
            {user.name}
          </div>
          <Badge tone="primary" className="px-1.5 py-0 text-[9px]">
            Admin
          </Badge>
        </div>
        <div className="truncate text-[11px] text-muted">{user.email}</div>
      </div>
      <ArrowLeft className="h-3.5 w-3.5 text-muted" />
    </Link>
  );

  return (
    <RouteGuard requireAdmin>
      <div className="flex min-h-screen">
        <Sidebar sections={sections} footer={footer} />
        <div className="flex min-w-0 flex-1 flex-col">{children}</div>
      </div>
    </RouteGuard>
  );
}