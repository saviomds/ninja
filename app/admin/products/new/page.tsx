"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";

interface Product {
  id: string;
  name: string;
  description: string;
  image: string;
  price: number;
  stock: number;
  category: string;
  is_public: boolean;
}

const CATEGORIES = ["Smartphones", "Laptops", "Accessories", "Cables", "Audio", "Gaming", "Tablets", "Other"];

type ProductForm = { name: string; description: string; image: string; price: string; stock: string; category: string; is_public: boolean };
const emptyProduct = (): ProductForm => ({ name: "", description: "", image: "", price: "", stock: "", category: "", is_public: true });

export default function AdminProductsPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [form, setForm] = useState<ProductForm>(emptyProduct());
  const [editId, setEditId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

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
      fetchProducts();
    });
  }, [router]);

  const fetchProducts = async () => {
    setLoading(true);
    const { data } = await supabase.from("products").select("*").order("created_at", { ascending: false });
    setProducts(data || []);
    setLoading(false);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { showToast("Product name is required", false); return; }
    setSaving(true);
    const payload = {
      name: form.name.trim(),
      description: form.description.trim(),
      image: form.image.trim(),
      price: parseFloat(form.price) || 0,
      stock: parseInt(form.stock, 10) || 0,
      category: form.category,
      is_public: form.is_public,
    };
    const { error } = editId
      ? await supabase.from("products").update(payload).eq("id", editId)
      : await supabase.from("products").insert([payload]);
    setSaving(false);
    if (error) { showToast("Error: " + error.message, false); return; }
    showToast(editId ? "Product updated!" : "Product added!");
    setForm(emptyProduct());
    setEditId(null);
    fetchProducts();
  };

  const handleTogglePublic = async (p: Product) => {
    const next = !(p.is_public ?? true);
    setProducts((prev) => prev.map((x) => x.id === p.id ? { ...x, is_public: next } : x));
    const { error } = await supabase.from("products").update({ is_public: next }).eq("id", p.id);
    if (error) {
      showToast("Failed: " + error.message, false);
      setProducts((prev) => prev.map((x) => x.id === p.id ? { ...x, is_public: p.is_public } : x));
    } else {
      showToast(next ? "Product is now public" : "Product is now private");
    }
  };

  const handleEdit = (p: Product) => {
    setForm({ name: p.name, description: p.description || "", image: p.image || "", price: String(p.price), stock: String(p.stock), category: p.category || "", is_public: p.is_public ?? true });
    setEditId(p.id);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDelete = async (id: string) => {
    setDeleting(id);
    const { error } = await supabase.from("products").delete().eq("id", id);
    setDeleting(null);
    setConfirmDelete(null);
    if (error) { showToast("Delete failed: " + error.message, false); return; }
    showToast("Product deleted");
    setProducts((prev) => prev.filter((p) => p.id !== id));
  };

  const cancelEdit = () => { setForm(emptyProduct()); setEditId(null); };

  if (checking) {
    return (
      <div className="min-h-screen bg-[#030712] flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#030712] text-gray-100 p-6 md:p-10">
      <div className="max-w-5xl mx-auto space-y-8">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <Link href="/admin" className="text-xs text-cyan-500 hover:text-cyan-400 font-semibold mb-1 inline-block">← Admin Panel</Link>
            <h1 className="text-2xl font-bold text-white">{editId ? "Edit Product" : "Add Product"}</h1>
          </div>
        </div>

        {/* Form */}
        <div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-6 space-y-4">
          <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">{editId ? "Editing product" : "New product"}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Product Name *" value={form.name} onChange={(v) => setForm({ ...form, name: v })} placeholder="e.g. iPhone 15 Pro" />
            <Field label="Category" value={form.category} onChange={(v) => setForm({ ...form, category: v })} as="select" options={CATEGORIES} />
            <Field label="Price (Rs)" value={form.price} onChange={(v) => setForm({ ...form, price: v })} type="number" placeholder="0.00" />
            <Field label="Stock" value={form.stock} onChange={(v) => setForm({ ...form, stock: v })} type="number" placeholder="0" />
            <Field label="Image URL" value={form.image} onChange={(v) => setForm({ ...form, image: v })} placeholder="https://..." className="sm:col-span-2" />
            <Field label="Description" value={form.description} onChange={(v) => setForm({ ...form, description: v })} as="textarea" placeholder="Product description..." className="sm:col-span-2" />

            <div className={`sm:col-span-2 flex items-center justify-between gap-4 p-4 rounded-xl border transition-colors ${form.is_public ? "bg-emerald-500/5 border-emerald-500/20" : "bg-gray-800/50 border-gray-700"}`}>
              <div>
                <p className="text-sm font-semibold text-white">{form.is_public ? "Public" : "Private"}</p>
                <p className="text-xs text-gray-500">{form.is_public ? "Visible to all clients" : "Hidden from clients"}</p>
              </div>
              <button type="button" onClick={() => setForm({ ...form, is_public: !form.is_public })}
                className={`relative w-12 h-6 rounded-full transition-colors flex-shrink-0 ${form.is_public ? "bg-emerald-500" : "bg-gray-600"}`}>
                <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${form.is_public ? "translate-x-6" : "translate-x-0"}`} />
              </button>
            </div>
          </div>

          {form.image && (
            <div className="mt-2">
              <p className="text-xs text-gray-500 mb-1">Image Preview</p>
              <div className="w-24 h-24 rounded-xl overflow-hidden border border-gray-700 bg-gray-800">
                <Image src={form.image} alt="preview" width={96} height={96} unoptimized className="object-cover w-full h-full" onError={(e) => { (e.target as HTMLImageElement).src = ""; }} />
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button onClick={handleSave} disabled={saving}
              className="px-6 py-2.5 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors">
              {saving ? "Saving…" : editId ? "Update Product" : "Add Product"}
            </button>
            {editId && (
              <button onClick={cancelEdit} className="px-6 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm font-semibold rounded-xl transition-colors border border-gray-700">
                Cancel
              </button>
            )}
          </div>
        </div>

        {/* Product List */}
        <div className="bg-gray-900/60 border border-gray-800 rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">All Products ({products.length})</h2>
          </div>
          {loading ? (
            <div className="p-8 text-center text-gray-500">Loading products…</div>
          ) : products.length === 0 ? (
            <div className="p-8 text-center text-gray-500">No products yet. Add one above.</div>
          ) : (
            <div className="divide-y divide-gray-800">
              {products.map((p) => (
                <div key={p.id} className="flex items-center gap-4 px-6 py-4 hover:bg-gray-800/30 transition-colors">
                  <div className="w-12 h-12 rounded-xl bg-gray-800 border border-gray-700 flex-shrink-0 overflow-hidden">
                    {p.image ? (
                      <Image src={p.image} alt={p.name} width={48} height={48} unoptimized className="object-cover w-full h-full"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-600 text-xs">No img</div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-white text-sm truncate">{p.name}</p>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="text-xs text-cyan-400 font-semibold">Rs {p.price.toLocaleString()}</span>
                      {p.category && <span className="text-xs text-gray-500">{p.category}</span>}
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-md ${p.stock === 0 ? "bg-red-500/10 text-red-400" : p.stock <= 5 ? "bg-amber-500/10 text-amber-400" : "bg-emerald-500/10 text-emerald-400"}`}>
                        {p.stock === 0 ? "Out of stock" : `${p.stock} in stock`}
                      </span>
                      <button onClick={() => handleTogglePublic(p)}
                        className={`text-xs font-medium px-2 py-0.5 rounded-md border transition-colors ${(p.is_public ?? true) ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20" : "bg-gray-800 text-gray-500 border-gray-700 hover:border-gray-500 hover:text-gray-400"}`}>
                        {(p.is_public ?? true) ? "🌐 Public" : "🔒 Private"}
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => handleEdit(p)} className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 text-xs font-medium rounded-lg transition-colors">Edit</button>
                    <button onClick={() => setConfirmDelete(p.id)} className="px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 text-xs font-medium rounded-lg transition-colors">Delete</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Delete Confirm Modal */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 max-w-sm w-full">
            <h3 className="font-bold text-white text-lg mb-2">Delete product?</h3>
            <p className="text-gray-400 text-sm mb-6">This action cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={() => handleDelete(confirmDelete)} disabled={!!deleting}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors">
                {deleting ? "Deleting…" : "Delete"}
              </button>
              <button onClick={() => setConfirmDelete(null)} className="flex-1 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm font-semibold rounded-xl transition-colors border border-gray-700">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-[110] flex items-center gap-3 px-5 py-3 rounded-xl shadow-2xl border text-sm font-semibold transition-all
          ${toast.ok ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30" : "bg-red-500/20 text-red-300 border-red-500/30"}`}>
          {toast.ok ? "✅" : "❌"} {toast.msg}
        </div>
      )}
    </div>
  );
}

function Field({ label, value, onChange, type = "text", placeholder = "", className = "", as = "input", options = [] }: {
  label: string; value: string; onChange: (v: string) => void; type?: string;
  placeholder?: string; className?: string; as?: "input" | "textarea" | "select"; options?: string[];
}) {
  const base = "w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/30 transition-all";
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{label}</label>
      {as === "textarea" ? (
        <textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} rows={3} className={`${base} resize-none`} />
      ) : as === "select" ? (
        <select value={value} onChange={(e) => onChange(e.target.value)} className={base}>
          <option value="">Select category</option>
          {options.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      ) : (
        <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={base} />
      )}
    </div>
  );
}
