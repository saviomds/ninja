"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import Link from "next/link";

// ─── Types ────────────────────────────────────────────────────────────────────

type Tier   = "bronze" | "silver" | "gold" | "platinum";
type TxType = "earn" | "redeem" | "bonus" | "adjustment" | "expire";

interface LoyaltyAccount {
  id: string;
  customer_name: string;
  customer_phone: string;
  customer_email: string;
  points_balance: number;
  tier: Tier;
  total_earned: number;
  total_redeemed: number;
  member_since: string;
  last_activity: string;
  is_active: boolean;
  notes: string;
  created_at: string;
}

interface LoyaltyTransaction {
  id: string;
  account_id: string;
  type: TxType;
  points: number;
  balance_after: number;
  description: string;
  reference_id: string;
  created_by: string;
  created_at: string;
}

interface RepairTicket {
  id: string;
  ticket_no: string;
  customer_name: string;
  customer_phone: string;
  device_brand: string;
  device_model: string;
  final_cost: number | null;
  estimated_cost: number | null;
  status: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const TIER_CFG: Record<Tier, { label: string; minPts: number; nextPts: number; color: string; bg: string; text: string; bar: string; ring: string; icon: string }> = {
  bronze:   { label: "Bronze",   minPts: 0,    nextPts: 500,      color: "border-amber-400/40",  bg: "bg-amber-50 dark:bg-amber-900/20",   text: "text-amber-600 dark:text-amber-400",   bar: "bg-amber-500",  ring: "ring-amber-400/40",  icon: "🥉" },
  silver:   { label: "Silver",   minPts: 500,  nextPts: 2000,     color: "border-gray-400/40",   bg: "bg-gray-50 dark:bg-gray-800/40",      text: "text-gray-600 dark:text-gray-300",     bar: "bg-gray-400",   ring: "ring-gray-400/40",   icon: "🥈" },
  gold:     { label: "Gold",     minPts: 2000, nextPts: 5000,     color: "border-yellow-400/40", bg: "bg-yellow-50 dark:bg-yellow-900/20", text: "text-yellow-600 dark:text-yellow-400", bar: "bg-yellow-400", ring: "ring-yellow-400/40", icon: "🥇" },
  platinum: { label: "Platinum", minPts: 5000, nextPts: Infinity, color: "border-cyan-400/40",   bg: "bg-cyan-50 dark:bg-cyan-900/20",     text: "text-cyan-600 dark:text-cyan-400",     bar: "bg-cyan-400",   ring: "ring-cyan-400/40",   icon: "💎" },
};

const TX_CFG: Record<TxType, { label: string; color: string; bg: string }> = {
  earn:       { label: "Earned",     color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/40" },
  bonus:      { label: "Bonus",      color: "text-purple-600 dark:text-purple-400",  bg: "bg-purple-50 dark:bg-purple-500/10 border-purple-200 dark:border-purple-500/40"  },
  redeem:     { label: "Redeemed",   color: "text-rose-600 dark:text-rose-400",      bg: "bg-rose-50 dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/40"     },
  adjustment: { label: "Adjustment", color: "text-amber-600 dark:text-amber-400",    bg: "bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/40"   },
  expire:     { label: "Expired",    color: "text-gray-400",                         bg: "bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700"     },
};

const ALL_TX_TYPES: TxType[] = ["earn", "bonus", "redeem", "adjustment", "expire"];

function calcTier(pts: number): Tier {
  if (pts >= 5000) return "platinum";
  if (pts >= 2000) return "gold";
  if (pts >= 500)  return "silver";
  return "bronze";
}

function nextTier(t: Tier): Tier | null {
  return ({ bronze: "silver", silver: "gold", gold: "platinum", platinum: null } as const)[t];
}

const emptyAccountForm = () => ({ customer_name: "", customer_phone: "", customer_email: "", notes: "" });
const emptyPointsForm  = () => ({ type: "earn" as TxType, points: "", description: "", reference_id: "" });

function downloadCSV(filename: string, rows: (string | number | boolean)[]) {
  const csv = (rows as unknown as (string | number | boolean)[][]).map(r =>
    r.map((c: string | number | boolean) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(",")
  ).join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  a.download = filename;
  a.click();
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function LoyaltyPage() {
  const router     = useRouter();
  const adminEmail = useRef<string | null>(null);

  const [accounts,      setAccounts]      = useState<LoyaltyAccount[]>([]);
  const [transactions,  setTransactions]  = useState<LoyaltyTransaction[]>([]);
  const [repairTickets, setRepairTickets] = useState<RepairTicket[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [isRefreshing,  setIsRefreshing]  = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const [toast,         setToast]         = useState<{ msg: string; ok: boolean; tier?: boolean } | null>(null);

  // view state
  const [activeTab,      setActiveTab]      = useState<"members" | "transactions">("members");
  const [searchQuery,    setSearchQuery]    = useState("");
  const [tierFilter,     setTierFilter]     = useState<Tier | "all">("all");
  const [statusFilter,   setStatusFilter]   = useState<"all" | "active" | "inactive">("all");
  const [txTypeFilter,   setTxTypeFilter]   = useState<TxType | "all">("all");
  const [txMemberFilter, setTxMemberFilter] = useState<string>("all");
  const [txSearch,       setTxSearch]       = useState("");
  const [txDateFrom,     setTxDateFrom]     = useState("");
  const [txDateTo,       setTxDateTo]       = useState("");
  const [membersPage,    setMembersPage]    = useState(1);
  const MEMBERS_PER_PAGE = 12;

  // in-store lookup
  const [lookupPhone, setLookupPhone] = useState("");

  // modals
  const [isAccountFormOpen, setIsAccountFormOpen] = useState(false);
  const [isPointsModalOpen, setIsPointsModalOpen] = useState(false);
  const [isDetailOpen,      setIsDetailOpen]      = useState(false);
  const [selectedAccount,   setSelectedAccount]   = useState<LoyaltyAccount | null>(null);
  const [editingId,         setEditingId]         = useState<string | null>(null);
  const [isSaving,          setIsSaving]          = useState(false);
  const [deleteId,          setDeleteId]          = useState<string | null>(null);
  const [isDeleting,        setIsDeleting]        = useState(false);

  // forms
  const [accountForm,  setAccountForm]  = useState(emptyAccountForm());
  const [pointsForm,   setPointsForm]   = useState(emptyPointsForm());
  const [linkedTicket, setLinkedTicket] = useState("");

  const showToast = (msg: string, ok = true, tier = false) => {
    setToast({ msg, ok, tier });
    setTimeout(() => setToast(null), 4000);
  };

  // ─── Data fetching ─────────────────────────────────────────────────────────

  const fetchAccounts = useCallback(async () => {
    const { data } = await supabase.from("loyalty_accounts").select("*").order("points_balance", { ascending: false });
    if (data) setAccounts(data as LoyaltyAccount[]);
  }, []);

  const fetchTransactions = useCallback(async (accountId?: string) => {
    let q = supabase.from("loyalty_transactions").select("*").order("created_at", { ascending: false }).limit(500);
    if (accountId) q = q.eq("account_id", accountId);
    const { data } = await q;
    if (data) setTransactions(prev =>
      accountId
        ? [...prev.filter(t => t.account_id !== accountId), ...(data as LoyaltyTransaction[])]
        : data as LoyaltyTransaction[]
    );
  }, []);

  const fetchRepairTickets = useCallback(async () => {
    const { data } = await supabase
      .from("repair_tickets")
      .select("id, ticket_no, customer_name, customer_phone, device_brand, device_model, final_cost, estimated_cost, status")
      .order("created_at", { ascending: false })
      .limit(100);
    if (data) setRepairTickets(data as RepairTicket[]);
  }, []);

  const loadAll = useCallback(async (refresh = false) => {
    if (refresh) setIsRefreshing(true);
    await Promise.all([fetchAccounts(), fetchTransactions(), fetchRepairTickets()]);
    setLastRefreshed(new Date());
    setLoading(false);
    setIsRefreshing(false);
  }, [fetchAccounts, fetchTransactions, fetchRepairTickets]);

  // ─── Auth ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.push("/login"); return; }
      const role = user.user_metadata?.role || user.app_metadata?.role;
      if (role !== "admin") { router.push("/"); return; }
      adminEmail.current = user.email ?? null;
    });
    loadAll();
  }, [loadAll, router]);

  // ─── Realtime ──────────────────────────────────────────────────────────────

  useEffect(() => {
    const ch = supabase
      .channel("loyalty-rt")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "loyalty_accounts" }, ({ new: row }) => {
        setAccounts(prev => [row as LoyaltyAccount, ...prev].sort((a, b) => b.points_balance - a.points_balance));
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "loyalty_accounts" }, ({ new: row }) => {
        setAccounts(prev => prev.map(a => a.id === row.id ? row as LoyaltyAccount : a).sort((a, b) => b.points_balance - a.points_balance));
        setSelectedAccount(prev => prev?.id === row.id ? { ...prev, ...(row as LoyaltyAccount) } : prev);
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "loyalty_accounts" }, ({ old: row }) => {
        setAccounts(prev => prev.filter(a => a.id !== row.id));
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "loyalty_transactions" }, ({ new: row }) => {
        setTransactions(prev => [row as LoyaltyTransaction, ...prev]);
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  // ─── Repair ticket auto-link ────────────────────────────────────────────────

  useEffect(() => {
    if (!linkedTicket) return;
    const t = repairTickets.find(rt => rt.id === linkedTicket);
    if (!t) return;
    const cost = t.final_cost ?? t.estimated_cost ?? 0;
    const pts  = Math.max(1, Math.floor(cost / 100));
    setPointsForm(prev => ({
      ...prev,
      type:         "earn",
      points:       String(pts),
      description:  `Repair: ${t.device_brand} ${t.device_model}`.trim(),
      reference_id: t.ticket_no,
    }));
  }, [linkedTicket, repairTickets]);

  // ─── CRUD ──────────────────────────────────────────────────────────────────

  const handleSaveAccount = async () => {
    if (!accountForm.customer_name.trim() || !accountForm.customer_phone.trim()) {
      showToast("Name and phone are required", false); return;
    }
    setIsSaving(true);
    if (editingId) {
      const { error } = await supabase.from("loyalty_accounts").update(accountForm).eq("id", editingId);
      if (error) { showToast(error.message, false); setIsSaving(false); return; }
      showToast("Member updated!");
    } else {
      const { error } = await supabase.from("loyalty_accounts").insert({
        ...accountForm,
        points_balance: 0, tier: "bronze", total_earned: 0, total_redeemed: 0, is_active: true,
      });
      if (error) { showToast(error.message, false); setIsSaving(false); return; }
      showToast("Member enrolled!");
    }
    setIsSaving(false);
    setIsAccountFormOpen(false);
    setEditingId(null);
    setAccountForm(emptyAccountForm());
  };

  const handleAddPoints = async () => {
    if (!selectedAccount || !pointsForm.points || !pointsForm.description) {
      showToast("Fill all required fields", false); return;
    }
    const pts = parseInt(pointsForm.points);
    if (isNaN(pts) || pts <= 0) { showToast("Enter a valid points amount", false); return; }
    setIsSaving(true);

    const isPositive = ["earn", "bonus"].includes(pointsForm.type);
    const isNeutral  = pointsForm.type === "adjustment";
    const delta      = isNeutral ? 0 : isPositive ? pts : -pts;
    const newBalance = Math.max(0, selectedAccount.points_balance + delta);
    const oldTier    = selectedAccount.tier;
    const newTier    = calcTier(newBalance);

    const { error } = await supabase.from("loyalty_accounts").update({
      points_balance: newBalance,
      tier:           newTier,
      total_earned:   isPositive ? selectedAccount.total_earned   + pts : selectedAccount.total_earned,
      total_redeemed: pointsForm.type === "redeem" ? selectedAccount.total_redeemed + pts : selectedAccount.total_redeemed,
      last_activity:  new Date().toISOString(),
    }).eq("id", selectedAccount.id);

    if (error) { showToast(error.message, false); setIsSaving(false); return; }

    await supabase.from("loyalty_transactions").insert({
      account_id:    selectedAccount.id,
      type:          pointsForm.type,
      points:        pts,
      balance_after: newBalance,
      description:   pointsForm.description,
      reference_id:  pointsForm.reference_id || null,
      created_by:    adminEmail.current ?? "Admin",
    });

    setIsSaving(false);
    setIsPointsModalOpen(false);
    setPointsForm(emptyPointsForm());
    setLinkedTicket("");

    if (newTier !== oldTier) {
      showToast(`${TIER_CFG[newTier].icon} Tier upgrade! ${TIER_CFG[oldTier].label} → ${TIER_CFG[newTier].label}`, true, true);
    } else {
      showToast(`${delta >= 0 ? "+" : ""}${delta || "±" + pts} pts applied!`);
    }
  };

  const toggleActive = async (acct: LoyaltyAccount) => {
    const { error } = await supabase.from("loyalty_accounts").update({ is_active: !acct.is_active }).eq("id", acct.id);
    if (error) showToast("Failed to update", false);
    else showToast(acct.is_active ? "Member deactivated" : "Member reactivated");
  };

  const openDetail = (acct: LoyaltyAccount) => {
    setSelectedAccount(acct);
    setIsDetailOpen(true);
    fetchTransactions(acct.id);
  };

  const openEdit = (acct: LoyaltyAccount) => {
    setAccountForm({ customer_name: acct.customer_name, customer_phone: acct.customer_phone, customer_email: acct.customer_email || "", notes: acct.notes || "" });
    setEditingId(acct.id);
    setIsDetailOpen(false);
    setIsAccountFormOpen(true);
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    setIsDeleting(true);
    await supabase.from("loyalty_transactions").delete().eq("account_id", deleteId);
    await supabase.from("loyalty_accounts").delete().eq("id", deleteId);
    setIsDeleting(false);
    setDeleteId(null);
    if (isDetailOpen) setIsDetailOpen(false);
    showToast("Member removed");
  };

  // ─── Export ────────────────────────────────────────────────────────────────

  const exportMembers = () => {
    const header = ["Name","Phone","Email","Tier","Balance","Total Earned","Total Redeemed","Member Since","Last Activity","Active","Notes"];
    const rows   = filteredMembers.map(a => [
      a.customer_name, a.customer_phone, a.customer_email || "",
      TIER_CFG[a.tier].label, a.points_balance, a.total_earned, a.total_redeemed,
      new Date(a.member_since || a.created_at).toLocaleDateString("en-GB"),
      new Date(a.last_activity || a.created_at).toLocaleDateString("en-GB"),
      a.is_active ? "Yes" : "No", a.notes || "",
    ]);
    downloadCSV(`loyalty-members-${new Date().toISOString().slice(0,10)}.csv`, [header, ...rows] as unknown as (string | number | boolean)[]);
  };

  const exportTransactions = () => {
    const header = ["Date","Member","Phone","Type","Points","Balance After","Description","Reference","By"];
    const rows   = filteredTx.map(tx => {
      const a = accounts.find(x => x.id === tx.account_id);
      return [
        new Date(tx.created_at).toLocaleString("en-GB"),
        a?.customer_name || "—", a?.customer_phone || "—",
        TX_CFG[tx.type].label, tx.points, tx.balance_after,
        tx.description, tx.reference_id || "", tx.created_by || "",
      ];
    });
    downloadCSV(`loyalty-transactions-${new Date().toISOString().slice(0,10)}.csv`, [header, ...rows] as unknown as (string | number | boolean)[]);
  };

  // ─── Derived ───────────────────────────────────────────────────────────────

  const filteredMembers = accounts.filter(a => {
    const q     = searchQuery.toLowerCase();
    const matchQ = !q || a.customer_name.toLowerCase().includes(q) || a.customer_phone.includes(q) || (a.customer_email || "").toLowerCase().includes(q);
    const matchT = tierFilter   === "all" || a.tier === tierFilter;
    const matchS = statusFilter === "all" || (statusFilter === "active" ? a.is_active : !a.is_active);
    return matchQ && matchT && matchS;
  });

  const paginatedMembers = filteredMembers.slice(0, membersPage * MEMBERS_PER_PAGE);
  const hasMoreMembers   = paginatedMembers.length < filteredMembers.length;

  const filteredTx = transactions.filter(tx => {
    const matchType   = txTypeFilter   === "all" || tx.type        === txTypeFilter;
    const matchMember = txMemberFilter === "all" || tx.account_id  === txMemberFilter;
    const matchText   = !txSearch || tx.description.toLowerCase().includes(txSearch.toLowerCase()) || (tx.reference_id || "").toLowerCase().includes(txSearch.toLowerCase());
    const d           = new Date(tx.created_at);
    const matchFrom   = !txDateFrom || d >= new Date(txDateFrom);
    const matchTo     = !txDateTo   || d <= new Date(txDateTo + "T23:59:59");
    return matchType && matchMember && matchText && matchFrom && matchTo;
  });

  const lookupResult = lookupPhone.trim().length >= 4
    ? accounts.find(a => a.customer_phone.replace(/\D/g, "").includes(lookupPhone.replace(/\D/g, "")))
    : null;

  const now = new Date();
  const stats = {
    total:        accounts.length,
    active:       accounts.filter(a => a.is_active).length,
    totalPoints:  accounts.reduce((s, a) => s + a.points_balance, 0),
    platinum:     accounts.filter(a => a.tier === "platinum").length,
    newThisMonth: accounts.filter(a => {
      const d = new Date(a.member_since || a.created_at);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }).length,
    avgPoints: accounts.length ? Math.round(accounts.reduce((s, a) => s + a.points_balance, 0) / accounts.length) : 0,
  };

  const previewBalance = (() => {
    if (!selectedAccount || !pointsForm.points) return null;
    const pts = parseInt(pointsForm.points) || 0;
    const pos = ["earn","bonus"].includes(pointsForm.type);
    const neu = pointsForm.type === "adjustment";
    return Math.max(0, selectedAccount.points_balance + (neu ? 0 : pos ? pts : -pts));
  })();

  // ─── Loading skeleton ──────────────────────────────────────────────────────

  if (loading) return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="sticky top-0 h-14 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 animate-pulse" />
      <div className="max-w-screen-xl mx-auto px-4 md:px-6 py-6 space-y-5">
        <div className="h-24 bg-gray-200 dark:bg-gray-800 rounded-2xl animate-pulse" />
        <div className="grid grid-cols-3 lg:grid-cols-6 gap-3">
          {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-20 bg-gray-200 dark:bg-gray-800 rounded-xl animate-pulse" />)}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-52 bg-gray-200 dark:bg-gray-800 rounded-2xl animate-pulse" />)}
        </div>
      </div>
    </div>
  );

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-white">

      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-[100] px-4 py-3 rounded-xl text-sm font-semibold shadow-2xl border pointer-events-none ${
          toast.tier ? "bg-gradient-to-r from-purple-500/30 to-cyan-500/30 border-purple-400/50 text-white" :
          toast.ok   ? "bg-emerald-50 dark:bg-emerald-500/20 border-emerald-200 dark:border-emerald-500/40 text-emerald-700 dark:text-emerald-300" :
                       "bg-rose-50 dark:bg-rose-500/20 border-rose-200 dark:border-rose-500/40 text-rose-700 dark:text-rose-300"
        }`}>{toast.msg}</div>
      )}

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-30 bg-white/95 dark:bg-gray-900/95 backdrop-blur-md border-b border-gray-200 dark:border-gray-800">
        <div className="max-w-screen-xl mx-auto px-4 md:px-6 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Link href="/dashboard" className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors flex-shrink-0">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
              Dashboard
            </Link>
            <span className="text-gray-300 dark:text-gray-700 flex-shrink-0">|</span>
            <div className="flex items-center gap-2 min-w-0">
              <svg className="w-4 h-4 text-cyan-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              <h1 className="font-bold text-gray-900 dark:text-white truncate">Loyalty Program</h1>
              <span className="text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 px-2 py-0.5 rounded-full flex-shrink-0">{accounts.length} members</span>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {lastRefreshed && (
              <span className="hidden md:block text-[11px] text-gray-400">
                {lastRefreshed.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
              </span>
            )}
            <button onClick={() => loadAll(true)} disabled={isRefreshing} title="Refresh"
              className="p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white transition-all disabled:opacity-50">
              <svg className={`w-4 h-4 ${isRefreshing ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
            </button>
            <button onClick={() => { setAccountForm(emptyAccountForm()); setEditingId(null); setIsAccountFormOpen(true); }}
              className="flex items-center gap-1.5 px-4 py-1.5 text-xs bg-cyan-500 hover:bg-cyan-400 text-black font-bold rounded-lg transition-all">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
              Enroll Member
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-screen-xl mx-auto px-4 md:px-6 py-6 space-y-5">

        {/* ── In-Store Lookup ───────────────────────────────────────────────── */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <svg className="w-4 h-4 text-cyan-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
            <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">In-Store Lookup</p>
          </div>
          <div className="flex gap-3 items-center">
            <div className="relative flex-1 max-w-sm">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              <input value={lookupPhone} onChange={e => setLookupPhone(e.target.value)} placeholder="Customer phone…"
                className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl pl-10 pr-3 py-2.5 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/10 transition-all" />
            </div>
            {lookupPhone && <button onClick={() => setLookupPhone("")} className="text-xs text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors">Clear</button>}
          </div>

          {lookupPhone.trim().length >= 4 && (
            <div className="mt-4">
              {lookupResult ? (
                <div className={`flex items-center justify-between rounded-xl border p-4 gap-4 ${TIER_CFG[lookupResult.tier].bg} ${TIER_CFG[lookupResult.tier].color}`}>
                  <div className="min-w-0">
                    <p className="font-bold text-gray-900 dark:text-white text-lg truncate">{lookupResult.customer_name}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{lookupResult.customer_phone}</p>
                    {!lookupResult.is_active && <p className="text-xs text-rose-500 font-semibold mt-0.5">Account deactivated</p>}
                  </div>
                  <div className="text-center flex-shrink-0">
                    <p className={`text-4xl font-black ${TIER_CFG[lookupResult.tier].text}`}>{lookupResult.points_balance.toLocaleString()}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{TIER_CFG[lookupResult.tier].icon} {TIER_CFG[lookupResult.tier].label}</p>
                  </div>
                  <div className="flex flex-col gap-2 flex-shrink-0">
                    <button onClick={() => { setSelectedAccount(lookupResult); setIsPointsModalOpen(true); setLookupPhone(""); }}
                      className="px-4 py-2 text-sm font-bold bg-cyan-500 hover:bg-cyan-400 text-black rounded-lg transition-all">+ Points</button>
                    <button onClick={() => { openDetail(lookupResult); setLookupPhone(""); }}
                      className="px-4 py-2 text-xs font-medium bg-white/80 dark:bg-gray-800 hover:bg-white dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-600 rounded-lg transition-all">
                      View Profile
                    </button>
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 p-4 flex items-center justify-between gap-4">
                  <p className="text-sm text-gray-500">No member found for that number.</p>
                  <button onClick={() => { setAccountForm({ ...emptyAccountForm(), customer_phone: lookupPhone }); setEditingId(null); setIsAccountFormOpen(true); setLookupPhone(""); }}
                    className="text-xs font-semibold text-cyan-600 dark:text-cyan-400 border border-cyan-300 dark:border-cyan-500/40 hover:bg-cyan-50 dark:hover:bg-cyan-500/10 px-3 py-1.5 rounded-lg transition-all flex-shrink-0">
                    Enroll now →
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Stats ─────────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { label: "Total Members",    value: stats.total,                        color: "text-cyan-600 dark:text-cyan-400",    bg: "bg-cyan-50 dark:bg-cyan-500/10 border-cyan-200 dark:border-cyan-500/20"    },
            { label: "Active",           value: stats.active,                       color: "text-emerald-600 dark:text-emerald-400",bg:"bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20"},
            { label: "New This Month",   value: stats.newThisMonth,                 color: "text-indigo-600 dark:text-indigo-400", bg: "bg-indigo-50 dark:bg-indigo-500/10 border-indigo-200 dark:border-indigo-500/20" },
            { label: "Points in Circ.", value: stats.totalPoints.toLocaleString(), color: "text-yellow-600 dark:text-yellow-400", bg: "bg-yellow-50 dark:bg-yellow-500/10 border-yellow-200 dark:border-yellow-500/20" },
            { label: "Avg Balance",      value: stats.avgPoints.toLocaleString(),   color: "text-purple-600 dark:text-purple-400", bg: "bg-purple-50 dark:bg-purple-500/10 border-purple-200 dark:border-purple-500/20" },
            { label: "Platinum",         value: stats.platinum,                     color: "text-cyan-600 dark:text-cyan-400",    bg: "bg-cyan-50 dark:bg-cyan-500/10 border-cyan-200 dark:border-cyan-500/20"    },
          ].map(s => (
            <div key={s.label} className={`rounded-xl border p-4 ${s.bg}`}>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1 leading-tight">{s.label}</p>
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* ── Tier filter pills ─────────────────────────────────────────────── */}
        <div className="flex flex-wrap items-center gap-2">
          {(["bronze","silver","gold","platinum"] as Tier[]).map(t => {
            const cfg   = TIER_CFG[t];
            const count = accounts.filter(a => a.tier === t).length;
            const pct   = accounts.length ? Math.round((count / accounts.length) * 100) : 0;
            const on    = tierFilter === t;
            return (
              <button key={t} onClick={() => { setTierFilter(on ? "all" : t); setMembersPage(1); }}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl border text-sm font-medium transition-all ${
                  on ? `${cfg.bg} ${cfg.color} ring-2 ${cfg.ring}` : "bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 text-gray-500 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-700"
                }`}>
                <span>{cfg.icon}</span>
                <span className="hidden sm:inline">{cfg.label}</span>
                <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${on ? cfg.text + " bg-white/40 dark:bg-black/20" : "bg-gray-100 dark:bg-gray-800 text-gray-400"}`}>
                  {count} · {pct}%
                </span>
              </button>
            );
          })}
          <div className="ml-auto flex gap-1">
            {(["all","active","inactive"] as const).map(s => (
              <button key={s} onClick={() => { setStatusFilter(s); setMembersPage(1); }}
                className={`px-3 py-2 text-xs font-medium rounded-lg border transition-all capitalize ${
                  statusFilter === s
                    ? s === "active"   ? "bg-emerald-50 dark:bg-emerald-500/10 border-emerald-300 dark:border-emerald-500/40 text-emerald-700 dark:text-emerald-400"
                    : s === "inactive" ? "bg-rose-50 dark:bg-rose-500/10 border-rose-300 dark:border-rose-500/40 text-rose-700 dark:text-rose-400"
                    : "bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300"
                    : "bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                }`}>{s}</button>
            ))}
          </div>
        </div>

        {/* ── Tabs + Export ─────────────────────────────────────────────────── */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex gap-1 p-1 bg-gray-100 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl w-fit">
            {(["members","transactions"] as const).map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className={`px-5 py-1.5 rounded-lg text-sm font-medium transition-all capitalize ${
                  activeTab === tab ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm" : "text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                }`}>
                {tab}
                {tab === "transactions" && transactions.length > 0 && (
                  <span className="ml-1.5 text-[10px] text-gray-400">{transactions.length}</span>
                )}
              </button>
            ))}
          </div>
          <button onClick={activeTab === "members" ? exportMembers : exportTransactions}
            className="ml-auto flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-all bg-white dark:bg-gray-900">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
            Export CSV
          </button>
        </div>

        {/* ══ MEMBERS TAB ════════════════════════════════════════════════════════ */}
        {activeTab === "members" && (
          <>
            <div className="flex gap-2 flex-wrap items-center">
              <div className="relative flex-1 min-w-[200px]">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                <input value={searchQuery} onChange={e => { setSearchQuery(e.target.value); setMembersPage(1); }} placeholder="Search name, phone, email…"
                  className="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl pl-9 pr-3 py-2.5 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/10 transition-all" />
              </div>
              {(searchQuery || tierFilter !== "all" || statusFilter !== "all") && (
                <button onClick={() => { setSearchQuery(""); setTierFilter("all"); setStatusFilter("all"); setMembersPage(1); }}
                  className="px-3 py-2.5 text-xs text-gray-500 hover:text-gray-900 dark:hover:text-white border border-gray-200 dark:border-gray-700 rounded-xl transition-all bg-white dark:bg-gray-900">
                  Clear filters
                </button>
              )}
              <p className="text-xs text-gray-400">{filteredMembers.length} result{filteredMembers.length !== 1 ? "s" : ""}</p>
            </div>

            {filteredMembers.length === 0 ? (
              <div className="text-center py-20">
                <p className="text-5xl mb-4">👥</p>
                <p className="font-semibold text-gray-600 dark:text-gray-300 mb-1">No members found</p>
                <p className="text-sm text-gray-400 mb-5">Try adjusting your filters or enroll a new member</p>
                <button onClick={() => { setAccountForm(emptyAccountForm()); setEditingId(null); setIsAccountFormOpen(true); }}
                  className="px-5 py-2 text-sm bg-cyan-500 hover:bg-cyan-400 text-black font-bold rounded-xl transition-all">
                  Enroll First Member
                </button>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {paginatedMembers.map(acct => {
                    const cfg  = TIER_CFG[acct.tier];
                    const nt   = nextTier(acct.tier);
                    const pct  = acct.tier === "platinum" ? 100
                      : Math.min(100, ((acct.points_balance - cfg.minPts) / (cfg.nextPts - cfg.minPts)) * 100);
                    const txCount = transactions.filter(t => t.account_id === acct.id).length;

                    return (
                      <div key={acct.id} onClick={() => openDetail(acct)}
                        className={`bg-white dark:bg-gray-900 border rounded-2xl p-5 cursor-pointer transition-all hover:shadow-lg hover:shadow-black/5 dark:hover:shadow-black/30 hover:-translate-y-0.5 ${cfg.color} ${!acct.is_active ? "opacity-50 grayscale" : ""}`}>
                        <div className="flex items-start justify-between mb-3 gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="font-bold text-gray-900 dark:text-white text-base truncate">{acct.customer_name}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">{acct.customer_phone}</p>
                            {acct.customer_email && <p className="text-xs text-gray-400 truncate">{acct.customer_email}</p>}
                          </div>
                          <div className="flex flex-col items-end gap-1 flex-shrink-0">
                            {!acct.is_active && <span className="text-[10px] text-rose-500 font-bold bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 px-1.5 py-0.5 rounded-full">Inactive</span>}
                            <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${cfg.bg} ${cfg.color}`}>{cfg.icon} {cfg.label}</span>
                          </div>
                        </div>

                        <div className="mb-3">
                          <div className="flex items-baseline justify-between mb-1.5">
                            <span className={`text-3xl font-black ${cfg.text}`}>{acct.points_balance.toLocaleString()}</span>
                            <span className="text-xs text-gray-400">pts</span>
                          </div>
                          <div className="w-full h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full transition-all duration-700 ${cfg.bar}`} style={{ width: `${pct}%` }} />
                          </div>
                          {nt ? (
                            <p className="text-[10px] text-gray-400 mt-1">{(cfg.nextPts - acct.points_balance).toLocaleString()} pts to {TIER_CFG[nt].label} {TIER_CFG[nt].icon}</p>
                          ) : (
                            <p className="text-[10px] text-cyan-500 mt-1">Maximum tier 💎</p>
                          )}
                        </div>

                        <div className="flex justify-between text-xs text-gray-400 mb-3">
                          <span>Earned <span className="text-gray-700 dark:text-gray-200 font-semibold">{acct.total_earned.toLocaleString()}</span></span>
                          <span>Redeemed <span className="text-gray-700 dark:text-gray-200 font-semibold">{acct.total_redeemed.toLocaleString()}</span></span>
                          {txCount > 0 && <span className="text-gray-400">{txCount} tx</span>}
                        </div>

                        <div className="flex gap-2 pt-3 border-t border-gray-100 dark:border-gray-800">
                          <button onClick={e => { e.stopPropagation(); setSelectedAccount(acct); setIsPointsModalOpen(true); }}
                            className="flex-1 py-1.5 text-xs font-semibold bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 border border-cyan-200 dark:border-cyan-500/30 rounded-lg transition-all">
                            + Points
                          </button>
                          <button onClick={e => { e.stopPropagation(); openEdit(acct); }}
                            className="px-3 py-1.5 text-xs bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 rounded-lg transition-all">
                            Edit
                          </button>
                          <button onClick={e => { e.stopPropagation(); toggleActive(acct); }}
                            className={`px-3 py-1.5 text-xs border rounded-lg transition-all ${
                              acct.is_active
                                ? "bg-gray-50 dark:bg-gray-800 hover:bg-rose-50 dark:hover:bg-rose-500/10 text-gray-400 hover:text-rose-500 border-gray-200 dark:border-gray-700 hover:border-rose-200 dark:hover:border-rose-500/40"
                                : "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/30"
                            }`}>
                            {acct.is_active ? "Deactivate" : "Reactivate"}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
                {hasMoreMembers && (
                  <div className="flex justify-center pt-2">
                    <button onClick={() => setMembersPage(p => p + 1)}
                      className="px-8 py-2.5 text-sm font-semibold text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-white dark:hover:bg-gray-800 bg-gray-50 dark:bg-gray-900 transition-all">
                      Show more ({filteredMembers.length - paginatedMembers.length} remaining)
                    </button>
                  </div>
                )}
              </>
            )}
          </>
        )}

        {/* ══ TRANSACTIONS TAB ════════════════════════════════════════════════════ */}
        {activeTab === "transactions" && (
          <>
            <div className="flex flex-wrap gap-2 items-center">
              <div className="relative">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                <input value={txSearch} onChange={e => setTxSearch(e.target.value)} placeholder="Search description / ref…"
                  className="pl-9 pr-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/10 transition-all w-52" />
              </div>
              <select value={txTypeFilter} onChange={e => setTxTypeFilter(e.target.value as TxType | "all")}
                className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-cyan-500 transition-all">
                <option value="all">All Types</option>
                {ALL_TX_TYPES.map(t => <option key={t} value={t}>{TX_CFG[t].label}</option>)}
              </select>
              <select value={txMemberFilter} onChange={e => setTxMemberFilter(e.target.value)}
                className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-cyan-500 transition-all max-w-[160px]">
                <option value="all">All Members</option>
                {accounts.map(a => <option key={a.id} value={a.id}>{a.customer_name}</option>)}
              </select>
              <div className="flex items-center gap-1">
                <input type="date" value={txDateFrom} onChange={e => setTxDateFrom(e.target.value)} title="From"
                  className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-cyan-500 transition-all" />
                <span className="text-gray-400 text-xs px-1">→</span>
                <input type="date" value={txDateTo} onChange={e => setTxDateTo(e.target.value)} title="To"
                  className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-cyan-500 transition-all" />
              </div>
              {(txTypeFilter !== "all" || txMemberFilter !== "all" || txSearch || txDateFrom || txDateTo) && (
                <button onClick={() => { setTxTypeFilter("all"); setTxMemberFilter("all"); setTxSearch(""); setTxDateFrom(""); setTxDateTo(""); }}
                  className="px-3 py-2 text-xs text-gray-400 hover:text-gray-900 dark:hover:text-white border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-900 transition-all">
                  Clear
                </button>
              )}
              <p className="text-xs text-gray-400 ml-1">{filteredTx.length} transactions</p>
            </div>

            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden">
              {filteredTx.length === 0 ? (
                <div className="py-16 text-center">
                  <p className="text-3xl mb-3">📋</p>
                  <p className="text-sm text-gray-400">No transactions found</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/60">
                        {["Date","Member","Type","Points","Balance After","Description","Ref","By"].map(h => (
                          <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredTx.map((tx, i) => {
                        const acct = accounts.find(a => a.id === tx.account_id);
                        const cfg  = TX_CFG[tx.type];
                        const isPos = ["earn","bonus"].includes(tx.type);
                        const isNeg = ["redeem","expire"].includes(tx.type);
                        return (
                          <tr key={tx.id} className={`border-b border-gray-50 dark:border-gray-800/40 hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors ${i % 2 === 1 ? "bg-gray-50/50 dark:bg-gray-900/30" : ""}`}>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <p className="text-xs text-gray-700 dark:text-gray-300">{new Date(tx.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</p>
                              <p className="text-[10px] text-gray-400">{new Date(tx.created_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}</p>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              {acct ? (
                                <button onClick={() => openDetail(acct)} className="text-left hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors">
                                  <p className="text-sm font-medium text-gray-900 dark:text-white">{acct.customer_name}</p>
                                  <p className="text-[10px] text-gray-400">{acct.customer_phone}</p>
                                </button>
                              ) : <span className="text-gray-400">—</span>}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${cfg.bg} ${cfg.color}`}>{cfg.label}</span>
                            </td>
                            <td className={`px-4 py-3 font-bold whitespace-nowrap ${cfg.color}`}>
                              {isPos ? "+" : isNeg ? "−" : "±"}{tx.points.toLocaleString()}
                            </td>
                            <td className="px-4 py-3 text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">{tx.balance_after.toLocaleString()}</td>
                            <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 max-w-[200px] truncate" title={tx.description}>{tx.description}</td>
                            <td className="px-4 py-3 text-xs text-gray-400 font-mono whitespace-nowrap">{tx.reference_id || "—"}</td>
                            <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">{tx.created_by || "—"}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* ── Enroll / Edit Modal ──────────────────────────────────────────────── */}
      {isAccountFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setIsAccountFormOpen(false)}>
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800">
              <h2 className="font-bold text-lg text-gray-900 dark:text-white">{editingId ? "Edit Member" : "Enroll New Member"}</h2>
              <button onClick={() => setIsAccountFormOpen(false)} className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 transition-all">✕</button>
            </div>
            <div className="px-6 py-5 space-y-3">
              {([
                { label: "Full Name *",   key: "customer_name"  as const, placeholder: "John Doe",         type: "text"  },
                { label: "Phone *",       key: "customer_phone" as const, placeholder: "+230 5XXX XXXX",   type: "tel"   },
                { label: "Email",         key: "customer_email" as const, placeholder: "email@example.com", type: "email" },
              ]).map(({ label, key, placeholder, type }) => (
                <div key={key}>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">{label}</label>
                  <input type={type} value={accountForm[key]} onChange={e => setAccountForm(p => ({ ...p, [key]: e.target.value }))} placeholder={placeholder}
                    className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3.5 py-2.5 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/10 transition-all" />
                </div>
              ))}
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Notes</label>
                <textarea value={accountForm.notes} onChange={e => setAccountForm(p => ({ ...p, notes: e.target.value }))} rows={2} placeholder="Internal notes…"
                  className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3.5 py-2.5 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/10 transition-all resize-none" />
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100 dark:border-gray-800">
              <button onClick={() => setIsAccountFormOpen(false)} className="px-4 py-2 text-sm text-gray-500 border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-all">Cancel</button>
              <button onClick={handleSaveAccount} disabled={isSaving}
                className="px-5 py-2 text-sm bg-cyan-500 hover:bg-cyan-400 text-black font-bold rounded-xl transition-all disabled:opacity-50">
                {isSaving ? "Saving…" : editingId ? "Save Changes" : "Enroll"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Points Modal ─────────────────────────────────────────────────────── */}
      {isPointsModalOpen && selectedAccount && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={() => { setIsPointsModalOpen(false); setLinkedTicket(""); setPointsForm(emptyPointsForm()); }}>
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className={`px-6 py-4 border-b border-gray-100 dark:border-gray-800 ${TIER_CFG[selectedAccount.tier].bg}`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className={`text-xs font-bold ${TIER_CFG[selectedAccount.tier].text}`}>{TIER_CFG[selectedAccount.tier].icon} {TIER_CFG[selectedAccount.tier].label} Member</p>
                  <h2 className="font-bold text-lg text-gray-900 dark:text-white">{selectedAccount.customer_name}</h2>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-400">Balance</p>
                  <p className={`text-2xl font-black ${TIER_CFG[selectedAccount.tier].text}`}>{selectedAccount.points_balance.toLocaleString()}</p>
                </div>
              </div>
            </div>

            <div className="px-6 py-5 space-y-4">
              {/* Link repair ticket */}
              {repairTickets.length > 0 && (
                <div>
                  <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">
                    Link Repair Ticket <span className="normal-case font-normal">(auto-fills form)</span>
                  </label>
                  <select value={linkedTicket} onChange={e => setLinkedTicket(e.target.value)}
                    className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3.5 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/10 transition-all">
                    <option value="">— None —</option>
                    {repairTickets.map(t => (
                      <option key={t.id} value={t.id}>
                        {t.ticket_no} · {t.device_brand} {t.device_model} · Rs {(t.final_cost ?? t.estimated_cost ?? 0).toLocaleString()} · {t.status}
                      </option>
                    ))}
                  </select>
                  {linkedTicket && <p className="text-[10px] text-cyan-600 dark:text-cyan-400 mt-1">1 pt per Rs 100 spent · form auto-filled below</p>}
                </div>
              )}

              {/* Type selector */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Transaction Type</label>
                <div className="grid grid-cols-5 gap-1.5">
                  {ALL_TX_TYPES.map(t => {
                    const cfg  = TX_CFG[t];
                    const active = pointsForm.type === t;
                    return (
                      <button key={t} onClick={() => setPointsForm(p => ({ ...p, type: t }))}
                        className={`py-1.5 text-xs font-semibold rounded-lg border transition-all ${active ? `${cfg.bg} ${cfg.color}` : "bg-gray-50 dark:bg-gray-800 text-gray-400 border-gray-200 dark:border-gray-700 hover:border-gray-400"}`}>
                        {cfg.label}
                      </button>
                    );
                  })}
                </div>
                {pointsForm.type === "adjustment" && <p className="text-[10px] text-amber-500 mt-1.5">Records the points but does not change the balance.</p>}
              </div>

              {/* Points */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">Points *</label>
                <input type="number" min={1} value={pointsForm.points} onChange={e => setPointsForm(p => ({ ...p, points: e.target.value }))} placeholder="e.g. 50"
                  className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3.5 py-2.5 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/10 transition-all" />
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">Description *</label>
                <input value={pointsForm.description} onChange={e => setPointsForm(p => ({ ...p, description: e.target.value }))} placeholder="e.g. Screen repair · Rs 3,500"
                  className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3.5 py-2.5 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/10 transition-all" />
              </div>

              {/* Reference */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">Reference <span className="normal-case font-normal text-gray-400">(optional)</span></label>
                <input value={pointsForm.reference_id} onChange={e => setPointsForm(p => ({ ...p, reference_id: e.target.value }))} placeholder="Invoice / Ticket No"
                  className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3.5 py-2.5 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/10 transition-all" />
              </div>

              {/* Balance preview */}
              {previewBalance !== null && pointsForm.type !== "adjustment" && (
                <div className={`rounded-xl border p-4 ${
                  ["earn","bonus"].includes(pointsForm.type)
                    ? "bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30"
                    : "bg-rose-50 dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/30"
                }`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-gray-400 mb-0.5">New balance</p>
                      <p className={`text-3xl font-black ${["earn","bonus"].includes(pointsForm.type) ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                        {previewBalance.toLocaleString()}
                      </p>
                    </div>
                    {calcTier(previewBalance) !== selectedAccount.tier && (
                      <div className={`px-3 py-2 rounded-lg text-right ${TIER_CFG[calcTier(previewBalance)].bg}`}>
                        <p className="text-xs text-gray-400">Tier change</p>
                        <p className={`text-sm font-bold ${TIER_CFG[calcTier(previewBalance)].text}`}>
                          {TIER_CFG[selectedAccount.tier].label} → {TIER_CFG[calcTier(previewBalance)].label} {TIER_CFG[calcTier(previewBalance)].icon}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100 dark:border-gray-800">
              <button onClick={() => { setIsPointsModalOpen(false); setLinkedTicket(""); setPointsForm(emptyPointsForm()); }}
                className="px-4 py-2 text-sm text-gray-500 border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-all">Cancel</button>
              <button onClick={handleAddPoints} disabled={isSaving}
                className="px-5 py-2 text-sm bg-cyan-500 hover:bg-cyan-400 text-black font-bold rounded-xl transition-all disabled:opacity-50">
                {isSaving ? "Saving…" : "Apply Points"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Detail Modal ─────────────────────────────────────────────────────── */}
      {isDetailOpen && selectedAccount && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 backdrop-blur-sm overflow-y-auto p-4" onClick={() => setIsDetailOpen(false)}>
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl w-full max-w-lg my-4 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className={`px-6 py-5 border-b border-gray-100 dark:border-gray-800 rounded-t-2xl ${TIER_CFG[selectedAccount.tier].bg}`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className={`text-xs font-bold uppercase tracking-wider mb-1 ${TIER_CFG[selectedAccount.tier].text}`}>
                    {TIER_CFG[selectedAccount.tier].icon} {TIER_CFG[selectedAccount.tier].label} Member
                  </p>
                  <h2 className="font-bold text-xl text-gray-900 dark:text-white">{selectedAccount.customer_name}</h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{selectedAccount.customer_phone}</p>
                  {selectedAccount.customer_email && <p className="text-xs text-gray-400">{selectedAccount.customer_email}</p>}
                  {!selectedAccount.is_active && (
                    <span className="inline-block mt-1 text-xs text-rose-500 font-semibold bg-rose-50 dark:bg-rose-500/10 px-2 py-0.5 rounded-full border border-rose-200 dark:border-rose-500/30">Inactive</span>
                  )}
                </div>
                <button onClick={() => setIsDetailOpen(false)}
                  className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-white/60 dark:hover:bg-gray-800/60 transition-all flex-shrink-0">✕</button>
              </div>
            </div>

            <div className="px-6 py-5 space-y-5 max-h-[calc(100vh-200px)] overflow-y-auto">
              {/* Points summary */}
              <div className="text-center">
                <p className={`text-6xl font-black ${TIER_CFG[selectedAccount.tier].text}`}>{selectedAccount.points_balance.toLocaleString()}</p>
                <p className="text-sm text-gray-400 mt-1">points balance</p>
                <div className="flex justify-center gap-8 mt-3 text-xs text-gray-400">
                  <span>Earned <span className="text-gray-900 dark:text-white font-bold">{selectedAccount.total_earned.toLocaleString()}</span></span>
                  <span>Redeemed <span className="text-gray-900 dark:text-white font-bold">{selectedAccount.total_redeemed.toLocaleString()}</span></span>
                </div>
              </div>

              {/* Tier progress */}
              {selectedAccount.tier !== "platinum" && (() => {
                const cfg = TIER_CFG[selectedAccount.tier];
                const nt  = nextTier(selectedAccount.tier)!;
                const pct = Math.min(100, ((selectedAccount.points_balance - cfg.minPts) / (cfg.nextPts - cfg.minPts)) * 100);
                return (
                  <div className={`rounded-xl border p-4 ${cfg.bg} ${cfg.color}`}>
                    <div className="flex justify-between text-xs mb-2">
                      <span className={cfg.text}>{cfg.label}</span>
                      <span className="text-gray-400">{(cfg.nextPts - selectedAccount.points_balance).toLocaleString()} pts to {TIER_CFG[nt].label} {TIER_CFG[nt].icon}</span>
                    </div>
                    <div className="h-2.5 bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${cfg.bar}`} style={{ width: `${pct}%` }} />
                    </div>
                    <p className="text-[10px] text-gray-400 mt-1.5 text-right">{Math.round(pct)}% to next tier</p>
                  </div>
                );
              })()}

              {/* Meta */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                {[
                  { label: "Member Since",       value: new Date(selectedAccount.member_since || selectedAccount.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) },
                  { label: "Last Activity",       value: new Date(selectedAccount.last_activity || selectedAccount.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) },
                  { label: "Total Transactions",  value: transactions.filter(t => t.account_id === selectedAccount.id).length },
                  { label: "Net Points",          value: (selectedAccount.total_earned - selectedAccount.total_redeemed).toLocaleString() },
                ].map(({ label, value }) => (
                  <div key={label} className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-3">
                    <p className="text-gray-400 mb-0.5">{label}</p>
                    <p className="text-gray-900 dark:text-white font-semibold">{value}</p>
                  </div>
                ))}
              </div>

              {selectedAccount.notes && (
                <div className="bg-amber-50 dark:bg-amber-500/5 border border-amber-100 dark:border-amber-500/20 rounded-xl px-3.5 py-2.5 text-xs text-gray-500 dark:text-gray-400">
                  <span className="font-semibold text-amber-600 dark:text-amber-400">Note: </span>{selectedAccount.notes}
                </div>
              )}

              {/* Transaction history */}
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Transaction History</p>
                {transactions.filter(t => t.account_id === selectedAccount.id).length === 0 ? (
                  <div className="text-center py-8 text-gray-400">
                    <p className="text-2xl mb-2">🎯</p>
                    <p className="text-sm">No transactions yet. Award the first points!</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {transactions.filter(t => t.account_id === selectedAccount.id).map(tx => {
                      const cfg  = TX_CFG[tx.type];
                      const isPos = ["earn","bonus"].includes(tx.type);
                      const isNeg = ["redeem","expire"].includes(tx.type);
                      return (
                        <div key={tx.id} className="flex items-center justify-between bg-gray-50 dark:bg-gray-800/40 border border-gray-100 dark:border-gray-800 rounded-xl px-3.5 py-3 gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${cfg.bg} ${cfg.color}`}>{cfg.label}</span>
                              {tx.reference_id && <span className="text-[10px] text-gray-400 font-mono truncate">{tx.reference_id}</span>}
                            </div>
                            <p className="text-sm text-gray-900 dark:text-white truncate">{tx.description}</p>
                            <p className="text-[10px] text-gray-400 mt-0.5">
                              {new Date(tx.created_at).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })} · {tx.created_by || "Admin"}
                            </p>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className={`font-bold text-base ${cfg.color}`}>{isPos ? "+" : isNeg ? "−" : "±"}{tx.points.toLocaleString()}</p>
                            <p className="text-[10px] text-gray-400">{tx.balance_after.toLocaleString()} bal</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-gray-100 dark:border-gray-800">
              <button onClick={() => setDeleteId(selectedAccount.id)}
                className="px-4 py-2 text-sm text-rose-500 hover:text-rose-400 border border-rose-200 dark:border-rose-500/30 rounded-xl transition-all hover:bg-rose-50 dark:hover:bg-rose-500/10">
                Remove
              </button>
              <div className="flex gap-2">
                <button onClick={() => toggleActive(selectedAccount)}
                  className={`px-4 py-2 text-sm rounded-xl border transition-all ${
                    selectedAccount.is_active
                      ? "text-gray-500 border-gray-200 dark:border-gray-700 hover:bg-rose-50 dark:hover:bg-rose-500/10 hover:text-rose-500 hover:border-rose-200 dark:hover:border-rose-500/40"
                      : "text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/30 hover:bg-emerald-50 dark:hover:bg-emerald-500/10"
                  }`}>
                  {selectedAccount.is_active ? "Deactivate" : "Reactivate"}
                </button>
                <button onClick={() => openEdit(selectedAccount)}
                  className="px-4 py-2 text-sm bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-900 dark:text-white rounded-xl transition-all">
                  Edit
                </button>
                <button onClick={() => { setIsDetailOpen(false); setIsPointsModalOpen(true); }}
                  className="px-4 py-2 text-sm bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 border border-cyan-200 dark:border-cyan-500/30 rounded-xl font-semibold transition-all">
                  + Points
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Confirm ───────────────────────────────────────────────────── */}
      {deleteId && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setDeleteId(null)}>
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl p-6 max-w-sm w-full shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="w-12 h-12 rounded-full bg-rose-100 dark:bg-rose-500/10 flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" /></svg>
            </div>
            <p className="font-bold text-gray-900 dark:text-white text-center mb-2">Remove this member?</p>
            <p className="text-gray-400 text-sm text-center mb-5">All transaction history will be permanently deleted.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteId(null)} className="flex-1 py-2.5 text-sm text-gray-500 border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-all">Cancel</button>
              <button onClick={confirmDelete} disabled={isDeleting}
                className="flex-1 py-2.5 text-sm bg-rose-500 hover:bg-rose-400 text-white font-bold rounded-xl transition-all disabled:opacity-50">
                {isDeleting ? "Removing…" : "Remove"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
