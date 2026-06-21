"use client";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface Post {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  category: string;
  author: string;
  read_time: number;
  published: boolean;
  published_at: string | null;
  created_at: string;
}

const CATEGORIES = ["tips", "repair", "how-to", "tech-news", "maintenance", "product-reviews"];
const CAT_LABEL: Record<string, string> = {
  tips: "Tips & Tricks", repair: "Repair Guides", "how-to": "How-To",
  "tech-news": "Tech News", maintenance: "Maintenance", "product-reviews": "Product Reviews",
};

function toSlug(title: string) {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 80);
}

type Form = {
  title: string; slug: string; excerpt: string; content: string;
  category: string; author: string; read_time: string; published: boolean;
};

const emptyForm = (): Form => ({
  title: "", slug: "", excerpt: "", content: "",
  category: "tips", author: "Tech Ninja", read_time: "5", published: false,
});

export default function AdminBlogPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<Form>(emptyForm());
  const [editId, setEditId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [preview, setPreview] = useState(false);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok }); setTimeout(() => setToast(null), 3000);
  };

  const fetchPosts = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("blog_posts").select("*").order("created_at", { ascending: false });
    setPosts((data || []) as Post[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const user = data?.user;
      if (!user) { router.replace("/login"); return; }
      const role = user.user_metadata?.role || user.app_metadata?.role;
      if (role !== "admin") { router.replace("/"); return; }
      setChecking(false);
      fetchPosts();
    });
  }, [router, fetchPosts]);

  const setField = (f: keyof Form) => (v: string | boolean) =>
    setForm(p => ({ ...p, [f]: v }));

  const autoSlug = (title: string) => {
    if (!editId) setField("slug")(toSlug(title));
  };

  const handleSave = async () => {
    if (!form.title.trim() || !form.content.trim()) { showToast("Title and content are required", false); return; }
    setSaving(true);
    const slug = form.slug || toSlug(form.title);
    const payload = {
      title:      form.title.trim(),
      slug,
      excerpt:    form.excerpt.trim() || null,
      content:    form.content.trim(),
      category:   form.category,
      author:     form.author.trim() || "Tech Ninja",
      read_time:  parseInt(form.read_time) || 5,
      published:  form.published,
      published_at: form.published ? (editId ? undefined : new Date().toISOString()) : null,
    };

    if (editId) {
      const update: Record<string, unknown> = { ...payload };
      if (form.published && !posts.find(p => p.id === editId)?.published_at) {
        update.published_at = new Date().toISOString();
      }
      const { error } = await supabase.from("blog_posts").update(update).eq("id", editId);
      setSaving(false);
      if (error) { showToast("Save failed: " + error.message, false); return; }
      showToast("Post updated!");
    } else {
      const { error } = await supabase.from("blog_posts").insert(payload);
      setSaving(false);
      if (error) { showToast("Save failed: " + error.message, false); return; }
      showToast("Post created!");
    }
    setForm(emptyForm());
    setEditId(null);
    setPreview(false);
    fetchPosts();
  };

  const openEdit = (p: Post) => {
    setForm({
      title: p.title, slug: p.slug, excerpt: p.excerpt || "",
      content: p.content, category: p.category, author: p.author,
      read_time: String(p.read_time), published: p.published,
    });
    setEditId(p.id);
    setPreview(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    const { error } = await supabase.from("blog_posts").delete().eq("id", deleteId);
    setDeleting(false);
    setDeleteId(null);
    if (error) { showToast("Delete failed: " + error.message, false); return; }
    showToast("Post deleted");
    setPosts(prev => prev.filter(p => p.id !== deleteId));
  };

  const togglePublish = async (p: Post) => {
    const update = { published: !p.published, published_at: !p.published ? new Date().toISOString() : p.published_at };
    const { error } = await supabase.from("blog_posts").update(update).eq("id", p.id);
    if (error) { showToast("Failed: " + error.message, false); return; }
    setPosts(prev => prev.map(x => x.id === p.id ? { ...x, ...update } : x));
    showToast(!p.published ? "Published!" : "Unpublished");
  };

  const inputCls = "w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/30 transition-all";
  const labelCls = "block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5";

  if (checking) return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#030712] flex items-center justify-center">
      <div className="w-5 h-5 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#030712] text-gray-900 dark:text-gray-100 p-6 md:p-10">
      <div className="max-w-5xl mx-auto space-y-8">

        <div className="flex items-center justify-between">
          <div>
            <Link href="/admin" className="text-xs text-cyan-500 hover:text-cyan-400 font-semibold mb-1 inline-block">← Admin Panel</Link>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{editId ? "Edit Post" : "Blog Manager"}</h1>
          </div>
          <Link href="/blog" target="_blank"
            className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 font-semibold border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-1.5 transition-all">
            View blog →
          </Link>
        </div>

        {/* Form */}
        <div className="bg-white dark:bg-gray-900/60 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              {editId ? "Editing post" : "New post"}
            </h2>
            <div className="flex items-center gap-2">
              {form.content && (
                <button onClick={() => setPreview(p => !p)}
                  className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all ${preview ? "bg-cyan-50 dark:bg-cyan-500/10 border-cyan-300 dark:border-cyan-500/40 text-cyan-600 dark:text-cyan-400" : "bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400"}`}>
                  {preview ? "Hide Preview" : "Preview"}
                </button>
              )}
              <label className="flex items-center gap-2 cursor-pointer">
                <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">Published</span>
                <button
                  onClick={() => setField("published")(!form.published)}
                  className={`relative w-10 h-5 rounded-full transition-all ${form.published ? "bg-emerald-500" : "bg-gray-300 dark:bg-gray-600"}`}>
                  <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-all ${form.published ? "left-5" : "left-0.5"}`} />
                </button>
              </label>
            </div>
          </div>

          <div>
            <label className={labelCls}>Title *</label>
            <input value={form.title} onChange={e => { setField("title")(e.target.value); autoSlug(e.target.value); }}
              placeholder="e.g. How to extend your iPhone battery life"
              className={inputCls} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Slug *</label>
              <input value={form.slug} onChange={e => setField("slug")(e.target.value)}
                placeholder="auto-generated from title"
                className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Category</label>
              <select value={form.category} onChange={e => setField("category")(e.target.value)} className={inputCls}>
                {CATEGORIES.map(c => <option key={c} value={c}>{CAT_LABEL[c] || c}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Author</label>
              <input value={form.author} onChange={e => setField("author")(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Read time (min)</label>
              <input type="number" min="1" max="60" value={form.read_time} onChange={e => setField("read_time")(e.target.value)} className={inputCls} />
            </div>
          </div>

          <div>
            <label className={labelCls}>Excerpt</label>
            <textarea value={form.excerpt} onChange={e => setField("excerpt")(e.target.value)} rows={2}
              placeholder="One-sentence summary shown in the blog list…"
              className={`${inputCls} resize-none`} />
          </div>

          <div>
            <label className={labelCls}>Content *</label>
            <p className="text-[11px] text-gray-400 dark:text-gray-600 mb-1.5">Use **bold** for headings. Double newline = new paragraph.</p>
            <textarea value={form.content} onChange={e => setField("content")(e.target.value)} rows={16}
              placeholder="Write your article here…"
              className={`${inputCls} resize-y font-mono text-xs leading-relaxed`} />
          </div>

          {/* Preview */}
          {preview && form.content && (
            <div className="border border-gray-100 dark:border-gray-800 rounded-xl p-5 bg-gray-50 dark:bg-gray-800/30">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Content Preview</p>
              <div
                className="[&_p]:text-[15px] [&_p]:text-gray-700 dark:[&_p]:text-gray-300 [&_p]:leading-relaxed [&_p]:mb-4 [&_strong]:text-gray-900 dark:[&_strong]:text-white [&_strong]:font-semibold"
                dangerouslySetInnerHTML={{
                  __html: form.content.split(/\n\n+/).map(para =>
                    `<p>${para.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>").replace(/\n/g, "<br />")}</p>`
                  ).join("")
                }}
              />
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button onClick={handleSave} disabled={saving}
              className="px-6 py-2.5 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors">
              {saving ? "Saving…" : editId ? "Save Changes" : "Create Post"}
            </button>
            {editId && (
              <button onClick={() => { setForm(emptyForm()); setEditId(null); setPreview(false); }}
                className="px-6 py-2.5 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 text-sm font-semibold rounded-xl transition-colors border border-gray-200 dark:border-gray-700">
                Cancel
              </button>
            )}
          </div>
        </div>

        {/* Posts list */}
        <div className="bg-white dark:bg-gray-900/60 border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              All Posts ({posts.length})
            </h2>
            <span className="text-xs text-gray-400">{posts.filter(p => p.published).length} published</span>
          </div>
          {loading ? (
            <div className="p-8 text-center text-gray-400 dark:text-gray-500">Loading…</div>
          ) : posts.length === 0 ? (
            <div className="p-8 text-center text-gray-400 dark:text-gray-500">No posts yet. Create your first article above.</div>
          ) : (
            <div className="divide-y divide-gray-50 dark:divide-gray-800">
              {posts.map(p => (
                <div key={p.id} className="px-6 py-4 hover:bg-gray-50 dark:hover:bg-gray-800/20 transition-colors">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-md ${
                          p.published ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30"
                          : "bg-gray-100 dark:bg-gray-800 text-gray-400 border border-gray-200 dark:border-gray-700"
                        }`}>{p.published ? "Published" : "Draft"}</span>
                        <span className="text-[10px] text-gray-400 border border-gray-200 dark:border-gray-700 px-2 py-0.5 rounded-md capitalize">
                          {CAT_LABEL[p.category] || p.category}
                        </span>
                        <span className="text-[10px] text-gray-400">{p.read_time} min read</span>
                      </div>
                      <h3 className="font-semibold text-gray-900 dark:text-white text-sm mb-0.5">{p.title}</h3>
                      <p className="text-xs text-gray-400 dark:text-gray-500 font-mono">/blog/{p.slug}</p>
                      {p.excerpt && <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 line-clamp-1">{p.excerpt}</p>}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button onClick={() => togglePublish(p)}
                        className={`text-xs font-semibold px-2.5 py-1.5 rounded-lg border transition-all ${
                          p.published
                            ? "bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/30 text-amber-600 dark:text-amber-400 hover:bg-amber-100"
                            : "bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100"
                        }`}>
                        {p.published ? "Unpublish" : "Publish"}
                      </button>
                      <button onClick={() => openEdit(p)}
                        className="px-2.5 py-1.5 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 text-xs font-semibold rounded-lg transition-all">
                        Edit
                      </button>
                      <button onClick={() => setDeleteId(p.id)}
                        className="px-2.5 py-1.5 bg-red-50 dark:bg-red-500/10 hover:bg-red-100 dark:hover:bg-red-500/20 border border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-400 text-xs font-semibold rounded-lg transition-all">
                        Delete
                      </button>
                      {p.published && (
                        <Link href={`/blog/${p.slug}`} target="_blank"
                          className="px-2.5 py-1.5 text-xs font-semibold text-cyan-600 dark:text-cyan-400 hover:text-cyan-500 transition-colors">
                          View →
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Delete confirm */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 dark:bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl p-6 max-w-sm w-full shadow-2xl">
            <h3 className="font-bold text-gray-900 dark:text-white text-lg mb-2">Delete this post?</h3>
            <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">This will permanently remove the article.</p>
            <div className="flex gap-3">
              <button onClick={handleDelete} disabled={deleting}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors">
                {deleting ? "Deleting…" : "Delete"}
              </button>
              <button onClick={() => setDeleteId(null)}
                className="flex-1 py-2.5 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 text-sm font-semibold rounded-xl transition-colors border border-gray-200 dark:border-gray-700">
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
