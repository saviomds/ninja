"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
}

interface CartItem {
  product: Product;
  quantity: number;
}

interface Order {
  id: string;
  product_name: string;
  quantity: number;
  price: number;
  status: "pending" | "confirmed" | "completed" | "cancelled";
  notes?: string;
  created_at: string;
}

const PAGE_SIZE = 6;

const STATUS_STYLES: Record<string, string> = {
  pending:   "bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-500/30",
  confirmed: "bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-500/30",
  completed: "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/30",
  cancelled: "bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-500 border-red-200 dark:border-red-500/30",
};

export default function ClientDashboard() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);

  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [loadingOrders, setLoadingOrders] = useState(true);

  const [tab, setTab] = useState<"shop" | "orders">("shop");
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [categories, setCategories] = useState<string[]>([]);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const catRef = useRef<HTMLDivElement>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);

  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);

  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [checkoutForm, setCheckoutForm] = useState({ name: "", phone: "", notes: "" });
  const [placing, setPlacing] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(false);

  const [toast, setToast] = useState<string | null>(null);
  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 2500); };

  // ── Auth guard ────────────────────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { router.push("/login"); return; }
      setUser(data.user);
      setLoadingAuth(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_, session) => {
      if (!session) router.push("/login");
      else setUser(session.user);
    });
    return () => sub.subscription.unsubscribe();
  }, [router]);

  // ── Load products ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (loadingAuth) return;
    supabase.from("products").select("*").order("created_at", { ascending: false }).then(({ data }) => {
      const list = (data || []) as Product[];
      setProducts(list);
      setCategories(Array.from(new Set(list.map((p) => p.category).filter(Boolean))) as string[]);
      setLoadingProducts(false);
    });
  }, [loadingAuth]);

  // ── Load orders ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    supabase.from("orders").select("*").eq("client_email", user.email!).order("created_at", { ascending: false })
      .then(({ data }) => { setOrders((data || []) as Order[]); setLoadingOrders(false); });
  }, [user]);

  // ── Realtime order updates ────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    const ch = supabase.channel("client-orders")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "orders" }, (payload) => {
        setOrders((prev) => prev.map((o) => o.id === payload.new.id ? { ...o, status: payload.new.status } : o));
      }).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user]);

  // ── Category scroll arrows ────────────────────────────────────────────────
  const checkArrows = () => {
    const el = catRef.current;
    if (!el) return;
    setCanLeft(el.scrollLeft > 4);
    setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  };
  useEffect(() => {
    checkArrows();
    const el = catRef.current;
    el?.addEventListener("scroll", checkArrows);
    window.addEventListener("resize", checkArrows);
    return () => { el?.removeEventListener("scroll", checkArrows); window.removeEventListener("resize", checkArrows); };
  }, [categories]);

  // ── Derived ───────────────────────────────────────────────────────────────
  const filtered = products.filter((p) => {
    const matchCat = selectedCategory === "all" || p.category === selectedCategory;
    const q = search.trim().toLowerCase();
    const matchSearch = !q || p.name.toLowerCase().includes(q) || (p.description || "").toLowerCase().includes(q);
    return matchCat && matchSearch;
  });

  const cartCount = cart.reduce((s, i) => s + i.quantity, 0);
  const cartTotal = cart.reduce((s, i) => s + i.product.price * i.quantity, 0);

  // ── Cart helpers ──────────────────────────────────────────────────────────
  const addToCart = (product: Product) => {
    if (product.stock === 0) return;
    setCart((prev) => {
      const existing = prev.find((i) => i.product.id === product.id);
      if (existing) return prev.map((i) => i.product.id === product.id ? { ...i, quantity: i.quantity + 1 } : i);
      return [...prev, { product, quantity: 1 }];
    });
    showToast(`${product.name} added to cart`);
  };

  const updateCartQty = (productId: string, delta: number) => {
    setCart((prev) => prev.map((i) => i.product.id === productId ? { ...i, quantity: i.quantity + delta } : i).filter((i) => i.quantity > 0));
  };

  const removeFromCart = (productId: string) => setCart((prev) => prev.filter((i) => i.product.id !== productId));

  // ── Place order ───────────────────────────────────────────────────────────
  const handlePlaceOrder = async () => {
    if (!user || cart.length === 0) return;
    setPlacing(true);
    const inserts = cart.map((item) => ({
      product_id: item.product.id,
      product_name: item.product.name,
      quantity: item.quantity,
      price: item.product.price * item.quantity,
      client_name: checkoutForm.name || user.user_metadata?.username || user.email?.split("@")[0],
      client_email: user.email,
      client_phone: checkoutForm.phone || null,
      notes: checkoutForm.notes || null,
      status: "pending",
    }));
    const { error } = await supabase.from("orders").insert(inserts);
    setPlacing(false);
    if (error) { showToast("Failed to place order. Try again."); return; }
    setOrderSuccess(true);
    setCart([]);
  };

  const closeCheckout = () => { setCheckoutOpen(false); setOrderSuccess(false); setCheckoutForm({ name: "", phone: "", notes: "" }); };

  if (loadingAuth) {
    return (
      <div className="min-h-screen bg-white dark:bg-gray-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-gray-200 dark:border-gray-700 border-t-gray-900 dark:border-t-gray-200 rounded-full animate-spin" />
      </div>
    );
  }

  const username = user?.user_metadata?.username || user?.email?.split("@")[0] || "there";

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-white">
      <Navbar />

      {/* ── Tab bar ──────────────────────────────────────────────────────────── */}
      <div className="bg-white dark:bg-gray-900/80 border-b border-gray-200 dark:border-gray-800 sticky top-16 z-40">
        <div className="max-w-6xl mx-auto px-5 flex items-center justify-between">
          <div className="flex gap-0">
            {([["shop", "🛍️ Shop"], ["orders", "📦 My Orders"]] as const).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={`px-5 py-3.5 text-sm font-semibold border-b-2 transition-all ${
                  tab === key
                    ? "border-gray-900 dark:border-white text-gray-900 dark:text-white"
                    : "border-transparent text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                }`}
              >
                {label}
                {key === "orders" && orders.length > 0 && (
                  <span className="ml-1.5 text-xs bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 px-1.5 py-0.5 rounded-full">{orders.length}</span>
                )}
              </button>
            ))}
          </div>

          {/* Cart button */}
          <button
            onClick={() => setCartOpen(true)}
            className="relative flex items-center gap-2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-sm font-semibold px-4 py-2 rounded-full hover:bg-gray-700 dark:hover:bg-gray-200 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            Cart
            {cartCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-blue-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                {cartCount}
              </span>
            )}
          </button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-5 py-8">

        {/* ══ SHOP TAB ══════════════════════════════════════════════════════════ */}
        {tab === "shop" && (
          <>
            {/* Greeting */}
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">
              Hi, <span className="font-semibold text-gray-900 dark:text-white">{username}</span>! Here&apos;s what&apos;s available.
            </p>

            {/* Search */}
            <div className="max-w-lg mb-5">
              <div className="relative">
                <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setVisibleCount(PAGE_SIZE); }}
                  placeholder="Search products…"
                  className="w-full bg-white dark:bg-gray-800 rounded-full pl-11 pr-5 py-2.5 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition shadow-sm"
                />
              </div>
            </div>

            {/* Category scroll */}
            <div className="relative mb-6">
              {canLeft && (
                <button onClick={() => catRef.current?.scrollBy({ left: -200, behavior: "smooth" })} className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-white dark:bg-gray-800 shadow border border-gray-100 dark:border-gray-700 flex items-center justify-center text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                </button>
              )}
              {canRight && (
                <button onClick={() => catRef.current?.scrollBy({ left: 200, behavior: "smooth" })} className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-white dark:bg-gray-800 shadow border border-gray-100 dark:border-gray-700 flex items-center justify-center text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                </button>
              )}
              <div ref={catRef} className="flex gap-2 overflow-x-auto py-1 px-1" style={{ scrollbarWidth: "none" }}>
                {["all", ...categories].map((cat) => (
                  <button
                    key={cat}
                    onClick={() => { setSelectedCategory(cat); setVisibleCount(PAGE_SIZE); }}
                    className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-all whitespace-nowrap ${
                      selectedCategory === cat
                        ? "bg-gray-900 dark:bg-white text-white dark:text-gray-900 shadow"
                        : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-500"
                    }`}
                  >
                    {cat === "all" ? "All" : cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Product grid */}
            {loadingProducts ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="bg-white dark:bg-gray-800/50 rounded-3xl overflow-hidden animate-pulse">
                    <div className="aspect-square bg-gray-100 dark:bg-gray-700/50" />
                    <div className="p-5 space-y-3">
                      <div className="h-4 bg-gray-100 dark:bg-gray-700/50 rounded-full w-3/4" />
                      <div className="h-3 bg-gray-100 dark:bg-gray-700/50 rounded-full w-1/2" />
                      <div className="h-8 bg-gray-100 dark:bg-gray-700/50 rounded-xl" />
                    </div>
                  </div>
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-24 text-gray-400 dark:text-gray-500">
                <p className="text-5xl mb-3">🔍</p>
                <p className="text-base font-medium">No products found.</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filtered.slice(0, visibleCount).map((product) => {
                    const inCart = cart.find((i) => i.product.id === product.id);
                    return (
                      <article key={product.id} className="bg-white dark:bg-gray-900 rounded-3xl overflow-hidden hover:shadow-lg dark:hover:shadow-2xl dark:hover:shadow-black/30 transition-all duration-300 hover:-translate-y-0.5 border border-gray-100 dark:border-gray-800">
                        <div className="aspect-square bg-gray-50 dark:bg-gray-800 relative overflow-hidden">
                          {product.image ? (
                            <Image
                              src={product.image.replace("/object/public/", "/render/image/public/")}
                              alt={product.name}
                              fill
                              unoptimized
                              className="object-cover"
                              onError={(e) => { (e.target as HTMLImageElement).src = "https://placehold.co/400x400/f3f4f6/9ca3af?text=No+Image"; }}
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-gray-300 dark:text-gray-600 text-sm">No image</div>
                          )}
                          {product.stock === 0 && (
                            <div className="absolute inset-0 bg-white/75 dark:bg-black/60 flex items-center justify-center">
                              <span className="text-xs font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-800 px-3 py-1.5 rounded-full border border-gray-200 dark:border-gray-700">Sold out</span>
                            </div>
                          )}
                        </div>
                        <div className="px-5 py-4">
                          {product.category && <p className="text-xs font-semibold uppercase tracking-widest text-blue-600 dark:text-blue-400 mb-1">{product.category}</p>}
                          <h3 className="text-sm font-semibold text-gray-900 dark:text-white line-clamp-1 mb-0.5">{product.name}</h3>
                          <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 mb-3 leading-relaxed">{product.description || "—"}</p>
                          <div className="flex items-center justify-between">
                            <span className="text-lg font-bold text-gray-900 dark:text-white">Rs {product.price.toLocaleString()}</span>
                            {inCart ? (
                              <div className="flex items-center gap-2">
                                <button onClick={() => updateCartQty(product.id, -1)} className="w-7 h-7 rounded-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex items-center justify-center text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 font-bold text-base leading-none">−</button>
                                <span className="text-sm font-semibold text-gray-900 dark:text-white w-4 text-center">{inCart.quantity}</span>
                                <button onClick={() => updateCartQty(product.id, 1)} className="w-7 h-7 rounded-full bg-gray-900 dark:bg-white text-white dark:text-gray-900 flex items-center justify-center hover:bg-gray-700 dark:hover:bg-gray-200 font-bold text-base leading-none">+</button>
                              </div>
                            ) : (
                              <button
                                onClick={() => addToCart(product)}
                                disabled={product.stock === 0}
                                className="text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-full transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                              >
                                Add to cart
                              </button>
                            )}
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
                {visibleCount < filtered.length && (
                  <div className="text-center mt-10">
                    <button
                      onClick={() => setVisibleCount((v) => v + PAGE_SIZE)}
                      className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white font-semibold px-10 py-3 rounded-full text-sm hover:bg-gray-50 dark:hover:bg-gray-700 hover:border-gray-400 dark:hover:border-gray-500 transition-all shadow-sm"
                    >
                      See more ({filtered.length - visibleCount} remaining)
                    </button>
                  </div>
                )}
              </>
            )}
          </>
        )}

        {/* ══ MY ORDERS TAB ═════════════════════════════════════════════════════ */}
        {tab === "orders" && (
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-5">Your Orders</h2>
            {loadingOrders ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => <div key={i} className="h-20 bg-white dark:bg-gray-800/50 rounded-2xl animate-pulse" />)}
              </div>
            ) : orders.length === 0 ? (
              <div className="text-center py-24 text-gray-400 dark:text-gray-500">
                <p className="text-5xl mb-3">📦</p>
                <p className="text-base font-medium mb-4">No orders yet.</p>
                <button onClick={() => setTab("shop")} className="text-sm text-blue-600 dark:text-blue-400 hover:underline font-medium">Start shopping →</button>
              </div>
            ) : (
              <div className="space-y-3">
                {orders.map((order) => (
                  <div key={order.id} className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 px-5 py-4 flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-900 dark:text-white text-sm truncate">{order.product_name}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        Qty {order.quantity} · {new Date(order.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                      </p>
                      {order.notes && <p className="text-xs text-gray-400 mt-0.5 italic truncate">{order.notes}</p>}
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <span className="text-sm font-bold text-gray-900 dark:text-white">Rs {order.price.toLocaleString()}</span>
                      <span className={`text-xs font-semibold capitalize px-3 py-1 rounded-full border ${STATUS_STYLES[order.status] || STATUS_STYLES.pending}`}>
                        {order.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Cart drawer ──────────────────────────────────────────────────────── */}
      {cartOpen && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1 bg-black/30 backdrop-blur-sm" onClick={() => setCartOpen(false)} />
          <div className="w-full max-w-sm bg-white dark:bg-gray-900 h-full flex flex-col shadow-2xl border-l border-gray-100 dark:border-gray-800">
            <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                Cart {cartCount > 0 && <span className="text-sm font-normal text-gray-400">({cartCount} items)</span>}
              </h2>
              <button onClick={() => setCartOpen(false)} className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 flex items-center justify-center text-gray-600 dark:text-gray-300 font-bold text-sm">✕</button>
            </div>

            {cart.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-gray-400 gap-3">
                <span className="text-5xl">🛒</span>
                <p className="text-sm font-medium">Your cart is empty</p>
                <button onClick={() => { setCartOpen(false); setTab("shop"); }} className="text-sm text-blue-600 dark:text-blue-400 hover:underline font-medium">Browse products</button>
              </div>
            ) : (
              <>
                <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
                  {cart.map(({ product, quantity }) => (
                    <div key={product.id} className="flex items-center gap-3">
                      <div className="relative w-14 h-14 rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-800 flex-shrink-0">
                        {product.image ? (
                          <Image src={product.image.replace("/object/public/", "/render/image/public/")} alt={product.name} fill unoptimized className="object-cover" />
                        ) : <div className="w-full h-full bg-gray-100 dark:bg-gray-800" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{product.name}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Rs {product.price.toLocaleString()} / unit</p>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <button onClick={() => updateCartQty(product.id, -1)} className="w-6 h-6 rounded-full border border-gray-200 dark:border-gray-700 flex items-center justify-center text-gray-700 dark:text-gray-300 text-sm font-bold hover:bg-gray-50 dark:hover:bg-gray-800">−</button>
                        <span className="text-sm font-semibold w-4 text-center text-gray-900 dark:text-white">{quantity}</span>
                        <button onClick={() => updateCartQty(product.id, 1)} className="w-6 h-6 rounded-full bg-gray-900 dark:bg-white text-white dark:text-gray-900 flex items-center justify-center text-sm font-bold hover:bg-gray-700 dark:hover:bg-gray-200">+</button>
                        <button onClick={() => removeFromCart(product.id)} className="ml-1 text-gray-300 dark:text-gray-600 hover:text-red-400 transition-colors text-xs">✕</button>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="px-6 py-5 border-t border-gray-100 dark:border-gray-800">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-sm text-gray-500 dark:text-gray-400">Total</span>
                    <span className="text-xl font-bold text-gray-900 dark:text-white">Rs {cartTotal.toLocaleString()}</span>
                  </div>
                  <button
                    onClick={() => { setCartOpen(false); setCheckoutOpen(true); }}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3.5 rounded-2xl text-sm transition-colors"
                  >
                    Checkout · Rs {cartTotal.toLocaleString()}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Checkout modal ────────────────────────────────────────────────────── */}
      {checkoutOpen && (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-6 bg-black/40 backdrop-blur-sm" onClick={closeCheckout}>
          <div className="bg-white dark:bg-gray-900 w-full sm:max-w-md sm:rounded-3xl rounded-t-3xl overflow-hidden shadow-2xl max-h-[95vh] overflow-y-auto border border-gray-100 dark:border-gray-800" onClick={(e) => e.stopPropagation()}>
            {orderSuccess ? (
              <div className="p-10 text-center space-y-4">
                <div className="w-16 h-16 rounded-full bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 flex items-center justify-center mx-auto">
                  <svg className="w-8 h-8 text-emerald-500 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white">Order placed!</h3>
                <p className="text-gray-500 dark:text-gray-400 text-sm leading-relaxed">
                  Your order has been received. You can track it in <strong className="text-gray-900 dark:text-white">My Orders</strong>.
                </p>
                <button onClick={() => { closeCheckout(); setTab("orders"); }} className="mt-2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-semibold px-8 py-3 rounded-2xl text-sm hover:bg-gray-700 dark:hover:bg-gray-200 transition-colors">
                  View my orders
                </button>
              </div>
            ) : (
              <div className="p-6 sm:p-8">
                <div className="flex items-start justify-between mb-5">
                  <div>
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white">Confirm order</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{cartCount} item{cartCount > 1 ? "s" : ""} · Rs {cartTotal.toLocaleString()}</p>
                  </div>
                  <button onClick={closeCheckout} className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 flex items-center justify-center text-gray-500 dark:text-gray-400 font-bold text-sm">✕</button>
                </div>

                <div className="bg-gray-50 dark:bg-gray-800/50 rounded-2xl p-4 mb-5 space-y-2">
                  {cart.map(({ product, quantity }) => (
                    <div key={product.id} className="flex items-center justify-between text-sm">
                      <span className="text-gray-700 dark:text-gray-300 truncate flex-1 mr-2">{product.name} <span className="text-gray-400">× {quantity}</span></span>
                      <span className="font-semibold text-gray-900 dark:text-white flex-shrink-0">Rs {(product.price * quantity).toLocaleString()}</span>
                    </div>
                  ))}
                  <div className="border-t border-gray-200 dark:border-gray-700 pt-2 flex items-center justify-between font-bold text-sm text-gray-900 dark:text-white">
                    <span>Total</span>
                    <span>Rs {cartTotal.toLocaleString()}</span>
                  </div>
                </div>

                <div className="space-y-3 mb-5">
                  {[
                    { label: "Name", field: "name" as const, type: "text", placeholder: user?.user_metadata?.username || "Your name" },
                    { label: "Phone", field: "phone" as const, type: "tel", placeholder: "+230 xxx xxxx" },
                  ].map(({ label, field, type, placeholder }) => (
                    <div key={field}>
                      <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">{label}</label>
                      <input type={type} value={checkoutForm[field]} onChange={(e) => setCheckoutForm((f) => ({ ...f, [field]: e.target.value }))} placeholder={placeholder}
                        className="w-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-xl px-4 py-2.5 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition" />
                    </div>
                  ))}
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">Delivery notes</label>
                    <textarea value={checkoutForm.notes} onChange={(e) => setCheckoutForm((f) => ({ ...f, notes: e.target.value }))} placeholder="Address, special instructions…" rows={2}
                      className="w-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-xl px-4 py-2.5 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition resize-none" />
                  </div>
                </div>

                <button onClick={handlePlaceOrder} disabled={placing}
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3.5 rounded-2xl transition-colors text-sm flex items-center justify-center gap-2">
                  {placing ? (
                    <><svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>Placing order…</>
                  ) : `Place order · Rs ${cartTotal.toLocaleString()}`}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Toast ────────────────────────────────────────────────────────────── */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] bg-gray-900 dark:bg-gray-800 text-white text-sm font-medium px-5 py-2.5 rounded-full shadow-xl">
          {toast}
        </div>
      )}
    </div>
  );
}
