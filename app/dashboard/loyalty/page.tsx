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

// ─── Constants ────────────────────────────────────────────────────────────────

const TIER_CFG: Record<Tier, { label: string; minPts: number; nextPts: number; color: string; bg: string; text: string; bar: string; icon: string }> = {
  bronze:   { label: "Bronze",   minPts: 0,    nextPts: 500,      color: "border-amber-700/60",  bg: "bg-amber-900/20",   text: "text-amber-500",   bar: "bg-amber-600",    icon: "🥉" },
  silver:   { label: "Silver",   minPts: 500,  nextPts: 2000,     color: "border-gray-500/60",   bg: "bg-gray-100 dark:bg-gray-700/20",    text: "text-gray-500",    bar: "bg-gray-400",     icon: "🥈" },
  gold:     { label: "Gold",     minPts: 2000, nextPts: 5000,     color: "border-yellow-500/60", bg: "bg-yellow-900/20",  text: "text-yellow-400",  bar: "bg-yellow-400",   icon: "🥇" },
  platinum: { label: "Platinum", minPts: 5000, nextPts: Infinity, color: "border-cyan-500/60",   bg: "bg-cyan-900/20",    text: "text-cyan-400",    bar: "bg-cyan-400",     icon: "💎" },
};

const TX_CFG: Record<TxType, { label: string; color: string; sign: string; bg: string }> = {
  earn:       { label: "Earned",     color: "text-emerald-400", sign: "+", bg: "bg-emerald-500/10 border-emerald-500/40" },
  bonus:      { label: "Bonus",      color: "text-purple-400",  sign: "+", bg: "bg-purple-500/10 border-purple-500/40"  },
  redeem:     { label: "Redeemed",   color: "text-rose-400",    sign: "−", bg: "bg-rose-500/10 border-rose-500/40"     },
  adjustment: { label: "Adjustment", color: "text-amber-400",   sign: "±", bg: "bg-amber-500/10 border-amber-500/40"   },
  expire:     { label: "Expired",    color: "text-gray-500",    sign: "−", bg: "bg-gray-700/40 border-gray-600/40"     },
};

const ALL_TX_TYPES: TxType[] = ["earn", "bonus", "redeem", "adjustment", "expire"];

function calcTier(pts: number): Tier {
  if (pts >= 5000) return "platinum";
  if (pts >= 2000) return "gold";
  if (pts >= 500)  return "silver";
  return "bronze";
}

const emptyAccountForm = () => ({ customer_name: "", customer_phone: "", customer_email: "", notes: "" });
const emptyPointsForm  = () => ({ type: "earn" as TxType, points: "", description: "", reference_id: "" });

// ─── Component ────────────────────────────────────────────────────────────────

export default function LoyaltyPage() {
  const router   = useRouter();
  const adminEmail = useRef<string | null>(null);

  const [accounts,     setAccounts]     = useState<LoyaltyAccount[]>([]);
  const [transactions, setTransactions] = useState<LoyaltyTransaction[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [toast,        setToast]        = useState<{ msg: string; type: "success" | "error" } | null>(null);

  // view
  const [activeTab,      setActiveTab]      = useState<"members" | "transactions">("members");
  const [searchQuery,    setSearchQuery]    = useState("");
  const [tierFilter,     setTierFilter]     = useState<Tier | "all">("all");
  const [txTypeFilter,   setTxTypeFilter]   = useState<TxType | "all">("all");
  const [txMemberFilter, setTxMemberFilter] = useState<string>("all");

  // lookup (in-store)
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
  const [accountForm, setAccountForm] = useState(emptyAccountForm());
  const [pointsForm,  setPointsForm]  = useState(emptyPointsForm());

  const showToast = (msg: string, type: "success" | "error") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  // ─── Data fetching ────────────────────────────────────────────────────────

  const fetchAccounts = useCallback(async () => {
    const { data } = await supabase.from("loyalty_accounts").select("*").order("points_balance", { ascending: false });
    if (data) setAccounts(data as LoyaltyAccount[]);
    setLoading(false);
  }, []);

  const fetchTransactions = useCallback(async (accountId?: string) => {
    let q = supabase.from("loyalty_transactions").select("*").order("created_at", { ascending: false }).limit(200);
    if (accountId) q = q.eq("account_id", accountId);
    const { data } = await q;
    if (data) setTransactions(prev => accountId ? [...prev.filter(t => t.account_id !== accountId), ...(data as LoyaltyTransaction[])] : data as LoyaltyTransaction[]);
  }, []);

  // ─── Auth ─────────────────────────────────────────────────────────────────

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.push("/login"); return; }
      const role = user.user_metadata?.role || user.app_metadata?.role;
      if (role !== "admin") { router.push("/"); return; }
      adminEmail.current = user.email ?? null;
    });
    fetchAccounts();
    fetchTransactions();
  }, [fetchAccounts, fetchTransactions, router]);

  // ─── Realtime ─────────────────────────────────────────────────────────────

  useEffect(() => {
    const ch = supabase
      .channel("loyalty-realtime")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "loyalty_accounts" }, ({ new: row }) => {
        setAccounts(prev => [row as LoyaltyAccount, ...prev].sort((a, b) => b.points_balance - a.points_balance));
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "loyalty_accounts" }, ({ new: row }) => {
        setAccounts(prev => prev.map(a => a.id === row.id ? row as LoyaltyAccount : a));
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

  // ─── CRUD ─────────────────────────────────────────────────────────────────

  const handleSaveAccount = async () => {
    if (!accountForm.customer_name.trim() || !accountForm.customer_phone.trim()) {
      showToast("Name and phone are required", "error"); return;
    }
    setIsSaving(true);
    if (editingId) {
      const { error } = await supabase.from("loyalty_accounts").update(accountForm).eq("id", editingId);
      if (error) { showToast("Error: " + error.message, "error"); setIsSaving(false); return; }
      showToast("Member updated!", "success");
    } else {
      const { error } = await supabase.from("loyalty_accounts").insert({
        ...accountForm,
        points_balance: 0, tier: "bronze", total_earned: 0, total_redeemed: 0, is_active: true,
      });
      if (error) { showToast("Error: " + error.message, "error"); setIsSaving(false); return; }
      showToast("Member enrolled!", "success");
    }
    setIsSaving(false);
    setIsAccountFormOpen(false);
    setEditingId(null);
    setAccountForm(emptyAccountForm());
  };

  const handleAddPoints = async () => {
    if (!selectedAccount || !pointsForm.points || !pointsForm.description) {
      showToast("Fill in all required fields", "error"); return;
    }
    const pts = parseInt(pointsForm.points);
    if (isNaN(pts) || pts <= 0) { showToast("Enter a valid points amount", "error"); return; }
    setIsSaving(true);

    const isPositive = ["earn", "bonus"].includes(pointsForm.type);
    const isNeutral  = pointsForm.type === "adjustment";
    const delta      = isNeutral ? 0 : isPositive ? pts : -pts;
    const newBalance = Math.max(0, selectedAccount.points_balance + delta);
    const newTier    = calcTier(newBalance);

    const { error } = await supabase.from("loyalty_accounts").update({
      points_balance:  newBalance,
      tier:            newTier,
      total_earned:    isPositive ? selectedAccount.total_earned    + pts : selectedAccount.total_earned,
      total_redeemed:  pointsForm.type === "redeem" ? selectedAccount.total_redeemed + pts : selectedAccount.total_redeemed,
      last_activity:   new Date().toISOString(),
    }).eq("id", selectedAccount.id);

    if (error) { showToast("Update failed: " + error.message, "error"); setIsSaving(false); return; }

    await supabase.from("loyalty_transactions").insert({
      account_id:   selectedAccount.id,
      type:         pointsForm.type,
      points:       pts,
      balance_after: newBalance,
      description:  pointsForm.description,
      reference_id: pointsForm.reference_id || null,
      created_by:   adminEmail.current ?? "Admin",
    });

    setIsSaving(false);
    setIsPointsModalOpen(false);
    setPointsForm(emptyPointsForm());
    showToast(`${delta >= 0 ? "+" : ""}${delta || "±" + pts} pts applied!`, "success");
  };

  const toggleActive = async (acct: LoyaltyAccount) => {
    const { error } = await supabase.from("loyalty_accounts").update({ is_active: !acct.is_active }).eq("id", acct.id);
    if (error) showToast("Failed to update status", "error");
    else showToast(acct.is_active ? "Member deactivated" : "Member reactivated", "success");
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
    await supabase.from("loyalty_accounts").delete().eq("id", deleteId);
    setIsDeleting(false);
    setDeleteId(null);
    if (isDetailOpen) setIsDetailOpen(false);
    showToast("Member removed", "success");
  };

  // ─── Derived ──────────────────────────────────────────────────────────────

  const filteredMembers = accounts.filter(a => {
    const q = searchQuery.toLowerCase();
    const matchQ = !q || a.customer_name.toLowerCase().includes(q) || a.customer_phone.includes(q) || (a.customer_email || "").toLowerCase().includes(q);
    return matchQ && (tierFilter === "all" || a.tier === tierFilter);
  });

  const filteredTx = transactions.filter(tx => {
    return (txTypeFilter === "all" || tx.type === txTypeFilter) &&
           (txMemberFilter === "all" || tx.account_id === txMemberFilter);
  });

  const lookupResult = lookupPhone.trim().length >= 4
    ? accounts.find(a => a.customer_phone.replace(/\D/g, "").includes(lookupPhone.replace(/\D/g, "")))
    : null;

  const stats = {
    total:       accounts.length,
    active:      accounts.filter(a => a.is_active).length,
    totalPoints: accounts.reduce((s, a) => s + a.points_balance, 0),
    platinum:    accounts.filter(a => a.tier === "platinum").length,
  };

  const previewBalance = (() => {
    if (!selectedAccount || !pointsForm.points) return null;
    const pts = parseInt(pointsForm.points) || 0;
    const isPos = ["earn", "bonus"].includes(pointsForm.type);
    const isNeutral = pointsForm.type === "adjustment";
    const delta = isNeutral ? 0 : isPos ? pts : -pts;
    return Math.max(0, selectedAccount.points_balance + delta);
  })();

  if (loading) return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-white">

      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-[100] px-4 py-3 rounded-xl text-sm font-semibold shadow-2xl border pointer-events-none ${
          toast.type === "success" ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40" : "bg-rose-500/20 text-rose-300 border-rose-500/40"
        }`}>{toast.msg}</div>
      )}

      {/* Header */}
      <div className="sticky top-0 z-30 bg-white/95 dark:bg-gray-900/95 backdrop-blur-md border-b border-gray-200 dark:border-gray-800 px-4 md:px-6 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Link href="/dashboard" className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors flex-shrink-0">← Dashboard</Link>
          <span className="text-gray-700 flex-shrink-0">|</span>
          <h1 className="font-bold text-gray-900 dark:text-white truncate">Loyalty Program</h1>
          <span className="flex-shrink-0 text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 px-2 py-0.5 rounded-full">{accounts.length} members</span>
        </div>
        <button onClick={() => { setAccountForm(emptyAccountForm()); setEditingId(null); setIsAccountFormOpen(true); }}
          className="flex-shrink-0 px-4 py-1.5 text-xs bg-cyan-500 hover:bg-cyan-400 text-black font-bold rounded-lg transition-all">
          + Enroll Member
        </button>
      </div>

      <div className="max-w-screen-xl mx-auto px-4 md:px-6 py-6 space-y-6">

        {/* ── In-Store Quick Lookup ────────────────────────────────────────────── */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">In-Store Lookup</p>
          <div className="flex gap-3 items-start">
            <div className="relative flex-1 max-w-sm">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
              <input
                value={lookupPhone}
                onChange={e => setLookupPhone(e.target.value)}
                placeholder="Type customer phone number…"
                className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg pl-10 pr-3 py-2.5 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:border-cyan-500 transition-all"
              />
            </div>
            {lookupPhone && <button onClick={() => setLookupPhone("")} className="text-xs text-gray-500 hover:text-gray-900 dark:hover:text-white transition-colors mt-2.5">Clear</button>}
          </div>

          {lookupPhone.trim().length >= 4 && (
            <div className="mt-4">
              {lookupResult ? (
                <div className={`flex items-center justify-between rounded-xl border p-4 gap-4 ${TIER_CFG[lookupResult.tier].bg} ${TIER_CFG[lookupResult.tier].color}`}>
                  <div className="min-w-0">
                    <p className="font-bold text-gray-900 dark:text-white text-lg truncate">{lookupResult.customer_name}</p>
                    <p className="text-sm text-gray-400">{lookupResult.customer_phone}</p>
                    {!lookupResult.is_active && <p className="text-xs text-rose-400 mt-0.5">Account deactivated</p>}
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className={`text-4xl font-black ${TIER_CFG[lookupResult.tier].text}`}>{lookupResult.points_balance.toLocaleString()}</p>
                    <p className="text-xs text-gray-400 mt-0.5">points · {TIER_CFG[lookupResult.tier].icon} {TIER_CFG[lookupResult.tier].label}</p>
                  </div>
                  <button
                    onClick={() => { setSelectedAccount(lookupResult); setIsPointsModalOpen(true); setLookupPhone(""); }}
                    className="flex-shrink-0 px-4 py-2 text-sm font-bold bg-cyan-500 hover:bg-cyan-400 text-black rounded-lg transition-all"
                  >
                    + Points
                  </button>
                </div>
              ) : (
                <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-100 dark:bg-gray-800/50 p-4 flex items-center justify-between gap-4">
                  <p className="text-sm text-gray-400">No member found for that number.</p>
                  <button onClick={() => { setAccountForm({ ...emptyAccountForm(), customer_phone: lookupPhone }); setEditingId(null); setIsAccountFormOpen(true); setLookupPhone(""); }}
                    className="flex-shrink-0 text-xs font-semibold text-cyan-400 border border-cyan-500/40 hover:bg-cyan-500/10 px-3 py-1.5 rounded-lg transition-all">
                    Enroll now
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Stats ────────────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "Total Members",          value: stats.total,                       color: "text-cyan-400",   bg: "bg-cyan-500/10 border-cyan-500/20"    },
            { label: "Active",                 value: stats.active,                      color: "text-emerald-400",bg: "bg-emerald-500/10 border-emerald-500/20"},
            { label: "Points in Circulation",  value: stats.totalPoints.toLocaleString(),color: "text-yellow-400", bg: "bg-yellow-500/10 border-yellow-500/20" },
            { label: "Platinum Members",       value: stats.platinum,                    color: "text-purple-400", bg: "bg-purple-500/10 border-purple-500/20" },
          ].map(s => (
            <div key={s.label} className={`rounded-xl border p-4 ${s.bg}`}>
              <p className="text-xs text-gray-400 mb-1">{s.label}</p>
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* ── Tier breakdown ────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-4 gap-3">
          {(["bronze", "silver", "gold", "platinum"] as Tier[]).map(t => {
            const cfg   = TIER_CFG[t];
            const count = accounts.filter(a => a.tier === t).length;
            const active = tierFilter === t;
            return (
              <button key={t} onClick={() => setTierFilter(active ? "all" : t)}
                className={`rounded-xl border p-3 text-center transition-all ${cfg.bg} ${cfg.color} ${active ? "ring-2 ring-current" : "opacity-60 hover:opacity-100"}`}>
                <p className="text-2xl mb-1">{cfg.icon}</p>
                <p className={`text-sm font-bold ${cfg.text}`}>{cfg.label}</p>
                <p className="text-xs text-gray-500 mt-0.5">{count} members</p>
                <p className="text-[10px] text-gray-600 mt-0.5">{cfg.minPts.toLocaleString()}+ pts</p>
              </button>
            );
          })}
        </div>

        {/* ── Tabs ─────────────────────────────────────────────────────────────── */}
        <div className="flex gap-1 p-1 bg-gray-100 dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 w-fit">
          {(["members", "transactions"] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`px-5 py-1.5 rounded-lg text-sm font-medium transition-all capitalize ${
                activeTab === tab ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow" : "text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
              }`}>
              {tab}
              {tab === "transactions" && transactions.length > 0 && (
                <span className="ml-1.5 text-[10px] text-gray-500">{transactions.length}</span>
              )}
            </button>
          ))}
        </div>

        {/* ══ MEMBERS TAB ══════════════════════════════════════════════════════════ */}
        {activeTab === "members" && (
          <>
            <div className="flex gap-2 flex-wrap">
              <div className="relative flex-1 min-w-[200px]">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search name, phone, email…"
                  className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg pl-9 pr-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:border-cyan-500 transition-all" />
              </div>
              {(searchQuery || tierFilter !== "all") && (
                <button onClick={() => { setSearchQuery(""); setTierFilter("all"); }}
                  className="px-3 py-2 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white border border-gray-200 dark:border-gray-700 rounded-lg transition-all">
                  Clear
                </button>
              )}
            </div>

            {filteredMembers.length === 0 ? (
              <div className="text-center py-16 text-gray-500">
                <p className="text-4xl mb-3">👥</p>
                <p className="text-sm">No members found.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {filteredMembers.map(acct => {
                  const cfg  = TIER_CFG[acct.tier];
                  const next = acct.tier === "platinum" ? null : TIER_CFG[calcTier(acct.points_balance + 1) === acct.tier ? acct.tier : calcTier(cfg.nextPts)];
                  const progressPct = acct.tier === "platinum" ? 100 :
                    Math.min(100, ((acct.points_balance - cfg.minPts) / (cfg.nextPts - cfg.minPts)) * 100);

                  return (
                    <div key={acct.id} onClick={() => openDetail(acct)}
                      className={`bg-white dark:bg-gray-900 border rounded-2xl p-5 cursor-pointer transition-all hover:shadow-xl hover:shadow-black/10 dark:hover:shadow-black/30 ${cfg.color} ${!acct.is_active ? "opacity-50" : ""}`}>

                      <div className="flex items-start justify-between mb-3 gap-2">
                        <div className="min-w-0">
                          <p className="font-bold text-gray-900 dark:text-white text-base truncate">{acct.customer_name}</p>
                          <p className="text-xs text-gray-400">{acct.customer_phone}</p>
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          {!acct.is_active && <span className="text-[10px] text-rose-400 font-bold bg-rose-500/10 border border-rose-500/30 px-1.5 py-0.5 rounded-full">Inactive</span>}
                          <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${cfg.bg} ${cfg.color} ${cfg.text}`}>{cfg.icon} {cfg.label}</span>
                        </div>
                      </div>

                      <div className="mb-3">
                        <div className="flex items-baseline justify-between mb-1.5">
                          <span className={`text-3xl font-black ${cfg.text}`}>{acct.points_balance.toLocaleString()}</span>
                          <span className="text-xs text-gray-500">pts</span>
                        </div>
                        <div className="w-full h-1.5 bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full transition-all duration-500 ${cfg.bar}`} style={{ width: `${progressPct}%` }} />
                        </div>
                        {acct.tier !== "platinum" ? (
                          <p className="text-[10px] text-gray-600 mt-1">{(cfg.nextPts - acct.points_balance).toLocaleString()} pts to {next?.label ?? "next tier"}</p>
                        ) : (
                          <p className="text-[10px] text-cyan-500 mt-1">Maximum tier 💎</p>
                        )}
                      </div>

                      <div className="flex justify-between text-xs text-gray-500 mb-3">
                        <span>Earned: <span className="text-gray-700 dark:text-gray-300 font-medium">{acct.total_earned.toLocaleString()}</span></span>
                        <span>Redeemed: <span className="text-gray-700 dark:text-gray-300 font-medium">{acct.total_redeemed.toLocaleString()}</span></span>
                      </div>

                      <div className="flex gap-2 pt-3 border-t border-gray-200 dark:border-gray-800">
                        <button onClick={e => { e.stopPropagation(); setSelectedAccount(acct); setIsPointsModalOpen(true); }}
                          className="flex-1 py-1.5 text-xs font-semibold bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 rounded-lg transition-all">
                          + Points
                        </button>
                        <button onClick={e => { e.stopPropagation(); openEdit(acct); }}
                          className="px-3 py-1.5 text-xs bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 rounded-lg transition-all">
                          Edit
                        </button>
                        <button onClick={e => { e.stopPropagation(); toggleActive(acct); }}
                          className={`px-3 py-1.5 text-xs border rounded-lg transition-all ${
                            acct.is_active
                              ? "bg-gray-100 dark:bg-gray-800 hover:bg-rose-500/10 text-gray-500 dark:text-gray-400 hover:text-rose-400 border-gray-200 dark:border-gray-700 hover:border-rose-500/40"
                              : "bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                          }`}>
                          {acct.is_active ? "Deactivate" : "Reactivate"}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* ══ TRANSACTIONS TAB ══════════════════════════════════════════════════════ */}
        {activeTab === "transactions" && (
          <>
            {/* Transaction filters */}
            <div className="flex flex-wrap gap-2">
              <select value={txTypeFilter} onChange={e => setTxTypeFilter(e.target.value as TxType | "all")}
                className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-cyan-500 transition-all">
                <option value="all">All Types</option>
                {ALL_TX_TYPES.map(t => <option key={t} value={t}>{TX_CFG[t].label}</option>)}
              </select>
              <select value={txMemberFilter} onChange={e => setTxMemberFilter(e.target.value)}
                className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-cyan-500 transition-all">
                <option value="all">All Members</option>
                {accounts.map(a => <option key={a.id} value={a.id}>{a.customer_name}</option>)}
              </select>
              {(txTypeFilter !== "all" || txMemberFilter !== "all") && (
                <button onClick={() => { setTxTypeFilter("all"); setTxMemberFilter("all"); }}
                  className="px-3 py-2 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white border border-gray-200 dark:border-gray-700 rounded-lg transition-all">
                  Clear
                </button>
              )}
              <p className="self-center text-xs text-gray-500 ml-1">{filteredTx.length} transactions</p>
            </div>

            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden">
              {filteredTx.length === 0 ? (
                <div className="py-16 text-center text-gray-500 text-sm">No transactions found</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-gray-800 bg-gray-50/80 dark:bg-gray-900/80">
                        {["Date", "Member", "Type", "Points", "Balance After", "Description", "Ref", "By"].map(h => (
                          <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredTx.map(tx => {
                        const acct = accounts.find(a => a.id === tx.account_id);
                        const cfg  = TX_CFG[tx.type];
                        const isPositive = ["earn", "bonus"].includes(tx.type);
                        const isNegative = ["redeem", "expire"].includes(tx.type);
                        return (
                          <tr key={tx.id} className="border-b border-gray-200/50 dark:border-gray-800/50 hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors">
                            <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                              {new Date(tx.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                              <span className="block text-[10px] text-gray-600">{new Date(tx.created_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}</span>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              {acct ? (
                                <button onClick={() => openDetail(acct)} className="text-sm text-gray-900 dark:text-white hover:text-cyan-500 dark:hover:text-cyan-400 transition-colors text-left">
                                  {acct.customer_name}
                                </button>
                              ) : <span className="text-gray-500">—</span>}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${cfg.bg} ${cfg.color}`}>{cfg.label}</span>
                            </td>
                            <td className={`px-4 py-3 font-bold whitespace-nowrap ${cfg.color}`}>
                              {isPositive ? "+" : isNegative ? "−" : "±"}{tx.points.toLocaleString()}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300 whitespace-nowrap">{tx.balance_after.toLocaleString()}</td>
                            <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300 max-w-[200px] truncate">{tx.description}</td>
                            <td className="px-4 py-3 text-xs text-gray-500 font-mono whitespace-nowrap">{tx.reference_id || "—"}</td>
                            <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap">{tx.created_by || "—"}</td>
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

      {/* ── Enroll / Edit Modal ───────────────────────────────────────────────── */}
      {isAccountFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={() => setIsAccountFormOpen(false)}>
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-800">
              <h2 className="font-bold text-lg">{editingId ? "Edit Member" : "Enroll New Member"}</h2>
              <button onClick={() => setIsAccountFormOpen(false)} className="text-gray-500 hover:text-gray-900 dark:hover:text-white text-xl leading-none transition-colors">✕</button>
            </div>
            <div className="px-6 py-5 space-y-3">
              {[
                { label: "Full Name *",    key: "customer_name"  as const, placeholder: "John Doe"          },
                { label: "Phone *",        key: "customer_phone" as const, placeholder: "+230 5XXX XXXX"     },
                { label: "Email",          key: "customer_email" as const, placeholder: "member@email.com"   },
              ].map(({ label, key, placeholder }) => (
                <div key={key}>
                  <label className="block text-xs text-gray-400 mb-1">{label}</label>
                  <input value={accountForm[key]} onChange={e => setAccountForm(p => ({ ...p, [key]: e.target.value }))} placeholder={placeholder}
                    className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:border-cyan-500 transition-all" />
                </div>
              ))}
              <div>
                <label className="block text-xs text-gray-400 mb-1">Notes</label>
                <textarea value={accountForm.notes} onChange={e => setAccountForm(p => ({ ...p, notes: e.target.value }))} rows={2} placeholder="Internal notes…"
                  className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:border-cyan-500 transition-all resize-none" />
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-gray-800">
              <button onClick={() => setIsAccountFormOpen(false)} className="px-4 py-2 text-sm text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700 rounded-lg hover:text-gray-900 dark:hover:text-white transition-all">Cancel</button>
              <button onClick={handleSaveAccount} disabled={isSaving}
                className="px-5 py-2 text-sm bg-cyan-500 hover:bg-cyan-400 text-black font-bold rounded-lg transition-all disabled:opacity-50">
                {isSaving ? "Saving…" : editingId ? "Save" : "Enroll"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Points Modal ──────────────────────────────────────────────────────── */}
      {isPointsModalOpen && selectedAccount && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={() => setIsPointsModalOpen(false)}>
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-800">
              <div>
                <p className="text-xs text-gray-400">{selectedAccount.customer_name}</p>
                <h2 className="font-bold text-lg">Manage Points</h2>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-500">Balance</p>
                <p className={`text-2xl font-black ${TIER_CFG[selectedAccount.tier].text}`}>{selectedAccount.points_balance.toLocaleString()}</p>
              </div>
            </div>

            <div className="px-6 py-5 space-y-4">
              {/* Type selector */}
              <div>
                <label className="block text-xs text-gray-400 mb-2">Transaction Type</label>
                <div className="grid grid-cols-5 gap-1.5">
                  {ALL_TX_TYPES.map(t => {
                    const cfg = TX_CFG[t];
                    const active = pointsForm.type === t;
                    return (
                      <button key={t} onClick={() => setPointsForm(p => ({ ...p, type: t }))}
                        className={`py-1.5 text-xs font-semibold rounded-lg border transition-all ${active ? `${cfg.bg} ${cfg.color}` : "bg-gray-100 dark:bg-gray-800 text-gray-500 border-gray-200 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-500"}`}>
                        {cfg.label}
                      </button>
                    );
                  })}
                </div>
                {pointsForm.type === "adjustment" && (
                  <p className="text-[10px] text-amber-500 mt-1.5">Adjustment records the points but does not change the balance.</p>
                )}
              </div>

              {/* Points amount */}
              <div>
                <label className="block text-xs text-gray-400 mb-1">Points *</label>
                <input type="number" min={1} value={pointsForm.points} onChange={e => setPointsForm(p => ({ ...p, points: e.target.value }))} placeholder="e.g. 100"
                  className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:border-cyan-500 transition-all" />
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs text-gray-400 mb-1">Description *</label>
                <input value={pointsForm.description} onChange={e => setPointsForm(p => ({ ...p, description: e.target.value }))} placeholder="e.g. Screen repair · Rs 3,500"
                  className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:border-cyan-500 transition-all" />
              </div>

              {/* Reference */}
              <div>
                <label className="block text-xs text-gray-400 mb-1">Reference <span className="text-gray-600">(optional)</span></label>
                <input value={pointsForm.reference_id} onChange={e => setPointsForm(p => ({ ...p, reference_id: e.target.value }))} placeholder="Invoice No / Ticket No"
                  className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:border-cyan-500 transition-all" />
              </div>

              {/* Balance preview */}
              {previewBalance !== null && pointsForm.type !== "adjustment" && (
                <div className={`rounded-xl border p-3 ${
                  ["earn","bonus"].includes(pointsForm.type) ? "bg-emerald-500/10 border-emerald-500/30" : "bg-rose-500/10 border-rose-500/30"
                }`}>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-400">New balance</span>
                    <span className={`text-xl font-black ${["earn","bonus"].includes(pointsForm.type) ? "text-emerald-400" : "text-rose-400"}`}>
                      {previewBalance.toLocaleString()}
                    </span>
                  </div>
                  {calcTier(previewBalance) !== selectedAccount.tier && (
                    <p className={`text-xs mt-1.5 font-semibold ${TIER_CFG[calcTier(previewBalance)].text}`}>
                      Tier change: {TIER_CFG[selectedAccount.tier].label} → {TIER_CFG[calcTier(previewBalance)].label} {TIER_CFG[calcTier(previewBalance)].icon}
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-gray-800">
              <button onClick={() => setIsPointsModalOpen(false)} className="px-4 py-2 text-sm text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700 rounded-lg hover:text-gray-900 dark:hover:text-white transition-all">Cancel</button>
              <button onClick={handleAddPoints} disabled={isSaving}
                className="px-5 py-2 text-sm bg-cyan-500 hover:bg-cyan-400 text-black font-bold rounded-lg transition-all disabled:opacity-50">
                {isSaving ? "Saving…" : "Apply Points"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Detail Modal ──────────────────────────────────────────────────────── */}
      {isDetailOpen && selectedAccount && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 backdrop-blur-sm overflow-y-auto p-4" onClick={() => setIsDetailOpen(false)}>
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl w-full max-w-lg my-4 shadow-2xl" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className={`px-6 py-5 border-b border-gray-200 dark:border-gray-800 rounded-t-2xl ${TIER_CFG[selectedAccount.tier].bg}`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className={`text-xs font-bold uppercase tracking-wider mb-1 ${TIER_CFG[selectedAccount.tier].text}`}>
                    {TIER_CFG[selectedAccount.tier].icon} {TIER_CFG[selectedAccount.tier].label} Member
                  </p>
                  <h2 className="font-bold text-xl text-gray-900 dark:text-white">{selectedAccount.customer_name}</h2>
                  <p className="text-sm text-gray-400 mt-0.5">{selectedAccount.customer_phone}</p>
                  {selectedAccount.customer_email && <p className="text-xs text-gray-500 mt-0.5">{selectedAccount.customer_email}</p>}
                  {!selectedAccount.is_active && <p className="text-xs text-rose-400 font-semibold mt-1">Account Inactive</p>}
                </div>
                <button onClick={() => setIsDetailOpen(false)} className="text-gray-500 hover:text-gray-900 dark:hover:text-white text-xl transition-colors leading-none flex-shrink-0">✕</button>
              </div>
            </div>

            <div className="px-6 py-5 space-y-5 max-h-[calc(100vh-240px)] overflow-y-auto">
              {/* Points summary */}
              <div className="text-center">
                <p className={`text-6xl font-black ${TIER_CFG[selectedAccount.tier].text}`}>{selectedAccount.points_balance.toLocaleString()}</p>
                <p className="text-sm text-gray-400 mt-1">points balance</p>
                <div className="flex justify-center gap-8 mt-3 text-xs text-gray-500">
                  <span>Earned <span className="text-gray-900 dark:text-white font-semibold">{selectedAccount.total_earned.toLocaleString()}</span></span>
                  <span>Redeemed <span className="text-gray-900 dark:text-white font-semibold">{selectedAccount.total_redeemed.toLocaleString()}</span></span>
                </div>
              </div>

              {/* Tier progress */}
              {selectedAccount.tier !== "platinum" && (
                <div>
                  <div className="flex justify-between text-xs text-gray-500 mb-1">
                    <span>{selectedAccount.points_balance.toLocaleString()} pts</span>
                    <span>{(TIER_CFG[selectedAccount.tier].nextPts - selectedAccount.points_balance).toLocaleString()} to {TIER_CFG[calcTier(TIER_CFG[selectedAccount.tier].nextPts)].label}</span>
                  </div>
                  <div className="h-2 bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${TIER_CFG[selectedAccount.tier].bar}`}
                      style={{ width: `${Math.min(100, ((selectedAccount.points_balance - TIER_CFG[selectedAccount.tier].minPts) / (TIER_CFG[selectedAccount.tier].nextPts - TIER_CFG[selectedAccount.tier].minPts)) * 100)}%` }} />
                  </div>
                </div>
              )}

              {/* Meta */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-gray-100 dark:bg-gray-800/50 rounded-lg p-3">
                  <p className="text-gray-500 mb-0.5">Member Since</p>
                  <p className="text-gray-900 dark:text-white font-medium">{new Date(selectedAccount.member_since || selectedAccount.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</p>
                </div>
                <div className="bg-gray-100 dark:bg-gray-800/50 rounded-lg p-3">
                  <p className="text-gray-500 mb-0.5">Last Activity</p>
                  <p className="text-gray-900 dark:text-white font-medium">{new Date(selectedAccount.last_activity || selectedAccount.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</p>
                </div>
              </div>

              {selectedAccount.notes && (
                <div className="bg-gray-100 dark:bg-gray-800/50 rounded-lg px-3 py-2.5 text-xs text-gray-500 dark:text-gray-400">{selectedAccount.notes}</div>
              )}

              {/* Transaction history */}
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Transaction History</p>
                {transactions.filter(t => t.account_id === selectedAccount.id).length === 0 ? (
                  <p className="text-sm text-gray-600 text-center py-6">No transactions yet</p>
                ) : (
                  <div className="space-y-2">
                    {transactions.filter(t => t.account_id === selectedAccount.id).map(tx => {
                      const cfg = TX_CFG[tx.type];
                      const isPos = ["earn","bonus"].includes(tx.type);
                      const isNeg = ["redeem","expire"].includes(tx.type);
                      return (
                        <div key={tx.id} className="flex items-center justify-between bg-gray-100 dark:bg-gray-800/40 rounded-lg px-3 py-2.5 gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${cfg.bg} ${cfg.color}`}>{cfg.label}</span>
                              {tx.reference_id && <span className="text-[10px] text-gray-600 font-mono truncate">{tx.reference_id}</span>}
                            </div>
                            <p className="text-sm text-gray-900 dark:text-white mt-0.5 truncate">{tx.description}</p>
                            <p className="text-[10px] text-gray-600">{new Date(tx.created_at).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</p>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className={`font-bold text-sm ${cfg.color}`}>{isPos ? "+" : isNeg ? "−" : "±"}{tx.points.toLocaleString()}</p>
                            <p className="text-[10px] text-gray-600">{tx.balance_after.toLocaleString()} bal</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-gray-200 dark:border-gray-800">
              <button onClick={() => setDeleteId(selectedAccount.id)} className="px-4 py-2 text-sm text-rose-400 hover:text-rose-300 border border-rose-500/30 rounded-lg transition-all">Remove</button>
              <div className="flex gap-2">
                <button onClick={() => { openEdit(selectedAccount); }}
                  className="px-4 py-2 text-sm bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-900 dark:text-white rounded-lg transition-all">Edit</button>
                <button onClick={() => { setIsDetailOpen(false); setIsPointsModalOpen(true); }}
                  className="px-4 py-2 text-sm bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 rounded-lg font-semibold transition-all">
                  + Points
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Confirm ────────────────────────────────────────────────────── */}
      {deleteId && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={() => setDeleteId(null)}>
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl p-6 max-w-sm w-full shadow-2xl" onClick={e => e.stopPropagation()}>
            <p className="font-semibold text-gray-900 dark:text-white mb-2">Remove this member?</p>
            <p className="text-gray-500 dark:text-gray-400 text-sm mb-5">All points and transaction history will be permanently deleted.</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setDeleteId(null)} className="px-4 py-2 text-sm text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700 rounded-lg hover:text-gray-900 dark:hover:text-white transition-all">Cancel</button>
              <button onClick={confirmDelete} disabled={isDeleting}
                className="px-4 py-2 text-sm bg-rose-500 hover:bg-rose-400 text-white font-bold rounded-lg transition-all disabled:opacity-50">
                {isDeleting ? "Removing…" : "Remove"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
