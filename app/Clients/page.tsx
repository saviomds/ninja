"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import Image from "next/image";
import Link from "next/link";
import { User } from "@supabase/supabase-js";
import Navbar from "@/components/Navbar";

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

interface OrderForm {
  name: string;
  email: string;
  phone: string;
  notes: string;
  quantity: number;
}

interface LightboxState {
  product: Product;
  rotation: number;
  zoom: number;
}

const PAGE_SIZE = 6;

function StockPill({ stock }: { stock: number }) {
  if (stock === 0)
    return (
      <span className="text-xs font-semibold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10 px-2.5 py-1 rounded-full border border-red-200 dark:border-red-500/20">
        Sold out
      </span>
    );
  if (stock <= 5)
    return (
      <span className="text-xs font-semibold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 px-2.5 py-1 rounded-full border border-amber-200 dark:border-amber-500/20">
        Only {stock} left
      </span>
    );
  return (
    <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-200 dark:border-emerald-500/20">
      In stock
    </span>
  );
}

const MARQUEE_ITEMS = [
  "⚡ Fast Delivery",
  "🔒 Secure Orders",
  "💬 24/7 Support",
  "✨ Premium Quality",
  "🚀 Quick Dispatch",
  "🌟 Best Prices",
];

function imgSrc(url: string) {
  return url.replace("/object/public/", "/render/image/public/");
}

export default function ClientsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [toast, setToast] = useState<{ msg: string; type?: "success" | "error" } | null>(null);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [quickView, setQuickView] = useState<Product | null>(null);
  const [lightbox, setLightbox] = useState<LightboxState | null>(null);
  const [orderProduct, setOrderProduct] = useState<Product | null>(null);
  const [orderForm, setOrderForm] = useState<OrderForm>({ name: "", email: "", phone: "", notes: "", quantity: 1 });
  const [orderLoading, setOrderLoading] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(false);
  const [wishlist, setWishlist] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState<"default" | "price-asc" | "price-desc">("default");
  const [recentlyViewed, setRecentlyViewed] = useState<Product[]>([]);
  const [showScrollTop, setShowScrollTop] = useState(false);

  const catScrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const isAdmin = (user?.app_metadata?.role || user?.user_metadata?.role) === "admin";

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  // ── Data loading ─────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      const [{ data: prods }, authRes] = await Promise.all([
        supabase.from("products").select("*").order("created_at", { ascending: false }),
        supabase.auth.getUser(),
      ]);
      const list: Product[] = prods || [];
      setProducts(list);
      setUser(authRes.data?.user ?? null);
      const cats = Array.from(new Set(list.map((p) => p.category).filter(Boolean))) as string[];
      setCategories(cats);
      setLoading(false);
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  // ── Category scroll arrows ───────────────────────────────────────────────
  const checkScrollArrows = useCallback(() => {
    const el = catScrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, []);

  useEffect(() => {
    checkScrollArrows();
    const el = catScrollRef.current;
    if (el) el.addEventListener("scroll", checkScrollArrows);
    window.addEventListener("resize", checkScrollArrows);
    return () => {
      el?.removeEventListener("scroll", checkScrollArrows);
      window.removeEventListener("resize", checkScrollArrows);
    };
  }, [categories, checkScrollArrows]);

  // ── Keyboard shortcuts (lightbox) ────────────────────────────────────────
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setLightbox(null); setQuickView(null); }
      if (e.key === "ArrowLeft")
        setLightbox((prev) => (prev ? { ...prev, rotation: prev.rotation - 90 } : null));
      if (e.key === "ArrowRight")
        setLightbox((prev) => (prev ? { ...prev, rotation: prev.rotation + 90 } : null));
      if (e.key === "+" || e.key === "=")
        setLightbox((prev) => (prev ? { ...prev, zoom: Math.min(4, prev.zoom * 1.2) } : null));
      if (e.key === "-")
        setLightbox((prev) => (prev ? { ...prev, zoom: Math.max(0.25, prev.zoom * 0.8) } : null));
      if (e.key === "0")
        setLightbox((prev) => (prev ? { ...prev, rotation: 0, zoom: 1 } : null));
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  // ── Scroll to top button ─────────────────────────────────────────────────
  useEffect(() => {
    const onScroll = () => setShowScrollTop(window.scrollY > 500);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // ── Wheel zoom in lightbox ────────────────────────────────────────────────
  const lightboxAreaRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = lightboxAreaRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!lightbox) return;
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.1 : 0.9;
      setLightbox((prev) => (prev ? { ...prev, zoom: Math.max(0.25, Math.min(4, prev.zoom * factor)) } : null));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  });

  const scrollCats = (dir: "left" | "right") => {
    const el = catScrollRef.current;
    if (el) el.scrollBy({ left: dir === "left" ? -200 : 200, behavior: "smooth" });
  };

  const toggleWishlist = (id: string) => {
    setWishlist((prev) => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); showToast("Removed from wishlist"); }
      else { next.add(id); showToast("Added to wishlist ♥"); }
      return next;
    });
  };

  const trackView = (product: Product) => {
    setRecentlyViewed((prev) => {
      const filtered = prev.filter((p) => p.id !== product.id);
      return [product, ...filtered].slice(0, 5);
    });
  };

  const openLightbox = (product: Product) => {
    setLightbox({ product, rotation: 0, zoom: 1 });
    trackView(product);
  };

  const isNew = (p: Product) => {
    if (!p.created_at) return false;
    return Date.now() - new Date(p.created_at).getTime() < 7 * 24 * 60 * 60 * 1000;
  };

  const copyShare = (product: Product) => {
    const url = `${window.location.origin}/Clients?q=${encodeURIComponent(product.name)}`;
    navigator.clipboard.writeText(url).then(() => showToast("Link copied!")).catch(() => showToast("Could not copy link", "error"));
  };

  const filtered = products.filter((p) => {
    const matchCat = selectedCategory === "all" || p.category === selectedCategory;
    const matchSearch =
      !search.trim() ||
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.description || "").toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === "price-asc") return a.price - b.price;
    if (sortBy === "price-desc") return b.price - a.price;
    return 0;
  });

  const visible = sorted.slice(0, visibleCount);

  const categoryCounts = products.reduce(
    (acc, p) => {
      acc["all"] = (acc["all"] || 0) + 1;
      if (p.category) acc[p.category] = (acc[p.category] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  const openOrder = (product: Product) => {
    setOrderProduct(product);
    setOrderForm({ name: "", email: user?.email || "", phone: "", notes: "", quantity: 1 });
    setOrderSuccess(false);
  };

  const handlePlaceOrder = async () => {
    if (!orderProduct) return;
    if (!orderForm.name.trim() || !orderForm.email.trim()) {
      showToast("Name and email are required", "error");
      return;
    }
    setOrderLoading(true);
    const { error } = await supabase.from("orders").insert({
      product_id: orderProduct.id,
      product_name: orderProduct.name,
      quantity: orderForm.quantity,
      price: orderProduct.price * orderForm.quantity,
      client_name: orderForm.name.trim(),
      client_email: orderForm.email.trim(),
      client_phone: orderForm.phone.trim() || null,
      notes: orderForm.notes.trim() || null,
      status: "pending",
    });
    setOrderLoading(false);
    if (error) showToast("Failed to place order. Please try again.", "error");
    else setOrderSuccess(true);
  };

  return (
    <div className="min-h-screen bg-white dark:bg-[#030712] text-gray-900 dark:text-white">
      <Navbar />

      {/* ── Hero ───────────────────────────────────────────────────────────── */}
      <section className="relative pt-20 pb-20 text-center px-6 overflow-hidden">
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-[900px] h-[500px] bg-blue-600/[0.05] dark:bg-blue-600/[0.07] rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-0 left-0 w-80 h-80 bg-violet-600/[0.03] dark:bg-violet-600/[0.04] rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-0 right-0 w-80 h-80 bg-blue-500/[0.03] dark:bg-blue-500/[0.04] rounded-full blur-3xl pointer-events-none" />
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ backgroundImage: "radial-gradient(circle,rgba(0,0,0,0.04) 1px,transparent 1px)", backgroundSize: "32px 32px" }}
        />

        <div className="relative z-10">
          {/* Animated logo showcase */}
          <div className="mb-10 flex justify-center">
            <div className="relative animate-float">
              <div className="absolute -inset-6 rounded-[3rem] bg-gradient-to-r from-blue-600/10 to-purple-600/10 blur-2xl animate-glow-pulse" />
              <div className="absolute -inset-4 rounded-[2.8rem] border border-blue-500/15 animate-spin-slow" />
              <div className="absolute -inset-2 rounded-[2.5rem] border border-dashed border-purple-500/10 animate-spin-slow-reverse" />
              <div className="relative w-36 h-36 sm:w-44 sm:h-44 bg-gradient-to-br from-[#0b1f3a] to-[#0a1628] border border-blue-500/30 rounded-[2.2rem] shadow-2xl shadow-blue-900/30 z-10 flex items-center justify-center">
                <Image
                  src="/logo.png"
                  alt="Tech Ninja"
                  fill
                  unoptimized
                  className="object-contain p-5"
                  style={{ filter: "drop-shadow(0 0 12px rgba(96,165,250,0.4)) drop-shadow(0 2px 8px rgba(255,255,255,0.1))" }}
                />
              </div>
              <div className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-blue-400 shadow-lg shadow-blue-400/60 z-20" />
              <div className="absolute -bottom-1 -left-1 w-2.5 h-2.5 rounded-full bg-purple-400 shadow-lg shadow-purple-400/60 z-20" />
            </div>
          </div>

          <span className="inline-flex items-center gap-2 text-xs font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-400/10 border border-blue-200 dark:border-blue-400/15 px-4 py-1.5 rounded-full mb-6 uppercase tracking-widest">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 dark:bg-blue-400 animate-pulse" />
            New arrivals
          </span>

          <h1 className="text-5xl sm:text-7xl md:text-8xl font-bold tracking-tight leading-none mb-5">
            <span className="text-gray-900 dark:text-white">Our </span>
            <span
              style={{
                background: "linear-gradient(135deg,#3b82f6,#8b5cf6,#3b82f6)",
                backgroundSize: "200% 200%",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
                animation: "gradient-shift 3s ease infinite",
              }}
            >
              Collection.
            </span>
          </h1>

          <p className="text-lg sm:text-xl text-gray-500 dark:text-white/40 max-w-xl mx-auto leading-relaxed mb-10">
            Premium products, each crafted with intention and built to last.
          </p>

          <div className="flex items-center justify-center gap-3 flex-wrap">
            <a
              href="#products"
              className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white font-semibold px-8 py-3.5 rounded-full text-sm transition-all shadow-xl shadow-blue-700/25 hover:shadow-blue-600/35 hover:-translate-y-0.5"
            >
              Shop now →
            </a>
            {!user && (
              <Link href="/login" className="bg-gray-100 dark:bg-white/[0.05] border border-gray-200 dark:border-white/[0.1] text-gray-700 dark:text-white font-semibold px-8 py-3.5 rounded-full text-sm hover:bg-gray-200 dark:hover:bg-white/[0.1] transition-all">
                Sign in
              </Link>
            )}
          </div>
        </div>
      </section>

      {/* ── Marquee ─────────────────────────────────────────────────────────── */}
      <div className="border-y border-gray-100 dark:border-white/[0.05] py-4 overflow-hidden bg-gray-50 dark:bg-white/[0.01]">
        <div className="flex animate-marquee" style={{ width: "max-content" }}>
          {[...Array(4)].flatMap(() => MARQUEE_ITEMS).map((item, i) => (
            <span key={i} className="flex items-center text-xs text-gray-400 dark:text-white/20 font-medium px-8 whitespace-nowrap">
              {item}
              <span className="text-gray-200 dark:text-white/10 ml-8">·</span>
            </span>
          ))}
        </div>
      </div>

      {/* ── Search + Sort ───────────────────────────────────────────────────── */}
      <div className="max-w-4xl mx-auto px-5 mt-10 mb-6 flex gap-3 items-center">
        <div className="relative flex-1">
          <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-white/25" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setVisibleCount(PAGE_SIZE); }}
            placeholder="Search products…"
            className="w-full bg-gray-100 dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.08] rounded-full pl-11 pr-5 py-3 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-white/25 focus:outline-none focus:ring-1 focus:ring-blue-500/40 focus:border-blue-500/40 transition"
          />
          {search && (
            <button onClick={() => { setSearch(""); setVisibleCount(PAGE_SIZE); }} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 dark:text-white/30 hover:text-gray-700 dark:hover:text-white transition-colors text-base leading-none">✕</button>
          )}
        </div>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as "default" | "price-asc" | "price-desc")}
          className="bg-gray-100 dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.08] text-gray-600 dark:text-white/50 text-sm rounded-full px-5 py-3 focus:outline-none focus:border-blue-500/40 cursor-pointer transition flex-shrink-0"
        >
          <option value="default">Sort</option>
          <option value="price-asc">Price ↑</option>
          <option value="price-desc">Price ↓</option>
        </select>
      </div>

      {/* ── Category scroll ─────────────────────────────────────────────────── */}
      <div className="max-w-6xl mx-auto px-5 mb-8 relative">
        {canScrollLeft && (
          <button onClick={() => scrollCats("left")} className="absolute left-2 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-gray-100 dark:bg-white/[0.08] border border-gray-200 dark:border-white/[0.1] flex items-center justify-center text-gray-600 dark:text-white/50 hover:bg-gray-200 dark:hover:bg-white/[0.15] hover:text-gray-900 dark:hover:text-white transition-all">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          </button>
        )}
        {canScrollRight && (
          <button onClick={() => scrollCats("right")} className="absolute right-2 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-gray-100 dark:bg-white/[0.08] border border-gray-200 dark:border-white/[0.1] flex items-center justify-center text-gray-600 dark:text-white/50 hover:bg-gray-200 dark:hover:bg-white/[0.15] hover:text-gray-900 dark:hover:text-white transition-all">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
          </button>
        )}
        <div ref={catScrollRef} className="flex gap-2 overflow-x-auto px-1 py-1" style={{ scrollbarWidth: "none" }}>
          {["all", ...categories].map((cat) => (
            <button
              key={cat}
              onClick={() => { setSelectedCategory(cat); setVisibleCount(PAGE_SIZE); }}
              className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-all whitespace-nowrap flex items-center gap-2 ${
                selectedCategory === cat
                  ? "bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg shadow-blue-700/25"
                  : "bg-gray-100 dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.08] text-gray-600 dark:text-white/45 hover:text-gray-900 dark:hover:text-white hover:border-gray-400 dark:hover:border-white/20 hover:bg-gray-200 dark:hover:bg-white/[0.08]"
              }`}
            >
              {cat === "all" ? "All Products" : cat}
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${selectedCategory === cat ? "bg-white/20 text-white" : "bg-gray-200 dark:bg-white/[0.08] text-gray-500 dark:text-white/30"}`}>
                {categoryCounts[cat] || 0}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Recently viewed ─────────────────────────────────────────────────── */}
      {recentlyViewed.length > 1 && (
        <div className="max-w-6xl mx-auto px-5 mb-8">
          <p className="text-xs text-gray-400 dark:text-white/20 uppercase tracking-widest mb-3 flex items-center gap-2">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            Recently viewed
          </p>
          <div className="flex gap-3">
            {recentlyViewed.map((p) => (
              <button
                key={p.id}
                onClick={() => openLightbox(p)}
                title={p.name}
                className="flex-shrink-0 w-14 h-14 rounded-xl overflow-hidden bg-gray-100 dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.08] hover:border-blue-400 dark:hover:border-blue-500/40 transition-all hover:scale-105 relative"
              >
                {p.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={imgSrc(p.image)} alt={p.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-300 dark:text-white/15 text-xs">?</div>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Products grid ───────────────────────────────────────────────────── */}
      <main id="products" className="max-w-6xl mx-auto px-5 pb-16">
        {!loading && (
          <p className="text-xs text-gray-400 dark:text-white/20 mb-6 text-center tracking-widest uppercase">
            {filtered.length} product{filtered.length !== 1 ? "s" : ""}
            {selectedCategory !== "all" ? ` in ${selectedCategory}` : ""}
          </p>
        )}

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-gray-50 dark:bg-white/[0.03] border border-gray-100 dark:border-white/[0.05] rounded-3xl overflow-hidden">
                <div className="aspect-square bg-gray-100 dark:bg-white/[0.03] animate-pulse" />
                <div className="p-5 space-y-3">
                  <div className="h-3 bg-gray-100 dark:bg-white/[0.05] rounded-full w-1/3 animate-pulse" />
                  <div className="h-5 bg-gray-100 dark:bg-white/[0.05] rounded-full w-3/4 animate-pulse" />
                  <div className="h-4 bg-gray-100 dark:bg-white/[0.05] rounded-full w-1/2 animate-pulse" />
                  <div className="h-10 bg-gray-100 dark:bg-white/[0.05] rounded-2xl mt-2 animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-32">
            <div className="text-6xl mb-6">🔍</div>
            <p className="text-xl font-semibold text-gray-400 dark:text-white/30 mb-2">No products found</p>
            <p className="text-sm text-gray-400 dark:text-white/20">Try adjusting your search or filters</p>
            {search && (
              <button onClick={() => setSearch("")} className="mt-6 text-blue-600 dark:text-blue-400 text-sm hover:text-blue-700 dark:hover:text-blue-300 underline transition-colors">
                Clear search
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {visible.map((product, index) => (
                <article
                  key={product.id}
                  className="group relative bg-white dark:bg-white/[0.03] border border-gray-100 dark:border-white/[0.06] rounded-3xl overflow-hidden hover:bg-gray-50 dark:hover:bg-white/[0.055] hover:border-gray-200 dark:hover:border-white/[0.1] transition-all duration-300 hover:-translate-y-1.5 hover:shadow-xl dark:hover:shadow-2xl dark:hover:shadow-blue-500/[0.08] animate-fade-in-up shadow-sm dark:shadow-none"
                  style={{ animationDelay: `${Math.min(index * 0.07, 0.5)}s` }}
                >
                  {/* Image — click opens full lightbox */}
                  <div className="aspect-square bg-gray-50 dark:bg-white/[0.02] relative overflow-hidden cursor-zoom-in" onClick={() => openLightbox(product)}>
                    {product.image ? (
                      <Image
                        src={imgSrc(product.image)}
                        alt={product.name}
                        fill
                        unoptimized
                        className="object-cover group-hover:scale-110 transition-transform duration-700"
                        onError={(e) => { (e.target as HTMLImageElement).src = "https://placehold.co/600x600/f3f4f6/9ca3af?text=No+Image"; }}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-300 dark:text-white/15 text-sm">No image</div>
                    )}

                    {product.stock === 0 && (
                      <div className="absolute inset-0 bg-white/70 dark:bg-black/70 backdrop-blur-[2px] flex items-center justify-center">
                        <span className="text-xs font-bold uppercase tracking-widest text-gray-500 dark:text-white/60 border border-gray-200 dark:border-white/15 bg-white dark:bg-transparent px-4 py-2 rounded-full">Sold out</span>
                      </div>
                    )}

                    {isNew(product) && (
                      <div className="absolute top-3 left-3 z-10">
                        <span className="text-[10px] font-bold uppercase tracking-widest bg-blue-500 text-white px-2.5 py-1 rounded-full shadow-lg shadow-blue-500/30">New</span>
                      </div>
                    )}

                    <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end justify-center pb-4">
                      <span className="text-xs font-medium bg-white/15 backdrop-blur-md text-white px-4 py-1.5 rounded-full border border-white/20 translate-y-3 group-hover:translate-y-0 transition-transform duration-300 flex items-center gap-1.5">
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                        View image
                      </span>
                    </div>
                  </div>

                  {/* Card content */}
                  <div className="p-5">
                    <div className="flex items-start justify-between mb-1.5">
                      {product.category ? (
                        <p className="text-xs font-semibold uppercase tracking-widest text-blue-600 dark:text-blue-400">{product.category}</p>
                      ) : <span />}
                      <div className="flex items-center gap-1.5">
                        <button onClick={() => copyShare(product)} className="w-6 h-6 rounded-full flex items-center justify-center text-gray-300 dark:text-white/20 hover:text-gray-600 dark:hover:text-white/60 transition-colors" title="Copy link">
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); toggleWishlist(product.id); }}
                          className={`w-6 h-6 rounded-full flex items-center justify-center transition-all ${wishlist.has(product.id) ? "text-red-500" : "text-gray-300 dark:text-white/20 hover:text-red-400"}`}
                          title="Wishlist"
                        >
                          <svg className="w-3.5 h-3.5" fill={wishlist.has(product.id) ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                          </svg>
                        </button>
                      </div>
                    </div>

                    <h2 className="text-base font-semibold text-gray-900 dark:text-white leading-snug mb-1 line-clamp-1">{product.name}</h2>
                    <p className="text-sm text-gray-500 dark:text-white/35 line-clamp-2 mb-4 leading-relaxed">{product.description || "—"}</p>

                    <div className="flex items-center justify-between mb-4">
                      <span className="text-xl font-bold text-gray-900 dark:text-white">Rs {product.price.toLocaleString()}</span>
                      <StockPill stock={product.stock} />
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => openLightbox(product)}
                        className="flex-1 bg-gray-100 dark:bg-white/[0.05] border border-gray-200 dark:border-white/[0.08] hover:bg-gray-200 dark:hover:bg-white/[0.1] text-gray-600 dark:text-white/60 hover:text-gray-900 dark:hover:text-white font-medium py-2.5 rounded-2xl transition-all text-sm"
                      >
                        View
                      </button>
                      <button
                        onClick={() => openOrder(product)}
                        disabled={product.stock === 0}
                        className="flex-[2] bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 disabled:opacity-25 disabled:cursor-not-allowed text-white font-semibold py-2.5 rounded-2xl transition-all text-sm shadow-lg shadow-blue-700/20"
                      >
                        Order now
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>

            {visibleCount < sorted.length && (
              <div className="text-center mt-12">
                <button
                  onClick={() => setVisibleCount((v) => v + PAGE_SIZE)}
                  className="bg-gray-100 dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.08] text-gray-900 dark:text-white font-semibold px-10 py-3.5 rounded-full text-sm hover:bg-gray-200 dark:hover:bg-white/[0.08] hover:border-gray-300 dark:hover:border-white/[0.15] transition-all"
                >
                  Load more · {sorted.length - visibleCount} remaining
                </button>
              </div>
            )}
          </>
        )}
      </main>

      {/* ── Features strip ──────────────────────────────────────────────────── */}
      <section className="border-t border-gray-100 dark:border-white/[0.05] py-16 bg-gray-50 dark:bg-transparent">
        <div className="max-w-5xl mx-auto px-5 grid grid-cols-1 sm:grid-cols-3 gap-6">
          {[
            { icon: "🚀", title: "Fast delivery", desc: "Get your orders delivered quickly across Mauritius.", g: "from-blue-50 dark:from-blue-500/10 to-blue-50/50 dark:to-blue-600/5", b: "border-blue-100 dark:border-blue-500/15" },
            { icon: "🔒", title: "Secure ordering", desc: "Your details protected with industry-standard encryption.", g: "from-purple-50 dark:from-purple-500/10 to-purple-50/50 dark:to-purple-600/5", b: "border-purple-100 dark:border-purple-500/15" },
            { icon: "💬", title: "Real-time support", desc: "Our team is always available to help with your order.", g: "from-emerald-50 dark:from-emerald-500/10 to-emerald-50/50 dark:to-emerald-600/5", b: "border-emerald-100 dark:border-emerald-500/15" },
          ].map(({ icon, title, desc, g, b }) => (
            <div key={title} className={`flex flex-col items-center gap-4 p-7 rounded-2xl bg-gradient-to-br ${g} border ${b} text-center`}>
              <span className="text-4xl">{icon}</span>
              <h3 className="text-base font-semibold text-gray-900 dark:text-white">{title}</h3>
              <p className="text-sm text-gray-500 dark:text-white/35 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── LIGHTBOX ────────────────────────────────────────────────────────── */}
      {lightbox && (
        <div className="fixed inset-0 z-[150] bg-black/95 backdrop-blur-xl flex flex-col select-none">
          <div className="flex items-center justify-between px-4 sm:px-6 py-3 border-b border-white/[0.06] flex-shrink-0 bg-black/30">
            <div className="flex items-center gap-2.5 min-w-0">
              {lightbox.product.category && (
                <span className="hidden sm:block text-[10px] font-bold uppercase tracking-widest text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded-full flex-shrink-0">
                  {lightbox.product.category}
                </span>
              )}
              <h3 className="text-sm font-semibold text-white truncate">{lightbox.product.name}</h3>
              <span className="hidden sm:block text-sm font-bold text-white/50 flex-shrink-0">
                · Rs {lightbox.product.price.toLocaleString()}
              </span>
            </div>

            <div className="flex items-center gap-1.5 flex-shrink-0 ml-3">
              <button onClick={() => setLightbox((p) => p ? { ...p, rotation: p.rotation - 90 } : null)} className="w-9 h-9 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white/50 hover:text-white hover:bg-white/[0.1] transition-all flex items-center justify-center" title="Rotate left ←">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                </svg>
              </button>
              <button onClick={() => setLightbox((p) => p ? { ...p, rotation: p.rotation + 90 } : null)} className="w-9 h-9 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white/50 hover:text-white hover:bg-white/[0.1] transition-all flex items-center justify-center" title="Rotate right →">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 10h-10a8 8 0 00-8 8v2M21 10l-6 6m6-6l-6-6" />
                </svg>
              </button>
              <div className="w-px h-6 bg-white/10 mx-0.5" />
              <button onClick={() => setLightbox((p) => p ? { ...p, zoom: Math.max(0.25, p.zoom * 0.8) } : null)} className="w-9 h-9 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white/50 hover:text-white hover:bg-white/[0.1] transition-all flex items-center justify-center text-xl font-light leading-none" title="Zoom out −">−</button>
              <button onClick={() => setLightbox((p) => p ? { ...p, rotation: 0, zoom: 1 } : null)} className="w-12 text-center text-xs text-white/35 hover:text-white/70 transition-colors tabular-nums" title="Reset (0)">
                {Math.round(lightbox.zoom * 100)}%
              </button>
              <button onClick={() => setLightbox((p) => p ? { ...p, zoom: Math.min(4, p.zoom * 1.25) } : null)} className="w-9 h-9 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white/50 hover:text-white hover:bg-white/[0.1] transition-all flex items-center justify-center text-xl font-light leading-none" title="Zoom in +">+</button>
              <div className="w-px h-6 bg-white/10 mx-0.5" />
              <button onClick={() => toggleWishlist(lightbox.product.id)} className={`w-9 h-9 rounded-xl border transition-all flex items-center justify-center ${wishlist.has(lightbox.product.id) ? "bg-red-500/15 border-red-500/30 text-red-400" : "bg-white/[0.05] border-white/[0.08] text-white/50 hover:text-red-400 hover:border-red-500/20"}`} title="Wishlist">
                <svg className="w-4 h-4" fill={wishlist.has(lightbox.product.id) ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                </svg>
              </button>
              <button onClick={() => { setLightbox(null); openOrder(lightbox.product); }} disabled={lightbox.product.stock === 0} className="hidden sm:flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 disabled:opacity-30 disabled:cursor-not-allowed text-white text-xs font-semibold transition-all">
                Order now
              </button>
              <button onClick={() => setLightbox(null)} className="w-9 h-9 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white/50 hover:text-white hover:bg-red-500/15 hover:border-red-500/20 transition-all flex items-center justify-center" title="Close Esc">✕</button>
            </div>
          </div>

          <div ref={lightboxAreaRef} className="flex-1 flex items-center justify-center overflow-hidden relative cursor-zoom-in" onClick={() => setLightbox(null)}>
            {lightbox.product.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={imgSrc(lightbox.product.image)}
                alt={lightbox.product.name}
                onClick={(e) => e.stopPropagation()}
                style={{
                  transform: `rotate(${lightbox.rotation}deg) scale(${lightbox.zoom})`,
                  transition: "transform 0.3s cubic-bezier(0.4,0,0.2,1)",
                  maxWidth: "88vw", maxHeight: "72vh", objectFit: "contain",
                  borderRadius: 16, boxShadow: "0 30px 80px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.05)",
                  cursor: lightbox.zoom > 1 ? "grab" : "zoom-in",
                }}
                onError={(e) => { (e.target as HTMLImageElement).src = "https://placehold.co/800x800/0b1f3a/374151?text=No+Image"; }}
              />
            ) : (
              <div className="w-72 h-72 bg-white/5 border border-white/10 rounded-3xl flex items-center justify-center text-white/20">No image</div>
            )}
            {lightbox.rotation !== 0 && (
              <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-black/50 backdrop-blur-sm border border-white/10 text-white/60 text-xs px-3 py-1.5 rounded-full pointer-events-none">
                {((lightbox.rotation % 360) + 360) % 360}°
              </div>
            )}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-[11px] text-white/20 pointer-events-none whitespace-nowrap hidden sm:block">
              Scroll to zoom · ← → rotate · 0 reset · Esc close
            </div>
          </div>

          <div className="flex items-center justify-between px-4 sm:px-6 py-3 border-t border-white/[0.06] flex-shrink-0 bg-black/30">
            <div className="flex items-center gap-3">
              <StockPill stock={lightbox.product.stock} />
              <span className="text-base font-bold text-white">Rs {lightbox.product.price.toLocaleString()}</span>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => copyShare(lightbox.product)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.05] border border-white/[0.08] text-white/40 hover:text-white text-xs font-medium transition-all">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
                Share
              </button>
              <button onClick={() => { setLightbox(null); openOrder(lightbox.product); }} disabled={lightbox.product.stock === 0} className="sm:hidden flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 disabled:opacity-30 disabled:cursor-not-allowed text-white text-xs font-semibold transition-all">
                Order now
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Quick view modal ────────────────────────────────────────────────── */}
      {quickView && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-6 bg-black/50 backdrop-blur-md" onClick={() => setQuickView(null)}>
          <div className="bg-white dark:bg-[#0d1117] border border-gray-100 dark:border-white/[0.08] w-full sm:max-w-2xl sm:rounded-3xl rounded-t-3xl overflow-hidden shadow-2xl flex flex-col sm:flex-row max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
            <div
              className="relative w-full sm:w-1/2 aspect-square bg-gray-50 dark:bg-white/[0.03] flex-shrink-0 cursor-zoom-in"
              onClick={() => { setQuickView(null); openLightbox(quickView); }}
            >
              {quickView.image ? (
                <Image src={imgSrc(quickView.image)} alt={quickView.name} fill unoptimized className="object-cover hover:scale-105 transition-transform duration-500" onError={(e) => { (e.target as HTMLImageElement).src = "https://placehold.co/600x600/f3f4f6/9ca3af?text=No+Image"; }} />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-300 dark:text-white/15 text-sm">No image</div>
              )}
              <div className="absolute bottom-3 right-3 bg-black/50 backdrop-blur-sm text-white/70 text-[10px] px-2.5 py-1 rounded-full border border-white/10">
                Click to enlarge
              </div>
            </div>
            <div className="flex flex-col flex-1 p-8 overflow-y-auto">
              <button onClick={() => setQuickView(null)} className="self-end w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 dark:bg-white/[0.05] hover:bg-gray-200 dark:hover:bg-white/[0.1] text-gray-500 dark:text-white/40 hover:text-gray-900 dark:hover:text-white transition-all mb-4 text-sm">✕</button>
              {quickView.category && <p className="text-xs font-semibold uppercase tracking-widest text-blue-600 dark:text-blue-400 mb-2">{quickView.category}</p>}
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white leading-tight mb-2">{quickView.name}</h2>
              <p className="text-3xl font-bold text-gray-900 dark:text-white mb-4">Rs {quickView.price.toLocaleString()}</p>
              <div className="mb-4"><StockPill stock={quickView.stock} /></div>
              <p className="text-sm text-gray-500 dark:text-white/40 leading-relaxed flex-1 mb-8 whitespace-pre-wrap">{quickView.description || "No description available."}</p>
              <button onClick={() => { setQuickView(null); openOrder(quickView); }} disabled={quickView.stock === 0} className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 disabled:opacity-25 disabled:cursor-not-allowed text-white font-semibold py-3.5 rounded-2xl transition-all text-sm">
                Order now
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Order modal ──────────────────────────────────────────────────────── */}
      {orderProduct && (
        <div className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center p-0 sm:p-6 bg-black/60 backdrop-blur-md" onClick={() => { setOrderProduct(null); setOrderSuccess(false); }}>
          <div className="bg-white dark:bg-[#0d1117] border border-gray-100 dark:border-white/[0.08] w-full sm:max-w-lg sm:rounded-3xl rounded-t-3xl overflow-hidden shadow-2xl max-h-[95vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            {orderSuccess ? (
              <div className="p-10 text-center space-y-4">
                <div className="w-16 h-16 rounded-full bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 flex items-center justify-center mx-auto">
                  <svg className="w-8 h-8 text-emerald-500 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white">Order placed!</h3>
                <p className="text-gray-500 dark:text-white/40 text-sm leading-relaxed">
                  Thank you, <strong className="text-gray-900 dark:text-white/70">{orderForm.name}</strong>! We&apos;ve received your order for{" "}
                  <strong className="text-gray-900 dark:text-white/70">{orderProduct.name}</strong> and will be in touch shortly.
                </p>
                <button onClick={() => { setOrderProduct(null); setOrderSuccess(false); }} className="mt-4 bg-gray-100 dark:bg-white/[0.05] border border-gray-200 dark:border-white/[0.1] text-gray-900 dark:text-white font-semibold px-8 py-3 rounded-2xl text-sm hover:bg-gray-200 dark:hover:bg-white/[0.1] transition-all">
                  Done
                </button>
              </div>
            ) : (
              <div className="p-6 sm:p-8">
                <div className="flex items-start justify-between mb-6">
                  <div>
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white">Place an order</h3>
                    <p className="text-sm text-gray-500 dark:text-white/30 mt-1">Fill in your details to complete</p>
                  </div>
                  <button onClick={() => { setOrderProduct(null); setOrderSuccess(false); }} className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 dark:bg-white/[0.05] hover:bg-gray-200 dark:hover:bg-white/[0.1] text-gray-500 dark:text-white/40 hover:text-gray-900 dark:hover:text-white transition-all text-sm flex-shrink-0">✕</button>
                </div>

                <div className="flex items-center gap-4 bg-gray-50 dark:bg-white/[0.03] border border-gray-100 dark:border-white/[0.06] rounded-2xl p-4 mb-6">
                  <div className="relative w-16 h-16 rounded-xl overflow-hidden bg-gray-100 dark:bg-white/[0.05] flex-shrink-0 cursor-zoom-in" onClick={() => { setOrderProduct(null); openLightbox(orderProduct); }}>
                    {orderProduct.image ? (
                      <Image src={imgSrc(orderProduct.image)} alt={orderProduct.name} fill unoptimized className="object-cover" onError={(e) => { (e.target as HTMLImageElement).src = "https://placehold.co/64x64/f3f4f6/9ca3af?text=?"; }} />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-300 dark:text-white/15 text-xs">?</div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 dark:text-white text-sm truncate">{orderProduct.name}</p>
                    {orderProduct.category && <p className="text-xs text-blue-600 dark:text-blue-400 mt-0.5">{orderProduct.category}</p>}
                    <p className="text-sm font-bold text-gray-900 dark:text-white mt-1">Rs {orderProduct.price.toLocaleString()} / unit</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button onClick={() => setOrderForm((f) => ({ ...f, quantity: Math.max(1, f.quantity - 1) }))} className="w-8 h-8 rounded-full border border-gray-200 dark:border-white/10 bg-gray-100 dark:bg-white/[0.05] flex items-center justify-center text-gray-600 dark:text-white/60 hover:bg-gray-200 dark:hover:bg-white/[0.1] hover:text-gray-900 dark:hover:text-white transition-all font-bold text-lg leading-none">−</button>
                    <span className="w-6 text-center text-sm font-semibold text-gray-900 dark:text-white">{orderForm.quantity}</span>
                    <button onClick={() => setOrderForm((f) => ({ ...f, quantity: Math.min(orderProduct.stock || 99, f.quantity + 1) }))} className="w-8 h-8 rounded-full border border-gray-200 dark:border-white/10 bg-gray-100 dark:bg-white/[0.05] flex items-center justify-center text-gray-600 dark:text-white/60 hover:bg-gray-200 dark:hover:bg-white/[0.1] hover:text-gray-900 dark:hover:text-white transition-all font-bold text-lg leading-none">+</button>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {[
                      { label: "Full name", key: "name", type: "text", placeholder: "Your name", required: true },
                      { label: "Email", key: "email", type: "email", placeholder: "you@example.com", required: true },
                    ].map(({ label, key, type, placeholder, required }) => (
                      <div key={key}>
                        <label className="block text-xs font-semibold text-gray-500 dark:text-white/35 uppercase tracking-wider mb-1.5">
                          {label} {required && <span className="text-red-500">*</span>}
                        </label>
                        <input type={type} value={orderForm[key as keyof OrderForm] as string} onChange={(e) => setOrderForm((f) => ({ ...f, [key]: e.target.value }))} placeholder={placeholder}
                          className="w-full bg-gray-50 dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.08] rounded-xl px-4 py-2.5 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-white/20 focus:outline-none focus:ring-1 focus:ring-blue-500/40 focus:border-blue-500/40 transition" />
                      </div>
                    ))}
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 dark:text-white/35 uppercase tracking-wider mb-1.5">Phone</label>
                    <input type="tel" value={orderForm.phone} onChange={(e) => setOrderForm((f) => ({ ...f, phone: e.target.value }))} placeholder="+230 xxx xxxx"
                      className="w-full bg-gray-50 dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.08] rounded-xl px-4 py-2.5 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-white/20 focus:outline-none focus:ring-1 focus:ring-blue-500/40 focus:border-blue-500/40 transition" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 dark:text-white/35 uppercase tracking-wider mb-1.5">Notes</label>
                    <textarea value={orderForm.notes} onChange={(e) => setOrderForm((f) => ({ ...f, notes: e.target.value }))} placeholder="Delivery address, special instructions…" rows={3}
                      className="w-full bg-gray-50 dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.08] rounded-xl px-4 py-2.5 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-white/20 focus:outline-none focus:ring-1 focus:ring-blue-500/40 focus:border-blue-500/40 transition resize-none" />
                  </div>
                </div>

                <div className="mt-6 pt-5 border-t border-gray-100 dark:border-white/[0.06]">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-sm text-gray-500 dark:text-white/30">Total ({orderForm.quantity} × Rs {orderProduct.price.toLocaleString()})</span>
                    <span className="text-xl font-bold text-gray-900 dark:text-white">Rs {(orderProduct.price * orderForm.quantity).toLocaleString()}</span>
                  </div>
                  <button
                    onClick={handlePlaceOrder}
                    disabled={orderLoading || !orderForm.name.trim() || !orderForm.email.trim()}
                    className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 disabled:opacity-30 disabled:cursor-not-allowed text-white font-semibold py-3.5 rounded-2xl transition-all text-sm flex items-center justify-center gap-2 shadow-xl shadow-blue-700/20"
                  >
                    {orderLoading ? (
                      <><svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>Placing order…</>
                    ) : (
                      `Place order · Rs ${(orderProduct.price * orderForm.quantity).toLocaleString()}`
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Scroll to top ────────────────────────────────────────────────────── */}
      {showScrollTop && (
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          className="fixed bottom-8 right-6 z-[90] w-11 h-11 rounded-full bg-gray-100 dark:bg-white/[0.08] border border-gray-200 dark:border-white/[0.12] backdrop-blur-sm text-gray-500 dark:text-white/60 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-white/[0.15] transition-all shadow-lg flex items-center justify-center"
          title="Back to top"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" /></svg>
        </button>
      )}

      {/* ── Toast ────────────────────────────────────────────────────────────── */}
      {toast && (
        <div className={`fixed bottom-8 left-1/2 -translate-x-1/2 z-[200] text-sm font-medium px-6 py-3 rounded-full shadow-2xl transition-all backdrop-blur-sm ${toast.type === "error" ? "bg-red-500/90 text-white shadow-red-500/20" : "bg-gray-900 dark:bg-white/10 dark:border dark:border-white/15 text-white shadow-black/30"}`}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}
