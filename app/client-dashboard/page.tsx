"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { User } from "@supabase/supabase-js";
import Navbar from "@/components/Navbar";

// ── Types ──────────────────────────────────────────────────────────────────────

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

interface RepairTicket {
  id: string;
  ticket_no: string;
  device_brand: string;
  device_model: string;
  device_color?: string;
  issue_description: string;
  priority: "low" | "normal" | "high" | "urgent";
  status: "received" | "diagnosed" | "in_repair" | "waiting_parts" | "ready" | "delivered" | "cancelled";
  technician?: string;
  estimated_cost?: number;
  final_cost?: number;
  estimated_completion?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

interface LoyaltyAccount {
  id: string;
  points_balance: number;
  tier: "bronze" | "silver" | "gold" | "platinum";
  total_earned: number;
  total_redeemed: number;
  member_since: string;
  last_activity: string;
}

interface LoyaltyTransaction {
  id: string;
  type: "earn" | "redeem" | "bonus" | "adjustment" | "expire";
  points: number;
  balance_after: number;
  description: string;
  created_at: string;
}

// ── Constants ──────────────────────────────────────────────────────────────────

const PAGE_SIZE = 6;

const ORDER_STATUS_STYLES: Record<string, string> = {
  pending:   "bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-500/30",
  confirmed: "bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-500/30",
  completed: "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/30",
  cancelled: "bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-500 border-red-200 dark:border-red-500/30",
};

const REPAIR_STATUS_STYLES: Record<string, string> = {
  received:      "bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-500/30",
  diagnosed:     "bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-500/30",
  in_repair:     "bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-200 dark:border-orange-500/30",
  waiting_parts: "bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-500/30",
  ready:         "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/30",
  delivered:     "bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-700",
  cancelled:     "bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-500 border-red-200 dark:border-red-500/30",
};

const REPAIR_STATUS_LABEL: Record<string, string> = {
  received:      "Received",
  diagnosed:     "Diagnosed",
  in_repair:     "In Repair",
  waiting_parts: "Waiting Parts",
  ready:         "Ready for Pickup",
  delivered:     "Delivered",
  cancelled:     "Cancelled",
};

const PRIORITY_STYLES: Record<string, string> = {
  low:    "text-gray-400 dark:text-gray-500",
  normal: "text-blue-500 dark:text-blue-400",
  high:   "text-orange-500 dark:text-orange-400",
  urgent: "text-red-500 dark:text-red-400",
};

const REPAIR_STEPS = ["received", "diagnosed", "in_repair", "waiting_parts", "ready", "delivered"] as const;

const TIER_CFG = {
  bronze:   { gradient: "from-amber-700 to-amber-500",   text: "text-amber-700 dark:text-amber-400",  bg: "bg-amber-50 dark:bg-amber-900/20",    next: 500,        label: "Bronze"   },
  silver:   { gradient: "from-gray-500 to-gray-300",     text: "text-gray-600 dark:text-gray-300",    bg: "bg-gray-100 dark:bg-gray-800/60",     next: 2000,       label: "Silver"   },
  gold:     { gradient: "from-yellow-500 to-yellow-300", text: "text-yellow-600 dark:text-yellow-400",bg: "bg-yellow-50 dark:bg-yellow-900/20",  next: 5000,       label: "Gold"     },
  platinum: { gradient: "from-cyan-400 to-blue-400",     text: "text-cyan-600 dark:text-cyan-400",    bg: "bg-cyan-50 dark:bg-cyan-900/20",      next: Infinity,   label: "Platinum" },
} as const;

// ── Component ──────────────────────────────────────────────────────────────────

export default function ClientDashboard() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);

  // profile
  const [profile, setProfile] = useState<{ username: string | null; avatar_url: string | null; phone: string | null }>({ username: null, avatar_url: null, phone: null });

  // shop
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [categories, setCategories] = useState<string[]>([]);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const catRef = useRef<HTMLDivElement>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);

  // orders
  const [orders, setOrders] = useState<Order[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(true);

  // repairs
  const [repairs, setRepairs] = useState<RepairTicket[]>([]);
  const [loadingRepairs, setLoadingRepairs] = useState(true);

  // loyalty
  const [loyalty, setLoyalty] = useState<LoyaltyAccount | null>(null);
  const [loyaltyTx, setLoyaltyTx] = useState<LoyaltyTransaction[]>([]);
  const [loadingLoyalty, setLoadingLoyalty] = useState(true);

  // ui
  const [tab, setTab] = useState<"overview" | "shop" | "orders" | "repairs" | "loyalty">("overview");
  const [toast, setToast] = useState<string | null>(null);

  // cart
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [checkoutForm, setCheckoutForm] = useState({ name: "", phone: "", notes: "" });
  const [placing, setPlacing] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(false);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 2500); };

  // ── Auth ──────────────────────────────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) { router.push("/login"); return; }
      setUser(data.user);
      const { data: prof } = await supabase.from("profiles").select("username, avatar_url, phone").eq("id", data.user.id).single();
      if (prof) setProfile({ username: prof.username ?? null, avatar_url: prof.avatar_url ?? null, phone: prof.phone ?? null });
      setLoadingAuth(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_, session) => {
      if (!session) router.push("/login");
      else setUser(session.user);
    });
    return () => sub.subscription.unsubscribe();
  }, [router]);

  // ── Products ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (loadingAuth) return;
    supabase.from("products").select("*").eq("is_public", true).order("created_at", { ascending: false }).then(({ data }) => {
      const list = (data || []) as Product[];
      setProducts(list);
      setCategories(Array.from(new Set(list.map((p) => p.category).filter(Boolean))) as string[]);
      setLoadingProducts(false);
    });
  }, [loadingAuth]);

  // ── Orders ────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    supabase.from("orders").select("*").eq("client_email", user.email!).order("created_at", { ascending: false })
      .then(({ data }) => { setOrders((data || []) as Order[]); setLoadingOrders(false); });
  }, [user]);

  // ── Repairs ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    supabase.from("repair_tickets").select("*").eq("customer_email", user.email!).order("created_at", { ascending: false })
      .then(({ data }) => { setRepairs((data || []) as RepairTicket[]); setLoadingRepairs(false); });
  }, [user]);

  // ── Loyalty ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    supabase.from("loyalty_accounts").select("*").eq("customer_email", user.email!).single()
      .then(async ({ data: acct }) => {
        if (acct) {
          setLoyalty(acct as LoyaltyAccount);
          const { data: tx } = await supabase.from("loyalty_transactions").select("*").eq("account_id", acct.id).order("created_at", { ascending: false }).limit(20);
          setLoyaltyTx((tx || []) as LoyaltyTransaction[]);
        }
        setLoadingLoyalty(false);
      });
  }, [user]);

  // ── Realtime: orders ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    const ch = supabase.channel("client-orders")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "orders" }, (payload) => {
        setOrders((prev) => prev.map((o) => o.id === payload.new.id ? { ...o, status: payload.new.status } : o));
      }).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user]);

  // ── Realtime: repairs ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    const ch = supabase.channel("client-repairs")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "repair_tickets" }, (payload) => {
        if (payload.new.customer_email === user.email) {
          setRepairs((prev) => prev.map((r) => r.id === payload.new.id ? { ...r, ...(payload.new as RepairTicket) } : r));
          showToast(`Repair #${payload.new.ticket_no} updated: ${REPAIR_STATUS_LABEL[payload.new.status] || payload.new.status}`);
        }
      }).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user]);

  // ── Category scroll ───────────────────────────────────────────────────────────
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

  // ── Derived ───────────────────────────────────────────────────────────────────
  const filtered = products.filter((p) => {
    const matchCat = selectedCategory === "all" || p.category === selectedCategory;
    const q = search.trim().toLowerCase();
    return matchCat && (!q || p.name.toLowerCase().includes(q) || (p.description || "").toLowerCase().includes(q));
  });

  const cartCount = cart.reduce((s, i) => s + i.quantity, 0);
  const cartTotal = cart.reduce((s, i) => s + i.product.price * i.quantity, 0);
  const activeOrders = orders.filter((o) => o.status === "pending" || o.status === "confirmed").length;
  const activeRepairs = repairs.filter((r) => !["delivered", "cancelled"].includes(r.status)).length;
  const username = profile.username || user?.email?.split("@")[0] || "there";
  const tier = loyalty?.tier ?? "bronze";

  // ── Cart helpers ──────────────────────────────────────────────────────────────
  const addToCart = (product: Product) => {
    if (product.stock === 0) return;
    setCart((prev) => {
      const existing = prev.find((i) => i.product.id === product.id);
      if (existing) return prev.map((i) => i.product.id === product.id ? { ...i, quantity: i.quantity + 1 } : i);
      return [...prev, { product, quantity: 1 }];
    });
    showToast(`${product.name} added to cart`);
  };
  const updateCartQty = (productId: string, delta: number) =>
    setCart((prev) => prev.map((i) => i.product.id === productId ? { ...i, quantity: i.quantity + delta } : i).filter((i) => i.quantity > 0));
  const removeFromCart = (productId: string) => setCart((prev) => prev.filter((i) => i.product.id !== productId));

  // ── Place order ───────────────────────────────────────────────────────────────
  const handlePlaceOrder = async () => {
    if (!user || cart.length === 0) return;
    setPlacing(true);
    const inserts = cart.map((item) => ({
      product_id: item.product.id,
      product_name: item.product.name,
      quantity: item.quantity,
      price: item.product.price * item.quantity,
      client_name: checkoutForm.name || profile.username || user.email?.split("@")[0],
      client_email: user.email,
      client_phone: checkoutForm.phone || profile.phone || null,
      notes: checkoutForm.notes || null,
      status: "pending",
    }));
    const { error } = await supabase.from("orders").insert(inserts);
    setPlacing(false);
    if (error) { showToast("Failed to place order. Try again."); return; }
    setOrderSuccess(true);
    setCart([]);
    supabase.from("orders").select("*").eq("client_email", user.email!).order("created_at", { ascending: false })
      .then(({ data }) => setOrders((data || []) as Order[]));
  };

  const closeCheckout = () => { setCheckoutOpen(false); setOrderSuccess(false); setCheckoutForm({ name: "", phone: "", notes: "" }); };

  if (loadingAuth) {
    return (
      <div className="min-h-screen bg-white dark:bg-gray-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-gray-200 dark:border-gray-700 border-t-gray-900 dark:border-t-gray-200 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-white pt-16">
      <Navbar />

      {/* ── Mobile bottom nav (icons only) ──────────────────────────────────── */}
      <div className="sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 flex items-stretch">
        {/* Home */}
        <button onClick={() => setTab("overview")} className={`relative flex-1 flex items-center justify-center py-3 transition-colors ${tab === "overview" ? "text-[#2563EB]" : "text-gray-400 dark:text-gray-500"}`}>
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 9.75L12 3l9 6.75V21a.75.75 0 01-.75.75H15a.75.75 0 01-.75-.75v-4.5h-4.5V21a.75.75 0 01-.75.75H3.75A.75.75 0 013 21V9.75z"/></svg>
        </button>
        {/* Shop */}
        <button onClick={() => setTab("shop")} className={`relative flex-1 flex items-center justify-center py-3 transition-colors ${tab === "shop" ? "text-[#2563EB]" : "text-gray-400 dark:text-gray-500"}`}>
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007z"/></svg>
        </button>
        {/* Orders */}
        <button onClick={() => setTab("orders")} className={`relative flex-1 flex items-center justify-center py-3 transition-colors ${tab === "orders" ? "text-[#2563EB]" : "text-gray-400 dark:text-gray-500"}`}>
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"/></svg>
          {activeOrders > 0 && <span className="absolute top-1.5 right-[calc(50%-14px)] w-4 h-4 bg-amber-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">{activeOrders}</span>}
        </button>
        {/* Repairs */}
        <button onClick={() => setTab("repairs")} className={`relative flex-1 flex items-center justify-center py-3 transition-colors ${tab === "repairs" ? "text-[#2563EB]" : "text-gray-400 dark:text-gray-500"}`}>
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-6.336l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437l1.745-1.437m6.615 8.206L15.75 15.75"/></svg>
          {activeRepairs > 0 && <span className="absolute top-1.5 right-[calc(50%-14px)] w-4 h-4 bg-blue-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">{activeRepairs}</span>}
        </button>
        {/* Rewards */}
        <button onClick={() => setTab("loyalty")} className={`relative flex-1 flex items-center justify-center py-3 transition-colors ${tab === "loyalty" ? "text-[#2563EB]" : "text-gray-400 dark:text-gray-500"}`}>
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z"/></svg>
        </button>
        {/* Cart */}
        <button onClick={() => setCartOpen(true)} className="relative flex-1 flex items-center justify-center py-3 text-gray-400 dark:text-gray-500 hover:text-[#2563EB] transition-colors">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z"/></svg>
          {cartCount > 0 && <span className="absolute top-1.5 right-[calc(50%-14px)] w-4 h-4 bg-blue-600 text-white text-[9px] font-bold rounded-full flex items-center justify-center">{cartCount}</span>}
        </button>
      </div>

      {/* ── Desktop tab bar ──────────────────────────────────────────────────── */}
      <div className="hidden sm:block bg-white dark:bg-gray-900/80 border-b border-gray-200 dark:border-gray-800 sticky top-16 z-40">
        <div className="max-w-6xl mx-auto px-4 flex items-center justify-between gap-2">
          <div className="flex overflow-x-auto" style={{ scrollbarWidth: "none" }}>
            {([
              ["overview", "Home"],
              ["shop",     "Shop"],
              ["orders",   "Orders"],
              ["repairs",  "Repairs"],
              ["loyalty",  "Rewards"],
            ] as const).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={`relative flex-shrink-0 px-4 py-3.5 text-sm font-semibold border-b-2 transition-all whitespace-nowrap ${
                  tab === key
                    ? "border-gray-900 dark:border-white text-gray-900 dark:text-white"
                    : "border-transparent text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                }`}
              >
                {label}
                {key === "orders" && activeOrders > 0 && (
                  <span className="ml-1.5 text-[10px] font-bold bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 px-1.5 py-0.5 rounded-full">{activeOrders}</span>
                )}
                {key === "repairs" && activeRepairs > 0 && (
                  <span className="ml-1.5 text-[10px] font-bold bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded-full">{activeRepairs}</span>
                )}
              </button>
            ))}
          </div>
          <button
            onClick={() => setCartOpen(true)}
            className="relative flex-shrink-0 flex items-center gap-1.5 bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-sm font-semibold px-4 py-2 rounded-full hover:bg-gray-700 dark:hover:bg-gray-200 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            Cart
            {cartCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-blue-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center">{cartCount}</span>
            )}
          </button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8 pb-24 sm:pb-8">

        {/* ══ OVERVIEW ═══════════════════════════════════════════════════════════ */}
        {tab === "overview" && (
          <div className="space-y-7">

            {/* Welcome card */}
            <div className="bg-gradient-to-br from-gray-900 to-gray-800 dark:from-gray-800 dark:to-gray-900 rounded-3xl p-6 sm:p-8 flex items-center gap-5 border border-gray-800">
              <div className="relative w-14 h-14 sm:w-16 sm:h-16 rounded-2xl overflow-hidden bg-white/10 flex-shrink-0">
                {profile.avatar_url ? (
                  <Image src={profile.avatar_url} alt={username} fill unoptimized className="object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-white/60 text-2xl font-bold">
                    {username[0].toUpperCase()}
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white/50 text-xs font-medium uppercase tracking-widest">Welcome back</p>
                <p className="text-white text-xl sm:text-2xl font-bold truncate mt-0.5">{username}</p>
                <p className="text-white/40 text-xs mt-0.5 truncate">{user?.email}</p>
              </div>
              <Link
                href="/profile"
                className="flex-shrink-0 text-xs font-semibold text-white/60 hover:text-white border border-white/20 hover:border-white/50 px-3 py-1.5 rounded-full transition-all"
              >
                Edit profile
              </Link>
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                {
                  label: "Active Orders", value: loadingOrders ? null : activeOrders, sub: `${orders.length} total`,
                  onClick: () => setTab("orders"), accent: "text-amber-600 dark:text-amber-400", bg: "bg-amber-50 dark:bg-amber-500/10",
                  icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7H4a2 2 0 00-2 2v10a2 2 0 002 2h16a2 2 0 002-2V9a2 2 0 00-2-2zM16 3H8a2 2 0 00-2 2v2h12V5a2 2 0 00-2-2z" />,
                },
                {
                  label: "Active Repairs", value: loadingRepairs ? null : activeRepairs, sub: `${repairs.length} total`,
                  onClick: () => setTab("repairs"), accent: "text-blue-600 dark:text-blue-400", bg: "bg-blue-50 dark:bg-blue-500/10",
                  icon: <><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></>,
                },
                {
                  label: "Reward Points", value: loadingLoyalty ? null : (loyalty?.points_balance ?? "—"), sub: loyalty ? TIER_CFG[tier].label + " tier" : "Not enrolled",
                  onClick: () => setTab("loyalty"), accent: "text-purple-600 dark:text-purple-400", bg: "bg-purple-50 dark:bg-purple-500/10",
                  icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />,
                },
                {
                  label: "Browse Shop", value: loadingProducts ? null : products.length, sub: "items available",
                  onClick: () => setTab("shop"), accent: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-500/10",
                  icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />,
                },
              ].map(({ label, value, sub, onClick, accent, bg, icon }) => (
                <button key={label} onClick={onClick}
                  className="bg-white dark:bg-gray-900 rounded-2xl p-5 text-left border border-gray-100 dark:border-gray-800 hover:border-gray-200 dark:hover:border-gray-700 hover:shadow-md transition-all">
                  <div className={`w-9 h-9 rounded-xl ${bg} ${accent} flex items-center justify-center mb-3`}>
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">{icon}</svg>
                  </div>
                  {value === null ? (
                    <div className="h-7 w-12 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse mb-1" />
                  ) : (
                    <p className={`text-2xl font-bold ${accent}`}>{typeof value === "number" ? value.toLocaleString() : value}</p>
                  )}
                  <p className="text-xs font-semibold text-gray-900 dark:text-white mt-0.5">{label}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{sub}</p>
                </button>
              ))}
            </div>

            {/* Recent orders preview */}
            {!loadingOrders && orders.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-bold text-gray-900 dark:text-white">Recent Orders</h2>
                  <button onClick={() => setTab("orders")} className="text-xs text-blue-600 dark:text-blue-400 font-medium hover:underline">View all →</button>
                </div>
                <div className="space-y-2">
                  {orders.slice(0, 3).map((order) => (
                    <OrderRow key={order.id} order={order} />
                  ))}
                </div>
              </div>
            )}

            {/* Active repairs preview */}
            {!loadingRepairs && activeRepairs > 0 && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-bold text-gray-900 dark:text-white">Active Repairs</h2>
                  <button onClick={() => setTab("repairs")} className="text-xs text-blue-600 dark:text-blue-400 font-medium hover:underline">View all →</button>
                </div>
                <div className="space-y-3">
                  {repairs.filter((r) => !["delivered", "cancelled"].includes(r.status)).slice(0, 2).map((r) => (
                    <RepairCard key={r.id} repair={r} />
                  ))}
                </div>
              </div>
            )}

            {/* Empty state */}
            {!loadingOrders && !loadingRepairs && orders.length === 0 && repairs.length === 0 && (
              <div className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-100 dark:border-gray-800 p-10 text-center">
                <p className="text-5xl mb-4">👋</p>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Ready to get started?</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 max-w-xs mx-auto">Browse our shop for the latest devices and accessories, or book a repair for your device.</p>
                <div className="flex items-center justify-center gap-3 flex-wrap">
                  <button onClick={() => setTab("shop")} className="bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-semibold px-6 py-2.5 rounded-full text-sm hover:bg-gray-700 dark:hover:bg-gray-200 transition-colors">
                    Browse shop
                  </button>
                  <Link href="/repair" className="border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 font-semibold px-6 py-2.5 rounded-full text-sm hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                    Book a repair
                  </Link>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ══ SHOP ══════════════════════════════════════════════════════════════ */}
        {tab === "shop" && (
          <>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">
              Hi, <span className="font-semibold text-gray-900 dark:text-white">{username}</span>! Here&apos;s what&apos;s available.
            </p>

            {/* Search */}
            <div className="max-w-lg mb-5">
              <div className="relative">
                <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input type="text" value={search} onChange={(e) => { setSearch(e.target.value); setVisibleCount(PAGE_SIZE); }} placeholder="Search products…"
                  className="w-full bg-white dark:bg-gray-800 rounded-full pl-11 pr-5 py-2.5 text-sm border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition" />
              </div>
            </div>

            {/* Categories */}
            <div className="relative mb-6">
              {canLeft && (
                <button onClick={() => catRef.current?.scrollBy({ left: -200, behavior: "smooth" })} className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-white dark:bg-gray-800 shadow border border-gray-100 dark:border-gray-700 flex items-center justify-center text-gray-600 dark:text-gray-300">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                </button>
              )}
              {canRight && (
                <button onClick={() => catRef.current?.scrollBy({ left: 200, behavior: "smooth" })} className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-white dark:bg-gray-800 shadow border border-gray-100 dark:border-gray-700 flex items-center justify-center text-gray-600 dark:text-gray-300">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                </button>
              )}
              <div ref={catRef} className="flex gap-2 overflow-x-auto py-1 px-1" style={{ scrollbarWidth: "none" }}>
                {["all", ...categories].map((cat) => (
                  <button key={cat} onClick={() => { setSelectedCategory(cat); setVisibleCount(PAGE_SIZE); }}
                    className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-all whitespace-nowrap ${
                      selectedCategory === cat
                        ? "bg-gray-900 dark:bg-white text-white dark:text-gray-900 shadow"
                        : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-500"
                    }`}
                  >{cat === "all" ? "All" : cat}</button>
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
              <div className="text-center py-24 text-gray-400">
                <p className="text-5xl mb-3">🔍</p>
                <p className="text-base font-medium">No products found.</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filtered.slice(0, visibleCount).map((product) => {
                    const inCart = cart.find((i) => i.product.id === product.id);
                    return (
                      <article key={product.id} className="bg-white dark:bg-gray-900 rounded-3xl overflow-hidden hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5 border border-gray-100 dark:border-gray-800">
                        <div className="aspect-square bg-gray-50 dark:bg-gray-800 relative overflow-hidden">
                          {product.image ? (
                            <Image src={product.image.replace("/object/public/", "/render/image/public/")} alt={product.name} fill unoptimized className="object-cover"
                              onError={(e) => { (e.target as HTMLImageElement).src = "https://placehold.co/400x400/f3f4f6/9ca3af?text=No+Image"; }} />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-gray-300 dark:text-gray-600 text-sm">No image</div>
                          )}
                          {product.stock === 0 && (
                            <div className="absolute inset-0 bg-white/75 dark:bg-black/60 flex items-center justify-center">
                              <span className="text-xs font-bold uppercase tracking-widest text-gray-500 bg-white dark:bg-gray-800 px-3 py-1.5 rounded-full border border-gray-200 dark:border-gray-700">Sold out</span>
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
                                <button onClick={() => updateCartQty(product.id, -1)} className="w-7 h-7 rounded-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex items-center justify-center text-gray-700 dark:text-gray-300 font-bold text-base leading-none">−</button>
                                <span className="text-sm font-semibold w-4 text-center">{inCart.quantity}</span>
                                <button onClick={() => updateCartQty(product.id, 1)} className="w-7 h-7 rounded-full bg-gray-900 dark:bg-white text-white dark:text-gray-900 flex items-center justify-center font-bold text-base leading-none">+</button>
                              </div>
                            ) : (
                              <button onClick={() => addToCart(product)} disabled={product.stock === 0}
                                className="text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-full transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
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
                    <button onClick={() => setVisibleCount((v) => v + PAGE_SIZE)}
                      className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 font-semibold px-10 py-3 rounded-full text-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-all shadow-sm">
                      See more ({filtered.length - visibleCount} remaining)
                    </button>
                  </div>
                )}
              </>
            )}
          </>
        )}

        {/* ══ ORDERS ════════════════════════════════════════════════════════════ */}
        {tab === "orders" && (
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-5">Your Orders</h2>
            {loadingOrders ? (
              <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="h-20 bg-white dark:bg-gray-800/50 rounded-2xl animate-pulse" />)}</div>
            ) : orders.length === 0 ? (
              <div className="text-center py-24 text-gray-400">
                <p className="text-5xl mb-3">📦</p>
                <p className="text-base font-medium mb-4">No orders yet.</p>
                <button onClick={() => setTab("shop")} className="text-sm text-blue-600 dark:text-blue-400 hover:underline font-medium">Start shopping →</button>
              </div>
            ) : (
              <div className="space-y-3">
                {orders.map((order) => <OrderRow key={order.id} order={order} showYear />)}
              </div>
            )}
          </div>
        )}

        {/* ══ REPAIRS ═══════════════════════════════════════════════════════════ */}
        {tab === "repairs" && (
          <div>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">Your Repairs</h2>
              <Link href="/repair" className="text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-full transition-colors">
                + Book Repair
              </Link>
            </div>
            {loadingRepairs ? (
              <div className="space-y-4">{[...Array(2)].map((_, i) => <div key={i} className="h-44 bg-white dark:bg-gray-800/50 rounded-3xl animate-pulse" />)}</div>
            ) : repairs.length === 0 ? (
              <div className="text-center py-24 text-gray-400">
                <p className="text-5xl mb-3">🔧</p>
                <p className="text-base font-medium mb-2">No repair tickets yet.</p>
                <p className="text-sm mb-6">When you bring a device in for repair, your ticket will appear here.</p>
                <Link href="/repair" className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-2.5 rounded-full text-sm transition-colors">
                  Book a repair
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                {repairs.map((repair) => <RepairCard key={repair.id} repair={repair} expanded />)}
              </div>
            )}
          </div>
        )}

        {/* ══ LOYALTY ═══════════════════════════════════════════════════════════ */}
        {tab === "loyalty" && (
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-5">Rewards</h2>
            {loadingLoyalty ? (
              <div className="space-y-4">
                <div className="h-48 bg-white dark:bg-gray-800/50 rounded-3xl animate-pulse" />
                <div className="h-64 bg-white dark:bg-gray-800/50 rounded-3xl animate-pulse" />
              </div>
            ) : !loyalty ? (
              <div className="text-center py-24 text-gray-400">
                <p className="text-5xl mb-3">⭐</p>
                <p className="text-base font-medium mb-2">You&apos;re not enrolled yet.</p>
                <p className="text-sm mb-6 max-w-xs mx-auto">Ask us in-store to register your loyalty account and start earning points on every purchase and repair.</p>
                <Link href="/repair" className="inline-block border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 font-semibold px-6 py-2.5 rounded-full text-sm hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                  Visit us in-store
                </Link>
              </div>
            ) : (
              <div className="space-y-5">
                {/* Points card */}
                <div className={`relative overflow-hidden rounded-3xl p-7 bg-gradient-to-br ${TIER_CFG[tier].gradient} text-white`}>
                  <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full bg-white/10" />
                  <div className="relative z-10">
                    <div className="flex items-start justify-between mb-6">
                      <div>
                        <p className="text-white/60 text-xs font-medium uppercase tracking-widest">Your balance</p>
                        <p className="text-5xl font-bold mt-1">{loyalty.points_balance.toLocaleString()}</p>
                        <p className="text-white/60 text-sm mt-1">points</p>
                      </div>
                      <span className="text-xs font-bold uppercase tracking-widest bg-white/20 border border-white/30 px-3 py-1.5 rounded-full">
                        {TIER_CFG[tier].label}
                      </span>
                    </div>
                    {tier !== "platinum" ? (
                      <div>
                        <div className="flex justify-between text-xs text-white/60 mb-1.5">
                          <span>{loyalty.points_balance.toLocaleString()} pts</span>
                          <span>{TIER_CFG[tier].next.toLocaleString()} pts to next tier</span>
                        </div>
                        <div className="h-1.5 bg-white/20 rounded-full overflow-hidden">
                          <div className="h-full bg-white rounded-full transition-all duration-700"
                            style={{ width: `${Math.min(100, (loyalty.points_balance / TIER_CFG[tier].next) * 100)}%` }} />
                        </div>
                      </div>
                    ) : (
                      <p className="text-white/60 text-sm">You&apos;ve reached the highest tier!</p>
                    )}
                  </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: "Total Earned", value: loyalty.total_earned.toLocaleString(), accent: "text-emerald-600 dark:text-emerald-400" },
                    { label: "Redeemed",     value: loyalty.total_redeemed.toLocaleString(), accent: "text-purple-600 dark:text-purple-400" },
                    { label: "Member Since", value: new Date(loyalty.member_since).toLocaleDateString("en-GB", { month: "short", year: "numeric" }), accent: "text-blue-600 dark:text-blue-400" },
                  ].map(({ label, value, accent }) => (
                    <div key={label} className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-4 text-center">
                      <p className={`text-lg font-bold ${accent}`}>{value}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{label}</p>
                    </div>
                  ))}
                </div>

                {/* Tier guide */}
                <div className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-100 dark:border-gray-800 p-6">
                  <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-4">Tier Benefits</h3>
                  <div className="space-y-2">
                    {(["bronze", "silver", "gold", "platinum"] as const).map((t) => {
                      const cfg = TIER_CFG[t];
                      const isCurrent = tier === t;
                      return (
                        <div key={t} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${isCurrent ? cfg.bg : ""}`}>
                          <div className={`w-2 h-2 rounded-full bg-gradient-to-br ${cfg.gradient} flex-shrink-0`} />
                          <span className={`text-sm font-semibold flex-1 ${isCurrent ? cfg.text : "text-gray-400 dark:text-gray-500"}`}>{cfg.label}</span>
                          {isCurrent && <span className={`text-xs font-bold ${cfg.text} opacity-70`}>Current</span>}
                          <span className="text-xs text-gray-400">{t === "bronze" ? "0+" : t === "silver" ? "500+" : t === "gold" ? "2,000+" : "5,000+"} pts</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Transaction history */}
                {loyaltyTx.length > 0 && (
                  <div className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-100 dark:border-gray-800 p-6">
                    <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-4">History</h3>
                    <div className="space-y-3">
                      {loyaltyTx.map((tx) => (
                        <div key={tx.id} className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold ${
                            tx.type === "earn" || tx.type === "bonus" ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" :
                            tx.type === "redeem" || tx.type === "expire" ? "bg-red-50 dark:bg-red-500/10 text-red-500" :
                            "bg-gray-100 dark:bg-gray-800 text-gray-500"
                          }`}>
                            {tx.type === "earn" ? "+" : tx.type === "bonus" ? "★" : tx.type === "redeem" ? "−" : tx.type === "expire" ? "↓" : "~"}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-gray-900 dark:text-white truncate">{tx.description}</p>
                            <p className="text-xs text-gray-400">{new Date(tx.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</p>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className={`text-sm font-bold ${tx.points >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-500"}`}>
                              {tx.points >= 0 ? "+" : ""}{tx.points}
                            </p>
                            <p className="text-xs text-gray-400">{tx.balance_after.toLocaleString()} pts</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
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
              <h2 className="text-lg font-bold">Cart {cartCount > 0 && <span className="text-sm font-normal text-gray-400">({cartCount} items)</span>}</h2>
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
                        <p className="text-sm font-semibold truncate">{product.name}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Rs {product.price.toLocaleString()} / unit</p>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <button onClick={() => updateCartQty(product.id, -1)} className="w-6 h-6 rounded-full border border-gray-200 dark:border-gray-700 flex items-center justify-center text-sm font-bold hover:bg-gray-50 dark:hover:bg-gray-800">−</button>
                        <span className="text-sm font-semibold w-4 text-center">{quantity}</span>
                        <button onClick={() => updateCartQty(product.id, 1)} className="w-6 h-6 rounded-full bg-gray-900 dark:bg-white text-white dark:text-gray-900 flex items-center justify-center text-sm font-bold">+</button>
                        <button onClick={() => removeFromCart(product.id)} className="ml-1 text-gray-300 dark:text-gray-600 hover:text-red-400 text-xs">✕</button>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="px-6 py-5 border-t border-gray-100 dark:border-gray-800">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-sm text-gray-500 dark:text-gray-400">Total</span>
                    <span className="text-xl font-bold">Rs {cartTotal.toLocaleString()}</span>
                  </div>
                  <button onClick={() => { setCartOpen(false); setCheckoutOpen(true); }}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3.5 rounded-2xl text-sm transition-colors">
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
                  <svg className="w-8 h-8 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h3 className="text-2xl font-bold">Order placed!</h3>
                <p className="text-gray-500 dark:text-gray-400 text-sm leading-relaxed">
                  Your order has been received. Track it in <strong className="text-gray-900 dark:text-white">My Orders</strong>.
                </p>
                <button onClick={() => { closeCheckout(); setTab("orders"); }}
                  className="mt-2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-semibold px-8 py-3 rounded-2xl text-sm hover:bg-gray-700 dark:hover:bg-gray-200 transition-colors">
                  View my orders
                </button>
              </div>
            ) : (
              <div className="p-6 sm:p-8">
                <div className="flex items-start justify-between mb-5">
                  <div>
                    <h3 className="text-xl font-bold">Confirm order</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{cartCount} item{cartCount > 1 ? "s" : ""} · Rs {cartTotal.toLocaleString()}</p>
                  </div>
                  <button onClick={closeCheckout} className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 flex items-center justify-center text-gray-500 font-bold text-sm">✕</button>
                </div>
                <div className="bg-gray-50 dark:bg-gray-800/50 rounded-2xl p-4 mb-5 space-y-2">
                  {cart.map(({ product, quantity }) => (
                    <div key={product.id} className="flex items-center justify-between text-sm">
                      <span className="text-gray-700 dark:text-gray-300 truncate flex-1 mr-2">{product.name} <span className="text-gray-400">× {quantity}</span></span>
                      <span className="font-semibold flex-shrink-0">Rs {(product.price * quantity).toLocaleString()}</span>
                    </div>
                  ))}
                  <div className="border-t border-gray-200 dark:border-gray-700 pt-2 flex items-center justify-between font-bold text-sm">
                    <span>Total</span>
                    <span>Rs {cartTotal.toLocaleString()}</span>
                  </div>
                </div>
                <div className="space-y-3 mb-5">
                  {([
                    { label: "Name", field: "name" as const, type: "text", placeholder: profile.username || "Your name" },
                    { label: "Phone", field: "phone" as const, type: "tel", placeholder: profile.phone || "+230 xxx xxxx" },
                  ]).map(({ label, field, type, placeholder }) => (
                    <div key={field}>
                      <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">{label}</label>
                      <input type={type} value={checkoutForm[field]} onChange={(e) => setCheckoutForm((f) => ({ ...f, [field]: e.target.value }))} placeholder={placeholder}
                        className="w-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-xl px-4 py-2.5 text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition" />
                    </div>
                  ))}
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">Delivery notes</label>
                    <textarea value={checkoutForm.notes} onChange={(e) => setCheckoutForm((f) => ({ ...f, notes: e.target.value }))} placeholder="Address, special instructions…" rows={2}
                      className="w-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-xl px-4 py-2.5 text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition resize-none" />
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
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] bg-gray-900 dark:bg-gray-800 text-white text-sm font-medium px-5 py-2.5 rounded-full shadow-xl pointer-events-none">
          {toast}
        </div>
      )}
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function OrderRow({ order, showYear }: { order: Order; showYear?: boolean }) {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 px-5 py-4 flex items-center justify-between gap-4">
      <div className="min-w-0">
        <p className="font-semibold text-gray-900 dark:text-white text-sm truncate">{order.product_name}</p>
        <p className="text-xs text-gray-400 mt-0.5">
          Qty {order.quantity} · {new Date(order.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", ...(showYear ? { year: "numeric" } : {}) })}
        </p>
        {order.notes && <p className="text-xs text-gray-400 mt-0.5 italic truncate">{order.notes}</p>}
      </div>
      <div className="flex items-center gap-3 flex-shrink-0">
        <span className="text-sm font-bold text-gray-900 dark:text-white">Rs {order.price.toLocaleString()}</span>
        <span className={`text-xs font-semibold capitalize px-3 py-1 rounded-full border ${ORDER_STATUS_STYLES[order.status] || ORDER_STATUS_STYLES.pending}`}>{order.status}</span>
      </div>
    </div>
  );
}

function RepairCard({ repair, expanded = false }: { repair: RepairTicket; expanded?: boolean }) {
  const stepIdx = REPAIR_STEPS.indexOf(repair.status as typeof REPAIR_STEPS[number]);
  const isCancelled = repair.status === "cancelled";

  return (
    <div className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-100 dark:border-gray-800 p-6">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="min-w-0">
          <p className="text-xs font-mono text-gray-400 mb-1">{repair.ticket_no}</p>
          <h3 className="font-semibold text-sm text-gray-900 dark:text-white">{repair.device_brand} {repair.device_model}</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-1">{repair.issue_description}</p>
        </div>
        <div className="flex-shrink-0 flex flex-col items-end gap-1.5">
          <span className={`text-xs font-semibold px-3 py-1 rounded-full border ${REPAIR_STATUS_STYLES[repair.status] || REPAIR_STATUS_STYLES.received}`}>
            {REPAIR_STATUS_LABEL[repair.status] || repair.status}
          </span>
          {repair.priority !== "normal" && (
            <span className={`text-xs font-semibold ${PRIORITY_STYLES[repair.priority]}`}>
              {repair.priority === "urgent" ? "⚡ Urgent" : repair.priority === "high" ? "● High" : "○ Low"}
            </span>
          )}
        </div>
      </div>

      {/* Progress stepper */}
      {!isCancelled && stepIdx >= 0 && (
        <div className="mb-4">
          <div className="flex items-center">
            {REPAIR_STEPS.map((_, i) => {
              const done = i < stepIdx;
              const active = i === stepIdx;
              const last = i === REPAIR_STEPS.length - 1;
              return (
                <div key={i} className="flex items-center flex-1 last:flex-none">
                  <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 transition-all ${
                    done ? "bg-emerald-500 dark:bg-emerald-400" :
                    active ? "bg-blue-600 dark:bg-blue-400 ring-2 ring-blue-600/30 dark:ring-blue-400/30 ring-offset-1 dark:ring-offset-gray-900" :
                    "bg-gray-200 dark:bg-gray-700"
                  }`} />
                  {!last && <div className={`h-0.5 flex-1 ${done ? "bg-emerald-500 dark:bg-emerald-400" : "bg-gray-200 dark:bg-gray-700"}`} />}
                </div>
              );
            })}
          </div>
          <p className="text-xs text-blue-600 dark:text-blue-400 font-medium mt-1.5">
            {REPAIR_STATUS_LABEL[repair.status]}
          </p>
        </div>
      )}

      {isCancelled && (
        <p className="text-xs text-red-500 dark:text-red-400 font-medium mb-4">Repair cancelled</p>
      )}

      {/* Details (expanded only) */}
      {expanded && (
        <dl className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-xs border-t border-gray-100 dark:border-gray-800 pt-4">
          {repair.technician && (
            <><dt className="text-gray-400">Technician</dt><dd className="font-medium text-gray-700 dark:text-gray-300">{repair.technician}</dd></>
          )}
          {repair.estimated_cost != null && (
            <><dt className="text-gray-400">Estimated</dt><dd className="font-medium text-gray-700 dark:text-gray-300">Rs {repair.estimated_cost.toLocaleString()}</dd></>
          )}
          {repair.final_cost != null && (
            <><dt className="text-gray-400">Final cost</dt><dd className="font-medium text-gray-700 dark:text-gray-300">Rs {repair.final_cost.toLocaleString()}</dd></>
          )}
          {repair.estimated_completion && (
            <><dt className="text-gray-400">Est. ready</dt><dd className="font-medium text-gray-700 dark:text-gray-300">{new Date(repair.estimated_completion).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</dd></>
          )}
          <dt className="text-gray-400">Submitted</dt>
          <dd className="font-medium text-gray-700 dark:text-gray-300">{new Date(repair.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</dd>
        </dl>
      )}
    </div>
  );
}
