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
    title: "Device Repair",
    desc: "Professional repair for all devices — screens, batteries, charging ports, and water damage recovery.",
    tag: "Most Popular",
    items: ["Screen Replacement", "Battery Swap", "Water Damage Fix", "Software Repair"],
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-6.336l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437l1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008z" />
      </svg>
    ),
  },
  {
    title: "Retail Shop",
    desc: "Brand new smartphones, laptops, accessories, cables and peripherals at competitive prices.",
    tag: "New Arrivals",
    items: ["Smartphones", "Laptops & Tablets", "Accessories", "Cables & Adapters"],
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" />
      </svg>
    ),
  },
  {
    title: "Buy & Sell",
    desc: "Trade in your old devices for cash or upgrade credit. Fair valuations and instant payment guaranteed.",
    tag: "Best Value",
    items: ["Device Trade-In", "Cash Offers", "Upgrade Credit", "Refurbished Deals"],
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
      </svg>
    ),
  },
  {
    title: "Tech Services",
    desc: "Full IT support — network setup, data recovery, virus removal, software installation and more.",
    tag: "Pro Support",
    items: ["Network Setup", "Data Recovery", "Virus Removal", "IT Consultation"],
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0H3" />
      </svg>
    ),
  },
];

const WHY_CHOOSE_US = [
  { title: "Fast Turnaround", desc: "Most repairs completed same-day or within 24–48 hours." },
  { title: "Warranty Included", desc: "Every repair and product comes with a full warranty." },
  { title: "Certified Technicians", desc: "Years of experience handling Apple, Samsung, and more." },
  { title: "Best Price Guarantee", desc: "Transparent pricing with zero hidden fees — always." },
  { title: "Free Diagnosis", desc: "We diagnose any device at no cost before proceeding." },
  { title: "Customer First", desc: "500+ happy customers across Mauritius trust us." },
];

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
  const [showContact, setShowContact] = useState(false);
  const [profileUsername, setProfileUsername] = useState<string | null>(null);
  const [comments, setComments] = useState<{ id: string; name: string; message: string; created_at: string }[]>([]);
  const [commentForm, setCommentForm] = useState({ name: "", message: "" });
  const [submittingComment, setSubmittingComment] = useState(false);
  const [animatedStats, setAnimatedStats] = useState({ products: 0, updates: 0, platforms: 0, members: 0 });
  const statsRef = useRef<HTMLElement>(null);
  const statsAnimated = useRef(false);

  const showToast = (message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    const fetchAllData = async () => {
      const [productsRes, socialRes, updatesRes, authRes, usersRes] = await Promise.all([
        supabase.from("products").select("*").eq("is_public", true).order("created_at", { ascending: false }),
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
        const { data: prof } = await supabase.from("profiles").select("username").eq("id", fetchedUser.id).single();
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

  useEffect(() => {
    if (loading || !statsRef.current) return;
    const targets = { products: products.length, updates: updates.length, platforms: socialProfiles.length, members: totalUsers };
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !statsAnimated.current) {
          statsAnimated.current = true;
          const steps = 60;
          const interval = 1500 / steps;
          let step = 0;
          const timer = setInterval(() => {
            step++;
            const eased = 1 - Math.pow(1 - step / steps, 3);
            setAnimatedStats({
              products: Math.round(targets.products * eased),
              updates: Math.round(targets.updates * eased),
              platforms: Math.round(targets.platforms * eased),
              members: Math.round(targets.members * eased),
            });
            if (step >= steps) clearInterval(timer);
          }, interval);
        }
      },
      { threshold: 0.3 }
    );
    observer.observe(statsRef.current);
    return () => observer.disconnect();
  }, [loading, products, updates, socialProfiles, totalUsers]);

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

  const filteredUpdates = activeUpdateType === "all" ? updates : updates.filter((u) => (u.type || "announcement") === activeUpdateType);
  const updateTypes = ["all", ...Array.from(new Set(updates.map((u) => u.type || "announcement")))];
  const featuredProducts = products.filter((p) => p.stock > 0).slice(0, 6);

  const eb = "text-[11px] font-semibold tracking-[0.2em] uppercase text-zinc-500 mb-5 block";
  const h2 = "text-5xl md:text-6xl font-bold tracking-tight leading-[1.05] text-black dark:text-white";

  return (
    <main className="min-h-screen bg-white dark:bg-black text-black dark:text-white pt-14 overflow-x-hidden">
      <Navbar />

      {/* ══════════════════ HERO ══════════════════ */}
      <section className="bg-white dark:bg-zinc-950 py-16 px-6 sm:px-10 lg:px-16">
        <div className="max-w-7xl mx-auto">

          {/* Eyebrow + welcome */}
          <div className="flex flex-wrap items-center justify-between gap-3 mb-8">
            <p className="text-[11px] font-semibold tracking-[0.25em] uppercase text-blue-500">
              Tech Ninja · Mauritius
            </p>
            {user && (
              <span className="inline-flex items-center gap-2 text-[10px] font-semibold tracking-[0.15em] uppercase text-zinc-500 border border-zinc-200 dark:border-zinc-800 rounded-full px-3 py-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0" />
                Welcome back, {profileUsername || user.email?.split("@")[0]}
              </span>
            )}
          </div>

          {/* Trust cards with product images */}
          {(() => {
            const TRUST = [
              { stat: "500+", label: "Repairs Done" },
              { stat: "24h", label: "Same-Day Service" },
              { stat: "2yr", label: "Warranty Included" },
              { stat: "Free", label: "Diagnosis" },
            ];
            return (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                {TRUST.map((t, i) => (
                  <div key={t.label} className="relative rounded-3xl overflow-hidden aspect-[3/4] sm:aspect-[3/4] cursor-pointer group">
                    {loading ? (
                      <div className="w-full h-full bg-zinc-100 dark:bg-zinc-900 animate-pulse" />
                    ) : products[i]?.image ? (
                      <Image
                        src={products[i].image.replace("/object/public/", "/render/image/public/")}
                        alt={t.label}
                        fill
                        unoptimized
                        className="object-cover group-hover:scale-105 transition-transform duration-700"
                        onError={(e) => { (e.target as HTMLImageElement).src = "https://placehold.co/400x533/18181b/3f3f46?text="; }}
                      />
                    ) : (
                      <div className="w-full h-full bg-zinc-200 dark:bg-zinc-800" />
                    )}
                    {/* Dark gradient overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />
                    {/* Stat text */}
                    <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-5">
                      <p className="text-3xl sm:text-4xl font-bold text-white tracking-tight leading-none mb-1">{t.stat}</p>
                      <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-widest">{t.label}</p>
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}

          {/* Apple-style product mosaic grid */}
          {(loading || products.length > 0) && (
            <div className="grid grid-cols-3 gap-3 mb-8" style={{ height: "clamp(320px, 45vw, 520px)" }}>
              {/* Large hero product — col-span-2 */}
              <div
                className="col-span-2 relative rounded-3xl overflow-hidden cursor-pointer group bg-zinc-100 dark:bg-zinc-900"
                onClick={() => products[4] && setQuickViewProduct(products[4])}
              >
                {loading ? (
                  <div className="w-full h-full animate-pulse bg-zinc-100 dark:bg-zinc-900" />
                ) : products[4]?.image ? (
                  <Image
                    src={products[4].image.replace("/object/public/", "/render/image/public/")}
                    alt={products[4]?.name || ""}
                    fill
                    unoptimized
                    className="object-cover group-hover:scale-105 transition-transform duration-700"
                    onError={(e) => { (e.target as HTMLImageElement).src = "https://placehold.co/800x600/18181b/3f3f46?text="; }}
                  />
                ) : null}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
                {products[4] && (
                  <div className="absolute bottom-0 left-0 right-0 p-6 sm:p-8">
                    {products[4].category && (
                      <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-2">{products[4].category}</p>
                    )}
                    <p className="text-white text-xl sm:text-2xl font-bold leading-tight mb-1">{products[4].name}</p>
                    <p className="text-zinc-300 text-sm font-semibold">Rs {products[4].price.toLocaleString()}</p>
                    <span className="inline-block mt-3 text-[11px] font-semibold text-zinc-400 group-hover:text-white transition-colors">View product →</span>
                  </div>
                )}
              </div>

              {/* Two stacked small products */}
              <div className="flex flex-col gap-3">
                {[5, 6].map((idx) => (
                  <div
                    key={idx}
                    className="flex-1 relative rounded-3xl overflow-hidden cursor-pointer group bg-zinc-100 dark:bg-zinc-900"
                    onClick={() => products[idx] && setQuickViewProduct(products[idx])}
                  >
                    {loading ? (
                      <div className="w-full h-full animate-pulse bg-zinc-100 dark:bg-zinc-900" />
                    ) : products[idx]?.image ? (
                      <Image
                        src={products[idx].image.replace("/object/public/", "/render/image/public/")}
                        alt={products[idx]?.name || ""}
                        fill
                        unoptimized
                        className="object-cover group-hover:scale-105 transition-transform duration-700"
                        onError={(e) => { (e.target as HTMLImageElement).src = "https://placehold.co/400x300/18181b/3f3f46?text="; }}
                      />
                    ) : null}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
                    {products[idx] && (
                      <div className="absolute bottom-0 left-0 right-0 p-4">
                        <p className="text-white text-sm font-bold leading-tight line-clamp-1">{products[idx].name}</p>
                        <p className="text-zinc-400 text-xs">Rs {products[idx].price.toLocaleString()}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Headline + CTAs */}
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-black dark:text-white tracking-tight leading-[1.0]">
              Repair. Buy. Sell.<br />
              <span className="text-zinc-400 dark:text-zinc-600">Your way.</span>
            </h1>
            <div className="flex flex-wrap gap-3 flex-shrink-0">
              <a
                href="#services"
                className="inline-flex items-center gap-2 bg-black dark:bg-white text-white dark:text-black text-sm font-semibold px-6 py-3 rounded-full hover:bg-zinc-800 dark:hover:bg-zinc-100 transition-colors"
              >
                Explore services
              </a>
              <Link
                href="/Clients"
                className="inline-flex items-center gap-2 text-zinc-500 hover:text-black dark:hover:text-white border border-zinc-200 dark:border-zinc-800 hover:border-zinc-400 dark:hover:border-zinc-600 text-sm font-semibold px-6 py-3 rounded-full transition-all"
              >
                Shop now
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════ SERVICES ══════════════════ */}
      <section id="services" className="bg-zinc-50 dark:bg-zinc-950 py-28 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="mb-14">
            <span className={eb}>What we offer</span>
            <h2 className={h2}>Everything tech,<br />under one roof.</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {SERVICES.map((svc) => (
              <div
                key={svc.title}
                className="group p-8 lg:p-10 rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-zinc-300 dark:hover:border-zinc-700 transition-all duration-200"
              >
                <div className="w-11 h-11 rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-500 dark:text-zinc-400 group-hover:bg-black dark:group-hover:bg-white group-hover:text-white dark:group-hover:text-black mb-8 transition-all duration-300 flex-shrink-0">
                  {svc.icon}
                </div>
                <div className="flex items-center gap-2.5 mb-3">
                  <h3 className="text-base font-semibold text-black dark:text-white">{svc.title}</h3>
                  <span className="text-[9px] font-bold uppercase tracking-widest text-blue-500 border border-blue-400/30 bg-blue-500/5 px-2 py-0.5 rounded-full whitespace-nowrap">
                    {svc.tag}
                  </span>
                </div>
                <p className="text-sm text-zinc-500 leading-relaxed mb-6">{svc.desc}</p>
                <ul className="space-y-2">
                  {svc.items.map((item) => (
                    <li key={item} className="flex items-center gap-2.5 text-[13px] text-zinc-400 dark:text-zinc-500">
                      <svg className="w-3.5 h-3.5 flex-shrink-0 text-zinc-300 dark:text-zinc-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="mt-10 flex flex-wrap items-center gap-4">
            <Link
              href="/Clients"
              className="inline-flex items-center gap-2 bg-black dark:bg-white text-white dark:text-black text-sm font-semibold px-6 py-3 rounded-full hover:bg-zinc-800 dark:hover:bg-zinc-100 transition-colors"
            >
              Browse shop
            </Link>
            <button
              onClick={() => setShowContact(true)}
              className="text-sm font-medium text-zinc-500 hover:text-black dark:hover:text-white transition-colors"
            >
              Get in touch →
            </button>
          </div>
        </div>
      </section>

      {/* ══════════════════ PRODUCTS ══════════════════ */}
      {(loading || featuredProducts.length > 0) && (
        <section className="bg-white dark:bg-black py-28 px-6">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-end justify-between mb-14">
              <div>
                <span className={eb}>In stock now</span>
                <h2 className={h2}>New arrivals.</h2>
              </div>
              <Link
                href="/Clients"
                className="hidden sm:inline-flex items-center gap-1.5 text-sm font-semibold text-zinc-400 hover:text-black dark:hover:text-white transition-colors"
              >
                See all
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </Link>
            </div>

            {loading ? (
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div key={i} className="rounded-3xl overflow-hidden animate-pulse bg-zinc-50 dark:bg-zinc-900">
                    <div className="aspect-[3/4] bg-zinc-100 dark:bg-zinc-800" />
                    <div className="p-5 space-y-2.5">
                      <div className="h-2.5 w-1/4 bg-zinc-100 dark:bg-zinc-800 rounded-full" />
                      <div className="h-4 w-2/3 bg-zinc-100 dark:bg-zinc-800 rounded-full" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                {featuredProducts.map((product) => (
                  <div
                    key={product.id}
                    className="group rounded-3xl overflow-hidden cursor-pointer bg-zinc-50 dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 hover:border-zinc-200 dark:hover:border-zinc-700 transition-all duration-200"
                    onClick={() => setQuickViewProduct(product)}
                  >
                    <div className="aspect-[3/4] bg-zinc-100 dark:bg-zinc-800 relative overflow-hidden">
                      {product.image ? (
                        <Image
                          src={product.image.replace("/object/public/", "/render/image/public/")}
                          alt={product.name}
                          fill
                          unoptimized
                          className="object-cover group-hover:scale-105 transition-transform duration-700"
                          onError={(e) => { (e.target as HTMLImageElement).src = "https://placehold.co/400x533/f4f4f5/a1a1aa?text="; }}
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-zinc-400 text-sm">No Image</div>
                      )}
                      <div className="absolute bottom-3 left-3">
                        <span className="bg-black/70 backdrop-blur-sm text-white text-xs font-bold px-3 py-1.5 rounded-full">
                          Rs {product.price.toLocaleString()}
                        </span>
                      </div>
                      {product.stock === 0 && (
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                          <span className="bg-black/60 text-white text-[11px] font-semibold px-3 py-1.5 rounded-full">Out of stock</span>
                        </div>
                      )}
                      {product.stock > 0 && product.stock <= 5 && (
                        <div className="absolute top-3 right-3">
                          <span className="bg-amber-500 text-white text-[10px] font-bold px-2.5 py-1 rounded-full">Only {product.stock} left</span>
                        </div>
                      )}
                    </div>
                    <div className="p-5">
                      {product.category && (
                        <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400 mb-1.5">{product.category}</p>
                      )}
                      <h3 className="text-sm font-semibold text-black dark:text-white leading-snug">{product.name}</h3>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {products.length > 6 && (
              <div className="mt-10 text-center">
                <Link
                  href="/Clients"
                  className="inline-flex items-center gap-2 px-7 py-3.5 bg-black dark:bg-white text-white dark:text-black rounded-full font-semibold text-sm hover:bg-zinc-800 dark:hover:bg-zinc-100 transition-colors"
                >
                  View all {products.length} products →
                </Link>
              </div>
            )}
          </div>
        </section>
      )}

      {/* ══════════════════ STATS ══════════════════ */}
      {!loading && (
        <section ref={statsRef} className="bg-zinc-50 dark:bg-zinc-950 py-20 px-6">
          <div className="max-w-7xl mx-auto">
            <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-zinc-200 dark:divide-zinc-800">
              {[
                { value: animatedStats.products, suffix: "+", label: "Products" },
                { value: animatedStats.updates, suffix: "+", label: "Updates" },
                { value: animatedStats.platforms, suffix: "", label: "Platforms" },
                { value: animatedStats.members, suffix: "+", label: "Members" },
              ].map(({ value, suffix, label }) => (
                <div key={label} className="px-8 py-10 text-center first:pl-0 last:pr-0">
                  <p className="text-5xl md:text-6xl font-bold text-black dark:text-white tabular-nums tracking-tight mb-1.5">
                    {value}{suffix}
                  </p>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-400 dark:text-zinc-600">{label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ══════════════════ WHY US ══════════════════ */}
      <section className="bg-white dark:bg-black py-28 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="mb-14">
            <span className={eb}>Why choose us</span>
            <h2 className={h2}>Built on trust & quality.</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {WHY_CHOOSE_US.map((item) => (
              <div
                key={item.title}
                className="p-7 rounded-2xl border border-zinc-100 dark:border-zinc-900 hover:border-zinc-200 dark:hover:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 transition-colors"
              >
                <h3 className="text-sm font-semibold text-black dark:text-white mb-2">{item.title}</h3>
                <p className="text-sm text-zinc-500 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════ UPDATES ══════════════════ */}
      {updates.length > 0 && (
        <section className="bg-zinc-50 dark:bg-zinc-950 py-28 px-6">
          <div className="max-w-7xl mx-auto">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 mb-14">
              <div>
                <span className={eb}>Latest</span>
                <h2 className={h2}>Updates.</h2>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {updateTypes.map((type) => (
                  <button
                    key={type}
                    onClick={() => setActiveUpdateType(type)}
                    className={`px-4 py-1.5 rounded-full text-[11px] font-semibold uppercase tracking-widest transition-all ${
                      activeUpdateType === type
                        ? "bg-black dark:bg-white text-white dark:text-black"
                        : "bg-zinc-200 dark:bg-zinc-800 text-zinc-500 hover:bg-zinc-300 dark:hover:bg-zinc-700"
                    }`}
                  >
                    {type === "all" ? `All (${updates.length})` : type}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {filteredUpdates.slice(0, 4).map((update) => (
                <div
                  key={update.id}
                  className="p-7 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors"
                >
                  <div className="flex items-center gap-2 mb-4">
                    {update.priority && (
                      <span className={`text-[9px] font-bold uppercase tracking-widest px-2 py-1 rounded-full ${
                        update.priority === "high"
                          ? "bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400"
                          : update.priority === "medium"
                          ? "bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400"
                          : "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400"
                      }`}>
                        {update.priority}
                      </span>
                    )}
                    {update.type && (
                      <span className="text-[9px] font-bold uppercase tracking-widest px-2 py-1 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500">
                        {update.type}
                      </span>
                    )}
                  </div>
                  <h3 className="text-base font-semibold text-black dark:text-white mb-2 leading-snug">{update.info}</h3>
                  {update.created_at && (
                    <p className="text-[11px] text-zinc-400 mb-3">
                      {new Date(update.created_at).toLocaleDateString("en-US", { day: "numeric", month: "long", year: "numeric" })}
                    </p>
                  )}
                  <p className="text-sm text-zinc-500 leading-relaxed line-clamp-2">{update.content}</p>
                  {update.link && (
                    <a
                      href={update.link.startsWith("http") ? update.link : `https://${update.link}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 mt-4 text-[11px] font-semibold text-black dark:text-white hover:text-zinc-500 dark:hover:text-zinc-400 transition-colors"
                    >
                      Read more →
                    </a>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ══════════════════ SOCIAL ══════════════════ */}
      {socialProfiles.length > 0 && (
        <section className="bg-white dark:bg-black py-28 px-6">
          <div className="max-w-7xl mx-auto">
            <div className="mb-14">
              <span className={eb}>Follow us</span>
              <h2 className={h2}>Connect.</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {socialProfiles.map((profile) => (
                <div
                  key={profile.id}
                  className="p-6 rounded-2xl border border-zinc-100 dark:border-zinc-900 hover:border-zinc-200 dark:hover:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 transition-all"
                >
                  <div className="flex items-center gap-3 mb-4">
                    {profile.platform_icon ? (
                      <Image
                        src={profile.platform_icon}
                        alt={profile.platform_name}
                        width={40}
                        height={40}
                        unoptimized
                        className="w-10 h-10 rounded-2xl object-cover"
                        onError={(e) => { (e.target as HTMLImageElement).src = `https://placehold.co/40x40/f4f4f5/a1a1aa?text=${profile.platform_name.charAt(0)}`; }}
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-2xl bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center text-sm font-bold text-zinc-500">
                        {profile.platform_name.charAt(0)}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-black dark:text-white text-sm truncate">{profile.platform_name}</h3>
                      {profile.username && <p className="text-xs text-zinc-500 truncate">@{profile.username}</p>}
                    </div>
                    {profile.is_active && <span className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0" />}
                  </div>
                  {profile.description && (
                    <p className="text-xs text-zinc-500 mb-4 line-clamp-2">{profile.description}</p>
                  )}
                  {profile.followers && profile.followers > 0 && (
                    <p className="text-xs text-zinc-500 mb-4">
                      <span className="font-semibold text-black dark:text-white">{profile.followers.toLocaleString()}</span> followers
                    </p>
                  )}
                  <a
                    href={profile.profile_link.startsWith("http") ? profile.profile_link : `https://${profile.profile_link}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block text-center py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 text-[11px] font-semibold text-zinc-500 hover:text-black dark:hover:text-white transition-all"
                  >
                    Visit profile →
                  </a>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ══════════════════ COMMENTS ══════════════════ */}
      <section className="bg-zinc-50 dark:bg-zinc-950 py-28 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="mb-14">
            <span className={eb}>Feedback</span>
            <h2 className={h2}>What people say.</h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="p-8 rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 space-y-5">
              <p className="text-sm font-semibold text-black dark:text-white">Leave a comment</p>
              <div>
                <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-widest block mb-2">Name</label>
                <input
                  value={commentForm.name}
                  onChange={(e) => setCommentForm({ ...commentForm, name: e.target.value })}
                  placeholder="Your name"
                  className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-sm text-black dark:text-white placeholder-zinc-400 focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-500 transition-colors"
                />
              </div>
              <div>
                <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-widest block mb-2">Message</label>
                <textarea
                  value={commentForm.message}
                  onChange={(e) => setCommentForm({ ...commentForm, message: e.target.value })}
                  rows={4}
                  placeholder="Share your experience…"
                  className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-sm text-black dark:text-white placeholder-zinc-400 focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-500 transition-colors resize-none"
                />
              </div>
              <button
                onClick={handleSubmitComment}
                disabled={submittingComment}
                className="w-full py-3 bg-black dark:bg-white hover:bg-zinc-800 dark:hover:bg-zinc-100 disabled:opacity-50 text-white dark:text-black text-sm font-semibold rounded-xl transition-colors"
              >
                {submittingComment ? "Sending…" : "Submit"}
              </button>
            </div>

            <div className="space-y-3">
              {comments.length === 0 ? (
                <div className="flex items-center justify-center min-h-[200px] text-sm text-zinc-400">
                  No comments yet — be the first!
                </div>
              ) : (
                comments.map((c) => (
                  <div key={c.id} className="p-5 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-semibold text-black dark:text-white">{c.name}</span>
                      <span className="text-[10px] text-zinc-400">
                        {new Date(c.created_at).toLocaleDateString("en-US", { day: "numeric", month: "short" })}
                      </span>
                    </div>
                    <p className="text-sm text-zinc-500 leading-relaxed">{c.message}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════ ADMIN (admin-only) ══════════════════ */}
      {isAdmin && !loading && (
        <section className="bg-white dark:bg-black py-16 px-6 border-t border-zinc-100 dark:border-zinc-900">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-center gap-3 mb-8">
              <h2 className="text-lg font-bold text-black dark:text-white">Admin</h2>
              <span className="text-[9px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full bg-violet-50 dark:bg-violet-900/20 text-violet-600 dark:text-violet-400 border border-violet-100 dark:border-violet-800">
                Private
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
              {[
                { label: "Est. Inventory Value", value: `Rs ${adminStats.totalRevenue.toLocaleString()}` },
                { label: "Low Stock", value: `${adminStats.lowStockCount} products` },
                { label: "Out of Stock", value: `${adminStats.outOfStockCount} products` },
              ].map((stat) => (
                <div key={stat.label} className="p-5 rounded-2xl border border-zinc-100 dark:border-zinc-900 bg-zinc-50 dark:bg-zinc-950">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400 mb-2">{stat.label}</p>
                  <p className="text-xl font-bold text-black dark:text-white">{stat.value}</p>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              {[
                { label: "Add Product", href: "/admin/products/new" },
                { label: "Post Update", href: "/admin/updates/new" },
                { label: "Manage Users", href: "/admin/users" },
                { label: "Social Links", href: "/admin/social" },
              ].map((action) => (
                <Link
                  key={action.label}
                  href={action.href}
                  className="px-4 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:text-black dark:hover:text-white hover:border-zinc-400 dark:hover:border-zinc-600 transition-all"
                >
                  {action.label}
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ══════════════════ FOOTER CTA — always dark ══════════════════ */}
      <section className="bg-black py-32 px-6">
        <div className="max-w-7xl mx-auto">
          <p className="text-[11px] font-semibold tracking-[0.25em] uppercase text-zinc-700 mb-8">Get started today</p>
          <h2 className="text-5xl sm:text-6xl md:text-7xl font-bold text-white tracking-tight leading-[0.92] max-w-2xl mb-8">
            Your device deserves better.
          </h2>
          <p className="text-zinc-500 mb-12 text-base max-w-sm leading-relaxed">
            Walk in anytime — no appointment needed. Our team is ready.
          </p>
          <div className="flex flex-wrap gap-3">
            <a
              href="#services"
              className="inline-flex items-center gap-2 bg-white text-black text-sm font-semibold px-7 py-3.5 rounded-full hover:bg-zinc-100 transition-colors"
            >
              View services
            </a>
            <button
              onClick={() => setShowContact(true)}
              className="inline-flex items-center gap-2 text-zinc-400 hover:text-white border border-zinc-800 hover:border-zinc-600 text-sm font-semibold px-7 py-3.5 rounded-full transition-all"
            >
              Contact us
            </button>
          </div>
        </div>
      </section>

      {/* ══════════════════ QUICK VIEW MODAL ══════════════════ */}
      {quickViewProduct && (
        <div
          className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center sm:p-6 bg-black/70 backdrop-blur-md"
          onClick={() => setQuickViewProduct(null)}
        >
          <div
            className="bg-white dark:bg-zinc-900 rounded-t-3xl sm:rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col sm:flex-row relative"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setQuickViewProduct(null)}
              className="absolute top-4 right-4 z-10 w-8 h-8 flex items-center justify-center rounded-full bg-black/8 dark:bg-white/8 hover:bg-black/15 dark:hover:bg-white/15 text-black dark:text-white transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <div className="w-full sm:w-2/5 aspect-square sm:aspect-auto bg-zinc-100 dark:bg-zinc-800 relative flex-shrink-0 min-h-[240px]">
              {quickViewProduct.image ? (
                <Image
                  src={quickViewProduct.image.replace("/object/public/", "/render/image/public/")}
                  alt={quickViewProduct.name}
                  fill
                  unoptimized
                  className="object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-zinc-400 text-sm">No Image</div>
              )}
            </div>
            <div className="p-7 flex flex-col flex-1 overflow-y-auto">
              {quickViewProduct.category && (
                <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400 mb-3">{quickViewProduct.category}</p>
              )}
              <h2 className="text-xl font-bold text-black dark:text-white mb-1.5">{quickViewProduct.name}</h2>
              <p className="text-xl font-bold text-black dark:text-white mb-2">Rs {quickViewProduct.price.toLocaleString()}</p>
              <div className="mb-5">
                {quickViewProduct.stock === 0
                  ? <span className="text-xs font-semibold text-red-500">Out of stock</span>
                  : quickViewProduct.stock <= 5
                  ? <span className="text-xs font-semibold text-amber-500">Only {quickViewProduct.stock} left</span>
                  : <span className="text-xs font-semibold text-emerald-600">In stock</span>
                }
              </div>
              <p className="text-sm text-zinc-500 leading-relaxed flex-1 mb-7">
                {quickViewProduct.description || "No description available."}
              </p>
              <div className="flex gap-2.5">
                <button
                  onClick={() => handleCopyLink(quickViewProduct.id)}
                  className="flex-1 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-black dark:text-white text-sm font-semibold py-3 rounded-2xl transition-colors"
                >
                  Copy link
                </button>
                <Link
                  href="/Clients"
                  className="flex-1 bg-black dark:bg-white hover:bg-zinc-800 dark:hover:bg-zinc-100 text-white dark:text-black text-sm font-semibold py-3 rounded-2xl transition-colors text-center"
                >
                  Order in shop
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

      {showContact && <ContactModal onClose={() => setShowContact(false)} />}

      {toast && (
        <div className={`fixed bottom-6 right-6 z-[110] flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-2xl ${
          toast.type === "success"
            ? "bg-zinc-900 text-white border border-zinc-800"
            : "bg-red-950 text-red-300 border border-red-800"
        }`}>
          <span className="text-sm font-medium">{toast.message}</span>
        </div>
      )}
    </main>
  );
}
