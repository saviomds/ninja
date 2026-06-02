"use client";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import Link from "next/link";

// ─── Types ────────────────────────────────────────────────────────────────────

interface InventoryItem {
  id: string;
  name: string;
  description: string;
  image: string;
  price: number;
  stock: number;
  category: string;
  is_public: boolean;
  created_at: string;
}

type StockStatus = "in_stock" | "low" | "out";

function getStockStatus(stock: number): { status: StockStatus; label: string; color: string; bg: string } {
  if (stock === 0) return { status: "out", label: "Out of Stock", color: "text-rose-400", bg: "bg-rose-500/10 border-rose-500/30" };
  if (stock <= 5)  return { status: "low", label: "Low Stock",    color: "text-amber-400", bg: "bg-amber-500/10 border-amber-500/30" };
  return               { status: "in_stock", label: "In Stock",  color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/30" };
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function InventoryPage() {
  const router = useRouter();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [stockFilter, setStockFilter] = useState<StockStatus | "all">("all");
  const [sortBy, setSortBy] = useState<"name" | "price_asc" | "price_desc" | "stock_asc" | "stock_desc" | "newest">("newest");
  const [viewMode, setViewMode] = useState<"grid" | "table">("table");

  // Modals
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [adjustingId, setAdjustingId] = useState<string | null>(null);
  const [isAdjustOpen, setIsAdjustOpen] = useState(false);
  const [adjustAmount, setAdjustAmount] = useState("");
  const [adjustReason, setAdjustReason] = useState("");
  const [adjustItem, setAdjustItem] = useState<InventoryItem | null>(null);

  const [form, setForm] = useState({
    name: "", description: "", image: "", price: "", stock: "",
    category: "", is_public: true,
  });

  const showToast = (msg: string, type: "success" | "error") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchItems = useCallback(async () => {
    const { data, error } = await supabase.from("products").select("*").order("created_at", { ascending: false });
    if (!error && data) setItems(data as InventoryItem[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => { if (!user) router.push("/login"); });
    fetchItems();
  }, [fetchItems, router]);

  const categories = ["all", ...Array.from(new Set(items.map(i => i.category).filter(Boolean)))];

  const filtered = items
    .filter(i => {
      const q = searchQuery.toLowerCase();
      const matchQ = !q || i.name.toLowerCase().includes(q) || (i.description || "").toLowerCase().includes(q) || (i.category || "").toLowerCase().includes(q);
      const matchC = categoryFilter === "all" || i.category === categoryFilter;
      const matchS = stockFilter === "all" || getStockStatus(i.stock).status === stockFilter;
      return matchQ && matchC && matchS;
    })
    .sort((a, b) => {
      if (sortBy === "name") return a.name.localeCompare(b.name);
      if (sortBy === "price_asc") return a.price - b.price;
      if (sortBy === "price_desc") return b.price - a.price;
      if (sortBy === "stock_asc") return a.stock - b.stock;
      if (sortBy === "stock_desc") return b.stock - a.stock;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

  const stats = {
    total: items.length,
    inStock: items.filter(i => i.stock > 5).length,
    lowStock: items.filter(i => i.stock > 0 && i.stock <= 5).length,
    outOfStock: items.filter(i => i.stock === 0).length,
    totalValue: items.reduce((s, i) => s + i.price * i.stock, 0),
  };

  const handleSave = async () => {
    if (!form.name || !form.price) { showToast("Name and price are required", "error"); return; }
    setIsSaving(true);
    const payload = {
      name: form.name, description: form.description, image: form.image,
      price: parseFloat(form.price), stock: parseInt(form.stock) || 0,
      category: form.category || null, is_public: form.is_public,
    };
    if (editingId) {
      const { error } = await supabase.from("products").update(payload).eq("id", editingId);
      setIsSaving(false);
      if (error) { showToast("Save failed: " + error.message, "error"); return; }
      showToast("Item updated!", "success");
    } else {
      const { error } = await supabase.from("products").insert(payload);
      setIsSaving(false);
      if (error) { showToast("Save failed: " + error.message, "error"); return; }
      showToast("Item added!", "success");
    }
    setIsFormOpen(false);
    setEditingId(null);
    setForm({ name: "", description: "", image: "", price: "", stock: "", category: "", is_public: true });
    fetchItems();
  };

  const openEdit = (item: InventoryItem) => {
    setForm({
      name: item.name, description: item.description || "", image: item.image || "",
      price: item.price.toString(), stock: item.stock.toString(),
      category: item.category || "", is_public: item.is_public ?? true,
    });
    setEditingId(item.id);
    setIsFormOpen(true);
  };

  const handleStockAdjust = async () => {
    if (!adjustItem || !adjustAmount) { showToast("Enter adjustment amount", "error"); return; }
    const delta = parseInt(adjustAmount);
    if (isNaN(delta)) { showToast("Enter a valid number", "error"); return; }
    setAdjustingId(adjustItem.id);
    const newStock = Math.max(0, adjustItem.stock + delta);
    const { error } = await supabase.from("products").update({ stock: newStock }).eq("id", adjustItem.id);
    setAdjustingId(null);
    if (error) { showToast("Stock update failed", "error"); return; }
    showToast(`Stock adjusted by ${delta > 0 ? "+" : ""}${delta}`, "success");
    setIsAdjustOpen(false);
    setAdjustItem(null);
    setAdjustAmount("");
    setAdjustReason("");
    fetchItems();
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    setIsDeleting(true);
    await supabase.from("products").delete().eq("id", deleteId);
    setIsDeleting(false);
    setDeleteId(null);
    showToast("Item deleted", "success");
    fetchItems();
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
          <h1 className="font-bold text-white">Inventory Management</h1>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setViewMode(v => v === "grid" ? "table" : "grid")}
            className="px-3 py-1.5 text-xs bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg text-gray-300 transition-all">
            {viewMode === "grid" ? "Table View" : "Grid View"}
          </button>
          <button
            onClick={() => { setForm({ name: "", description: "", image: "", price: "", stock: "", category: "", is_public: true }); setEditingId(null); setIsFormOpen(true); }}
            className="px-4 py-1.5 text-xs bg-cyan-500 hover:bg-cyan-400 text-black font-bold rounded-lg transition-all"
          >
            + Add Item
          </button>
        </div>
      </div>

      <div className="max-w-screen-xl mx-auto px-4 md:px-6 py-6">

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          {[
            { label: "Total SKUs",     value: stats.total,                        color: "text-cyan-400",    bg: "bg-cyan-500/10 border-cyan-500/20" },
            { label: "In Stock",       value: stats.inStock,                      color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20" },
            { label: "Low Stock",      value: stats.lowStock,                     color: "text-amber-400",   bg: "bg-amber-500/10 border-amber-500/20" },
            { label: "Out of Stock",   value: stats.outOfStock,                   color: "text-rose-400",    bg: "bg-rose-500/10 border-rose-500/20" },
            { label: "Stock Value",    value: `Rs ${stats.totalValue.toLocaleString()}`, color: "text-purple-400", bg: "bg-purple-500/10 border-purple-500/20" },
          ].map(s => (
            <div key={s.label} className={`rounded-xl border p-4 ${s.bg}`}>
              <p className="text-xs text-gray-400 mb-1">{s.label}</p>
              <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2 mb-4">
          <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search items..."
            className="flex-1 min-w-[180px] bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500 transition-all" />
          <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500 transition-all">
            {categories.map(c => <option key={c} value={c}>{c === "all" ? "All Categories" : c}</option>)}
          </select>
          <select value={stockFilter} onChange={e => setStockFilter(e.target.value as StockStatus | "all")}
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500 transition-all">
            <option value="all">All Stock</option>
            <option value="in_stock">In Stock</option>
            <option value="low">Low Stock</option>
            <option value="out">Out of Stock</option>
          </select>
          <select value={sortBy} onChange={e => setSortBy(e.target.value as typeof sortBy)}
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500 transition-all">
            <option value="newest">Newest</option>
            <option value="name">Name A-Z</option>
            <option value="price_asc">Price ↑</option>
            <option value="price_desc">Price ↓</option>
            <option value="stock_asc">Stock ↑</option>
            <option value="stock_desc">Stock ↓</option>
          </select>
        </div>

        {/* Category pills */}
        {categories.length > 2 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {categories.map(c => (
              <button key={c} onClick={() => setCategoryFilter(c)}
                className={`px-3 py-1 text-xs rounded-full border font-medium transition-all ${
                  categoryFilter === c ? "bg-cyan-500/20 text-cyan-400 border-cyan-500/50" : "bg-gray-800 text-gray-400 border-gray-700 hover:border-gray-500"
                }`}>
                {c === "all" ? "All" : c}
              </button>
            ))}
          </div>
        )}

        {/* Table View */}
        {viewMode === "table" && (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800 bg-gray-900/80">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase">Item</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase">Category</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase">Price</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase">Stock</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase">Value</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase">Visibility</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr><td colSpan={8} className="px-4 py-12 text-center text-gray-500">No items found</td></tr>
                )}
                {filtered.map(item => {
                  const s = getStockStatus(item.stock);
                  return (
                    <tr key={item.id} className="border-b border-gray-800/50 hover:bg-gray-800/40 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          {item.image ? (
                            <img src={item.image} alt={item.name} className="w-10 h-10 rounded-lg object-cover bg-gray-800" />
                          ) : (
                            <div className="w-10 h-10 rounded-lg bg-gray-800 flex items-center justify-center text-gray-600 text-lg">📦</div>
                          )}
                          <div>
                            <p className="text-white font-medium">{item.name}</p>
                            {item.description && <p className="text-xs text-gray-500 truncate max-w-[200px]">{item.description}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {item.category ? (
                          <span className="text-xs bg-gray-800 text-gray-300 px-2 py-0.5 rounded-full">{item.category}</span>
                        ) : <span className="text-gray-600">—</span>}
                      </td>
                      <td className="px-4 py-3 font-semibold text-white">Rs {item.price.toLocaleString()}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <button onClick={() => { setAdjustItem(item); setAdjustAmount("-1"); setIsAdjustOpen(true); }}
                            disabled={adjustingId === item.id} className="w-6 h-6 rounded-md bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white text-sm flex items-center justify-center transition-all disabled:opacity-50">−</button>
                          <span className="text-white font-semibold w-8 text-center">{item.stock}</span>
                          <button onClick={() => { setAdjustItem(item); setAdjustAmount("+1"); setIsAdjustOpen(true); }}
                            disabled={adjustingId === item.id} className="w-6 h-6 rounded-md bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white text-sm flex items-center justify-center transition-all disabled:opacity-50">+</button>
                          <button onClick={() => { setAdjustItem(item); setAdjustAmount(""); setIsAdjustOpen(true); }}
                            className="text-xs text-cyan-500 hover:text-cyan-400 transition-colors ml-1">Adjust</button>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-400">
                        Rs {(item.price * item.stock).toLocaleString()}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${s.bg} ${s.color}`}>{s.label}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${item.is_public ? "text-emerald-400 bg-emerald-500/10" : "text-gray-500 bg-gray-800"}`}>
                          {item.is_public ? "Public" : "Hidden"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          <button onClick={() => openEdit(item)} className="text-xs text-indigo-400 hover:text-indigo-300 px-2 py-1 rounded transition-colors">Edit</button>
                          <button onClick={() => setDeleteId(item.id)} className="text-xs text-rose-400 hover:text-rose-300 px-2 py-1 rounded transition-colors">Del</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Grid View */}
        {viewMode === "grid" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.length === 0 && (
              <p className="col-span-full text-center text-gray-500 py-12">No items found</p>
            )}
            {filtered.map(item => {
              const s = getStockStatus(item.stock);
              return (
                <div key={item.id} className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden hover:border-gray-700 transition-all">
                  <div className="h-40 bg-gray-800 relative">
                    {item.image ? (
                      <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-4xl text-gray-700">📦</div>
                    )}
                    <div className="absolute top-2 right-2">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${s.bg} ${s.color}`}>{s.label}</span>
                    </div>
                  </div>
                  <div className="p-4">
                    <p className="font-semibold text-white truncate">{item.name}</p>
                    {item.category && <p className="text-xs text-gray-500 mt-0.5">{item.category}</p>}
                    <div className="flex justify-between items-baseline mt-2">
                      <span className="text-lg font-bold text-white">Rs {item.price.toLocaleString()}</span>
                      <span className="text-xs text-gray-400">qty: {item.stock}</span>
                    </div>
                    <div className="flex gap-2 mt-3">
                      <button onClick={() => { setAdjustItem(item); setAdjustAmount(""); setIsAdjustOpen(true); }}
                        className="flex-1 py-1.5 text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-700 rounded-lg transition-all">Stock</button>
                      <button onClick={() => openEdit(item)} className="flex-1 py-1.5 text-xs bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 rounded-lg transition-all">Edit</button>
                      <button onClick={() => setDeleteId(item.id)} className="py-1.5 px-2 text-xs bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-lg transition-all">✕</button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Add/Edit Modal ─────────────────────────────────────────────────────── */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm overflow-y-auto p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-lg shadow-2xl my-4">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
              <h2 className="font-bold text-lg text-white">{editingId ? "Edit Item" : "Add Inventory Item"}</h2>
              <button onClick={() => setIsFormOpen(false)} className="text-gray-500 hover:text-white text-xl transition-colors">✕</button>
            </div>
            <div className="px-6 py-5 space-y-3 max-h-[calc(100vh-220px)] overflow-y-auto">
              {[
                { label: "Name *",       key: "name" as const,        placeholder: "iPhone 15 Screen" },
                { label: "Category",     key: "category" as const,    placeholder: "Screens / Batteries / Accessories" },
                { label: "Description",  key: "description" as const, placeholder: "Part description..." },
                { label: "Image URL",    key: "image" as const,       placeholder: "https://..." },
              ].map(({ label, key, placeholder }) => (
                <div key={key}>
                  <label className="block text-xs text-gray-400 mb-1">{label}</label>
                  <input value={form[key]} onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))} placeholder={placeholder}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500 transition-all" />
                </div>
              ))}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Price (Rs) *</label>
                  <input type="number" value={form.price} onChange={e => setForm(p => ({ ...p, price: e.target.value }))} placeholder="0.00"
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500 transition-all" />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Stock Qty</label>
                  <input type="number" value={form.stock} onChange={e => setForm(p => ({ ...p, stock: e.target.value }))} placeholder="0"
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500 transition-all" />
                </div>
              </div>
              <div className="flex items-center gap-3 pt-1">
                <button onClick={() => setForm(p => ({ ...p, is_public: !p.is_public }))}
                  className={`relative w-10 h-5 rounded-full transition-all ${form.is_public ? "bg-cyan-500" : "bg-gray-700"}`}>
                  <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${form.is_public ? "left-5.5 translate-x-0.5" : "left-0.5"}`} />
                </button>
                <span className="text-sm text-gray-300">Visible to customers</span>
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-800">
              <button onClick={() => setIsFormOpen(false)} className="px-4 py-2 text-sm text-gray-400 border border-gray-700 rounded-lg hover:text-white transition-all">Cancel</button>
              <button onClick={handleSave} disabled={isSaving}
                className="px-5 py-2 text-sm bg-cyan-500 hover:bg-cyan-400 text-black font-bold rounded-lg transition-all disabled:opacity-50">
                {isSaving ? "Saving…" : editingId ? "Save Changes" : "Add Item"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Stock Adjust Modal ─────────────────────────────────────────────────── */}
      {isAdjustOpen && adjustItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-sm shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
              <div>
                <p className="text-xs text-gray-400">Stock Adjustment</p>
                <h2 className="font-bold text-white">{adjustItem.name}</h2>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-500">Current</p>
                <p className="text-2xl font-black text-white">{adjustItem.stock}</p>
              </div>
            </div>
            <div className="px-6 py-5 space-y-3">
              <p className="text-xs text-gray-400">Enter a positive number to add stock, negative to remove (e.g. +10 or -3)</p>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Adjustment Amount</label>
                <input type="number" value={adjustAmount} onChange={e => setAdjustAmount(e.target.value)} placeholder="+10 or -3"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500 transition-all" />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Reason (optional)</label>
                <input value={adjustReason} onChange={e => setAdjustReason(e.target.value)} placeholder="e.g. Restock from supplier"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500 transition-all" />
              </div>
              {adjustAmount && !isNaN(parseInt(adjustAmount)) && (
                <div className="bg-gray-800 rounded-xl p-3 text-sm">
                  New stock: <span className="font-bold text-white">{Math.max(0, adjustItem.stock + parseInt(adjustAmount))}</span>
                  <span className={`ml-2 font-semibold ${parseInt(adjustAmount) >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                    ({parseInt(adjustAmount) >= 0 ? "+" : ""}{adjustAmount})
                  </span>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-800">
              <button onClick={() => { setIsAdjustOpen(false); setAdjustItem(null); }} className="px-4 py-2 text-sm text-gray-400 border border-gray-700 rounded-lg hover:text-white transition-all">Cancel</button>
              <button onClick={handleStockAdjust}
                className="px-5 py-2 text-sm bg-cyan-500 hover:bg-cyan-400 text-black font-bold rounded-lg transition-all">
                Apply
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 max-w-sm w-full shadow-2xl">
            <p className="text-white font-semibold mb-2">Delete this item?</p>
            <p className="text-gray-400 text-sm mb-5">This action cannot be undone.</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setDeleteId(null)} className="px-4 py-2 text-sm text-gray-400 border border-gray-700 rounded-lg hover:text-white transition-all">Cancel</button>
              <button onClick={confirmDelete} disabled={isDeleting} className="px-4 py-2 text-sm bg-rose-500 hover:bg-rose-400 text-white font-bold rounded-lg transition-all disabled:opacity-50">
                {isDeleting ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
