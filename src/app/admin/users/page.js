"use client";

import { useEffect, useMemo, useState } from "react";
import { MoreHorizontal, Search, ShieldCheck } from "lucide-react";
import { useAuth } from "@/components/layout/AuthProvider";
import TopBar from "@/components/dashboard/TopBar";
import Avatar from "@/components/ui/Avatar";
import Badge from "@/components/ui/Badge";
import Skeleton from "@/components/ui/Skeleton";
import EmptyData from "@/components/ui/EmptyData";
import { Input } from "@/components/ui/Input";
import Pagination from "@/components/ui/Pagination";
import { TD, TH, THead, TR, Table } from "@/components/ui/Table";
import Dropdown, { DropdownItem, DropdownSection } from "@/components/ui/Dropdown";
import { listAllUsers } from "@/lib/db/admin";

const PAGE_SIZE = 20;

function fmtAgo(iso) {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days <= 0) return "today";
  if (days === 1) return "1 day ago";
  return `${days} days ago`;
}

export default function AdminUsers() {
  const { user, supabase } = useAuth();
  const [all, setAll] = useState(null);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRows, setTotalRows] = useState(0);

  const reload = () => {
    listAllUsers(supabase, { page, pageSize: PAGE_SIZE })
      .then((result) => {
        setAll(result.rows || []);
        setTotalPages(result.totalPages || 1);
        setTotalRows(result.total || 0);
      })
      .catch((e) => console.error("admin users", e));
  };

  useEffect(() => {
    if (!user) return;
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, supabase, page]);

  const filtered = useMemo(() => {
    if (!all) return [];
    if (!query.trim()) return all;
    const q = query.toLowerCase();
    return all.filter(
      (u) =>
        (u.name || "").toLowerCase().includes(q) ||
        (u.email || "").toLowerCase().includes(q),
    );
  }, [all, query]);

  useEffect(() => {
    setPage(1);
  }, [query]);

  const promote = async (u) => {
    const next = u.role === "admin" ? "user" : "admin";
    const { error } = await supabase
      .from("profiles")
      .update({ role: next })
      .eq("id", u.id);
    if (error) {
      alert(error.message);
    } else {
      reload();
    }
  };

  return (
    <>
      <TopBar title="Users" action={null} />
      <div className="mx-auto w-full max-w-7xl space-y-6 px-5 py-8 md:px-8 md:py-10">
        <div className="flex flex-col items-stretch justify-between gap-3 md:flex-row md:items-center">
          <p className="text-xs text-muted">
            {all ? `${filtered.length} of ${all.length} users` : "Loading…"}
          </p>
          <Input
            placeholder="Search users…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            leftIcon={<Search className="h-4 w-4" />}
            className="md:w-72"
          />
        </div>

        {all === null ? (
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-12" />
            ))}
          </div>
        ) : filtered.length ? (
          <Table>
            <THead>
              <TR>
                <TH>User</TH>
                <TH>Plan</TH>
                <TH>Role</TH>
                <TH>Joined</TH>
                <TH align="right">&nbsp;</TH>
              </TR>
            </THead>
            <tbody>
              {filtered.map((u) => (
                <TR key={u.id}>
                  <TD>
                    <div className="flex items-center gap-3">
                      <Avatar name={u.name || u.email || ""} size={32} src={u.avatar_url} />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="truncate text-foreground">{u.name || "—"}</span>
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
                  <TD>
                    <span className="text-xs text-muted-strong capitalize">{u.role}</span>
                  </TD>
                  <TD className="text-xs text-muted">{fmtAgo(u.created_at)}</TD>
                  <TD align="right">
                    <Dropdown
                      align="end"
                      width={200}
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
                        <DropdownItem onClick={() => promote(u)}>
                          {u.role === "admin" ? "Demote to user" : "Promote to admin"}
                        </DropdownItem>
                      </DropdownSection>
                    </Dropdown>
                  </TD>
                </TR>
              ))}
            </tbody>
          </Table>
        ) : (
          <EmptyData
            title="No users yet"
            body={
              query
                ? "Try a different search."
                : "Users appear here as they sign up."
            }
          />
        )}

        {all && totalRows > 0 && (
          <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
        )}
      </div>
    </>
  );
}
