"use client";

import { Search, Plus } from "lucide-react";
import Link from "next/link";
import { Input } from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import ThemeToggle from "@/components/layout/ThemeToggle";
import UserMenu from "./UserMenu";

export default function TopBar({ title, action }) {
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-2 border-b border-border bg-[color-mix(in_oklab,var(--background)_72%,transparent)] pl-16 pr-3 backdrop-blur-xl sm:gap-4 md:pl-8 md:pr-8">
      <div className="flex min-w-0 items-center gap-3">
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

      <div className="flex items-center gap-1.5 sm:gap-2">
        {action ?? (
          <Button
            href="/dashboard/create"
            size="md"
            leftIcon={<Plus className="h-3.5 w-3.5" strokeWidth={2.5} />}
            className="hidden sm:inline-flex"
          >
            New banner
          </Button>
        )}
        {!action && (
          <Button
            href="/dashboard/create"
            size="sm"
            aria-label="New banner"
            className="sm:hidden"
            leftIcon={<Plus className="h-3.5 w-3.5" strokeWidth={2.5} />}
          />
        )}
        <ThemeToggle />
        <UserMenu />
      </div>
    </header>
  );
}
