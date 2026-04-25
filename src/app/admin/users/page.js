"use client";

import { useMemo, useState } from "react";
import { MoreHorizontal, Search, ShieldCheck } from "lucide-react";
import TopBar from "@/components/dashboard/TopBar";
import Avatar from "@/components/ui/Avatar";
import Badge from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import { TD, TH, THead, TR, Table } from "@/components/ui/Table";
import Dropdown, { DropdownItem, DropdownSection } from "@/components/ui/Dropdown";
import { listUsers } from "@/lib/mockData";

function fmtAgo(iso) {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days <= 0) return "today";
  if (days === 1) return "1 day ago";
  return `${days} days ago`;
}

export default function AdminUsers() {
  const all = listUsers();
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    if (!query.trim()) return all;
    const q = query.toLowerCase();
    return all.filter((u) => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q));
  }, [all, query]);

  return (
    <>
      <TopBar title="Users" action={null} />
      <div className="mx-auto w-full max-w-7xl space-y-6 px-5 py-8 md:px-8 md:py-10">
        <div className="flex flex-col items-stretch justify-between gap-3 md:flex-row md:items-center">
          <div>
            <p className="text-xs text-muted">{filtered.length} of {all.length} users</p>
          </div>
          <Input
            placeholder="Search users…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            leftIcon={<Search className="h-4 w-4" />}
            className="md:w-72"
          />
        </div>

        <Table>
          <THead>
            <TR>
              <TH>User</TH>
              <TH>Plan</TH>
              <TH align="right">Banners</TH>
              <TH align="right">Avg score</TH>
              <TH>Status</TH>
              <TH>Last active</TH>
              <TH align="right">&nbsp;</TH>
            </TR>
          </THead>
          <tbody>
            {filtered.map((u) => (
              <TR key={u.id}>
                <TD>
                  <div className="flex items-center gap-3">
                    <Avatar name={u.name} size={32} status={u.status} />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate text-foreground">{u.name}</span>
                        {u.role === "admin" && (
                          <ShieldCheck className="h-3 w-3 text-primary" />
                        )}
                      </div>
                      <div className="truncate text-[11px] text-muted">{u.email}</div>
                    </div>
                  </div>
                </TD>
                <TD>
                  <Badge tone={u.plan === "pro" ? "primary" : "neutral"}>{u.plan}</Badge>
                </TD>
                <TD align="right" className="font-mono">{u.banners}</TD>
                <TD align="right" className="font-mono">{u.avgScore}</TD>
                <TD>
                  <span className="inline-flex items-center gap-1.5 text-xs capitalize text-muted">
                    <span className={`h-1.5 w-1.5 rounded-full ${
                      u.status === "online" ? "bg-emerald-400" : u.status === "away" ? "bg-amber-400" : "bg-zinc-500"
                    }`} />
                    {u.status}
                  </span>
                </TD>
                <TD className="text-xs text-muted">{fmtAgo(u.lastActive)}</TD>
                <TD align="right">
                  <Dropdown
                    align="end"
                    width={180}
                    trigger={
                      <button
                        className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted hover:bg-surface hover:text-foreground"
                        aria-label="User actions"
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </button>
                    }
                  >
                    <DropdownSection>
                      <DropdownItem>View profile</DropdownItem>
                      <DropdownItem>{u.role === "admin" ? "Demote to user" : "Promote to admin"}</DropdownItem>
                      <DropdownItem>Reset password</DropdownItem>
                    </DropdownSection>
                    <DropdownSection>
                      <DropdownItem danger>Suspend user</DropdownItem>
                    </DropdownSection>
                  </Dropdown>
                </TD>
              </TR>
            ))}
          </tbody>
        </Table>
      </div>
    </>
  );
}
