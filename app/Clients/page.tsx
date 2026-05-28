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

const PAGE_SIZE = 9;

const WHY_SHOP = [
  { icon: "⚡", title: "Fast Delivery",        desc: "Products delivered quickly and safely across Mauritius." },
  { icon: "🛡️", title: "Warranty Included",   desc: "Every product comes with a full manufacturer warranty." },
  { icon: "💎", title: "Best Price Guarantee", desc: "Transparent pricing — no hidden fees, ever." },
  { icon: "🔬", title: "Free Diagnosis",       desc: "Not sure what you need? We help at no extra cost." },
  { icon: "🔒", title: "Secure Ordering",      desc: "Industry-grade encryption protects every transaction." },
  { icon: "💬", title: "24/7 Support",         desc: "Our expert team is always here to assist you." },
];

const MARQUEE_ITEMS = ["⚡ Fast Delivery", "🔒 Secure Orders", "💬 24/7 Support", "✨ Premium Quality", "🚀 Quick Dispatch", "🌟 Best Prices", "🛡️ Warranty Included", "📦 Free Diagnosis"];

function StockPill({ stock }: { stock: number }) {
  if (stock === 0) return <span className="text-[11px] font-semibold text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-2.5 py-1 rounded-full">Sold out</span>;
  if (stock <= 5) return <span className="text-[11px] font-semibold text-[#ff9500] bg-orange-50 dark:bg-orange-900/20 px-2.5 py-1 rounded-full">Only {stock} left</span>;
  return <span className="text-[11px] font-semibold text-[#34c759] dark:text-[#30d158] bg-green-50 dark:bg-green-900/20 px-2.5 py-1 rounded-full">In stock</span>;
}

function imgSrc(url: string) { return url.replace("/object/public/", "/render/image/public/"); }
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
    setToast({ msg, type }); setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
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
      return next;
    });
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
  const heroProducts = products.filter((p) => p.stock > 0 && p.image);

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

  const eb = "text-[12px] font-semibold tracking-[0.14em] text-[#6e6e73] dark:text-[#98989d] uppercase mb-4 block";
  const h2 = "text-[40px] sm:text-[52px] font-bold tracking-tight leading-[1.05] text-[#1d1d1f] dark:text-[#f5f5f7]";
  const cardOnGray = "bg-white dark:bg-[#2c2c2e] border border-[#e8e8ed] dark:border-[#3a3a3c]";
  const cardOnWhite = "bg-[#f5f5f7] dark:bg-[#1c1c1e] border border-transparent";
  const inputCls = "w-full bg-[#f5f5f7] dark:bg-[#2c2c2e] border border-[#d2d2d7] dark:border-[#3a3a3c] rounded-xl px-4 py-2.5 text-[14px] text-[#1d1d1f] dark:text-[#f5f5f7] placeholder-[#b0b0b5] dark:placeholder-[#48484a] focus:outline-none focus:border-[#0071e3] dark:focus:border-[#0a84ff] transition-colors";

  return (
    <div className="min-h-screen bg-white dark:bg-black text-[#1d1d1f] dark:text-[#f5f5f7] overflow-x-hidden">
      <Navbar />

      {/* ══════════════════ HERO ══════════════════ */}
      <section className="relative overflow-hidden bg-white dark:bg-black min-h-[calc(100vh-56px)] flex items-center py-20 px-6 sm:px-10 lg:px-20">
        <div className="pointer-events-none absolute inset-0"
          style={{ background: "radial-gradient(ellipse 80% 60% at 60% 40%, rgba(0,113,227,0.05) 0%, transparent 70%)" }} />

        <div className="relative max-w-7xl mx-auto w-full">
          <div className="grid lg:grid-cols-2 gap-16 items-center">

            {/* LEFT */}
            <div className="flex flex-col gap-10">

              {/* Eyebrow — editorial */}
              <div className="flex items-center gap-3">
                <span className="w-8 h-px bg-[#d2d2d7] dark:bg-[#3a3a3c]" />
                <span className="text-[11px] font-semibold tracking-[0.15em] uppercase text-[#6e6e73] dark:text-[#98989d]">
                  Tech Ninja · The Shop
                </span>
              </div>

              {/* Headline */}
              <div>
                <h1 className="text-[52px] sm:text-[64px] lg:text-[74px] font-bold tracking-tight leading-[0.97]">
                  <span className="text-[#1d1d1f] dark:text-[#f5f5f7]">Explore the</span>
                  <br />
                  <span style={{ background: "linear-gradient(90deg,#0071e3,#34aadc)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
                    collection.
                  </span>
                </h1>
                <p className="mt-6 text-[17px] text-[#6e6e73] dark:text-[#98989d] max-w-[400px] leading-relaxed">
                  Premium devices, accessories &amp; refurbished deals — handpicked for Mauritius.
                </p>
              </div>

              {/* Stats divider */}
              <div className="flex items-stretch border-t border-b border-[#e8e8ed] dark:border-[#3a3a3c] divide-x divide-[#e8e8ed] dark:divide-[#3a3a3c]">
                {[
                  { v: !loading && products.length > 0 ? `${products.length}+` : "500+", l: "Products" },
                  { v: "4.9 ★", l: "Rating"   },
                  { v: "2 yr",  l: "Warranty" },
                ].map(({ v, l }) => (
                  <div key={l} className="flex-1 py-5 px-4 first:pl-0 last:pr-0">
                    <p className="text-[24px] font-bold text-[#1d1d1f] dark:text-[#f5f5f7] tabular-nums leading-none">{v}</p>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[#6e6e73] dark:text-[#98989d] mt-1.5">{l}</p>
                  </div>
                ))}
              </div>

              {/* CTAs */}
              <div className="flex flex-wrap gap-3">
                <a href="#products"
                  className="inline-flex items-center gap-2 bg-[#0071e3] dark:bg-[#0a84ff] hover:bg-[#0077ed] dark:hover:bg-[#409cff] text-white text-[15px] font-semibold px-7 py-3.5 rounded-full transition-colors shadow-sm">
                  Browse all products
                </a>
                <Link href="/"
                  className="inline-flex items-center gap-2 text-[#1d1d1f] dark:text-[#f5f5f7] text-[15px] font-semibold px-7 py-3.5 rounded-full border border-[#d2d2d7] dark:border-[#3a3a3c] hover:border-[#b0b0b5] dark:hover:border-[#48484a] hover:bg-[#f5f5f7] dark:hover:bg-[#1c1c1e] transition-all">
                  Back to home
                </Link>
              </div>

              {/* Category chips */}
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#6e6e73] dark:text-[#98989d] mb-3">Browse by category</p>
                <div className="flex flex-wrap gap-2">
                  {(categories.length > 0
                    ? ["All", ...categories.slice(0, 5)]
                    : ["All", "Phones", "Laptops", "Accessories", "Parts"]
                  ).map((cat) => (
                    <a key={cat} href="#products"
                      onClick={() => { setSelectedCategory(cat === "All" ? "all" : cat); setVisibleCount(PAGE_SIZE); }}
                      className="text-[13px] font-medium text-[#6e6e73] dark:text-[#98989d] border border-[#d2d2d7] dark:border-[#3a3a3c] rounded-full px-4 py-1.5 hover:border-[#0071e3] dark:hover:border-[#0a84ff] hover:text-[#0071e3] dark:hover:text-[#0a84ff] transition-all cursor-pointer">
                      {cat}
                    </a>
                  ))}
                </div>
              </div>
            </div>

            {/* RIGHT */}
            <div className="relative flex items-center justify-center lg:justify-end min-h-[360px] lg:min-h-[520px]">
              <div className="absolute inset-4 rounded-3xl pointer-events-none"
                style={{ background: "radial-gradient(circle, rgba(0,113,227,0.10) 0%, transparent 70%)", filter: "blur(40px)" }} />

              {/* Minimal floating stat chips */}
              <div className="absolute left-0 top-10 z-20 bg-white dark:bg-[#1c1c1e] rounded-2xl px-4 py-3.5 shadow-[0_4px_24px_rgba(0,0,0,0.06)] dark:shadow-[0_4px_24px_rgba(0,0,0,0.35)] border border-[#e8e8ed] dark:border-[#3a3a3c]"
                style={{ animation: "tn-badge 3.5s ease-in-out infinite" }}>
                <p className="text-[20px] font-bold text-[#1d1d1f] dark:text-[#f5f5f7] leading-none tabular-nums">4.9 ★</p>
                <p className="text-[10px] font-semibold text-[#6e6e73] dark:text-[#98989d] uppercase tracking-wider mt-1.5">Customer rating</p>
              </div>

              <div className="absolute right-0 bottom-16 z-20 bg-white dark:bg-[#1c1c1e] rounded-2xl px-4 py-3.5 shadow-[0_4px_24px_rgba(0,0,0,0.06)] dark:shadow-[0_4px_24px_rgba(0,0,0,0.35)] border border-[#e8e8ed] dark:border-[#3a3a3c]"
                style={{ animation: "tn-badge 4s ease-in-out infinite", animationDelay: "1s" }}>
                <p className="text-[20px] font-bold text-[#1d1d1f] dark:text-[#f5f5f7] leading-none tabular-nums">
                  {!loading && products.length > 0 ? `${products.length}+` : "500+"}
                </p>
                <p className="text-[10px] font-semibold text-[#6e6e73] dark:text-[#98989d] uppercase tracking-wider mt-1.5">In stock now</p>
              </div>

              <div className="absolute right-4 top-4 z-20 bg-white dark:bg-[#1c1c1e] rounded-xl px-3.5 py-2.5 shadow-[0_2px_14px_rgba(0,0,0,0.05)] dark:shadow-[0_2px_14px_rgba(0,0,0,0.35)] border border-[#e8e8ed] dark:border-[#3a3a3c]"
                style={{ animation: "tn-badge 5s ease-in-out infinite", animationDelay: "0.5s" }}>
                <p className="text-[12px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">2yr warranty</p>
                <p className="text-[10px] text-[#6e6e73] dark:text-[#98989d] mt-0.5">on all products</p>
              </div>

              {/* Main floating product mosaic */}
              <div className="relative z-10 w-[280px] sm:w-[360px] lg:w-[460px]" style={{ animation: "tn-float 6s ease-in-out infinite" }}>
                <div className="relative rounded-3xl overflow-hidden bg-[#f5f5f7] dark:bg-[#1c1c1e] shadow-[0_20px_60px_rgba(0,0,0,0.12)] dark:shadow-[0_20px_60px_rgba(0,0,0,0.5)] border border-[#e8e8ed]/60 dark:border-[#3a3a3c]/60" style={{ aspectRatio: "4/3" }}>
                  <div className="absolute inset-0 grid grid-cols-2 grid-rows-2 gap-1 p-1">
                    {[0, 1, 2, 3].map((idx) => (
                      <div key={idx}
                        className="relative rounded-2xl overflow-hidden bg-[#e8e8ed] dark:bg-[#2c2c2e] cursor-pointer group"
                        onClick={() => heroProducts[idx] && openLightbox(heroProducts[idx])}>
                        {loading ? (
                          <div className="absolute inset-0 animate-pulse bg-[#e8e8ed] dark:bg-[#2c2c2e]" />
                        ) : heroProducts[idx]?.image ? (
                          <Image src={imgSrc(heroProducts[idx].image)} alt={heroProducts[idx].name} fill unoptimized
                            className="object-cover group-hover:scale-105 transition-transform duration-700"
                            onError={(e) => { (e.target as HTMLImageElement).src = "https://placehold.co/300x300/f5f5f7/86868b?text="; }} />
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════ MARQUEE ══════════════════ */}
      <div className="border-y border-[#e8e8ed] dark:border-[#3a3a3c] py-3.5 overflow-hidden bg-[#f5f5f7] dark:bg-[#1c1c1e]">
        <div className="flex animate-marquee" style={{ width: "max-content" }}>
          {[...Array(4)].flatMap(() => MARQUEE_ITEMS).map((item, i) => (
            <span key={i} className="flex items-center text-[11px] text-[#6e6e73] dark:text-[#98989d] font-semibold uppercase tracking-widest px-8 whitespace-nowrap">
              {item}
              <span className="text-[#d2d2d7] dark:text-[#3a3a3c] ml-8">·</span>
            </span>
          ))}
        </div>
      </div>

      {/* ══════════════════ PRODUCTS ══════════════════ */}
      <section id="products" className="bg-white dark:bg-black py-28 px-6 sm:px-10 lg:px-20">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 mb-12">
            <div>
              <span className={eb}>Browse collection</span>
              <h2 className={h2}>Find your<br />next device.</h2>
            </div>
            <div className="flex items-center gap-3 flex-shrink-0">
              <div className="relative sm:w-56">
                <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6e6e73] dark:text-[#98989d]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                <input type="text" value={search}
                  onChange={(e) => { setSearch(e.target.value); setVisibleCount(PAGE_SIZE); }}
                  placeholder="Search…"
                  className="w-full bg-[#f5f5f7] dark:bg-[#1c1c1e] border border-[#d2d2d7] dark:border-[#3a3a3c] rounded-full pl-11 pr-9 py-3 text-[14px] text-[#1d1d1f] dark:text-[#f5f5f7] placeholder-[#b0b0b5] dark:placeholder-[#48484a] focus:outline-none focus:border-[#0071e3] dark:focus:border-[#0a84ff] transition-colors" />
                {search && (
                  <button onClick={() => { setSearch(""); setVisibleCount(PAGE_SIZE); }} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6e6e73] dark:text-[#98989d] hover:text-[#1d1d1f] dark:hover:text-[#f5f5f7] transition-colors text-sm">✕</button>
                )}
              </div>
              <select value={sortBy} onChange={(e) => setSortBy(e.target.value as "default" | "price-asc" | "price-desc")}
                className="bg-[#f5f5f7] dark:bg-[#1c1c1e] border border-[#d2d2d7] dark:border-[#3a3a3c] text-[#6e6e73] dark:text-[#98989d] text-[14px] rounded-full px-5 py-3 focus:outline-none focus:border-[#0071e3] dark:focus:border-[#0a84ff] cursor-pointer transition-colors flex-shrink-0">
                <option value="default">Sort</option>
                <option value="price-asc">Price ↑</option>
                <option value="price-desc">Price ↓</option>
              </select>
            </div>
          </div>

          {/* Category pills */}
          <div className="relative mb-8">
            {canScrollLeft && (
              <button onClick={() => scrollCats("left")} className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-white dark:bg-[#2c2c2e] border border-[#d2d2d7] dark:border-[#3a3a3c] flex items-center justify-center text-[#6e6e73] dark:text-[#98989d] hover:text-[#1d1d1f] dark:hover:text-[#f5f5f7] transition-all shadow-sm">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
              </button>
            )}
            {canScrollRight && (
              <button onClick={() => scrollCats("right")} className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-white dark:bg-[#2c2c2e] border border-[#d2d2d7] dark:border-[#3a3a3c] flex items-center justify-center text-[#6e6e73] dark:text-[#98989d] hover:text-[#1d1d1f] dark:hover:text-[#f5f5f7] transition-all shadow-sm">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
              </button>
            )}
            <div ref={catScrollRef} className="flex gap-2 overflow-x-auto px-1 py-1" style={{ scrollbarWidth: "none" }}>
              {["all", ...categories].map((cat) => (
                <button key={cat} onClick={() => { setSelectedCategory(cat); setVisibleCount(PAGE_SIZE); }}
                  className={`flex-shrink-0 px-4 py-2 rounded-full text-[12px] font-semibold transition-all whitespace-nowrap flex items-center gap-2 ${
                    selectedCategory === cat
                      ? "bg-[#0071e3] dark:bg-[#0a84ff] text-white shadow-sm"
                      : "bg-[#f5f5f7] dark:bg-[#1c1c1e] border border-[#d2d2d7] dark:border-[#3a3a3c] text-[#6e6e73] dark:text-[#98989d] hover:border-[#b0b0b5] dark:hover:border-[#48484a] hover:text-[#1d1d1f] dark:hover:text-[#f5f5f7]"
                  }`}>
                  {cat === "all" ? "All" : cat}
                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${selectedCategory === cat ? "bg-white/20" : "bg-[#e8e8ed] dark:bg-[#3a3a3c] text-[#6e6e73] dark:text-[#98989d]"}`}>
                    {categoryCounts[cat] || 0}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Recently viewed */}
          {recentlyViewed.length > 1 && (
            <div className="mb-8">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[#6e6e73] dark:text-[#98989d] mb-3 flex items-center gap-2">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                Recently viewed
              </p>
              <div className="flex gap-2.5">
                {recentlyViewed.map((p) => (
                  <Link key={p.id} href={`/product/${p.id}`} title={p.name}
                    className="flex-shrink-0 w-12 h-12 rounded-xl overflow-hidden bg-[#f5f5f7] dark:bg-[#1c1c1e] border border-[#e8e8ed] dark:border-[#3a3a3c] hover:border-[#0071e3] dark:hover:border-[#0a84ff] transition-all hover:scale-110 relative block">
                    {p.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={imgSrc(p.image)} alt={p.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-[#6e6e73] text-xs">?</div>
                    )}
                  </Link>
                ))}
              </div>
            </div>
          )}

          {!loading && (
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[#6e6e73] dark:text-[#98989d] mb-6">
              {filtered.length} product{filtered.length !== 1 ? "s" : ""}{selectedCategory !== "all" ? ` · ${selectedCategory}` : ""}
            </p>
          )}

          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[...Array(9)].map((_, i) => (
                <div key={i} className={`rounded-3xl overflow-hidden ${cardOnWhite}`}>
                  <div className="aspect-[3/4] animate-pulse bg-[#e8e8ed] dark:bg-[#2c2c2e]" />
                  <div className="p-5 space-y-2.5">
                    <div className="h-2.5 bg-[#e8e8ed] dark:bg-[#2c2c2e] rounded-full w-1/3 animate-pulse" />
                    <div className="h-4 bg-[#e8e8ed] dark:bg-[#2c2c2e] rounded-full w-3/4 animate-pulse" />
                  </div>
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-32">
              <div className="text-5xl mb-6">🔍</div>
              <p className="text-[22px] font-bold text-[#6e6e73] dark:text-[#98989d] mb-2">No products found</p>
              <p className="text-[15px] text-[#6e6e73] dark:text-[#98989d]">Try adjusting your search or filters</p>
              {search && (
                <button onClick={() => setSearch("")} className="mt-6 text-[#0071e3] dark:text-[#0a84ff] text-[15px] hover:text-[#0077ed] underline transition-colors">
                  Clear search
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {visible.map((product, index) => (
                  <Link key={product.id} href={`/product/${product.id}`}
                    className={`group relative rounded-3xl overflow-hidden hover:-translate-y-1 hover:shadow-[0_8px_32px_rgba(0,0,0,0.10)] dark:hover:shadow-[0_8px_32px_rgba(0,0,0,0.5)] transition-all duration-300 cursor-pointer animate-fade-in-up block ${cardOnWhite}`}
                    style={{ animationDelay: `${Math.min(index * 0.06, 0.5)}s` }}>
                    <div className="relative overflow-hidden" style={{ aspectRatio: "3/4" }}>
                      {product.image ? (
                        <Image src={imgSrc(product.image)} alt={product.name} fill unoptimized
                          className="object-cover group-hover:scale-[1.04] transition-transform duration-500"
                          onError={(e) => { (e.target as HTMLImageElement).src = "https://placehold.co/600x800/f5f5f7/86868b?text="; }} />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-[#6e6e73] dark:text-[#98989d] text-sm">No image</div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/5 to-transparent" />
                      {product.stock === 0 && (
                        <div className="absolute inset-0 bg-white/50 dark:bg-black/60 backdrop-blur-sm flex items-center justify-center">
                          <span className="text-[12px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] bg-white dark:bg-[#2c2c2e] px-4 py-2 rounded-full shadow-sm">Sold out</span>
                        </div>
                      )}
                      {isNew(product) && (
                        <div className="absolute top-3 left-3 z-10">
                          <span className="text-[11px] font-semibold bg-[#0071e3] dark:bg-[#0a84ff] text-white px-2.5 py-1 rounded-full">New</span>
                        </div>
                      )}
                      <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleWishlist(product.id); }}
                        className={`absolute top-3 right-3 z-10 w-8 h-8 rounded-full flex items-center justify-center transition-all backdrop-blur-sm ${wishlist.has(product.id) ? "bg-red-500/20 border border-red-500/30 text-red-400" : "bg-black/20 border border-white/10 text-white/50 hover:text-red-400"}`}>
                        <svg className="w-4 h-4" fill={wishlist.has(product.id) ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                        </svg>
                      </button>
                      <div className="absolute bottom-0 left-0 right-0 p-4">
                        {product.category && <p className="text-[11px] font-semibold uppercase tracking-wider text-white/60 mb-1">{product.category}</p>}
                        <p className="text-white font-bold text-[15px] leading-tight line-clamp-1 mb-0.5">{product.name}</p>
                        <div className="flex items-center justify-between">
                          <p className="text-white/80 text-[13px] font-semibold">Rs {product.price.toLocaleString()}</p>
                          <StockPill stock={product.stock} />
                        </div>
                      </div>
                      <div className="absolute inset-x-4 bottom-[4.5rem] translate-y-3 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300">
                        <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); openOrder(product); }} disabled={product.stock === 0}
                          className="w-full bg-white dark:bg-[#f5f5f7] text-[#1d1d1f] font-semibold py-2.5 rounded-2xl text-[14px] hover:bg-[#f5f5f7] disabled:opacity-40 disabled:cursor-not-allowed shadow-xl transition-all">
                          {product.stock === 0 ? "Sold out" : "Order now"}
                        </button>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
              {visibleCount < sorted.length && (
                <div className="text-center mt-12">
                  <button onClick={() => setVisibleCount((v) => v + PAGE_SIZE)}
                    className="bg-[#f5f5f7] dark:bg-[#1c1c1e] border border-[#d2d2d7] dark:border-[#3a3a3c] text-[#1d1d1f] dark:text-[#f5f5f7] font-semibold px-10 py-3.5 rounded-full text-[15px] hover:bg-[#e8e8ed] dark:hover:bg-[#2c2c2e] transition-all">
                    Load more · {sorted.length - visibleCount} remaining
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </section>

      {/* ══════════════════ WHY CHOOSE US ══════════════════ */}
      <section className="bg-[#f5f5f7] dark:bg-[#1c1c1e] py-28 px-6 sm:px-10 lg:px-20">
        <div className="max-w-7xl mx-auto">
          <div className="mb-16">
            <span className={eb}>Why choose us</span>
            <h2 className={h2}>Shopping made<br />simple.</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {WHY_SHOP.map((item) => (
              <div key={item.title}
                className={`group p-7 rounded-3xl ${cardOnGray} hover:shadow-[0_4px_20px_rgba(0,0,0,0.06)] dark:hover:shadow-[0_4px_20px_rgba(0,0,0,0.4)] transition-all duration-300`}>
                <span className="text-2xl block mb-4">{item.icon}</span>
                <h3 className="text-[15px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] mb-2">{item.title}</h3>
                <p className="text-[14px] text-[#6e6e73] dark:text-[#98989d] leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════ FOOTER CTA ══════════════════ */}
      <section className="bg-[#1d1d1f] dark:bg-[#000000] py-32 px-6 sm:px-10 lg:px-20">
        <div className="max-w-7xl mx-auto">
          <p className="text-[12px] font-semibold tracking-[0.2em] uppercase text-[#6e6e73] mb-8">Start shopping today</p>
          <h2 className="text-[56px] sm:text-[68px] md:text-[80px] font-bold text-white tracking-tight leading-[0.94] max-w-2xl mb-8">
            Your next<br />device awaits.
          </h2>
          <p className="text-[17px] text-[#6e6e73] mb-12 max-w-sm leading-relaxed">
            Premium tech at the best prices — with warranty, fast delivery, and expert support.
          </p>
          <div className="flex flex-wrap gap-3">
            <a href="#products" className="inline-flex items-center gap-2 bg-white text-[#1d1d1f] text-[15px] font-semibold px-7 py-3.5 rounded-full hover:bg-[#f5f5f7] transition-colors">
              Browse collection
            </a>
            <Link href="/" className="inline-flex items-center gap-2 text-[#6e6e73] hover:text-white border border-[#424245] hover:border-[#6e6e73] text-[15px] font-semibold px-7 py-3.5 rounded-full transition-all">
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
                <span className="hidden sm:block text-[11px] font-semibold text-[#0a84ff] bg-[#0a84ff]/15 px-2.5 py-0.5 rounded-full flex-shrink-0">{lightbox.product.category}</span>
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
              <button onClick={() => { setLightbox(null); openOrder(lightbox.product); }} disabled={lightbox.product.stock === 0} className="hidden sm:flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white text-black text-[12px] font-semibold transition-all hover:bg-[#f5f5f7] disabled:opacity-30 disabled:cursor-not-allowed">
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
                onError={(e) => { (e.target as HTMLImageElement).src = "https://placehold.co/800x800/1c1c1e/3a3a3c?text=No+Image"; }} />
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
              <span className="text-[17px] font-bold text-white">Rs {lightbox.product.price.toLocaleString()}</span>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => copyShare(lightbox.product)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.05] border border-white/[0.08] text-white/40 hover:text-white text-[12px] font-medium transition-all">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
                Share
              </button>
              <button onClick={() => { setLightbox(null); openOrder(lightbox.product); }} disabled={lightbox.product.stock === 0} className="sm:hidden flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white text-black text-[12px] font-semibold hover:bg-[#f5f5f7] disabled:opacity-30 disabled:cursor-not-allowed transition-all">
                Order now
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════ ORDER MODAL ══════════════════ */}
      {orderProduct && (
        <div className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center p-0 sm:p-6 bg-black/40 dark:bg-black/70 backdrop-blur-md"
          onClick={() => { setOrderProduct(null); setOrderSuccess(false); }}>
          <div className="bg-white dark:bg-[#2c2c2e] border border-[#e8e8ed] dark:border-[#3a3a3c] w-full sm:max-w-lg sm:rounded-3xl rounded-t-3xl overflow-hidden shadow-2xl max-h-[95vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}>
            {orderSuccess ? (
              <div className="p-10 text-center space-y-4">
                <div className="w-16 h-16 rounded-full bg-[#e8f0fb] dark:bg-[#0a84ff]/15 flex items-center justify-center mx-auto">
                  <svg className="w-8 h-8 text-[#0071e3] dark:text-[#0a84ff]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                </div>
                <h3 className="text-[24px] font-bold text-[#1d1d1f] dark:text-[#f5f5f7]">Order placed!</h3>
                <p className="text-[#6e6e73] dark:text-[#98989d] text-[15px] leading-relaxed">
                  Thank you, <strong className="text-[#1d1d1f] dark:text-[#f5f5f7]">{orderForm.name}</strong>! We&apos;ve received your order for{" "}
                  <strong className="text-[#1d1d1f] dark:text-[#f5f5f7]">{orderProduct.name}</strong> and will be in touch shortly.
                </p>
                <button onClick={() => { setOrderProduct(null); setOrderSuccess(false); }}
                  className="mt-4 bg-[#f5f5f7] dark:bg-[#3a3a3c] border border-[#d2d2d7] dark:border-[#48484a] text-[#1d1d1f] dark:text-[#f5f5f7] font-semibold px-8 py-3 rounded-2xl text-[15px] hover:bg-[#e8e8ed] dark:hover:bg-[#48484a] transition-all">
                  Done
                </button>
              </div>
            ) : (
              <div className="p-6 sm:p-8">
                <div className="flex items-start justify-between mb-6">
                  <div>
                    <h3 className="text-[20px] font-bold text-[#1d1d1f] dark:text-[#f5f5f7]">Place an order</h3>
                    <p className="text-[14px] text-[#6e6e73] dark:text-[#98989d] mt-1">Fill in your details to complete</p>
                  </div>
                  <button onClick={() => { setOrderProduct(null); setOrderSuccess(false); }}
                    className="w-8 h-8 flex items-center justify-center rounded-full bg-[#f5f5f7] dark:bg-[#3a3a3c] hover:bg-[#e8e8ed] dark:hover:bg-[#48484a] text-[#6e6e73] dark:text-[#98989d] transition-all text-sm flex-shrink-0">✕</button>
                </div>
                <div className="flex items-center gap-4 bg-[#f5f5f7] dark:bg-[#1c1c1e] border border-[#e8e8ed] dark:border-[#3a3a3c] rounded-2xl p-4 mb-6">
                  <div className="relative w-16 h-16 rounded-xl overflow-hidden bg-[#e8e8ed] dark:bg-[#2c2c2e] flex-shrink-0 cursor-zoom-in"
                    onClick={() => { setOrderProduct(null); openLightbox(orderProduct); }}>
                    {orderProduct.image ? (
                      <Image src={imgSrc(orderProduct.image)} alt={orderProduct.name} fill unoptimized className="object-cover"
                        onError={(e) => { (e.target as HTMLImageElement).src = "https://placehold.co/64x64/f5f5f7/86868b?text=?"; }} />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-[#6e6e73] text-xs">?</div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-[#1d1d1f] dark:text-[#f5f5f7] text-[14px] truncate">{orderProduct.name}</p>
                    {orderProduct.category && <p className="text-[12px] text-[#0071e3] dark:text-[#0a84ff] mt-0.5">{orderProduct.category}</p>}
                    <p className="text-[14px] font-bold text-[#1d1d1f] dark:text-[#f5f5f7] mt-1">Rs {orderProduct.price.toLocaleString()} / unit</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button onClick={() => setOrderForm((f) => ({ ...f, quantity: Math.max(1, f.quantity - 1) }))}
                      className="w-8 h-8 rounded-full border border-[#d2d2d7] dark:border-[#3a3a3c] bg-[#f5f5f7] dark:bg-[#2c2c2e] flex items-center justify-center text-[#6e6e73] dark:text-[#98989d] hover:bg-[#e8e8ed] dark:hover:bg-[#3a3a3c] transition-all font-bold text-lg leading-none">−</button>
                    <span className="w-6 text-center text-[14px] font-bold text-[#1d1d1f] dark:text-[#f5f5f7]">{orderForm.quantity}</span>
                    <button onClick={() => setOrderForm((f) => ({ ...f, quantity: Math.min(orderProduct.stock || 99, f.quantity + 1) }))}
                      className="w-8 h-8 rounded-full border border-[#d2d2d7] dark:border-[#3a3a3c] bg-[#f5f5f7] dark:bg-[#2c2c2e] flex items-center justify-center text-[#6e6e73] dark:text-[#98989d] hover:bg-[#e8e8ed] dark:hover:bg-[#3a3a3c] transition-all font-bold text-lg leading-none">+</button>
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {[
                      { label: "Full name", key: "name",  type: "text",  placeholder: "Your name",        required: true  },
                      { label: "Email",     key: "email", type: "email", placeholder: "you@example.com",  required: true  },
                    ].map(({ label, key, type, placeholder, required }) => (
                      <div key={key}>
                        <label className="block text-[11px] font-semibold text-[#6e6e73] dark:text-[#98989d] uppercase tracking-wider mb-1.5">
                          {label} {required && <span className="text-red-500">*</span>}
                        </label>
                        <input type={type} value={orderForm[key as keyof OrderForm] as string}
                          onChange={(e) => setOrderForm((f) => ({ ...f, [key]: e.target.value }))}
                          placeholder={placeholder} className={inputCls} />
                      </div>
                    ))}
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-[#6e6e73] dark:text-[#98989d] uppercase tracking-wider mb-1.5">Phone</label>
                    <input type="tel" value={orderForm.phone} onChange={(e) => setOrderForm((f) => ({ ...f, phone: e.target.value }))} placeholder="+230 xxx xxxx" className={inputCls} />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-[#6e6e73] dark:text-[#98989d] uppercase tracking-wider mb-1.5">Notes</label>
                    <textarea value={orderForm.notes} onChange={(e) => setOrderForm((f) => ({ ...f, notes: e.target.value }))} placeholder="Delivery address, special instructions…" rows={3} className={inputCls + " resize-none"} />
                  </div>
                </div>
                <div className="mt-6 pt-5 border-t border-[#e8e8ed] dark:border-[#3a3a3c]">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-[14px] text-[#6e6e73] dark:text-[#98989d]">Total ({orderForm.quantity} × Rs {orderProduct.price.toLocaleString()})</span>
                    <span className="text-[22px] font-bold text-[#1d1d1f] dark:text-[#f5f5f7]">Rs {(orderProduct.price * orderForm.quantity).toLocaleString()}</span>
                  </div>
                  <button onClick={handlePlaceOrder} disabled={orderLoading || !orderForm.name.trim() || !orderForm.email.trim()}
                    className="w-full bg-[#0071e3] dark:bg-[#0a84ff] hover:bg-[#0077ed] disabled:opacity-30 disabled:cursor-not-allowed text-white font-semibold py-3.5 rounded-2xl transition-all text-[15px] flex items-center justify-center gap-2">
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

      {/* ══════════════════ SCROLL TO TOP ══════════════════ */}
      {showScrollTop && (
        <button onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          className="fixed bottom-8 right-6 z-[90] w-11 h-11 rounded-full bg-[#1d1d1f] dark:bg-[#f5f5f7] text-white dark:text-[#1d1d1f] hover:bg-black dark:hover:bg-white transition-all shadow-xl flex items-center justify-center"
          title="Back to top">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" /></svg>
        </button>
      )}

      {/* ══════════════════ TOAST ══════════════════ */}
      {toast && (
        <div className={`fixed bottom-8 left-1/2 -translate-x-1/2 z-[200] text-[14px] font-semibold px-6 py-3 rounded-full shadow-2xl transition-all ${
          toast.type === "error" ? "bg-red-500 text-white" : "bg-[#1d1d1f] dark:bg-[#f5f5f7] text-white dark:text-[#1d1d1f]"
        }`}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}
