"use client";

import { LogOut, Settings, Shield, User as UserIcon } from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/components/layout/AuthProvider";
import Avatar from "@/components/ui/Avatar";
import Dropdown, { DropdownItem, DropdownSection } from "@/components/ui/Dropdown";

export default function UserMenu() {
  const { user, signOut, isAdmin } = useAuth();
  if (!user) return null;

  return (
    <Dropdown
      align="end"
      width={240}
      trigger={
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-full border border-border bg-surface py-1 pl-1 pr-3 transition-colors hover:border-border-strong hover:bg-surface-2"
        >
          <Avatar name={user.name} size={28} />
          <span className="hidden md:block max-w-[120px] truncate text-sm text-foreground">
            {user.name}
          </span>
        </button>
      }
    >
      <DropdownSection>
        <div className="flex items-center gap-3 px-3 py-2.5">
          <Avatar name={user.name} size={36} />
          <div className="min-w-0">
            <div className="truncate text-sm font-medium text-foreground">{user.name}</div>
            <div className="truncate text-[11px] text-muted">{user.email}</div>
          </div>
        </div>
      </DropdownSection>

      <DropdownSection>
        <DropdownItem
          leftIcon={<UserIcon className="h-4 w-4" />}
          onClick={() => null}
        >
          <Link href="/dashboard/settings" className="flex-1">
            Account
          </Link>
        </DropdownItem>
        <DropdownItem leftIcon={<Settings className="h-4 w-4" />}>
          <Link href="/dashboard/settings" className="flex-1">
            Settings
          </Link>
        </DropdownItem>
        {isAdmin && (
          <DropdownItem leftIcon={<Shield className="h-4 w-4" />}>
            <Link href="/admin" className="flex-1">
              Admin dashboard
            </Link>
          </DropdownItem>
        )}
      </DropdownSection>

      <DropdownSection>
        <DropdownItem
          danger
          leftIcon={<LogOut className="h-4 w-4" />}
          onClick={signOut}
        >
          Sign out
        </DropdownItem>
      </DropdownSection>
    </Dropdown>
  );
}
