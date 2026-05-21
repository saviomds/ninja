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

const PAGE_SIZE = 9;

function StockPill({ stock }: { stock: number }) {
  if (stock === 0)
    return (
      <span className="text-[10px] font-bold uppercase tracking-widest text-red-400 bg-red-500/10 border border-red-500/20 px-2.5 py-1 rounded-full">
        Sold out
      </span>
    );
  if (stock <= 5)
    return (
      <span className="text-[10px] font-bold uppercase tracking-widest text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-full">
        Only {stock} left
      </span>
    );
  return (
    <span className="text-[10px] font-bold uppercase tracking-widest text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2.5 py-1 rounded-full">
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
  "🛡️ Warranty Included",
  "📦 Free Diagnosis",
];

function imgSrc(url: string) {
  return url.replace("/object/public/", "/render/image/public/");
}

function isNew(p: Product) {
  if (!p.created_at) return false;
  return Date.now() - new Date(p.created_at).getTime() < 7 * 24 * 60 * 60 * 1000;
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

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    (async () => {
      const [{ data: prods }, authRes] = await Promise.all([
        supabase.from("products").select("*").eq("is_public", true).order("created_at", { ascending: false }),
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

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightbox(null);
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

  useEffect(() => {
    const onScroll = () => setShowScrollTop(window.scrollY > 500);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

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
      return [product, ...filtered].slice(0, 6);
    });
  };

  const openLightbox = (product: Product) => {
    setLightbox({ product, rotation: 0, zoom: 1 });
    trackView(product);
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

  // Featured products for the hero mosaic (in-stock, first few)
  const heroProducts = products.filter((p) => p.stock > 0 && p.image);

  return (
    <div className="min-h-screen bg-white dark:bg-black text-black dark:text-white overflow-x-hidden">
      <Navbar />

      {/* ══════════ HERO MOSAIC ══════════ */}
      <section className="bg-white dark:bg-zinc-950 pt-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">

          {/* Eyebrow */}
          <div className="flex items-center justify-between py-6">
            <p className="text-[11px] font-semibold tracking-[0.25em] uppercase text-blue-500">
              Tech Ninja · Shop
            </p>
            {!user && (
              <Link href="/login" className="text-[11px] font-semibold tracking-[0.15em] uppercase text-zinc-500 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-800 rounded-full px-4 py-1.5 hover:border-zinc-400 dark:hover:border-zinc-600 transition-colors">
                Sign in
              </Link>
            )}
          </div>

          {/* Main title */}
          <div className="mb-6">
            <h1 className="text-5xl sm:text-6xl md:text-7xl font-bold tracking-tight leading-[1.02] text-black dark:text-white">
              Our
            </h1>
            <h1
              className="text-5xl sm:text-6xl md:text-7xl font-bold tracking-tight leading-[1.02]"
              style={{
                background: "linear-gradient(135deg,#3b82f6 0%,#8b5cf6 50%,#3b82f6 100%)",
                backgroundSize: "200% 200%",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
                animation: "gradient-shift 4s ease infinite",
              }}
            >
              Collection.
            </h1>
            <p className="mt-4 text-base text-zinc-500 dark:text-zinc-400 max-w-sm">
              Premium products, each crafted with intention and built to last.
            </p>
          </div>

          {/* Apple-style product mosaic */}
          {(loading || heroProducts.length > 0) && (
            <div className="grid grid-cols-3 gap-3 mb-3" style={{ height: "clamp(280px, 42vw, 500px)" }}>
              {/* Large hero product — col-span-2 */}
              <div
                className="col-span-2 relative rounded-3xl overflow-hidden cursor-pointer group bg-zinc-100 dark:bg-zinc-900"
                onClick={() => heroProducts[0] && openLightbox(heroProducts[0])}
              >
                {loading ? (
                  <div className="w-full h-full animate-pulse bg-zinc-100 dark:bg-zinc-900" />
                ) : heroProducts[0]?.image ? (
                  <Image
                    src={imgSrc(heroProducts[0].image)}
                    alt={heroProducts[0]?.name || ""}
                    fill
                    unoptimized
                    className="object-cover group-hover:scale-105 transition-transform duration-700"
                    onError={(e) => { (e.target as HTMLImageElement).src = "https://placehold.co/800x600/18181b/3f3f46?text="; }}
                  />
                ) : null}
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/15 to-transparent" />
                {heroProducts[0] && !loading && (
                  <div className="absolute bottom-0 left-0 right-0 p-6 sm:p-8">
                    {heroProducts[0].category && (
                      <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-2">{heroProducts[0].category}</p>
                    )}
                    <p className="text-white text-xl sm:text-2xl font-bold leading-tight mb-1 line-clamp-1">{heroProducts[0].name}</p>
                    <p className="text-zinc-300 text-sm font-semibold">Rs {heroProducts[0].price.toLocaleString()}</p>
                    <span className="inline-block mt-3 text-[11px] font-semibold text-zinc-400 group-hover:text-white transition-colors">
                      View product →
                    </span>
                  </div>
                )}
                {heroProducts[0] && isNew(heroProducts[0]) && !loading && (
                  <div className="absolute top-4 left-4">
                    <span className="text-[10px] font-bold uppercase tracking-widest bg-blue-500 text-white px-3 py-1 rounded-full shadow-lg shadow-blue-500/30">New</span>
                  </div>
                )}
              </div>

              {/* Two stacked small products */}
              <div className="flex flex-col gap-3">
                {[1, 2].map((idx) => (
                  <div
                    key={idx}
                    className="flex-1 relative rounded-3xl overflow-hidden cursor-pointer group bg-zinc-100 dark:bg-zinc-900"
                    onClick={() => heroProducts[idx] && openLightbox(heroProducts[idx])}
                  >
                    {loading ? (
                      <div className="w-full h-full animate-pulse bg-zinc-100 dark:bg-zinc-900" />
                    ) : heroProducts[idx]?.image ? (
                      <Image
                        src={imgSrc(heroProducts[idx].image)}
                        alt={heroProducts[idx]?.name || ""}
                        fill
                        unoptimized
                        className="object-cover group-hover:scale-105 transition-transform duration-700"
                        onError={(e) => { (e.target as HTMLImageElement).src = "https://placehold.co/400x300/18181b/3f3f46?text="; }}
                      />
                    ) : null}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-transparent" />
                    {heroProducts[idx] && !loading && (
                      <div className="absolute bottom-0 left-0 right-0 p-4">
                        <p className="text-white text-sm font-bold leading-tight line-clamp-1">{heroProducts[idx].name}</p>
                        <p className="text-zinc-400 text-xs mt-0.5">Rs {heroProducts[idx].price.toLocaleString()}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Small 4-tile strip */}
          {(loading || heroProducts.length > 3) && (
            <div className="grid grid-cols-4 gap-3 mb-6">
              {[3, 4, 5, 6].map((idx) => (
                <div
                  key={idx}
                  className="relative rounded-2xl overflow-hidden aspect-square cursor-pointer group bg-zinc-100 dark:bg-zinc-900"
                  onClick={() => heroProducts[idx] && openLightbox(heroProducts[idx])}
                >
                  {loading ? (
                    <div className="w-full h-full animate-pulse bg-zinc-100 dark:bg-zinc-900" />
                  ) : heroProducts[idx]?.image ? (
                    <Image
                      src={imgSrc(heroProducts[idx].image)}
                      alt={heroProducts[idx]?.name || ""}
                      fill
                      unoptimized
                      className="object-cover group-hover:scale-110 transition-transform duration-700"
                      onError={(e) => { (e.target as HTMLImageElement).src = "https://placehold.co/300x300/18181b/3f3f46?text="; }}
                    />
                  ) : null}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                  {heroProducts[idx] && !loading && (
                    <div className="absolute bottom-0 left-0 right-0 p-2.5">
                      <p className="text-white text-[11px] font-bold line-clamp-1">{heroProducts[idx].name}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* CTA row */}
          <div className="flex items-center gap-4 pb-8">
            <a
              href="#products"
              className="bg-blue-600 hover:bg-blue-500 text-white font-semibold px-7 py-3 rounded-full text-sm transition-all shadow-xl shadow-blue-700/25 hover:shadow-blue-600/35 hover:-translate-y-0.5"
            >
              Shop now →
            </a>
            <a
              href="#products"
              className="text-[11px] font-semibold tracking-[0.15em] uppercase text-zinc-500 dark:text-zinc-400 hover:text-black dark:hover:text-white transition-colors"
            >
              {products.length > 0 ? `${products.length} products` : "Browse all"}
            </a>
          </div>
        </div>
      </section>

      {/* ══════════ MARQUEE ══════════ */}
      <div className="border-y border-zinc-100 dark:border-zinc-800/60 py-3.5 overflow-hidden bg-zinc-50 dark:bg-zinc-900/40">
        <div className="flex animate-marquee" style={{ width: "max-content" }}>
          {[...Array(4)].flatMap(() => MARQUEE_ITEMS).map((item, i) => (
            <span key={i} className="flex items-center text-[11px] text-zinc-400 dark:text-zinc-500 font-semibold uppercase tracking-widest px-8 whitespace-nowrap">
              {item}
              <span className="text-zinc-200 dark:text-zinc-700 ml-8">·</span>
            </span>
          ))}
        </div>
      </div>

      {/* ══════════ FILTERS ══════════ */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-10 mb-6 space-y-4">

        {/* Search + Sort */}
        <div className="flex gap-3 items-center">
          <div className="relative flex-1 max-w-xl">
            <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setVisibleCount(PAGE_SIZE); }}
              placeholder="Search products…"
              className="w-full bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-full pl-11 pr-5 py-3 text-sm text-black dark:text-white placeholder-zinc-400 dark:placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-blue-500/40 focus:border-blue-500/40 transition"
            />
            {search && (
              <button onClick={() => { setSearch(""); setVisibleCount(PAGE_SIZE); }} className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-black dark:hover:text-white transition-colors">✕</button>
            )}
          </div>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as "default" | "price-asc" | "price-desc")}
            className="bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 text-sm rounded-full px-5 py-3 focus:outline-none focus:border-blue-500/40 cursor-pointer transition flex-shrink-0"
          >
            <option value="default">Sort</option>
            <option value="price-asc">Price ↑</option>
            <option value="price-desc">Price ↓</option>
          </select>
        </div>

        {/* Category pills */}
        <div className="relative">
          {canScrollLeft && (
            <button onClick={() => scrollCats("left")} className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex items-center justify-center text-zinc-600 dark:text-zinc-400 hover:text-black dark:hover:text-white transition-all shadow-sm">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            </button>
          )}
          {canScrollRight && (
            <button onClick={() => scrollCats("right")} className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex items-center justify-center text-zinc-600 dark:text-zinc-400 hover:text-black dark:hover:text-white transition-all shadow-sm">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            </button>
          )}
          <div ref={catScrollRef} className="flex gap-2 overflow-x-auto px-1 py-1" style={{ scrollbarWidth: "none" }}>
            {["all", ...categories].map((cat) => (
              <button
                key={cat}
                onClick={() => { setSelectedCategory(cat); setVisibleCount(PAGE_SIZE); }}
                className={`flex-shrink-0 px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider transition-all whitespace-nowrap flex items-center gap-2 ${
                  selectedCategory === cat
                    ? "bg-black dark:bg-white text-white dark:text-black shadow-lg"
                    : "bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400 hover:border-zinc-400 dark:hover:border-zinc-600 hover:text-black dark:hover:text-white"
                }`}
              >
                {cat === "all" ? "All" : cat}
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${selectedCategory === cat ? "bg-white/20 dark:bg-black/20" : "bg-zinc-200 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-500"}`}>
                  {categoryCounts[cat] || 0}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ══════════ RECENTLY VIEWED ══════════ */}
      {recentlyViewed.length > 1 && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-6">
          <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-3 flex items-center gap-2">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            Recently viewed
          </p>
          <div className="flex gap-2.5">
            {recentlyViewed.map((p) => (
              <button
                key={p.id}
                onClick={() => openLightbox(p)}
                title={p.name}
                className="flex-shrink-0 w-12 h-12 rounded-xl overflow-hidden bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:border-blue-500/40 transition-all hover:scale-110 relative"
              >
                {p.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={imgSrc(p.image)} alt={p.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-zinc-400 text-xs">?</div>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ══════════ PRODUCTS GRID ══════════ */}
      <main id="products" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-20">
        {!loading && (
          <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-6 text-center">
            {filtered.length} product{filtered.length !== 1 ? "s" : ""}
            {selectedCategory !== "all" ? ` · ${selectedCategory}` : ""}
          </p>
        )}

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(9)].map((_, i) => (
              <div key={i} className="bg-zinc-100 dark:bg-zinc-900 rounded-3xl overflow-hidden">
                <div className="aspect-[3/4] animate-pulse bg-zinc-200 dark:bg-zinc-800" />
                <div className="p-4 space-y-2.5">
                  <div className="h-3 bg-zinc-200 dark:bg-zinc-800 rounded-full w-1/3 animate-pulse" />
                  <div className="h-4 bg-zinc-200 dark:bg-zinc-800 rounded-full w-3/4 animate-pulse" />
                  <div className="h-9 bg-zinc-200 dark:bg-zinc-800 rounded-2xl mt-1 animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-32">
            <div className="text-5xl mb-6">🔍</div>
            <p className="text-xl font-bold text-zinc-400 dark:text-zinc-600 mb-2">No products found</p>
            <p className="text-sm text-zinc-400">Try adjusting your search or filters</p>
            {search && (
              <button onClick={() => setSearch("")} className="mt-6 text-blue-500 text-sm hover:text-blue-400 underline transition-colors">
                Clear search
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {visible.map((product, index) => (
                <article
                  key={product.id}
                  className="group relative bg-zinc-100 dark:bg-zinc-900 rounded-3xl overflow-hidden hover:-translate-y-1.5 hover:shadow-2xl dark:hover:shadow-black/50 transition-all duration-300 cursor-pointer animate-fade-in-up"
                  style={{ animationDelay: `${Math.min(index * 0.06, 0.5)}s` }}
                  onClick={() => openLightbox(product)}
                >
                  {/* Image — tall ratio */}
                  <div className="relative overflow-hidden" style={{ aspectRatio: "3/4" }}>
                    {product.image ? (
                      <Image
                        src={imgSrc(product.image)}
                        alt={product.name}
                        fill
                        unoptimized
                        className="object-cover group-hover:scale-108 transition-transform duration-700"
                        onError={(e) => { (e.target as HTMLImageElement).src = "https://placehold.co/600x800/18181b/3f3f46?text="; }}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-zinc-500 text-sm">No image</div>
                    )}

                    {/* Dark gradient */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />

                    {/* Out of stock overlay */}
                    {product.stock === 0 && (
                      <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px] flex items-center justify-center">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-300 border border-zinc-600 bg-black/50 px-4 py-2 rounded-full">Sold out</span>
                      </div>
                    )}

                    {/* New badge */}
                    {isNew(product) && (
                      <div className="absolute top-3 left-3 z-10">
                        <span className="text-[10px] font-bold uppercase tracking-widest bg-blue-500 text-white px-2.5 py-1 rounded-full shadow-lg shadow-blue-500/30">New</span>
                      </div>
                    )}

                    {/* Wishlist button */}
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleWishlist(product.id); }}
                      className={`absolute top-3 right-3 z-10 w-8 h-8 rounded-full flex items-center justify-center transition-all backdrop-blur-sm ${wishlist.has(product.id) ? "bg-red-500/20 border border-red-500/30 text-red-400" : "bg-black/30 border border-white/10 text-white/50 hover:text-red-400"}`}
                    >
                      <svg className="w-4 h-4" fill={wishlist.has(product.id) ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                      </svg>
                    </button>

                    {/* Bottom info overlay */}
                    <div className="absolute bottom-0 left-0 right-0 p-4">
                      {product.category && (
                        <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-1">{product.category}</p>
                      )}
                      <p className="text-white font-bold text-base leading-tight line-clamp-1 mb-0.5">{product.name}</p>
                      <div className="flex items-center justify-between">
                        <p className="text-zinc-300 text-sm font-semibold">Rs {product.price.toLocaleString()}</p>
                        <StockPill stock={product.stock} />
                      </div>
                    </div>

                    {/* Hover: Order button */}
                    <div className="absolute inset-x-4 bottom-[4.5rem] translate-y-3 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300">
                      <button
                        onClick={(e) => { e.stopPropagation(); openOrder(product); }}
                        disabled={product.stock === 0}
                        className="w-full bg-white text-black font-bold py-2.5 rounded-2xl transition-all text-sm hover:bg-zinc-100 disabled:opacity-40 disabled:cursor-not-allowed shadow-xl"
                      >
                        {product.stock === 0 ? "Sold out" : "Order now"}
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
                  className="bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-black dark:text-white font-semibold px-10 py-3.5 rounded-full text-sm hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-all"
                >
                  Load more · {sorted.length - visibleCount} remaining
                </button>
              </div>
            )}
          </>
        )}
      </main>

      {/* ══════════ FEATURES STRIP ══════════ */}
      <section className="border-t border-zinc-100 dark:border-zinc-800/60 py-16 bg-zinc-50 dark:bg-zinc-950">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-zinc-400 text-center mb-10">Why choose us</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {[
              {
                icon: (
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
                  </svg>
                ),
                title: "Fast delivery",
                desc: "Delivered quickly across Mauritius.",
              },
              {
                icon: (
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                  </svg>
                ),
                title: "Secure ordering",
                desc: "Industry-standard encryption on every order.",
              },
              {
                icon: (
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
                  </svg>
                ),
                title: "24/7 support",
                desc: "Our team is always here to help.",
              },
            ].map(({ icon, title, desc }) => (
              <div key={title} className="flex flex-col items-center gap-4 p-8 rounded-3xl bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 text-center hover:-translate-y-1 transition-transform duration-300">
                <div className="w-12 h-12 rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-700 dark:text-zinc-300">
                  {icon}
                </div>
                <h3 className="text-sm font-bold text-black dark:text-white">{title}</h3>
                <p className="text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════ LIGHTBOX ══════════ */}
      {lightbox && (
        <div className="fixed inset-0 z-[150] bg-black/95 backdrop-blur-xl flex flex-col select-none">
          <div className="flex items-center justify-between px-4 sm:px-6 py-3 border-b border-white/[0.06] flex-shrink-0">
            <div className="flex items-center gap-2.5 min-w-0">
              {lightbox.product.category && (
                <span className="hidden sm:block text-[10px] font-bold uppercase tracking-widest text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded-full flex-shrink-0">
                  {lightbox.product.category}
                </span>
              )}
              <h3 className="text-sm font-semibold text-white truncate">{lightbox.product.name}</h3>
              <span className="hidden sm:block text-sm font-bold text-white/40 flex-shrink-0">
                · Rs {lightbox.product.price.toLocaleString()}
              </span>
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0 ml-3">
              <button onClick={() => setLightbox((p) => p ? { ...p, rotation: p.rotation - 90 } : null)} className="w-9 h-9 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white/50 hover:text-white hover:bg-white/[0.1] transition-all flex items-center justify-center" title="Rotate left">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" /></svg>
              </button>
              <button onClick={() => setLightbox((p) => p ? { ...p, rotation: p.rotation + 90 } : null)} className="w-9 h-9 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white/50 hover:text-white hover:bg-white/[0.1] transition-all flex items-center justify-center" title="Rotate right">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 10h-10a8 8 0 00-8 8v2M21 10l-6 6m6-6l-6-6" /></svg>
              </button>
              <div className="w-px h-6 bg-white/10 mx-0.5" />
              <button onClick={() => setLightbox((p) => p ? { ...p, zoom: Math.max(0.25, p.zoom * 0.8) } : null)} className="w-9 h-9 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white/50 hover:text-white hover:bg-white/[0.1] transition-all flex items-center justify-center text-xl font-light leading-none">−</button>
              <button onClick={() => setLightbox((p) => p ? { ...p, rotation: 0, zoom: 1 } : null)} className="w-12 text-center text-xs text-white/35 hover:text-white/70 transition-colors tabular-nums">
                {Math.round(lightbox.zoom * 100)}%
              </button>
              <button onClick={() => setLightbox((p) => p ? { ...p, zoom: Math.min(4, p.zoom * 1.25) } : null)} className="w-9 h-9 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white/50 hover:text-white hover:bg-white/[0.1] transition-all flex items-center justify-center text-xl font-light leading-none">+</button>
              <div className="w-px h-6 bg-white/10 mx-0.5" />
              <button onClick={() => toggleWishlist(lightbox.product.id)} className={`w-9 h-9 rounded-xl border transition-all flex items-center justify-center ${wishlist.has(lightbox.product.id) ? "bg-red-500/15 border-red-500/30 text-red-400" : "bg-white/[0.05] border-white/[0.08] text-white/50 hover:text-red-400"}`}>
                <svg className="w-4 h-4" fill={wishlist.has(lightbox.product.id) ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>
              </button>
              <button onClick={() => { setLightbox(null); openOrder(lightbox.product); }} disabled={lightbox.product.stock === 0} className="hidden sm:flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white text-black text-xs font-bold transition-all hover:bg-zinc-100 disabled:opacity-30 disabled:cursor-not-allowed">
                Order now
              </button>
              <button onClick={() => setLightbox(null)} className="w-9 h-9 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white/50 hover:text-white hover:bg-red-500/15 hover:border-red-500/20 transition-all flex items-center justify-center text-sm">✕</button>
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

          <div className="flex items-center justify-between px-4 sm:px-6 py-3 border-t border-white/[0.06] flex-shrink-0">
            <div className="flex items-center gap-3">
              <StockPill stock={lightbox.product.stock} />
              <span className="text-base font-bold text-white">Rs {lightbox.product.price.toLocaleString()}</span>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => copyShare(lightbox.product)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.05] border border-white/[0.08] text-white/40 hover:text-white text-xs font-medium transition-all">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
                Share
              </button>
              <button onClick={() => { setLightbox(null); openOrder(lightbox.product); }} disabled={lightbox.product.stock === 0} className="sm:hidden flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white text-black text-xs font-bold transition-all hover:bg-zinc-100 disabled:opacity-30 disabled:cursor-not-allowed">
                Order now
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════ ORDER MODAL ══════════ */}
      {orderProduct && (
        <div className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center p-0 sm:p-6 bg-black/70 backdrop-blur-md" onClick={() => { setOrderProduct(null); setOrderSuccess(false); }}>
          <div className="bg-white dark:bg-zinc-950 border border-zinc-100 dark:border-zinc-800 w-full sm:max-w-lg sm:rounded-3xl rounded-t-3xl overflow-hidden shadow-2xl max-h-[95vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            {orderSuccess ? (
              <div className="p-10 text-center space-y-4">
                <div className="w-16 h-16 rounded-full bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 flex items-center justify-center mx-auto">
                  <svg className="w-8 h-8 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h3 className="text-2xl font-bold text-black dark:text-white">Order placed!</h3>
                <p className="text-zinc-500 dark:text-zinc-400 text-sm leading-relaxed">
                  Thank you, <strong className="text-black dark:text-white">{orderForm.name}</strong>! We&apos;ve received your order for{" "}
                  <strong className="text-black dark:text-white">{orderProduct.name}</strong> and will be in touch shortly.
                </p>
                <button onClick={() => { setOrderProduct(null); setOrderSuccess(false); }} className="mt-4 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-black dark:text-white font-semibold px-8 py-3 rounded-2xl text-sm hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-all">
                  Done
                </button>
              </div>
            ) : (
              <div className="p-6 sm:p-8">
                <div className="flex items-start justify-between mb-6">
                  <div>
                    <h3 className="text-xl font-bold text-black dark:text-white">Place an order</h3>
                    <p className="text-sm text-zinc-500 dark:text-zinc-500 mt-1">Fill in your details to complete</p>
                  </div>
                  <button onClick={() => { setOrderProduct(null); setOrderSuccess(false); }} className="w-8 h-8 flex items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-900 hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-500 hover:text-black dark:hover:text-white transition-all text-sm flex-shrink-0">✕</button>
                </div>

                <div className="flex items-center gap-4 bg-zinc-50 dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-2xl p-4 mb-6">
                  <div
                    className="relative w-16 h-16 rounded-xl overflow-hidden bg-zinc-100 dark:bg-zinc-800 flex-shrink-0 cursor-zoom-in"
                    onClick={() => { setOrderProduct(null); openLightbox(orderProduct); }}
                  >
                    {orderProduct.image ? (
                      <Image src={imgSrc(orderProduct.image)} alt={orderProduct.name} fill unoptimized className="object-cover" onError={(e) => { (e.target as HTMLImageElement).src = "https://placehold.co/64x64/18181b/3f3f46?text=?"; }} />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-zinc-400 text-xs">?</div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-black dark:text-white text-sm truncate">{orderProduct.name}</p>
                    {orderProduct.category && <p className="text-xs text-blue-500 mt-0.5">{orderProduct.category}</p>}
                    <p className="text-sm font-bold text-black dark:text-white mt-1">Rs {orderProduct.price.toLocaleString()} / unit</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button onClick={() => setOrderForm((f) => ({ ...f, quantity: Math.max(1, f.quantity - 1) }))} className="w-8 h-8 rounded-full border border-zinc-200 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-all font-bold text-lg leading-none">−</button>
                    <span className="w-6 text-center text-sm font-bold text-black dark:text-white">{orderForm.quantity}</span>
                    <button onClick={() => setOrderForm((f) => ({ ...f, quantity: Math.min(orderProduct.stock || 99, f.quantity + 1) }))} className="w-8 h-8 rounded-full border border-zinc-200 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-all font-bold text-lg leading-none">+</button>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {[
                      { label: "Full name", key: "name", type: "text", placeholder: "Your name", required: true },
                      { label: "Email", key: "email", type: "email", placeholder: "you@example.com", required: true },
                    ].map(({ label, key, type, placeholder, required }) => (
                      <div key={key}>
                        <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5">
                          {label} {required && <span className="text-red-500">*</span>}
                        </label>
                        <input
                          type={type}
                          value={orderForm[key as keyof OrderForm] as string}
                          onChange={(e) => setOrderForm((f) => ({ ...f, [key]: e.target.value }))}
                          placeholder={placeholder}
                          className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-black dark:text-white placeholder-zinc-400 dark:placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-blue-500/40 focus:border-blue-500/40 transition"
                        />
                      </div>
                    ))}
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5">Phone</label>
                    <input type="tel" value={orderForm.phone} onChange={(e) => setOrderForm((f) => ({ ...f, phone: e.target.value }))} placeholder="+230 xxx xxxx"
                      className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-black dark:text-white placeholder-zinc-400 dark:placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-blue-500/40 focus:border-blue-500/40 transition" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5">Notes</label>
                    <textarea value={orderForm.notes} onChange={(e) => setOrderForm((f) => ({ ...f, notes: e.target.value }))} placeholder="Delivery address, special instructions…" rows={3}
                      className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-black dark:text-white placeholder-zinc-400 dark:placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-blue-500/40 focus:border-blue-500/40 transition resize-none" />
                  </div>
                </div>

                <div className="mt-6 pt-5 border-t border-zinc-100 dark:border-zinc-800">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-sm text-zinc-500">Total ({orderForm.quantity} × Rs {orderProduct.price.toLocaleString()})</span>
                    <span className="text-xl font-bold text-black dark:text-white">Rs {(orderProduct.price * orderForm.quantity).toLocaleString()}</span>
                  </div>
                  <button
                    onClick={handlePlaceOrder}
                    disabled={orderLoading || !orderForm.name.trim() || !orderForm.email.trim()}
                    className="w-full bg-black dark:bg-white hover:bg-zinc-800 dark:hover:bg-zinc-100 disabled:opacity-30 disabled:cursor-not-allowed text-white dark:text-black font-bold py-3.5 rounded-2xl transition-all text-sm flex items-center justify-center gap-2"
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

      {/* ══════════ SCROLL TO TOP ══════════ */}
      {showScrollTop && (
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          className="fixed bottom-8 right-6 z-[90] w-11 h-11 rounded-full bg-black dark:bg-white border border-zinc-800 dark:border-zinc-200 text-white dark:text-black hover:bg-zinc-800 dark:hover:bg-zinc-100 transition-all shadow-xl flex items-center justify-center"
          title="Back to top"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" /></svg>
        </button>
      )}

      {/* ══════════ TOAST ══════════ */}
      {toast && (
        <div className={`fixed bottom-8 left-1/2 -translate-x-1/2 z-[200] text-sm font-semibold px-6 py-3 rounded-full shadow-2xl transition-all backdrop-blur-sm ${toast.type === "error" ? "bg-red-500 text-white" : "bg-black dark:bg-white text-white dark:text-black"}`}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}
