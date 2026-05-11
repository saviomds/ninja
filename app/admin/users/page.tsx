"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface Profile {
  id: string;
  username: string | null;
}

export default function AdminUsersPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const user = data?.user;
      if (!user) { router.replace("/login"); return; }
      const role = user.user_metadata?.role || user.app_metadata?.role;
      if (role !== "admin") { router.replace("/"); return; }
      setChecking(false);
      fetchUsers();
    });
  }, [router]);

  const fetchUsers = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("profiles")
      .select("id, username")
      .order("id", { ascending: false });
    if (error) { showToast("Failed to load users: " + error.message, false); }
    setProfiles(data || []);
    setLoading(false);
  };

  const handleCopyId = (id: string) => {
    navigator.clipboard.writeText(id).then(() => showToast("User ID copied!"));
  };

  const filtered = profiles.filter((p) => {
    const q = search.toLowerCase();
    return !q || (p.username?.toLowerCase().includes(q)) || p.id.includes(q);
  });

  if (checking) {
    return (
      <div className="min-h-screen bg-[#030712] flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#030712] text-gray-100 p-6 md:p-10">
      <div className="max-w-4xl mx-auto space-y-6">

        <div>
          <Link href="/admin" className="text-xs text-cyan-500 hover:text-cyan-400 font-semibold mb-1 inline-block">← Admin Panel</Link>
          <h1 className="text-2xl font-bold text-white">Users</h1>
          <p className="text-gray-400 text-sm mt-1">{profiles.length} registered {profiles.length === 1 ? "user" : "users"}</p>
        </div>

        {/* Search */}
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">🔍</span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by username or ID…"
            className="w-full bg-gray-900/60 border border-gray-800 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/30 transition-all"
          />
        </div>

        {/* Table */}
        <div className="bg-gray-900/60 border border-gray-800 rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
              {search ? `${filtered.length} result${filtered.length !== 1 ? "s" : ""}` : `All Users (${profiles.length})`}
            </h2>
            <button onClick={fetchUsers} className="text-xs text-cyan-500 hover:text-cyan-400 font-semibold transition-colors">Refresh</button>
          </div>

          {loading ? (
            <div className="p-8 text-center text-gray-500">Loading users…</div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-gray-500">{search ? "No users match your search." : "No users registered yet."}</div>
          ) : (
            <div className="divide-y divide-gray-800">
              {filtered.map((p, i) => (
                <div key={p.id} className="flex items-center gap-4 px-6 py-4 hover:bg-gray-800/30 transition-colors">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-cyan-500/20 to-violet-500/20 border border-cyan-500/20 flex items-center justify-center text-sm font-bold text-cyan-300 flex-shrink-0">
                    {p.username ? p.username.charAt(0).toUpperCase() : "?"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-white text-sm">{p.username || <span className="text-gray-500 italic">No username</span>}</p>
                    <p className="text-xs text-gray-600 font-mono truncate mt-0.5">{p.id}</p>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <button onClick={() => handleCopyId(p.id)}
                      className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 text-xs font-medium rounded-lg transition-colors">
                      Copy ID
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="text-xs text-gray-600 text-center">
          User emails are managed securely in Supabase Auth and not exposed here.
        </div>
      </div>

      {toast && (
        <div className={`fixed bottom-6 right-6 z-[110] flex items-center gap-3 px-5 py-3 rounded-xl shadow-2xl border text-sm font-semibold
          ${toast.ok ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30" : "bg-red-500/20 text-red-300 border-red-500/30"}`}>
          {toast.ok ? "✅" : "❌"} {toast.msg}
        </div>
      )}
    </div>
  );
}
