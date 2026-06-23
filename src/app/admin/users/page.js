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
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
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
  const [plans, setPlans] = useState([]);
  
  // Modal states
  const [planModalUser, setPlanModalUser] = useState(null);
  const [balanceModalUser, setBalanceModalUser] = useState(null);
  const [adjustAmount, setAdjustAmount] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetch("/api/admin/credits").then(r => r.json()).then(setPlans).catch(console.error);
  }, []);

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
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPage(1);
  }, [query]);

  const toggleApiAccess = async (u) => {
    const next = !u.api_access_allowed;
    try {
      const res = await fetch("/api/admin/credits/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: u.id, action: "toggle_api", allowed: next })
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to toggle API access");
      }
      reload();
    } catch (e) {
      alert(e.message);
    }
  };

  const setPlan = async (u, planId) => {
    setIsSubmitting(true);
    try {
      await fetch("/api/admin/credits/users", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: u.id, action: "set_plan", planId })
      });
      reload();
      setPlanModalUser(null);
    } catch (e) {
      alert(e.message || "Failed to update plan");
    } finally {
      setIsSubmitting(false);
    }
  };

  const adjustUserCredits = async (e) => {
    e.preventDefault();
    if (!balanceModalUser || !adjustAmount) return;
    const parsed = parseInt(adjustAmount, 10);
    if (isNaN(parsed)) return alert("Invalid amount");
    
    setIsSubmitting(true);
    try {
      await fetch("/api/admin/credits/users", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: balanceModalUser.id, action: "adjust", amount: parsed })
      });
      reload();
      setBalanceModalUser(null);
      setAdjustAmount("");
    } catch (e) {
      alert(e.message || "Failed to adjust balance");
    } finally {
      setIsSubmitting(false);
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
                <TH>Credits</TH>
                <TH>Role</TH>
                <TH>API Access</TH>
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
                    <Badge tone={u.user_credits?.credit_plans?.name || u.plan === "pro" ? "primary" : "neutral"}>
                        {u.user_credits?.credit_plans?.name || u.plan}
                    </Badge>
                  </TD>
                  <TD>
                    <span className="text-xs font-mono">
                      {u.user_credits?.credits_remaining === -1 ? "Unlimited" : (u.user_credits?.credits_remaining ?? "—")}
                    </span>
                  </TD>
                  <TD>
                    <span className="text-xs text-muted-strong capitalize">{u.role}</span>
                  </TD>
                  <TD>
                    <Badge tone={u.api_access_allowed ? "primary" : "neutral"}>
                      {u.api_access_allowed ? "Allowed" : "Locked"}
                    </Badge>
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
                        <DropdownItem onClick={() => toggleApiAccess(u)}>
                          {u.api_access_allowed ? "Revoke API access" : "Grant API access"}
                        </DropdownItem>
                      </DropdownSection>
                      {plans.length > 0 && (
                        <DropdownSection>
                          <DropdownItem onClick={() => setPlanModalUser(u)}>
                            Change plan
                          </DropdownItem>
                        </DropdownSection>
                      )}
                      <DropdownSection>
                        <DropdownItem onClick={() => {
                          setBalanceModalUser(u);
                          setAdjustAmount("");
                        }}>
                          Adjust balance
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

      {/* Change Plan Modal */}
      <Modal
        open={!!planModalUser}
        onClose={() => !isSubmitting && setPlanModalUser(null)}
        title="Change user plan"
        description={`Select a new plan for ${planModalUser?.name || planModalUser?.email || "this user"}.`}
        size="sm"
        footer={
          <Button variant="secondary" onClick={() => setPlanModalUser(null)} disabled={isSubmitting}>
            Cancel
          </Button>
        }
      >
        <div className="space-y-2 pt-2">
          {plans.map(p => (
            <button
              key={p.id}
              onClick={() => setPlan(planModalUser, p.id)}
              disabled={isSubmitting}
              className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-border bg-surface hover:bg-surface-2 transition-colors disabled:opacity-50 text-left"
            >
              <div>
                <div className="text-sm font-medium text-foreground">{p.name}</div>
                <div className="text-xs text-muted">{p.description}</div>
              </div>
              <div className="text-xs font-mono text-muted-strong">
                {p.credits === -1 ? "Unlimited" : `${p.credits} credits`}
              </div>
            </button>
          ))}
        </div>
      </Modal>

      {/* Adjust Balance Modal */}
      <Modal
        open={!!balanceModalUser}
        onClose={() => !isSubmitting && setBalanceModalUser(null)}
        title="Adjust credit balance"
        description={`Add or subtract credits for ${balanceModalUser?.name || balanceModalUser?.email}.`}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setBalanceModalUser(null)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button onClick={adjustUserCredits} disabled={!adjustAmount || isSubmitting} variant="primary">
              {isSubmitting ? "Saving…" : "Adjust balance"}
            </Button>
          </>
        }
      >
        <form onSubmit={adjustUserCredits} className="pt-2">
          <label className="block text-xs font-medium text-muted-strong mb-1.5">
            Adjustment Amount
          </label>
          <Input
            autoFocus
            type="number"
            placeholder="e.g. 10 or -5"
            value={adjustAmount}
            onChange={(e) => setAdjustAmount(e.target.value)}
            disabled={isSubmitting}
          />
          <p className="mt-2 text-[11px] text-muted">
            Positive numbers add credits, negative numbers subtract. Current balance: {balanceModalUser?.user_credits?.credits_remaining === -1 ? "Unlimited" : (balanceModalUser?.user_credits?.credits_remaining ?? 0)}.
          </p>
        </form>
      </Modal>
    </>
  );
}
