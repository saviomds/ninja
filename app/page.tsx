"use client";

import Navbar from "@/components/Navbar";
import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import Image from "next/image";
import { User } from "@supabase/supabase-js";
import ContactModal from "@/components/ContactModal";

interface Product {
  id: string; name: string; description: string; image: string;
  price: number; stock: number; created_at?: string; category?: string;
}
interface SocialProfile {
  id: string; platform_name: string; platform_icon: string; profile_link: string;
  username: string; description?: string; followers?: number; is_active?: boolean;
}
interface AppUpdate {
  id: string; info: string; content: string; link: string;
  created_at?: string; priority?: "low" | "medium" | "high"; type?: "feature" | "fix" | "announcement";
}
interface AdminStats { totalRevenue: number; outOfStockCount: number; lowStockCount: number; }

const SERVICES = [
  {
    title: "Device Repair", tag: "Most Popular",
    desc: "Professional repair for all devices — screens, batteries, charging ports, and water damage recovery.",
    items: ["Screen Replacement", "Battery Swap", "Water Damage Fix", "Software Repair"],
    icon: <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-6.336l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437l1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008z" /></svg>,
  },
  {
    title: "Retail Shop", tag: "New Arrivals",
    desc: "Brand new smartphones, laptops, accessories, cables and peripherals at competitive prices.",
    items: ["Smartphones", "Laptops & Tablets", "Accessories", "Cables & Adapters"],
    icon: <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" /></svg>,
  },
  {
    title: "Buy & Sell", tag: "Best Value",
    desc: "Trade in your old devices for cash or upgrade credit. Fair valuations and instant payment guaranteed.",
    items: ["Device Trade-In", "Cash Offers", "Upgrade Credit", "Refurbished Deals"],
    icon: <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" /></svg>,
  },
  {
    title: "Tech Services", tag: "Pro Support",
    desc: "Full IT support — network setup, data recovery, virus removal, software installation and more.",
    items: ["Network Setup", "Data Recovery", "Virus Removal", "IT Consultation"],
    icon: <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0H3" /></svg>,
  },
];

const WHY_CHOOSE_US = [
  { icon: "⚡", title: "Fast Turnaround",       desc: "Most repairs completed same-day or within 24–48 hours." },
  { icon: "🛡️", title: "Warranty Included",     desc: "Every repair and product comes with a full warranty." },
  { icon: "🎓", title: "Certified Technicians", desc: "Years of experience handling Apple, Samsung, and more." },
  { icon: "💎", title: "Best Price Guarantee",  desc: "Transparent pricing with zero hidden fees — always." },
  { icon: "🔬", title: "Free Diagnosis",         desc: "We diagnose any device at no cost before proceeding." },
  { icon: "★",  title: "Customer First",         desc: "500+ happy customers across Mauritius trust us." },
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
  const [heroSlide, setHeroSlide] = useState(0);
  const [heroSlides, setHeroSlides] = useState<string[]>(["/images/1.jpg", "/images/2.jpg", "/images/3.jpg"]);
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
      setProducts(fetchedProducts); setSocialProfiles(socialRes.data || []); setUpdates(updatesRes.data || []);
      setUser(fetchedUser); setTotalUsers(usersRes.count || 0);
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
    fetchAllData(); fetchComments();
    const { data: authListener } = supabase.auth.onAuthStateChange((_, session) => setUser(session?.user || null));
    return () => { authListener.subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    if (loading || !statsRef.current) return;
    const targets = { products: products.length, updates: updates.length, platforms: socialProfiles.length, members: totalUsers };
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && !statsAnimated.current) {
        statsAnimated.current = true;
        const steps = 60; const interval = 1500 / steps; let step = 0;
        const timer = setInterval(() => {
          step++;
          const eased = 1 - Math.pow(1 - step / steps, 3);
          setAnimatedStats({ products: Math.round(targets.products * eased), updates: Math.round(targets.updates * eased), platforms: Math.round(targets.platforms * eased), members: Math.round(targets.members * eased) });
          if (step >= steps) clearInterval(timer);
        }, interval);
      }
    }, { threshold: 0.3 });
    observer.observe(statsRef.current);
    return () => observer.disconnect();
  }, [loading, products, updates, socialProfiles, totalUsers]);

  useEffect(() => {
    fetch("/api/hero-images").then((r) => r.json()).then((imgs: string[]) => { if (imgs.length > 0) setHeroSlides(imgs); }).catch(() => {});
  }, []);

  useEffect(() => {
    if (heroSlides.length < 2) return;
    const t = setInterval(() => setHeroSlide((s) => (s + 1) % heroSlides.length), 4500);
    return () => clearInterval(t);
  }, [heroSlides.length]);

  const fetchComments = async () => {
    const { data } = await supabase.from("comments").select("id, name, message, created_at").order("created_at", { ascending: false }).limit(6);
    setComments(data || []);
  };

  const handleSubmitComment = async () => {
    if (!commentForm.name.trim() || !commentForm.message.trim()) { showToast("Please fill in your name and message", "error"); return; }
    setSubmittingComment(true);
    const { error } = await supabase.from("comments").insert([{ name: commentForm.name.trim(), message: commentForm.message.trim() }]);
    setSubmittingComment(false);
    if (error) { showToast("Failed to send comment", "error"); return; }
    showToast("Comment sent! Thank you.");
    setCommentForm({ name: "", message: "" }); fetchComments();
  };

  const handleCopyLink = (productId: string) => {
    const url = `${window.location.origin}/product/${productId}`;
    navigator.clipboard?.writeText(url).then(() => showToast("Link copied!")).catch(() => showToast("Could not copy link", "error"));
  };

  const filteredUpdates = activeUpdateType === "all" ? updates : updates.filter((u) => (u.type || "announcement") === activeUpdateType);
  const updateTypes = ["all", ...Array.from(new Set(updates.map((u) => u.type || "announcement")))];
  const featuredProducts = products.filter((p) => p.stock > 0).slice(0, 6);

  const eb = "text-[12px] font-semibold tracking-[0.14em] text-[#6e6e73] dark:text-[#98989d] uppercase mb-4 block";
  const h2 = "text-[40px] sm:text-[52px] font-bold tracking-tight leading-[1.05] text-[#1d1d1f] dark:text-[#f5f5f7]";
  const cardOnGray = "bg-white dark:bg-[#2c2c2e] border border-[#e8e8ed] dark:border-[#3a3a3c]";
  const cardOnWhite = "bg-[#f5f5f7] dark:bg-[#1c1c1e] border border-transparent";
  const inputCls = "w-full bg-[#f5f5f7] dark:bg-[#2c2c2e] border border-[#d2d2d7] dark:border-[#3a3a3c] rounded-xl px-4 py-3 text-[14px] text-[#1d1d1f] dark:text-[#f5f5f7] placeholder-[#b0b0b5] dark:placeholder-[#48484a] focus:outline-none focus:border-[#0071e3] dark:focus:border-[#0a84ff] transition-colors";

  return (
    <main className="min-h-screen bg-white dark:bg-black text-[#1d1d1f] dark:text-[#f5f5f7] pt-16 overflow-x-hidden">
      <Navbar />

      {/* ══════════════════ HERO ══════════════════ */}
      <section className="relative overflow-hidden bg-white dark:bg-black min-h-[calc(100vh-56px)] flex items-center py-20 px-6 sm:px-10 lg:px-20">
        <div className="pointer-events-none absolute inset-0"
          style={{ background: "radial-gradient(ellipse 80% 60% at 60% 40%, rgba(0,113,227,0.06) 0%, transparent 70%)" }} />

        <div className="relative max-w-7xl mx-auto w-full">
          <div className="grid lg:grid-cols-2 gap-16 items-center">

            {/* LEFT */}
            <div className="flex flex-col gap-8">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-[#0071e3] dark:text-[#0a84ff] bg-[#e8f0fb] dark:bg-[#0a84ff]/15 rounded-full px-3 py-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#0071e3] dark:bg-[#0a84ff] animate-pulse" />
                  Open Now · Mauritius
                </span>
                {user && (
                  <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d] bg-[#f5f5f7] dark:bg-[#2c2c2e] rounded-full px-3 py-1">
                    👋 {profileUsername || user.email?.split("@")[0]}
                  </span>
                )}
              </div>

              <div>
                <h1 className="text-[48px] sm:text-[60px] lg:text-[68px] font-bold tracking-tight leading-[1.02] text-[#1d1d1f] dark:text-[#f5f5f7]">
                  Your trusted<br />
                  <span style={{ background: "linear-gradient(90deg,#0071e3,#34aadc)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
                    tech partner.
                  </span>
                </h1>
                <p className="mt-5 text-[17px] text-[#6e6e73] dark:text-[#98989d] max-w-md leading-relaxed">
                  Device repairs, retail, trade-ins &amp; IT support — all under one roof in Mauritius.
                </p>
              </div>

              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#6e6e73] dark:text-[#98989d] mb-3">Quick access</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { icon: "🔧", label: "Repair",      sub: "Same-day",  href: "#services" },
                    { icon: "🛒", label: "Buy",         sub: "New & used", href: "/Clients"  },
                    { icon: "💰", label: "Sell / Trade",sub: "Best rates", href: "#services" },
                    { icon: "💻", label: "IT Support",  sub: "Pro help",  href: "#services" },
                  ].map((s) => (
                    <a key={s.label} href={s.href}
                      className="group flex flex-col gap-1 p-3.5 rounded-2xl bg-[#f5f5f7] dark:bg-[#1c1c1e] hover:bg-white dark:hover:bg-[#2c2c2e] border border-transparent hover:border-[#d2d2d7] dark:hover:border-[#3a3a3c] hover:shadow-sm transition-all duration-200">
                      <span className="text-xl">{s.icon}</span>
                      <span className="text-[12px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] mt-0.5">{s.label}</span>
                      <span className="text-[11px] text-[#6e6e73] dark:text-[#98989d] group-hover:text-[#0071e3] dark:group-hover:text-[#0a84ff] transition-colors">{s.sub}</span>
                    </a>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                <button onClick={() => setShowContact(true)}
                  className="inline-flex items-center gap-2 bg-[#0071e3] dark:bg-[#0a84ff] hover:bg-[#0077ed] dark:hover:bg-[#409cff] text-white text-[15px] font-semibold px-6 py-3 rounded-full transition-colors shadow-sm">
                  Book a Repair
                </button>
                <Link href="/Clients"
                  className="inline-flex items-center gap-2 text-[#0071e3] dark:text-[#0a84ff] text-[15px] font-semibold px-6 py-3 rounded-full border border-[#0071e3]/30 dark:border-[#0a84ff]/30 hover:border-[#0071e3]/60 dark:hover:border-[#0a84ff]/60 hover:bg-[#e8f0fb]/50 dark:hover:bg-[#0a84ff]/10 transition-all">
                  Browse Shop
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
                </Link>
              </div>

              <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 pt-1">
                {["✓ Same-day repairs", "✓ 2yr warranty", "✓ Free diagnosis", "✓ 500+ happy clients"].map((b) => (
                  <span key={b} className="text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d]">{b}</span>
                ))}
              </div>
            </div>

            {/* RIGHT */}
            <div className="relative flex items-center justify-center lg:justify-end min-h-[360px] lg:min-h-[520px]">
              <div className="absolute inset-4 rounded-3xl pointer-events-none"
                style={{ background: "radial-gradient(circle, rgba(0,113,227,0.12) 0%, transparent 70%)", filter: "blur(30px)" }} />

              {[
                { pos: "absolute left-2 top-10", delay: "0s",   dur: "3.5s", icon: "⚡", title: "24h Repair",    sub: "Guaranteed"       },
                { pos: "absolute right-2 bottom-16", delay: "1s", dur: "4s", icon: "🏆", title: "Top Rated",    sub: "★ 4.9 · 500+ clients" },
              ].map((b) => (
                <div key={b.title} className={`${b.pos} z-20 flex items-center gap-2.5 bg-white/90 dark:bg-[#2c2c2e]/90 backdrop-blur-xl rounded-2xl px-3.5 py-2.5 shadow-[0_2px_20px_rgba(0,0,0,0.08)] dark:shadow-[0_2px_20px_rgba(0,0,0,0.4)]`}
                  style={{ animation: `tn-badge ${b.dur} ease-in-out infinite`, animationDelay: b.delay }}>
                  <span className="text-xl">{b.icon}</span>
                  <div>
                    <p className="text-[12px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] leading-tight">{b.title}</p>
                    <p className="text-[10px] text-[#6e6e73] dark:text-[#98989d]">{b.sub}</p>
                  </div>
                </div>
              ))}
              <div className="absolute right-0 top-4 z-20 flex items-center gap-2 bg-white/90 dark:bg-[#2c2c2e]/90 backdrop-blur-xl rounded-xl px-3 py-2 shadow-[0_2px_14px_rgba(0,0,0,0.07)] dark:shadow-[0_2px_14px_rgba(0,0,0,0.4)]"
                style={{ animation: "tn-badge 5s ease-in-out infinite", animationDelay: "0.5s" }}>
                <span className="text-base">🛡️</span>
                <p className="text-[11px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">2yr Warranty</p>
              </div>
              <div className="absolute left-0 bottom-8 z-20 flex items-center gap-2 bg-white/90 dark:bg-[#2c2c2e]/90 backdrop-blur-xl rounded-xl px-3 py-2 shadow-[0_2px_14px_rgba(0,0,0,0.07)] dark:shadow-[0_2px_14px_rgba(0,0,0,0.4)]"
                style={{ animation: "tn-badge 4.5s ease-in-out infinite", animationDelay: "1.5s" }}>
                <span className="text-base">🔬</span>
                <p className="text-[11px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">Free Diagnosis</p>
              </div>

              <div className="relative z-10 w-[280px] sm:w-[360px] lg:w-[460px]" style={{ animation: "tn-float 6s ease-in-out infinite" }}>
                <div className="relative rounded-3xl overflow-hidden bg-[#f5f5f7] dark:bg-[#1c1c1e] shadow-[0_8px_40px_rgba(0,0,0,0.12)] dark:shadow-[0_8px_40px_rgba(0,0,0,0.5)]" style={{ aspectRatio: "4/3" }}>
                  {heroSlides.map((src, i) => (
                    <Image key={src} src={src} alt={`Tech Ninja ${i + 1}`} fill unoptimized priority={i === 0}
                      className="object-contain p-4"
                      style={{ opacity: heroSlide === i ? 1 : 0, transition: "opacity 0.9s ease-in-out" }} />
                  ))}
                </div>
                <div className="flex items-center justify-center gap-2 mt-4">
                  {heroSlides.map((_, i) => (
                    <button key={i} onClick={() => setHeroSlide(i)} className="transition-all duration-300 rounded-full focus:outline-none"
                      style={{ width: heroSlide === i ? "20px" : "7px", height: "7px", background: heroSlide === i ? "#0071e3" : "#d2d2d7" }} />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════ SERVICES ══════════════════ */}
      <section id="services" className="bg-[#f5f5f7] dark:bg-[#1c1c1e] py-28 px-6 sm:px-10 lg:px-20">
        <div className="max-w-7xl mx-auto">
          <div className="mb-16">
            <span className={eb}>What we offer</span>
            <h2 className={h2}>Everything tech,<br />under one roof.</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {SERVICES.map((svc) => (
              <div key={svc.title}
                className={`group p-9 rounded-3xl ${cardOnGray} hover:shadow-[0_4px_24px_rgba(0,0,0,0.07)] dark:hover:shadow-[0_4px_24px_rgba(0,0,0,0.4)] transition-all duration-300`}>
                <div className="w-12 h-12 rounded-2xl bg-[#f5f5f7] dark:bg-[#3a3a3c] flex items-center justify-center text-[#1d1d1f] dark:text-[#f5f5f7] group-hover:bg-[#0071e3] dark:group-hover:bg-[#0a84ff] group-hover:text-white mb-8 transition-all duration-300">
                  {svc.icon}
                </div>
                <div className="flex items-center gap-2.5 mb-3">
                  <h3 className="text-[17px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">{svc.title}</h3>
                  <span className="text-[10px] font-semibold tracking-wider uppercase text-[#0071e3] dark:text-[#0a84ff] bg-[#e8f0fb] dark:bg-[#0a84ff]/15 px-2.5 py-0.5 rounded-full">{svc.tag}</span>
                </div>
                <p className="text-[15px] text-[#6e6e73] dark:text-[#98989d] leading-relaxed mb-6">{svc.desc}</p>
                <ul className="space-y-2.5">
                  {svc.items.map((item) => (
                    <li key={item} className="flex items-center gap-2.5 text-[14px] text-[#6e6e73] dark:text-[#98989d]">
                      <svg className="w-4 h-4 flex-shrink-0 text-[#0071e3] dark:text-[#0a84ff]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="mt-12 flex flex-wrap items-center gap-4">
            <Link href="/Clients" className="inline-flex items-center gap-2 bg-[#0071e3] dark:bg-[#0a84ff] hover:bg-[#0077ed] text-white text-[15px] font-semibold px-6 py-3 rounded-full transition-colors shadow-sm">
              Browse shop
            </Link>
            <button onClick={() => setShowContact(true)} className="text-[15px] font-medium text-[#0071e3] dark:text-[#0a84ff] hover:text-[#0077ed] transition-colors">
              Get in touch →
            </button>
          </div>
        </div>
      </section>

      {/* ══════════════════ PRODUCTS ══════════════════ */}
      {(loading || featuredProducts.length > 0) && (
        <section className="bg-white dark:bg-black py-28 px-6 sm:px-10 lg:px-20">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-end justify-between mb-16">
              <div>
                <span className={eb}>In stock now</span>
                <h2 className={h2}>New arrivals.</h2>
              </div>
              <Link href="/Clients" className="hidden sm:inline-flex items-center gap-1.5 text-[15px] font-medium text-[#0071e3] dark:text-[#0a84ff] hover:text-[#0077ed] transition-colors">
                See all
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
              </Link>
            </div>
            {loading ? (
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                {[1,2,3,4,5,6].map((i) => (
                  <div key={i} className="rounded-3xl overflow-hidden animate-pulse bg-[#f5f5f7] dark:bg-[#1c1c1e]">
                    <div className="aspect-[3/4] bg-[#e8e8ed] dark:bg-[#2c2c2e]" />
                    <div className="p-5 space-y-2.5">
                      <div className="h-2.5 w-1/4 bg-[#e8e8ed] dark:bg-[#2c2c2e] rounded-full" />
                      <div className="h-4 w-2/3 bg-[#e8e8ed] dark:bg-[#2c2c2e] rounded-full" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                {featuredProducts.map((product) => (
                  <div key={product.id}
                    className={`group rounded-3xl overflow-hidden cursor-pointer ${cardOnWhite} hover:border-[#d2d2d7] dark:hover:border-[#3a3a3c] hover:shadow-[0_4px_20px_rgba(0,0,0,0.07)] dark:hover:shadow-[0_4px_20px_rgba(0,0,0,0.4)] transition-all duration-300`}
                    onClick={() => setQuickViewProduct(product)}>
                    <div className="aspect-[3/4] bg-[#e8e8ed] dark:bg-[#2c2c2e] relative overflow-hidden">
                      {product.image ? (
                        <Image src={product.image.replace("/object/public/", "/render/image/public/")} alt={product.name}
                          fill unoptimized className="object-cover group-hover:scale-[1.03] transition-transform duration-500"
                          onError={(e) => { (e.target as HTMLImageElement).src = "https://placehold.co/400x533/f5f5f7/86868b?text="; }} />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-[#6e6e73] text-sm">No Image</div>
                      )}
                      <div className="absolute bottom-3 left-3">
                        <span className="text-[12px] font-semibold text-white bg-black/55 backdrop-blur-sm px-3 py-1.5 rounded-full">
                          Rs {product.price.toLocaleString()}
                        </span>
                      </div>
                      {product.stock === 0 && (
                        <div className="absolute inset-0 bg-white/50 dark:bg-black/50 backdrop-blur-sm flex items-center justify-center">
                          <span className="text-[12px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] bg-white dark:bg-[#2c2c2e] px-3 py-1.5 rounded-full shadow-sm">Out of stock</span>
                        </div>
                      )}
                      {product.stock > 0 && product.stock <= 5 && (
                        <div className="absolute top-3 right-3">
                          <span className="text-[11px] font-semibold text-white bg-[#ff9500] px-2.5 py-1 rounded-full">Only {product.stock} left</span>
                        </div>
                      )}
                    </div>
                    <div className="p-5">
                      {product.category && <p className="text-[11px] font-semibold uppercase tracking-wider text-[#6e6e73] dark:text-[#98989d] mb-1.5">{product.category}</p>}
                      <h3 className="text-[14px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] leading-snug">{product.name}</h3>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {products.length > 6 && (
              <div className="mt-12 text-center">
                <Link href="/Clients" className="inline-flex items-center gap-2 px-7 py-3.5 bg-[#0071e3] dark:bg-[#0a84ff] hover:bg-[#0077ed] text-white rounded-full font-semibold text-[15px] transition-colors shadow-sm">
                  View all {products.length} products →
                </Link>
              </div>
            )}
          </div>
        </section>
      )}

      {/* ══════════════════ STATS ══════════════════ */}
      {!loading && (
        <section ref={statsRef} className="bg-[#f5f5f7] dark:bg-[#1c1c1e] py-20 px-6 sm:px-10 lg:px-20">
          <div className="max-w-7xl mx-auto">
            <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-[#d2d2d7] dark:divide-[#3a3a3c]">
              {[
                { value: animatedStats.products, suffix: "+", label: "Products"  },
                { value: animatedStats.updates,  suffix: "+", label: "Updates"   },
                { value: animatedStats.platforms,suffix: "",  label: "Platforms" },
                { value: animatedStats.members,  suffix: "+", label: "Members"   },
              ].map(({ value, suffix, label }) => (
                <div key={label} className="px-8 py-10 text-center first:pl-0 last:pr-0">
                  <p className="text-[52px] md:text-[60px] font-bold text-[#1d1d1f] dark:text-[#f5f5f7] tabular-nums tracking-tight mb-1">{value}{suffix}</p>
                  <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#6e6e73] dark:text-[#98989d]">{label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ══════════════════ WHY CHOOSE US ══════════════════ */}
      <section className="bg-white dark:bg-black py-28 px-6 sm:px-10 lg:px-20">
        <div className="max-w-7xl mx-auto">
          <div className="mb-16">
            <span className={eb}>Why choose us</span>
            <h2 className={h2}>Built on trust<br />&amp; quality.</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {WHY_CHOOSE_US.map((item) => (
              <div key={item.title}
                className={`group p-7 rounded-3xl ${cardOnWhite} hover:border-[#d2d2d7] dark:hover:border-[#3a3a3c] hover:bg-white dark:hover:bg-[#2c2c2e] hover:shadow-[0_4px_20px_rgba(0,0,0,0.06)] dark:hover:shadow-[0_4px_20px_rgba(0,0,0,0.4)] transition-all duration-300`}>
                <span className="text-2xl block mb-4">{item.icon}</span>
                <h3 className="text-[15px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] mb-2">{item.title}</h3>
                <p className="text-[14px] text-[#6e6e73] dark:text-[#98989d] leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════ UPDATES ══════════════════ */}
      {updates.length > 0 && (
        <section className="bg-[#f5f5f7] dark:bg-[#1c1c1e] py-28 px-6 sm:px-10 lg:px-20">
          <div className="max-w-7xl mx-auto">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 mb-16">
              <div>
                <span className={eb}>Latest</span>
                <h2 className={h2}>Updates.</h2>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {updateTypes.map((type) => (
                  <button key={type} onClick={() => setActiveUpdateType(type)}
                    className={`px-4 py-1.5 rounded-full text-[12px] font-semibold tracking-wide transition-all ${
                      activeUpdateType === type
                        ? "bg-[#0071e3] dark:bg-[#0a84ff] text-white"
                        : "bg-white dark:bg-[#2c2c2e] text-[#6e6e73] dark:text-[#98989d] border border-[#d2d2d7] dark:border-[#3a3a3c] hover:border-[#b0b0b5] dark:hover:border-[#48484a]"
                    }`}>
                    {type === "all" ? `All (${updates.length})` : type}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredUpdates.slice(0, 4).map((update) => (
                <div key={update.id}
                  className={`p-8 rounded-3xl ${cardOnGray} hover:shadow-[0_4px_20px_rgba(0,0,0,0.06)] dark:hover:shadow-[0_4px_20px_rgba(0,0,0,0.4)] transition-all duration-300`}>
                  <div className="flex items-center gap-2 mb-4">
                    {update.priority && (
                      <span className={`text-[10px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full ${
                        update.priority === "high"   ? "bg-red-50 dark:bg-red-900/20 text-red-500 dark:text-red-400"
                        : update.priority === "medium" ? "bg-orange-50 dark:bg-orange-900/20 text-orange-500 dark:text-orange-400"
                        : "bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400"
                      }`}>{update.priority}</span>
                    )}
                    {update.type && (
                      <span className="text-[10px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full bg-[#f5f5f7] dark:bg-[#3a3a3c] text-[#6e6e73] dark:text-[#98989d]">
                        {update.type}
                      </span>
                    )}
                  </div>
                  <h3 className="text-[17px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] mb-2 leading-snug">{update.info}</h3>
                  {update.created_at && (
                    <p className="text-[12px] text-[#6e6e73] dark:text-[#98989d] mb-3">
                      {new Date(update.created_at).toLocaleDateString("en-US", { day: "numeric", month: "long", year: "numeric" })}
                    </p>
                  )}
                  <p className="text-[14px] text-[#6e6e73] dark:text-[#98989d] leading-relaxed line-clamp-2">{update.content}</p>
                  {update.link && (
                    <a href={update.link.startsWith("http") ? update.link : `https://${update.link}`} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 mt-4 text-[13px] font-semibold text-[#0071e3] dark:text-[#0a84ff] hover:text-[#0077ed] transition-colors">
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
        <section className="bg-white dark:bg-black py-28 px-6 sm:px-10 lg:px-20">
          <div className="max-w-7xl mx-auto">
            <div className="mb-16">
              <span className={eb}>Follow us</span>
              <h2 className={h2}>Connect.</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {socialProfiles.map((profile) => (
                <div key={profile.id}
                  className={`group p-6 rounded-3xl ${cardOnWhite} hover:border-[#d2d2d7] dark:hover:border-[#3a3a3c] hover:bg-white dark:hover:bg-[#2c2c2e] hover:shadow-[0_4px_20px_rgba(0,0,0,0.06)] dark:hover:shadow-[0_4px_20px_rgba(0,0,0,0.4)] transition-all duration-300`}>
                  <div className="flex items-center gap-3 mb-4">
                    {profile.platform_icon ? (
                      <Image src={profile.platform_icon} alt={profile.platform_name} width={44} height={44} unoptimized className="w-11 h-11 rounded-2xl object-cover"
                        onError={(e) => { (e.target as HTMLImageElement).src = `https://placehold.co/44x44/f5f5f7/86868b?text=${profile.platform_name.charAt(0)}`; }} />
                    ) : (
                      <div className="w-11 h-11 rounded-2xl bg-[#e8e8ed] dark:bg-[#3a3a3c] flex items-center justify-center text-sm font-bold text-[#6e6e73] dark:text-[#98989d]">
                        {profile.platform_name.charAt(0)}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] text-[14px] truncate">{profile.platform_name}</h3>
                      {profile.username && <p className="text-[12px] text-[#6e6e73] dark:text-[#98989d] truncate">@{profile.username}</p>}
                    </div>
                    {profile.is_active && <span className="w-2 h-2 rounded-full bg-[#34c759] flex-shrink-0" />}
                  </div>
                  {profile.description && <p className="text-[13px] text-[#6e6e73] dark:text-[#98989d] mb-4 line-clamp-2">{profile.description}</p>}
                  {profile.followers && profile.followers > 0 && (
                    <p className="text-[13px] text-[#6e6e73] dark:text-[#98989d] mb-4">
                      <span className="font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">{profile.followers.toLocaleString()}</span> followers
                    </p>
                  )}
                  <a href={profile.profile_link.startsWith("http") ? profile.profile_link : `https://${profile.profile_link}`} target="_blank" rel="noopener noreferrer"
                    className="block text-center py-2.5 rounded-2xl border border-[#d2d2d7] dark:border-[#3a3a3c] bg-white dark:bg-[#2c2c2e] hover:bg-[#0071e3] dark:hover:bg-[#0a84ff] hover:border-[#0071e3] dark:hover:border-[#0a84ff] hover:text-white text-[12px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] transition-all duration-200">
                    Visit profile →
                  </a>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ══════════════════ COMMENTS ══════════════════ */}
      <section className="bg-[#f5f5f7] dark:bg-[#1c1c1e] py-28 px-6 sm:px-10 lg:px-20">
        <div className="max-w-7xl mx-auto">
          <div className="mb-16">
            <span className={eb}>Feedback</span>
            <h2 className={h2}>What people say.</h2>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className={`p-8 rounded-3xl ${cardOnGray} shadow-[0_2px_16px_rgba(0,0,0,0.04)] dark:shadow-[0_2px_16px_rgba(0,0,0,0.3)] space-y-5`}>
              <p className="text-[17px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">Leave a comment</p>
              <div>
                <label className="text-[11px] font-semibold text-[#6e6e73] dark:text-[#98989d] uppercase tracking-wider block mb-2">Name</label>
                <input value={commentForm.name} onChange={(e) => setCommentForm({ ...commentForm, name: e.target.value })} placeholder="Your name" className={inputCls} />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-[#6e6e73] dark:text-[#98989d] uppercase tracking-wider block mb-2">Message</label>
                <textarea value={commentForm.message} onChange={(e) => setCommentForm({ ...commentForm, message: e.target.value })} rows={4} placeholder="Share your experience…" className={inputCls + " resize-none"} />
              </div>
              <button onClick={handleSubmitComment} disabled={submittingComment}
                className="w-full py-3 bg-[#0071e3] dark:bg-[#0a84ff] hover:bg-[#0077ed] disabled:opacity-50 text-white text-[15px] font-semibold rounded-xl transition-colors">
                {submittingComment ? "Sending…" : "Submit"}
              </button>
            </div>
            <div className="space-y-3">
              {comments.length === 0 ? (
                <div className="flex items-center justify-center min-h-[200px] text-[14px] text-[#6e6e73] dark:text-[#98989d]">
                  No comments yet — be the first!
                </div>
              ) : (
                comments.map((c) => (
                  <div key={c.id} className={`p-5 rounded-2xl ${cardOnGray}`}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[14px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">{c.name}</span>
                      <span className="text-[11px] text-[#b0b0b5] dark:text-[#48484a]">
                        {new Date(c.created_at).toLocaleDateString("en-US", { day: "numeric", month: "short" })}
                      </span>
                    </div>
                    <p className="text-[14px] text-[#6e6e73] dark:text-[#98989d] leading-relaxed">{c.message}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════ ADMIN ══════════════════ */}
      {isAdmin && !loading && (
        <section className="bg-white dark:bg-black py-16 px-6 sm:px-10 lg:px-20 border-t border-[#e8e8ed] dark:border-[#3a3a3c]">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-center gap-3 mb-8">
              <h2 className="text-[17px] font-bold text-[#1d1d1f] dark:text-[#f5f5f7]">Admin</h2>
              <span className="text-[10px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full bg-[#f0e8fb] dark:bg-[#6e40c9]/20 text-[#6e40c9] dark:text-[#bf5af2]">Private</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
              {[
                { label: "Est. Inventory Value", value: `Rs ${adminStats.totalRevenue.toLocaleString()}` },
                { label: "Low Stock",            value: `${adminStats.lowStockCount} products`           },
                { label: "Out of Stock",         value: `${adminStats.outOfStockCount} products`          },
              ].map((stat) => (
                <div key={stat.label} className={`p-5 rounded-2xl ${cardOnWhite}`}>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-[#6e6e73] dark:text-[#98989d] mb-2">{stat.label}</p>
                  <p className="text-[20px] font-bold text-[#1d1d1f] dark:text-[#f5f5f7]">{stat.value}</p>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              {[
                { label: "Add Product",  href: "/admin/products/new" },
                { label: "Post Update",  href: "/admin/updates/new"  },
                { label: "Manage Users", href: "/admin/users"        },
                { label: "Social Links", href: "/admin/social"       },
              ].map((action) => (
                <Link key={action.label} href={action.href}
                  className="px-4 py-2 rounded-xl border border-[#d2d2d7] dark:border-[#3a3a3c] text-[13px] font-medium text-[#6e6e73] dark:text-[#98989d] hover:text-[#1d1d1f] dark:hover:text-[#f5f5f7] hover:border-[#b0b0b5] dark:hover:border-[#48484a] transition-all">
                  {action.label}
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ══════════════════ FOOTER CTA ══════════════════ */}
      <section className="bg-[#1d1d1f] dark:bg-[#000000] py-32 px-6 sm:px-10 lg:px-20">
        <div className="max-w-7xl mx-auto">
          <p className="text-[12px] font-semibold tracking-[0.2em] uppercase text-[#6e6e73] mb-8">Get started today</p>
          <h2 className="text-[56px] sm:text-[68px] md:text-[80px] font-bold text-white tracking-tight leading-[0.94] max-w-2xl mb-8">
            Your device<br />deserves better.
          </h2>
          <p className="text-[17px] text-[#6e6e73] mb-12 max-w-sm leading-relaxed">
            Walk in anytime — no appointment needed. Our team is ready.
          </p>
          <div className="flex flex-wrap gap-3">
            <a href="#services" className="inline-flex items-center gap-2 bg-white text-[#1d1d1f] text-[15px] font-semibold px-7 py-3.5 rounded-full hover:bg-[#f5f5f7] transition-colors">
              View services
            </a>
            <button onClick={() => setShowContact(true)}
              className="inline-flex items-center gap-2 text-[#6e6e73] hover:text-white border border-[#424245] hover:border-[#6e6e73] text-[15px] font-semibold px-7 py-3.5 rounded-full transition-all">
              Contact us
            </button>
          </div>
        </div>
      </section>

      {/* ══════════════════ QUICK VIEW MODAL ══════════════════ */}
      {quickViewProduct && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center sm:p-6 bg-black/40 dark:bg-black/70 backdrop-blur-md"
          onClick={() => setQuickViewProduct(null)}>
          <div className="bg-white dark:bg-[#2c2c2e] rounded-t-3xl sm:rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col sm:flex-row relative"
            onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setQuickViewProduct(null)}
              className="absolute top-4 right-4 z-10 w-8 h-8 flex items-center justify-center rounded-full bg-[#f5f5f7] dark:bg-[#3a3a3c] hover:bg-[#e8e8ed] dark:hover:bg-[#48484a] text-[#1d1d1f] dark:text-[#f5f5f7] transition-colors">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
            <div className="w-full sm:w-2/5 aspect-square sm:aspect-auto bg-[#f5f5f7] dark:bg-[#1c1c1e] relative flex-shrink-0 min-h-[240px]">
              {quickViewProduct.image ? (
                <Image src={quickViewProduct.image.replace("/object/public/", "/render/image/public/")} alt={quickViewProduct.name} fill unoptimized className="object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-[#6e6e73] text-sm">No Image</div>
              )}
            </div>
            <div className="p-7 flex flex-col flex-1 overflow-y-auto">
              {quickViewProduct.category && <p className="text-[11px] font-semibold uppercase tracking-wider text-[#6e6e73] dark:text-[#98989d] mb-3">{quickViewProduct.category}</p>}
              <h2 className="text-[22px] font-bold text-[#1d1d1f] dark:text-[#f5f5f7] mb-1.5">{quickViewProduct.name}</h2>
              <p className="text-[22px] font-bold text-[#1d1d1f] dark:text-[#f5f5f7] mb-2">Rs {quickViewProduct.price.toLocaleString()}</p>
              <div className="mb-5">
                {quickViewProduct.stock === 0 ? <span className="text-[13px] font-semibold text-red-500">Out of stock</span>
                  : quickViewProduct.stock <= 5 ? <span className="text-[13px] font-semibold text-[#ff9500]">Only {quickViewProduct.stock} left</span>
                  : <span className="text-[13px] font-semibold text-[#34c759]">In stock</span>
                }
              </div>
              <p className="text-[14px] text-[#6e6e73] dark:text-[#98989d] leading-relaxed flex-1 mb-7">
                {quickViewProduct.description || "No description available."}
              </p>
              <div className="flex gap-2.5">
                <button onClick={() => handleCopyLink(quickViewProduct.id)}
                  className="flex-1 bg-[#f5f5f7] dark:bg-[#3a3a3c] hover:bg-[#e8e8ed] dark:hover:bg-[#48484a] text-[#1d1d1f] dark:text-[#f5f5f7] text-[14px] font-semibold py-3 rounded-2xl transition-colors">
                  Copy link
                </button>
                <Link href="/Clients" className="flex-1 bg-[#0071e3] dark:bg-[#0a84ff] hover:bg-[#0077ed] text-white text-[14px] font-semibold py-3 rounded-2xl transition-colors text-center">
                  Order in shop
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

      {showContact && <ContactModal onClose={() => setShowContact(false)} />}

      {toast && (
        <div className={`fixed bottom-6 right-6 z-[110] flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-lg ${
          toast.type === "success" ? "bg-[#1d1d1f] dark:bg-[#2c2c2e] text-white" : "bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800"
        }`}>
          <span className="text-[14px] font-medium">{toast.message}</span>
        </div>
      )}
    </main>
  );
}
