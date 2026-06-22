"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";

interface SocialProfile {
  id: string;
  platform_name: string;
  platform_icon: string;
  profile_link: string;
  username: string;
  email: string;
  description?: string;
  is_active?: boolean;
}

const emptyForm = () => ({
  platform_name: "", platform_icon: "", profile_link: "", username: "",
  email: "", description: "", is_active: true,
});

const COMMON_PLATFORMS = [
  { name: "Instagram", icon: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a5/Instagram_icon.png/120px-Instagram_icon.png" },
  { name: "Facebook", icon: "https://upload.wikimedia.org/wikipedia/commons/thumb/0/05/Facebook_Logo_%282019%29.png/120px-Facebook_Logo_%282019%29.png" },
  { name: "TikTok", icon: "https://upload.wikimedia.org/wikipedia/en/thumb/a/a9/TikTok_logo.svg/120px-TikTok_logo.svg.png" },
  { name: "YouTube", icon: "https://upload.wikimedia.org/wikipedia/commons/thumb/0/09/YouTube_full-color_icon_%282017%29.svg/120px-YouTube_full-color_icon_%282017%29.svg.png" },
  { name: "WhatsApp", icon: "https://upload.wikimedia.org/wikipedia/commons/thumb/6/6b/WhatsApp.svg/120px-WhatsApp.svg.png" },
  { name: "X (Twitter)", icon: "https://upload.wikimedia.org/wikipedia/commons/thumb/c/ce/X_logo_2023.svg/120px-X_logo_2023.svg.png" },
];

export default function AdminSocialPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [profiles, setProfiles] = useState<SocialProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm());
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
      fetchProfiles();
    });
  }, [router]);

  const fetchProfiles = async () => {
    setLoading(true);
    const { data } = await supabase.from("social_profiles").select("*").order("created_at", { ascending: false });
    setProfiles(data || []);
    setLoading(false);
  };

  const handleSave = async () => {
    if (!form.platform_name.trim() || !form.profile_link.trim()) {
      showToast("Platform name and link are required", false); return;
    }
    setSaving(true);
    const payload = { ...form };
    const { error } = editId
      ? await supabase.from("social_profiles").update(payload).eq("id", editId)
      : await supabase.from("social_profiles").insert([payload]);
    setSaving(false);
    if (error) { showToast("Error: " + error.message, false); return; }
    showToast(editId ? "Profile updated!" : "Profile added!");
    setForm(emptyForm());
    setEditId(null);
    fetchProfiles();
  };

  const handleEdit = (p: SocialProfile) => {
    setForm({
      platform_name: p.platform_name || "", platform_icon: p.platform_icon || "",
      profile_link: p.profile_link || "", username: p.username || "",
      email: p.email || "",
      description: p.description || "", is_active: p.is_active ?? true,
    });
    setEditId(p.id);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    const { error } = await supabase.from("social_profiles").delete().eq("id", confirmDelete);
    setDeleting(false);
    setConfirmDelete(null);
    if (error) { showToast("Delete failed: " + error.message, false); return; }
    showToast("Profile deleted");
    setProfiles((prev) => prev.filter((p) => p.id !== confirmDelete));
  };

  const handleToggleActive = async (p: SocialProfile) => {
    const { error } = await supabase.from("social_profiles").update({ is_active: !p.is_active }).eq("id", p.id);
    if (error) { showToast("Toggle failed", false); return; }
    fetchProfiles();
  };

  const applyPlatform = (platform: { name: string; icon: string }) => {
    setForm((f) => ({ ...f, platform_name: platform.name, platform_icon: platform.icon }));
  };

  const inputClass = "w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/30 transition-all";

  if (checking) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-[#030712] flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#030712] text-gray-900 dark:text-gray-100 p-6 md:p-10">
      <div className="max-w-5xl mx-auto space-y-8">

        <div>
          <Link href="/admin" className="text-xs text-cyan-500 hover:text-cyan-400 font-semibold mb-1 inline-block">← Admin Panel</Link>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{editId ? "Edit Social Profile" : "Social Links"}</h1>
        </div>

        {/* Quick platform picker */}
        <div className="flex gap-2 flex-wrap">
          {COMMON_PLATFORMS.map((p) => (
            <button
              key={p.name}
              onClick={() => applyPlatform(p)}
              className="flex items-center gap-2 px-3 py-1.5 bg-white dark:bg-gray-900 hover:bg-gray-100 dark:hover:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 rounded-xl text-xs font-medium text-gray-600 dark:text-gray-300 transition-all"
            >
              <Image src={p.icon} alt={p.name} width={16} height={16} unoptimized className="w-4 h-4 object-contain" />
              {p.name}
            </button>
          ))}
        </div>

        {/* Form */}
        <div className="bg-white dark:bg-gray-900/60 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 space-y-4">
          <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
            {editId ? "Editing profile" : "New social profile"}
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider block mb-1.5">Platform Name *</label>
              <input value={form.platform_name} onChange={(e) => setForm({ ...form, platform_name: e.target.value })} placeholder="Instagram" className={inputClass} />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider block mb-1.5">Icon URL</label>
              <div className="flex gap-2">
                <input value={form.platform_icon} onChange={(e) => setForm({ ...form, platform_icon: e.target.value })} placeholder="https://..." className={inputClass} />
                {form.platform_icon && (
                  <div className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 flex-shrink-0 overflow-hidden">
                    <Image src={form.platform_icon} alt="" width={40} height={40} unoptimized className="object-contain w-full h-full" />
                  </div>
                )}
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider block mb-1.5">Profile Link *</label>
              <input value={form.profile_link} onChange={(e) => setForm({ ...form, profile_link: e.target.value })} placeholder="https://instagram.com/techninja" className={inputClass} />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider block mb-1.5">Username</label>
              <input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} placeholder="@techninja" className={inputClass} />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider block mb-1.5">Account Email</label>
              <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="account@email.com" className={inputClass} />
            </div>
            <div className="flex items-center gap-3 pt-5">
              <button
                onClick={() => setForm({ ...form, is_active: !form.is_active })}
                className={`relative w-11 h-6 rounded-full transition-colors ${form.is_active ? "bg-cyan-600" : "bg-gray-300 dark:bg-gray-700"}`}
              >
                <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${form.is_active ? "translate-x-5" : ""}`} />
              </button>
              <span className="text-sm text-gray-600 dark:text-gray-300">{form.is_active ? "Active" : "Inactive"}</span>
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider block mb-1.5">Description</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={2}
                placeholder="Short description of this profile…"
                className={`${inputClass} resize-none`}
              />
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-6 py-2.5 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors"
            >
              {saving ? "Saving…" : editId ? "Update Profile" : "Add Profile"}
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

        {/* Profiles list */}
        <div className="bg-white dark:bg-gray-900/60 border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800">
            <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              All Profiles ({profiles.length})
            </h2>
          </div>
          {loading ? (
            <div className="p-8 text-center text-gray-400 dark:text-gray-500">Loading…</div>
          ) : profiles.length === 0 ? (
            <div className="p-8 text-center text-gray-400 dark:text-gray-500">No social profiles yet.</div>
          ) : (
            <div className="divide-y divide-gray-50 dark:divide-gray-800">
              {profiles.map((p) => (
                <div key={p.id} className="px-6 py-4 hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 flex-shrink-0 overflow-hidden flex items-center justify-center">
                      {p.platform_icon ? (
                        <Image src={p.platform_icon} alt={p.platform_name} width={40} height={40} unoptimized className="object-contain w-full h-full p-1" />
                      ) : (
                        <span className="text-lg font-bold text-gray-400 dark:text-gray-500">{p.platform_name.charAt(0)}</span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-gray-900 dark:text-white text-sm">{p.platform_name}</h3>
                        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${p.is_active ? "bg-emerald-500" : "bg-gray-300 dark:bg-gray-600"}`} />
                      </div>
                      {p.username && <p className="text-xs text-gray-500 dark:text-gray-400">@{p.username}</p>}
                      {p.email && <span className="text-xs text-gray-400 dark:text-gray-600 mt-1 block">{p.email}</span>}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={() => handleToggleActive(p)}
                        className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                          p.is_active
                            ? "bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-500/20"
                            : "bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-600"
                        }`}
                      >
                        {p.is_active ? "Active" : "Inactive"}
                      </button>
                      <button
                        onClick={() => handleEdit(p)}
                        className="px-3 py-1.5 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 text-xs font-medium rounded-lg transition-colors"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => setConfirmDelete(p.id)}
                        className="px-3 py-1.5 bg-red-50 dark:bg-red-500/10 hover:bg-red-100 dark:hover:bg-red-500/20 border border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-400 text-xs font-medium rounded-lg transition-colors"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                  {p.description && <p className="text-xs text-gray-500 mt-2 pl-14">{p.description}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Confirm Delete Modal */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 dark:bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl p-6 max-w-sm w-full shadow-2xl">
            <h3 className="font-bold text-gray-900 dark:text-white text-lg mb-2">Delete profile?</h3>
            <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">This will remove it from the public-facing site.</p>
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

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-[110] flex items-center gap-3 px-5 py-3 rounded-xl shadow-2xl border text-sm font-semibold
          ${toast.ok ? "bg-emerald-50 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/30" : "bg-red-50 dark:bg-red-500/20 text-red-700 dark:text-red-300 border-red-200 dark:border-red-500/30"}`}>
          {toast.ok ? "✅" : "❌"} {toast.msg}
        </div>
      )}
    </div>
  );
}
