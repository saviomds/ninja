"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface AppUpdate {
  id: string;
  info: string;
  content: string;
  link: string;
  created_at?: string;
  priority?: "low" | "medium" | "high";
  type?: "feature" | "fix" | "announcement";
}

const typeIcons: Record<string, string> = { feature: "✨", fix: "🔧", announcement: "📣" };
const priorityColors: Record<string, string> = {
  high: "text-red-400 bg-red-500/10 border-red-500/20",
  medium: "text-amber-400 bg-amber-500/10 border-amber-500/20",
  low: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
};

type UpdateForm = { info: string; content: string; link: string; priority: "low" | "medium" | "high"; type: "feature" | "fix" | "announcement" };
const emptyForm = (): UpdateForm => ({ info: "", content: "", link: "", priority: "low", type: "announcement" });

export default function AdminUpdatesPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [updates, setUpdates] = useState<AppUpdate[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<UpdateForm>(emptyForm());
  const [editId, setEditId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
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
      fetchUpdates();
    });
  }, [router]);

  const fetchUpdates = async () => {
    setLoading(true);
    const { data } = await supabase.from("updates").select("*").order("created_at", { ascending: false });
    setUpdates(data || []);
    setLoading(false);
  };

  const handleSave = async () => {
    if (!form.info.trim() || !form.content.trim()) { showToast("Title and content are required", false); return; }
    setSaving(true);
    const payload = { info: form.info.trim(), content: form.content.trim(), link: form.link.trim() || null, priority: form.priority, type: form.type };
    if (editId) {
      const { error } = await supabase.from("updates").update(payload).eq("id", editId);
      setSaving(false);
      if (error) { showToast("Error: " + error.message, false); return; }
      showToast("Update saved!");
    } else {
      const { error } = await supabase.from("updates").insert(payload);
      setSaving(false);
      if (error) { showToast("Error: " + error.message, false); return; }
      showToast("Update posted! Notifying subscribers…");
      fetch("/api/notify-subscribers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "update", title: payload.info, content: payload.content, updateType: payload.type, link: payload.link }),
      }).catch(console.error);
    }
    setForm(emptyForm());
    setEditId(null);
    fetchUpdates();
  };

  const handleEdit = (u: AppUpdate) => {
    setForm({ info: u.info, content: u.content, link: u.link || "", priority: u.priority || "low", type: u.type || "announcement" });
    setEditId(u.id);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    const { error } = await supabase.from("updates").delete().eq("id", confirmDelete);
    setDeleting(false);
    setConfirmDelete(null);
    if (error) { showToast("Delete failed: " + error.message, false); return; }
    showToast("Update deleted");
    setUpdates((prev) => prev.filter((u) => u.id !== confirmDelete));
  };

  const inputBase = "w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/30 transition-all";

  if (checking) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-[#030712] flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#030712] text-gray-900 dark:text-gray-100 p-6 md:p-10">
      <div className="max-w-4xl mx-auto space-y-8">

        <div className="flex items-center justify-between">
          <div>
            <Link href="/admin" className="text-xs text-cyan-500 hover:text-cyan-400 font-semibold mb-1 inline-block">← Admin Panel</Link>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{editId ? "Edit Update" : "Post Update"}</h1>
          </div>
        </div>

        {/* Form */}
        <div className="bg-white dark:bg-gray-900/60 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 space-y-4">
          <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
            {editId ? "Editing update" : "New announcement"}
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider block mb-1.5">Title *</label>
              <input
                value={form.info}
                onChange={(e) => setForm({ ...form, info: e.target.value })}
                placeholder="e.g. New feature launched"
                className={inputBase}
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider block mb-1.5">Type</label>
              <div className="flex gap-2">
                {(["feature", "fix", "announcement"] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setForm({ ...form, type: t })}
                    className={`flex-1 py-2 rounded-xl text-xs font-semibold border transition-all ${
                      form.type === t
                        ? "bg-cyan-600/20 border-cyan-500/50 text-cyan-600 dark:text-cyan-300"
                        : "bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-600"
                    }`}
                  >
                    {typeIcons[t]} {t}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider block mb-1.5">Priority</label>
              <div className="flex gap-2">
                {(["low", "medium", "high"] as const).map((p) => (
                  <button
                    key={p}
                    onClick={() => setForm({ ...form, priority: p })}
                    className={`flex-1 py-2 rounded-xl text-xs font-semibold border transition-all capitalize ${
                      form.priority === p
                        ? priorityColors[p]
                        : "bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-600"
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            <div className="sm:col-span-2">
              <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider block mb-1.5">Content *</label>
              <textarea
                value={form.content}
                onChange={(e) => setForm({ ...form, content: e.target.value })}
                rows={4}
                placeholder="Describe the update in detail…"
                className={`${inputBase} resize-none`}
              />
            </div>

            <div className="sm:col-span-2">
              <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider block mb-1.5">Link (optional)</label>
              <input
                value={form.link}
                onChange={(e) => setForm({ ...form, link: e.target.value })}
                placeholder="https://..."
                className={inputBase}
              />
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-6 py-2.5 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors"
            >
              {saving ? "Saving…" : editId ? "Save Changes" : "Post Update"}
            </button>
            {editId && (
              <button
                onClick={() => { setForm(emptyForm()); setEditId(null); }}
                className="px-6 py-2.5 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 text-sm font-semibold rounded-xl transition-colors border border-gray-200 dark:border-gray-700"
              >
                Cancel
              </button>
            )}
          </div>
        </div>

        {/* Updates list */}
        <div className="bg-white dark:bg-gray-900/60 border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800">
            <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              All Updates ({updates.length})
            </h2>
          </div>
          {loading ? (
            <div className="p-8 text-center text-gray-400 dark:text-gray-500">Loading…</div>
          ) : updates.length === 0 ? (
            <div className="p-8 text-center text-gray-400 dark:text-gray-500">No updates yet.</div>
          ) : (
            <div className="divide-y divide-gray-50 dark:divide-gray-800">
              {updates.map((u) => (
                <div key={u.id} className="px-6 py-4 hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="text-base">{typeIcons[u.type || "announcement"]}</span>
                        <h3 className="font-semibold text-gray-900 dark:text-white text-sm">{u.info}</h3>
                        {u.priority && (
                          <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-md border ${priorityColors[u.priority]}`}>
                            {u.priority}
                          </span>
                        )}
                      </div>
                      <p className="text-gray-500 dark:text-gray-400 text-xs line-clamp-2">{u.content}</p>
                      {u.created_at && (
                        <p className="text-gray-400 dark:text-gray-600 text-xs mt-1">
                          {new Date(u.created_at).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={() => handleEdit(u)}
                        className="px-3 py-1.5 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 text-xs font-medium rounded-lg transition-colors"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => setConfirmDelete(u.id)}
                        className="px-3 py-1.5 bg-red-50 dark:bg-red-500/10 hover:bg-red-100 dark:hover:bg-red-500/20 border border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-400 text-xs font-medium rounded-lg transition-colors"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 dark:bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl p-6 max-w-sm w-full shadow-2xl">
            <h3 className="font-bold text-gray-900 dark:text-white text-lg mb-2">Delete update?</h3>
            <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">This will remove the announcement for all users.</p>
            <div className="flex gap-3">
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors"
              >
                {deleting ? "Deleting…" : "Delete"}
              </button>
              <button
                onClick={() => setConfirmDelete(null)}
                className="flex-1 py-2.5 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 text-sm font-semibold rounded-xl transition-colors border border-gray-200 dark:border-gray-700"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className={`fixed bottom-6 right-6 z-[110] flex items-center gap-3 px-5 py-3 rounded-xl shadow-2xl border text-sm font-semibold
          ${toast.ok ? "bg-emerald-50 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/30" : "bg-red-50 dark:bg-red-500/20 text-red-700 dark:text-red-300 border-red-200 dark:border-red-500/30"}`}>
          {toast.ok ? "✅" : "❌"} {toast.msg}
        </div>
      )}
    </div>
  );
}
