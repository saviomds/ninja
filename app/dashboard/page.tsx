"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { User } from "@supabase/supabase-js";
import Image from "next/image";
import Link from "next/link";
import UpdateUsername from "./UpdateUsername";
import * as XLSX from "xlsx";

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

// ─── Excel helpers ────────────────────────────────────────────────────────────

/** Build a styled cell object for SheetJS */
function sc(
  v: string | number,
  {
    bold = false,
    color = "000000",
    bgColor = "FFFFFF",
    fontSize = 11,
    italic = false,
    hAlign = "center" as "center" | "left" | "right",
    wrapText = false,
    numFmt = "",
    border = false,
    thick = false,
  } = {}
) {
  const borderStyle = thick
    ? { style: "medium", color: { rgb: "94A3B8" } }
    : { style: "thin", color: { rgb: "CBD5E1" } };
  return {
    v,
    t: typeof v === "number" ? "n" : "s",
    s: {
      font: { name: "Arial", bold, color: { rgb: color }, sz: fontSize, italic },
      fill: { patternType: "solid", fgColor: { rgb: bgColor } },
      alignment: { horizontal: hAlign, vertical: "center", wrapText },
      numFmt,
      ...(border && {
        border: {
          top: borderStyle,
          bottom: borderStyle,
          left: borderStyle,
          right: borderStyle,
        },
      }),
    },
  };
}

function getStockStatus(stock: number): { label: string; bg: string; fg: string } {
  if (stock === 0) return { label: "Out of Stock", bg: "FEE2E2", fg: "991B1B" };
  if (stock <= 5)  return { label: "Low Stock",    bg: "FEF9C3", fg: "854D0E" };
  return                  { label: "In Stock",     bg: "DCFCE7", fg: "166534" };
}

/** Set column widths on a worksheet */
function setCols(ws: XLSX.WorkSheet, widths: number[]) {
  ws["!cols"] = widths.map((w) => ({ wch: w }));
}

/** Helper to encode a cell address */
const addr = (r: number, c: number) => XLSX.utils.encode_cell({ r, c });

/** Write a cell directly into the worksheet */
function writeCell(ws: XLSX.WorkSheet, r: number, c: number, cell: object) {
  ws[addr(r, c)] = cell;
}

/** Merge cells in a worksheet */
function merge(ws: XLSX.WorkSheet, r1: number, c1: number, r2: number, c2: number) {
  if (!ws["!merges"]) ws["!merges"] = [];
  ws["!merges"].push({ s: { r: r1, c: c1 }, e: { r: r2, c: c2 } });
}

const extractFileName = (url: string) => {
  try {
    const urlObj = new URL(url);
    const parts = urlObj.pathname.split('/product-images/');
    return parts.length > 1 ? parts[1] : null;
  } catch {
    return url.split('/').pop() ?? null;
  }
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

  const [viewMode, setViewMode] = useState<"card" | "excel">("card");
  // Products
  const productsRef = useRef<HTMLDivElement>(null);
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
  const [imageInputType, setImageInputType] = useState<"link" | "upload">("link");
  const [isUploadingImage, setIsUploadingImage] = useState(false);
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
    setImageInputType("link");
    showToast(editingProductId ? "Product updated!" : "Product added!", "success");
    logActivity(editingProductId ? "Updated product" : "Added product", newProduct.name, editingProductId ? "update" : "create");
    fetchProducts();
  };

  const handleInlineUpdate = async (id: string, field: keyof Product, value: string | number) => {
    setProducts(prev => prev.map(p => p.id === id ? { ...p, [field]: value as never } : p));
    const { error } = await supabase.from("products").update({ [field]: value }).eq("id", id);
    if (error) {
      showToast("Update failed: " + error.message, "error");
      fetchProducts();
    } else {
      logActivity(`Updated ${field}`, id, "update");
    }
  };

  const handleEditClick = (product: Product) => {
    setNewProduct({ name: product.name, image: product.image || "", description: product.description || "", price: product.price.toString(), stock: product.stock.toString(), category: product.category || "" });
    setEditingProductId(product.id);
    setImageInputType(product.image?.includes('product-images') ? "upload" : "link");
    setIsModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!productToDelete) return;
    setIsDeleting(true);
    const prod = products.find(p => p.id === productToDelete);

    if (prod?.image && prod.image.includes('product-images')) {
      const fileName = extractFileName(prod.image);
      if (fileName) {
        await supabase.storage.from('product-images').remove([fileName]);
      }
    }

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

    const fileNames = products
      .filter(p => selectedProducts.has(p.id) && p.image?.includes('product-images'))
      .map(p => extractFileName(p.image))
      .filter(Boolean) as string[];

    if (fileNames.length > 0) {
      await supabase.storage.from('product-images').remove(fileNames);
    }

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

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingImage(true);
    const fileExt = file.name.split('.').pop();
    const fileName = `${Math.random().toString(36).slice(2)}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from('product-images')
      .upload(fileName, file);

    if (uploadError) {
      showToast("Image upload failed: " + uploadError.message, "error");
      setIsUploadingImage(false);
      return;
    }

    const { data } = supabase.storage.from('product-images').getPublicUrl(fileName);
    console.log('Uploaded image public URL:', data.publicUrl);
    setNewProduct(prev => ({ ...prev, image: data.publicUrl }));
    setIsUploadingImage(false);
    showToast("Image uploaded successfully!", "success");
  };

  // ─── ✨ BEAUTIFUL EXCEL EXPORT ─────────────────────────────────────────────
  const handleDownloadExcel = () => {
    if (!products.length) { showToast("No products to export", "error"); return; }

    const wb = XLSX.utils.book_new();
    const now = new Date().toLocaleDateString("en-US", { day: "numeric", month: "long", year: "numeric" });

    // ── SHEET 1: Inventory ──────────────────────────────────────────────────
    const ws1: XLSX.WorkSheet = {};

    // Title banner (row 0)
    merge(ws1, 0, 0, 0, 7);
    writeCell(ws1, 0, 0, sc(`  PRODUCT INVENTORY REPORT`, {
      bold: true, fontSize: 16, color: "FFFFFF", bgColor: "6366F1", hAlign: "left", border: false,
    }));

    // Subtitle (row 1)
    merge(ws1, 1, 0, 1, 7);
    writeCell(ws1, 1, 0, sc(`  Generated: ${now}   |   Total Products: ${products.length}`, {
      fontSize: 10, color: "94A3B8", bgColor: "334155", hAlign: "left", italic: true,
    }));

    // Spacer (row 2) — empty
    for (let c = 0; c < 8; c++) writeCell(ws1, 2, c, sc("", { bgColor: "1E293B" }));

    // Headers (row 3)
    const headers = ["ID", "Product Name", "Category", "Price (Rs)", "Stock Qty", "Stock Value (Rs)", "Status", "Description"];
    headers.forEach((h, c) => writeCell(ws1, 3, c, sc(h, {
      bold: true, fontSize: 11, color: "FFFFFF", bgColor: "1E293B", border: true, thick: true,
    })));

    // Data rows
    products.forEach((p, i) => {
      const row = 4 + i;
      const { label, bg, fg } = getStockStatus(p.stock);
      const rowBg = i % 2 === 0 ? "FFFFFF" : "F8FAFC";
      const stockValue = p.price * p.stock;

      const rowData: [string | number, Partial<Parameters<typeof sc>[1]>][] = [
        [p.id,                   { hAlign: "center", bgColor: rowBg }],
        [p.name,                 { hAlign: "left",   bgColor: rowBg, bold: false }],
        [p.category || "",       { hAlign: "center", bgColor: rowBg }],
        [p.price,                { hAlign: "center", bgColor: rowBg, bold: true, numFmt: "#,##0" }],
        [p.stock,                { hAlign: "center", bgColor: rowBg, numFmt: "#,##0" }],
        [stockValue,             { hAlign: "center", bgColor: "F0FDF4", color: "166534", numFmt: "#,##0" }],
        [label,                  { hAlign: "center", bgColor: bg, color: fg, bold: true }],
        [p.description || "",    { hAlign: "left",   bgColor: rowBg, wrapText: true }],
      ];
      rowData.forEach(([v, opts], c) =>
        writeCell(ws1, row, c, sc(v, { fontSize: 10, border: true, ...opts }))
      );
    });

    // Summary section
    const sr = 4 + products.length + 1;
    const summaries: [string, number | string, string][] = [
      ["TOTAL PRODUCTS",       products.length,                                                     "6366F1"],
      ["TOTAL INVENTORY VALUE", `Rs ${inventoryValue.toLocaleString()}`,                            "10B981"],
      ["OUT OF STOCK",         products.filter(p => p.stock === 0).length,                         "EF4444"],
      ["LOW STOCK (≤5)",       products.filter(p => p.stock > 0 && p.stock <= 5).length,           "F59E0B"],
      ["CATEGORIES",           [...new Set(products.map(p => p.category).filter(Boolean))].length,  "0EA5E9"],
    ];
    summaries.forEach(([label, value, accent], j) => {
      const r = sr + j;
      merge(ws1, r, 0, r, 2);
      writeCell(ws1, r, 0, sc(label,        { bold: true, fontSize: 10, color: "FFFFFF", bgColor: accent, border: true }));
      merge(ws1, r, 3, r, 5);
      writeCell(ws1, r, 3, sc(String(value), { bold: true, fontSize: 13, color: accent, bgColor: "F8FAFC", border: true }));
    });

    // Range & col widths
    const lastRow = sr + summaries.length;
    ws1["!ref"] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: lastRow, c: 7 } });
    setCols(ws1, [10, 28, 16, 14, 12, 20, 14, 36]);
    ws1["!rows"] = [{ hpt: 36 }, { hpt: 22 }, { hpt: 8 }, { hpt: 28 }];

    XLSX.utils.book_append_sheet(wb, ws1, "📦 Inventory");

    // ── SHEET 2: Dashboard KPIs ─────────────────────────────────────────────
    const ws2: XLSX.WorkSheet = {};

    // Title
    merge(ws2, 0, 0, 0, 5);
    writeCell(ws2, 0, 0, sc("  INVENTORY DASHBOARD", {
      bold: true, fontSize: 16, color: "FFFFFF", bgColor: "1E293B", hAlign: "left",
    }));

    // KPI cards (rows 2-4)
    const kpis = [
      { label: "Total Products",     value: products.length,                                             accent: "6366F1", bg: "EEF2FF" },
      { label: "In Stock",           value: products.filter(p => p.stock > 5).length,                   accent: "10B981", bg: "DCFCE7" },
      { label: "Low Stock",          value: products.filter(p => p.stock > 0 && p.stock <= 5).length,   accent: "F59E0B", bg: "FEF9C3" },
      { label: "Out of Stock",       value: products.filter(p => p.stock === 0).length,                 accent: "EF4444", bg: "FEE2E2" },
      { label: "Inventory Value",    value: `Rs ${inventoryValue.toLocaleString()}`,                    accent: "0EA5E9", bg: "E0F2FE" },
      { label: "Unique Categories",  value: [...new Set(products.map(p => p.category).filter(Boolean))].length, accent: "A855F7", bg: "FAF5FF" },
    ];
    kpis.forEach(({ label, value, accent, bg }, col) => {
      // color bar (row 2)
      writeCell(ws2, 2, col, sc("", { bgColor: accent }));
      // value (row 3)
      writeCell(ws2, 3, col, sc(String(value), { bold: true, fontSize: 18, color: accent, bgColor: bg, border: true }));
      // label (row 4)
      writeCell(ws2, 4, col, sc(label, { fontSize: 9, bold: true, color: "64748B", bgColor: bg, border: true }));
    });

    // Category breakdown table
    const cats: Record<string, { count: number; value: number; inStock: number; outStock: number; lowStock: number }> = {};
    products.forEach(p => {
      const cat = p.category || "Uncategorized";
      if (!cats[cat]) cats[cat] = { count: 0, value: 0, inStock: 0, outStock: 0, lowStock: 0 };
      cats[cat].count++;
      cats[cat].value += p.price * p.stock;
      if (p.stock === 0) cats[cat].outStock++;
      else if (p.stock <= 5) cats[cat].lowStock++;
      else cats[cat].inStock++;
    });

    const catHeaders = ["Category", "Products", "In Stock", "Low Stock", "Out of Stock", "Total Value (Rs)"];
    catHeaders.forEach((h, c) => writeCell(ws2, 6, c, sc(h, {
      bold: true, fontSize: 10, color: "FFFFFF", bgColor: "334155", border: true,
    })));

    Object.entries(cats).forEach(([cat, data], i) => {
      const r = 7 + i;
      const bg = i % 2 === 0 ? "FFFFFF" : "F8FAFC";
      const row: [string | number, Partial<Parameters<typeof sc>[1]>][] = [
        [cat,            { hAlign: "left",   bold: true }],
        [data.count,     { hAlign: "center" }],
        [data.inStock,   { hAlign: "center", color: "166534", bgColor: i % 2 === 0 ? "F0FDF4" : "DCFCE7" }],
        [data.lowStock,  { hAlign: "center", color: "854D0E", bgColor: i % 2 === 0 ? "FEFCE8" : "FEF9C3" }],
        [data.outStock,  { hAlign: "center", color: "991B1B", bgColor: i % 2 === 0 ? "FFF1F2" : "FEE2E2" }],
        [data.value,     { hAlign: "center", color: "166534", numFmt: "#,##0" }],
      ];
      row.forEach(([v, opts], c) =>
        writeCell(ws2, r, c, sc(v, { fontSize: 10, border: true, bgColor: bg, ...opts }))
      );
    });

    ws2["!ref"] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: 7 + Object.keys(cats).length, c: 5 } });
    setCols(ws2, [22, 14, 12, 12, 14, 20]);
    ws2["!rows"] = [{ hpt: 36 }, { hpt: 8 }, { hpt: 8 }, { hpt: 40 }, { hpt: 22 }, { hpt: 10 }, { hpt: 24 }];

    XLSX.utils.book_append_sheet(wb, ws2, "📊 Dashboard");

    // ── SHEET 3: By Category ────────────────────────────────────────────────
    const ws3: XLSX.WorkSheet = {};
    merge(ws3, 0, 0, 0, 6);
    writeCell(ws3, 0, 0, sc("  PRODUCTS BY CATEGORY", {
      bold: true, fontSize: 15, color: "FFFFFF", bgColor: "6366F1", hAlign: "left",
    }));

    const catAccents: Record<string, { bg: string; accent: string }> = {};
    const palette = [
      { bg: "EEF2FF", accent: "6366F1" },
      { bg: "FDF4FF", accent: "A855F7" },
      { bg: "FFF7ED", accent: "F97316" },
      { bg: "F0FDF4", accent: "22C55E" },
      { bg: "E0F2FE", accent: "0EA5E9" },
      { bg: "FFF1F2", accent: "F43F5E" },
    ];
    Object.keys(cats).forEach((cat, i) => { catAccents[cat] = palette[i % palette.length]; });

    const colHeaders = ["ID", "Name", "Category", "Price (Rs)", "Stock", "Status", "Description"];
    const colWidths3 = [10, 26, 16, 14, 10, 14, 36];

    let row3 = 2;
    Object.entries(cats).forEach(([cat, _data]) => {
      const catProds = products.filter(p => (p.category || "Uncategorized") === cat);
      const { accent, bg } = catAccents[cat];

      // Category header
      merge(ws3, row3, 0, row3, 6);
      writeCell(ws3, row3, 0, sc(`  ${cat}  (${catProds.length} products)`, {
        bold: true, fontSize: 12, color: "FFFFFF", bgColor: accent, hAlign: "left",
      }));
      row3++;

      // Column headers
      colHeaders.forEach((h, c) => writeCell(ws3, row3, c, sc(h, {
        bold: true, fontSize: 10, color: "374151", bgColor: bg, border: true,
      })));
      row3++;

      // Product rows
      catProds.forEach((p, i) => {
        const { label, bg: sBg, fg: sFg } = getStockStatus(p.stock);
        const rowBg = i % 2 === 0 ? "FFFFFF" : "F8FAFC";
        const cells: [string | number, Partial<Parameters<typeof sc>[1]>][] = [
          [p.id,              { hAlign: "center" }],
          [p.name,            { hAlign: "left"   }],
          [p.category || "",  { hAlign: "center" }],
          [p.price,           { hAlign: "center", bold: true, numFmt: "#,##0" }],
          [p.stock,           { hAlign: "center", numFmt: "#,##0" }],
          [label,             { hAlign: "center", color: sFg, bgColor: sBg, bold: true }],
          [p.description||"", { hAlign: "left", wrapText: true }],
        ];
        cells.forEach(([v, opts], c) =>
          writeCell(ws3, row3, c, sc(v, { fontSize: 10, border: true, bgColor: rowBg, ...opts }))
        );
        row3++;
      });
      row3++; // spacer
    });

    ws3["!ref"] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: row3, c: 6 } });
    setCols(ws3, colWidths3);

    XLSX.utils.book_append_sheet(wb, ws3, "🗂️ By Category");

    // ── Write & download ───────────────────────────────────────────────────
    XLSX.writeFile(wb, `Products_Inventory_${new Date().toISOString().slice(0, 10)}.xlsx`, { cellStyles: true });
    showToast("Exported beautiful Excel!", "success");
    logActivity("Exported product inventory (styled)", `${products.length} products`, "info");
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
    const newStatus = !p.is_active;
    const { error } = await supabase.from("social_profiles").update({ is_active: newStatus }).eq("id", p.id);
    if (error) { 
      console.dir(error);
      showToast("Toggle failed: " + (error.message || "Missing is_active column in DB"), "error"); 
      return; 
    }
    logActivity(`Marked ${p.platform_name} as ${newStatus ? "active" : "inactive"}`, p.platform_name, "update");
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
    const updateData = {
      info: newUpdate.info,
      content: newUpdate.content,
      link: newUpdate.link || null,
      priority: newUpdate.priority,
      type: newUpdate.type,
    };
    let error;
    if (editingUpdateId) {
      ({ error } = await supabase.from("updates").update(updateData).eq("id", editingUpdateId));
    } else {
      ({ error } = await supabase.from("updates").insert(updateData));
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
          <div ref={productsRef} className="scroll-mt-32">
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
                <button onClick={() => { setNewProduct({ name: "", image: "", description: "", price: "", stock: "", category: "" }); setEditingProductId(null); setImageInputType("link"); setIsModalOpen(true); }} className="flex items-center gap-2 bg-white text-black px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-gray-200 transition-all shadow-[0_0_15px_rgba(255,255,255,0.1)]">
                  + New Product
                </button>
                <button onClick={() => setViewMode(v => v === "card" ? "excel" : "card")} className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 text-white px-4 py-2.5 rounded-xl text-sm font-medium border border-gray-700 transition-all">
                  {viewMode === "card" ? "🗃️ Excel Mode" : "🃏 Card Mode"}
                </button>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 mb-6">
              <div className="relative flex-1">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                <input type="text" placeholder="Search by name, description, category…" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="w-full bg-gray-900 border border-gray-800 rounded-xl pl-10 pr-4 py-2.5 text-base md:text-sm text-white placeholder-gray-500 focus:outline-none focus:border-gray-600 transition-colors" />
              </div>
              <div className="flex gap-2 flex-wrap">
                {(["all", "in_stock", "low", "out"] as const).map(f => (
                  <button key={f} onClick={() => setStockFilter(f)} className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-all whitespace-nowrap ${stockFilter === f ? "bg-indigo-500/15 text-indigo-300 border-indigo-500/30" : "bg-gray-900 text-gray-500 border-gray-800 hover:border-gray-600"}`}>
                    {f === "all" ? "All" : f === "in_stock" ? "✅ In Stock" : f === "low" ? "⚠️ Low" : "❌ Out"}
                  </button>
                ))}
              </div>
              <select value={sortBy} onChange={e => setSortBy(e.target.value as typeof sortBy)} className="bg-gray-900 border border-gray-800 rounded-xl px-3 py-2.5 text-base md:text-sm text-gray-400 focus:outline-none focus:border-gray-600 cursor-pointer">
                <option value="newest">Newest</option>
                <option value="price_asc">Price ↑</option>
                <option value="price_desc">Price ↓</option>
                <option value="stock_asc">Stock ↑</option>
                <option value="stock_desc">Stock ↓</option>
              </select>
            </div>

            {filteredProducts.length > 0 && (
              <div className="flex items-center gap-3 mb-4 px-1">
                <input type="checkbox" checked={selectedProducts.size > 0 && selectedProducts.size === paginatedProducts.length} onChange={toggleSelectAll} className="w-4 h-4 rounded accent-white cursor-pointer" />
                <span className="text-xs text-gray-500">
                  {selectedProducts.size > 0 ? `${selectedProducts.size} selected` : "Select all on page"}
                </span>
              </div>
            )}

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
                {viewMode === "excel" ? (
                  <div className="overflow-x-auto bg-gray-900/40 backdrop-blur-md border border-gray-800 rounded-2xl">
                    <table className="w-full text-sm text-left">
                      <thead className="text-xs text-gray-400 uppercase bg-gray-800/50 border-b border-gray-800">
                        <tr>
                          <th className="px-4 py-3 w-10">
                            <input type="checkbox" checked={selectedProducts.size > 0 && selectedProducts.size === paginatedProducts.length} onChange={toggleSelectAll} className="w-4 h-4 rounded accent-indigo-500 cursor-pointer" />
                          </th>
                          <th className="px-4 py-3 w-16">Img</th>
                          <th className="px-4 py-3">Name</th>
                          <th className="px-4 py-3">Category</th>
                          <th className="px-4 py-3 min-w-[200px]">Description</th>
                          <th className="px-4 py-3 w-24">Price</th>
                          <th className="px-4 py-3 w-24">Stock</th>
                          <th className="px-4 py-3 w-20">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedProducts.map((product) => (
                          <tr key={product.id} className={`border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors ${selectedProducts.has(product.id) ? "bg-indigo-500/5" : ""}`}>
                            <td className="px-4 py-3">
                              <input type="checkbox" checked={selectedProducts.has(product.id)} onChange={() => toggleSelectProduct(product.id)} className="w-4 h-4 rounded accent-indigo-500 cursor-pointer" />
                            </td>
                            <td className="px-4 py-3">
                              {product.image ? (
                                <div className="w-8 h-8 rounded relative overflow-hidden bg-gray-800">
                                  <Image src={product.image.replace('/object/public/', '/render/image/public/')} alt="" fill className="object-cover" unoptimized />
                                </div>
                              ) : <div className="w-8 h-8 rounded bg-gray-800 text-[10px] flex items-center justify-center text-gray-500">N/A</div>}
                            </td>
                            <td className="px-4 py-3">
                              <input
                                type="text"
                                defaultValue={product.name}
                                onBlur={(e) => e.target.value !== product.name && handleInlineUpdate(product.id, "name", e.target.value)}
                                className="bg-transparent border border-transparent hover:border-gray-700 focus:border-indigo-500 focus:bg-gray-900 rounded px-2 py-1 w-full text-base md:text-sm text-white outline-none transition-all"
                              />
                            </td>
                            <td className="px-4 py-3">
                              <input
                                type="text"
                                defaultValue={product.category || ""}
                                onBlur={(e) => e.target.value !== (product.category || "") && handleInlineUpdate(product.id, "category", e.target.value)}
                                className="bg-transparent border border-transparent hover:border-gray-700 focus:border-indigo-500 focus:bg-gray-900 rounded px-2 py-1 w-full text-base md:text-sm text-white outline-none transition-all"
                              />
                            </td>
                            <td className="px-4 py-3">
                              <textarea
                                rows={expandedDesc[`excel_${product.id}`] ? 4 : 1}
                                onClick={() => setExpandedDesc(prev => ({ ...prev, [`excel_${product.id}`]: true }))}
                                onBlur={(e) => {
                                  setExpandedDesc(prev => ({ ...prev, [`excel_${product.id}`]: false }));
                                  if (e.target.value !== (product.description || "")) {
                                    handleInlineUpdate(product.id, "description", e.target.value);
                                  }
                                }}
                                defaultValue={product.description || ""}
                                className="bg-transparent border border-transparent hover:border-gray-700 focus:border-indigo-500 focus:bg-gray-900 rounded px-2 py-1 w-full text-base md:text-sm text-white outline-none transition-all resize-none block align-middle [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-gray-700 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-gray-600"
                              />
                            </td>
                            <td className="px-4 py-3">
                              <input
                                type="number"
                                defaultValue={product.price}
                                onBlur={(e) => parseFloat(e.target.value) !== product.price && handleInlineUpdate(product.id, "price", parseFloat(e.target.value) || 0)}
                                className="bg-transparent border border-transparent hover:border-gray-700 focus:border-indigo-500 focus:bg-gray-900 rounded px-2 py-1 w-full text-base md:text-sm text-white outline-none transition-all"
                              />
                            </td>
                            <td className="px-4 py-3">
                              <input
                                type="number"
                                defaultValue={product.stock}
                                onBlur={(e) => parseInt(e.target.value, 10) !== product.stock && handleInlineUpdate(product.id, "stock", parseInt(e.target.value, 10) || 0)}
                                className="bg-transparent border border-transparent hover:border-gray-700 focus:border-indigo-500 focus:bg-gray-900 rounded px-2 py-1 w-full text-base md:text-sm text-white outline-none transition-all"
                              />
                            </td>
                            <td className="px-4 py-3 text-center">
                              <button onClick={() => setProductToDelete(product.id)} className="text-rose-400 hover:text-rose-300 p-1">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {paginatedProducts.map(product => (
                      <div key={product.id} className={`group bg-gray-900/40 backdrop-blur-md border rounded-2xl overflow-hidden transition-all duration-300 hover:shadow-2xl hover:shadow-black/50 flex flex-col ${selectedProducts.has(product.id) ? "border-indigo-500/50 ring-1 ring-indigo-500/30" : "border-gray-800 hover:border-gray-700"}`}>
                        <div className="aspect-[4/3] w-full bg-gray-800 relative overflow-hidden">
                        <div className="absolute top-3 left-3 z-10">
                          <input type="checkbox" checked={selectedProducts.has(product.id)} onChange={() => toggleSelectProduct(product.id)} className="w-4 h-4 rounded accent-indigo-500 cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()} />
                        </div>
                        {product.image ? (
                          <Image
                            key={product.image}
                            src={product.image.replace('/object/public/', '/render/image/public/')}
                            alt={product.name} 
                            fill
                            unoptimized
                            className="object-cover group-hover:scale-105 transition-transform duration-500" 
                            onError={(e) => { 
                              console.error('Image failed to load:', product.image);
                              (e.target as HTMLImageElement).src = "https://placehold.co/400x300/1f2937/9ca3af?text=Image+Not+Found"; 
                            }}
                          />
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

                        {product.created_at && (
                          <p className="text-xs text-gray-500 mb-2 font-medium">
                            Added {new Date(product.created_at).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" })}
                          </p>
                        )}

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
                )}

                {totalPages > 1 && (
                  <div className="flex justify-center items-center mt-10 gap-2 flex-wrap">
                    <button disabled={currentPage === 1} onClick={() => { setCurrentPage(p => p - 1); productsRef.current?.scrollIntoView({ behavior: "smooth" }); }} className="px-4 py-2 rounded-xl border border-gray-800 text-sm text-gray-400 hover:bg-gray-800 disabled:opacity-40 transition-all">Prev</button>
                    <div className="flex flex-wrap justify-center gap-1">
                      {(totalPages <= 5
                        ? Array.from({ length: totalPages }, (_, i) => i + 1)
                        : currentPage <= 3
                        ? [1, 2, 3, "...", totalPages]
                        : currentPage >= totalPages - 2
                        ? [1, "...", totalPages - 2, totalPages - 1, totalPages]
                        : [1, "...", currentPage, "...", totalPages]
                      ).map((page, index) => (
                        <button
                          key={index}
                          onClick={() => {
                            if (typeof page === "number") {
                              setCurrentPage(page);
                              productsRef.current?.scrollIntoView({ behavior: "smooth" });
                            }
                          }}
                          disabled={page === "..."}
                          className={`w-9 h-9 rounded-xl text-sm font-semibold transition-all ${
                            page === "..."
                              ? "text-gray-500 cursor-default"
                              : currentPage === page
                              ? "bg-white text-black"
                              : "text-gray-400 hover:bg-gray-800 border border-transparent hover:border-gray-700"
                          }`}
                        >
                          {page}
                        </button>
                      ))}
                    </div>
                    <button disabled={currentPage === totalPages} onClick={() => { setCurrentPage(p => p + 1); productsRef.current?.scrollIntoView({ behavior: "smooth" }); }} className="px-4 py-2 rounded-xl border border-gray-800 text-sm text-gray-400 hover:bg-gray-800 disabled:opacity-40 transition-all">Next</button>
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
                    <button
                      onClick={() => handleToggleActive(profile)}
                      title={profile.is_active ? "Mark as inactive" : "Mark as active"}
                      className={`absolute top-4 right-4 w-5 h-5 rounded-full border-2 transition-all ${profile.is_active ? "bg-emerald-500 border-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.6)]" : "bg-gray-700 border-gray-600"}`}
                    />

                    <div className="flex items-center gap-4 mb-4 pr-8">
                      {profile.platform_icon ? (
                        <Image 
                          src={profile.platform_icon} 
                          alt={profile.platform_name} 
                          width={48} 
                          height={48} 
                          unoptimized 
                          className="rounded-xl object-cover bg-gray-800 border border-gray-700" 
                          onError={(e) => {
                            console.error('Social icon failed to load:', profile.platform_icon);
                            (e.target as HTMLImageElement).src = `https://placehold.co/48x48/1f2937/9ca3af?text=${profile.platform_name.charAt(0).toUpperCase()}`;
                          }}
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-gray-800 to-gray-700 border border-gray-600 flex items-center justify-center text-xl font-bold text-gray-300">{profile.platform_name.charAt(0).toUpperCase()}</div>
                      )}
                      <div className="overflow-hidden">
                        <h3 className="text-lg font-bold text-white truncate">{profile.platform_name}</h3>
                        <a href={profile.profile_link?.startsWith("http") ? profile.profile_link : `https://${profile.profile_link}`} target="_blank" rel="noopener noreferrer" className="text-sm text-indigo-400 hover:text-indigo-300 truncate block transition-colors">Visit ↗</a>
                      </div>
                    </div>

                    {profile.description && <p className="text-sm text-gray-400 mb-3 line-clamp-2">{profile.description}</p>}

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

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/75 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
          <div className="bg-gray-900 border border-gray-800 p-6 rounded-2xl w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold text-white mb-5">{editingProductId ? "Edit Product" : "Add New Product"}</h2>
            <div className="space-y-3">
              {[
                { placeholder: "Product Name *", key: "name", type: "text" },
                { placeholder: "Category (e.g. Electronics, Fashion)", key: "category", type: "text" },
              ].map(f => (
                <input key={f.key} type={f.type} placeholder={f.placeholder} value={(newProduct as any)[f.key]} onChange={e => setNewProduct({ ...newProduct, [f.key]: e.target.value })} className="w-full border border-gray-700 px-3 py-2.5 rounded-xl text-white bg-gray-800 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-colors text-base md:text-sm" />
              ))}

              <div className="flex flex-col gap-2">
                <div className="flex justify-between items-center px-1">
                  <label className="text-xs text-gray-500 uppercase tracking-wider">Product Image</label>
                  <div className="flex gap-2 bg-gray-800/50 p-1 rounded-lg border border-gray-700/50">
                    <button type="button" onClick={() => setImageInputType("link")} className={`text-xs px-3 py-1 rounded-md transition-colors ${imageInputType === "link" ? "bg-gray-700 text-white shadow-sm" : "text-gray-500 hover:text-gray-300"}`}>Link</button>
                    <button type="button" onClick={() => setImageInputType("upload")} className={`text-xs px-3 py-1 rounded-md transition-colors ${imageInputType === "upload" ? "bg-gray-700 text-white shadow-sm" : "text-gray-500 hover:text-gray-300"}`}>Upload</button>
                  </div>
                </div>
                {imageInputType === "link" ? (
                  <input type="text" placeholder="Image URL" value={newProduct.image} onChange={e => setNewProduct({ ...newProduct, image: e.target.value })} className="w-full border border-gray-700 px-3 py-2.5 rounded-xl text-white bg-gray-800 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-colors text-base md:text-sm" />
                ) : (
                  <div className="relative">
                    <input type="file" accept="image/*" onChange={handleImageUpload} disabled={isUploadingImage} className="w-full border border-gray-700 px-3 py-2 rounded-xl text-white bg-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-colors text-sm file:mr-4 file:py-1.5 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-indigo-500/10 file:text-indigo-400 hover:file:bg-indigo-500/20 disabled:opacity-50 cursor-pointer" />
                    {isUploadingImage && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-indigo-400 font-medium flex items-center gap-1.5">
                        <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25"></circle><path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" className="opacity-75"></path></svg>
                        Uploading...
                      </div>
                    )}
                  </div>
                )}
                {imageInputType === "upload" && newProduct.image && !isUploadingImage && (
                  <div className="text-xs text-emerald-400 ml-1 font-medium">✓ Image uploaded successfully</div>
                )}
                {newProduct.image && (
                  <div className="relative w-full h-40 mt-1 bg-gray-900/50 rounded-xl border border-gray-700 overflow-hidden flex items-center justify-center">
                    <Image
                      src={newProduct.image.replace('/object/public/', '/render/image/public/')}
                      alt="Product preview" 
                      fill
                      unoptimized
                      className="object-contain" 
                      onError={(e) => { (e.target as HTMLImageElement).src = "https://placehold.co/400x300/1f2937/9ca3af?text=Broken+Link"; }}
                    />
                  </div>
                )}
              </div>

              <textarea placeholder="Description" rows={3} className="w-full border border-gray-700 px-3 py-2.5 rounded-xl text-white bg-gray-800 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-colors text-base md:text-sm resize-y [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-gray-700 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-gray-600" value={newProduct.description} onChange={e => setNewProduct({ ...newProduct, description: e.target.value })} />
              <div className="flex gap-3">
                <input type="number" placeholder="Price (Rs)" className="flex-1 border border-gray-700 px-3 py-2.5 rounded-xl text-white bg-gray-800 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-colors text-base md:text-sm" value={newProduct.price} onChange={e => setNewProduct({ ...newProduct, price: e.target.value })} />
                <input type="number" placeholder="Stock qty" className="flex-1 border border-gray-700 px-3 py-2.5 rounded-xl text-white bg-gray-800 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-colors text-base md:text-sm" value={newProduct.stock} onChange={e => setNewProduct({ ...newProduct, stock: e.target.value })} />
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => setIsModalOpen(false)} className="px-4 py-2 rounded-xl text-gray-400 hover:text-white transition-colors text-sm">Cancel</button>
              <button onClick={handleSaveProduct} disabled={isSaving || isUploadingImage} className="bg-white text-black px-5 py-2 rounded-xl font-semibold hover:bg-gray-200 transition-colors disabled:opacity-50 text-sm">
                {isSaving ? "Saving…" : "Save Product"}
              </button>
            </div>
          </div>
        </div>
      )}

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
                <input key={f.key} type={f.type} placeholder={f.placeholder} value={(newSocial as any)[f.key]} onChange={e => setNewSocial({ ...newSocial, [f.key]: e.target.value })} className="w-full border border-gray-700 px-3 py-2.5 rounded-xl text-white bg-gray-800 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-colors text-base md:text-sm" />
              ))}
              <textarea placeholder="Description or extra info" rows={2} className="w-full border border-gray-700 px-3 py-2.5 rounded-xl text-white bg-gray-800 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-colors text-base md:text-sm resize-y [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-gray-700 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-gray-600" value={newSocial.description} onChange={e => setNewSocial({ ...newSocial, description: e.target.value })} />
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" checked={newSocial.is_active} onChange={e => setNewSocial({ ...newSocial, is_active: e.target.checked })} className="w-4 h-4 appearance-none border border-gray-600 bg-transparent checked:bg-emerald-500 checked:border-emerald-500 cursor-pointer transition-all rounded flex items-center justify-center relative after:content-['✓'] after:text-white after:text-[10px] after:font-bold after:absolute after:top-1/2 after:left-1/2 after:-translate-x-1/2 after:-translate-y-1/2 after:opacity-0 checked:after:opacity-100" />
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

      {isUpdateModalOpen && (
        <div className="fixed inset-0 bg-black/75 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
          <div className="bg-gray-900 border border-gray-800 p-6 rounded-2xl w-full max-w-xl shadow-2xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold text-white mb-5">{editingUpdateId ? "Edit Update" : "Post New Update"}</h2>
            <div className="space-y-3">
              <input type="text" placeholder="Title / Info *" className="w-full border border-gray-700 px-3 py-2.5 rounded-xl text-white bg-gray-800 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-colors text-base md:text-sm" value={newUpdate.info} onChange={e => setNewUpdate({ ...newUpdate, info: e.target.value })} />
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
              <textarea placeholder="Content / Snippets *" rows={6} className="w-full border border-gray-700 px-3 py-2.5 rounded-xl text-white bg-gray-800 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-colors text-base md:text-sm resize-y [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-gray-700 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-gray-600" value={newUpdate.content} onChange={e => setNewUpdate({ ...newUpdate, content: e.target.value })} />
              <input type="text" placeholder="Relevant Link (optional)" className="w-full border border-gray-700 px-3 py-2.5 rounded-xl text-white bg-gray-800 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-colors text-base md:text-sm" value={newUpdate.link} onChange={e => setNewUpdate({ ...newUpdate, link: e.target.value })} />
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

      {toast && (
        <div className={`fixed bottom-6 right-6 z-[110] flex items-center gap-3 px-5 py-3.5 rounded-xl shadow-2xl transition-all duration-300 animate-in slide-in-from-bottom-5 ${toast.type === "success" ? "bg-emerald-500/20 text-emerald-200 border border-emerald-500/30" : "bg-rose-500/20 text-rose-200 border border-rose-500/30"}`}>
          <span className="text-xl">{toast.type === "success" ? "✅" : "❌"}</span>
          <span className="text-sm font-semibold">{toast.message}</span>
        </div>
      )}
    </div>
  );
}
