"use client";

import Navbar from "@/components/Navbar";
import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import Image from "next/image";
import { User } from "@supabase/supabase-js";
import ContactModal from "@/components/ContactModal";

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

const SERVICES = [
  {
    icon: "🔧",
    title: "Device Repair",
    desc: "Professional repair for all devices — screens, batteries, charging ports, and water damage recovery.",
    tag: "Most Popular",
    items: ["Screen Replacement", "Battery Swap", "Water Damage Fix", "Software Repair"],
    cardBg: "bg-gradient-to-br from-blue-50 to-sky-50/60 dark:from-blue-950/40 dark:to-blue-900/20",
    border: "border-blue-100 dark:border-blue-500/30 hover:border-blue-300 dark:hover:border-blue-500/60",
    iconBg: "bg-blue-100 dark:bg-blue-500/20",
    iconColor: "text-blue-600 dark:text-blue-300",
    tagBg: "bg-blue-600",
    dot: "bg-blue-500",
  },
  {
    icon: "🛒",
    title: "Retail Shop",
    desc: "Brand new smartphones, laptops, accessories, cables and peripherals at competitive prices.",
    tag: "New Arrivals",
    items: ["Smartphones", "Laptops & Tablets", "Accessories", "Cables & Adapters"],
    cardBg: "bg-gradient-to-br from-emerald-50 to-teal-50/60 dark:from-emerald-950/40 dark:to-emerald-900/20",
    border: "border-emerald-100 dark:border-emerald-500/30 hover:border-emerald-300 dark:hover:border-emerald-500/60",
    iconBg: "bg-emerald-100 dark:bg-emerald-500/20",
    iconColor: "text-emerald-600 dark:text-emerald-300",
    tagBg: "bg-emerald-500",
    dot: "bg-emerald-500",
  },
  {
    icon: "💰",
    title: "Buy & Sell",
    desc: "Trade in your old devices for cash or upgrade credit. Fair valuations and instant payment guaranteed.",
    tag: "Best Value",
    items: ["Device Trade-In", "Cash Offers", "Upgrade Credit", "Refurbished Deals"],
    cardBg: "bg-gradient-to-br from-amber-50 to-orange-50/60 dark:from-amber-950/40 dark:to-amber-900/20",
    border: "border-amber-100 dark:border-amber-500/30 hover:border-amber-300 dark:hover:border-amber-500/60",
    iconBg: "bg-amber-100 dark:bg-amber-500/20",
    iconColor: "text-amber-600 dark:text-amber-300",
    tagBg: "bg-amber-500",
    dot: "bg-amber-500",
  },
  {
    icon: "🖥️",
    title: "Tech Services",
    desc: "Full IT support — network setup, data recovery, virus removal, software installation and more.",
    tag: "Pro Support",
    items: ["Network Setup", "Data Recovery", "Virus Removal", "IT Consultation"],
    cardBg: "bg-gradient-to-br from-violet-50 to-purple-50/60 dark:from-violet-950/40 dark:to-violet-900/20",
    border: "border-violet-100 dark:border-violet-500/30 hover:border-violet-300 dark:hover:border-violet-500/60",
    iconBg: "bg-violet-100 dark:bg-violet-500/20",
    iconColor: "text-violet-600 dark:text-violet-300",
    tagBg: "bg-violet-600",
    dot: "bg-violet-500",
  },
];

const priorityColors: Record<string, string> = {
  high: "text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/30",
  medium: "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/30",
  low: "text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30",
};

const updateTypeIcons: Record<string, string> = {
  feature: "✨",
  fix: "🔧",
  announcement: "📣",
};

function AdminBadge({ isAdmin }: { isAdmin: boolean }) {
  if (!isAdmin) return null;
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full bg-violet-100 dark:bg-violet-500/15 text-violet-600 dark:text-violet-300 border border-violet-200 dark:border-violet-500/30">
      <span className="w-1.5 h-1.5 rounded-full bg-violet-500 dark:bg-violet-400 animate-pulse" />
      Admin
    </span>
  );
}

function StockBadge({ stock }: { stock: number }) {
  if (stock === 0)
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-md bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-500/20">
        <span className="w-1.5 h-1.5 rounded-full bg-red-500" /> Out of stock
      </span>
    );
  if (stock <= 5)
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-md bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-500/20">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" /> Low: {stock} left
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-md bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20">
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
  const [adminStats, setAdminStats] = useState<AdminStats>({ totalRevenue: 0, outOfStockCount: 0, lowStockCount: 0 });
  const [activeUpdateType, setActiveUpdateType] = useState<string>("all");
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [quickViewProduct, setQuickViewProduct] = useState<Product | null>(null);
  const [activeServiceIdx, setActiveServiceIdx] = useState<number | null>(null);
  const [showContact, setShowContact] = useState(false);
  const [profileUsername, setProfileUsername] = useState<string | null>(null);
  const [comments, setComments] = useState<{ id: string; name: string; message: string; created_at: string }[]>([]);
  const [commentForm, setCommentForm] = useState({ name: "", message: "" });
  const [submittingComment, setSubmittingComment] = useState(false);

  const showToast = (message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    const fetchAllData = async () => {
      const [productsRes, socialRes, updatesRes, authRes, usersRes] = await Promise.all([
        supabase.from("products").select("*").order("created_at", { ascending: false }),
        supabase.from("social_profiles").select("id, platform_name, platform_icon, profile_link, username, description, followers, is_active").order("created_at", { ascending: false }),
        supabase.from("updates").select("*").order("created_at", { ascending: false }),
        supabase.auth.getUser(),
        supabase.from("profiles").select("id", { count: "exact", head: true }),
      ]);

      const fetchedProducts: Product[] = productsRes.data || [];
      const fetchedUser = authRes.data?.user || null;

      setProducts(fetchedProducts);
      setSocialProfiles(socialRes.data || []);
      setUpdates(updatesRes.data || []);
      setUser(fetchedUser);
      setTotalUsers(usersRes.count || 0);

      if (fetchedUser) {
        const role = fetchedUser.user_metadata?.role || fetchedUser.app_metadata?.role;
        setIsAdmin(role === "admin");
        const { data: prof } = await supabase
          .from("profiles")
          .select("username")
          .eq("id", fetchedUser.id)
          .single();
        setProfileUsername(prof?.username || null);
      }

      const outOfStock = fetchedProducts.filter((p) => p.stock === 0).length;
      const lowStock = fetchedProducts.filter((p) => p.stock > 0 && p.stock <= 5).length;
      const revenue = fetchedProducts.reduce((acc, p) => acc + p.price * (p.stock || 0), 0);
      setAdminStats({ totalRevenue: revenue, outOfStockCount: outOfStock, lowStockCount: lowStock });
      setLoading(false);
    };

    fetchAllData();
    fetchComments();
    const { data: authListener } = supabase.auth.onAuthStateChange((_, session) => setUser(session?.user || null));
    return () => { authListener.subscription.unsubscribe(); };
  }, []);

  const fetchComments = async () => {
    const { data } = await supabase.from("comments").select("id, name, message, created_at").order("created_at", { ascending: false }).limit(6);
    setComments(data || []);
  };

  const handleSubmitComment = async () => {
    if (!commentForm.name.trim() || !commentForm.message.trim()) {
      showToast("Please fill in your name and message", "error"); return;
    }
    setSubmittingComment(true);
    const { error } = await supabase.from("comments").insert([{ name: commentForm.name.trim(), message: commentForm.message.trim() }]);
    setSubmittingComment(false);
    if (error) { showToast("Failed to send comment", "error"); return; }
    showToast("Comment sent! Thank you.");
    setCommentForm({ name: "", message: "" });
    fetchComments();
  };

  const handleCopyLink = (productId: string) => {
    const url = `${window.location.origin}/product/${productId}`;
    navigator.clipboard?.writeText(url).then(() => showToast("Link copied!")).catch(() => showToast("Could not copy link", "error"));
  };

  const closeQuickView = () => setQuickViewProduct(null);

  const filteredUpdates = activeUpdateType === "all" ? updates : updates.filter((u) => (u.type || "announcement") === activeUpdateType);
  const updateTypes = ["all", ...Array.from(new Set(updates.map((u) => u.type || "announcement")))];
  const featuredProducts = products.filter((p) => p.stock > 0).slice(0, 3);

  return (
    <main className="min-h-screen bg-white dark:bg-gray-950 text-gray-900 dark:text-white">
      <Navbar />

      {/* ── Hero ─────────────────────────────────────────────────────────────── */}
      <section className="relative py-20 md:py-28 flex flex-col items-center justify-center text-center px-4 overflow-hidden border-b border-gray-100 dark:border-gray-800/50">
        <div className="absolute inset-0 bg-gradient-to-b from-blue-50/80 dark:from-blue-500/[0.06] via-transparent to-transparent pointer-events-none" />
        <div
          className="absolute inset-0 pointer-events-none opacity-[0.03] dark:opacity-[0.04]"
          style={{
            backgroundImage: "linear-gradient(rgba(0,0,0,1) 1px,transparent 1px),linear-gradient(90deg,rgba(0,0,0,1) 1px,transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />
        <div className="relative z-10 flex flex-col items-center gap-4 max-w-3xl">
          {user && (
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm text-gray-500 dark:text-gray-400">
                Welcome back, <span className="font-semibold text-gray-900 dark:text-white">{profileUsername || user.email?.split("@")[0]}</span>
              </span>
              <AdminBadge isAdmin={isAdmin} />
            </div>
          )}

          <div className="inline-flex items-center gap-2 text-xs font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-400/10 border border-blue-200 dark:border-blue-400/20 px-4 py-1.5 rounded-full uppercase tracking-widest">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 dark:bg-blue-400 animate-pulse" />
            Your Local Tech Experts — Mauritius
          </div>

          <h1 className="text-5xl md:text-6xl lg:text-7xl font-extrabold mb-3 text-transparent bg-clip-text bg-gradient-to-r from-gray-900 via-gray-700 to-gray-500 dark:from-white dark:via-gray-200 dark:to-gray-400 tracking-tight leading-tight">
            Repair. Buy. Sell.<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-violet-600 dark:from-blue-400 dark:to-violet-400">
              Tech Services.
            </span>
          </h1>

          <p className="text-lg text-gray-500 dark:text-gray-400 max-w-xl leading-relaxed">
            From device repairs to retail shopping — your one-stop tech hub for everything digital.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3 mt-2">
            <a href="#services" className="bg-gray-900 dark:bg-white text-white dark:text-black px-7 py-3 rounded-full font-semibold hover:bg-gray-700 dark:hover:bg-gray-200 hover:scale-105 transition-all duration-200 shadow-lg shadow-gray-900/10">
              Our Services
            </a>
            <Link href="/Clients" className="border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 px-7 py-3 rounded-full font-semibold hover:border-blue-400 dark:hover:border-blue-500 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-500/5 transition-all duration-200">
              Browse Shop →
            </Link>
          </div>

          {/* Trust badges */}
          <div className="flex flex-wrap justify-center gap-6 mt-6 text-xs font-medium text-gray-400 dark:text-gray-500">
            {["⭐ 500+ Repairs Done", "📦 Fast Delivery", "🔒 Warranty Included", "💬 24/7 Support"].map((b) => (
              <span key={b}>{b}</span>
            ))}
          </div>
        </div>
      </section>

      <div className="max-w-6xl mx-auto px-6 py-16 space-y-24">

        {/* ── Services ───────────────────────────────────────────────────────── */}
        <section id="services">
          <div className="text-center mb-12">
            <span className="inline-flex items-center gap-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-4 block">What we offer</span>
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white mb-3">Everything Tech, Under One Roof</h2>
            <p className="text-gray-500 dark:text-gray-400 max-w-2xl mx-auto">
              Professional services for individuals and businesses. Trusted by hundreds of customers across Mauritius.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {SERVICES.map((svc, i) => (
              <div
                key={svc.title}
                className={`relative rounded-2xl p-6 border transition-all duration-300 cursor-default group ${svc.cardBg} ${svc.border} hover:-translate-y-1 hover:shadow-lg dark:hover:shadow-2xl dark:hover:shadow-black/40`}
                onMouseEnter={() => setActiveServiceIdx(i)}
                onMouseLeave={() => setActiveServiceIdx(null)}
              >
                {/* Tag */}
                <div className={`absolute top-4 right-4 text-[10px] font-bold uppercase tracking-widest text-white px-2.5 py-1 rounded-full ${svc.tagBg}`}>
                  {svc.tag}
                </div>

                {/* Icon */}
                <div className={`w-12 h-12 rounded-xl ${svc.iconBg} flex items-center justify-center text-2xl mb-4 group-hover:scale-110 transition-transform duration-300`}>
                  {svc.icon}
                </div>

                <h3 className={`text-lg font-bold mb-2 ${svc.iconColor}`}>{svc.title}</h3>
                <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed mb-5">{svc.desc}</p>

                <ul className="space-y-2">
                  {svc.items.map((item) => (
                    <li key={item} className="flex items-center gap-2 text-xs text-gray-700 dark:text-gray-300 font-medium">
                      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${svc.dot}`} />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {/* CTA row */}
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4 p-6 bg-gray-50 dark:bg-gray-900/50 rounded-2xl border border-gray-100 dark:border-gray-800">
            <div className="text-center sm:text-left">
              <p className="font-semibold text-gray-900 dark:text-white">Need a repair or service?</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">Visit us or get in touch — we&apos;re ready to help.</p>
            </div>
            <div className="flex gap-3 flex-shrink-0">
              <Link href="/Clients" className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-5 py-2.5 rounded-xl text-sm transition-colors shadow-sm shadow-blue-600/20">
                Shop Now
              </Link>
              <button
                onClick={() => setShowContact(true)}
                className="border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-blue-400 dark:hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-500/5 hover:text-blue-600 dark:hover:text-blue-400 font-semibold px-5 py-2.5 rounded-xl text-sm transition-colors"
              >
                Contact Us
              </button>
            </div>
          </div>
        </section>

        {/* ── Featured Products ──────────────────────────────────────────────── */}
        {loading ? (
          <section>
            <div className="flex items-end justify-between mb-8">
              <div>
                <div className="h-8 w-56 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse mb-2" />
                <div className="h-4 w-40 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-gray-50 dark:bg-gray-900/40 border border-gray-100 dark:border-gray-800 rounded-2xl overflow-hidden animate-pulse">
                  <div className="aspect-[4/3] bg-gray-100 dark:bg-gray-800/80" />
                  <div className="p-5 space-y-3">
                    <div className="h-5 w-3/4 bg-gray-100 dark:bg-gray-800 rounded" />
                    <div className="h-4 w-1/2 bg-gray-100 dark:bg-gray-800 rounded" />
                    <div className="h-8 bg-gray-100 dark:bg-gray-800 rounded-xl" />
                  </div>
                </div>
              ))}
            </div>
          </section>
        ) : featuredProducts.length > 0 ? (
          <section>
            <div className="flex items-end justify-between mb-8">
              <div>
                <span className="text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 block mb-1">Our catalog</span>
                <h2 className="text-3xl font-bold text-gray-900 dark:text-white">Featured Products</h2>
                <p className="text-gray-500 dark:text-gray-400 mt-1">Handpicked items from our latest stock</p>
              </div>
              <Link href="/Clients" className="flex items-center gap-1.5 text-sm font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors">
                View all
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {featuredProducts.map((product) => (
                <div
                  key={product.id}
                  className="group bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl overflow-hidden hover:border-gray-200 dark:hover:border-gray-700 hover:shadow-lg dark:hover:shadow-2xl dark:hover:shadow-black/50 transition-all duration-300 flex flex-col"
                >
                  <div
                    className="aspect-[4/3] bg-gray-100 dark:bg-gray-800/80 relative overflow-hidden cursor-pointer"
                    onClick={() => setQuickViewProduct(product)}
                  >
                    {product.image ? (
                      <Image
                        src={product.image.replace("/object/public/", "/render/image/public/")}
                        alt={product.name}
                        fill
                        unoptimized
                        className="object-cover group-hover:scale-105 transition-transform duration-500"
                        onError={(e) => { (e.target as HTMLImageElement).src = "https://placehold.co/400x300/f3f4f6/9ca3af?text=No+Image"; }}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-400 text-sm">No Image</div>
                    )}
                    <div className="absolute top-3 right-3 bg-white/90 dark:bg-black/70 backdrop-blur-sm text-gray-900 dark:text-white px-3 py-1 rounded-full text-sm font-bold border border-gray-200 dark:border-gray-700 shadow-sm">
                      Rs {product.price.toLocaleString()}
                    </div>
                    {/* Hover overlay */}
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                      <span className="text-white text-xs font-semibold bg-white/15 backdrop-blur-sm px-4 py-2 rounded-full border border-white/20 translate-y-3 group-hover:translate-y-0 transition-transform duration-300">
                        Quick View
                      </span>
                    </div>
                  </div>
                  <div className="p-5 flex flex-col flex-1">
                    {product.category && (
                      <span className="text-[10px] font-semibold uppercase tracking-widest text-blue-600 dark:text-blue-400 mb-1">{product.category}</span>
                    )}
                    <h3 className="text-base font-bold text-gray-900 dark:text-white line-clamp-1 mb-1 flex-1">{product.name}</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-300 line-clamp-2 mb-4 leading-relaxed">{product.description || "No description provided."}</p>
                    <div className="flex items-center justify-between">
                      <StockBadge stock={product.stock} />
                      <Link
                        href="/Clients"
                        className="text-sm font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
                      >
                        Order →
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {products.length > 3 && (
              <div className="mt-8 text-center">
                <Link href="/Clients" className="inline-flex items-center gap-2 px-6 py-3 bg-gray-100 dark:bg-gray-900/60 border border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-500/50 hover:bg-blue-50 dark:hover:bg-blue-500/5 text-gray-700 dark:text-white rounded-xl font-semibold text-sm transition-all shadow-sm">
                  See all {products.length} products in shop
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
                </Link>
              </div>
            )}
          </section>
        ) : null}

        {/* ── Quick Access ───────────────────────────────────────────────────── */}
        <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Link href="/Clients" className="group relative overflow-hidden bg-gradient-to-br from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 rounded-2xl p-6 transition-all hover:-translate-y-0.5 hover:shadow-xl hover:shadow-blue-600/25">
            <div className="absolute -right-6 -top-6 w-32 h-32 bg-white/10 rounded-full" />
            <div className="absolute -right-2 -bottom-8 w-24 h-24 bg-white/5 rounded-full" />
            <div className="relative z-10 flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                </svg>
              </div>
              <h3 className="text-base font-bold text-white">Shop Products →</h3>
            </div>
            <p className="relative z-10 text-sm text-blue-100">Browse our full catalog and place orders directly.</p>
          </Link>
          <Link href="/client-dashboard" className="group relative overflow-hidden bg-gradient-to-br from-indigo-500 to-violet-600 hover:from-indigo-400 hover:to-violet-500 rounded-2xl p-6 transition-all hover:-translate-y-0.5 hover:shadow-xl hover:shadow-violet-500/25">
            <div className="absolute -right-6 -top-6 w-32 h-32 bg-white/10 rounded-full" />
            <div className="absolute -right-2 -bottom-8 w-24 h-24 bg-white/5 rounded-full" />
            <div className="relative z-10 flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <h3 className="text-base font-bold text-white">My Dashboard →</h3>
            </div>
            <p className="relative z-10 text-sm text-indigo-100">View your orders, track status, and manage your account.</p>
          </Link>
        </section>

        {/* ── Stats Overview ─────────────────────────────────────────────────── */}
        {!loading && (
          <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { value: products.length, label: "Products", color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-50 dark:bg-blue-500/10", icon: "📦" },
              { value: updates.length, label: "Updates", color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-500/10", icon: "📢" },
              { value: socialProfiles.length, label: "Platforms", color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-50 dark:bg-amber-500/10", icon: "🌐" },
              { value: totalUsers, label: "Members", color: "text-violet-600 dark:text-violet-400", bg: "bg-violet-50 dark:bg-violet-500/10", icon: "👥" },
            ].map(({ value, label, color, bg, icon }) => (
              <div key={label} className="bg-white dark:bg-gray-900/60 border border-gray-100 dark:border-gray-800 rounded-2xl p-5 shadow-sm dark:shadow-none text-center hover:shadow-md transition-shadow">
                <div className={`w-10 h-10 rounded-xl ${bg} text-xl flex items-center justify-center mx-auto mb-3`}>{icon}</div>
                <h3 className={`text-3xl font-extrabold ${color} mb-1`}>{value}</h3>
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">{label}</p>
              </div>
            ))}
          </section>
        )}

        {/* ── Admin Quick Stats ──────────────────────────────────────────────── */}
        {isAdmin && !loading && (
          <section>
            <div className="mb-5 flex items-center gap-3">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">Admin Overview</h2>
              <span className="text-xs font-semibold px-3 py-1 rounded-full bg-violet-100 dark:bg-violet-500/10 text-violet-600 dark:text-violet-300 border border-violet-200 dark:border-violet-500/20">Admins only</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-5">
              {[
                { label: "Est. Inventory Value", value: `Rs ${adminStats.totalRevenue.toLocaleString()}`, icon: "💵", color: "text-violet-600 dark:text-violet-300", border: "border-violet-100 dark:border-violet-800/30 hover:border-violet-300 dark:hover:border-violet-500/50" },
                { label: "Low Stock Alerts", value: `${adminStats.lowStockCount} Products`, icon: "⚠️", color: "text-amber-600 dark:text-amber-300", border: "border-amber-100 dark:border-amber-800/30 hover:border-amber-300 dark:hover:border-amber-500/50" },
                { label: "Out of Stock", value: `${adminStats.outOfStockCount} Products`, icon: "❌", color: "text-red-600 dark:text-red-300", border: "border-red-100 dark:border-red-800/30 hover:border-red-300 dark:hover:border-red-500/50" },
              ].map((stat) => (
                <div key={stat.label} className={`bg-white dark:bg-gray-900/60 border rounded-2xl p-5 flex items-center gap-4 transition-colors ${stat.border}`}>
                  <span className="text-3xl">{stat.icon}</span>
                  <div>
                    <p className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-widest font-semibold mb-0.5">{stat.label}</p>
                    <p className={`text-xl font-extrabold ${stat.color}`}>{stat.value}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: "Add Product", href: "/admin/products/new", icon: "➕" },
                { label: "Post Update", href: "/admin/updates/new", icon: "📝" },
                { label: "Manage Users", href: "/admin/users", icon: "👥" },
                { label: "Social Links", href: "/admin/social", icon: "🔗" },
              ].map((action) => (
                <Link key={action.label} href={action.href} className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-white dark:bg-gray-900/60 border border-gray-200 dark:border-gray-800 hover:border-violet-300 dark:hover:border-violet-500/40 hover:bg-violet-50 dark:hover:bg-violet-500/5 text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-violet-700 dark:hover:text-white transition-all">
                  <span>{action.icon}</span> {action.label}
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* ── Updates ────────────────────────────────────────────────────────── */}
        {updates.length > 0 && (
          <section>
            <div className="mb-8 border-b border-gray-200 dark:border-gray-800 pb-4 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Latest Updates</h2>
                <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm">Platform announcements and news</p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {updateTypes.map((type) => (
                  <button key={type} onClick={() => setActiveUpdateType(type)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all border ${activeUpdateType === type ? "bg-emerald-100 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/30" : "bg-white dark:bg-gray-900/60 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-800 hover:border-gray-400 dark:hover:border-gray-600"}`}>
                    {type === "all" ? `All (${updates.length})` : `${updateTypeIcons[type] || ""} ${type}`}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {filteredUpdates.slice(0, 4).map((update) => {
                const priority = update.priority || "low";
                const type = update.type || "announcement";
                return (
                  <div key={update.id} className="bg-gray-50 dark:bg-gray-900/40 border border-gray-100 dark:border-gray-800 rounded-2xl p-6 hover:border-emerald-200 dark:hover:border-emerald-500/40 transition-colors relative overflow-hidden">
                    {update.priority && (
                      <div className={`absolute top-0 right-0 text-[10px] font-bold uppercase px-2.5 py-1 rounded-bl-xl border-l border-b ${priorityColors[priority]}`}>
                        {priority}
                      </div>
                    )}
                    <div className="flex items-center gap-2 mb-3 pr-14">
                      <span className="text-lg">{updateTypeIcons[type] || "📣"}</span>
                      <h3 className="text-base font-bold text-gray-900 dark:text-white leading-tight">{update.info}</h3>
                    </div>
                    {update.created_at && (
                      <p className="text-xs text-gray-400 dark:text-gray-600 mb-2">
                        {new Date(update.created_at).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" })}
                      </p>
                    )}
                    <p className="text-gray-600 dark:text-gray-300 text-sm leading-relaxed line-clamp-3">{update.content}</p>
                    {update.link && (
                      <a href={update.link.startsWith("http") ? update.link : `https://${update.link}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 mt-3 text-emerald-600 dark:text-emerald-400 text-xs font-semibold hover:text-emerald-700 dark:hover:text-emerald-300 transition-colors">
                        Read more ↗
                      </a>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* ── Social Profiles ─────────────────────────────────────────────────── */}
        {socialProfiles.length > 0 && (
          <section>
            <div className="mb-8 border-b border-gray-200 dark:border-gray-800 pb-4">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Connect With Us</h2>
              <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm">Find us across different platforms</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {socialProfiles.map((profile) => (
                <div key={profile.id} className="bg-white dark:bg-gray-900/40 border border-gray-100 dark:border-gray-800 rounded-2xl p-5 hover:border-indigo-200 dark:hover:border-indigo-500/40 transition-all flex flex-col shadow-sm dark:shadow-none relative">
                  {profile.is_active !== undefined && (
                    <span className={`absolute top-4 right-4 w-2 h-2 rounded-full ${profile.is_active ? "bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.6)]" : "bg-gray-300 dark:bg-gray-600"}`} />
                  )}
                  <div className="flex items-center gap-3 mb-3">
                    {profile.platform_icon ? (
                      <Image src={profile.platform_icon} alt={profile.platform_name} width={40} height={40} unoptimized className="w-10 h-10 rounded-xl object-cover bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700"
                        onError={(e) => { (e.target as HTMLImageElement).src = `https://placehold.co/40x40/f3f4f6/9ca3af?text=${profile.platform_name.charAt(0)}`; }} />
                    ) : (
                      <div className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 flex items-center justify-center text-base font-bold text-gray-500 dark:text-gray-300">
                        {profile.platform_name.charAt(0)}
                      </div>
                    )}
                    <div className="min-w-0">
                      <h3 className="font-bold text-gray-900 dark:text-white text-sm truncate">{profile.platform_name}</h3>
                      {profile.username && <p className="text-xs text-gray-500 dark:text-gray-400 truncate">@{profile.username}</p>}
                    </div>
                  </div>
                  {profile.description && <p className="text-xs text-gray-500 dark:text-gray-400 mb-3 line-clamp-2 flex-1">{profile.description}</p>}
                  {profile.followers && profile.followers > 0 && (
                    <p className="text-xs text-gray-400 dark:text-gray-500 mb-3">
                      <span className="font-semibold text-gray-700 dark:text-gray-300">{profile.followers.toLocaleString()}</span> followers
                    </p>
                  )}
                  <a href={profile.profile_link.startsWith("http") ? profile.profile_link : `https://${profile.profile_link}`} target="_blank" rel="noopener noreferrer"
                    className="mt-auto text-center bg-gray-100 dark:bg-gray-800 hover:bg-indigo-600 dark:hover:bg-indigo-600 text-gray-700 dark:text-white hover:text-white py-2 rounded-xl text-xs font-semibold transition-all border border-gray-200 dark:border-gray-700 hover:border-indigo-500">
                    Visit Profile
                  </a>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── Comments ───────────────────────────────────────────────────────── */}
        <section>
          <div className="mb-8 border-b border-gray-200 dark:border-gray-800 pb-4">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Leave a Comment</h2>
            <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm">Share your feedback or experience with us</p>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Submit form */}
            <div className="bg-gray-50 dark:bg-gray-900/40 border border-gray-100 dark:border-gray-800 rounded-2xl p-6 space-y-4">
              <div>
                <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider block mb-1.5">Your Name</label>
                <input value={commentForm.name} onChange={(e) => setCommentForm({ ...commentForm, name: e.target.value })} placeholder="John Doe"
                  className="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:border-blue-500 dark:focus:border-cyan-500 focus:ring-1 focus:ring-blue-500/30 dark:focus:ring-cyan-500/30 transition-all" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider block mb-1.5">Message</label>
                <textarea value={commentForm.message} onChange={(e) => setCommentForm({ ...commentForm, message: e.target.value })} rows={4}
                  placeholder="Share your experience, feedback or question…"
                  className="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:border-blue-500 dark:focus:border-cyan-500 focus:ring-1 focus:ring-blue-500/30 dark:focus:ring-cyan-500/30 transition-all resize-none" />
              </div>
              <button onClick={handleSubmitComment} disabled={submittingComment}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors">
                {submittingComment ? "Sending…" : "Send Comment"}
              </button>
            </div>

            {/* Recent comments */}
            <div className="space-y-3">
              {comments.length === 0 ? (
                <div className="text-center text-gray-400 dark:text-gray-600 text-sm pt-8">No comments yet. Be the first!</div>
              ) : (
                comments.map((c) => (
                  <div key={c.id} className="bg-white dark:bg-gray-900/40 border border-gray-100 dark:border-gray-800 rounded-2xl px-5 py-4">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-semibold text-gray-900 dark:text-white text-sm">{c.name}</span>
                      <span className="text-xs text-gray-400 dark:text-gray-600">{new Date(c.created_at).toLocaleDateString("en-US", { day: "numeric", month: "short" })}</span>
                    </div>
                    <p className="text-gray-500 dark:text-gray-400 text-sm leading-relaxed">{c.message}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>

      </div>

      {/* ── Quick View Modal ───────────────────────────────────────────────────── */}
      {quickViewProduct && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-sm" onClick={closeQuickView}>
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-3xl shadow-2xl w-full max-w-3xl max-h-[88vh] overflow-hidden flex flex-col md:flex-row relative" onClick={(e) => e.stopPropagation()}>
            <button onClick={closeQuickView} className="absolute top-4 right-4 z-10 w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800 hover:bg-red-500 text-gray-600 dark:text-gray-300 hover:text-white transition-colors border border-gray-200 dark:border-gray-700">✕</button>
            <div className="w-full md:w-2/5 aspect-square md:aspect-auto bg-gray-100 dark:bg-gray-800 relative flex-shrink-0">
              {quickViewProduct.image ? (
                <Image src={quickViewProduct.image.replace("/object/public/", "/render/image/public/")} alt={quickViewProduct.name} fill unoptimized className="object-cover" />
              ) : <div className="w-full h-full flex items-center justify-center text-gray-400">No Image</div>}
            </div>
            <div className="p-6 md:p-8 flex flex-col flex-1 overflow-y-auto">
              <div className="flex items-center gap-2 mb-3 flex-wrap">
                {quickViewProduct.category && <span className="text-xs font-semibold uppercase tracking-widest text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-400/10 border border-blue-200 dark:border-blue-400/20 px-3 py-1 rounded-lg">{quickViewProduct.category}</span>}
                <StockBadge stock={quickViewProduct.stock} />
              </div>
              <h2 className="text-2xl font-extrabold text-gray-900 dark:text-white mb-2">{quickViewProduct.name}</h2>
              <p className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Rs {quickViewProduct.price.toLocaleString()}</p>
              <p className="text-gray-500 dark:text-gray-400 text-sm leading-relaxed flex-1 mb-6">{quickViewProduct.description || "No description provided."}</p>
              <div className="flex gap-3">
                <button onClick={() => handleCopyLink(quickViewProduct.id)} className="flex-1 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-white font-semibold py-2.5 rounded-xl text-sm transition-all border border-gray-200 dark:border-gray-700 flex items-center justify-center gap-2">
                  Copy Link
                </button>
                <Link href="/Clients" className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-xl text-sm transition-all text-center">
                  Order in Shop →
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Contact Modal ──────────────────────────────────────────────────────── */}
      {showContact && <ContactModal onClose={() => setShowContact(false)} />}

      {/* ── Toast ─────────────────────────────────────────────────────────────── */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-[110] flex items-center gap-3 px-5 py-3.5 rounded-xl shadow-2xl transition-all ${toast.type === "success" ? "bg-emerald-50 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-500/30" : "bg-red-50 dark:bg-rose-500/20 text-red-600 dark:text-rose-200 border border-red-200 dark:border-rose-500/30"}`}>
          <span>{toast.type === "success" ? "✅" : "❌"}</span>
          <span className="text-sm font-semibold">{toast.message}</span>
        </div>
      )}
    </main>
  );
}
