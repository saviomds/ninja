"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import Image from "next/image";
import Link from "next/link";
import { User } from "@supabase/supabase-js";

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

const PAGE_SIZE = 6;

function StockPill({ stock }: { stock: number }) {
  if (stock === 0)
    return (
      <span className="text-xs font-semibold text-red-500 bg-red-50 px-2.5 py-1 rounded-full">
        Sold out
      </span>
    );
  if (stock <= 5)
    return (
      <span className="text-xs font-semibold text-amber-600 bg-amber-50 px-2.5 py-1 rounded-full">
        Only {stock} left
      </span>
    );
  return (
    <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full">
      In stock
    </span>
  );
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
  const [orderProduct, setOrderProduct] = useState<Product | null>(null);
  const [orderForm, setOrderForm] = useState<OrderForm>({ name: "", email: "", phone: "", notes: "", quantity: 1 });
  const [orderLoading, setOrderLoading] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(false);

  const catScrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const isAdmin = (user?.app_metadata?.role || user?.user_metadata?.role) === "admin";

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

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

  const checkScrollArrows = () => {
    const el = catScrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  };

  useEffect(() => {
    checkScrollArrows();
    const el = catScrollRef.current;
    if (el) el.addEventListener("scroll", checkScrollArrows);
    window.addEventListener("resize", checkScrollArrows);
    return () => {
      el?.removeEventListener("scroll", checkScrollArrows);
      window.removeEventListener("resize", checkScrollArrows);
    };
  }, [categories]);

  const scrollCats = (dir: "left" | "right") => {
    const el = catScrollRef.current;
    if (el) el.scrollBy({ left: dir === "left" ? -200 : 200, behavior: "smooth" });
  };

  const filtered = products.filter((p) => {
    const matchCat = selectedCategory === "all" || p.category === selectedCategory;
    const matchSearch =
      !search.trim() ||
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.description || "").toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  const visible = filtered.slice(0, visibleCount);

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
    if (error) {
      showToast("Failed to place order. Please try again.", "error");
    } else {
      setOrderSuccess(true);
    }
  };

  return (
    <div className="min-h-screen bg-[#f5f5f7]" style={{ fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>

      {/* ── Nav ──────────────────────────────────────────────────────────────── */}
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-gray-200/60">
        <div className="max-w-6xl mx-auto px-5 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 hover:opacity-75 transition-opacity">
            <Image src="/logo.png" alt="Tech Ninja" width={32} height={32} unoptimized className="object-contain" />
            <span className="text-base font-semibold text-gray-900 tracking-tight">Tech Ninja</span>
          </Link>

          <div className="flex items-center gap-3">
            {isAdmin && (
              <Link href="/dashboard" className="text-xs font-semibold px-4 py-1.5 rounded-full bg-gray-900 text-white hover:bg-gray-700 transition-colors">
                Dashboard
              </Link>
            )}
            {!user ? (
              <Link href="/login" className="text-sm font-medium text-[#0071e3] hover:underline">
                Sign in
              </Link>
            ) : !isAdmin ? (
              <button onClick={() => supabase.auth.signOut()} className="text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors">
                Sign out
              </button>
            ) : null}
          </div>
        </div>
      </nav>

      {/* ── Hero ─────────────────────────────────────────────────────────────── */}
      <section className="relative pt-20 pb-16 text-center px-6 overflow-hidden">
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-indigo-400/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-10 right-10 w-64 h-64 bg-violet-400/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10">
          <span className="inline-flex items-center gap-2 text-xs font-semibold text-[#0071e3] bg-blue-50 border border-blue-100 px-4 py-1.5 rounded-full mb-5 uppercase tracking-widest">
            <span className="w-1.5 h-1.5 rounded-full bg-[#0071e3] animate-pulse" />
            New arrivals
          </span>
          <h1 className="text-5xl md:text-7xl font-bold text-[#1d1d1f] tracking-tight leading-none mb-5">
            Our Collection.
          </h1>
          <p className="text-xl text-[#6e6e73] max-w-xl mx-auto leading-relaxed mb-8">
            Premium products, each crafted with intention and built to last.
          </p>
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <a href="#products" className="bg-[#0071e3] hover:bg-[#0077ed] text-white font-semibold px-7 py-3 rounded-full text-sm transition-colors shadow-lg shadow-blue-500/20">
              Shop now
            </a>
            {!user && (
              <Link href="/login" className="bg-white border border-gray-200 text-gray-900 font-semibold px-7 py-3 rounded-full text-sm hover:bg-gray-50 transition-colors">
                Sign in
              </Link>
            )}
          </div>
        </div>
      </section>

      {/* ── Search ───────────────────────────────────────────────────────────── */}
      <div className="max-w-xl mx-auto px-5 mb-6">
        <div className="relative">
          <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setVisibleCount(PAGE_SIZE); }}
            placeholder="Search products…"
            className="w-full bg-white rounded-full pl-11 pr-5 py-3 text-sm text-gray-800 placeholder-gray-400 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#0071e3]/30 focus:border-[#0071e3] transition shadow-sm"
          />
        </div>
      </div>

      {/* ── Category scroll ──────────────────────────────────────────────────── */}
      <div className="max-w-6xl mx-auto px-5 mb-10 relative">
        {canScrollLeft && (
          <button
            onClick={() => scrollCats("left")}
            className="absolute left-2 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-white shadow-md border border-gray-100 flex items-center justify-center text-gray-600 hover:bg-gray-50 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          </button>
        )}
        {canScrollRight && (
          <button
            onClick={() => scrollCats("right")}
            className="absolute right-2 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-white shadow-md border border-gray-100 flex items-center justify-center text-gray-600 hover:bg-gray-50 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
          </button>
        )}
        <div
          ref={catScrollRef}
          className="flex gap-2 overflow-x-auto scrollbar-hide px-1 py-1"
          style={{ scrollbarWidth: "none" }}
        >
          {["all", ...categories].map((cat) => (
            <button
              key={cat}
              onClick={() => { setSelectedCategory(cat); setVisibleCount(PAGE_SIZE); }}
              className={`flex-shrink-0 px-5 py-2 rounded-full text-sm font-medium transition-all whitespace-nowrap ${
                selectedCategory === cat
                  ? "bg-gray-900 text-white shadow"
                  : "bg-white text-gray-600 border border-gray-200 hover:border-gray-400"
              }`}
            >
              {cat === "all" ? "All" : cat}
            </button>
          ))}
        </div>
      </div>

      {/* ── Products ─────────────────────────────────────────────────────────── */}
      <main id="products" className="max-w-6xl mx-auto px-5 pb-10">
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-white rounded-3xl overflow-hidden animate-pulse">
                <div className="aspect-square bg-gray-100" />
                <div className="p-6 space-y-3">
                  <div className="h-5 bg-gray-100 rounded-full w-3/4" />
                  <div className="h-4 bg-gray-100 rounded-full w-1/2" />
                  <div className="h-6 bg-gray-100 rounded-full w-1/3" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-32 text-gray-400">
            <p className="text-5xl mb-4">🔍</p>
            <p className="text-lg font-medium">No products found.</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {visible.map((product) => (
                <article key={product.id} className="group bg-white rounded-3xl overflow-hidden hover:shadow-2xl hover:shadow-black/10 transition-all duration-300 hover:-translate-y-1">
                  <div
                    className="aspect-square bg-[#f5f5f7] relative overflow-hidden cursor-pointer"
                    onClick={() => setQuickView(product)}
                  >
                    {product.image ? (
                      <Image
                        src={product.image.replace("/object/public/", "/render/image/public/")}
                        alt={product.name}
                        fill
                        unoptimized
                        className="object-cover group-hover:scale-105 transition-transform duration-500"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = "https://placehold.co/600x600/f5f5f7/9ca3af?text=No+Image";
                        }}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-300 text-sm">No image</div>
                    )}
                    {product.stock === 0 && (
                      <div className="absolute inset-0 bg-white/70 flex items-center justify-center">
                        <span className="text-xs font-bold uppercase tracking-widest text-gray-500 bg-white px-4 py-2 rounded-full border border-gray-200">Sold out</span>
                      </div>
                    )}
                    <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
                      <span className="text-xs font-medium bg-black/70 text-white px-3 py-1 rounded-full">Quick view</span>
                    </div>
                  </div>

                  <div className="px-6 py-5">
                    {product.category && (
                      <p className="text-xs font-semibold uppercase tracking-widest text-[#0071e3] mb-1">{product.category}</p>
                    )}
                    <h2 className="text-base font-semibold text-[#1d1d1f] leading-snug mb-1 line-clamp-1">{product.name}</h2>
                    <p className="text-sm text-[#6e6e73] line-clamp-2 mb-3 leading-relaxed">{product.description || "—"}</p>
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-xl font-bold text-[#1d1d1f]">Rs {product.price.toLocaleString()}</span>
                      <StockPill stock={product.stock} />
                    </div>
                    <button
                      onClick={() => openOrder(product)}
                      disabled={product.stock === 0}
                      className="w-full bg-[#0071e3] hover:bg-[#0077ed] active:bg-[#006bce] disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold py-2.5 rounded-2xl transition-colors text-sm"
                    >
                      Order now
                    </button>
                  </div>
                </article>
              ))}
            </div>

            {visibleCount < filtered.length && (
              <div className="text-center mt-12">
                <button
                  onClick={() => setVisibleCount((v) => v + PAGE_SIZE)}
                  className="bg-white border border-gray-200 text-gray-900 font-semibold px-10 py-3 rounded-full text-sm hover:bg-gray-50 hover:border-gray-400 transition-all shadow-sm"
                >
                  See more ({filtered.length - visibleCount} remaining)
                </button>
              </div>
            )}
          </>
        )}
      </main>

      {/* ── Features strip ───────────────────────────────────────────────────── */}
      <section className="bg-white border-t border-b border-gray-100 py-14 mt-8">
        <div className="max-w-5xl mx-auto px-5 grid grid-cols-1 sm:grid-cols-3 gap-10 text-center">
          {[
            { icon: "🚀", title: "Fast delivery", desc: "Get your orders delivered quickly across Mauritius." },
            { icon: "🔒", title: "Secure ordering", desc: "Your details are protected with industry-standard encryption." },
            { icon: "💬", title: "Real-time support", desc: "Our team is always available to help with your order." },
          ].map(({ icon, title, desc }) => (
            <div key={title} className="flex flex-col items-center gap-3">
              <span className="text-3xl">{icon}</span>
              <h3 className="text-base font-semibold text-[#1d1d1f]">{title}</h3>
              <p className="text-sm text-[#6e6e73] leading-relaxed max-w-xs">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────────────────── */}
      <footer className="py-12 px-5 bg-[#f5f5f7] border-t border-gray-200">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-6 mb-8">
            <Link href="/" className="flex items-center gap-2 hover:opacity-75 transition-opacity">
              <Image src="/logo.png" alt="Tech Ninja" width={28} height={28} unoptimized className="object-contain" />
              <span className="text-base font-semibold text-[#1d1d1f]">Tech Ninja</span>
            </Link>
            <div className="flex flex-wrap justify-center gap-x-6 gap-y-2">
              {categories.slice(0, 5).map((cat) => (
                <button
                  key={cat}
                  onClick={() => { setSelectedCategory(cat); setVisibleCount(PAGE_SIZE); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                  className="text-sm text-[#6e6e73] hover:text-[#1d1d1f] transition-colors"
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>
          <div className="border-t border-gray-200 pt-6 text-center text-xs text-gray-400">
            © {new Date().getFullYear()} Tech Ninja. All rights reserved. · Mauritius
          </div>
        </div>
      </footer>

      {/* ── Quick view modal ─────────────────────────────────────────────────── */}
      {quickView && (
        <div
          className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-6 bg-black/40 backdrop-blur-sm"
          onClick={() => setQuickView(null)}
        >
          <div
            className="bg-white w-full sm:max-w-2xl sm:rounded-3xl rounded-t-3xl overflow-hidden shadow-2xl flex flex-col sm:flex-row max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative w-full sm:w-1/2 aspect-square bg-[#f5f5f7] flex-shrink-0">
              {quickView.image ? (
                <Image
                  src={quickView.image.replace("/object/public/", "/render/image/public/")}
                  alt={quickView.name}
                  fill
                  unoptimized
                  className="object-cover"
                  onError={(e) => { (e.target as HTMLImageElement).src = "https://placehold.co/600x600/f5f5f7/9ca3af?text=No+Image"; }}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-300 text-sm">No image</div>
              )}
            </div>
            <div className="flex flex-col flex-1 p-8 overflow-y-auto">
              <button
                onClick={() => setQuickView(null)}
                className="self-end w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 transition-colors mb-4 text-sm font-bold"
              >
                ✕
              </button>
              {quickView.category && (
                <p className="text-xs font-semibold uppercase tracking-widest text-[#0071e3] mb-2">{quickView.category}</p>
              )}
              <h2 className="text-2xl font-bold text-[#1d1d1f] leading-tight mb-2">{quickView.name}</h2>
              <p className="text-3xl font-bold text-[#1d1d1f] mb-4">Rs {quickView.price.toLocaleString()}</p>
              <div className="mb-4"><StockPill stock={quickView.stock} /></div>
              <p className="text-sm text-[#6e6e73] leading-relaxed flex-1 mb-8 whitespace-pre-wrap">{quickView.description || "No description available."}</p>
              <button
                onClick={() => { setQuickView(null); openOrder(quickView); }}
                disabled={quickView.stock === 0}
                className="w-full bg-[#0071e3] hover:bg-[#0077ed] disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold py-3.5 rounded-2xl transition-colors text-sm"
              >
                Order now
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Order modal ──────────────────────────────────────────────────────── */}
      {orderProduct && (
        <div
          className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center p-0 sm:p-6 bg-black/50 backdrop-blur-sm"
          onClick={() => { setOrderProduct(null); setOrderSuccess(false); }}
        >
          <div
            className="bg-white w-full sm:max-w-lg sm:rounded-3xl rounded-t-3xl overflow-hidden shadow-2xl max-h-[95vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {orderSuccess ? (
              <div className="p-10 text-center space-y-4">
                <div className="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center mx-auto">
                  <svg className="w-8 h-8 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h3 className="text-2xl font-bold text-gray-900">Order placed!</h3>
                <p className="text-gray-500 text-sm leading-relaxed">
                  Thank you, <strong>{orderForm.name}</strong>! We&apos;ve received your order for{" "}
                  <strong>{orderProduct.name}</strong> and will be in touch shortly.
                </p>
                <button
                  onClick={() => { setOrderProduct(null); setOrderSuccess(false); }}
                  className="mt-4 bg-gray-900 text-white font-semibold px-8 py-3 rounded-2xl text-sm hover:bg-gray-800 transition-colors"
                >
                  Done
                </button>
              </div>
            ) : (
              <div className="p-6 sm:p-8">
                <div className="flex items-start justify-between mb-6">
                  <div>
                    <h3 className="text-xl font-bold text-gray-900">Place an order</h3>
                    <p className="text-sm text-gray-500 mt-1">Fill in your details to complete the order</p>
                  </div>
                  <button
                    onClick={() => { setOrderProduct(null); setOrderSuccess(false); }}
                    className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 transition-colors text-sm font-bold flex-shrink-0"
                  >
                    ✕
                  </button>
                </div>

                {/* Product mini-card */}
                <div className="flex items-center gap-4 bg-gray-50 rounded-2xl p-4 mb-6">
                  <div className="relative w-16 h-16 rounded-xl overflow-hidden bg-gray-100 flex-shrink-0">
                    {orderProduct.image ? (
                      <Image
                        src={orderProduct.image.replace("/object/public/", "/render/image/public/")}
                        alt={orderProduct.name}
                        fill
                        unoptimized
                        className="object-cover"
                        onError={(e) => { (e.target as HTMLImageElement).src = "https://placehold.co/64x64/f5f5f7/9ca3af?text=?"; }}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-300 text-xs">?</div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 text-sm truncate">{orderProduct.name}</p>
                    {orderProduct.category && <p className="text-xs text-[#0071e3] mt-0.5">{orderProduct.category}</p>}
                    <p className="text-sm font-bold text-gray-900 mt-1">Rs {orderProduct.price.toLocaleString()} / unit</p>
                  </div>
                  {/* Quantity stepper */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => setOrderForm((f) => ({ ...f, quantity: Math.max(1, f.quantity - 1) }))}
                      className="w-8 h-8 rounded-full border border-gray-200 bg-white flex items-center justify-center text-gray-700 hover:bg-gray-50 transition-colors font-bold text-lg leading-none"
                    >
                      −
                    </button>
                    <span className="w-6 text-center text-sm font-semibold text-gray-900">{orderForm.quantity}</span>
                    <button
                      onClick={() => setOrderForm((f) => ({ ...f, quantity: Math.min(orderProduct.stock || 99, f.quantity + 1) }))}
                      className="w-8 h-8 rounded-full border border-gray-200 bg-white flex items-center justify-center text-gray-700 hover:bg-gray-50 transition-colors font-bold text-lg leading-none"
                    >
                      +
                    </button>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1.5">
                        Full name <span className="text-red-400">*</span>
                      </label>
                      <input
                        type="text"
                        value={orderForm.name}
                        onChange={(e) => setOrderForm((f) => ({ ...f, name: e.target.value }))}
                        placeholder="Your name"
                        className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0071e3]/30 focus:border-[#0071e3] transition"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1.5">
                        Email <span className="text-red-400">*</span>
                      </label>
                      <input
                        type="email"
                        value={orderForm.email}
                        onChange={(e) => setOrderForm((f) => ({ ...f, email: e.target.value }))}
                        placeholder="you@example.com"
                        className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0071e3]/30 focus:border-[#0071e3] transition"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1.5">Phone</label>
                    <input
                      type="tel"
                      value={orderForm.phone}
                      onChange={(e) => setOrderForm((f) => ({ ...f, phone: e.target.value }))}
                      placeholder="+230 xxx xxxx"
                      className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0071e3]/30 focus:border-[#0071e3] transition"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1.5">Notes</label>
                    <textarea
                      value={orderForm.notes}
                      onChange={(e) => setOrderForm((f) => ({ ...f, notes: e.target.value }))}
                      placeholder="Delivery address, special instructions…"
                      rows={3}
                      className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0071e3]/30 focus:border-[#0071e3] transition resize-none"
                    />
                  </div>
                </div>

                <div className="mt-6 pt-5 border-t border-gray-100">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-sm text-gray-500">Total ({orderForm.quantity} × Rs {orderProduct.price.toLocaleString()})</span>
                    <span className="text-xl font-bold text-gray-900">Rs {(orderProduct.price * orderForm.quantity).toLocaleString()}</span>
                  </div>
                  <button
                    onClick={handlePlaceOrder}
                    disabled={orderLoading || !orderForm.name.trim() || !orderForm.email.trim()}
                    className="w-full bg-[#0071e3] hover:bg-[#0077ed] disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3.5 rounded-2xl transition-colors text-sm flex items-center justify-center gap-2"
                  >
                    {orderLoading ? (
                      <>
                        <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        Placing order…
                      </>
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

      {/* ── Toast ────────────────────────────────────────────────────────────── */}
      {toast && (
        <div className={`fixed bottom-8 left-1/2 -translate-x-1/2 z-[200] text-white text-sm font-medium px-6 py-3 rounded-full shadow-xl transition-all ${toast.type === "error" ? "bg-red-500" : "bg-gray-900"}`}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}
