"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import Image from "next/image";
import Link from "next/link";
import { User } from "@supabase/supabase-js";
import Navbar from "@/components/Navbar";

interface Product {
  id: string; name: string; description: string; image: string;
  price: number; stock: number; category?: string; created_at?: string;
}
interface OrderForm { name: string; email: string; phone: string; notes: string; quantity: number; }
interface LightboxState { product: Product; rotation: number; zoom: number; }
type QuickViewProduct = Product | null;

const PAGE_SIZE = 12;

const MARQUEE_ITEMS = [
  "⚡ Fast Delivery", "🔒 Secure Orders", "💬 24/7 Support",
  "✨ Premium Quality", "🚀 Quick Dispatch", "🌟 Best Prices",
  "🛡️ Warranty Included", "📦 Free Diagnosis",
];

const MASONRY_RATIOS = ["aspect-[3/4]", "aspect-[4/5]", "aspect-square", "aspect-[2/3]", "aspect-[3/4]", "aspect-[5/7]"];

const TRUST_ITEMS = [
  { icon: "🚀", label: "Fast Delivery",   sub: "Across Mauritius" },
  { icon: "🛡️", label: "2yr Warranty",    sub: "On all products"  },
  { icon: "🔬", label: "Free Diagnosis",  sub: "Walk in anytime"  },
  { icon: "💬", label: "24/7 Support",    sub: "Expert team"      },
];

function StockPill({ stock }: { stock: number }) {
  if (stock === 0) return <span className="text-[10px] font-semibold text-red-500 bg-red-50 dark:bg-red-900/20 px-2 py-0.5 rounded-full">Sold out</span>;
  if (stock <= 5) return <span className="text-[10px] font-semibold text-orange-500 bg-orange-50 dark:bg-orange-900/20 px-2 py-0.5 rounded-full">Only {stock} left</span>;
  return <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-0.5 rounded-full">In stock</span>;
}

function Stars({ n = 4 }: { n?: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1,2,3,4,5].map((i) => (
        <svg key={i} className={`w-3 h-3 ${i <= n ? "text-amber-400" : "text-gray-200 dark:text-gray-700"}`} viewBox="0 0 20 20" fill="currentColor">
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </div>
  );
}

function imgSrc(url: string) { return url.replace("/object/public/", "/render/image/public/"); }
function isNew(p: Product) {
  if (!p.created_at) return false;
  return Date.now() - new Date(p.created_at).getTime() < 7 * 24 * 60 * 60 * 1000;
}
function starCount(p: Product) {
  if (p.stock === 0) return 3;
  if (p.stock <= 5) return 4;
  return 5;
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
  const [viewMode, setViewMode] = useState<"grid" | "masonry">("grid");
  const [quickViewProduct, setQuickViewProduct] = useState<QuickViewProduct>(null);
  const [compareIds, setCompareIds] = useState<Set<string>>(new Set());
  const [compareOpen, setCompareOpen] = useState(false);
  const [quickOrderForm, setQuickOrderForm] = useState<OrderForm>({ name: "", email: "", phone: "", notes: "", quantity: 1 });
  const [quickOrderLoading, setQuickOrderLoading] = useState(false);
  const [quickOrderSuccess, setQuickOrderSuccess] = useState(false);

  const catScrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type }); setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    // Restore wishlist from localStorage
    const saved = localStorage.getItem("tn-wishlist");
    if (saved) {
      try { setWishlist(new Set(JSON.parse(saved) as string[])); } catch { /* ignore */ }
    }

    (async () => {
      const [{ data: prods }, authRes] = await Promise.all([
        supabase.from("products").select("*").eq("is_public", true).order("created_at", { ascending: false }),
        supabase.auth.getUser(),
      ]);
      const list: Product[] = prods || [];
      setProducts(list); setUser(authRes.data?.user ?? null);
      const cats = Array.from(new Set(list.map((p) => p.category).filter(Boolean))) as string[];
      setCategories(cats); setLoading(false);
    })();
    const { data: sub } = supabase.auth.onAuthStateChange((_, session) => { setUser(session?.user ?? null); });
    return () => sub.subscription.unsubscribe();
  }, []);

  const checkScrollArrows = useCallback(() => {
    const el = catScrollRef.current; if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, []);

  useEffect(() => {
    checkScrollArrows();
    const el = catScrollRef.current;
    if (el) el.addEventListener("scroll", checkScrollArrows);
    window.addEventListener("resize", checkScrollArrows);
    return () => { el?.removeEventListener("scroll", checkScrollArrows); window.removeEventListener("resize", checkScrollArrows); };
  }, [categories, checkScrollArrows]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightbox(null);
      if (e.key === "ArrowLeft") setLightbox((p) => p ? { ...p, rotation: p.rotation - 90 } : null);
      if (e.key === "ArrowRight") setLightbox((p) => p ? { ...p, rotation: p.rotation + 90 } : null);
      if (e.key === "+" || e.key === "=") setLightbox((p) => p ? { ...p, zoom: Math.min(4, p.zoom * 1.2) } : null);
      if (e.key === "-") setLightbox((p) => p ? { ...p, zoom: Math.max(0.25, p.zoom * 0.8) } : null);
      if (e.key === "0") setLightbox((p) => p ? { ...p, rotation: 0, zoom: 1 } : null);
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
    const el = lightboxAreaRef.current; if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!lightbox) return; e.preventDefault();
      const factor = e.deltaY < 0 ? 1.1 : 0.9;
      setLightbox((p) => p ? { ...p, zoom: Math.max(0.25, Math.min(4, p.zoom * factor)) } : null);
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
      localStorage.setItem("tn-wishlist", JSON.stringify([...next]));
      return next;
    });
  };

  const toggleCompare = (id: string) => {
    setCompareIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); }
      else {
        if (next.size >= 3) { showToast("Max 3 products to compare", "error"); return prev; }
        next.add(id);
      }
      return next;
    });
  };

  const openQuickView = (product: Product) => {
    setQuickViewProduct(product);
    setQuickOrderForm({ name: "", email: user?.email || "", phone: "", notes: "", quantity: 1 });
    setQuickOrderSuccess(false);
  };

  const handleQuickOrder = async () => {
    if (!quickViewProduct) return;
    if (!quickOrderForm.name.trim() || !quickOrderForm.email.trim()) { showToast("Name and email are required", "error"); return; }
    setQuickOrderLoading(true);
    const { error } = await supabase.from("orders").insert({
      product_id: quickViewProduct.id, product_name: quickViewProduct.name,
      quantity: quickOrderForm.quantity, price: quickViewProduct.price * quickOrderForm.quantity,
      client_name: quickOrderForm.name.trim(), client_email: quickOrderForm.email.trim(),
      client_phone: quickOrderForm.phone.trim() || null, notes: quickOrderForm.notes.trim() || null, status: "pending",
    });
    setQuickOrderLoading(false);
    if (error) showToast("Failed to place order. Please try again.", "error"); else setQuickOrderSuccess(true);
  };

  const trackView = (product: Product) => {
    setRecentlyViewed((prev) => [product, ...prev.filter((p) => p.id !== product.id)].slice(0, 6));
  };

  const openLightbox = (product: Product) => { setLightbox({ product, rotation: 0, zoom: 1 }); trackView(product); };
  const copyShare = (product: Product) => {
    const url = `${window.location.origin}/product/${product.id}`;
    navigator.clipboard.writeText(url).then(() => showToast("Link copied!")).catch(() => showToast("Could not copy link", "error"));
  };

  const filtered = products.filter((p) => {
    const matchCat = selectedCategory === "all" || p.category === selectedCategory;
    const matchSearch = !search.trim() || p.name.toLowerCase().includes(search.toLowerCase()) || (p.description || "").toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });
  const sorted = [...filtered].sort((a, b) => sortBy === "price-asc" ? a.price - b.price : sortBy === "price-desc" ? b.price - a.price : 0);
  const visible = sorted.slice(0, visibleCount);
  const categoryCounts = products.reduce((acc, p) => { acc["all"] = (acc["all"] || 0) + 1; if (p.category) acc[p.category] = (acc[p.category] || 0) + 1; return acc; }, {} as Record<string, number>);
  const heroProducts = products.filter((p) => p.stock > 0 && p.image).slice(0, 4);

  const openOrder = (product: Product) => {
    setOrderProduct(product);
    setOrderForm({ name: "", email: user?.email || "", phone: "", notes: "", quantity: 1 });
    setOrderSuccess(false);
  };

  const handlePlaceOrder = async () => {
    if (!orderProduct) return;
    if (!orderForm.name.trim() || !orderForm.email.trim()) { showToast("Name and email are required", "error"); return; }
    setOrderLoading(true);
    const { error } = await supabase.from("orders").insert({
      product_id: orderProduct.id, product_name: orderProduct.name,
      quantity: orderForm.quantity, price: orderProduct.price * orderForm.quantity,
      client_name: orderForm.name.trim(), client_email: orderForm.email.trim(),
      client_phone: orderForm.phone.trim() || null, notes: orderForm.notes.trim() || null, status: "pending",
    });
    setOrderLoading(false);
    if (error) showToast("Failed to place order. Please try again.", "error"); else setOrderSuccess(true);
  };

  const inputCls = "w-full bg-[#F9FAFB] dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 text-[14px] text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:border-[#2563EB] dark:focus:border-blue-400 transition-colors";

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 overflow-x-hidden">
      <Navbar />

      {/* ══════════════════ HERO ══════════════════ */}
      <section className="relative overflow-hidden bg-[#F5F7FA] dark:bg-gray-900 pt-16">
        {/* Background decoration */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute top-0 right-0 w-[50%] h-[100%] opacity-60"
            style={{ background: "radial-gradient(ellipse at 80% 50%, rgba(37,99,235,0.08) 0%, transparent 70%)" }} />
          <div className="absolute inset-0 bg-grid opacity-30" />
        </div>

        <div className="relative max-w-7xl mx-auto w-full px-5 lg:px-8 py-16 sm:py-24">
          <div className="grid lg:grid-cols-2 gap-12 xl:gap-20 items-center">

            {/* LEFT */}
            <div className="flex flex-col gap-7">
              <div className="inline-flex items-center gap-2 bg-[#2563EB]/10 text-[#2563EB] text-[11px] font-bold uppercase tracking-[0.16em] px-3 py-1.5 rounded-full w-fit">
                <span className="w-1.5 h-1.5 rounded-full bg-[#2563EB] animate-pulse" />
                Tech Ninja · The Shop
              </div>

              <div>
                <h1 className="text-[44px] sm:text-[56px] lg:text-[62px] font-black tracking-tight leading-[1.0] text-gray-900 dark:text-white mb-4">
                  Premium tech,<br />
                  <span className="text-[#2563EB]">delivered.</span>
                </h1>
                <p className="text-[16px] text-gray-500 dark:text-gray-400 leading-relaxed max-w-[400px]">
                  Handpicked smartphones, laptops, accessories &amp; refurbished deals — the best tech in Mauritius.
                </p>
              </div>

              {/* Inline stats */}
              <div className="flex items-center gap-6">
                {[
                  { v: !loading && products.length > 0 ? `${products.length}+` : "—", l: "Products" },
                  { v: "4.9 ★", l: "Avg Rating" },
                  { v: "2 yr", l: "Warranty" },
                ].map(({ v, l }) => (
                  <div key={l}>
                    <p className="text-[24px] font-black text-gray-900 dark:text-white leading-none tabular-nums">{v}</p>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-gray-400 mt-1">{l}</p>
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap gap-3">
                <a href="#products"
                  className="inline-flex items-center gap-2 bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-[14px] font-semibold px-6 py-3 rounded-lg transition-all shadow-[0_4px_12px_rgba(37,99,235,0.30)] active:scale-[0.97]">
                  Shop Now
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
                </a>
                <Link href="/repair"
                  className="inline-flex items-center gap-2 text-gray-600 dark:text-gray-400 text-[14px] font-semibold px-6 py-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-[#2563EB]/40 hover:text-[#2563EB] transition-all">
                  Book a Repair
                </Link>
              </div>

              {/* Category quick-links */}
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-400 mb-2.5">Quick browse</p>
                <div className="flex flex-wrap gap-2">
                  {(categories.length > 0 ? ["All", ...categories.slice(0, 4)] : ["All", "Phones", "Laptops", "Accessories"]).map((cat) => (
                    <a key={cat} href="#products"
                      onClick={() => { setSelectedCategory(cat === "All" ? "all" : cat); setVisibleCount(PAGE_SIZE); }}
                      className={`text-[12px] font-semibold rounded-full px-3.5 py-1.5 cursor-pointer transition-all border ${
                        selectedCategory === (cat === "All" ? "all" : cat)
                          ? "bg-[#2563EB] text-white border-[#2563EB]"
                          : "bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:border-[#2563EB]/40 hover:text-[#2563EB]"
                      }`}>
                      {cat}
                    </a>
                  ))}
                </div>
              </div>
            </div>

            {/* RIGHT — product mosaic */}
            <div className="relative hidden lg:flex items-center justify-end">
              <div className="absolute inset-0 pointer-events-none"
                style={{ background: "radial-gradient(circle at 60% 50%, rgba(37,99,235,0.10) 0%, transparent 70%)", filter: "blur(40px)" }} />

              {/* Floating badges */}
              <div className="absolute -left-4 top-8 z-20 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl px-4 py-3 shadow-[0_4px_20px_rgba(0,0,0,0.08)]"
                style={{ animation: "tn-badge 3.5s ease-in-out infinite" }}>
                <p className="text-[18px] font-black text-[#2563EB] leading-none">4.9 ★</p>
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mt-1">Customer rating</p>
              </div>
              <div className="absolute -right-2 bottom-12 z-20 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl px-4 py-3 shadow-[0_4px_20px_rgba(0,0,0,0.08)]"
                style={{ animation: "tn-badge 4s ease-in-out infinite", animationDelay: "1s" }}>
                <p className="text-[18px] font-black text-[#2563EB] leading-none tabular-nums">
                  {!loading && products.length > 0 ? `${products.length}+` : "—"}
                </p>
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mt-1">Products</p>
              </div>
              <div className="absolute right-4 top-6 z-20 bg-[#2563EB] rounded-xl px-3 py-2 shadow-lg"
                style={{ animation: "tn-badge 5s ease-in-out infinite", animationDelay: "0.5s" }}>
                <p className="text-[11px] font-bold text-white">🛡️ 2yr Warranty</p>
              </div>

              {/* Product 2×2 mosaic */}
              <div className="relative z-10 w-[420px] xl:w-[480px]" style={{ animation: "tn-float 6s ease-in-out infinite" }}>
                <div className="relative rounded-3xl overflow-hidden shadow-[0_16px_60px_rgba(0,0,0,0.12)] dark:shadow-[0_16px_60px_rgba(0,0,0,0.5)] border border-gray-100 dark:border-gray-700" style={{ aspectRatio: "4/3" }}>
                  <div className="absolute inset-0 grid grid-cols-2 grid-rows-2 gap-1.5 p-1.5 bg-[#F9FAFB] dark:bg-gray-800">
                    {[0, 1, 2, 3].map((idx) => (
                      <div key={idx}
                        className="relative rounded-2xl overflow-hidden bg-gray-100 dark:bg-gray-700 cursor-pointer group"
                        onClick={() => heroProducts[idx] && openLightbox(heroProducts[idx])}>
                        {loading ? (
                          <div className="absolute inset-0 animate-pulse bg-gray-100 dark:bg-gray-700" />
                        ) : heroProducts[idx]?.image ? (
                          <Image src={imgSrc(heroProducts[idx].image)} alt={heroProducts[idx].name} fill unoptimized
                            className="object-cover group-hover:scale-110 transition-transform duration-700"
                            onError={(e) => { (e.target as HTMLImageElement).src = "https://placehold.co/300x300/F9FAFB/6B7280?text="; }} />
                        ) : (
                          <div className="absolute inset-0 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-gray-700 dark:to-gray-600 flex items-center justify-center">
                            <svg className="w-8 h-8 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                          </div>
                        )}
                        <div className="absolute inset-0 bg-[#2563EB]/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <div className="bg-white rounded-full p-2 shadow-lg">
                            <svg className="w-4 h-4 text-[#2563EB]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════ TRUST BAR ══════════════════ */}
      <div className="bg-[#2563EB] overflow-hidden py-3.5">
        <div className="flex items-center gap-10 w-max" style={{ animation: "marquee 30s linear infinite" }}>
          {[...MARQUEE_ITEMS, ...MARQUEE_ITEMS, ...MARQUEE_ITEMS].map((item, i) => (
            <span key={i} className="flex items-center gap-3 text-white text-[12px] font-semibold tracking-wider uppercase whitespace-nowrap">
              <span className="w-1.5 h-1.5 rounded-full bg-white/60 flex-shrink-0" />
              {item}
            </span>
          ))}
        </div>
      </div>

      {/* ══════════════════ TRUST ICONS ══════════════════ */}
      <div className="bg-white dark:bg-gray-950 border-b border-gray-100 dark:border-gray-800">
        <div className="max-w-7xl mx-auto px-5 lg:px-8 py-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {TRUST_ITEMS.map((t) => (
              <div key={t.label} className="flex items-center gap-3 py-2">
                <div className="w-10 h-10 rounded-xl bg-[#2563EB]/10 flex items-center justify-center text-lg flex-shrink-0">
                  {t.icon}
                </div>
                <div>
                  <p className="text-[13px] font-bold text-gray-900 dark:text-white leading-tight">{t.label}</p>
                  <p className="text-[11px] text-gray-400 mt-0.5">{t.sub}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ══════════════════ PRODUCTS ══════════════════ */}
      <section id="products" className="bg-[#F5F7FA] dark:bg-gray-950 py-16 px-5 lg:px-8">
        <div className="max-w-7xl mx-auto">

          {/* Toolbar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5 mb-8">
            <div>
              <p className="text-[11px] font-semibold tracking-[0.14em] text-gray-400 uppercase mb-1">Our collection</p>
              <h2 className="text-[28px] sm:text-[32px] font-black tracking-tight text-gray-900 dark:text-white">Find your next device.</h2>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              {/* Search */}
              <div className="relative">
                <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                <input type="text" value={search}
                  onChange={(e) => { setSearch(e.target.value); setVisibleCount(PAGE_SIZE); }}
                  placeholder="Search products…"
                  className="w-44 sm:w-52 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg pl-10 pr-8 py-2.5 text-[13px] text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:border-[#2563EB] dark:focus:border-blue-400 shadow-sm transition-colors" />
                {search && (
                  <button onClick={() => { setSearch(""); setVisibleCount(PAGE_SIZE); }} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors text-sm">✕</button>
                )}
              </div>

              {/* Sort */}
              <select value={sortBy} onChange={(e) => setSortBy(e.target.value as "default" | "price-asc" | "price-desc")}
                className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 text-[13px] rounded-lg px-3.5 py-2.5 focus:outline-none focus:border-[#2563EB] cursor-pointer shadow-sm transition-colors">
                <option value="default">Sort</option>
                <option value="price-asc">Price ↑</option>
                <option value="price-desc">Price ↓</option>
              </select>

              {/* View toggle */}
              <div className="flex items-center gap-0.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-1 shadow-sm">
                <button onClick={() => setViewMode("grid")} className={`w-8 h-8 rounded-md flex items-center justify-center transition-all ${viewMode === "grid" ? "bg-[#2563EB] text-white shadow-sm" : "text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"}`} title="Grid view">
                  <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 16 16"><rect x="1" y="1" width="6" height="6" rx="1"/><rect x="9" y="1" width="6" height="6" rx="1"/><rect x="1" y="9" width="6" height="6" rx="1"/><rect x="9" y="9" width="6" height="6" rx="1"/></svg>
                </button>
                <button onClick={() => setViewMode("masonry")} className={`w-8 h-8 rounded-md flex items-center justify-center transition-all ${viewMode === "masonry" ? "bg-[#2563EB] text-white shadow-sm" : "text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"}`} title="Masonry view">
                  <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 16 16"><rect x="1" y="1" width="6" height="8" rx="1"/><rect x="9" y="1" width="6" height="5" rx="1"/><rect x="9" y="8" width="6" height="7" rx="1"/><rect x="1" y="11" width="6" height="4" rx="1"/></svg>
                </button>
              </div>
            </div>
          </div>

          {/* Category pills */}
          <div className="relative mb-8">
            {canScrollLeft && (
              <button onClick={() => scrollCats("left")} className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 flex items-center justify-center text-gray-400 hover:text-[#2563EB] shadow-sm transition-all">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
              </button>
            )}
            {canScrollRight && (
              <button onClick={() => scrollCats("right")} className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 flex items-center justify-center text-gray-400 hover:text-[#2563EB] shadow-sm transition-all">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
              </button>
            )}
            <div ref={catScrollRef} className="flex gap-2 overflow-x-auto px-1 py-1 scrollbar-none">
              {["all", ...categories].map((cat) => (
                <button key={cat} onClick={() => { setSelectedCategory(cat); setVisibleCount(PAGE_SIZE); }}
                  className={`flex-shrink-0 px-4 py-2 rounded-full text-[12px] font-semibold transition-all whitespace-nowrap flex items-center gap-1.5 border ${
                    selectedCategory === cat
                      ? "bg-[#2563EB] text-white border-[#2563EB] shadow-[0_2px_8px_rgba(37,99,235,0.30)]"
                      : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-[#2563EB]/40 hover:text-[#2563EB] shadow-sm"
                  }`}>
                  {cat === "all" ? "All" : cat}
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${selectedCategory === cat ? "bg-white/20 text-white" : "bg-gray-100 dark:bg-gray-700 text-gray-400"}`}>
                    {categoryCounts[cat] || 0}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Recently viewed */}
          {recentlyViewed.length > 1 && (
            <div className="mb-8 p-4 bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-3 flex items-center gap-2">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                Recently viewed
              </p>
              <div className="flex gap-2.5">
                {recentlyViewed.map((p) => (
                  <Link key={p.id} href={`/product/${p.id}`} title={p.name}
                    className="flex-shrink-0 w-12 h-12 rounded-xl overflow-hidden bg-[#F9FAFB] dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:border-[#2563EB] transition-all hover:scale-110 relative block shadow-sm">
                    {p.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={imgSrc(p.image)} alt={p.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">?</div>
                    )}
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Result count */}
          {!loading && (
            <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-5">
              {filtered.length} product{filtered.length !== 1 ? "s" : ""}{selectedCategory !== "all" ? ` · ${selectedCategory}` : ""}
              {search && ` · "${search}"`}
            </p>
          )}

          {/* ── Product display ── */}
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="bg-white dark:bg-gray-900 rounded-2xl overflow-hidden border border-gray-100 dark:border-gray-800 shadow-sm animate-pulse">
                  <div className="aspect-square bg-gray-100 dark:bg-gray-800" />
                  <div className="p-4 space-y-2">
                    <div className="h-3 bg-gray-100 dark:bg-gray-800 rounded w-1/3" />
                    <div className="h-4 bg-gray-100 dark:bg-gray-800 rounded w-3/4" />
                    <div className="h-3 bg-gray-100 dark:bg-gray-800 rounded w-1/2" />
                    <div className="h-9 bg-gray-100 dark:bg-gray-800 rounded-lg mt-3" />
                  </div>
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-32 bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800">
              <div className="w-20 h-20 rounded-3xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-4xl mx-auto mb-6">🔍</div>
              <p className="text-[22px] font-bold text-gray-900 dark:text-white mb-2">No products found</p>
              <p className="text-[15px] text-gray-500 dark:text-gray-400 mb-6">Try adjusting your search or category filters</p>
              <div className="flex items-center justify-center gap-3">
                {search && (
                  <button onClick={() => { setSearch(""); setVisibleCount(PAGE_SIZE); }}
                    className="bg-[#2563EB] text-white font-semibold px-6 py-2.5 rounded-lg text-[14px] hover:bg-[#1D4ED8] transition-colors">
                    Clear search
                  </button>
                )}
                {selectedCategory !== "all" && (
                  <button onClick={() => setSelectedCategory("all")}
                    className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 font-semibold px-6 py-2.5 rounded-lg text-[14px] hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                    Show all
                  </button>
                )}
              </div>
            </div>
          ) : viewMode === "grid" ? (
            <>
              {/* ── GRID CARDS (TechNinja style) ── */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                {visible.map((product, index) => (
                  <div key={product.id}
                    className="group bg-white dark:bg-gray-900 rounded-2xl overflow-hidden border border-gray-100 dark:border-gray-800 shadow-sm hover:shadow-[0_8px_30px_rgba(0,0,0,0.10)] dark:hover:shadow-[0_8px_30px_rgba(0,0,0,0.4)] hover:-translate-y-1 transition-all duration-300 animate-card-reveal flex flex-col"
                    style={{ animationDelay: `${Math.min(index * 0.04, 0.3)}s` }}>

                    {/* Image */}
                    <div className="relative aspect-square bg-[#F5F7FA] dark:bg-gray-800 overflow-hidden">
                      {product.image ? (
                        <Image src={imgSrc(product.image)} alt={product.name} fill unoptimized
                          className="object-cover group-hover:scale-[1.06] transition-transform duration-500"
                          onError={(e) => { (e.target as HTMLImageElement).src = "https://placehold.co/400x400/F5F7FA/9CA3AF?text="; }} />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-blue-50 to-blue-100 dark:from-gray-700 dark:to-gray-600">
                          <svg className="w-12 h-12 text-gray-200 dark:text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                        </div>
                      )}

                      {/* Sold out overlay */}
                      {product.stock === 0 && (
                        <div className="absolute inset-0 bg-white/70 dark:bg-gray-900/70 backdrop-blur-[2px] flex items-center justify-center">
                          <span className="text-[12px] font-bold text-gray-500 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 px-3 py-1.5 rounded-full shadow-sm">Sold out</span>
                        </div>
                      )}

                      {/* New badge */}
                      {isNew(product) && (
                        <div className="absolute top-3 left-3 z-10">
                          <span className="text-[10px] font-bold bg-[#2563EB] text-white px-2.5 py-1 rounded-full shadow-sm">NEW</span>
                        </div>
                      )}

                      {/* Low stock */}
                      {product.stock > 0 && product.stock <= 5 && (
                        <div className={`absolute ${isNew(product) ? "top-10" : "top-3"} left-3 z-10`}>
                          <span className="text-[10px] font-bold bg-orange-500 text-white px-2.5 py-1 rounded-full shadow-sm">{product.stock} left</span>
                        </div>
                      )}

                      {/* Wishlist */}
                      <button onClick={(e) => { e.stopPropagation(); toggleWishlist(product.id); }}
                        className={`absolute top-3 right-3 z-10 w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                          wishlist.has(product.id)
                            ? "bg-red-500 text-white shadow-lg"
                            : "bg-white/90 dark:bg-gray-800/90 text-gray-400 hover:text-red-500 shadow-sm opacity-0 group-hover:opacity-100"
                        }`}>
                        <svg className="w-4 h-4" fill={wishlist.has(product.id) ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                        </svg>
                      </button>

                      {/* Quick zoom */}
                      <button onClick={() => openLightbox(product)}
                        className="absolute bottom-3 right-3 z-10 w-8 h-8 rounded-full bg-white/90 dark:bg-gray-800/90 text-gray-500 hover:text-[#2563EB] shadow-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                      </button>

                      {/* Quick View button */}
                      <button
                        onClick={(e) => { e.stopPropagation(); openQuickView(product); }}
                        className="absolute bottom-3 left-3 z-10 h-8 px-3 rounded-full bg-white/90 dark:bg-gray-800/90 text-gray-600 dark:text-gray-300 text-[11px] font-semibold shadow-sm flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all hover:text-[#2563EB]">
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                        Quick View
                      </button>

                      {/* Compare checkbox */}
                      <button
                        onClick={(e) => { e.stopPropagation(); toggleCompare(product.id); }}
                        title={compareIds.has(product.id) ? "Remove from compare" : "Add to compare"}
                        className={`absolute top-3 left-3 z-10 w-7 h-7 rounded-lg border-2 flex items-center justify-center transition-all ${
                          compareIds.has(product.id)
                            ? "bg-[#2563EB] border-[#2563EB] text-white"
                            : "bg-white/90 dark:bg-gray-800/90 border-gray-300 dark:border-gray-600 text-transparent hover:border-[#2563EB] opacity-0 group-hover:opacity-100"
                        }`}>
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                      </button>
                    </div>

                    {/* Info */}
                    <div className="p-4 flex flex-col flex-1">
                      {/* Stars + category */}
                      <div className="flex items-center justify-between mb-2">
                        <Stars n={starCount(product)} />
                        {product.category && (
                          <span className="text-[10px] font-semibold text-[#2563EB] bg-[#2563EB]/10 px-2 py-0.5 rounded-full">{product.category}</span>
                        )}
                      </div>

                      {/* Name */}
                      <h3 className="text-[14px] font-bold text-gray-900 dark:text-white leading-snug mb-1 line-clamp-2 flex-1">{product.name}</h3>

                      {/* Price row */}
                      <div className="flex items-center justify-between mt-2 mb-3">
                        <p className="text-[16px] font-black text-gray-900 dark:text-white">Rs {product.price.toLocaleString()}</p>
                        <StockPill stock={product.stock} />
                      </div>

                      {/* CTA */}
                      <button onClick={() => openOrder(product)} disabled={product.stock === 0}
                        className="w-full bg-[#2563EB] hover:bg-[#1D4ED8] disabled:bg-gray-100 dark:disabled:bg-gray-800 disabled:text-gray-400 text-white font-semibold py-2.5 rounded-xl text-[13px] transition-all active:scale-[0.97] shadow-[0_2px_8px_rgba(37,99,235,0.25)] disabled:shadow-none">
                        {product.stock === 0 ? "Sold Out" : "Order Now"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {visibleCount < sorted.length && (
                <div className="text-center mt-12">
                  <button onClick={() => setVisibleCount((v) => v + PAGE_SIZE)}
                    className="inline-flex items-center gap-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 font-semibold px-10 py-3.5 rounded-xl text-[14px] hover:border-[#2563EB]/40 hover:text-[#2563EB] transition-all shadow-sm">
                    Load more
                    <span className="text-gray-400 font-normal">· {sorted.length - visibleCount} more</span>
                  </button>
                </div>
              )}
            </>
          ) : (
            <>
              {/* ── MASONRY LAYOUT ── */}
              <div className="masonry-1 sm:masonry-2 lg:masonry-3">
                {visible.map((product, index) => {
                  const ratio = MASONRY_RATIOS[index % MASONRY_RATIOS.length];
                  return (
                    <div key={product.id}
                      className="masonry-item mb-4 group relative overflow-hidden rounded-2xl block cursor-pointer animate-card-reveal"
                      style={{ animationDelay: `${Math.min(index * 0.05, 0.4)}s` }}
                      onClick={() => openLightbox(product)}>
                      <div className={`relative overflow-hidden bg-[#F9FAFB] dark:bg-gray-800 ${ratio}`}>
                        {product.image ? (
                          <Image src={imgSrc(product.image)} alt={product.name} fill unoptimized
                            className="object-cover group-hover:scale-[1.05] transition-transform duration-700"
                            onError={(e) => { (e.target as HTMLImageElement).src = "https://placehold.co/400x500/F9FAFB/6B7280?text="; }} />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-50 to-blue-100 dark:from-gray-700 dark:to-gray-600">
                            <svg className="w-10 h-10 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                          </div>
                        )}

                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />

                        {product.stock === 0 && (
                          <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] flex items-center justify-center z-10">
                            <span className="text-[12px] font-semibold text-white bg-black/60 px-3 py-1.5 rounded-full">Sold out</span>
                          </div>
                        )}

                        {isNew(product) && (
                          <div className="absolute top-3 left-3 z-10">
                            <span className="text-[10px] font-bold bg-[#2563EB] text-white px-2.5 py-1 rounded-full">NEW</span>
                          </div>
                        )}

                        <button onClick={(e) => { e.stopPropagation(); toggleWishlist(product.id); }}
                          className={`absolute top-3 right-3 z-10 w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                            wishlist.has(product.id)
                              ? "bg-red-500/25 border border-red-500/40 text-red-400"
                              : "bg-black/20 border border-white/10 text-white/60 hover:text-red-400 opacity-0 group-hover:opacity-100"
                          }`}>
                          <svg className="w-4 h-4" fill={wishlist.has(product.id) ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                          </svg>
                        </button>

                        <div className="absolute bottom-0 left-0 right-0 p-4 z-10">
                          {product.category && <p className="text-[10px] font-semibold uppercase tracking-wider text-white/60 mb-1">{product.category}</p>}
                          <p className="text-white font-bold text-[14px] leading-tight line-clamp-2 mb-1">{product.name}</p>
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-white/90 text-[13px] font-bold">Rs {product.price.toLocaleString()}</p>
                            {product.stock > 0 && <span className="text-[10px] font-semibold text-emerald-400">In stock</span>}
                          </div>
                        </div>

                        <div className="absolute inset-x-3 bottom-[4.5rem] translate-y-3 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300 z-20">
                          <button onClick={(e) => { e.stopPropagation(); openOrder(product); }} disabled={product.stock === 0}
                            className="w-full bg-white dark:bg-gray-100 text-gray-900 font-bold py-2.5 rounded-xl text-[13px] hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed shadow-xl transition-all">
                            {product.stock === 0 ? "Sold out" : "Order now"}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {visibleCount < sorted.length && (
                <div className="text-center mt-12">
                  <button onClick={() => setVisibleCount((v) => v + PAGE_SIZE)}
                    className="inline-flex items-center gap-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 font-semibold px-10 py-3.5 rounded-xl text-[14px] hover:border-[#2563EB]/40 hover:text-[#2563EB] transition-all shadow-sm">
                    Load more
                    <span className="text-gray-400 font-normal">· {sorted.length - visibleCount} more</span>
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </section>

      {/* ══════════════════ WHY SHOP WITH US ══════════════════ */}
      <section className="bg-white dark:bg-gray-950 py-20 px-5 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <span className="text-[11px] font-semibold tracking-[0.14em] text-gray-400 uppercase mb-3 block">Why choose us</span>
            <h2 className="text-[32px] sm:text-[40px] font-black tracking-tight text-gray-900 dark:text-white">Shopping made simple.</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { icon: "⚡", title: "Fast Delivery",        desc: "Products delivered quickly and safely across Mauritius.", color: "from-yellow-400/20 to-orange-400/10" },
              { icon: "🛡️", title: "Warranty Included",   desc: "Every product comes with a full manufacturer warranty.", color: "from-blue-400/20 to-cyan-400/10" },
              { icon: "💎", title: "Best Price Guarantee", desc: "Transparent pricing — no hidden fees, ever.", color: "from-purple-400/20 to-violet-400/10" },
              { icon: "🔬", title: "Free Diagnosis",       desc: "Not sure what you need? We help at no extra cost.", color: "from-emerald-400/20 to-teal-400/10" },
              { icon: "🔒", title: "Secure Ordering",      desc: "Industry-grade encryption protects every transaction.", color: "from-pink-400/20 to-rose-400/10" },
              { icon: "💬", title: "24/7 Support",         desc: "Our expert team is always here to assist you.", color: "from-amber-400/20 to-yellow-400/10" },
            ].map((item) => (
              <div key={item.title}
                className="group relative overflow-hidden rounded-2xl border border-gray-100 dark:border-gray-800 bg-[#F5F7FA] dark:bg-gray-900 p-7 hover:shadow-[0_8px_24px_rgba(0,0,0,0.06)] dark:hover:shadow-[0_8px_24px_rgba(0,0,0,0.3)] transition-all duration-300 hover:-translate-y-1">
                <div className={`absolute inset-0 bg-gradient-to-br ${item.color} opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />
                <span className="relative z-10 text-2xl block mb-4 group-hover:scale-110 transition-transform duration-200">{item.icon}</span>
                <h3 className="relative z-10 text-[15px] font-bold text-gray-900 dark:text-white mb-2">{item.title}</h3>
                <p className="relative z-10 text-[13px] text-gray-500 dark:text-gray-400 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════ FOOTER CTA ══════════════════ */}
      <section className="relative overflow-hidden bg-gray-950 py-28 px-5 lg:px-8">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse 60% 80% at 40% 50%, rgba(37,99,235,0.10) 0%, transparent 70%)" }} />
          <div className="absolute inset-0 bg-grid opacity-40" />
        </div>
        <div className="relative max-w-7xl mx-auto text-center">
          <p className="text-[11px] font-semibold tracking-[0.2em] uppercase text-gray-500 mb-5">Start shopping today</p>
          <h2 className="text-[44px] sm:text-[56px] font-black tracking-tight leading-[1.0] max-w-2xl mx-auto mb-6">
            <span className="text-white">Your next device</span><br />
            <span className="gradient-text-blue">awaits.</span>
          </h2>
          <p className="text-[16px] text-gray-500 mb-10 max-w-sm mx-auto leading-relaxed">
            Premium tech at the best prices — with warranty, fast delivery, and expert support.
          </p>
          <div className="flex flex-wrap gap-3 justify-center">
            <a href="#products"
              className="inline-flex items-center gap-2 bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-[15px] font-semibold px-8 py-3.5 rounded-full transition-colors shadow-[0_0_30px_rgba(37,99,235,0.30)]">
              Browse collection
            </a>
            <Link href="/"
              className="inline-flex items-center gap-2 bg-white text-gray-900 text-[15px] font-semibold px-8 py-3.5 rounded-full hover:bg-gray-100 transition-colors">
              Back to home
            </Link>
          </div>
        </div>
      </section>

      {/* ══════════════════ LIGHTBOX ══════════════════ */}
      {lightbox && (
        <div className="fixed inset-0 z-[150] bg-black/96 backdrop-blur-xl flex flex-col select-none">
          <div className="flex items-center justify-between px-4 sm:px-6 py-3 border-b border-white/[0.06] flex-shrink-0">
            <div className="flex items-center gap-2.5 min-w-0">
              {lightbox.product.category && (
                <span className="hidden sm:block text-[11px] font-semibold text-[#2563EB] bg-[#2563EB]/10 px-2.5 py-0.5 rounded-full flex-shrink-0">{lightbox.product.category}</span>
              )}
              <h3 className="text-[14px] font-semibold text-white truncate">{lightbox.product.name}</h3>
              <span className="hidden sm:block text-[14px] font-bold text-white/40 flex-shrink-0">· Rs {lightbox.product.price.toLocaleString()}</span>
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0 ml-3">
              <button onClick={() => setLightbox((p) => p ? { ...p, rotation: p.rotation - 90 } : null)} className="w-9 h-9 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white/50 hover:text-white hover:bg-white/[0.1] transition-all flex items-center justify-center">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" /></svg>
              </button>
              <button onClick={() => setLightbox((p) => p ? { ...p, rotation: p.rotation + 90 } : null)} className="w-9 h-9 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white/50 hover:text-white hover:bg-white/[0.1] transition-all flex items-center justify-center">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 10h-10a8 8 0 00-8 8v2M21 10l-6 6m6-6l-6-6" /></svg>
              </button>
              <div className="w-px h-6 bg-white/10 mx-0.5" />
              <button onClick={() => setLightbox((p) => p ? { ...p, zoom: Math.max(0.25, p.zoom * 0.8) } : null)} className="w-9 h-9 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white/50 hover:text-white hover:bg-white/[0.1] transition-all flex items-center justify-center text-xl font-light leading-none">−</button>
              <button onClick={() => setLightbox((p) => p ? { ...p, rotation: 0, zoom: 1 } : null)} className="w-12 text-center text-xs text-white/35 hover:text-white/70 transition-colors tabular-nums">{Math.round(lightbox.zoom * 100)}%</button>
              <button onClick={() => setLightbox((p) => p ? { ...p, zoom: Math.min(4, p.zoom * 1.25) } : null)} className="w-9 h-9 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white/50 hover:text-white hover:bg-white/[0.1] transition-all flex items-center justify-center text-xl font-light leading-none">+</button>
              <div className="w-px h-6 bg-white/10 mx-0.5" />
              <button onClick={() => toggleWishlist(lightbox.product.id)} className={`w-9 h-9 rounded-xl border transition-all flex items-center justify-center ${wishlist.has(lightbox.product.id) ? "bg-red-500/15 border-red-500/30 text-red-400" : "bg-white/[0.05] border-white/[0.08] text-white/50 hover:text-red-400"}`}>
                <svg className="w-4 h-4" fill={wishlist.has(lightbox.product.id) ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>
              </button>
              <button onClick={() => { setLightbox(null); openOrder(lightbox.product); }} disabled={lightbox.product.stock === 0} className="hidden sm:flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#2563EB] text-white text-[12px] font-semibold transition-all hover:bg-[#1D4ED8] disabled:opacity-30 disabled:cursor-not-allowed">
                Order now
              </button>
              <button onClick={() => setLightbox(null)} className="w-9 h-9 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white/50 hover:text-white hover:bg-red-500/15 hover:border-red-500/20 transition-all flex items-center justify-center text-sm">✕</button>
            </div>
          </div>
          <div ref={lightboxAreaRef} className="flex-1 flex items-center justify-center overflow-hidden relative" onClick={() => setLightbox(null)}>
            {lightbox.product.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={imgSrc(lightbox.product.image)} alt={lightbox.product.name} onClick={(e) => e.stopPropagation()}
                style={{ transform: `rotate(${lightbox.rotation}deg) scale(${lightbox.zoom})`, transition: "transform 0.3s cubic-bezier(0.4,0,0.2,1)", maxWidth: "88vw", maxHeight: "72vh", objectFit: "contain", borderRadius: 16, boxShadow: "0 30px 80px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.05)", cursor: lightbox.zoom > 1 ? "grab" : "zoom-in" }}
                onError={(e) => { (e.target as HTMLImageElement).src = "https://placehold.co/800x800/1E293B/334155?text=No+Image"; }} />
            ) : (
              <div className="w-72 h-72 bg-white/5 border border-white/10 rounded-3xl flex items-center justify-center text-white/20">No image</div>
            )}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-[11px] text-white/20 pointer-events-none whitespace-nowrap hidden sm:block">
              Scroll to zoom · ← → rotate · 0 reset · Esc close
            </div>
          </div>
          <div className="flex items-center justify-between px-4 sm:px-6 py-3 border-t border-white/[0.06] flex-shrink-0">
            <div className="flex items-center gap-3">
              <StockPill stock={lightbox.product.stock} />
              <span className="text-[17px] font-bold text-white">Rs {lightbox.product.price.toLocaleString()}</span>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => copyShare(lightbox.product)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.05] border border-white/[0.08] text-white/40 hover:text-white text-[12px] font-medium transition-all">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
                Share
              </button>
              <button onClick={() => { setLightbox(null); openOrder(lightbox.product); }} disabled={lightbox.product.stock === 0} className="sm:hidden flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#2563EB] text-white text-[12px] font-semibold hover:bg-[#1D4ED8] disabled:opacity-30 disabled:cursor-not-allowed transition-all">
                Order now
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════ ORDER MODAL ══════════════════ */}
      {orderProduct && (
        <div className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center p-0 sm:p-6 bg-black/50 backdrop-blur-md"
          onClick={() => { setOrderProduct(null); setOrderSuccess(false); }}>
          <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 w-full sm:max-w-lg sm:rounded-3xl rounded-t-3xl overflow-hidden shadow-2xl max-h-[95vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}>
            {orderSuccess ? (
              <div className="p-10 text-center space-y-4">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#2563EB] to-emerald-500 flex items-center justify-center mx-auto shadow-lg shadow-[#2563EB]/20">
                  <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                </div>
                <h3 className="text-[24px] font-bold text-gray-900 dark:text-white">Order placed!</h3>
                <p className="text-gray-500 dark:text-gray-400 text-[15px] leading-relaxed">
                  Thank you, <strong className="text-gray-900 dark:text-white">{orderForm.name}</strong>! We&apos;ve received your order for{" "}
                  <strong className="text-gray-900 dark:text-white">{orderProduct.name}</strong> and will be in touch shortly.
                </p>
                <button onClick={() => { setOrderProduct(null); setOrderSuccess(false); }}
                  className="mt-4 bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-semibold px-8 py-3 rounded-full text-[15px] transition-all">
                  Done
                </button>
              </div>
            ) : (
              <div className="p-6 sm:p-8">
                <div className="flex items-start justify-between mb-6">
                  <div>
                    <h3 className="text-[20px] font-bold text-gray-900 dark:text-white">Place an order</h3>
                    <p className="text-[14px] text-gray-500 dark:text-gray-400 mt-1">Fill in your details to complete</p>
                  </div>
                  <button onClick={() => { setOrderProduct(null); setOrderSuccess(false); }}
                    className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-500 transition-all text-sm flex-shrink-0">✕</button>
                </div>
                <div className="flex items-center gap-4 bg-[#F9FAFB] dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl p-4 mb-6">
                  <div className="relative w-16 h-16 rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-700 flex-shrink-0 cursor-zoom-in"
                    onClick={() => { setOrderProduct(null); openLightbox(orderProduct); }}>
                    {orderProduct.image ? (
                      <Image src={imgSrc(orderProduct.image)} alt={orderProduct.name} fill unoptimized className="object-cover"
                        onError={(e) => { (e.target as HTMLImageElement).src = "https://placehold.co/64x64/F9FAFB/6B7280?text=?"; }} />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">?</div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-gray-900 dark:text-white text-[14px] truncate">{orderProduct.name}</p>
                    {orderProduct.category && <p className="text-[12px] text-[#2563EB] mt-0.5">{orderProduct.category}</p>}
                    <p className="text-[14px] font-bold text-gray-900 dark:text-white mt-1">Rs {orderProduct.price.toLocaleString()} / unit</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button onClick={() => setOrderForm((f) => ({ ...f, quantity: Math.max(1, f.quantity - 1) }))}
                      className="w-8 h-8 rounded-full border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-600 transition-all font-bold text-lg leading-none">−</button>
                    <span className="w-6 text-center text-[14px] font-bold text-gray-900 dark:text-white">{orderForm.quantity}</span>
                    <button onClick={() => setOrderForm((f) => ({ ...f, quantity: Math.min(orderProduct.stock || 99, f.quantity + 1) }))}
                      className="w-8 h-8 rounded-full border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-600 transition-all font-bold text-lg leading-none">+</button>
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {[
                      { label: "Full name", key: "name",  type: "text",  placeholder: "Your name",       required: true },
                      { label: "Email",     key: "email", type: "email", placeholder: "you@example.com", required: true },
                    ].map(({ label, key, type, placeholder, required }) => (
                      <div key={key}>
                        <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
                          {label} {required && <span className="text-red-500">*</span>}
                        </label>
                        <input type={type} value={orderForm[key as keyof OrderForm] as string}
                          onChange={(e) => setOrderForm((f) => ({ ...f, [key]: e.target.value }))}
                          placeholder={placeholder} className={inputCls} />
                      </div>
                    ))}
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Phone</label>
                    <input type="tel" value={orderForm.phone} onChange={(e) => setOrderForm((f) => ({ ...f, phone: e.target.value }))} placeholder="+230 xxx xxxx" className={inputCls} />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Notes</label>
                    <textarea value={orderForm.notes} onChange={(e) => setOrderForm((f) => ({ ...f, notes: e.target.value }))} placeholder="Delivery address, special instructions…" rows={3} className={inputCls + " resize-none"} />
                  </div>
                </div>
                <div className="mt-6 pt-5 border-t border-gray-100 dark:border-gray-800">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-[14px] text-gray-500 dark:text-gray-400">Total ({orderForm.quantity} × Rs {orderProduct.price.toLocaleString()})</span>
                    <span className="text-[22px] font-bold text-gray-900 dark:text-white">Rs {(orderProduct.price * orderForm.quantity).toLocaleString()}</span>
                  </div>
                  <button onClick={handlePlaceOrder} disabled={orderLoading || !orderForm.name.trim() || !orderForm.email.trim()}
                    className="w-full bg-[#2563EB] hover:bg-[#1D4ED8] disabled:opacity-30 disabled:cursor-not-allowed text-white font-bold py-3.5 rounded-2xl transition-all text-[15px] flex items-center justify-center gap-2 shadow-lg shadow-[#2563EB]/20">
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

      {/* Scroll to top */}
      {showScrollTop && (
        <button onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          className="fixed bottom-8 right-6 z-[90] w-11 h-11 rounded-full bg-[#2563EB] text-white hover:bg-[#1D4ED8] transition-all shadow-lg shadow-[#2563EB]/20 flex items-center justify-center"
          title="Back to top">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" /></svg>
        </button>
      )}

      {/* ══════════════════ QUICK VIEW MODAL ══════════════════ */}
      {quickViewProduct && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md"
          onClick={() => { setQuickViewProduct(null); setQuickOrderSuccess(false); }}>
          <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 w-full max-w-2xl rounded-3xl overflow-hidden shadow-2xl max-h-[92vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800">
              <h3 className="text-[16px] font-bold text-gray-900 dark:text-white">Quick View</h3>
              <button onClick={() => { setQuickViewProduct(null); setQuickOrderSuccess(false); }}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-500 transition-all text-sm">✕</button>
            </div>

            {quickOrderSuccess ? (
              <div className="p-10 text-center space-y-4">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#2563EB] to-emerald-500 flex items-center justify-center mx-auto shadow-lg">
                  <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                </div>
                <h3 className="text-[22px] font-bold text-gray-900 dark:text-white">Order placed!</h3>
                <p className="text-gray-500 dark:text-gray-400">
                  Thank you! We&apos;ve received your order for <strong className="text-gray-900 dark:text-white">{quickViewProduct.name}</strong>.
                </p>
                <button onClick={() => { setQuickViewProduct(null); setQuickOrderSuccess(false); }}
                  className="mt-2 bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-semibold px-8 py-3 rounded-full transition-all">Done</button>
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-gray-100 dark:divide-gray-800">
                {/* Image panel */}
                <div className="relative aspect-square bg-gray-50 dark:bg-gray-800">
                  {quickViewProduct.image ? (
                    <Image src={imgSrc(quickViewProduct.image)} alt={quickViewProduct.name} fill unoptimized className="object-cover"
                      onError={(e) => { (e.target as HTMLImageElement).src = "https://placehold.co/500x500/F5F7FA/9CA3AF?text="; }} />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-gray-300 dark:text-gray-600">
                      <svg className="w-16 h-16" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                    </div>
                  )}
                  {quickViewProduct.category && (
                    <span className="absolute top-3 left-3 text-[10px] font-bold bg-[#2563EB] text-white px-2.5 py-1 rounded-full">
                      {quickViewProduct.category}
                    </span>
                  )}
                </div>

                {/* Info + order form */}
                <div className="p-6 space-y-4 overflow-y-auto">
                  <div>
                    <h4 className="text-[18px] font-bold text-gray-900 dark:text-white leading-snug">{quickViewProduct.name}</h4>
                    <div className="flex items-center gap-3 mt-2">
                      <span className="text-[22px] font-black text-gray-900 dark:text-white">Rs {quickViewProduct.price.toLocaleString()}</span>
                      <StockPill stock={quickViewProduct.stock} />
                    </div>
                    {quickViewProduct.description && (
                      <p className="text-[13px] text-gray-500 dark:text-gray-400 mt-2 leading-relaxed line-clamp-3">{quickViewProduct.description}</p>
                    )}
                  </div>

                  <div className="border-t border-gray-100 dark:border-gray-800 pt-4 space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Full name <span className="text-red-500">*</span></label>
                        <input type="text" value={quickOrderForm.name}
                          onChange={(e) => setQuickOrderForm((f) => ({ ...f, name: e.target.value }))}
                          placeholder="Your name" className={inputCls} />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Email <span className="text-red-500">*</span></label>
                        <input type="email" value={quickOrderForm.email}
                          onChange={(e) => setQuickOrderForm((f) => ({ ...f, email: e.target.value }))}
                          placeholder="you@example.com" className={inputCls} />
                      </div>
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Phone</label>
                      <input type="tel" value={quickOrderForm.phone}
                        onChange={(e) => setQuickOrderForm((f) => ({ ...f, phone: e.target.value }))}
                        placeholder="+230 xxx xxxx" className={inputCls} />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Notes</label>
                      <textarea value={quickOrderForm.notes}
                        onChange={(e) => setQuickOrderForm((f) => ({ ...f, notes: e.target.value }))}
                        placeholder="Delivery address, special instructions…" rows={2} className={inputCls + " resize-none"} />
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-[12px] font-semibold text-gray-500 dark:text-gray-400">Qty:</span>
                      <button onClick={() => setQuickOrderForm((f) => ({ ...f, quantity: Math.max(1, f.quantity - 1) }))}
                        className="w-7 h-7 rounded-full border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-600 text-lg leading-none transition-all">−</button>
                      <span className="text-[14px] font-bold text-gray-900 dark:text-white w-5 text-center">{quickOrderForm.quantity}</span>
                      <button onClick={() => setQuickOrderForm((f) => ({ ...f, quantity: Math.min(quickViewProduct.stock || 99, f.quantity + 1) }))}
                        className="w-7 h-7 rounded-full border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-600 text-lg leading-none transition-all">+</button>
                      <span className="ml-auto text-[14px] font-bold text-gray-900 dark:text-white">Rs {(quickViewProduct.price * quickOrderForm.quantity).toLocaleString()}</span>
                    </div>
                    <button onClick={handleQuickOrder} disabled={quickOrderLoading || quickViewProduct.stock === 0 || !quickOrderForm.name.trim() || !quickOrderForm.email.trim()}
                      className="w-full bg-[#2563EB] hover:bg-[#1D4ED8] disabled:opacity-30 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl transition-all text-[14px] flex items-center justify-center gap-2 shadow-lg shadow-[#2563EB]/20">
                      {quickOrderLoading ? (
                        <><svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>Placing…</>
                      ) : quickViewProduct.stock === 0 ? "Sold Out" : `Place Order · Rs ${(quickViewProduct.price * quickOrderForm.quantity).toLocaleString()}`}
                    </button>
                    <Link href={`/product/${quickViewProduct.id}`}
                      className="block text-center text-[13px] text-[#2563EB] hover:text-[#1D4ED8] font-semibold transition-colors">
                      View full details →
                    </Link>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════ COMPARE FLOATING BAR ══════════════════ */}
      {compareIds.size >= 2 && !compareOpen && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-3 bg-gray-900 dark:bg-gray-800 border border-gray-700 text-white px-5 py-3 rounded-2xl shadow-2xl">
          <span className="text-[13px] font-semibold text-gray-300">
            Comparing {compareIds.size} product{compareIds.size > 1 ? "s" : ""}
          </span>
          <div className="flex gap-1.5">
            {[...compareIds].map((id) => {
              const p = products.find((pr) => pr.id === id);
              return p ? (
                <span key={id} className="text-[11px] font-semibold bg-white/10 text-white px-2.5 py-1 rounded-full max-w-[100px] truncate">{p.name}</span>
              ) : null;
            })}
          </div>
          <button onClick={() => setCompareOpen(true)}
            className="bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-[13px] font-semibold px-4 py-1.5 rounded-xl transition-colors flex-shrink-0">
            Compare
          </button>
          <button onClick={() => setCompareIds(new Set())}
            className="text-gray-400 hover:text-white text-[13px] font-semibold transition-colors flex-shrink-0">
            Clear
          </button>
        </div>
      )}

      {/* ══════════════════ COMPARE MODAL ══════════════════ */}
      {compareOpen && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md"
          onClick={() => setCompareOpen(false)}>
          <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 w-full max-w-4xl rounded-3xl overflow-hidden shadow-2xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800">
              <h3 className="text-[16px] font-bold text-gray-900 dark:text-white">Compare Products</h3>
              <div className="flex items-center gap-2">
                <button onClick={() => { setCompareOpen(false); setCompareIds(new Set()); }}
                  className="text-[12px] text-gray-400 hover:text-red-500 font-semibold transition-colors">Clear all</button>
                <button onClick={() => setCompareOpen(false)}
                  className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-500 transition-all text-sm">✕</button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-gray-800">
                    <th className="w-28 px-5 py-3 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Feature</th>
                    {[...compareIds].map((id) => {
                      const p = products.find((pr) => pr.id === id);
                      return (
                        <th key={id} className="px-5 py-3">
                          <div className="flex items-center gap-2">
                            <span className="text-[13px] font-bold text-gray-900 dark:text-white truncate max-w-[120px]">{p?.name ?? "—"}</span>
                            <button onClick={() => { toggleCompare(id); if (compareIds.size <= 2) setCompareOpen(false); }}
                              className="text-gray-300 dark:text-gray-600 hover:text-red-500 text-xs flex-shrink-0">✕</button>
                          </div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {/* Image row */}
                  <tr className="border-b border-gray-50 dark:border-gray-800/60">
                    <td className="px-5 py-4 text-[12px] font-semibold text-gray-400">Image</td>
                    {[...compareIds].map((id) => {
                      const p = products.find((pr) => pr.id === id);
                      return (
                        <td key={id} className="px-5 py-4">
                          <div className="w-20 h-20 rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-800 relative">
                            {p?.image ? (
                              <Image src={imgSrc(p.image)} alt={p.name} fill unoptimized className="object-cover"
                                onError={(e) => { (e.target as HTMLImageElement).src = "https://placehold.co/80x80/F5F7FA/9CA3AF?text="; }} />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-gray-300 text-xs">?</div>
                            )}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                  {/* Price row */}
                  <tr className="border-b border-gray-50 dark:border-gray-800/60">
                    <td className="px-5 py-4 text-[12px] font-semibold text-gray-400">Price</td>
                    {[...compareIds].map((id) => {
                      const p = products.find((pr) => pr.id === id);
                      return <td key={id} className="px-5 py-4 text-[15px] font-black text-gray-900 dark:text-white">Rs {p?.price.toLocaleString() ?? "—"}</td>;
                    })}
                  </tr>
                  {/* Category row */}
                  <tr className="border-b border-gray-50 dark:border-gray-800/60">
                    <td className="px-5 py-4 text-[12px] font-semibold text-gray-400">Category</td>
                    {[...compareIds].map((id) => {
                      const p = products.find((pr) => pr.id === id);
                      return (
                        <td key={id} className="px-5 py-4">
                          {p?.category ? <span className="text-[11px] font-semibold text-[#2563EB] bg-[#2563EB]/10 px-2.5 py-1 rounded-full">{p.category}</span> : <span className="text-gray-400">—</span>}
                        </td>
                      );
                    })}
                  </tr>
                  {/* Stock row */}
                  <tr className="border-b border-gray-50 dark:border-gray-800/60">
                    <td className="px-5 py-4 text-[12px] font-semibold text-gray-400">Stock</td>
                    {[...compareIds].map((id) => {
                      const p = products.find((pr) => pr.id === id);
                      return <td key={id} className="px-5 py-4">{p !== undefined ? <StockPill stock={p.stock} /> : <span className="text-gray-400">—</span>}</td>;
                    })}
                  </tr>
                  {/* Description row */}
                  <tr>
                    <td className="px-5 py-4 text-[12px] font-semibold text-gray-400">Description</td>
                    {[...compareIds].map((id) => {
                      const p = products.find((pr) => pr.id === id);
                      return <td key={id} className="px-5 py-4 text-[12px] text-gray-500 dark:text-gray-400 leading-relaxed max-w-[180px]">{p?.description || "—"}</td>;
                    })}
                  </tr>
                </tbody>
              </table>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-800 flex gap-3 flex-wrap">
              {[...compareIds].map((id) => {
                const p = products.find((pr) => pr.id === id);
                return p ? (
                  <button key={id} onClick={() => { openOrder(p); setCompareOpen(false); }} disabled={p.stock === 0}
                    className="flex-1 min-w-[120px] bg-[#2563EB] hover:bg-[#1D4ED8] disabled:opacity-30 text-white font-semibold py-2.5 rounded-xl text-[13px] transition-colors">
                    {p.stock === 0 ? "Sold Out" : `Order ${p.name.split(" ").slice(0, 2).join(" ")}`}
                  </button>
                ) : null;
              })}
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-8 left-1/2 -translate-x-1/2 z-[200] text-[14px] font-semibold px-6 py-3 rounded-full shadow-2xl transition-all ${
          toast.type === "error" ? "bg-red-500 text-white" : "bg-gray-900 text-white"
        }`}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}
