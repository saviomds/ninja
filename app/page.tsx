"use client";

import Navbar from "@/components/Navbar";
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
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

/* ── Static data ── */
const SERVICES = [
  {
    title: "Device Repair",    tag: "Most Popular",
    desc: "Professional repair for all devices — screens, batteries, charging ports, and water damage recovery.",
    items: ["Screen Replacement", "Battery Swap", "Water Damage Fix", "Software Repair"],
    color: "bg-blue-50 dark:bg-blue-900/10",
    iconBg: "bg-blue-100 dark:bg-blue-900/30", iconColor: "text-[#2563EB]",
    tagColor: "bg-[#2563EB]/10 text-[#2563EB]",
    icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-6.336l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437l1.745-1.437" /></svg>,
  },
  {
    title: "Retail Shop",      tag: "New Arrivals",
    desc: "Brand new smartphones, laptops, accessories, cables and peripherals at competitive prices.",
    items: ["Smartphones", "Laptops & Tablets", "Accessories", "Cables & Adapters"],
    color: "bg-emerald-50 dark:bg-emerald-900/10",
    iconBg: "bg-emerald-100 dark:bg-emerald-900/30", iconColor: "text-emerald-600",
    tagColor: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
    icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" /></svg>,
  },
  {
    title: "Buy & Sell",       tag: "Best Value",
    desc: "Trade in your old devices for cash or upgrade credit. Fair valuations and instant payment.",
    items: ["Device Trade-In", "Cash Offers", "Upgrade Credit", "Refurbished Deals"],
    color: "bg-amber-50 dark:bg-amber-900/10",
    iconBg: "bg-amber-100 dark:bg-amber-900/30", iconColor: "text-amber-600",
    tagColor: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
    icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" /></svg>,
  },
  {
    title: "IT Support",       tag: "Pro Help",
    desc: "Full IT support — network setup, data recovery, virus removal, and expert IT consultation.",
    items: ["Network Setup", "Data Recovery", "Virus Removal", "IT Consultation"],
    color: "bg-purple-50 dark:bg-purple-900/10",
    iconBg: "bg-purple-100 dark:bg-purple-900/30", iconColor: "text-purple-600",
    tagColor: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
    icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0H3" /></svg>,
  },
];

const WHY_US = [
  { icon: "⚡", title: "Fast Turnaround",      desc: "Most repairs completed same-day or within 24–48 hours." },
  { icon: "🛡️", title: "Warranty Included",   desc: "Every repair and product comes with a full warranty." },
  { icon: "🎓", title: "Certified Techs",      desc: "Years of experience handling Apple, Samsung, and more." },
  { icon: "💎", title: "Best Price Guarantee", desc: "Transparent pricing with zero hidden fees — always." },
  { icon: "🔬", title: "Free Diagnosis",        desc: "We diagnose any device at no cost before proceeding." },
  { icon: "★",  title: "500+ Happy Clients",   desc: "Trusted by hundreds of customers across Mauritius." },
];

const TRUST_ITEMS = [
  { icon: <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z"/></svg>, label: "Curated Smart Tech",  sub: "Only the best gadgets, hand-picked for quality." },
  { icon: <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M21 7.5l-9-5.25L3 7.5m18 0l-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9"/></svg>,  label: "Fast Shipping",        sub: "Express delivery to your doorstep in 24–48h." },
  { icon: <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z"/></svg>, label: "Online Support",       sub: "Live chat support available 7 days a week." },
  { icon: <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"/></svg>, label: "Secure Checkout",    sub: "SSL-encrypted payments you can trust." },
];

const MARQUEE_ITEMS = [
  "⚡ Same-Day Repairs", "🛡️ 2yr Warranty", "💎 Best Price Guarantee",
  "🔬 Free Diagnosis", "🚀 Premium Products", "🌟 500+ Happy Clients",
  "🔒 Secure & Trusted", "📱 All Brands Supported",
];

/* ── Star rating helper ── */
function Stars({ n = 5 }: { n?: number }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <svg key={i} className={`w-3 h-3 ${i < n ? "text-amber-400" : "text-gray-200 dark:text-gray-700"}`} viewBox="0 0 20 20" fill="currentColor">
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </div>
  );
}

export default function Home() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [socialProfiles, setSocialProfiles] = useState<SocialProfile[]>([]);
  const [updates, setUpdates] = useState<AppUpdate[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [adminStats, setAdminStats] = useState<AdminStats>({ totalRevenue: 0, outOfStockCount: 0, lowStockCount: 0 });
  const [activeUpdateType, setActiveUpdateType] = useState<string>("all");
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [showContact, setShowContact] = useState(false);
  const [heroSlide, setHeroSlide] = useState(0);
  const [heroSlides, setHeroSlides] = useState<string[]>(["/images/1.jpg", "/images/2.jpg", "/images/3.jpg"]);
  const [profileUsername, setProfileUsername] = useState<string | null>(null);
  const [comments, setComments] = useState<{ id: string; name: string; message: string; created_at: string; rating?: number }[]>([]);
  const [commentForm, setCommentForm] = useState({ name: "", message: "", category: "product", rating: 5 });
  const [submittingComment, setSubmittingComment] = useState(false);
  const [activeFilter, setActiveFilter] = useState<"all" | "latest" | "bestseller" | "featured">("all");
  const [newsletterEmail, setNewsletterEmail] = useState("");
  const [newsletterLoading, setNewsletterLoading] = useState(false);
  const [subscriberCount, setSubscriberCount] = useState<number | null>(null);
  const [displayCount, setDisplayCount] = useState(0);
  const [wishlist, setWishlist] = useState<Set<string>>(new Set());

  const showToast = (message: string, type: "success" | "error" = "success") => {
    setToast({ message, type }); setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    const fetchAllData = async () => {
      const [productsRes, socialRes, updatesRes, authRes] = await Promise.all([
        supabase.from("products").select("*").eq("is_public", true).order("created_at", { ascending: false }),
        supabase.from("social_profiles").select("id, platform_name, platform_icon, profile_link, username, description, followers, is_active").order("created_at", { ascending: false }),
        supabase.from("updates").select("*").order("created_at", { ascending: false }),
        supabase.auth.getUser(),
      ]);
      const fetchedProducts: Product[] = productsRes.data || [];
      const fetchedUser = authRes.data?.user || null;
      setProducts(fetchedProducts); setSocialProfiles(socialRes.data || []); setUpdates(updatesRes.data || []);
      setUser(fetchedUser);
      if (fetchedUser) {
        const role = fetchedUser.user_metadata?.role || fetchedUser.app_metadata?.role;
        setIsAdmin(role === "admin");
        const { data: prof } = await supabase.from("profiles").select("username").eq("id", fetchedUser.id).single();
        setProfileUsername(prof?.username || null);
      }
      const outOfStock = fetchedProducts.filter((p) => p.stock === 0).length;
      const lowStock = fetchedProducts.filter((p) => p.stock > 0 && p.stock <= 5).length;
      setAdminStats({ totalRevenue: fetchedProducts.reduce((acc, p) => acc + p.price * (p.stock || 0), 0), outOfStockCount: outOfStock, lowStockCount: lowStock });
      setLoading(false);
    };
    fetchAllData(); fetchComments();
    const { data: authListener } = supabase.auth.onAuthStateChange((_, session) => setUser(session?.user || null));
    return () => { authListener.subscription.unsubscribe(); };
  }, []);


  useEffect(() => {
    fetch("/api/hero-images").then((r) => r.json()).then((imgs: string[]) => { if (imgs.length > 0) setHeroSlides(imgs); }).catch(() => {});
  }, []);

  useEffect(() => {
    if (heroSlides.length < 2) return;
    const t = setInterval(() => setHeroSlide((s) => (s + 1) % heroSlides.length), 4500);
    return () => clearInterval(t);
  }, [heroSlides.length]);

  useEffect(() => {
    const fetchCount = () =>
      fetch("/api/subscriber-count")
        .then((r) => r.json())
        .then(({ count }) => setSubscriberCount(count))
        .catch(() => {});
    fetchCount();
    const interval = setInterval(fetchCount, 30_000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (subscriberCount === null) return;
    const target = subscriberCount;
    const duration = 900;
    const steps = 40;
    const stepValue = target / steps;
    let current = 0;
    let step = 0;
    const timer = setInterval(() => {
      step++;
      current = Math.min(Math.round(stepValue * step), target);
      setDisplayCount(current);
      if (step >= steps) clearInterval(timer);
    }, duration / steps);
    return () => clearInterval(timer);
  }, [subscriberCount]);

  const fetchComments = async () => {
    const { data } = await supabase.from("comments").select("id, name, message, created_at, rating").order("created_at", { ascending: false }).limit(6);
    setComments(data || []);
  };

  const handleSubmitComment = async () => {
    if (!commentForm.name.trim() || !commentForm.message.trim()) { showToast("Please fill in your name and message", "error"); return; }
    setSubmittingComment(true);
    const { error } = await supabase.from("comments").insert([{ name: commentForm.name.trim(), message: commentForm.message.trim(), category: commentForm.category, rating: commentForm.rating }]);
    setSubmittingComment(false);
    if (error) { showToast("Failed to send comment", "error"); return; }
    showToast("Comment sent! Thank you.");
    setCommentForm({ name: "", message: "", category: "product", rating: 5 });
    fetchComments();
    router.push(commentForm.category === "repair" ? "/repair" : "/#shop");
  };

  const toggleWishlist = (id: string) => {
    setWishlist((prev) => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); showToast("Removed from wishlist"); }
      else { next.add(id); showToast("Added to wishlist ♥"); }
      return next;
    });
  };

  const handleNewsletterSubscribe = async () => {
    const email = newsletterEmail.trim();
    if (!email) return;
    if (!email.includes("@")) { showToast("Please enter a valid email address", "error"); return; }
    setNewsletterLoading(true);
    try {
      const res = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || "Subscription failed. Please try again.", "error");
      } else if (data.alreadySubscribed) {
        showToast("You're already on the list — we'll keep you posted!");
        setNewsletterEmail("");
      } else {
        showToast("You're subscribed! Welcome to TechNinja.");
        setNewsletterEmail("");
        setSubscriberCount((prev) => (prev !== null ? prev + 1 : prev));
      }
    } catch {
      showToast("Network error. Please try again.", "error");
    } finally {
      setNewsletterLoading(false);
    }
  };

  const filteredUpdates = activeUpdateType === "all" ? updates : updates.filter((u) => (u.type || "announcement") === activeUpdateType);
  const updateTypes = ["all", ...Array.from(new Set(updates.map((u) => u.type || "announcement")))];
  const featuredProducts = products.filter((p) => p.stock > 0).slice(0, 8);
  const filteredProducts = activeFilter === "all"
    ? featuredProducts
    : featuredProducts.filter((_, i) => {
        if (activeFilter === "latest") return i < 3;
        if (activeFilter === "bestseller") return i >= 1 && i < 5;
        if (activeFilter === "featured") return i % 3 === 2;
        return true;
      });

  const inputCls = "w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 text-[14px] text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:border-[#2563EB] dark:focus:border-blue-400 transition-colors";

  return (
    <main className="min-h-screen bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 overflow-x-hidden">
      <Navbar />

      {/* ══ HERO CAROUSEL ══ */}
      <section className="pt-16 bg-[#F5F7FA] dark:bg-gray-900 overflow-hidden">
        <div className="relative">
          {heroSlides.map((src, i) => (
            <div
              key={src}
              className="min-h-[520px] sm:min-h-[580px] flex items-center transition-opacity duration-700"
              style={{ display: heroSlide === i ? "flex" : "none" }}
            >
              <div className="max-w-7xl mx-auto w-full px-5 lg:px-8 py-16 sm:py-20">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-10 items-center">

                  {/* Left text */}
                  <div className="text-center md:text-left">
                    <p className="text-[11px] font-semibold tracking-[0.18em] uppercase text-[#2563EB] mb-3">
                      {i === 0 ? "Feel the Music with" : i === 1 ? "Track Every Moment" : "Your Tech Experts"}
                    </p>
                    <h1 className="text-[46px] sm:text-[58px] font-black leading-[0.95] text-gray-900 dark:text-white mb-5">
                      {i === 0 ? <>Your trusted<br /><span className="text-[#2563EB]">tech partner.</span></> :
                       i === 1 ? <>Premium<br /><span className="text-[#2563EB]">devices.</span></> :
                       <>Repair &<br /><span className="text-[#2563EB]">Beyond.</span></>}
                    </h1>
                    <p className="text-gray-500 dark:text-gray-400 text-[15px] leading-relaxed mb-7 max-w-xs mx-auto md:mx-0">
                      {i === 0
                        ? "Device repairs, premium retail, trade-ins & IT support — all under one roof in Mauritius."
                        : i === 1
                        ? "Brand new smartphones, laptops, accessories at competitive prices."
                        : "Professional screen, battery & water-damage repair. Same day. Guaranteed."}
                    </p>
                    <div className="flex flex-wrap justify-center md:justify-start gap-3">
                      <button
                        onClick={() => setShowContact(true)}
                        className="inline-flex items-center gap-2 bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-[14px] font-semibold px-6 py-3 rounded-lg transition-all shadow-md shadow-[#2563EB]/25 active:scale-95"
                      >
                        Book Repair
                      </button>
                      <Link
                        href="/Clients"
                        className="inline-flex items-center gap-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 text-[14px] font-semibold px-6 py-3 rounded-lg hover:border-[#2563EB]/40 hover:text-[#2563EB] transition-all"
                      >
                        Browse Shop
                      </Link>
                    </div>
                    <div className="flex flex-wrap justify-center md:justify-start gap-x-5 gap-y-1.5 mt-5">
                      {["✓ Same-day repairs", "✓ 2yr warranty", "✓ Free diagnosis"].map((b) => (
                        <span key={b} className="text-[12px] font-medium text-gray-400">{b}</span>
                      ))}
                    </div>
                  </div>

                  {/* Center image */}
                  <div className="flex items-center justify-center">
                    <div className="relative w-[260px] sm:w-[320px] md:w-[360px] aspect-square rounded-2xl overflow-hidden bg-white dark:bg-gray-800 shadow-[0_2px_12px_rgba(0,0,0,0.08)] border border-gray-100 dark:border-gray-700">
                      <Image src={src} alt={`Tech Ninja hero ${i + 1}`} fill unoptimized priority={i === 0} className="object-contain p-6" />
                    </div>
                  </div>

                  {/* Right info (desktop) */}
                  <div className="hidden md:block text-right">
                    <span className="inline-block bg-[#2563EB]/10 text-[#2563EB] text-[11px] font-semibold px-3 py-1 rounded-full mb-4 uppercase tracking-wider">
                      {i === 0 ? "Open Now · Mauritius" : i === 1 ? "New Arrivals" : "Best Rated"}
                    </span>
                    <h3 className="text-[22px] font-bold text-gray-900 dark:text-white mb-3">
                      {i === 0 ? "500+ Happy Clients" : i === 1 ? "Top Gadgets" : "Expert Techs"}
                    </h3>
                    <p className="text-gray-500 dark:text-gray-400 text-[14px] leading-relaxed max-w-[200px] ml-auto">
                      {i === 0 ? "Trusted by hundreds of customers across Mauritius." :
                       i === 1 ? "Handpicked premium tech for the modern lifestyle." :
                       "Certified technicians handling Apple, Samsung, and more."}
                    </p>
                    <div className="mt-5">
                      <span className="text-[26px] font-bold text-[#2563EB]">4.9 ★</span>
                      <p className="text-[12px] text-gray-400 mt-1">Customer satisfaction</p>
                    </div>
                  </div>

                </div>
              </div>
            </div>
          ))}

          {/* Arrows */}
          <button
            onClick={() => setHeroSlide((s) => (s - 1 + heroSlides.length) % heroSlides.length)}
            className="absolute left-3 sm:left-5 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-gray-200 dark:border-gray-700 rounded-full flex items-center justify-center text-gray-700 dark:text-gray-300 hover:text-[#2563EB] shadow-[0_2px_8px_rgba(0,0,0,0.08)] hover:shadow-md transition-all z-10"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </button>
          <button
            onClick={() => setHeroSlide((s) => (s + 1) % heroSlides.length)}
            className="absolute right-3 sm:right-5 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-gray-200 dark:border-gray-700 rounded-full flex items-center justify-center text-gray-700 dark:text-gray-300 hover:text-[#2563EB] shadow-[0_2px_8px_rgba(0,0,0,0.08)] hover:shadow-md transition-all z-10"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
          </button>

          {/* Dots */}
          <div className="flex items-center justify-center gap-2 pb-8 pt-2">
            {heroSlides.map((_, i) => (
              <button
                key={i}
                onClick={() => setHeroSlide(i)}
                className="rounded-full transition-all duration-300"
                style={{ width: heroSlide === i ? "22px" : "8px", height: "8px", background: heroSlide === i ? "#2563EB" : "#D1D5DB" }}
              />
            ))}
          </div>
        </div>
      </section>

      {/* ══ MARQUEE ══ */}
      <div className="border-y border-gray-100 dark:border-gray-800 py-3 overflow-hidden bg-white dark:bg-gray-900">
        <div className="flex animate-marquee" style={{ width: "max-content" }}>
          {[...Array(4)].flatMap(() => MARQUEE_ITEMS).map((item, i) => (
            <span key={i} className="flex items-center text-[11px] text-gray-400 font-semibold uppercase tracking-[0.14em] px-8 whitespace-nowrap">
              {item}<span className="text-gray-200 dark:text-gray-700 ml-8">·</span>
            </span>
          ))}
        </div>
      </div>

      {/* ══ TRUST BAR ══ */}
      <section className="bg-[#F5F7FA] dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 py-14">
        <div className="max-w-7xl mx-auto px-5 lg:px-8">
          <h2 className="text-center text-[20px] sm:text-[24px] font-bold text-gray-900 dark:text-white mb-10">
            The Right Accessory Changes Everything
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 sm:gap-8">
            {TRUST_ITEMS.map((t) => (
              <div key={t.label} className="flex flex-col items-center text-center gap-3">
                <div className="w-14 h-14 rounded-full bg-[#2563EB]/10 flex items-center justify-center text-[#2563EB]">
                  {t.icon}
                </div>
                <p className="text-[14px] font-semibold text-gray-900 dark:text-white">{t.label}</p>
                <p className="text-[13px] text-gray-500 dark:text-gray-400 leading-snug">{t.sub}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ SERVICES — Bento Grid ══ */}
      <section id="services" className="bg-white dark:bg-gray-950 py-20 px-5 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="mb-12">
            <p className="text-[11px] font-semibold tracking-[0.15em] text-gray-400 uppercase mb-3">What We Offer</p>
            <h2 className="text-[30px] sm:text-[38px] font-bold text-gray-900 dark:text-white leading-tight">
              Everything Tech,<br className="hidden sm:block" /> Under One Roof.
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-4">
            {SERVICES.map((svc, i) => (
              <div
                key={svc.title}
                className={`cat-card-lift group relative overflow-hidden rounded-xl border border-gray-100 dark:border-gray-800 ${svc.color} hover:shadow-[0_8px_32px_rgba(0,0,0,0.08)] dark:hover:shadow-[0_8px_32px_rgba(0,0,0,0.4)] transition-all p-7 flex flex-col ${
                  i === 0 ? "xl:col-span-4" : i === 3 ? "xl:col-span-4" : "xl:col-span-2"
                }`}
              >
                <div className={`w-11 h-11 rounded-xl ${svc.iconBg} flex items-center justify-center ${svc.iconColor} mb-5`}>
                  {svc.icon}
                </div>
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="text-[16px] font-bold text-gray-900 dark:text-white">{svc.title}</h3>
                  <span className={`text-[10px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded-full ${svc.tagColor}`}>{svc.tag}</span>
                </div>
                <p className="text-[14px] text-gray-500 dark:text-gray-400 leading-relaxed mb-5">{svc.desc}</p>
                <ul className="mt-auto space-y-2">
                  {svc.items.map((item) => (
                    <li key={item} className="flex items-center gap-2 text-[13px] text-gray-500 dark:text-gray-400">
                      <svg className="w-3.5 h-3.5 flex-shrink-0 text-[#2563EB]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Link href="/Clients" className="inline-flex items-center gap-2 bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-[14px] font-semibold px-6 py-2.5 rounded-lg transition-colors shadow-sm">
              Browse Shop
            </Link>
            <button onClick={() => setShowContact(true)} className="text-[14px] font-medium text-[#2563EB] hover:text-[#1D4ED8] transition-colors">
              Get in touch →
            </button>
          </div>
        </div>
      </section>

      {/* ══ FEATURED PRODUCTS ══ */}
      {(loading || featuredProducts.length > 0) && (
        <section id="featured" className="bg-[#F5F7FA] dark:bg-gray-900 py-20 px-5 lg:px-8">
          <div className="max-w-7xl mx-auto">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 mb-10">
              <div>
                <p className="text-[11px] font-semibold tracking-[0.15em] text-gray-400 uppercase mb-3">Trending</p>
                <h2 className="text-[28px] sm:text-[34px] font-bold text-gray-900 dark:text-white">Our Most-Loved Picks</h2>
                <p className="text-[14px] text-gray-500 dark:text-gray-400 mt-2 max-w-md">
                  Check out what our customers can&apos;t stop raving about — curated just for you.
                </p>
              </div>
              {/* Filter tabs */}
              <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
                {(["all", "latest", "bestseller", "featured"] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setActiveFilter(f)}
                    className={`text-[12px] font-semibold px-4 py-1.5 rounded-full border transition-all capitalize ${
                      activeFilter === f
                        ? "bg-[#2563EB] text-white border-[#2563EB]"
                        : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-[#2563EB]/50 hover:text-[#2563EB]"
                    }`}
                  >
                    {f === "all" ? "All" : f === "bestseller" ? "Best Seller" : f.charAt(0).toUpperCase() + f.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {loading ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {[...Array(8)].map((_, i) => (
                  <div key={i} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 overflow-hidden">
                    <div className="aspect-square bg-gray-100 dark:bg-gray-700 animate-pulse" />
                    <div className="p-4 space-y-2">
                      <div className="h-3 bg-gray-100 dark:bg-gray-700 rounded animate-pulse" />
                      <div className="h-3 bg-gray-100 dark:bg-gray-700 rounded w-2/3 animate-pulse" />
                      <div className="h-8 bg-gray-100 dark:bg-gray-700 rounded mt-3 animate-pulse" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5">
                {(filteredProducts.length > 0 ? filteredProducts : featuredProducts).map((product) => (
                  <div
                    key={product.id}
                    className="product-card-lift bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 overflow-hidden flex flex-col group shadow-[0_2px_12px_rgba(0,0,0,0.04)]"
                  >
                    {/* Image */}
                    <div className="relative overflow-hidden bg-[#F9FAFB] dark:bg-gray-700 aspect-square">
                      {product.image ? (
                        <Image
                          src={product.image.replace("/object/public/", "/render/image/public/")}
                          alt={product.name} fill unoptimized
                          className="object-cover group-hover:scale-[1.04] transition-transform duration-500"
                          onError={(e) => { (e.target as HTMLImageElement).src = `https://placehold.co/300x300/F9FAFB/6B7280?text=${encodeURIComponent(product.name)}`; }}
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-300 text-sm">{product.name.slice(0, 2).toUpperCase()}</div>
                      )}
                      {product.stock > 0 && product.stock <= 5 && (
                        <span className="absolute top-2.5 left-2.5 text-[10px] font-bold text-white bg-amber-500 px-2 py-0.5 rounded-full">
                          Only {product.stock} left
                        </span>
                      )}
                      {product.stock === 0 && (
                        <div className="absolute inset-0 bg-white/60 dark:bg-gray-800/60 backdrop-blur-[2px] flex items-center justify-center">
                          <span className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 px-3 py-1 rounded-full">Out of stock</span>
                        </div>
                      )}
                      {/* Wishlist */}
                      <button
                        onClick={() => toggleWishlist(product.id)}
                        className={`absolute top-2.5 right-2.5 w-8 h-8 rounded-full flex items-center justify-center backdrop-blur-sm border transition-all ${
                          wishlist.has(product.id)
                            ? "bg-red-50 border-red-200 text-red-500"
                            : "bg-white/70 dark:bg-gray-700/70 border-white/50 dark:border-gray-600 text-gray-400 opacity-0 group-hover:opacity-100"
                        }`}
                      >
                        <svg className="w-4 h-4" fill={wishlist.has(product.id) ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                        </svg>
                      </button>
                    </div>
                    {/* Info */}
                    <div className="p-4 flex flex-col flex-1">
                      {product.category && (
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-1">{product.category}</p>
                      )}
                      <h3 className="text-[13px] font-semibold text-gray-900 dark:text-white leading-snug mb-2 flex-1 line-clamp-2">{product.name}</h3>
                      <Stars />
                      <p className="text-[18px] font-bold text-[#2563EB] mt-2 mb-3">Rs {product.price.toLocaleString()}</p>
                      <Link
                        href={`/product/${product.id}`}
                        className="w-full bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-[13px] font-semibold py-2.5 rounded-full text-center transition-all active:scale-95 block"
                      >
                        View Product
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {products.length > 8 && !loading && (
              <div className="mt-10 text-center">
                <Link href="/Clients" className="inline-flex items-center gap-2 px-7 py-3 bg-[#2563EB] hover:bg-[#1D4ED8] text-white rounded-lg font-semibold text-[14px] transition-colors shadow-sm">
                  View all products →
                </Link>
              </div>
            )}
          </div>
        </section>
      )}


      {/* ══ DEALS BANNER ══ */}
      <section id="deals" className="bg-white dark:bg-gray-950 py-20 px-5 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="mb-10">
            <p className="text-[11px] font-semibold tracking-[0.15em] text-gray-400 uppercase mb-3">Limited Time</p>
            <h2 className="text-[28px] sm:text-[34px] font-bold text-gray-900 dark:text-white">Hot Deals Right Now</h2>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Big blue card */}
            <div className="cat-card-lift relative overflow-hidden rounded-xl bg-[#2563EB] p-8 sm:p-10 flex flex-col justify-between min-h-[280px] cursor-pointer">
              <div className="absolute -right-10 -bottom-10 w-56 h-56 bg-white/10 rounded-full" />
              <div className="absolute right-6 bottom-6 w-40 h-40 bg-white/5 rounded-full" />
              <div className="relative z-10">
                <span className="inline-block bg-white/20 text-white text-[11px] font-semibold px-3 py-1 rounded-full uppercase tracking-wider mb-5">Up to 50% off</span>
                <h3 className="text-[24px] sm:text-[30px] font-black text-white leading-tight mb-3">
                  Smartphones,<br />Accessories<br /><span className="text-blue-200">and More</span>
                </h3>
                <button onClick={() => setShowContact(true)} className="inline-flex items-center gap-2 bg-white text-[#2563EB] text-[13px] font-bold px-5 py-2.5 rounded-lg hover:bg-blue-50 transition-all">
                  SHOP NOW →
                </button>
              </div>
            </div>
            {/* Two stacked cards */}
            <div className="flex flex-col gap-5">
              {[
                { accent: "[#2563EB]", label: "Gadget Deals", title: "Live Now", sub: "Save up to 60% on smart speakers.", btnColor: "text-[#2563EB] border-[#2563EB]/30 hover:bg-[#2563EB] hover:text-white hover:border-[#2563EB]", tag: "bg-[#2563EB]/10 text-[#2563EB]" },
                { accent: "purple-600", label: "Wearables",   title: "Smart Tech Everyday", sub: "Up to 70% off on smartwatches.",  btnColor: "text-purple-600 border-purple-300 hover:bg-purple-600 hover:text-white hover:border-purple-600", tag: "bg-purple-100 text-purple-600 dark:bg-purple-900/20 dark:text-purple-400" },
              ].map((d) => (
                <div key={d.title} className="cat-card-lift relative overflow-hidden rounded-xl bg-[#F9FAFB] dark:bg-gray-800 border border-gray-100 dark:border-gray-700 p-6 flex items-center justify-between min-h-[130px] cursor-pointer">
                  <div>
                    <span className={`inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider mb-2 ${d.tag}`}>{d.label}</span>
                    <h4 className="text-[16px] font-bold text-gray-900 dark:text-white mb-1">{d.title}</h4>
                    <p className="text-[13px] text-gray-500 dark:text-gray-400 mb-3" dangerouslySetInnerHTML={{ __html: d.sub }} />
                    <button className={`text-[12px] font-bold border px-4 py-1.5 rounded-lg transition-all ${d.btnColor}`}>SHOP NOW</button>
                  </div>
                  <div className="w-20 h-20 rounded-xl bg-gray-100 dark:bg-gray-700 flex-shrink-0 flex items-center justify-center text-3xl">
                    {d.label === "Gadget Deals" ? "🔊" : "⌚"}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ══ WHY CHOOSE US ══ */}
      <section className="bg-[#F5F7FA] dark:bg-gray-900 py-20 px-5 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="mb-12">
            <p className="text-[11px] font-semibold tracking-[0.15em] text-gray-400 uppercase mb-3">Why choose us</p>
            <h2 className="text-[28px] sm:text-[34px] font-bold text-gray-900 dark:text-white">Built on Trust &amp; Quality.</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {WHY_US.map((item) => (
              <div
                key={item.title}
                className="cat-card-lift bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-7 hover:shadow-[0_8px_24px_rgba(0,0,0,0.06)] dark:hover:shadow-[0_8px_24px_rgba(0,0,0,0.3)] transition-all"
              >
                <span className="text-3xl block mb-4">{item.icon}</span>
                <h3 className="text-[15px] font-bold text-gray-900 dark:text-white mb-2">{item.title}</h3>
                <p className="text-[13px] text-gray-500 dark:text-gray-400 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ UPDATES ══ */}
      {isAdmin && updates.length > 0 && (
        <section className="bg-white dark:bg-gray-950 py-20 px-5 lg:px-8">
          <div className="max-w-7xl mx-auto">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 mb-10">
              <div>
                <p className="text-[11px] font-semibold tracking-[0.15em] text-gray-400 uppercase mb-3">Latest</p>
                <h2 className="text-[28px] sm:text-[34px] font-bold text-gray-900 dark:text-white">Updates.</h2>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {updateTypes.map((type) => (
                  <button
                    key={type}
                    onClick={() => setActiveUpdateType(type)}
                    className={`px-3.5 py-1.5 rounded-full text-[12px] font-semibold tracking-wide transition-all ${
                      activeUpdateType === type
                        ? "bg-[#2563EB] text-white"
                        : "bg-[#F5F7FA] dark:bg-gray-800 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700 hover:border-[#2563EB]/40"
                    }`}
                  >
                    {type === "all" ? `All (${updates.length})` : type}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredUpdates.slice(0, 4).map((update) => (
                <div key={update.id} className="cat-card-lift rounded-xl border border-gray-100 dark:border-gray-800 bg-[#F9FAFB] dark:bg-gray-800 p-7 hover:shadow-[0_8px_24px_rgba(0,0,0,0.06)] transition-all">
                  <div className="flex items-center gap-2 mb-3">
                    {update.priority && (
                      <span className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                        update.priority === "high" ? "bg-red-100 text-red-600 dark:bg-red-900/20 dark:text-red-400"
                        : update.priority === "medium" ? "bg-amber-100 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400"
                        : "bg-green-100 text-green-600 dark:bg-green-900/20 dark:text-green-400"
                      }`}>{update.priority}</span>
                    )}
                    {update.type && (
                      <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400">
                        {update.type}
                      </span>
                    )}
                  </div>
                  <h3 className="text-[16px] font-bold text-gray-900 dark:text-white mb-2 leading-snug">{update.info}</h3>
                  {update.created_at && (
                    <p className="text-[12px] text-gray-400 mb-2">
                      {new Date(update.created_at).toLocaleDateString("en-US", { day: "numeric", month: "long", year: "numeric" })}
                    </p>
                  )}
                  <p className="text-[13px] text-gray-500 dark:text-gray-400 leading-relaxed line-clamp-2">{update.content}</p>
                  {update.link && (
                    <a href={update.link.startsWith("http") ? update.link : `https://${update.link}`} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 mt-4 text-[13px] font-semibold text-[#2563EB] hover:text-[#1D4ED8] transition-colors">
                      Read more →
                    </a>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ══ SOCIAL PROFILES ══ */}
      {socialProfiles.length > 0 && (
        <section className="bg-[#F5F7FA] dark:bg-gray-900 py-20 px-5 lg:px-8">
          <div className="max-w-7xl mx-auto">
            <div className="mb-10">
              <p className="text-[11px] font-semibold tracking-[0.15em] text-gray-400 uppercase mb-3">Follow us</p>
              <h2 className="text-[28px] sm:text-[34px] font-bold text-gray-900 dark:text-white">Connect.</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {socialProfiles.map((profile) => (
                <div key={profile.id} className="cat-card-lift bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-6 flex flex-col hover:shadow-[0_8px_24px_rgba(0,0,0,0.06)] transition-all">
                  <div className="flex items-center gap-3 mb-4">
                    {profile.platform_icon ? (
                      <Image src={profile.platform_icon} alt={profile.platform_name} width={40} height={40} unoptimized className="w-10 h-10 rounded-xl object-cover border border-gray-100 dark:border-gray-700" onError={(e) => { (e.target as HTMLImageElement).src = `https://placehold.co/40x40/F5F7FA/6B7280?text=${profile.platform_name.charAt(0)}`; }} />
                    ) : (
                      <div className="w-10 h-10 rounded-xl bg-[#F5F7FA] dark:bg-gray-700 flex items-center justify-center text-sm font-bold text-gray-400">{profile.platform_name.charAt(0)}</div>
                    )}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-gray-900 dark:text-white text-[14px] truncate">{profile.platform_name}</h3>
                      {profile.username && <p className="text-[12px] text-gray-400 truncate">@{profile.username}</p>}
                    </div>
                    {profile.is_active && <span className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" />}
                  </div>
                  {profile.description && <p className="text-[13px] text-gray-500 dark:text-gray-400 mb-4 line-clamp-2">{profile.description}</p>}
                  {profile.followers && profile.followers > 0 && (
                    <p className="text-[13px] text-gray-400 mb-4"><span className="font-bold text-gray-900 dark:text-white">{profile.followers.toLocaleString()}</span> followers</p>
                  )}
                  <a href={profile.profile_link.startsWith("http") ? profile.profile_link : `https://${profile.profile_link}`} target="_blank" rel="noopener noreferrer"
                    className="mt-auto block text-center py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-[#F9FAFB] dark:bg-gray-700 hover:bg-[#2563EB] hover:border-[#2563EB] hover:text-white text-[12px] font-semibold text-gray-700 dark:text-gray-300 transition-all">
                    Visit profile →
                  </a>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ══ NEWSLETTER ══ */}
      <section id="newsletter" className="bg-gray-900 py-20 px-5 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
            <div className="flex items-center justify-center">
              <div className="relative">
                <div className="absolute inset-0 bg-[#2563EB]/20 rounded-full blur-3xl scale-75" />
                <div className="relative w-[220px] sm:w-[300px] aspect-square rounded-2xl bg-gray-800 border border-gray-700 flex items-center justify-center text-6xl">🎧</div>
              </div>
            </div>
            <div>
              <span className="inline-block bg-[#2563EB]/20 text-blue-400 text-[11px] font-semibold px-3 py-1 rounded-full uppercase tracking-wider mb-5">Newsletter</span>
              <h2 className="text-[28px] sm:text-[38px] font-black text-white leading-tight mb-4">
                Stay in the Loop<br />with <span className="text-[#2563EB]">TechNinja</span>
              </h2>
              <p className="text-gray-400 text-[15px] leading-relaxed mb-5">
                Get exclusive deals, early access to new products, and tech tips straight to your inbox.
              </p>
              <div className="flex items-center gap-3 mb-7">
                <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-full px-4 py-2">
                  <span className="flex h-2 w-2 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
                  </span>
                  <span className="text-white font-bold text-[15px] tabular-nums">
                    {subscriberCount === null ? "…" : displayCount.toLocaleString()}
                  </span>
                  <span className="text-gray-400 text-[13px]">subscribers in Mauritius</span>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  type="email"
                  value={newsletterEmail}
                  onChange={(e) => setNewsletterEmail(e.target.value)}
                  placeholder="Enter your email address"
                  disabled={newsletterLoading}
                  className="flex-1 bg-white/10 border border-white/15 text-white placeholder-gray-500 text-[14px] px-4 py-3 rounded-lg focus:outline-none focus:border-[#2563EB] transition-all disabled:opacity-50"
                  onKeyDown={(e) => { if (e.key === "Enter") handleNewsletterSubscribe(); }}
                />
                <button
                  onClick={handleNewsletterSubscribe}
                  disabled={newsletterLoading}
                  className="flex-shrink-0 bg-[#2563EB] hover:bg-[#1D4ED8] disabled:opacity-60 text-white text-[14px] font-semibold px-6 py-3 rounded-lg transition-all whitespace-nowrap active:scale-95"
                >
                  {newsletterLoading ? "Subscribing…" : "Subscribe Now"}
                </button>
              </div>
              <p className="text-gray-600 text-[12px] mt-3">No spam, ever. Unsubscribe at any time.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ══ REVIEWS ══ */}
      <section className="bg-[#F5F7FA] dark:bg-gray-900 py-20 px-5 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="mb-10">
            <p className="text-[11px] font-semibold tracking-[0.15em] text-gray-400 uppercase mb-3">Customer Reviews</p>
            <h2 className="text-[28px] sm:text-[34px] font-bold text-gray-900 dark:text-white">What people say.</h2>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Leave a review form */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-7 space-y-4 shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
              <h3 className="text-[17px] font-bold text-gray-900 dark:text-white">Share your experience</h3>
              <div>
                <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider block mb-1.5">Your Name</label>
                <input value={commentForm.name} onChange={(e) => setCommentForm({ ...commentForm, name: e.target.value })} placeholder="Full name" className={inputCls} />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider block mb-1.5">About</label>
                <select value={commentForm.category} onChange={(e) => setCommentForm({ ...commentForm, category: e.target.value })} className={inputCls}>
                  <option value="product">Product</option>
                  <option value="repair">Repair</option>
                </select>
              </div>
              <div>
                <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider block mb-1.5">Rating</label>
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button key={star} type="button" onClick={() => setCommentForm({ ...commentForm, rating: star })}>
                      <svg className={`w-7 h-7 transition-all ${star <= commentForm.rating ? "text-amber-400 scale-110" : "text-gray-200 dark:text-gray-700"}`} viewBox="0 0 20 20" fill="currentColor">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider block mb-1.5">Message</label>
                <textarea value={commentForm.message} onChange={(e) => setCommentForm({ ...commentForm, message: e.target.value })} rows={4} placeholder="Share your experience with Tech Ninja…" className={`${inputCls} resize-none`} />
              </div>
              <button
                onClick={handleSubmitComment}
                disabled={submittingComment}
                className="w-full py-3 bg-[#2563EB] hover:bg-[#1D4ED8] disabled:opacity-40 text-white text-[14px] font-bold rounded-lg transition-all active:scale-[0.98]"
              >
                {submittingComment ? "Sending…" : "Submit Review"}
              </button>
            </div>

            {/* Review cards */}
            <div className="space-y-3">
              {comments.length === 0 ? (
                <div className="flex flex-col items-center justify-center min-h-[260px] rounded-xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-800 text-center p-8 gap-4">
                  <div className="text-4xl">💬</div>
                  <p className="text-[15px] font-bold text-gray-400">No reviews yet</p>
                  <p className="text-[13px] text-gray-300 dark:text-gray-600">Be the first to share your experience!</p>
                </div>
              ) : (
                comments.map((c) => (
                  <div key={c.id} className="rounded-xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-800 p-5 hover:shadow-[0_4px_16px_rgba(0,0,0,0.06)] transition-all">
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#2563EB] to-[#60A5FA] flex items-center justify-center text-white font-bold text-[13px] flex-shrink-0">
                        {c.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[14px] font-bold text-gray-900 dark:text-white">{c.name}</span>
                          <div className="flex items-center gap-2">
                            {c.name === (profileUsername || user?.email?.split("@")[0]) && (
                              <button
                                onClick={async () => {
                                  const { error } = await supabase.from("comments").delete().eq("id", c.id);
                                  if (!error) setComments((prev) => prev.filter((x) => x.id !== c.id));
                                }}
                                className="text-[11px] text-red-400 hover:text-red-600 transition-colors"
                              >Delete</button>
                            )}
                            <span className="text-[11px] text-gray-400">
                              {new Date(c.created_at).toLocaleDateString("en-US", { day: "numeric", month: "short" })}
                            </span>
                          </div>
                        </div>
                        {c.rating && <Stars n={c.rating} />}
                        <p className="text-[13px] text-gray-500 dark:text-gray-400 leading-relaxed mt-1.5">{c.message}</p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ══ ADMIN ══ */}
      {isAdmin && !loading && (
        <section className="bg-white dark:bg-gray-950 py-14 px-5 lg:px-8 border-t border-gray-100 dark:border-gray-800">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-center gap-3 mb-7">
              <h2 className="text-[16px] font-bold text-gray-900 dark:text-white">Admin</h2>
              <span className="text-[10px] font-semibold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400">Private</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
              {[
                { label: "Est. Inventory Value", value: `Rs ${adminStats.totalRevenue.toLocaleString()}` },
                { label: "Low Stock",            value: `${adminStats.lowStockCount} products` },
                { label: "Out of Stock",         value: `${adminStats.outOfStockCount} products` },
              ].map((stat) => (
                <div key={stat.label} className="rounded-xl border border-gray-100 dark:border-gray-800 bg-[#F9FAFB] dark:bg-gray-800 p-5">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-1.5">{stat.label}</p>
                  <p className="text-[20px] font-bold text-gray-900 dark:text-white">{stat.value}</p>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              {[
                { label: "Add Product",  href: "/admin/products/new" },
                { label: "Post Update",  href: "/admin/updates/new" },
                { label: "Manage Users", href: "/admin/users" },
                { label: "Social Links", href: "/admin/social" },
              ].map((action) => (
                <Link key={action.label} href={action.href}
                  className="px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-[13px] font-medium text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:border-gray-300 dark:hover:border-gray-600 transition-all">
                  {action.label}
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ══ FOOTER CTA ══ */}
      <section className="relative overflow-hidden bg-gray-900 py-24 px-5 lg:px-8">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse 60% 70% at 30% 50%, rgba(37,99,235,0.12) 0%, transparent 70%)" }} />
          <div className="absolute inset-0 bg-grid opacity-30" />
        </div>
        <div className="relative max-w-7xl mx-auto">
          <p className="text-[11px] font-semibold tracking-[0.2em] uppercase text-gray-500 mb-6">Get started today</p>
          <h2 className="text-[44px] sm:text-[58px] font-black tracking-tight leading-[0.94] max-w-2xl mb-7">
            <span className="text-white">Your device</span><br />
            <span className="text-[#2563EB]">deserves better.</span>
          </h2>
          <p className="text-[16px] text-gray-500 mb-10 max-w-sm leading-relaxed">
            Walk in anytime — no appointment needed. Our team is ready to help.
          </p>
          <div className="flex flex-wrap gap-3">
            <button onClick={() => setShowContact(true)} className="inline-flex items-center gap-2 bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-[14px] font-semibold px-7 py-3.5 rounded-lg transition-colors shadow-md active:scale-[0.97]">
              Book a Repair
            </button>
            <Link href="/Clients" className="inline-flex items-center gap-2 bg-white text-gray-900 text-[14px] font-semibold px-7 py-3.5 rounded-lg hover:bg-gray-100 transition-colors">
              Browse Shop
            </Link>
            <button onClick={() => setShowContact(true)} className="inline-flex items-center gap-2 text-gray-400 hover:text-white border border-gray-700 hover:border-gray-500 text-[14px] font-semibold px-7 py-3.5 rounded-lg transition-all">
              Contact Us
            </button>
          </div>
        </div>
      </section>

      {showContact && <ContactModal onClose={() => setShowContact(false)} />}

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-[110] flex items-center gap-3 px-5 py-3.5 rounded-xl shadow-2xl transition-all ${
          toast.type === "success"
            ? "bg-gray-900 text-white"
            : "bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800"
        }`}>
          {toast.type === "success" && (
            <svg className="w-4 h-4 text-green-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          )}
          <span className="text-[14px] font-medium">{toast.message}</span>
        </div>
      )}
    </main>
  );
}
