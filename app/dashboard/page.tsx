"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { User } from "@supabase/supabase-js";
import Image from "next/image";
import Link from "next/link";
import UpdateUsername from "./UpdateUsername";

// ─── Types ───────────────────────────────────────────────────────────────────

interface Product {
  id: string;
  name: string;
  description: string;
  image: string;
  price: number;
  stock: number;
  category?: string;
  created_at?: string;
}

interface Profile {
  id: string;
  username: string | null;
}

interface SocialProfile {
  id: string;
  platform_name: string;
  platform_icon: string;
  profile_link: string;
  username: string;
  email: string;
  password?: string;
  description?: string;
  is_active?: boolean;
  followers?: number;
}

interface AppUpdate {
  id: string;
  info: string;
  content: string;
  link: string;
  created_at?: string;
  priority?: "low" | "medium" | "high";
  type?: "feature" | "fix" | "announcement";
}

interface ActivityLog {
  id: string;
  action: string;
  target: string;
  timestamp: Date;
  type: "create" | "update" | "delete" | "info";
}

// ─── Constants ────────────────────────────────────────────────────────────────

const ITEMS_PER_PAGE = 6;

const priorityColors: Record<string, string> = {
  high: "text-rose-400 bg-rose-500/10 border-rose-500/30",
  medium: "text-amber-400 bg-amber-500/10 border-amber-500/30",
  low: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30",
};

const updateTypeIcons: Record<string, string> = {
  feature: "✨",
  fix: "🔧",
  announcement: "📣",
};

const logTypeColors: Record<string, string> = {
  create: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
  update: "text-indigo-400 bg-indigo-500/10 border-indigo-500/20",
  delete: "text-rose-400 bg-rose-500/10 border-rose-500/20",
  info: "text-gray-400 bg-gray-500/10 border-gray-500/20",
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const router = useRouter();

  // Auth
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);

  // Data
  const [products, setProducts] = useState<Product[]>([]);
  const [socialProfiles, setSocialProfiles] = useState<SocialProfile[]>([]);
  const [updates, setUpdates] = useState<AppUpdate[]>([]);
  const [activityLog, setActivityLog] = useState<ActivityLog[]>([]);

  // UI state
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [activeSection, setActiveSection] = useState<"products" | "social" | "updates" | "settings" | "log">("products");

  // Products
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [productToDelete, setProductToDelete] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [expandedDesc, setExpandedDesc] = useState<Record<string, boolean>>({});
  const [sortBy, setSortBy] = useState<"newest" | "price_asc" | "price_desc" | "stock_asc" | "stock_desc">("newest");
  const [stockFilter, setStockFilter] = useState<"all" | "in_stock" | "low" | "out">("all");
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [showBulkConfirm, setShowBulkConfirm] = useState(false);
  const [adjustingStockId, setAdjustingStockId] = useState<string | null>(null);
  const [newProduct, setNewProduct] = useState({
    name: "", image: "", description: "", price: "", stock: "", category: "",
  });

  // Social
  const [isSocialModalOpen, setIsSocialModalOpen] = useState(false);
  const [isSavingSocial, setIsSavingSocial] = useState(false);
  const [editingSocialId, setEditingSocialId] = useState<string | null>(null);
  const [socialToDelete, setSocialToDelete] = useState<string | null>(null);
  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({});
  const [newSocial, setNewSocial] = useState({
    platform_name: "", platform_icon: "", profile_link: "",
    username: "", email: "", password: "", description: "", is_active: true, followers: "",
  });

  // Updates
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);
  const [isSavingUpdate, setIsSavingUpdate] = useState(false);
  const [editingUpdateId, setEditingUpdateId] = useState<string | null>(null);
  const [updateToDelete, setUpdateToDelete] = useState<string | null>(null);
  const [newUpdate, setNewUpdate] = useState({
    info: "", content: "", link: "",
    priority: "low" as "low" | "medium" | "high",
    type: "announcement" as "feature" | "fix" | "announcement",
  });

  // ─── Helpers ───────────────────────────────────────────────────────────────

  const logActivity = useCallback((action: string, target: string, type: ActivityLog["type"]) => {
    setActivityLog(prev => [{
      id: Math.random().toString(36).slice(2),
      action, target, type,
      timestamp: new Date(),
    }, ...prev].slice(0, 50));
  }, []);

  const showToast = useCallback((message: string, type: "success" | "error") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  }, []);

  // ─── Fetch helpers ─────────────────────────────────────────────────────────

  const fetchProducts = useCallback(async () => {
    const { data } = await supabase.from("products").select("*").order("created_at", { ascending: false });
    setProducts(data || []);
  }, []);

  const fetchSocialProfiles = useCallback(async () => {
    const { data } = await supabase.from("social_profiles").select("*").order("created_at", { ascending: false });
    setSocialProfiles(data || []);
  }, []);

  const fetchUpdates = useCallback(async () => {
    const { data } = await supabase.from("updates").select("*").order("created_at", { ascending: false });
    setUpdates(data || []);
  }, []);

  const fetchUserProfile = useCallback(async (uid: string) => {
    const { data, error } = await supabase.from("profiles").select("id, username").eq("id", uid).single();
    if (!error) setProfile(data);
  }, []);

  const loadAllData = useCallback(async (showRefreshToast = false) => {
    if (!user) return;
    showRefreshToast ? setIsRefreshing(true) : setLoading(true);
    await Promise.all([fetchProducts(), fetchSocialProfiles(), fetchUpdates(), fetchUserProfile(user.id)]);
    showRefreshToast ? setIsRefreshing(false) : setLoading(false);
    if (showRefreshToast) {
      showToast("Dashboard refreshed!", "success");
      logActivity("Refreshed dashboard data", "All sections", "info");
    }
  }, [user, fetchProducts, fetchSocialProfiles, fetchUpdates, fetchUserProfile, showToast, logActivity]);

  // ─── Auth ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { router.push("/login"); return; }
      setUser(data.user);
    });
  }, [router]);

  useEffect(() => {
    if (user) loadAllData();
  }, [user]); // eslint-disable-line

  // Keyboard shortcut: R to refresh
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "r" && !e.ctrlKey && !e.metaKey && !(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLTextAreaElement)) {
        loadAllData(true);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [loadAllData]);

  // ─── Products ──────────────────────────────────────────────────────────────

  useEffect(() => { setCurrentPage(1); }, [searchQuery, sortBy, stockFilter]);

  const filteredProducts = products
    .filter(p => {
      const q = searchQuery.toLowerCase();
      const matchSearch = p.name.toLowerCase().includes(q) || (p.description || "").toLowerCase().includes(q) || (p.category || "").toLowerCase().includes(q);
      const matchStock =
        stockFilter === "all" ? true :
        stockFilter === "in_stock" ? p.stock > 5 :
        stockFilter === "low" ? p.stock > 0 && p.stock <= 5 :
        p.stock === 0;
      return matchSearch && matchStock;
    })
    .sort((a, b) => {
      if (sortBy === "price_asc") return a.price - b.price;
      if (sortBy === "price_desc") return b.price - a.price;
      if (sortBy === "stock_asc") return a.stock - b.stock;
      if (sortBy === "stock_desc") return b.stock - a.stock;
      return 0;
    });

  const totalPages = Math.ceil(filteredProducts.length / ITEMS_PER_PAGE);
  const paginatedProducts = filteredProducts.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  const outOfStockCount = products.filter(p => p.stock === 0).length;
  const lowStockCount = products.filter(p => p.stock > 0 && p.stock <= 5).length;
  const inventoryValue = products.reduce((acc, p) => acc + p.price * p.stock, 0);

  const handleSaveProduct = async () => {
    if (!newProduct.name.trim()) { showToast("Product name is required", "error"); return; }
    setIsSaving(true);
    const productData = {
      name: newProduct.name,
      image: newProduct.image,
      description: newProduct.description,
      price: parseFloat(newProduct.price) || 0,
      stock: parseInt(newProduct.stock, 10) || 0,
      category: newProduct.category,
    };
    let error;
    if (editingProductId) {
      ({ error } = await supabase.from("products").update(productData).eq("id", editingProductId));
    } else {
      ({ error } = await supabase.from("products").insert([productData]));
    }
    setIsSaving(false);
    if (error) { showToast("Error: " + error.message, "error"); return; }
    setIsModalOpen(false);
    setNewProduct({ name: "", image: "", description: "", price: "", stock: "", category: "" });
    setEditingProductId(null);
    showToast(editingProductId ? "Product updated!" : "Product added!", "success");
    logActivity(editingProductId ? "Updated product" : "Added product", newProduct.name, editingProductId ? "update" : "create");
    fetchProducts();
  };

  const handleEditClick = (product: Product) => {
    setNewProduct({ name: product.name, image: product.image || "", description: product.description || "", price: product.price.toString(), stock: product.stock.toString(), category: product.category || "" });
    setEditingProductId(product.id);
    setIsModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!productToDelete) return;
    setIsDeleting(true);
    const prod = products.find(p => p.id === productToDelete);
    const { error } = await supabase.from("products").delete().eq("id", productToDelete);
    setIsDeleting(false);
    setProductToDelete(null);
    if (error) { showToast("Error: " + error.message, "error"); return; }
    showToast("Product deleted!", "success");
    logActivity("Deleted product", prod?.name || "Unknown", "delete");
    fetchProducts();
  };

  const handleBulkDelete = async () => {
    if (!selectedProducts.size) return;
    setIsBulkDeleting(true);
    const ids = Array.from(selectedProducts);
    const { error } = await supabase.from("products").delete().in("id", ids);
    setIsBulkDeleting(false);
    setShowBulkConfirm(false);
    setSelectedProducts(new Set());
    if (error) { showToast("Bulk delete failed: " + error.message, "error"); return; }
    showToast(`Deleted ${ids.length} products`, "success");
    logActivity(`Bulk deleted ${ids.length} products`, "Multiple products", "delete");
    fetchProducts();
  };

  const toggleSelectProduct = (id: string) => {
    setSelectedProducts(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedProducts.size === paginatedProducts.length) {
      setSelectedProducts(new Set());
    } else {
      setSelectedProducts(new Set(paginatedProducts.map(p => p.id)));
    }
  };

  const handleStockAdjust = async (product: Product, delta: number) => {
    const newStock = Math.max(0, product.stock + delta);
    setAdjustingStockId(product.id);
    const { error } = await supabase.from("products").update({ stock: newStock }).eq("id", product.id);
    setAdjustingStockId(null);
    if (error) { showToast("Stock update failed", "error"); return; }
    logActivity(`Adjusted stock ${delta > 0 ? "+" : ""}${delta}`, product.name, "update");
    fetchProducts();
  };

  const handleDownloadExcel = () => {
    if (!products.length) { showToast("No products to export", "error"); return; }
    const esc = (s: string) => (s || "").toString().replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head><meta charset="utf-8"/><style>table{border-collapse:collapse}th{background:#4F46E5;color:#fff;border:1px solid #d1d5db;padding:10px}td{border:1px solid #d1d5db;padding:8px}</style></head>
      <body><h2>Product Inventory</h2><table>
        <thead><tr><th>ID</th><th>Name</th><th>Category</th><th>Price (Rs)</th><th>Stock</th><th>Description</th></tr></thead>
        <tbody>${products.map(p => `<tr><td>${esc(p.id)}</td><td>${esc(p.name)}</td><td>${esc(p.category || "")}</td><td>${p.price}</td><td>${p.stock}</td><td>${esc(p.description)}</td></tr>`).join("")}</tbody>
      </table></body></html>`;
    const blob = new Blob([html], { type: "application/vnd.ms-excel" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "Products_Inventory.xls";
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    showToast("Exported as Excel!", "success");
    logActivity("Exported product inventory", `${products.length} products`, "info");
  };

  // ─── Social ────────────────────────────────────────────────────────────────

  const handleSaveSocial = async () => {
    if (!newSocial.platform_name || !newSocial.profile_link) { showToast("Platform name and link required", "error"); return; }
    setIsSavingSocial(true);
    const socialData = { ...newSocial, followers: newSocial.followers ? parseInt(newSocial.followers) : null };
    let error;
    if (editingSocialId) {
      ({ error } = await supabase.from("social_profiles").update(socialData).eq("id", editingSocialId));
    } else {
      ({ error } = await supabase.from("social_profiles").insert([socialData]));
    }
    setIsSavingSocial(false);
    if (error) { showToast("Error: " + error.message, "error"); return; }
    setIsSocialModalOpen(false);
    setNewSocial({ platform_name: "", platform_icon: "", profile_link: "", username: "", email: "", password: "", description: "", is_active: true, followers: "" });
    setEditingSocialId(null);
    showToast(editingSocialId ? "Profile updated!" : "Profile added!", "success");
    logActivity(editingSocialId ? "Updated social profile" : "Added social profile", newSocial.platform_name, editingSocialId ? "update" : "create");
    fetchSocialProfiles();
  };

  const handleEditSocial = (p: SocialProfile) => {
    setNewSocial({ platform_name: p.platform_name || "", platform_icon: p.platform_icon || "", profile_link: p.profile_link || "", username: p.username || "", email: p.email || "", password: p.password || "", description: p.description || "", is_active: p.is_active ?? true, followers: p.followers?.toString() || "" });
    setEditingSocialId(p.id);
    setIsSocialModalOpen(true);
  };

  const confirmDeleteSocial = async () => {
    if (!socialToDelete) return;
    setIsDeleting(true);
    const prof = socialProfiles.find(p => p.id === socialToDelete);
    const { error } = await supabase.from("social_profiles").delete().eq("id", socialToDelete);
    setIsDeleting(false);
    setSocialToDelete(null);
    if (error) { showToast("Error: " + error.message, "error"); return; }
    showToast("Profile deleted!", "success");
    logActivity("Deleted social profile", prof?.platform_name || "Unknown", "delete");
    fetchSocialProfiles();
  };

  const handleToggleActive = async (p: SocialProfile) => {
    const { error } = await supabase.from("social_profiles").update({ is_active: !p.is_active }).eq("id", p.id);
    if (error) { showToast("Toggle failed", "error"); return; }
    logActivity(`Marked ${p.platform_name} as ${!p.is_active ? "active" : "inactive"}`, p.platform_name, "update");
    fetchSocialProfiles();
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    showToast(`${label} copied!`, "success");
  };

  // ─── Updates ───────────────────────────────────────────────────────────────

  const handleSaveUpdate = async () => {
    if (!newUpdate.info || !newUpdate.content) { showToast("Title and content required", "error"); return; }
    setIsSavingUpdate(true);
    let error;
    if (editingUpdateId) {
      ({ error } = await supabase.from("updates").update(newUpdate).eq("id", editingUpdateId));
    } else {
      ({ error } = await supabase.from("updates").insert([newUpdate]));
    }
    setIsSavingUpdate(false);
    if (error) { showToast("Error: " + error.message, "error"); return; }
    setIsUpdateModalOpen(false);
    setNewUpdate({ info: "", content: "", link: "", priority: "low", type: "announcement" });
    setEditingUpdateId(null);
    showToast(editingUpdateId ? "Update saved!" : "Update posted!", "success");
    logActivity(editingUpdateId ? "Edited update" : "Posted update", newUpdate.info, editingUpdateId ? "update" : "create");
    fetchUpdates();
  };

  const handleEditUpdate = (u: AppUpdate) => {
    setNewUpdate({ info: u.info || "", content: u.content || "", link: u.link || "", priority: u.priority || "low", type: u.type || "announcement" });
    setEditingUpdateId(u.id);
    setIsUpdateModalOpen(true);
  };

  const confirmDeleteUpdate = async () => {
    if (!updateToDelete) return;
    setIsDeleting(true);
    const upd = updates.find(u => u.id === updateToDelete);
    const { error } = await supabase.from("updates").delete().eq("id", updateToDelete);
    setIsDeleting(false);
    setUpdateToDelete(null);
    if (error) { showToast("Error: " + error.message, "error"); return; }
    showToast("Update deleted!", "success");
    logActivity("Deleted update", upd?.info || "Unknown", "delete");
    fetchUpdates();
  };

  const confirmLogout = async () => {
    setIsLoggingOut(true);
    await supabase.auth.signOut();
    router.push("/login");
  };

  // ─── Nav sections ─────────────────────────────────────────────────────────

  const navSections = [
    { key: "products", label: "Products", count: products.length, icon: "📦" },
    { key: "social", label: "Social", count: socialProfiles.length, icon: "🔗" },
    { key: "updates", label: "Updates", count: updates.length, icon: "📣" },
    { key: "settings", label: "Settings", count: null, icon: "⚙️" },
    { key: "log", label: "Activity", count: activityLog.length || null, icon: "🕐" },
  ] as const;

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-950 text-white">

      {/* ── Top Bar ──────────────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-30 bg-gray-900/95 backdrop-blur-md border-b border-gray-800 px-4 md:px-6 py-3 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <Link href="/" className="font-bold text-lg text-white hover:text-gray-300 transition-colors">
            ← Home
          </Link>
          <span className="hidden md:block text-gray-700">|</span>
          <span className="hidden md:block text-sm text-gray-500 font-mono">{user?.email}</span>
        </div>

        <div className="hidden md:flex items-center gap-3">
          {/* Stats pills */}
          {outOfStockCount > 0 && (
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20">
              {outOfStockCount} out of stock
            </span>
          )}
          {lowStockCount > 0 && (
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 animate-pulse">
              {lowStockCount} low stock
            </span>
          )}
          <button
            onClick={() => loadAllData(true)}
            disabled={isRefreshing}
            title="Press R to refresh"
            className="flex items-center gap-2 text-sm bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded-lg border border-gray-700 transition-all disabled:opacity-50"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className={`w-4 h-4 ${isRefreshing ? "animate-spin" : ""}`}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0011.664 0M2.985 19.644A8.25 8.25 0 013 12a8.25 8.25 0 0115.023-5.455" />
            </svg>
            {isRefreshing ? "Refreshing…" : "Refresh"}
            <kbd className="hidden lg:inline-flex text-[10px] bg-gray-700 px-1.5 py-0.5 rounded border border-gray-600 font-mono text-gray-400">R</kbd>
          </button>
          <button onClick={() => setIsLogoutModalOpen(true)} className="text-sm bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded-lg border border-gray-700 transition-all">
            Logout
          </button>
        </div>

        {/* Mobile hamburger */}
        <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="md:hidden text-gray-400 hover:text-white p-1">
          {isMobileMenuOpen ? (
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" /></svg>
          )}
        </button>

        {isMobileMenuOpen && (
          <div className="absolute top-full left-0 w-full bg-gray-900 border-b border-gray-800 p-4 flex flex-col gap-3 md:hidden shadow-2xl z-40">
            <p className="text-sm text-gray-400 break-all">{user?.email}</p>
            <button onClick={() => { loadAllData(true); setIsMobileMenuOpen(false); }} disabled={isRefreshing} className="flex items-center gap-2 text-sm bg-gray-800 text-white px-4 py-2 rounded-lg border border-gray-700 w-full disabled:opacity-50">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className={`w-4 h-4 ${isRefreshing ? "animate-spin" : ""}`}><path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0011.664 0M2.985 19.644A8.25 8.25 0 013 12a8.25 8.25 0 0115.023-5.455" /></svg>
              {isRefreshing ? "Refreshing…" : "Refresh"}
            </button>
            <button onClick={() => { setIsLogoutModalOpen(true); setIsMobileMenuOpen(false); }} className="text-sm bg-gray-800 text-white px-4 py-2 rounded-lg border border-gray-700 w-full text-left">Logout</button>
          </div>
        )}
      </div>

      {/* ── Dashboard Stats Banner ────────────────────────────────────────────── */}
      {!loading && (
        <div className="bg-gray-900/40 border-b border-gray-800/60 px-4 md:px-8 py-3">
          <div className="max-w-5xl mx-auto flex flex-wrap gap-4 md:gap-8 items-center text-sm">
            <div className="flex items-center gap-2">
              <span className="text-gray-500">Products</span>
              <span className="font-bold text-white">{products.length}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-gray-500">Inventory Value</span>
              <span className="font-bold text-emerald-400">Rs {inventoryValue.toLocaleString()}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-gray-500">Out of Stock</span>
              <span className={`font-bold ${outOfStockCount > 0 ? "text-rose-400" : "text-gray-400"}`}>{outOfStockCount}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-gray-500">Low Stock</span>
              <span className={`font-bold ${lowStockCount > 0 ? "text-amber-400" : "text-gray-400"}`}>{lowStockCount}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-gray-500">Social Profiles</span>
              <span className="font-bold text-indigo-400">{socialProfiles.length}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-gray-500">Updates</span>
              <span className="font-bold text-violet-400">{updates.length}</span>
            </div>
          </div>
        </div>
      )}

      {/* ── Section Nav Tabs ──────────────────────────────────────────────────── */}
      <div className="sticky top-[57px] z-20 bg-gray-950/95 backdrop-blur-md border-b border-gray-800 px-4 md:px-8">
        <div className="max-w-5xl mx-auto flex gap-1 overflow-x-auto">
          {navSections.map(s => (
            <button
              key={s.key}
              onClick={() => setActiveSection(s.key)}
              className={`flex items-center gap-1.5 px-4 py-3.5 text-sm font-medium whitespace-nowrap border-b-2 transition-all ${
                activeSection === s.key
                  ? "border-white text-white"
                  : "border-transparent text-gray-500 hover:text-gray-300"
              }`}
            >
              <span>{s.icon}</span>
              {s.label}
              {s.count != null && s.count > 0 && (
                <span className={`text-xs px-1.5 py-0.5 rounded-full ${activeSection === s.key ? "bg-white/15 text-white" : "bg-gray-800 text-gray-400"}`}>
                  {s.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── Main Content ──────────────────────────────────────────────────────── */}
      <div className="max-w-5xl mx-auto p-4 md:p-6 pb-20">

        {/* ══ PRODUCTS TAB ═══════════════════════════════════════════════════════ */}
        {activeSection === "products" && (
          <div>
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4 pt-2">
              <div>
                <h2 className="text-2xl font-bold text-white">Products</h2>
                <p className="text-gray-500 text-sm mt-0.5">{filteredProducts.length} of {products.length} shown</p>
              </div>
              <div className="flex flex-wrap gap-2 w-full md:w-auto">
                <button onClick={handleDownloadExcel} className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 text-white px-4 py-2.5 rounded-xl text-sm font-medium border border-gray-700 transition-all">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 text-emerald-400">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m.75 12l3 3m0 0l3-3m-3 3v-6m-1.5-9H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                  </svg>
                  Export
                </button>
                {selectedProducts.size > 0 && (
                  <button onClick={() => setShowBulkConfirm(true)} className="flex items-center gap-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 px-4 py-2.5 rounded-xl text-sm font-medium border border-rose-500/20 transition-all">
                    🗑 Delete {selectedProducts.size} selected
                  </button>
                )}
                <button onClick={() => { setNewProduct({ name: "", image: "", description: "", price: "", stock: "", category: "" }); setEditingProductId(null); setIsModalOpen(true); }} className="flex items-center gap-2 bg-white text-black px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-gray-200 transition-all shadow-[0_0_15px_rgba(255,255,255,0.1)]">
                  + New Product
                </button>
              </div>
            </div>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-3 mb-6">
              <div className="relative flex-1">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                <input type="text" placeholder="Search by name, description, category…" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="w-full bg-gray-900 border border-gray-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-gray-600 transition-colors" />
              </div>
              <div className="flex gap-2 flex-wrap">
                {(["all", "in_stock", "low", "out"] as const).map(f => (
                  <button key={f} onClick={() => setStockFilter(f)} className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-all whitespace-nowrap ${stockFilter === f ? "bg-indigo-500/15 text-indigo-300 border-indigo-500/30" : "bg-gray-900 text-gray-500 border-gray-800 hover:border-gray-600"}`}>
                    {f === "all" ? "All" : f === "in_stock" ? "✅ In Stock" : f === "low" ? "⚠️ Low" : "❌ Out"}
                  </button>
                ))}
              </div>
              <select value={sortBy} onChange={e => setSortBy(e.target.value as typeof sortBy)} className="bg-gray-900 border border-gray-800 rounded-xl px-3 py-2.5 text-xs text-gray-400 focus:outline-none focus:border-gray-600 cursor-pointer">
                <option value="newest">Newest</option>
                <option value="price_asc">Price ↑</option>
                <option value="price_desc">Price ↓</option>
                <option value="stock_asc">Stock ↑</option>
                <option value="stock_desc">Stock ↓</option>
              </select>
            </div>

            {/* Bulk select bar */}
            {filteredProducts.length > 0 && (
              <div className="flex items-center gap-3 mb-4 px-1">
                <input type="checkbox" checked={selectedProducts.size > 0 && selectedProducts.size === paginatedProducts.length} onChange={toggleSelectAll} className="w-4 h-4 rounded accent-white cursor-pointer" />
                <span className="text-xs text-gray-500">
                  {selectedProducts.size > 0 ? `${selectedProducts.size} selected` : "Select all on page"}
                </span>
              </div>
            )}

            {/* Grid */}
            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[1, 2, 3].map(n => <div key={n} className="h-80 bg-gray-900/50 rounded-2xl animate-pulse border border-gray-800" />)}
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="text-center py-20 bg-gray-900/50 rounded-2xl border border-gray-800">
                <p className="text-4xl mb-3">🔍</p>
                <p className="text-gray-400">No products found.</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {paginatedProducts.map(product => (
                    <div key={product.id} className={`group bg-gray-900/40 backdrop-blur-md border rounded-2xl overflow-hidden transition-all duration-300 hover:shadow-2xl hover:shadow-black/50 flex flex-col ${selectedProducts.has(product.id) ? "border-indigo-500/50 ring-1 ring-indigo-500/30" : "border-gray-800 hover:border-gray-700"}`}>
                      {/* Checkbox + image */}
                      <div className="aspect-[4/3] w-full bg-gray-800 relative overflow-hidden">
                        <div className="absolute top-3 left-3 z-10">
                          <input type="checkbox" checked={selectedProducts.has(product.id)} onChange={() => toggleSelectProduct(product.id)} className="w-4 h-4 rounded accent-indigo-500 cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()} />
                        </div>
                        {product.image ? (
                          <Image src={product.image} alt={product.name} fill unoptimized className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-500" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-600 text-sm">No Image</div>
                        )}
                        {product.stock === 0 && (
                          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                            <span className="bg-rose-600/90 text-white text-xs font-bold px-3 py-1.5 rounded-full uppercase tracking-wider">Out of Stock</span>
                          </div>
                        )}
                        <div className="absolute top-3 right-3 bg-black/70 backdrop-blur-md text-white px-3 py-1 rounded-full text-sm font-bold border border-gray-700">
                          Rs {product.price.toLocaleString()}
                        </div>
                      </div>

                      <div className="p-5 flex flex-col flex-1">
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <h3 className="text-base font-bold text-white line-clamp-1">{product.name}</h3>
                          {product.category && (
                            <span className="text-[10px] shrink-0 font-semibold bg-indigo-500/10 text-indigo-400 px-2 py-0.5 rounded border border-indigo-500/20">{product.category}</span>
                          )}
                        </div>

                        <div className="mb-3 flex-1">
                          <p className={`text-sm text-gray-400 ${expandedDesc[product.id] ? "" : "line-clamp-2"}`}>
                            {product.description || "No description."}
                          </p>
                          {(product.description?.length || 0) > 80 && (
                            <button onClick={() => setExpandedDesc(prev => ({ ...prev, [product.id]: !prev[product.id] }))} className="text-xs text-indigo-400 hover:text-indigo-300 mt-1 transition-colors">
                              {expandedDesc[product.id] ? "Show less" : "Read more"}
                            </button>
                          )}
                        </div>

                        {/* Stock quick-edit */}
                        <div className="flex items-center gap-2 mb-4">
                          <button onClick={() => handleStockAdjust(product, -1)} disabled={product.stock === 0 || adjustingStockId === product.id} className="w-7 h-7 rounded-lg bg-gray-800 border border-gray-700 text-white flex items-center justify-center text-lg hover:bg-gray-700 disabled:opacity-30 transition-all">−</button>
                          <span className={`text-sm font-semibold min-w-[60px] text-center px-2 py-1 rounded-lg border ${product.stock === 0 ? "text-rose-400 bg-rose-500/10 border-rose-500/20" : product.stock <= 5 ? "text-amber-400 bg-amber-500/10 border-amber-500/20" : "text-emerald-400 bg-emerald-500/10 border-emerald-500/20"}`}>
                            {adjustingStockId === product.id ? "…" : `${product.stock} left`}
                          </span>
                          <button onClick={() => handleStockAdjust(product, 1)} disabled={adjustingStockId === product.id} className="w-7 h-7 rounded-lg bg-gray-800 border border-gray-700 text-white flex items-center justify-center text-lg hover:bg-gray-700 disabled:opacity-30 transition-all">+</button>
                        </div>

                        <div className="flex gap-2 pt-4 border-t border-gray-800/60">
                          <button onClick={() => handleEditClick(product)} className="flex-1 bg-gray-800/80 hover:bg-gray-700 text-white py-2 rounded-xl text-sm font-medium transition-all border border-gray-700/50">Edit</button>
                          <button onClick={() => setProductToDelete(product.id)} className="flex-1 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 py-2 rounded-xl text-sm font-medium transition-all border border-rose-500/10">Delete</button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex justify-center items-center mt-10 gap-2 flex-wrap">
                    <button disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)} className="px-4 py-2 rounded-xl border border-gray-800 text-sm text-gray-400 hover:bg-gray-800 disabled:opacity-40 transition-all">Prev</button>
                    <div className="flex gap-1">
                      {Array.from({ length: totalPages }).map((_, i) => (
                        <button key={i} onClick={() => setCurrentPage(i + 1)} className={`w-9 h-9 rounded-xl text-sm font-semibold transition-all ${currentPage === i + 1 ? "bg-white text-black" : "text-gray-400 hover:bg-gray-800 border border-transparent hover:border-gray-700"}`}>
                          {i + 1}
                        </button>
                      ))}
                    </div>
                    <button disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)} className="px-4 py-2 rounded-xl border border-gray-800 text-sm text-gray-400 hover:bg-gray-800 disabled:opacity-40 transition-all">Next</button>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ══ SOCIAL TAB ══════════════════════════════════════════════════════════ */}
        {activeSection === "social" && (
          <div>
            <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4 pt-2">
              <div>
                <h2 className="text-2xl font-bold text-white">Social Media Profiles</h2>
                <p className="text-gray-500 text-sm mt-0.5">Manage platform accounts and credentials</p>
              </div>
              <button onClick={() => { setNewSocial({ platform_name: "", platform_icon: "", profile_link: "", username: "", email: "", password: "", description: "", is_active: true, followers: "" }); setEditingSocialId(null); setIsSocialModalOpen(true); }} className="w-full md:w-auto bg-gradient-to-r from-indigo-500 to-purple-600 text-white px-6 py-3 rounded-xl font-semibold hover:opacity-90 hover:-translate-y-0.5 transition-all duration-200 shadow-[0_0_15px_rgba(99,102,241,0.2)]">
                + Add Social Info
              </button>
            </div>

            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-pulse">
                {[1, 2, 3].map(n => <div key={n} className="h-64 bg-gray-900/40 rounded-2xl border border-gray-800" />)}
              </div>
            ) : socialProfiles.length === 0 ? (
              <div className="text-center py-20 bg-gray-900/50 rounded-2xl border border-gray-800">
                <p className="text-gray-400">No social media profiles added yet.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {socialProfiles.map(profile => (
                  <div key={profile.id} className="group bg-gray-900/40 backdrop-blur-md border border-gray-800 rounded-2xl p-5 hover:border-gray-700 transition-all duration-300 flex flex-col relative">
                    {/* Active toggle */}
                    <button
                      onClick={() => handleToggleActive(profile)}
                      title={profile.is_active ? "Mark as inactive" : "Mark as active"}
                      className={`absolute top-4 right-4 w-5 h-5 rounded-full border-2 transition-all ${profile.is_active ? "bg-emerald-500 border-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.6)]" : "bg-gray-700 border-gray-600"}`}
                    />

                    <div className="flex items-center gap-4 mb-4 pr-8">
                      {profile.platform_icon ? (
                        <Image src={profile.platform_icon} alt={profile.platform_name} width={48} height={48} unoptimized className="w-12 h-12 rounded-xl object-cover bg-gray-800 border border-gray-700" />
                      ) : (
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-gray-800 to-gray-700 border border-gray-600 flex items-center justify-center text-xl font-bold text-gray-300">{profile.platform_name.charAt(0).toUpperCase()}</div>
                      )}
                      <div className="overflow-hidden">
                        <h3 className="text-lg font-bold text-white truncate">{profile.platform_name}</h3>
                        <a href={profile.profile_link?.startsWith("http") ? profile.profile_link : `https://${profile.profile_link}`} target="_blank" rel="noopener noreferrer" className="text-sm text-indigo-400 hover:text-indigo-300 truncate block transition-colors">Visit ↗</a>
                      </div>
                    </div>

                    {profile.description && <p className="text-sm text-gray-400 mb-3 line-clamp-2">{profile.description}</p>}

                    {/* Credentials block */}
                    <div className="space-y-2 mb-4 flex-1 text-sm text-gray-300 bg-gray-950/50 p-3.5 rounded-xl border border-gray-800/50">
                      {profile.username && (
                        <div className="flex justify-between items-center gap-2">
                          <span className="text-gray-500 shrink-0">Username</span>
                          <div className="flex items-center gap-1.5 overflow-hidden">
                            <span className="font-medium truncate max-w-[100px]">{profile.username}</span>
                            <button onClick={() => copyToClipboard(profile.username, "Username")} className="text-gray-600 hover:text-white transition-colors text-xs shrink-0">📋</button>
                          </div>
                        </div>
                      )}
                      {profile.email && (
                        <div className="flex justify-between items-center gap-2">
                          <span className="text-gray-500 shrink-0">Email</span>
                          <div className="flex items-center gap-1.5 overflow-hidden">
                            <span className="font-medium truncate max-w-[100px]" title={profile.email}>{profile.email}</span>
                            <button onClick={() => copyToClipboard(profile.email, "Email")} className="text-gray-600 hover:text-white transition-colors text-xs shrink-0">📋</button>
                          </div>
                        </div>
                      )}
                      {profile.password !== undefined && (
                        <div className="flex justify-between items-center gap-2">
                          <span className="text-gray-500 shrink-0">Password</span>
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono bg-gray-900 px-2 py-0.5 rounded text-gray-400 max-w-[80px] overflow-hidden truncate">
                              {visiblePasswords[profile.id] ? profile.password || "—" : "••••••••"}
                            </span>
                            <button onClick={() => setVisiblePasswords(prev => ({ ...prev, [profile.id]: !prev[profile.id] }))} className="text-gray-500 hover:text-white text-xs transition-colors">
                              {visiblePasswords[profile.id] ? "🙈" : "👁️"}
                            </button>
                            {profile.password && <button onClick={() => copyToClipboard(profile.password!, "Password")} className="text-gray-600 hover:text-white text-xs transition-colors">📋</button>}
                          </div>
                        </div>
                      )}
                      {profile.followers != null && profile.followers > 0 && (
                        <div className="flex justify-between items-center">
                          <span className="text-gray-500">Followers</span>
                          <span className="font-semibold text-gray-200">{profile.followers.toLocaleString()}</span>
                        </div>
                      )}
                    </div>

                    <div className="flex gap-2 mt-auto">
                      <button onClick={() => copyToClipboard(`Email: ${profile.email}\nUsername: ${profile.username}\nPassword: ${profile.password}`, "All credentials")} className="flex-1 bg-gray-800 hover:bg-gray-700 text-white py-2 rounded-lg text-xs font-medium border border-gray-700 transition-all">Copy All</button>
                      <button onClick={() => handleEditSocial(profile)} className="flex-1 bg-gray-800 hover:bg-gray-700 text-white py-2 rounded-lg text-xs font-medium border border-gray-700 transition-all">Edit</button>
                      <button onClick={() => setSocialToDelete(profile.id)} className="flex-1 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 py-2 rounded-lg text-xs font-medium border border-rose-500/20 transition-all">Delete</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ══ UPDATES TAB ═════════════════════════════════════════════════════════ */}
        {activeSection === "updates" && (
          <div>
            <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4 pt-2">
              <div>
                <h2 className="text-2xl font-bold text-white">Latest Updates</h2>
                <p className="text-gray-500 text-sm mt-0.5">Announcements, snippets, and important links</p>
              </div>
              <button onClick={() => { setNewUpdate({ info: "", content: "", link: "", priority: "low", type: "announcement" }); setEditingUpdateId(null); setIsUpdateModalOpen(true); }} className="w-full md:w-auto bg-gradient-to-r from-emerald-500 to-teal-600 text-white px-6 py-3 rounded-xl font-semibold hover:opacity-90 hover:-translate-y-0.5 transition-all duration-200 shadow-[0_0_15px_rgba(16,185,129,0.2)]">
                + Post Update
              </button>
            </div>

            {loading ? (
              <div className="space-y-4 animate-pulse">{[1, 2].map(n => <div key={n} className="h-32 bg-gray-900/40 rounded-2xl border border-gray-800" />)}</div>
            ) : updates.length === 0 ? (
              <div className="text-center py-20 bg-gray-900/50 rounded-2xl border border-gray-800">
                <p className="text-gray-400">No updates posted yet.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {updates.map(update => (
                  <div key={update.id} className="group bg-gray-900/40 backdrop-blur-md border border-gray-800 rounded-2xl p-5 hover:border-gray-700 transition-all relative flex flex-col md:flex-row gap-4">
                    {/* Priority tag */}
                    {update.priority && (
                      <div className={`absolute top-0 right-0 text-[10px] font-bold uppercase px-2.5 py-1 rounded-bl-xl rounded-tr-xl border-l border-b ${priorityColors[update.priority]}`}>
                        {update.priority}
                      </div>
                    )}
                    <div className="flex-1 pr-12">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-base">{updateTypeIcons[update.type || "announcement"] || "📣"}</span>
                        <h3 className="text-lg font-bold text-white">{update.info}</h3>
                        {update.type && (
                          <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded bg-gray-800 text-gray-400 border border-gray-700">{update.type}</span>
                        )}
                      </div>
                      {update.created_at && <p className="text-xs text-gray-600 mb-2">{new Date(update.created_at).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" })}</p>}
                      <p className="text-gray-300 whitespace-pre-wrap text-sm leading-relaxed mb-3">{update.content}</p>
                      {update.link && (
                        <a href={update.link.startsWith("http") ? update.link : `https://${update.link}`} target="_blank" rel="noopener noreferrer" className="text-emerald-400 hover:text-emerald-300 text-sm font-medium inline-flex items-center gap-1 bg-emerald-500/10 px-3 py-1.5 rounded-lg border border-emerald-500/20 w-fit transition-colors">
                          View Link ↗
                        </a>
                      )}
                    </div>
                    <div className="flex md:flex-col gap-2 justify-end items-end shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-gray-800">
                      <button onClick={() => handleEditUpdate(update)} className="text-sm text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 px-4 py-1.5 rounded-lg border border-gray-700 transition-all">Edit</button>
                      <button onClick={() => setUpdateToDelete(update.id)} className="text-sm text-rose-500 bg-rose-500/10 hover:bg-rose-500/20 px-4 py-1.5 rounded-lg border border-rose-500/20 transition-all">Delete</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ══ SETTINGS TAB ════════════════════════════════════════════════════════ */}
        {activeSection === "settings" && (
          <div className="pt-2">
            <h2 className="text-2xl font-bold text-white mb-2">Account Settings</h2>
            <p className="text-gray-500 text-sm mb-8">Manage your public profile details.</p>
            {loading ? (
              <div className="h-52 bg-gray-900/40 rounded-2xl border border-gray-800 w-full max-w-sm animate-pulse" />
            ) : user ? (
              <UpdateUsername userId={user.id} currentUsername={profile?.username || null} onUpdate={() => fetchUserProfile(user.id)} />
            ) : null}
          </div>
        )}

        {/* ══ ACTIVITY LOG TAB ════════════════════════════════════════════════════ */}
        {activeSection === "log" && (
          <div className="pt-2">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-2xl font-bold text-white">Activity Log</h2>
                <p className="text-gray-500 text-sm mt-0.5">In-session action trail (resets on page reload)</p>
              </div>
              {activityLog.length > 0 && (
                <button onClick={() => setActivityLog([])} className="text-sm text-gray-500 hover:text-rose-400 px-3 py-1.5 rounded-lg border border-gray-800 hover:border-rose-500/30 transition-all">Clear log</button>
              )}
            </div>
            {activityLog.length === 0 ? (
              <div className="text-center py-20 bg-gray-900/50 rounded-2xl border border-gray-800">
                <p className="text-3xl mb-3">🕐</p>
                <p className="text-gray-400">No activity yet. Start managing your data!</p>
              </div>
            ) : (
              <div className="space-y-2">
                {activityLog.map(entry => (
                  <div key={entry.id} className="flex items-start gap-4 bg-gray-900/40 border border-gray-800 rounded-xl px-4 py-3 hover:border-gray-700 transition-colors">
                    <span className={`text-xs font-bold uppercase px-2 py-0.5 rounded border mt-0.5 shrink-0 ${logTypeColors[entry.type]}`}>{entry.type}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white font-medium">{entry.action}</p>
                      <p className="text-xs text-gray-500 truncate">{entry.target}</p>
                    </div>
                    <span className="text-xs text-gray-600 shrink-0 mt-0.5">{entry.timestamp.toLocaleTimeString()}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ══ MODALS ══════════════════════════════════════════════════════════════ */}

      {/* Product Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/75 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
          <div className="bg-gray-900 border border-gray-800 p-6 rounded-2xl w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold text-white mb-5">{editingProductId ? "Edit Product" : "Add New Product"}</h2>
            <div className="space-y-3">
              {[
                { placeholder: "Product Name *", key: "name", type: "text" },
                { placeholder: "Category (e.g. Electronics, Fashion)", key: "category", type: "text" },
                { placeholder: "Image URL", key: "image", type: "text" },
              ].map(f => (
                <input key={f.key} type={f.type} placeholder={f.placeholder} value={(newProduct as any)[f.key]} onChange={e => setNewProduct({ ...newProduct, [f.key]: e.target.value })} className="w-full border border-gray-700 px-3 py-2.5 rounded-xl text-white bg-gray-800 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-colors text-sm" />
              ))}
              <textarea placeholder="Description" rows={3} className="w-full border border-gray-700 px-3 py-2.5 rounded-xl text-white bg-gray-800 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-colors text-sm resize-y" value={newProduct.description} onChange={e => setNewProduct({ ...newProduct, description: e.target.value })} />
              <div className="flex gap-3">
                <input type="number" placeholder="Price (Rs)" className="flex-1 border border-gray-700 px-3 py-2.5 rounded-xl text-white bg-gray-800 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-colors text-sm" value={newProduct.price} onChange={e => setNewProduct({ ...newProduct, price: e.target.value })} />
                <input type="number" placeholder="Stock qty" className="flex-1 border border-gray-700 px-3 py-2.5 rounded-xl text-white bg-gray-800 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-colors text-sm" value={newProduct.stock} onChange={e => setNewProduct({ ...newProduct, stock: e.target.value })} />
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => setIsModalOpen(false)} className="px-4 py-2 rounded-xl text-gray-400 hover:text-white transition-colors text-sm">Cancel</button>
              <button onClick={handleSaveProduct} disabled={isSaving} className="bg-white text-black px-5 py-2 rounded-xl font-semibold hover:bg-gray-200 transition-colors disabled:opacity-50 text-sm">
                {isSaving ? "Saving…" : "Save Product"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Product Modal */}
      {productToDelete && (
        <div className="fixed inset-0 bg-black/75 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
          <div className="bg-gray-900 border border-gray-800 p-6 rounded-2xl w-full max-w-sm shadow-2xl text-center">
            <div className="text-4xl mb-3">🗑️</div>
            <h2 className="text-xl font-bold text-white mb-2">Delete Product</h2>
            <p className="text-gray-400 mb-6 text-sm">This action cannot be undone.</p>
            <div className="flex justify-center gap-3">
              <button onClick={() => setProductToDelete(null)} className="px-4 py-2 rounded-xl text-gray-400 hover:text-white transition-colors text-sm">Cancel</button>
              <button onClick={confirmDelete} disabled={isDeleting} className="bg-rose-600 hover:bg-rose-700 text-white px-5 py-2 rounded-xl font-semibold transition-colors disabled:opacity-50 text-sm">
                {isDeleting ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Delete Confirm */}
      {showBulkConfirm && (
        <div className="fixed inset-0 bg-black/75 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
          <div className="bg-gray-900 border border-gray-800 p-6 rounded-2xl w-full max-w-sm shadow-2xl text-center">
            <div className="text-4xl mb-3">⚠️</div>
            <h2 className="text-xl font-bold text-white mb-2">Delete {selectedProducts.size} products?</h2>
            <p className="text-gray-400 mb-6 text-sm">This cannot be undone.</p>
            <div className="flex justify-center gap-3">
              <button onClick={() => setShowBulkConfirm(false)} className="px-4 py-2 rounded-xl text-gray-400 hover:text-white transition-colors text-sm">Cancel</button>
              <button onClick={handleBulkDelete} disabled={isBulkDeleting} className="bg-rose-600 hover:bg-rose-700 text-white px-5 py-2 rounded-xl font-semibold transition-colors disabled:opacity-50 text-sm">
                {isBulkDeleting ? "Deleting…" : "Delete All"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Social Modal */}
      {isSocialModalOpen && (
        <div className="fixed inset-0 bg-black/75 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
          <div className="bg-gray-900 border border-gray-800 p-6 rounded-2xl w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold text-white mb-5">{editingSocialId ? "Edit Social Profile" : "Add Social Info"}</h2>
            <div className="space-y-3">
              {[
                { placeholder: "Platform Name * (e.g. Instagram)", key: "platform_name", type: "text" },
                { placeholder: "Icon / Logo URL", key: "platform_icon", type: "text" },
                { placeholder: "Profile Link * (URL)", key: "profile_link", type: "text" },
                { placeholder: "Username", key: "username", type: "text" },
                { placeholder: "Email", key: "email", type: "email" },
                { placeholder: "Password", key: "password", type: "password" },
                { placeholder: "Followers count", key: "followers", type: "number" },
              ].map(f => (
                <input key={f.key} type={f.type} placeholder={f.placeholder} value={(newSocial as any)[f.key]} onChange={e => setNewSocial({ ...newSocial, [f.key]: e.target.value })} className="w-full border border-gray-700 px-3 py-2.5 rounded-xl text-white bg-gray-800 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-colors text-sm" />
              ))}
              <textarea placeholder="Description or extra info" rows={2} className="w-full border border-gray-700 px-3 py-2.5 rounded-xl text-white bg-gray-800 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-colors text-sm resize-y" value={newSocial.description} onChange={e => setNewSocial({ ...newSocial, description: e.target.value })} />
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" checked={newSocial.is_active} onChange={e => setNewSocial({ ...newSocial, is_active: e.target.checked })} className="w-4 h-4 rounded accent-emerald-500" />
                <span className="text-sm text-gray-300">Mark as active</span>
              </label>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => setIsSocialModalOpen(false)} className="px-4 py-2 rounded-xl text-gray-400 hover:text-white transition-colors text-sm">Cancel</button>
              <button onClick={handleSaveSocial} disabled={isSavingSocial || !newSocial.platform_name || !newSocial.profile_link} className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2 rounded-xl font-semibold transition-colors disabled:opacity-50 text-sm">
                {isSavingSocial ? "Saving…" : "Save Info"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Social Modal */}
      {socialToDelete && (
        <div className="fixed inset-0 bg-black/75 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
          <div className="bg-gray-900 border border-gray-800 p-6 rounded-2xl w-full max-w-sm shadow-2xl text-center">
            <div className="text-4xl mb-3">🗑️</div>
            <h2 className="text-xl font-bold text-white mb-2">Delete Profile</h2>
            <p className="text-gray-400 mb-6 text-sm">This action cannot be undone.</p>
            <div className="flex justify-center gap-3">
              <button onClick={() => setSocialToDelete(null)} className="px-4 py-2 rounded-xl text-gray-400 hover:text-white transition-colors text-sm">Cancel</button>
              <button onClick={confirmDeleteSocial} disabled={isDeleting} className="bg-rose-600 hover:bg-rose-700 text-white px-5 py-2 rounded-xl font-semibold transition-colors disabled:opacity-50 text-sm">
                {isDeleting ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Update Modal */}
      {isUpdateModalOpen && (
        <div className="fixed inset-0 bg-black/75 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
          <div className="bg-gray-900 border border-gray-800 p-6 rounded-2xl w-full max-w-xl shadow-2xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold text-white mb-5">{editingUpdateId ? "Edit Update" : "Post New Update"}</h2>
            <div className="space-y-3">
              <input type="text" placeholder="Title / Info *" className="w-full border border-gray-700 px-3 py-2.5 rounded-xl text-white bg-gray-800 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-colors text-sm" value={newUpdate.info} onChange={e => setNewUpdate({ ...newUpdate, info: e.target.value })} />
              
              {/* Type + Priority row */}
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="text-xs text-gray-500 mb-1 block uppercase tracking-wider">Type</label>
                  <div className="flex gap-2 flex-wrap">
                    {(["announcement", "feature", "fix"] as const).map(t => (
                      <button key={t} type="button" onClick={() => setNewUpdate({ ...newUpdate, type: t })} className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${newUpdate.type === t ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" : "bg-gray-800 text-gray-500 border-gray-700 hover:border-gray-600"}`}>
                        {updateTypeIcons[t]} {t}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex-1">
                  <label className="text-xs text-gray-500 mb-1 block uppercase tracking-wider">Priority</label>
                  <div className="flex gap-2 flex-wrap">
                    {(["low", "medium", "high"] as const).map(p => (
                      <button key={p} type="button" onClick={() => setNewUpdate({ ...newUpdate, priority: p })} className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all capitalize ${newUpdate.priority === p ? priorityColors[p] : "bg-gray-800 text-gray-500 border-gray-700 hover:border-gray-600"}`}>
                        {p}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <textarea placeholder="Content / Snippets *" rows={6} className="w-full border border-gray-700 px-3 py-2.5 rounded-xl text-white bg-gray-800 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-colors text-sm resize-y" value={newUpdate.content} onChange={e => setNewUpdate({ ...newUpdate, content: e.target.value })} />
              <input type="text" placeholder="Relevant Link (optional)" className="w-full border border-gray-700 px-3 py-2.5 rounded-xl text-white bg-gray-800 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-colors text-sm" value={newUpdate.link} onChange={e => setNewUpdate({ ...newUpdate, link: e.target.value })} />
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => setIsUpdateModalOpen(false)} className="px-4 py-2 rounded-xl text-gray-400 hover:text-white transition-colors text-sm">Cancel</button>
              <button onClick={handleSaveUpdate} disabled={isSavingUpdate || !newUpdate.info || !newUpdate.content} className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2 rounded-xl font-semibold transition-colors disabled:opacity-50 text-sm">
                {isSavingUpdate ? "Saving…" : "Post Update"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Update Modal */}
      {updateToDelete && (
        <div className="fixed inset-0 bg-black/75 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
          <div className="bg-gray-900 border border-gray-800 p-6 rounded-2xl w-full max-w-sm shadow-2xl text-center">
            <div className="text-4xl mb-3">🗑️</div>
            <h2 className="text-xl font-bold text-white mb-2">Delete Update</h2>
            <p className="text-gray-400 mb-6 text-sm">This action cannot be undone.</p>
            <div className="flex justify-center gap-3">
              <button onClick={() => setUpdateToDelete(null)} className="px-4 py-2 rounded-xl text-gray-400 hover:text-white transition-colors text-sm">Cancel</button>
              <button onClick={confirmDeleteUpdate} disabled={isDeleting} className="bg-rose-600 hover:bg-rose-700 text-white px-5 py-2 rounded-xl font-semibold transition-colors disabled:opacity-50 text-sm">
                {isDeleting ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Logout Modal */}
      {isLogoutModalOpen && (
        <div className="fixed inset-0 bg-black/75 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
          <div className="bg-gray-900 border border-gray-800 p-6 rounded-2xl w-full max-w-sm shadow-2xl text-center">
            <h2 className="text-xl font-bold text-white mb-2">Confirm Logout</h2>
            <p className="text-gray-400 mb-6 text-sm">Are you sure you want to log out?</p>
            <div className="flex justify-center gap-3">
              <button onClick={() => setIsLogoutModalOpen(false)} disabled={isLoggingOut} className="px-4 py-2 rounded-xl text-gray-400 hover:text-white transition-colors text-sm disabled:opacity-50">Cancel</button>
              <button onClick={confirmLogout} disabled={isLoggingOut} className="bg-rose-600 hover:bg-rose-700 text-white px-5 py-2 rounded-xl font-semibold transition-colors disabled:opacity-50 text-sm">
                {isLoggingOut ? "Logging out…" : "Logout"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-5 right-5 px-5 py-3 rounded-xl shadow-2xl text-white z-[100] text-sm font-medium border transition-all ${toast.type === "success" ? "bg-gray-900 border-emerald-500/40 shadow-emerald-500/10" : "bg-gray-900 border-rose-500/40 shadow-rose-500/10"}`}>
          <span className="mr-2">{toast.type === "success" ? "✅" : "❌"}</span>
          {toast.message}
        </div>
      )}
    </div>
  );
}
