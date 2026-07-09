"use client";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface Admin {
  id: string;
  email: string;
  name: string | null;
  createdAt: string;
  passwordEnabled: boolean;
  passwordUpdatedAt: string | null;
  lastPasswordLoginAt: string | null;
}

// Client-side password policy mirror of validatePassword() on the server.
function pwError(pw: string): string | null {
  if (pw.length < 8) return "At least 8 characters.";
  if (!/[a-z]/.test(pw)) return "Add a lowercase letter.";
  if (!/[A-Z]/.test(pw)) return "Add an uppercase letter.";
  if (!/[0-9]/.test(pw)) return "Add a number.";
  return null;
}

export default function AdminAdminsPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  // Create-admin form
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [enablePassword, setEnablePassword] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);

  // Per-admin password reset
  const [resetFor, setResetFor] = useState<string | null>(null);
  const [resetPw, setResetPw] = useState("");
  const [resetConfirm, setResetConfirm] = useState("");

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchAdmins = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/admins");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load admins.");
      setAdmins(data.admins || []);
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Failed to load admins.", false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const user = data?.user;
      if (!user) { router.replace("/login"); return; }
      const role = user.user_metadata?.role || user.app_metadata?.role;
      if (role !== "admin") { router.replace("/"); return; }
      setChecking(false);
      fetchAdmins();
    });
  }, [router, fetchAdmins]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (enablePassword) {
      const err = pwError(password);
      if (err) return showToast(err, false);
      if (password !== confirm) return showToast("Passwords do not match.", false);
    }
    setSaving(true);
    try {
      const res = await fetch("/api/admin/admins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, enablePassword, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create admin.");
      showToast("Admin created.");
      setShowCreate(false);
      setName(""); setEmail(""); setEnablePassword(false); setPassword(""); setConfirm("");
      fetchAdmins();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to create admin.", false);
    } finally {
      setSaving(false);
    }
  };

  const togglePassword = async (a: Admin) => {
    try {
      const res = await fetch("/api/admin/admins", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: a.id, enablePassword: !a.passwordEnabled }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update.");
      showToast(`Password login ${!a.passwordEnabled ? "enabled" : "disabled"} for ${a.email}.`);
      fetchAdmins();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to update.", false);
    }
  };

  const handleReset = async (a: Admin) => {
    const err = pwError(resetPw);
    if (err) return showToast(err, false);
    if (resetPw !== resetConfirm) return showToast("Passwords do not match.", false);
    try {
      const res = await fetch("/api/admin/admins", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: a.id, password: resetPw, enablePassword: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to set password.");
      showToast(`Password set for ${a.email}.`);
      setResetFor(null); setResetPw(""); setResetConfirm("");
      fetchAdmins();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Failed to set password.", false);
    }
  };

  if (checking) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-[#030712] flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const inputCls =
    "w-full bg-white dark:bg-gray-900/60 border border-gray-200 dark:border-gray-800 rounded-xl px-4 py-2.5 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/30 transition-all";

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#030712] text-gray-900 dark:text-gray-100 p-6 md:p-10">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <Link href="/admin" className="text-xs text-cyan-500 hover:text-cyan-400 font-semibold mb-1 inline-block">← Admin Panel</Link>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Admin Accounts</h1>
            <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
              Manage administrators and optional password login. Magic link always works.
            </p>
          </div>
          <button
            onClick={() => setShowCreate((v) => !v)}
            className="px-4 py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-semibold rounded-xl transition-colors flex-shrink-0"
          >
            {showCreate ? "Close" : "+ New admin"}
          </button>
        </div>

        {/* Create form */}
        {showCreate && (
          <form onSubmit={handleCreate} className="bg-white dark:bg-gray-900/60 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 space-y-4">
            <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Create administrator</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">Name</label>
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Doe" className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">Email</label>
                <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@example.com" className={inputCls} />
              </div>
            </div>

            <label className="flex items-center gap-3 cursor-pointer select-none">
              <input type="checkbox" checked={enablePassword} onChange={(e) => setEnablePassword(e.target.checked)} className="w-4 h-4 accent-cyan-600" />
              <span className="text-sm text-gray-700 dark:text-gray-300">Enable password login (otherwise magic-link only)</span>
            </label>

            {enablePassword && (
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5">Password</label>
                  <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Min 8, upper, lower, number" className={inputCls} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5">Confirm password</label>
                  <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Re-enter password" className={inputCls} />
                </div>
              </div>
            )}

            <div className="flex justify-end">
              <button type="submit" disabled={saving} className="px-5 py-2.5 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors">
                {saving ? "Creating…" : "Create admin"}
              </button>
            </div>
          </form>
        )}

        {/* Admin list */}
        <div className="bg-white dark:bg-gray-900/60 border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Administrators ({admins.length})</h2>
            <button onClick={fetchAdmins} className="text-xs text-cyan-500 hover:text-cyan-400 font-semibold">Refresh</button>
          </div>

          {loading ? (
            <div className="p-8 text-center text-gray-400 dark:text-gray-500">Loading…</div>
          ) : admins.length === 0 ? (
            <div className="p-8 text-center text-gray-400 dark:text-gray-500">No administrators yet.</div>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {admins.map((a) => (
                <div key={a.id} className="px-6 py-4">
                  <div className="flex items-center gap-4">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-cyan-500/20 to-violet-500/20 border border-cyan-500/20 flex items-center justify-center text-sm font-bold text-cyan-600 dark:text-cyan-300 flex-shrink-0">
                      {(a.name || a.email).charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 dark:text-white text-sm truncate">{a.name || a.email}</p>
                      <p className="text-xs text-gray-400 dark:text-gray-600 truncate">{a.email}</p>
                    </div>
                    <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full flex-shrink-0 ${a.passwordEnabled ? "bg-emerald-50 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" : "bg-gray-100 dark:bg-gray-800 text-gray-400"}`}>
                      {a.passwordEnabled ? "Password on" : "Magic-link only"}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 mt-3 pl-13">
                    <button
                      onClick={() => togglePassword(a)}
                      className="px-3 py-1.5 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 text-xs font-medium rounded-lg transition-colors"
                    >
                      {a.passwordEnabled ? "Disable password login" : "Enable password login"}
                    </button>
                    <button
                      onClick={() => { setResetFor(resetFor === a.id ? null : a.id); setResetPw(""); setResetConfirm(""); }}
                      className="px-3 py-1.5 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 text-xs font-medium rounded-lg transition-colors"
                    >
                      {a.passwordEnabled ? "Reset password" : "Set password"}
                    </button>
                    {a.lastPasswordLoginAt && (
                      <span className="text-[11px] text-gray-400">
                        Last password login: {new Date(a.lastPasswordLoginAt).toLocaleDateString()}
                      </span>
                    )}
                  </div>

                  {resetFor === a.id && (
                    <div className="mt-3 grid sm:grid-cols-[1fr_1fr_auto] gap-2 items-center">
                      <input type="password" value={resetPw} onChange={(e) => setResetPw(e.target.value)} placeholder="New password" className={inputCls} />
                      <input type="password" value={resetConfirm} onChange={(e) => setResetConfirm(e.target.value)} placeholder="Confirm" className={inputCls} />
                      <button onClick={() => handleReset(a)} className="px-4 py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-semibold rounded-xl transition-colors whitespace-nowrap">
                        Save
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {toast && (
        <div className={`fixed bottom-6 right-6 z-[110] flex items-center gap-3 px-5 py-3 rounded-xl shadow-2xl border text-sm font-semibold
          ${toast.ok ? "bg-emerald-50 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/30" : "bg-red-50 dark:bg-red-500/20 text-red-700 dark:text-red-300 border-red-200 dark:border-red-500/30"}`}>
          {toast.ok ? "✅" : "❌"} {toast.msg}
        </div>
      )}
    </div>
  );
}
