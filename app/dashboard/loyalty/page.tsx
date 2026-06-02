"use client";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import Link from "next/link";

// ─── Types ────────────────────────────────────────────────────────────────────

type Tier = "bronze" | "silver" | "gold" | "platinum";
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

// ─── Tier config ──────────────────────────────────────────────────────────────

const TIER_CONFIG: Record<Tier, {
  label: string; minPts: number; maxPts: number; color: string; bg: string; textColor: string; icon: string;
}> = {
  bronze:   { label: "Bronze",   minPts: 0,    maxPts: 499,  color: "border-amber-700",   bg: "bg-amber-900/20",   textColor: "text-amber-600",   icon: "🥉" },
  silver:   { label: "Silver",   minPts: 500,  maxPts: 1499, color: "border-gray-400",    bg: "bg-gray-500/20",    textColor: "text-gray-300",    icon: "🥈" },
  gold:     { label: "Gold",     minPts: 1500, maxPts: 4999, color: "border-yellow-400",  bg: "bg-yellow-500/10",  textColor: "text-yellow-400",  icon: "🥇" },
  platinum: { label: "Platinum", minPts: 5000, maxPts: Infinity, color: "border-cyan-400", bg: "bg-cyan-500/10",  textColor: "text-cyan-400",    icon: "💎" },
};

const TX_CONFIG: Record<TxType, { label: string; color: string; sign: "+" | "-" | "±" }> = {
  earn:       { label: "Earned",     color: "text-emerald-400", sign: "+" },
  bonus:      { label: "Bonus",      color: "text-purple-400",  sign: "+" },
  redeem:     { label: "Redeemed",   color: "text-rose-400",    sign: "-" },
  adjustment: { label: "Adjustment", color: "text-amber-400",   sign: "±" },
  expire:     { label: "Expired",    color: "text-gray-500",    sign: "-" },
};

function calcTier(pts: number): Tier {
  if (pts >= 5000) return "platinum";
  if (pts >= 1500) return "gold";
  if (pts >= 500)  return "silver";
  return "bronze";
}

const emptyAccount = () => ({
  customer_name: "", customer_phone: "", customer_email: "", notes: "",
});

// ─── Component ────────────────────────────────────────────────────────────────

export default function LoyaltyPage() {
  const router = useRouter();
  const [accounts, setAccounts] = useState<LoyaltyAccount[]>([]);
  const [transactions, setTransactions] = useState<LoyaltyTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  // Modals
  const [isAccountFormOpen, setIsAccountFormOpen] = useState(false);
  const [isPointsModalOpen, setIsPointsModalOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<LoyaltyAccount | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [tierFilter, setTierFilter] = useState<Tier | "all">("all");
  const [activeTab, setActiveTab] = useState<"members" | "transactions">("members");

  // Forms
  const [accountForm, setAccountForm] = useState(emptyAccount());
  const [pointsForm, setPointsForm] = useState({ type: "earn" as TxType, points: "", description: "", reference_id: "" });

  const showToast = (msg: string, type: "success" | "error") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchAccounts = useCallback(async () => {
    const { data } = await supabase.from("loyalty_accounts").select("*").order("points_balance", { ascending: false });
    if (data) setAccounts(data as LoyaltyAccount[]);
    setLoading(false);
  }, []);

  const fetchTransactions = useCallback(async (accountId?: string) => {
    let query = supabase.from("loyalty_transactions").select("*").order("created_at", { ascending: false }).limit(100);
    if (accountId) query = query.eq("account_id", accountId);
    const { data } = await query;
    if (data) setTransactions(data as LoyaltyTransaction[]);
  }, []);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => { if (!user) router.push("/login"); });
    fetchAccounts();
    fetchTransactions();
  }, [fetchAccounts, fetchTransactions, router]);

  const handleSaveAccount = async () => {
    if (!accountForm.customer_name || !accountForm.customer_phone) {
      showToast("Name and phone are required", "error"); return;
    }
    setIsSaving(true);
    if (editingId) {
      const { error } = await supabase.from("loyalty_accounts").update(accountForm).eq("id", editingId);
      setIsSaving(false);
      if (error) { showToast("Error: " + error.message, "error"); return; }
      showToast("Member updated!", "success");
    } else {
      const { error } = await supabase.from("loyalty_accounts").insert({
        ...accountForm, points_balance: 0, tier: "bronze", total_earned: 0, total_redeemed: 0, is_active: true,
      });
      setIsSaving(false);
      if (error) { showToast("Error: " + error.message, "error"); return; }
      showToast("Member enrolled!", "success");
    }
    setIsAccountFormOpen(false);
    setEditingId(null);
    setAccountForm(emptyAccount());
    fetchAccounts();
  };

  const handleAddPoints = async () => {
    if (!selectedAccount || !pointsForm.points || !pointsForm.description) {
      showToast("Fill in all fields", "error"); return;
    }
    const pts = parseInt(pointsForm.points);
    if (isNaN(pts) || pts <= 0) { showToast("Enter a valid points amount", "error"); return; }

    setIsSaving(true);
    const delta = ["earn", "bonus"].includes(pointsForm.type) ? pts : -pts;
    const newBalance = Math.max(0, selectedAccount.points_balance + delta);
    const newTier = calcTier(newBalance);

    const newTotalEarned = ["earn", "bonus"].includes(pointsForm.type) ? selectedAccount.total_earned + pts : selectedAccount.total_earned;
    const newTotalRedeemed = pointsForm.type === "redeem" ? selectedAccount.total_redeemed + pts : selectedAccount.total_redeemed;

    const { error: acctErr } = await supabase.from("loyalty_accounts").update({
      points_balance: newBalance,
      tier: newTier,
      total_earned: newTotalEarned,
      total_redeemed: newTotalRedeemed,
      last_activity: new Date().toISOString(),
    }).eq("id", selectedAccount.id);

    if (acctErr) { setIsSaving(false); showToast("Update failed: " + acctErr.message, "error"); return; }

    await supabase.from("loyalty_transactions").insert({
      account_id: selectedAccount.id,
      type: pointsForm.type,
      points: pts,
      balance_after: newBalance,
      description: pointsForm.description,
      reference_id: pointsForm.reference_id || null,
      created_by: "Admin",
    });

    setIsSaving(false);
    setIsPointsModalOpen(false);
    setPointsForm({ type: "earn", points: "", description: "", reference_id: "" });
    showToast(`${delta > 0 ? "+" : ""}${delta} points applied!`, "success");
    fetchAccounts();
    fetchTransactions();
    if (selectedAccount) {
      const updated = { ...selectedAccount, points_balance: newBalance, tier: newTier };
      setSelectedAccount(updated);
    }
  };

  const openDetail = (acct: LoyaltyAccount) => {
    setSelectedAccount(acct);
    setIsDetailOpen(true);
    fetchTransactions(acct.id);
  };

  const openEdit = (acct: LoyaltyAccount) => {
    setAccountForm({ customer_name: acct.customer_name, customer_phone: acct.customer_phone, customer_email: acct.customer_email || "", notes: acct.notes || "" });
    setEditingId(acct.id);
    setIsAccountFormOpen(true);
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    setIsDeleting(true);
    await supabase.from("loyalty_accounts").delete().eq("id", deleteId);
    setIsDeleting(false);
    setDeleteId(null);
    showToast("Member removed", "success");
    fetchAccounts();
  };

  const filtered = accounts.filter(a => {
    const q = searchQuery.toLowerCase();
    const matchQ = !q || a.customer_name.toLowerCase().includes(q) || a.customer_phone.includes(q) || (a.customer_email || "").toLowerCase().includes(q);
    const matchT = tierFilter === "all" || a.tier === tierFilter;
    return matchQ && matchT;
  });

  const stats = {
    total: accounts.length,
    active: accounts.filter(a => a.is_active).length,
    totalPoints: accounts.reduce((s, a) => s + a.points_balance, 0),
    platinum: accounts.filter(a => a.tier === "platinum").length,
  };

  if (loading) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-950 text-white">

      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl text-sm font-semibold shadow-2xl border ${
          toast.type === "success" ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40" : "bg-rose-500/20 text-rose-300 border-rose-500/40"
        }`}>{toast.msg}</div>
      )}

      {/* Header */}
      <div className="sticky top-0 z-30 bg-gray-900/95 backdrop-blur-md border-b border-gray-800 px-4 md:px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="text-sm text-gray-400 hover:text-white transition-colors">← Dashboard</Link>
          <span className="text-gray-700">|</span>
          <h1 className="font-bold text-white">Loyalty Program</h1>
        </div>
        <button
          onClick={() => { setAccountForm(emptyAccount()); setEditingId(null); setIsAccountFormOpen(true); }}
          className="px-4 py-1.5 text-xs bg-cyan-500 hover:bg-cyan-400 text-black font-bold rounded-lg transition-all"
        >
          + Enroll Member
        </button>
      </div>

      <div className="max-w-screen-xl mx-auto px-4 md:px-6 py-6">

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[
            { label: "Total Members", value: stats.total, color: "text-cyan-400", bg: "bg-cyan-500/10 border-cyan-500/20" },
            { label: "Active Members", value: stats.active, color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20" },
            { label: "Points in Circulation", value: stats.totalPoints.toLocaleString(), color: "text-yellow-400", bg: "bg-yellow-500/10 border-yellow-500/20" },
            { label: "Platinum Members", value: stats.platinum, color: "text-purple-400", bg: "bg-purple-500/10 border-purple-500/20" },
          ].map(s => (
            <div key={s.label} className={`rounded-xl border p-4 ${s.bg}`}>
              <p className="text-xs text-gray-400 mb-1">{s.label}</p>
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Tier breakdown */}
        <div className="grid grid-cols-4 gap-3 mb-6">
          {(Object.entries(TIER_CONFIG) as [Tier, typeof TIER_CONFIG["bronze"]][]).map(([t, cfg]) => {
            const count = accounts.filter(a => a.tier === t).length;
            return (
              <button key={t} onClick={() => setTierFilter(tierFilter === t ? "all" : t)}
                className={`rounded-xl border p-3 text-center transition-all ${cfg.bg} ${cfg.color} ${tierFilter === t ? "ring-2 ring-current" : "opacity-70 hover:opacity-100"}`}>
                <p className="text-2xl mb-1">{cfg.icon}</p>
                <p className={`text-sm font-bold ${cfg.textColor}`}>{cfg.label}</p>
                <p className="text-xs text-gray-500">{count} members</p>
                <p className="text-[10px] text-gray-600 mt-0.5">{cfg.minPts.toLocaleString()}+ pts</p>
              </button>
            );
          })}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-4 p-1 bg-gray-900 rounded-xl border border-gray-800 w-fit">
          {(["members", "transactions"] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all capitalize ${
                activeTab === tab ? "bg-gray-700 text-white" : "text-gray-400 hover:text-white"
              }`}>
              {tab}
            </button>
          ))}
        </div>

        {activeTab === "members" && (
          <>
            {/* Filters */}
            <div className="flex gap-2 mb-4">
              <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search member..."
                className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500 transition-all" />
            </div>

            {/* Members grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filtered.length === 0 && (
                <p className="text-gray-500 text-sm col-span-full text-center py-12">No members found</p>
              )}
              {filtered.map(acct => {
                const cfg = TIER_CONFIG[acct.tier];
                const tierPts = TIER_CONFIG[acct.tier];
                const nextTier = acct.tier === "platinum" ? null :
                  acct.tier === "gold" ? TIER_CONFIG.platinum :
                  acct.tier === "silver" ? TIER_CONFIG.gold : TIER_CONFIG.silver;
                const nextThreshold = nextTier?.minPts ?? 0;
                const progress = nextTier ? Math.min(100, ((acct.points_balance - tierPts.minPts) / (nextThreshold - tierPts.minPts)) * 100) : 100;

                return (
                  <div key={acct.id} onClick={() => openDetail(acct)}
                    className={`bg-gray-900 border rounded-2xl p-5 cursor-pointer transition-all hover:shadow-xl ${cfg.color} hover:border-opacity-70`}>
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <p className="font-bold text-white text-lg">{acct.customer_name}</p>
                        <p className="text-xs text-gray-400">{acct.customer_phone}</p>
                      </div>
                      <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-bold ${cfg.bg} ${cfg.color} ${cfg.textColor}`}>
                        <span>{cfg.icon}</span>
                        <span>{cfg.label}</span>
                      </div>
                    </div>

                    <div className="mb-3">
                      <div className="flex justify-between items-baseline mb-1">
                        <span className={`text-3xl font-black ${cfg.textColor}`}>{acct.points_balance.toLocaleString()}</span>
                        <span className="text-xs text-gray-500">points</span>
                      </div>
                      {nextTier && (
                        <>
                          <div className="w-full h-1.5 bg-gray-800 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full transition-all ${acct.tier === "bronze" ? "bg-amber-600" : acct.tier === "silver" ? "bg-gray-400" : "bg-yellow-400"}`}
                              style={{ width: `${progress}%` }} />
                          </div>
                          <p className="text-[10px] text-gray-600 mt-1">{(nextThreshold - acct.points_balance).toLocaleString()} pts to {nextTier.label}</p>
                        </>
                      )}
                      {!nextTier && <p className="text-xs text-cyan-400 mt-1">Maximum tier achieved! 💎</p>}
                    </div>

                    <div className="flex justify-between text-xs text-gray-500">
                      <span>Earned: {acct.total_earned.toLocaleString()}</span>
                      <span>Redeemed: {acct.total_redeemed.toLocaleString()}</span>
                    </div>

                    <div className="flex gap-2 mt-3 pt-3 border-t border-gray-800">
                      <button onClick={e => { e.stopPropagation(); setSelectedAccount(acct); setIsPointsModalOpen(true); }}
                        className="flex-1 py-1.5 text-xs bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 rounded-lg font-semibold transition-all">
                        + Points
                      </button>
                      <button onClick={e => { e.stopPropagation(); openEdit(acct); }}
                        className="px-3 py-1.5 text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-700 rounded-lg transition-all">Edit</button>
                      <button onClick={e => { e.stopPropagation(); setDeleteId(acct.id); }}
                        className="px-3 py-1.5 text-xs bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-lg transition-all">Del</button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {activeTab === "transactions" && (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800 bg-gray-900/80">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase">Date</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase">Member</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase">Type</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase">Points</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase">Balance After</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase">Description</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase">Ref</th>
                </tr>
              </thead>
              <tbody>
                {transactions.length === 0 && (
                  <tr><td colSpan={7} className="px-4 py-12 text-center text-gray-500">No transactions yet</td></tr>
                )}
                {transactions.map(tx => {
                  const acct = accounts.find(a => a.id === tx.account_id);
                  const cfg = TX_CONFIG[tx.type];
                  return (
                    <tr key={tx.id} className="border-b border-gray-800/50 hover:bg-gray-800/40 transition-colors">
                      <td className="px-4 py-3 text-xs text-gray-500">{new Date(tx.created_at).toLocaleString()}</td>
                      <td className="px-4 py-3 text-sm text-white">{acct?.customer_name || "—"}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full bg-gray-800 ${cfg.color}`}>{cfg.label}</span>
                      </td>
                      <td className={`px-4 py-3 font-bold ${cfg.color}`}>
                        {cfg.sign !== "±" ? cfg.sign : ""}{tx.points.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-300">{tx.balance_after.toLocaleString()}</td>
                      <td className="px-4 py-3 text-sm text-gray-300">{tx.description}</td>
                      <td className="px-4 py-3 text-xs text-gray-500 font-mono">{tx.reference_id || "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Account Form Modal ─────────────────────────────────────────────────── */}
      {isAccountFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
              <h2 className="font-bold text-lg text-white">{editingId ? "Edit Member" : "Enroll New Member"}</h2>
              <button onClick={() => setIsAccountFormOpen(false)} className="text-gray-500 hover:text-white text-xl transition-colors">✕</button>
            </div>
            <div className="px-6 py-5 space-y-3">
              {[
                { label: "Full Name *", key: "customer_name" as const, placeholder: "John Doe" },
                { label: "Phone *",     key: "customer_phone" as const, placeholder: "+230 5XXX XXXX" },
                { label: "Email",       key: "customer_email" as const, placeholder: "member@email.com" },
              ].map(({ label, key, placeholder }) => (
                <div key={key}>
                  <label className="block text-xs text-gray-400 mb-1">{label}</label>
                  <input value={accountForm[key]} onChange={e => setAccountForm(p => ({ ...p, [key]: e.target.value }))} placeholder={placeholder}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500 transition-all" />
                </div>
              ))}
              <div>
                <label className="block text-xs text-gray-400 mb-1">Notes</label>
                <textarea value={accountForm.notes} onChange={e => setAccountForm(p => ({ ...p, notes: e.target.value }))} rows={2}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500 transition-all resize-none" />
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-800">
              <button onClick={() => setIsAccountFormOpen(false)} className="px-4 py-2 text-sm text-gray-400 border border-gray-700 rounded-lg hover:text-white transition-all">Cancel</button>
              <button onClick={handleSaveAccount} disabled={isSaving}
                className="px-5 py-2 text-sm bg-cyan-500 hover:bg-cyan-400 text-black font-bold rounded-lg transition-all disabled:opacity-50">
                {isSaving ? "Saving…" : editingId ? "Save" : "Enroll"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Points Modal ───────────────────────────────────────────────────────── */}
      {isPointsModalOpen && selectedAccount && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
              <div>
                <p className="text-xs text-gray-400">{selectedAccount.customer_name}</p>
                <h2 className="font-bold text-lg text-white">Manage Points</h2>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-500">Balance</p>
                <p className="text-2xl font-black text-cyan-400">{selectedAccount.points_balance.toLocaleString()}</p>
              </div>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-xs text-gray-400 mb-2">Transaction Type</label>
                <div className="grid grid-cols-3 gap-2">
                  {(["earn", "bonus", "redeem"] as TxType[]).map(t => (
                    <button key={t} onClick={() => setPointsForm(p => ({ ...p, type: t }))}
                      className={`py-2 text-xs font-semibold rounded-lg border capitalize transition-all ${
                        pointsForm.type === t
                          ? t === "redeem" ? "bg-rose-500/20 text-rose-400 border-rose-500/50"
                          : t === "bonus"  ? "bg-purple-500/20 text-purple-400 border-purple-500/50"
                          :                  "bg-emerald-500/20 text-emerald-400 border-emerald-500/50"
                          : "bg-gray-800 text-gray-500 border-gray-700 hover:border-gray-500"
                      }`}>{TX_CONFIG[t].label}</button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Points *</label>
                <input type="number" min={1} value={pointsForm.points} onChange={e => setPointsForm(p => ({ ...p, points: e.target.value }))} placeholder="100"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500 transition-all" />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Description *</label>
                <input value={pointsForm.description} onChange={e => setPointsForm(p => ({ ...p, description: e.target.value }))} placeholder="e.g. Screen repair service"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500 transition-all" />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Reference (optional)</label>
                <input value={pointsForm.reference_id} onChange={e => setPointsForm(p => ({ ...p, reference_id: e.target.value }))} placeholder="Invoice No / Ticket No"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500 transition-all" />
              </div>
              {pointsForm.points && (
                <div className={`rounded-xl border p-3 text-sm ${
                  ["earn","bonus"].includes(pointsForm.type) ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" : "bg-rose-500/10 border-rose-500/30 text-rose-400"
                }`}>
                  New balance: <span className="font-bold">
                    {Math.max(0, selectedAccount.points_balance + (["earn","bonus"].includes(pointsForm.type) ? 1 : -1) * parseInt(pointsForm.points || "0")).toLocaleString()}
                  </span> points
                  <span className="text-gray-500 ml-2 text-xs">(Tier: {calcTier(Math.max(0, selectedAccount.points_balance + (["earn","bonus"].includes(pointsForm.type) ? 1 : -1) * parseInt(pointsForm.points || "0")))})</span>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-800">
              <button onClick={() => setIsPointsModalOpen(false)} className="px-4 py-2 text-sm text-gray-400 border border-gray-700 rounded-lg hover:text-white transition-all">Cancel</button>
              <button onClick={handleAddPoints} disabled={isSaving}
                className="px-5 py-2 text-sm bg-cyan-500 hover:bg-cyan-400 text-black font-bold rounded-lg transition-all disabled:opacity-50">
                {isSaving ? "Saving…" : "Apply Points"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Detail Modal ───────────────────────────────────────────────────────── */}
      {isDetailOpen && selectedAccount && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 backdrop-blur-sm overflow-y-auto p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-lg my-4 shadow-2xl">
            <div className="flex items-start justify-between px-6 py-4 border-b border-gray-800">
              <div>
                <p className={`text-xs font-bold ${TIER_CONFIG[selectedAccount.tier].textColor}`}>
                  {TIER_CONFIG[selectedAccount.tier].icon} {TIER_CONFIG[selectedAccount.tier].label} Member
                </p>
                <h2 className="font-bold text-xl text-white">{selectedAccount.customer_name}</h2>
                <p className="text-sm text-gray-400">{selectedAccount.customer_phone}</p>
              </div>
              <button onClick={() => setIsDetailOpen(false)} className="text-gray-500 hover:text-white text-xl transition-colors">✕</button>
            </div>
            <div className="px-6 py-5 space-y-4 max-h-[calc(100vh-200px)] overflow-y-auto">
              <div className={`rounded-xl border p-4 text-center ${TIER_CONFIG[selectedAccount.tier].bg} ${TIER_CONFIG[selectedAccount.tier].color}`}>
                <p className={`text-5xl font-black ${TIER_CONFIG[selectedAccount.tier].textColor}`}>{selectedAccount.points_balance.toLocaleString()}</p>
                <p className="text-sm text-gray-400 mt-1">points balance</p>
                <div className="flex justify-center gap-6 mt-3 text-xs text-gray-500">
                  <span>Earned: <span className="text-white font-semibold">{selectedAccount.total_earned.toLocaleString()}</span></span>
                  <span>Redeemed: <span className="text-white font-semibold">{selectedAccount.total_redeemed.toLocaleString()}</span></span>
                </div>
              </div>

              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Transaction History</p>
              <div className="space-y-2">
                {transactions.filter(t => t.account_id === selectedAccount.id).length === 0 && (
                  <p className="text-sm text-gray-600 text-center py-4">No transactions yet</p>
                )}
                {transactions.filter(t => t.account_id === selectedAccount.id).map(tx => {
                  const cfg = TX_CONFIG[tx.type];
                  return (
                    <div key={tx.id} className="flex items-center justify-between bg-gray-800/50 rounded-lg px-3 py-2">
                      <div>
                        <p className="text-sm text-white">{tx.description}</p>
                        <p className="text-xs text-gray-500">{new Date(tx.created_at).toLocaleString()} {tx.reference_id ? `· ${tx.reference_id}` : ""}</p>
                      </div>
                      <div className="text-right">
                        <p className={`font-bold ${cfg.color}`}>{cfg.sign !== "±" ? cfg.sign : ""}{tx.points.toLocaleString()}</p>
                        <p className="text-xs text-gray-500">{tx.balance_after.toLocaleString()} bal</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="flex justify-between gap-3 px-6 py-4 border-t border-gray-800">
              <button onClick={() => setDeleteId(selectedAccount.id)} className="px-4 py-2 text-sm text-rose-400 border border-rose-500/30 rounded-lg hover:text-rose-300 transition-all">Remove</button>
              <div className="flex gap-2">
                <button onClick={() => { setIsDetailOpen(false); setIsPointsModalOpen(true); }}
                  className="px-4 py-2 text-sm bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 rounded-lg hover:bg-cyan-500/20 transition-all">+ Points</button>
                <button onClick={() => setIsDetailOpen(false)} className="px-4 py-2 text-sm bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-all">Close</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 max-w-sm w-full shadow-2xl">
            <p className="text-white font-semibold mb-2">Remove this member?</p>
            <p className="text-gray-400 text-sm mb-5">This will delete the account and all transaction history.</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setDeleteId(null)} className="px-4 py-2 text-sm text-gray-400 border border-gray-700 rounded-lg hover:text-white transition-all">Cancel</button>
              <button onClick={confirmDelete} disabled={isDeleting} className="px-4 py-2 text-sm bg-rose-500 hover:bg-rose-400 text-white font-bold rounded-lg transition-all disabled:opacity-50">
                {isDeleting ? "Removing…" : "Remove"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
