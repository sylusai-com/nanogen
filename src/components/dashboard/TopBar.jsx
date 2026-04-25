"use client";

import { Search, Plus } from "lucide-react";
import Link from "next/link";
import { Input } from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import ThemeToggle from "@/components/layout/ThemeToggle";
import UserMenu from "./UserMenu";

export default function TopBar({ title, action }) {
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-4 border-b border-border bg-[color-mix(in_oklab,var(--background)_72%,transparent)] px-5 backdrop-blur-xl md:px-8">
      <div className="flex items-center gap-3 min-w-0">
        {title && (
          <h1 className="truncate text-base font-semibold tracking-tight md:text-lg">
            {title}
          </h1>
        )}
      </div>

      <div className="hidden md:block flex-1 max-w-sm">
        <Input
          placeholder="Search banners, prompts…"
          leftIcon={<Search className="h-4 w-4" />}
          className="h-9"
        />
      </div>

      <div className="flex items-center gap-2">
        {action ?? (
          <Button
            href="/dashboard/create"
            size="md"
            leftIcon={<Plus className="h-3.5 w-3.5" strokeWidth={2.5} />}
          >
            New banner
          </Button>
        )}
        <ThemeToggle />
        <UserMenu />
      </div>
    </header>
  );
}
