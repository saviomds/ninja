"use client";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { User } from "@supabase/supabase-js";
import Image from "next/image";
import Link from "next/link";

interface Profile {
  id: string;
  username: string | null;
  full_name: string | null;
  bio: string | null;
  phone: string | null;
  location: string | null;
  avatar_url: string | null;
  is_public: boolean;
}

export default function ProfilePage() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  const [form, setForm] = useState({
    username: "",
    full_name: "",
    bio: "",
    phone: "",
    location: "",
    is_public: false,
  });

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  };

  useEffect(() => {
    const init = async () => {
      const { data: authData } = await supabase.auth.getUser();
      const u = authData?.user;
      if (!u) { router.replace("/login"); return; }
      setUser(u);
      const role = u.user_metadata?.role || u.app_metadata?.role;
      setIsAdmin(role === "admin");

      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", u.id)
        .single();

      if (data) {
        setProfile({
          id: data.id,
          username: data.username ?? null,
          full_name: data.full_name ?? null,
          bio: data.bio ?? null,
          phone: data.phone ?? null,
          location: data.location ?? null,
          avatar_url: data.avatar_url ?? null,
          is_public: data.is_public ?? false,
        });
        setForm({
          username: data.username || "",
          full_name: data.full_name || "",
          bio: data.bio || "",
          phone: data.phone || "",
          location: data.location || "",
          is_public: data.is_public ?? false,
        });
        if (data.avatar_url) setAvatarPreview(data.avatar_url);
      } else if (error && error.code !== "PGRST116") {
        // Real error (not just "no row found") — log it but still show the form
        console.error("Profile fetch error:", error.message);
        setProfile({ id: u.id, username: null, full_name: null, bio: null, phone: null, location: null, avatar_url: null, is_public: false });
      } else {
        // No profile row yet (new user) — show empty form
        setProfile({ id: u.id, username: null, full_name: null, bio: null, phone: null, location: null, avatar_url: null, is_public: false });
      }
      setLoading(false);
    };
    init();
  }, [router]);

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const allowed = ["jpg", "jpeg", "png", "webp", "gif"];
    if (!allowed.includes(ext)) { showToast("Only JPG, PNG, WEBP or GIF allowed", false); return; }
    if (file.size > 5 * 1024 * 1024) { showToast("Image must be under 5 MB", false); return; }

    setUploadingAvatar(true);
    const path = `${user.id}/avatar.${ext}`;

    const { error: upErr } = await supabase.storage
      .from("avatars")
      .upload(path, file, { upsert: true, contentType: file.type });

    if (upErr) {
      setUploadingAvatar(false);
      showToast("Upload failed: " + upErr.message, false);
      return;
    }

    const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path);
    const publicUrl = urlData.publicUrl + `?t=${Date.now()}`;

    const { error: dbErr } = await supabase
      .from("profiles")
      .upsert({ id: user.id, avatar_url: publicUrl }, { onConflict: "id" });

    setUploadingAvatar(false);
    if (dbErr) { showToast("Saved image but DB update failed: " + dbErr.message, false); return; }
    setAvatarPreview(publicUrl);
    showToast("Profile photo updated!");
  };

  const handleSave = async () => {
    if (!user) return;
    if (!form.username.trim()) { showToast("Username is required", false); return; }
    setSaving(true);

    const payload = {
      id: user.id,
      username: form.username.trim(),
      full_name: form.full_name.trim() || null,
      bio: form.bio.trim() || null,
      phone: form.phone.trim() || null,
      location: form.location.trim() || null,
      is_public: form.is_public,
    };

    let { error } = await supabase
      .from("profiles")
      .upsert(payload, { onConflict: "id" });

    // If is_public column doesn't exist yet, retry without it
    if (error && error.message.includes("is_public")) {
      const { is_public: _omit, ...payloadWithout } = payload;
      ({ error } = await supabase
        .from("profiles")
        .upsert(payloadWithout, { onConflict: "id" }));
    }

    setSaving(false);
    if (error) { showToast("Save failed: " + error.message, false); return; }
    showToast("Profile saved!");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white dark:bg-[#030712] flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const initials = (form.full_name || form.username || user?.email || "?")
    .trim()
    .charAt(0)
    .toUpperCase();

  const memberSince = user?.created_at
    ? new Date(user.created_at).toLocaleDateString("en-US", { month: "long", year: "numeric" })
    : "—";

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#030712] text-gray-900 dark:text-gray-100">

      {/* Top bar */}
      <div className={`h-1.5 w-full ${isAdmin ? "bg-gradient-to-r from-violet-500 via-cyan-500 to-violet-500" : "bg-gradient-to-r from-blue-500 via-indigo-500 to-blue-500"}`} />

      <div className="max-w-3xl mx-auto px-4 py-10 space-y-6">

        {/* Back link */}
        <Link
          href={isAdmin ? "/dashboard" : "/client-dashboard"}
          className="inline-flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to {isAdmin ? "Admin Dashboard" : "My Dashboard"}
        </Link>

        {/* Header card */}
        <div className="bg-white dark:bg-gray-900/60 border border-gray-200 dark:border-gray-800 rounded-3xl overflow-hidden shadow-sm">

          {/* Banner */}
          <div className={`h-28 ${isAdmin
            ? "bg-gradient-to-r from-violet-600/30 via-cyan-600/20 to-violet-600/30 dark:from-violet-900/50 dark:via-cyan-900/30 dark:to-violet-900/50"
            : "bg-gradient-to-r from-blue-600/20 via-indigo-600/15 to-blue-600/20 dark:from-blue-900/50 dark:via-indigo-900/30 dark:to-blue-900/50"}`}
          />

          <div className="px-6 pb-6">
            {/* Avatar */}
            <div className="flex items-end justify-between -mt-12 mb-4">
              <div className="relative group">
                <div className="w-24 h-24 rounded-2xl border-4 border-white dark:border-gray-900 overflow-hidden bg-gray-100 dark:bg-gray-800 shadow-lg">
                  {avatarPreview ? (
                    <Image
                      src={avatarPreview}
                      alt="Avatar"
                      width={96}
                      height={96}
                      unoptimized
                      className="object-cover w-full h-full"
                    />
                  ) : (
                    <div className={`w-full h-full flex items-center justify-center text-3xl font-bold
                      ${isAdmin ? "bg-gradient-to-br from-violet-500 to-cyan-500 text-white" : "bg-gradient-to-br from-blue-500 to-indigo-500 text-white"}`}>
                      {initials}
                    </div>
                  )}
                </div>

                {/* Upload overlay */}
                <button
                  onClick={() => fileRef.current?.click()}
                  disabled={uploadingAvatar}
                  className="absolute inset-0 rounded-2xl flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                >
                  {uploadingAvatar ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  )}
                </button>

                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
              </div>

              {/* Badges */}
              <div className="flex items-center gap-2 flex-wrap justify-end">
                <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full border
                  ${form.is_public
                    ? "bg-emerald-100 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/30"
                    : "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-700"
                  }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${form.is_public ? "bg-emerald-500 animate-pulse" : "bg-gray-400"}`} />
                  {form.is_public ? "Public" : "Private"}
                </span>
                <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full border
                  ${isAdmin
                    ? "bg-violet-100 dark:bg-violet-500/15 text-violet-700 dark:text-violet-300 border-violet-200 dark:border-violet-500/30"
                    : "bg-blue-100 dark:bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-500/30"
                  }`}>
                  <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${isAdmin ? "bg-violet-500" : "bg-blue-500"}`} />
                  {isAdmin ? "Admin" : "Member"}
                </span>
              </div>
            </div>

            {/* Display name + email */}
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">
              {form.full_name || form.username || "Set your name"}
            </h1>
            {form.username && form.full_name && (
              <p className="text-sm text-gray-500 dark:text-gray-400">@{form.username}</p>
            )}
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{user?.email} · Member since {memberSince}</p>
            {form.bio && <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">{form.bio}</p>}

            {/* Quick info pills */}
            {(form.phone || form.location) && (
              <div className="flex flex-wrap gap-2 mt-3">
                {form.phone && (
                  <span className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-3 py-1 rounded-full">
                    📞 {form.phone}
                  </span>
                )}
                {form.location && (
                  <span className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-3 py-1 rounded-full">
                    📍 {form.location}
                  </span>
                )}
              </div>
            )}

            {/* Upload hint */}
            <p className="text-xs text-gray-400 dark:text-gray-600 mt-3">Hover the photo to change it · Max 5 MB · JPG, PNG, WEBP</p>
          </div>
        </div>

        {/* Edit form */}
        <div className="bg-white dark:bg-gray-900/60 border border-gray-200 dark:border-gray-800 rounded-3xl p-6 shadow-sm space-y-5">
          <h2 className="text-sm font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Edit Profile</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField
              label="Username *"
              value={form.username}
              onChange={(v) => setForm({ ...form, username: v })}
              placeholder="tech_ninja"
              isAdmin={isAdmin}
            />
            <FormField
              label="Full Name"
              value={form.full_name}
              onChange={(v) => setForm({ ...form, full_name: v })}
              placeholder="John Doe"
              isAdmin={isAdmin}
            />
            <FormField
              label="Phone"
              value={form.phone}
              onChange={(v) => setForm({ ...form, phone: v })}
              placeholder="+230 5000 0000"
              type="tel"
              isAdmin={isAdmin}
            />
            <FormField
              label="Location"
              value={form.location}
              onChange={(v) => setForm({ ...form, location: v })}
              placeholder="Mauritius"
              isAdmin={isAdmin}
            />
            <div className="sm:col-span-2">
              <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider block mb-1.5">Bio</label>
              <textarea
                value={form.bio}
                onChange={(e) => setForm({ ...form, bio: e.target.value })}
                rows={3}
                placeholder="Tell us a bit about yourself…"
                className={`w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none transition-all resize-none
                  ${isAdmin
                    ? "focus:border-violet-500 focus:ring-1 focus:ring-violet-500/30"
                    : "focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30"}`}
              />
            </div>
          </div>

          {/* Public / Private toggle */}
          <div className={`flex items-center justify-between gap-4 p-4 rounded-2xl border transition-colors
            ${form.is_public
              ? "bg-emerald-50 dark:bg-emerald-500/5 border-emerald-200 dark:border-emerald-500/20"
              : "bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700"}`}>
            <div>
              <p className="text-sm font-semibold text-gray-900 dark:text-white">
                {form.is_public ? "Public Profile" : "Private Profile"}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                {form.is_public
                  ? "Clients can see your name, avatar and bio"
                  : "Only you can see your profile details"}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setForm({ ...form, is_public: !form.is_public })}
              className={`relative w-12 h-6 rounded-full transition-colors duration-200 flex-shrink-0
                ${form.is_public ? "bg-emerald-500" : "bg-gray-300 dark:bg-gray-600"}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200
                ${form.is_public ? "translate-x-6" : "translate-x-0"}`} />
            </button>
          </div>

          <button
            onClick={handleSave}
            disabled={saving}
            className={`px-8 py-2.5 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-50
              ${isAdmin ? "bg-violet-600 hover:bg-violet-500" : "bg-blue-600 hover:bg-blue-500"}`}
          >
            {saving ? "Saving…" : "Save Profile"}
          </button>
        </div>

        {/* Account info */}
        <div className="bg-white dark:bg-gray-900/60 border border-gray-200 dark:border-gray-800 rounded-3xl p-6 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-4">Account Info</h2>
          <div className="space-y-3">
            <InfoRow label="Email" value={user?.email || "—"} />
            <InfoRow label="Role" value={isAdmin ? "Administrator" : "Client"} highlight={isAdmin} />
            <InfoRow label="User ID" value={user?.id || "—"} mono />
            <InfoRow label="Member Since" value={memberSince} />
            <InfoRow label="Last Sign In" value={user?.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleString() : "—"} />
          </div>
        </div>


      </div>

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-[110] flex items-center gap-3 px-5 py-3 rounded-xl shadow-2xl border text-sm font-semibold transition-all
          ${toast.ok
            ? "bg-emerald-50 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/30"
            : "bg-red-50 dark:bg-red-500/20 text-red-600 dark:text-red-300 border-red-200 dark:border-red-500/30"}`}>
          {toast.ok ? "✅" : "❌"} {toast.msg}
        </div>
      )}
    </div>
  );
}

function FormField({ label, value, onChange, placeholder = "", type = "text", isAdmin }: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; type?: string; isAdmin: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none transition-all
          ${isAdmin
            ? "focus:border-violet-500 focus:ring-1 focus:ring-violet-500/30"
            : "focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30"}`}
      />
    </div>
  );
}

function InfoRow({ label, value, mono = false, highlight = false }: {
  label: string; value: string; mono?: boolean; highlight?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-2 border-b border-gray-100 dark:border-gray-800 last:border-0">
      <span className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider flex-shrink-0 pt-0.5">{label}</span>
      <span className={`text-sm text-right break-all
        ${mono ? "font-mono text-xs text-gray-500 dark:text-gray-400" : ""}
        ${highlight ? "font-semibold text-violet-600 dark:text-violet-400" : "text-gray-700 dark:text-gray-300"}`}>
        {value}
      </span>
    </div>
  );
}
