"use client";

import Navbar from "@/components/Navbar";
import Image from "next/image";
import { useState, useEffect } from "react";
import ContactModal from "@/components/ContactModal";
import { supabase } from "@/lib/supabase";

interface Review {
  id: string;
  name: string;
  message: string;
  rating: number;
  created_at: string;
}

/* ─── Data ─────────────────────────────────────────────────────────────────── */

const REPAIR_SERVICES = [
  {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 8.25h3" />
      </svg>
    ),
    title: "Screen Replacement",
    desc: "Cracked or shattered display? We replace screens for all major brands — iPhone, Samsung, Huawei, and more.",
    price: "From Rs 1,500",
    time: "1–2 hrs",
    accent: "#2563EB",
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
      </svg>
    ),
    title: "Battery Replacement",
    desc: "Swelling battery or poor battery life? We swap with genuine or high-quality replacements for lasting power.",
    price: "From Rs 800",
    time: "30 min",
    accent: "#10b981",
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23-.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" />
      </svg>
    ),
    title: "Water Damage Recovery",
    desc: "Device got wet? Professional ultrasonic cleaning and board-level drying to save your device and data.",
    price: "From Rs 2,000",
    time: "24–48 hrs",
    accent: "#0ea5e9",
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
      </svg>
    ),
    title: "Charging Port Repair",
    desc: "Loose or broken charging port repaired with precision. USB-C, Lightning, and Micro-USB supported.",
    price: "From Rs 900",
    time: "1–2 hrs",
    accent: "#f59e0b",
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
      </svg>
    ),
    title: "Camera Repair",
    desc: "Blurry, black, or cracked camera? We restore full front and rear camera functionality.",
    price: "From Rs 1,200",
    time: "1–3 hrs",
    accent: "#8b5cf6",
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0H3" />
      </svg>
    ),
    title: "Laptop Repair",
    desc: "Screen, keyboard, hinges, fan cleaning, SSD upgrades — full diagnostics for all laptop brands.",
    price: "From Rs 1,500",
    time: "Same day",
    accent: "#ef4444",
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z" />
      </svg>
    ),
    title: "Speaker & Microphone",
    desc: "No sound or muffled audio? We repair or replace speaker and mic components for crystal-clear audio.",
    price: "From Rs 700",
    time: "1–2 hrs",
    accent: "#2563EB",
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 2.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125m16.5 4.5c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125" />
      </svg>
    ),
    title: "Data Recovery",
    desc: "Bootloops, corrupted storage, factory resets — we retrieve your contacts, photos, and files safely.",
    price: "From Rs 600",
    time: "1–4 hrs",
    accent: "#10b981",
  },
];

const PROCESS_STEPS = [
  { step: "01", title: "Drop Off", desc: "Walk in with your device — no appointment needed. We're always ready.", icon: "📦" },
  { step: "02", title: "Free Diagnosis", desc: "Certified technicians inspect your device at zero cost and give a clear, honest quote.", icon: "🔬" },
  { step: "03", title: "Expert Repair", desc: "Repairs done with quality parts and professional tools. Most jobs are completed same-day.", icon: "🔧" },
  { step: "04", title: "Pickup & Warranty", desc: "Collect your device fully repaired, backed by our warranty — no hidden fees.", icon: "✅" },
];

const ALL_IMAGES = [
  { src: "/repair/02860991a808841a400d5166b8c8bfd7.jpg", alt: "Technician repairing a smartphone" },
  { src: "/repair/a948424b65d954da65aa741a06ad4ca4.jpg", alt: "Screen replacement in progress" },
  { src: "/repair/b173fbfd7cd52f16f058d469123f763f.jpg", alt: "Professional repair workbench" },
  { src: "/repair/f1869388ce9f85ee7d5001018ec98f38.jpg", alt: "Device diagnostics and repair" },
  { src: "/repair/4d7582d2cf0e1d9086024f3be04ff7ca.jpg", alt: "Circuit board level repair" },
  { src: "/repair/6fd277f2448b3b34ac73beadd9809d32.jpg", alt: "Precision soldering work" },
  { src: "/repair/1df7fcbb545895a8a985d5d1de10e337.jpg", alt: "Device teardown and inspection" },
];

const STATS_TICKER = [
  "500+ Devices Repaired",
  "Same-Day Turnaround",
  "Free Diagnosis",
  "2-Year Warranty",
  "8 Repair Types",
  "All Major Brands",
  "Certified Technicians",
  "Mauritius Based",
];

const FAQS = [
  { q: "Do I need to book an appointment?", a: "No appointment needed — just walk in. Our technicians are available during opening hours and will assist you right away." },
  { q: "How long does a typical repair take?", a: "Most repairs like screen and battery replacements take 1–2 hours. Complex jobs like water damage or data recovery may take 24–48 hours." },
  { q: "What warranty do you offer?", a: "Every repair comes with a 2-year warranty covering both parts and labour. If the same issue reoccurs, we fix it at no extra cost." },
  { q: "Is the diagnosis really free?", a: "Absolutely. We diagnose your device at zero charge before any work begins. You only pay if you agree to proceed with the repair." },
  { q: "Do you repair all brands?", a: "Yes — we service Apple, Samsung, Huawei, Xiaomi, Oppo, OnePlus, Sony, Nokia, and all major laptop brands including Dell, HP, and Lenovo." },
  { q: "What if my device can't be repaired?", a: "We'll let you know honestly during the free diagnosis. You can then explore our trade-in options to put the value toward a new device." },
];

const BRANDS = ["Apple", "Samsung", "Huawei", "Xiaomi", "Oppo", "OnePlus", "Nokia", "Sony", "LG", "Lenovo", "Dell", "HP"];

/* ─── Component ─────────────────────────────────────────────────────────────── */

export default function RepairPage() {
  const [showContact, setShowContact] = useState(false);
  const [heroSlide, setHeroSlide] = useState(0);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [lightbox, setLightbox] = useState<number | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);

  useEffect(() => {
    supabase
      .from("comments")
      .select("id, name, message, rating, created_at")
      .eq("category", "repair")
      .order("created_at", { ascending: false })
      .limit(6)
      .then(({ data }) => setReviews(data || []));
  }, []);

  const eb = "text-[12px] font-semibold tracking-[0.14em] text-gray-400 uppercase mb-4 block";
  const h2 = "text-[40px] sm:text-[52px] font-bold tracking-tight leading-[1.05] text-gray-900 dark:text-white";
  const cardOnGray = "bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700";
  const cardOnWhite = "bg-[#F5F7FA] dark:bg-gray-800 border border-gray-100 dark:border-gray-700";

  return (
    <main className="min-h-screen bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 pt-[60px] overflow-x-hidden">
      <Navbar />

      {/* ══════════════════ HERO ══════════════════ */}
      <section className="relative overflow-hidden bg-[#F5F7FA] dark:bg-gray-900 min-h-[calc(100vh-60px)] flex items-center py-20 px-6 sm:px-10 lg:px-20">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-[20%] -right-[10%] w-[45%] h-[45%] rounded-full"
            style={{ background: "radial-gradient(circle, rgba(37,99,235,0.10) 0%, transparent 70%)", filter: "blur(70px)" }} />
          <div className="absolute bottom-[10%] -left-[10%] w-[40%] h-[40%] rounded-full"
            style={{ background: "radial-gradient(circle, rgba(37,99,235,0.06) 0%, transparent 70%)", filter: "blur(80px)" }} />
          <div className="absolute inset-0 bg-grid opacity-40" />
        </div>

        <div className="relative max-w-7xl mx-auto w-full">
          <div className="grid lg:grid-cols-2 gap-16 items-center">

            {/* LEFT */}
            <div className="flex flex-col gap-8">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-[#2563EB] bg-[#2563EB]/10 rounded-full px-3 py-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#2563EB] animate-pulse" />
                  Walk-ins Welcome · Mauritius
                </span>
                <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 rounded-full px-3 py-1">
                  🛡️ 2yr Warranty Included
                </span>
              </div>

              <div>
                <h1 className="text-[48px] sm:text-[60px] lg:text-[68px] font-bold tracking-tight leading-[1.02] text-gray-900 dark:text-white">
                  Expert device<br />
                  <span className="gradient-text-blue">repair service.</span>
                </h1>
                <p className="mt-5 text-[17px] text-gray-500 dark:text-gray-400 max-w-md leading-relaxed">
                  Screens, batteries, water damage, and more — professional repairs
                  for smartphones and laptops with same-day turnaround.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                {["Screen", "Battery", "Water Damage", "Charging Port", "Camera", "Laptop", "Data Recovery"].map((s) => (
                  <span key={s} className="px-3.5 py-1.5 rounded-full bg-white dark:bg-gray-800 text-[12px] font-semibold text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700">
                    {s}
                  </span>
                ))}
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  onClick={() => setShowContact(true)}
                  className="inline-flex items-center gap-2 bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-[15px] font-semibold px-6 py-3 rounded-lg transition-colors shadow-sm"
                >
                  Book a Repair
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
                  </svg>
                </button>
                <a
                  href="#services"
                  className="inline-flex items-center gap-2 text-[#2563EB] text-[15px] font-semibold px-6 py-3 rounded-lg border border-[#2563EB]/30 hover:border-[#2563EB]/60 hover:bg-[#2563EB]/5 transition-all"
                >
                  View services
                </a>
              </div>

              <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 pt-1">
                {["✓ Same-day repairs", "✓ Free diagnosis", "✓ Certified techs", "✓ All brands"].map((b) => (
                  <span key={b} className="text-[12px] font-medium text-gray-500 dark:text-gray-400">{b}</span>
                ))}
              </div>
            </div>

            {/* RIGHT — Hero carousel */}
            <div className="relative flex items-center justify-center lg:justify-end min-h-[360px] lg:min-h-[520px]">
              <div className="absolute inset-4 rounded-3xl pointer-events-none"
                style={{ background: "radial-gradient(circle, rgba(37,99,235,0.10) 0%, transparent 70%)", filter: "blur(30px)" }} />

              {[
                { pos: "absolute left-2 top-10", delay: "0s",   dur: "3.5s", icon: "⚡", title: "Same-Day",      sub: "Most repairs" },
                { pos: "absolute right-2 bottom-16", delay: "1s", dur: "4s", icon: "🔬", title: "Free Diagnosis", sub: "No charge"    },
              ].map((b) => (
                <div key={b.title}
                  className={`${b.pos} z-20 flex items-center gap-2.5 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl px-3.5 py-2.5 shadow-[0_2px_12px_rgba(0,0,0,0.08)]`}
                  style={{ animation: `tn-badge ${b.dur} ease-in-out infinite`, animationDelay: b.delay }}
                >
                  <span className="text-xl">{b.icon}</span>
                  <div>
                    <p className="text-[12px] font-semibold text-gray-900 dark:text-white leading-tight">{b.title}</p>
                    <p className="text-[10px] text-gray-400">{b.sub}</p>
                  </div>
                </div>
              ))}
              <div className="absolute right-0 top-4 z-20 flex items-center gap-2 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl px-3 py-2 shadow-[0_2px_12px_rgba(0,0,0,0.08)]"
                style={{ animation: "tn-badge 5s ease-in-out infinite", animationDelay: "0.5s" }}
              >
                <span className="text-base">🛡️</span>
                <p className="text-[11px] font-semibold text-gray-900 dark:text-white">2yr Warranty</p>
              </div>

              <div className="relative z-10 w-[280px] sm:w-[360px] lg:w-[460px]"
                style={{ animation: "tn-float 6s ease-in-out infinite" }}
              >
                <div className="relative rounded-2xl overflow-hidden bg-[#F9FAFB] dark:bg-gray-800 shadow-[0_8px_40px_rgba(0,0,0,0.10)] dark:shadow-[0_8px_40px_rgba(0,0,0,0.5)] border border-gray-100 dark:border-gray-700"
                  style={{ aspectRatio: "4/3" }}
                >
                  {ALL_IMAGES.map(({ src, alt }, i) => (
                    <Image key={src} src={src} alt={alt} fill unoptimized priority={i === 0}
                      className="object-cover"
                      style={{ opacity: heroSlide === i ? 1 : 0, transition: "opacity 0.9s ease-in-out" }} />
                  ))}
                </div>
                <div className="flex items-center justify-center gap-1.5 mt-4">
                  {ALL_IMAGES.map((_, i) => (
                    <button key={i} onClick={() => setHeroSlide(i)}
                      className="transition-all duration-300 rounded-full focus:outline-none"
                      style={{ width: heroSlide === i ? "20px" : "7px", height: "7px", background: heroSlide === i ? "#2563EB" : "#D1D5DB" }} />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════ STATS TICKER ══════════════════ */}
      <div className="bg-[#2563EB] overflow-hidden py-3.5">
        <div className="flex items-center gap-10 w-max" style={{ animation: "marquee 30s linear infinite" }}>
          {[...STATS_TICKER, ...STATS_TICKER, ...STATS_TICKER].map((item, i) => (
            <span key={i} className="flex items-center gap-3 text-white text-[12px] font-semibold tracking-wider uppercase whitespace-nowrap">
              <span className="w-1.5 h-1.5 rounded-full bg-white/60 flex-shrink-0" />
              {item}
            </span>
          ))}
        </div>
      </div>

      {/* ══════════════════ SERVICES ══════════════════ */}
      <section id="services" className="bg-[#F5F7FA] dark:bg-gray-950 py-28 px-6 sm:px-10 lg:px-20">
        <div className="max-w-7xl mx-auto">
          <div className="mb-16">
            <span className={eb}>What we fix</span>
            <h2 className={h2}>Repair services<br />for every device.</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {REPAIR_SERVICES.map((svc) => (
              <div key={svc.title}
                className={`group relative p-7 rounded-xl ${cardOnGray} hover:shadow-[0_8px_24px_rgba(0,0,0,0.08)] dark:hover:shadow-[0_8px_24px_rgba(0,0,0,0.4)] transition-all duration-300 flex flex-col overflow-hidden`}
              >
                <div className="pointer-events-none absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                  style={{ background: `radial-gradient(circle at 30% 30%, ${svc.accent}15 0%, transparent 65%)` }} />
                <div className="relative w-12 h-12 rounded-xl flex items-center justify-center text-white mb-6 transition-all duration-300 group-hover:scale-110"
                  style={{ background: `linear-gradient(135deg, ${svc.accent}ee, ${svc.accent}88)` }}>
                  {svc.icon}
                </div>
                <h3 className="relative text-[15px] font-semibold text-gray-900 dark:text-white mb-2">{svc.title}</h3>
                <p className="relative text-[13px] text-gray-500 dark:text-gray-400 leading-relaxed flex-1 mb-5">{svc.desc}</p>
                <div className="relative pt-4 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between">
                  <span className="text-[13px] font-bold" style={{ color: svc.accent }}>{svc.price}</span>
                  <span className="text-[11px] text-gray-400 font-medium bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-full">{svc.time}</span>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-12 flex flex-wrap items-center gap-4">
            <button onClick={() => setShowContact(true)}
              className="inline-flex items-center gap-2 bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-[15px] font-semibold px-6 py-3 rounded-lg transition-colors shadow-sm">
              Get a Free Quote
            </button>
            <span className="text-[14px] text-gray-500 dark:text-gray-400">
              Not sure what&apos;s wrong? Bring it in — diagnosis is free.
            </span>
          </div>
        </div>
      </section>

      {/* ══════════════════ GALLERY ══════════════════ */}
      <section className="bg-white dark:bg-gray-950 py-28 px-6 sm:px-10 lg:px-20">
        <div className="max-w-7xl mx-auto">
          <div className="mb-16">
            <span className={eb}>Our workshop</span>
            <h2 className={h2}>Precision at<br />every step.</h2>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="col-span-2 row-span-2 relative rounded-2xl overflow-hidden cursor-pointer group"
              style={{ minHeight: "360px" }} onClick={() => setLightbox(0)}>
              <Image src={ALL_IMAGES[0].src} alt={ALL_IMAGES[0].alt} fill unoptimized className="object-cover group-hover:scale-[1.03] transition-transform duration-500" />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-300" />
              <div className="absolute bottom-4 left-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                <span className="text-[12px] font-semibold text-white bg-black/50 backdrop-blur-sm px-3 py-1.5 rounded-full">View</span>
              </div>
            </div>

            {ALL_IMAGES.slice(1, 5).map(({ src, alt }, idx) => (
              <div key={src} className="relative rounded-2xl overflow-hidden cursor-pointer group"
                style={{ minHeight: "174px" }} onClick={() => setLightbox(idx + 1)}>
                <Image src={src} alt={alt} fill unoptimized className="object-cover group-hover:scale-[1.04] transition-transform duration-500" />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-300" />
              </div>
            ))}

            {ALL_IMAGES.slice(5).map(({ src, alt }, idx) => (
              <div key={src} className="col-span-2 relative rounded-2xl overflow-hidden cursor-pointer group"
                style={{ minHeight: "240px" }} onClick={() => setLightbox(idx + 5)}>
                <Image src={src} alt={alt} fill unoptimized className="object-cover group-hover:scale-[1.02] transition-transform duration-500" />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-300" />
              </div>
            ))}
          </div>

          <p className="text-center text-[13px] text-gray-400 mt-6">Click any image to enlarge</p>
        </div>
      </section>

      {/* ══════════════════ PROCESS ══════════════════ */}
      <section className="bg-[#F5F7FA] dark:bg-gray-950 py-28 px-6 sm:px-10 lg:px-20">
        <div className="max-w-7xl mx-auto">
          <div className="mb-16">
            <span className={eb}>How it works</span>
            <h2 className={h2}>Simple.<br />Transparent.</h2>
          </div>
          <div className="relative grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {PROCESS_STEPS.map((step, idx) => (
              <div key={step.step} className="relative group">
                {idx < PROCESS_STEPS.length - 1 && (
                  <div className="hidden lg:block absolute top-[52px] left-[calc(100%_-_12px)] w-6 h-[2px] bg-gradient-to-r from-[#2563EB]/30 to-transparent z-10" />
                )}
                <div className={`relative overflow-hidden p-7 rounded-xl ${cardOnGray} h-full group-hover:shadow-[0_4px_24px_rgba(0,0,0,0.07)] dark:group-hover:shadow-[0_4px_24px_rgba(0,0,0,0.4)] transition-all duration-300`}>
                  <div className="pointer-events-none absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                    style={{ background: "radial-gradient(circle at 20% 20%, rgba(37,99,235,0.07) 0%, transparent 65%)" }} />
                  <div className="relative flex items-center gap-4 mb-5">
                    <div className="w-10 h-10 rounded-xl bg-[#2563EB] flex items-center justify-center text-white text-[13px] font-bold flex-shrink-0">
                      {step.step}
                    </div>
                    <span className="text-2xl">{step.icon}</span>
                  </div>
                  <h3 className="relative text-[17px] font-semibold text-gray-900 dark:text-white mb-3">{step.title}</h3>
                  <p className="relative text-[14px] text-gray-500 dark:text-gray-400 leading-relaxed">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════ REPAIR TRACKER CTA ══════════════════ */}
      <section className="bg-white dark:bg-gray-950 py-20 px-6 sm:px-10 lg:px-20">
        <div className="max-w-7xl mx-auto">
          <div className={`rounded-2xl ${cardOnWhite} p-8 sm:p-12 flex flex-col lg:flex-row items-center gap-8`}>
            <div className="flex-1">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 rounded-full px-3 py-1 mb-4">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Live Tracking
              </span>
              <h3 className="text-[28px] sm:text-[36px] font-bold text-gray-900 dark:text-white leading-tight mb-3">
                Track your repair in real-time.
              </h3>
              <p className="text-[15px] text-gray-500 dark:text-gray-400 max-w-md leading-relaxed">
                Every repair is logged in our system. Check the current status of your device — from diagnosis through to ready for pickup.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 flex-shrink-0 w-full lg:w-auto">
              <button onClick={() => setShowContact(true)}
                className="inline-flex items-center justify-center gap-2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-[14px] font-semibold px-6 py-3.5 rounded-lg transition-colors hover:bg-gray-800 dark:hover:bg-gray-100">
                Check Repair Status
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </button>
              <button onClick={() => setShowContact(true)}
                className="inline-flex items-center justify-center gap-2 text-[#2563EB] text-[14px] font-semibold px-6 py-3.5 rounded-lg border border-[#2563EB]/30 hover:bg-[#2563EB]/5 transition-all">
                Book New Repair
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════ TESTIMONIALS ══════════════════ */}
      <section className="bg-[#F5F7FA] dark:bg-gray-950 py-28 px-6 sm:px-10 lg:px-20">
        <div className="max-w-7xl mx-auto">
          <div className="mb-16">
            <span className={eb}>Customer reviews</span>
            <h2 className={h2}>Real repairs,<br />real results.</h2>
          </div>
          {reviews.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-16 h-16 rounded-2xl bg-[#2563EB]/10 flex items-center justify-center text-3xl mx-auto mb-5">⭐</div>
              <p className="text-[17px] font-semibold text-gray-900 dark:text-white mb-2">No reviews yet</p>
              <p className="text-[14px] text-gray-500 dark:text-gray-400">Be the first to share your repair experience!</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {reviews.map((r) => (
                <div key={r.id}
                  className={`p-8 rounded-xl ${cardOnGray} hover:shadow-[0_4px_24px_rgba(0,0,0,0.07)] dark:hover:shadow-[0_4px_24px_rgba(0,0,0,0.4)] transition-all duration-300`}>
                  <div className="flex items-center gap-0.5 mb-5">
                    {Array.from({ length: r.rating || 0 }).map((_, si) => (
                      <svg key={si} className="w-4 h-4 text-amber-400" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                    ))}
                    {Array.from({ length: 5 - (r.rating || 0) }).map((_, si) => (
                      <svg key={`e-${si}`} className="w-4 h-4 text-gray-200 dark:text-gray-700" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                    ))}
                  </div>
                  <p className="text-[16px] text-gray-900 dark:text-white leading-relaxed mb-6 font-medium">
                    &ldquo;{r.message}&rdquo;
                  </p>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-[#2563EB] flex items-center justify-center text-white text-[13px] font-bold flex-shrink-0">
                        {r.name.charAt(0)}
                      </div>
                      <span className="text-[14px] font-semibold text-gray-900 dark:text-white">{r.name}</span>
                    </div>
                    <span className="text-[11px] text-gray-400">
                      {new Date(r.created_at).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ══════════════════ BRANDS ══════════════════ */}
      <section className="bg-white dark:bg-gray-950 py-20 px-6 sm:px-10 lg:px-20 border-y border-gray-100 dark:border-gray-800">
        <div className="max-w-7xl mx-auto">
          <p className={eb + " text-center mb-10"}>Brands we service</p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            {BRANDS.map((brand) => (
              <span key={brand}
                className="px-5 py-2.5 rounded-full bg-[#F5F7FA] dark:bg-gray-800 text-[13px] font-semibold text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white border border-gray-100 dark:border-gray-700 transition-all duration-200 cursor-default">
                {brand}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════ WHY US ══════════════════ */}
      <section className="bg-[#F5F7FA] dark:bg-gray-950 py-28 px-6 sm:px-10 lg:px-20">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <span className={eb}>Why trust us</span>
              <h2 className={h2}>Repairs backed<br />by expertise.</h2>
              <p className="mt-6 text-[17px] text-gray-500 dark:text-gray-400 max-w-md leading-relaxed">
                We&apos;ve been repairing devices across Mauritius for years. Our certified
                technicians treat every device as if it were their own — with care, precision,
                and zero shortcuts.
              </p>
              <button onClick={() => setShowContact(true)}
                className="mt-8 inline-flex items-center gap-2 bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-[15px] font-semibold px-6 py-3 rounded-lg transition-colors shadow-sm">
                Book a Repair
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                { icon: "⚡", title: "Fast Turnaround",    desc: "Most repairs completed same-day. Complex jobs within 24–48 hrs.", color: "rgba(245,158,11,0.12)" },
                { icon: "🛡️", title: "Full Warranty",      desc: "2-year warranty on every repair — parts and labour included.", color: "rgba(16,185,129,0.12)" },
                { icon: "🎓", title: "Certified Techs",    desc: "Trained and experienced on all major brands and device types.", color: "rgba(37,99,235,0.12)" },
                { icon: "🔬", title: "Free Diagnosis",     desc: "We inspect your device at zero cost — honest and transparent.", color: "rgba(14,165,233,0.12)" },
                { icon: "💎", title: "Quality Parts",      desc: "Only quality replacement components for lasting performance.", color: "rgba(139,92,246,0.12)" },
                { icon: "★",  title: "500+ Happy Clients", desc: "Hundreds of satisfied customers trust Tech Ninja every month.", color: "rgba(37,99,235,0.12)" },
              ].map((item) => (
                <div key={item.title}
                  className={`group relative overflow-hidden p-6 rounded-xl ${cardOnGray} hover:shadow-[0_4px_20px_rgba(0,0,0,0.06)] dark:hover:shadow-[0_4px_20px_rgba(0,0,0,0.4)] transition-all duration-300`}>
                  <div className="pointer-events-none absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                    style={{ background: `radial-gradient(circle at 20% 30%, ${item.color} 0%, transparent 65%)` }} />
                  <span className="relative text-2xl block mb-3">{item.icon}</span>
                  <h3 className="relative text-[14px] font-semibold text-gray-900 dark:text-white mb-1.5">{item.title}</h3>
                  <p className="relative text-[13px] text-gray-500 dark:text-gray-400 leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════ FAQ ══════════════════ */}
      <section className="bg-white dark:bg-gray-950 py-28 px-6 sm:px-10 lg:px-20">
        <div className="max-w-4xl mx-auto">
          <div className="mb-16 text-center">
            <span className={eb + " justify-center"}>Got questions?</span>
            <h2 className={h2 + " text-center"}>Frequently asked.</h2>
          </div>
          <div className="space-y-3">
            {FAQS.map((faq, i) => (
              <div key={i}
                className={`rounded-xl border overflow-hidden transition-all duration-300 ${
                  openFaq === i
                    ? "border-[#2563EB]/40 shadow-[0_0_0_3px_rgba(37,99,235,0.08)]"
                    : "border-gray-200 dark:border-gray-700"
                }`}>
                <button className="w-full flex items-center justify-between px-7 py-5 text-left gap-4"
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}>
                  <span className="text-[15px] font-semibold text-gray-900 dark:text-white">{faq.q}</span>
                  <span className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center border transition-all duration-300 ${
                    openFaq === i
                      ? "bg-[#2563EB] border-[#2563EB] rotate-45"
                      : "border-gray-200 dark:border-gray-700"
                  }`}>
                    <svg className={`w-3.5 h-3.5 ${openFaq === i ? "text-white" : "text-gray-400"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                    </svg>
                  </span>
                </button>
                <div className={`overflow-hidden transition-all duration-300 ease-in-out ${openFaq === i ? "max-h-48" : "max-h-0"}`}>
                  <p className="px-7 pb-6 text-[14px] text-gray-500 dark:text-gray-400 leading-relaxed border-t border-gray-100 dark:border-gray-800 pt-4">
                    {faq.a}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-12 text-center">
            <p className="text-[14px] text-gray-500 dark:text-gray-400 mb-4">Still have questions?</p>
            <button onClick={() => setShowContact(true)}
              className="inline-flex items-center gap-2 text-[#2563EB] text-[15px] font-semibold hover:text-[#1D4ED8] transition-colors">
              Contact us directly →
            </button>
          </div>
        </div>
      </section>

      {/* ══════════════════ FOOTER CTA ══════════════════ */}
      <section className="relative bg-gray-950 overflow-hidden py-32 px-6 sm:px-10 lg:px-20">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -top-[30%] -left-[10%] w-[55%] h-[55%] rounded-full"
            style={{ background: "radial-gradient(circle, rgba(37,99,235,0.12) 0%, transparent 65%)", filter: "blur(80px)" }} />
          <div className="absolute -bottom-[20%] -right-[5%] w-[45%] h-[45%] rounded-full"
            style={{ background: "radial-gradient(circle, rgba(37,99,235,0.06) 0%, transparent 65%)", filter: "blur(80px)" }} />
          <div className="absolute inset-0 bg-grid opacity-60" />
        </div>
        <div className="relative max-w-7xl mx-auto">
          <p className="text-[12px] font-semibold tracking-[0.2em] uppercase text-gray-500 mb-8">
            Get your device fixed today
          </p>
          <h2 className="text-[56px] sm:text-[68px] md:text-[80px] font-bold tracking-tight leading-[0.94] max-w-2xl mb-8">
            <span className="text-white">Your device</span><br />
            <span className="gradient-text-blue">deserves better.</span>
          </h2>
          <p className="text-[17px] text-gray-500 mb-12 max-w-sm leading-relaxed">
            Walk in anytime — no appointment needed. Our team is ready to help.
          </p>
          <div className="flex flex-wrap gap-3">
            <button onClick={() => setShowContact(true)}
              className="inline-flex items-center gap-2 bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-[15px] font-semibold px-7 py-3.5 rounded-full transition-colors shadow-[0_0_30px_rgba(37,99,235,0.30)]">
              Book a Repair
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </button>
            <a href="#services"
              className="inline-flex items-center gap-2 bg-white/[0.06] hover:bg-white/10 text-white border border-white/10 hover:border-white/20 text-[15px] font-semibold px-7 py-3.5 rounded-full transition-all backdrop-blur-sm">
              View all services
            </a>
            <button onClick={() => setShowContact(true)}
              className="inline-flex items-center gap-2 text-gray-500 hover:text-white text-[15px] font-semibold px-7 py-3.5 rounded-full transition-colors">
              Contact support →
            </button>
          </div>
        </div>
      </section>

      {/* ══════════════════ LIGHTBOX ══════════════════ */}
      {lightbox !== null && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/85 backdrop-blur-md p-4"
          onClick={() => setLightbox(null)}>
          <div className="relative w-full max-w-4xl max-h-[90vh] rounded-2xl overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}>
            <div className="relative w-full" style={{ aspectRatio: "16/10" }}>
              <Image src={ALL_IMAGES[lightbox].src} alt={ALL_IMAGES[lightbox].alt} fill unoptimized className="object-cover" />
            </div>
            <button className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-black/50 hover:bg-black/70 backdrop-blur-sm text-white rounded-full flex items-center justify-center transition-colors"
              onClick={(e) => { e.stopPropagation(); setLightbox((lightbox - 1 + ALL_IMAGES.length) % ALL_IMAGES.length); }}>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-black/50 hover:bg-black/70 backdrop-blur-sm text-white rounded-full flex items-center justify-center transition-colors"
              onClick={(e) => { e.stopPropagation(); setLightbox((lightbox + 1) % ALL_IMAGES.length); }}>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
            <button className="absolute top-4 right-4 w-8 h-8 bg-black/50 hover:bg-black/70 backdrop-blur-sm text-white rounded-full flex items-center justify-center transition-colors"
              onClick={() => setLightbox(null)}>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-[12px] font-semibold text-white bg-black/50 backdrop-blur-sm px-3 py-1.5 rounded-full">
              {lightbox + 1} / {ALL_IMAGES.length}
            </div>
          </div>
        </div>
      )}

      {showContact && <ContactModal onClose={() => setShowContact(false)} />}
    </main>
  );
}
