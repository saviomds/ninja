"use client";

import Navbar from "@/components/Navbar";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import Image from "next/image";
import { User } from "@supabase/supabase-js";

interface Product {
  id: string;
  name: string;
  description: string;
  image: string;
  price: number;
  stock: number;
  created_at?: string;
  category?: string;
}

interface SocialProfile {
  id: string;
  platform_name: string;
  platform_icon: string;
  profile_link: string;
  username: string;
  description?: string;
  followers?: number;
  is_active?: boolean;
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

interface AdminStats {
  totalRevenue: number;
  outOfStockCount: number;
  lowStockCount: number;
}

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

function AdminBadge({ isAdmin }: { isAdmin: boolean }) {
  if (!isAdmin) return null;
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full bg-violet-500/15 text-violet-300 border border-violet-500/30">
      <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" />
      Admin
    </span>
  );
}

function StockBadge({ stock }: { stock: number }) {
  if (stock === 0)
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-md bg-red-500/10 text-red-400 border border-red-500/20">
        <span className="w-1.5 h-1.5 rounded-full bg-red-500" /> Out of stock
      </span>
    );
  if (stock <= 5)
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/20">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" /> Low: {stock} left
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> {stock} in stock
    </span>
  );
}

export default function Home() {
  const [products, setProducts] = useState<Product[]>([]);
  const [socialProfiles, setSocialProfiles] = useState<SocialProfile[]>([]);
  const [updates, setUpdates] = useState<AppUpdate[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [totalUsers, setTotalUsers] = useState<number>(0);
  const [adminStats, setAdminStats] = useState<AdminStats>({
    totalRevenue: 0,
    outOfStockCount: 0,
    lowStockCount: 0,
  });
  const [productFilter, setProductFilter] = useState<"all" | "in_stock" | "low" | "out">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"newest" | "price_asc" | "price_desc" | "stock">("newest");
  const [activeUpdateType, setActiveUpdateType] = useState<string>("all");
  
  // Interactive States
  const [quickViewProduct, setQuickViewProduct] = useState<Product | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const showToast = (message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    const fetchAllData = async () => {
      const [productsRes, socialRes, updatesRes, authRes, usersRes] = await Promise.all([
        supabase.from("products").select("*").order("created_at", { ascending: false }),
        supabase
          .from("social_profiles")
          .select("id, platform_name, platform_icon, profile_link, username, description, followers, is_active")
          .order("created_at", { ascending: false }),
        supabase.from("updates").select("*").order("created_at", { ascending: false }),
        supabase.auth.getUser(),
        supabase.from("profiles").select("id", { count: "exact", head: true }),
      ]);

      const fetchedProducts: Product[] = productsRes.data || [];
      const fetchedUpdates: AppUpdate[] = updatesRes.data || [];
      const fetchedUser = authRes.data?.user || null;

      setProducts(fetchedProducts);
      setSocialProfiles(socialRes.data || []);
      setUpdates(fetchedUpdates);
      setUser(fetchedUser);
      setTotalUsers(usersRes.count || 0);

      // Check admin role from user metadata or profiles table
      if (fetchedUser) {
        const role = fetchedUser.user_metadata?.role || fetchedUser.app_metadata?.role;
        setIsAdmin(role === "admin");
      }

      // Compute admin stats
      const outOfStock = fetchedProducts.filter((p) => p.stock === 0).length;
      const lowStock = fetchedProducts.filter((p) => p.stock > 0 && p.stock <= 5).length;
      const revenue = fetchedProducts.reduce((acc, p) => acc + p.price * (p.stock || 0), 0);
      setAdminStats({ totalRevenue: revenue, outOfStockCount: outOfStock, lowStockCount: lowStock });

      setLoading(false);
    };

    fetchAllData();

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user || null);
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  // ── Auto-open Quick View from URL ──────────────────────────────────────────
  useEffect(() => {
    if (!loading && products.length > 0) {
      const params = new URLSearchParams(window.location.search);
      const productId = params.get("product");
      if (productId) {
        const productToOpen = products.find((p) => p.id === productId);
        if (productToOpen) {
          setQuickViewProduct(productToOpen);
        }
      }
    }
  }, [loading, products]);

  const handleCopyLink = (productId: string) => {
    const url = `${window.location.origin}/product/${productId}`;
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(url).then(() => showToast("Product link copied!"));
    } else {
      const textArea = document.createElement("textarea");
      textArea.value = url;
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand("copy");
        showToast("Product link copied!");
      } catch (err) {
        showToast("Failed to copy link", "error");
      }
      textArea.remove();
    }
  };

  const closeQuickView = () => {
    setQuickViewProduct(null);
    const url = new URL(window.location.href);
    if (url.searchParams.has("product")) {
      url.searchParams.delete("product");
      window.history.replaceState({}, "", url.toString());
    }
  };

  // ── Derived filtered + sorted products ──────────────────────────────────────
  const filteredProducts = products
    .filter((p) => {
      const matchesSearch =
        searchQuery.trim() === "" ||
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.description || "").toLowerCase().includes(searchQuery.toLowerCase());

      const matchesFilter =
        productFilter === "all" ||
        (productFilter === "in_stock" && p.stock > 5) ||
        (productFilter === "low" && p.stock > 0 && p.stock <= 5) ||
        (productFilter === "out" && p.stock === 0);

      return matchesSearch && matchesFilter;
    })
    .sort((a, b) => {
      if (sortBy === "price_asc") return a.price - b.price;
      if (sortBy === "price_desc") return b.price - a.price;
      if (sortBy === "stock") return b.stock - a.stock;
      // newest: rely on existing sort from DB
      return 0;
    });

  // ── Derived filtered updates ─────────────────────────────────────────────────
  const filteredUpdates =
    activeUpdateType === "all"
      ? updates
      : updates.filter((u) => (u.type || "announcement") === activeUpdateType);

  const updateTypes = ["all", ...Array.from(new Set(updates.map((u) => u.type || "announcement")))];

  return (
    <main className="min-h-screen bg-gray-950 text-white">
      <Navbar />

      {/* ── Hero ────────────────────────────────────────────────────────────── */}
      <section className="relative py-24 flex flex-col items-center justify-center text-center px-4 overflow-hidden border-b border-gray-800/50">
        <div className="absolute inset-0 bg-gradient-to-b from-indigo-500/10 to-transparent pointer-events-none" />
        {/* subtle grid overlay */}
        <div
          className="absolute inset-0 pointer-events-none opacity-[0.04]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.5) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.5) 1px,transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />

        <div className="relative z-10 flex flex-col items-center gap-4">
          {user && (
            <div className="flex items-center gap-2 mb-2">
              <span className="text-sm text-gray-400">
                Welcome back,{" "}
                <span className="text-white font-semibold">
                  {user.user_metadata?.full_name || user.email?.split("@")[0] || "User"}
                </span>
              </span>
              <AdminBadge isAdmin={isAdmin} />
            </div>
          )}

          <h1 className="text-5xl md:text-6xl font-extrabold mb-4 text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-400 tracking-tight">
            Join. Connect. Earn.
          </h1>
          <p className="text-lg text-gray-400 mb-6 max-w-2xl">
            A simple platform to manage projects, share work, and stay updated with the latest announcements.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link
              href={user ? "/dashboard" : "/login"}
              className="bg-white text-black px-8 py-3 rounded-full font-semibold hover:bg-gray-200 hover:scale-105 transition-all duration-200 shadow-[0_0_20px_rgba(255,255,255,0.2)]"
            >
              {user ? "Jump In" : "Get Started"}
            </Link>
            {isAdmin && (
              <Link
                href="/admin"
                className="bg-violet-600 hover:bg-violet-500 text-white px-6 py-3 rounded-full font-semibold transition-all duration-200 flex items-center gap-2 shadow-[0_0_20px_rgba(139,92,246,0.3)]"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                </svg>
                Admin Panel
              </Link>
            )}
          </div>
        </div>
      </section>

      {loading ? (
        <div className="max-w-6xl mx-auto px-6 py-20 flex justify-center">
          <div className="animate-pulse flex flex-col items-center gap-4">
            <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-gray-400 font-medium">Loading platform data...</p>
          </div>
        </div>
      ) : (
        <div className="max-w-6xl mx-auto px-6 py-16 space-y-24">

          {/* ── Stats Overview ──────────────────────────────────────────────── */}
          <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 -mt-8 relative z-20">
            {[
              {
                value: products.length,
                label: "Total Products",
                color: "text-indigo-400",
                border: "hover:border-indigo-500/50",
                icon: (
                  <svg className="w-5 h-5 text-indigo-400/60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                  </svg>
                ),
              },
              {
                value: updates.length,
                label: "Platform Updates",
                color: "text-emerald-400",
                border: "hover:border-emerald-500/50",
                icon: (
                  <svg className="w-5 h-5 text-emerald-400/60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                ),
              },
              {
                value: socialProfiles.length,
                label: "Connected Profiles",
                color: "text-amber-400",
                border: "hover:border-amber-500/50",
                icon: (
                  <svg className="w-5 h-5 text-amber-400/60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0" />
                  </svg>
                ),
              },
              {
                value: totalUsers,
                label: "Registered Users",
                color: "text-rose-400",
                border: "hover:border-rose-500/50",
                icon: (
                  <svg className="w-5 h-5 text-rose-400/60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                ),
              },
            ].map(({ value, label, color, border, icon }) => (
              <div key={label} className={`bg-gray-900/60 backdrop-blur-xl border border-gray-800 rounded-2xl p-6 text-center shadow-lg ${border} transition-colors duration-300 relative overflow-hidden group`}>
                <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">{icon}</div>
                <h3 className={`text-4xl font-extrabold ${color} mb-2`}>{value}</h3>
                <p className="text-gray-400 font-medium tracking-wide text-sm">{label}</p>
              </div>
            ))}
          </section>

          {/* ── Admin Quick Stats (admin only) ──────────────────────────────── */}
          {isAdmin && (
            <section>
              <div className="mb-6 flex items-center gap-3">
                <h2 className="text-2xl font-bold text-white">Admin Overview</h2>
                <span className="text-xs font-semibold px-3 py-1 rounded-full bg-violet-500/10 text-violet-300 border border-violet-500/20">
                  Only visible to admins
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div className="bg-gray-900/60 border border-violet-800/30 rounded-2xl p-6 flex items-center gap-5 hover:border-violet-500/50 transition-colors">
                  <div className="w-12 h-12 rounded-xl bg-violet-500/10 flex items-center justify-center flex-shrink-0">
                    <svg className="w-6 h-6 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-widest font-semibold mb-1">Est. Inventory Value</p>
                    <p className="text-2xl font-extrabold text-violet-300">Rs {adminStats.totalRevenue.toLocaleString()}</p>
                  </div>
                </div>

                <div className="bg-gray-900/60 border border-amber-800/30 rounded-2xl p-6 flex items-center gap-5 hover:border-amber-500/50 transition-colors">
                  <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center flex-shrink-0">
                    <svg className="w-6 h-6 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-widest font-semibold mb-1">Low Stock Alerts</p>
                    <p className="text-2xl font-extrabold text-amber-300">{adminStats.lowStockCount} Products</p>
                  </div>
                </div>

                <div className="bg-gray-900/60 border border-red-800/30 rounded-2xl p-6 flex items-center gap-5 hover:border-red-500/50 transition-colors">
                  <div className="w-12 h-12 rounded-xl bg-red-500/10 flex items-center justify-center flex-shrink-0">
                    <svg className="w-6 h-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-widest font-semibold mb-1">Out of Stock</p>
                    <p className="text-2xl font-extrabold text-red-300">{adminStats.outOfStockCount} Products</p>
                  </div>
                </div>
              </div>

              {/* Admin Quick Actions */}
              <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: "Add Product", href: "/admin/products/new", icon: "➕" },
                  { label: "Post Update", href: "/admin/updates/new", icon: "📝" },
                  { label: "Manage Users", href: "/admin/users", icon: "👥" },
                  { label: "Social Links", href: "/admin/social", icon: "🔗" },
                ].map((action) => (
                  <Link
                    key={action.label}
                    href={action.href}
                    className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gray-900/60 border border-gray-800 hover:border-violet-500/40 hover:bg-violet-500/5 text-sm font-medium text-gray-300 hover:text-white transition-all duration-200"
                  >
                    <span>{action.icon}</span> {action.label}
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* ── Updates Section ─────────────────────────────────────────────── */}
          {updates.length > 0 && (
            <section>
              <div className="mb-8 border-b border-gray-800 pb-4 flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                  <h2 className="text-3xl font-bold text-white">Latest Updates</h2>
                  <p className="text-gray-400 mt-2">Platform announcements and snippets</p>
                </div>
                {/* Update type filter tabs */}
                <div className="flex items-center gap-2 flex-wrap">
                  {updateTypes.map((type) => (
                    <button
                      key={type}
                      onClick={() => setActiveUpdateType(type)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all border ${
                        activeUpdateType === type
                          ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                          : "bg-gray-900/60 text-gray-400 border-gray-800 hover:border-gray-600"
                      }`}
                    >
                      {type === "all" ? `All (${updates.length})` : `${updateTypeIcons[type] || ""} ${type}`}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {filteredUpdates.map((update) => {
                  const priority = update.priority || "low";
                  const type = update.type || "announcement";
                  return (
                    <div key={update.id} className="bg-gray-900/40 backdrop-blur-md border border-gray-800 rounded-2xl p-6 hover:border-emerald-500/50 transition-colors relative overflow-hidden group">
                      {/* Priority ribbon */}
                      {update.priority && (
                        <div className={`absolute top-0 right-0 text-[10px] font-bold uppercase px-2.5 py-1 rounded-bl-xl border-l border-b ${priorityColors[priority]}`}>
                          {priority}
                        </div>
                      )}

                      <div className="flex items-start justify-between mb-3 pr-16">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{updateTypeIcons[type] || "📣"}</span>
                          <h3 className="text-xl font-bold text-white leading-tight">{update.info}</h3>
                        </div>
                      </div>

                      {update.created_at && (
                        <p className="text-xs text-gray-600 mb-3">
                          {new Date(update.created_at).toLocaleDateString("en-US", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </p>
                      )}

                      <p className="text-gray-300 text-sm leading-relaxed whitespace-pre-wrap mb-4">{update.content}</p>

                      <div className="flex items-center justify-between mt-auto pt-2 border-t border-gray-800/60">
                        {update.link ? (
                          <a
                            href={update.link.startsWith("http") ? update.link : `https://${update.link}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-emerald-400 hover:text-emerald-300 text-sm font-medium inline-flex items-center gap-1 transition-colors"
                          >
                            Read more ↗
                          </a>
                        ) : (
                          <span />
                        )}
                        {isAdmin && (
                          <Link href={`/admin/updates/${update.id}/edit`} className="text-xs text-gray-600 hover:text-violet-400 transition-colors flex items-center gap-1">
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                            Edit
                          </Link>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* ── Social Profiles Section ─────────────────────────────────────── */}
          {socialProfiles.length > 0 && (
            <section>
              <div className="mb-8 border-b border-gray-800 pb-4">
                <h2 className="text-3xl font-bold text-white">Connect With Us</h2>
                <p className="text-gray-400 mt-2">Find us across different platforms</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {socialProfiles.map((profile) => (
                  <div key={profile.id} className="group bg-gray-900/40 backdrop-blur-md border border-gray-800 rounded-2xl p-5 hover:border-indigo-500/50 transition-all duration-300 flex flex-col relative">
                    {/* Active/Inactive badge */}
                    {profile.is_active !== undefined && (
                      <span
                        className={`absolute top-4 right-4 w-2.5 h-2.5 rounded-full ${
                          profile.is_active ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]" : "bg-gray-600"
                        }`}
                        title={profile.is_active ? "Active" : "Inactive"}
                      />
                    )}

                    <div className="flex items-center gap-4 mb-4">
                      {profile.platform_icon ? (
                        <Image
                          src={profile.platform_icon}
                          alt={profile.platform_name}
                          width={48}
                          height={48}
                          unoptimized
                          className="w-12 h-12 rounded-xl object-cover bg-gray-800 border border-gray-700"
                          onError={(e) => {
                            console.error('Social icon failed to load:', profile.platform_icon);
                            (e.target as HTMLImageElement).src = `https://placehold.co/48x48/1f2937/9ca3af?text=${profile.platform_name.charAt(0).toUpperCase()}`;
                          }}
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-gray-800 to-gray-700 border border-gray-600 flex items-center justify-center text-xl font-bold text-gray-300">
                          {profile.platform_name.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className="overflow-hidden">
                        <h3 className="text-lg font-bold text-white truncate">{profile.platform_name}</h3>
                        {profile.username && <p className="text-sm text-gray-400 truncate">@{profile.username}</p>}
                      </div>
                    </div>

                    {profile.description && (
                      <p className="text-sm text-gray-400 mb-4 line-clamp-3 flex-1">{profile.description}</p>
                    )}

                    {/* Followers count if available */}
                    {profile.followers !== undefined && profile.followers > 0 && (
                      <p className="text-xs text-gray-500 mb-4">
                        <span className="font-semibold text-gray-300">{profile.followers.toLocaleString()}</span> followers
                      </p>
                    )}

                    <div className="mt-auto flex gap-2">
                      <a
                        href={profile.profile_link.startsWith("http") ? profile.profile_link : `https://${profile.profile_link}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 text-center bg-gray-800 hover:bg-indigo-600 text-white py-2.5 rounded-xl text-sm font-medium transition-all border border-gray-700 hover:border-indigo-500"
                      >
                        Visit Profile
                      </a>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(profile.profile_link);
                          showToast("Profile link copied!");
                        }}
                        className="w-10 h-10 flex items-center justify-center rounded-xl bg-gray-800 border border-gray-700 hover:border-indigo-500/50 hover:bg-indigo-500/10 text-gray-400 hover:text-indigo-400 transition-all"
                        title="Copy Profile Link"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                      </button>
                      {isAdmin && (
                        <Link
                          href={`/admin/social/${profile.id}/edit`}
                          className="w-10 h-10 flex items-center justify-center rounded-xl bg-gray-800 border border-gray-700 hover:border-violet-500/50 hover:bg-violet-500/10 text-gray-400 hover:text-violet-400 transition-all"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </Link>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* ── Products Section ────────────────────────────────────────────── */}
          {products.length > 0 && (
            <section>
              <div className="mb-6 border-b border-gray-800 pb-4 flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                  <h2 className="text-3xl font-bold text-white">Featured Products</h2>
                  <p className="text-gray-400 mt-2">Explore our latest available items</p>
                </div>
                <div className="text-sm font-medium bg-indigo-500/10 text-indigo-400 px-4 py-2 rounded-full border border-indigo-500/20 w-fit flex items-center shadow-inner">
                  <span className="w-2 h-2 rounded-full bg-indigo-400 mr-2 animate-pulse" />
                  {products.length} Total Items Available
                </div>
              </div>

              {/* Search + Filter + Sort bar */}
              <div className="flex flex-col sm:flex-row gap-3 mb-6">
                {/* Search */}
                <div className="relative flex-1">
                  <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input
                    type="text"
                    placeholder="Search products..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-gray-900/60 border border-gray-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500/50 transition-colors"
                  />
                </div>

                {/* Stock filter */}
                <div className="flex gap-2 flex-wrap">
                  {[
                    { key: "all", label: "All" },
                    { key: "in_stock", label: "In Stock" },
                    { key: "low", label: "Low" },
                    { key: "out", label: "Out" },
                  ].map((f) => (
                    <button
                      key={f.key}
                      onClick={() => setProductFilter(f.key as typeof productFilter)}
                      className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-all ${
                        productFilter === f.key
                          ? "bg-indigo-500/15 text-indigo-300 border-indigo-500/30"
                          : "bg-gray-900/60 text-gray-500 border-gray-800 hover:border-gray-600"
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>

                {/* Sort */}
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                  className="bg-gray-900/60 border border-gray-800 rounded-xl px-3 py-2.5 text-xs text-gray-400 focus:outline-none focus:border-indigo-500/50 transition-colors cursor-pointer"
                >
                  <option value="newest">Newest</option>
                  <option value="price_asc">Price: Low → High</option>
                  <option value="price_desc">Price: High → Low</option>
                  <option value="stock">Most Stock</option>
                </select>
              </div>

              {filteredProducts.length === 0 ? (
                <div className="text-center py-16 text-gray-600">
                  <p className="text-4xl mb-3">🔍</p>
                  <p className="font-medium">No products match your filters.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredProducts.map((product) => (
                    <div
                      key={product.id}
                      className="group bg-gray-900/40 backdrop-blur-md border border-gray-800 rounded-2xl overflow-hidden hover:border-gray-700 transition-all duration-300 hover:shadow-2xl hover:shadow-black/50 flex flex-col"
                    >
                      <div className="aspect-[4/3] w-full bg-gray-800 relative overflow-hidden">
                        {product.image ? (
                          <Image
                            key={product.image}
                            src={product.image.replace('/object/public/', '/render/image/public/')}
                            alt={product.name}
                            fill
                            unoptimized
                            className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-500"
                            onError={(e) => {
                              console.error('Image failed to load:', product.image);
                              (e.target as HTMLImageElement).src = "https://placehold.co/400x300/1f2937/9ca3af?text=Image+Not+Found";
                            }}
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-600 text-sm">No Image</div>
                        )}
                        <div className="absolute top-3 right-3 bg-black/70 backdrop-blur-md text-white px-3 py-1 rounded-full text-sm font-bold border border-gray-700 shadow-lg">
                          Rs {product.price.toLocaleString()}
                        </div>
                        {product.stock === 0 && (
                          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                            <span className="bg-red-500/90 text-white text-xs font-bold px-3 py-1.5 rounded-full uppercase tracking-wider">
                              Out of Stock
                            </span>
                          </div>
                        )}
                        {/* Interactive Hover Overlay */}
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center gap-3 z-20">
                          <button onClick={() => setQuickViewProduct(product)} className="bg-white/90 hover:bg-white text-black px-4 py-2 rounded-full text-sm font-bold shadow-lg transform translate-y-4 group-hover:translate-y-0 transition-all duration-300">
                            Quick View
                          </button>
                          <button onClick={() => handleCopyLink(product.id)} className="bg-gray-800/90 hover:bg-gray-700 text-white w-9 h-9 flex items-center justify-center rounded-full shadow-lg transform translate-y-4 group-hover:translate-y-0 transition-all duration-300 delay-75" title="Copy Link">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
                          </button>
                        </div>
                      </div>

                      <div className="p-5 flex flex-col flex-1">
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <h3 className="text-lg font-bold text-white line-clamp-1 flex-1">{product.name}</h3>
                          {isAdmin && (
                            <Link
                              href={`/admin/products/${product.id}/edit`}
                              className="flex-shrink-0 text-gray-600 hover:text-violet-400 transition-colors"
                              title="Edit product"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </Link>
                          )}
                        </div>

                        {product.category && (
                          <span className="text-[10px] font-semibold uppercase tracking-widest text-indigo-400/70 mb-2">
                            {product.category}
                          </span>
                        )}

                        <p className="text-sm text-gray-400 line-clamp-2 mb-4 flex-1">
                          {product.description || "No description provided."}
                        </p>

                        <div className="flex items-center justify-between">
                          <StockBadge stock={product.stock} />
                          {product.created_at && (
                            <span className="text-xs text-gray-600">
                              {new Date(product.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

        </div>
      )}

      {/* ── Footer ──────────────────────────────────────────────────────────── */}
      <footer className="border-t border-gray-800/60 mt-24 py-10 text-center text-gray-600 text-sm">
        <p>
          &copy; {new Date().getFullYear()} Platform. Built with{" "}
          <span className="text-rose-500">♥</span>{" "}
          using Next.js &amp; Supabase.
        </p>
        {isAdmin && (
          <p className="mt-2 text-violet-700 text-xs">
            Admin mode active — edit controls are visible.
          </p>
        )}
      </footer>

      {/* ── Modals & Toasts ─────────────────────────────────────────────────── */}
      {quickViewProduct && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 backdrop-blur-sm bg-black/70 transition-all animate-in fade-in duration-200" onClick={closeQuickView}>
          <div className="bg-gray-900 border border-gray-700 rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col md:flex-row relative" onClick={e => e.stopPropagation()}>
            <button onClick={closeQuickView} className="absolute top-4 right-4 z-10 w-8 h-8 flex items-center justify-center rounded-full bg-black/50 hover:bg-rose-500 text-white backdrop-blur-md transition-colors border border-gray-600 hover:border-rose-400">✕</button>
            
            <div className="w-full md:w-1/2 aspect-square md:aspect-auto relative bg-gray-800">
              {quickViewProduct.image ? (
                <Image src={quickViewProduct.image.replace('/object/public/', '/render/image/public/')} alt={quickViewProduct.name} fill unoptimized className="object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-500">No Image Available</div>
              )}
              <div className="absolute top-4 left-4 bg-black/70 backdrop-blur-md text-white px-4 py-1.5 rounded-full text-sm font-bold border border-gray-700 shadow-lg">
                Rs {quickViewProduct.price.toLocaleString()}
              </div>
            </div>
            
            <div className="p-6 md:p-8 flex flex-col flex-1 max-h-full overflow-y-auto">
              <div className="flex items-center gap-2 mb-3 flex-wrap">
                {quickViewProduct.category && <span className="text-xs font-semibold uppercase tracking-widest text-indigo-400 bg-indigo-400/10 border border-indigo-400/20 px-3 py-1 rounded-lg">{quickViewProduct.category}</span>}
                <StockBadge stock={quickViewProduct.stock} />
              </div>
              
              <h2 className="text-3xl font-extrabold text-white mb-6 leading-tight">{quickViewProduct.name}</h2>
              
              <div className="flex-1 mb-8">
                <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Product Description</h4>
                <p className="text-gray-300 leading-relaxed whitespace-pre-wrap text-sm">{quickViewProduct.description || "No description provided."}</p>
              </div>
              
              <div className="flex gap-3 mt-auto">
                <button onClick={() => handleCopyLink(quickViewProduct.id)} className="flex-1 bg-gray-800 hover:bg-gray-700 text-white font-semibold py-3 rounded-xl transition-all border border-gray-700 hover:border-gray-500 flex justify-center items-center gap-2">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
                  Copy Direct Link
                </button>
              </div>
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
    </main>
  );
}
