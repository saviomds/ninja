"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { supabase } from "@/lib/supabase";

// ── Update these with your real contact details ──────────────────────────────
const PHONE_RAW   = "+23058098080";
const PHONE_DISP  = "+230 5809 8080";
const EMAIL       = "support@techninja.mu";
const WA_URL      = `https://wa.me/23058098080?text=${encodeURIComponent("Hello Tech Ninja, I'd like to inquire about your services.")}`;

interface SocialProfile {
  id: string;
  platform_name: string;
  platform_icon: string;
  profile_link: string;
  username: string;
}

export default function ContactModal({ onClose }: { onClose: () => void }) {
  const [profiles, setProfiles]   = useState<SocialProfile[]>([]);
  const [liked,    setLiked]      = useState(false);
  const [copied,   setCopied]     = useState(false);
  const [visible,  setVisible]    = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
    setLiked(localStorage.getItem("tn-contact-liked") === "1");

    supabase
      .from("social_profiles")
      .select("id, platform_name, platform_icon, profile_link, username")
      .eq("is_active", true)
      .order("platform_name")
      .then(({ data }) => setProfiles(data || []));

    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") handleClose(); };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleClose = () => {
    setVisible(false);
    setTimeout(onClose, 280);
  };

  const toggleLike = () => {
    const next = !liked;
    setLiked(next);
    localStorage.setItem("tn-contact-liked", next ? "1" : "0");
  };

  const copyEmail = () => {
    navigator.clipboard?.writeText(EMAIL).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    });
  };

  const makeHref = (link: string) =>
    link.startsWith("http") ? link : `https://${link}`;

  return (
    <div
      className={`fixed inset-0 z-[200] flex items-end sm:items-center justify-center transition-opacity duration-300 ${visible ? "opacity-100" : "opacity-0"}`}
      onClick={handleClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Card */}
      <div
        className={`relative w-full sm:max-w-sm bg-white dark:bg-[#0d1117] rounded-t-[28px] sm:rounded-3xl shadow-2xl overflow-hidden transition-all duration-300 ease-out ${visible ? "translate-y-0 sm:scale-100" : "translate-y-12 sm:translate-y-0 sm:scale-95"}`}
        onClick={e => e.stopPropagation()}
      >

        {/* ── Header: dark navy ─────────────────────────────────────────────── */}
        <div className="relative bg-gradient-to-br from-[#0b1f3a] via-[#0e2444] to-[#0a1628] px-6 pt-5 pb-14 overflow-hidden select-none">
          {/* Decorative blobs */}
          <div className="absolute -top-8 -right-8 w-40 h-40 bg-blue-500/10 rounded-full pointer-events-none" />
          <div className="absolute -bottom-6 -left-6 w-28 h-28 bg-indigo-500/10 rounded-full pointer-events-none" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-56 h-56 bg-blue-600/[0.04] rounded-full pointer-events-none" />

          {/* Like button */}
          <button
            onClick={toggleLike}
            aria-label={liked ? "Unlike" : "Like"}
            className={`absolute top-4 left-4 w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200 z-10 ${liked ? "bg-red-500/25" : "bg-white/10 hover:bg-red-500/20"}`}
          >
            <svg
              className={`w-4 h-4 transition-transform duration-200 ${liked ? "text-red-400 scale-125" : "text-white/55 hover:text-red-400"}`}
              fill={liked ? "currentColor" : "none"}
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
            </svg>
          </button>

          {/* Close button */}
          <button
            onClick={handleClose}
            aria-label="Close"
            className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white/60 hover:text-white flex items-center justify-center transition-all z-10 text-sm font-bold"
          >
            ✕
          </button>

          {/* Logo */}
          <div className="flex flex-col items-center gap-3 relative z-10 pt-1">
            <div className="w-[72px] h-[72px] rounded-2xl bg-white/10 border border-white/20 shadow-xl flex items-center justify-center animate-float">
              <Image
                src="/logo.png"
                alt="Tech Ninja"
                width={50}
                height={50}
                unoptimized
                className="object-contain"
                style={{ filter: "drop-shadow(0 2px 14px rgba(96,165,250,0.45))" }}
              />
            </div>
            <div className="text-center">
              <h2 className="text-xl font-extrabold text-white tracking-tight">Tech Ninja</h2>
              <p className="text-xs text-blue-300/70 mt-0.5 tracking-wide">
                Your Local Tech Experts · Mauritius
              </p>
            </div>
          </div>
        </div>

        {/* ── Body: white/dark card overlapping header ──────────────────────── */}
        <div className="relative -mt-6 bg-white dark:bg-[#0d1117] rounded-t-3xl">
          {/* Drag handle (mobile UX hint) */}
          <div className="flex justify-center pt-3 pb-1">
            <div className="w-8 h-1 bg-gray-200 dark:bg-gray-700 rounded-full" />
          </div>

          <div className="px-5 pt-3 pb-0 space-y-3.5">

            {/* Phone ─────────────────────────────────────────────────────── */}
            <div className="bg-gray-50 dark:bg-white/[0.03] border border-gray-100 dark:border-white/[0.07] rounded-2xl p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 flex-shrink-0 rounded-xl bg-emerald-100 dark:bg-emerald-500/15 border border-emerald-200 dark:border-emerald-500/20 flex items-center justify-center">
                  <svg className="w-5 h-5 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">Phone</p>
                  <p className="text-base font-bold text-gray-900 dark:text-white tracking-tight">{PHONE_DISP}</p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <a
                  href={`tel:${PHONE_RAW}`}
                  className="flex flex-col items-center gap-1.5 bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white py-2.5 rounded-xl transition-all shadow-sm shadow-emerald-500/30"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                  <span className="text-[11px] font-bold">Call</span>
                </a>

                <a
                  href={`sms:${PHONE_RAW}`}
                  className="flex flex-col items-center gap-1.5 bg-blue-500 hover:bg-blue-600 active:scale-95 text-white py-2.5 rounded-xl transition-all shadow-sm shadow-blue-500/30"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                  </svg>
                  <span className="text-[11px] font-bold">Text</span>
                </a>

                <a
                  href={WA_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex flex-col items-center gap-1.5 bg-[#25D366] hover:bg-[#1ebe5c] active:scale-95 text-white py-2.5 rounded-xl transition-all shadow-sm shadow-green-500/30"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                  </svg>
                  <span className="text-[11px] font-bold">WhatsApp</span>
                </a>
              </div>
            </div>

            {/* Email ──────────────────────────────────────────────────────── */}
            <div className="bg-gray-50 dark:bg-white/[0.03] border border-gray-100 dark:border-white/[0.07] rounded-2xl p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 flex-shrink-0 rounded-xl bg-blue-100 dark:bg-blue-500/15 border border-blue-200 dark:border-blue-500/20 flex items-center justify-center">
                  <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">Email</p>
                  <p className="text-sm font-bold text-gray-900 dark:text-white truncate">{EMAIL}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <a
                  href={`mailto:${EMAIL}`}
                  className="flex items-center justify-center gap-1.5 bg-blue-500 hover:bg-blue-600 active:scale-95 text-white text-xs font-bold py-2.5 rounded-xl transition-all shadow-sm shadow-blue-500/25"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                  Send Email
                </a>
                <button
                  onClick={copyEmail}
                  className={`flex items-center justify-center gap-1.5 text-xs font-bold py-2.5 rounded-xl border transition-all active:scale-95 ${
                    copied
                      ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/30"
                      : "bg-white dark:bg-white/[0.04] text-gray-600 dark:text-gray-300 border-gray-200 dark:border-white/[0.08] hover:border-blue-300 dark:hover:border-blue-500/40"
                  }`}
                >
                  {copied ? (
                    <>
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                      Copied!
                    </>
                  ) : (
                    <>
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      Copy
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Social profiles ────────────────────────────────────────────── */}
            {profiles.length > 0 && (
              <div className="pb-1">
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-2.5">
                  Find us on
                </p>
                <div className="flex flex-wrap gap-2">
                  {profiles.map((p, i) => (
                    <a
                      key={p.id}
                      href={makeHref(p.profile_link)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 bg-gray-100 dark:bg-white/[0.05] hover:bg-indigo-50 dark:hover:bg-indigo-500/10 border border-gray-200 dark:border-white/[0.06] hover:border-indigo-300 dark:hover:border-indigo-500/35 rounded-xl px-3 py-2 text-xs font-semibold text-gray-700 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all active:scale-95"
                      style={{ animationDelay: `${i * 55}ms` }}
                    >
                      {p.platform_icon ? (
                        <Image
                          src={p.platform_icon}
                          alt={p.platform_name}
                          width={16}
                          height={16}
                          unoptimized
                          className="rounded object-cover w-4 h-4"
                        />
                      ) : (
                        <span className="w-4 h-4 bg-gray-300 dark:bg-gray-600 rounded flex items-center justify-center text-[9px] font-bold">
                          {p.platform_name.charAt(0)}
                        </span>
                      )}
                      {p.platform_name}
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ── Footer inside modal ────────────────────────────────────────── */}
          <div className="mt-4 border-t border-gray-100 dark:border-white/[0.05] px-5 py-3.5 bg-gray-50/60 dark:bg-white/[0.015] flex items-center justify-between">
            <span className="text-[11px] text-gray-400 dark:text-gray-600">
              © {new Date().getFullYear()} Tech Ninja
            </span>
            <span className="text-[11px] text-gray-400 dark:text-gray-600 flex items-center gap-1">
              Made with{" "}
              <svg className="w-3 h-3 text-red-400 inline" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
              </svg>{" "}
              in Mauritius 🇲🇺
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
