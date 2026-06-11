"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter, usePathname } from "next/navigation";
import { User } from "@supabase/supabase-js";
import { useTheme } from "./ThemeProvider";

export default function Navbar() {
  const [user, setUser] = useState<User | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { dark, toggle } = useTheme();
  const router = useRouter();
  const pathname = usePathname();

  const fetchProfile = async (uid: string, email: string) => {
    const { data } = await supabase.from("profiles").select("avatar_url, username").eq("id", uid).single();
    if (data?.avatar_url) setAvatarUrl(data.avatar_url);
    setDisplayName(data?.username || email.split("@")[0]);
  };

  useEffect(() => {
    setMounted(true);
    supabase.auth.getUser().then(({ data }) => {
      const u = data?.user || null;
      setUser(u);
      if (u) fetchProfile(u.id, u.email || "");
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_, session) => {
      const u = session?.user || null;
      setUser(u);
      if (u) fetchProfile(u.id, u.email || "");
      else { setAvatarUrl(null); setDisplayName(null); }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node))
        setDropdownOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    const onScroll = () => { if (mobileOpen) setMobileOpen(false); };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [mobileOpen]);

  const isAdmin = (user?.app_metadata?.role || user?.user_metadata?.role) === "admin";

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setDropdownOpen(false);
    setMobileOpen(false);
    router.push("/login");
  };

  const navLinks = [
    { href: "/", label: "Home" },
    { href: "/repair", label: "Repair" },
    { href: "/Clients", label: "Shop" },
    ...(!isAdmin && user ? [{ href: "/client-dashboard", label: "Dashboard" }] : []),
    ...(user ? [{ href: "/chat", label: "Chat" }] : []),
    ...(isAdmin ? [{ href: "/dashboard", label: "Admin" }] : []),
  ];

  const isActive = (href: string) => pathname === href;

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-2xl border-b border-gray-200/70">

      <div className="max-w-6xl mx-auto px-5 h-16 flex items-center justify-between gap-4">

        {/* ── Logo ── */}
        <Link href="/" className="flex items-center gap-3 flex-shrink-0 group">
          {/* Logo tile with RGB glow */}
          <div
            className="w-11 h-11 rounded-[13px] overflow-hidden bg-zinc-900 border border-zinc-700 flex items-center justify-center flex-shrink-0 transition-all duration-300"
          >
            <Image
              src="/logo.png"
              alt="Tech Ninja"
              width={34}
              height={34}
              unoptimized
              className="object-contain scale-90"
            />
          </div>

          {/* Wordmark */}
          <div className="flex flex-col leading-none">
            <span className="text-[15px] font-extrabold tracking-tight text-gray-900">
              Tech <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-500 to-violet-500">Ninja</span>
            </span>
            <span className="text-[9px] font-semibold tracking-[0.2em] uppercase text-gray-400 mt-0.5">Mauritius</span>
          </div>
        </Link>

        {/* ── Desktop nav ── */}
        <div className="hidden md:flex items-center gap-0.5 flex-1 justify-center">
          {navLinks.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className={`relative px-3.5 py-2 rounded-lg text-sm font-medium transition-all duration-150 ${
                isActive(href)
                  ? "text-blue-600 bg-blue-50"
                  : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
              }`}
            >
              {label}
              {isActive(href) && (
                <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-3 h-[2px] rounded-full bg-blue-600" />
              )}
            </Link>
          ))}
        </div>

        {/* ── Right side ── */}
        <div className="flex items-center gap-1.5 flex-shrink-0">

          {/* Theme toggle */}
          <button
            onClick={toggle}
            title={dark ? "Light mode" : "Dark mode"}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-all"
          >
            {dark ? (
              <svg className="w-[15px] h-[15px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            ) : (
              <svg className="w-[15px] h-[15px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
            )}
          </button>

          {/* ── Auth ── */}
          {user ? (
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="w-8 h-8 rounded-full overflow-hidden ring-2 ring-white/15 hover:ring-blue-500/50 transition-all flex-shrink-0"
              >
                {avatarUrl ? (
                  <Image src={avatarUrl} alt="avatar" width={32} height={32} unoptimized className="object-cover w-full h-full" />
                ) : (
                  <span className="w-full h-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center">
                    {(displayName || user.email || "U").charAt(0).toUpperCase()}
                  </span>
                )}
              </button>

              {/* Dropdown */}
              <div className={`absolute right-0 mt-2.5 w-56 bg-white border border-gray-200 rounded-2xl shadow-2xl shadow-black/20 overflow-hidden transition-all duration-150 origin-top-right z-50 ${
                dropdownOpen ? "opacity-100 scale-100 pointer-events-auto" : "opacity-0 scale-95 pointer-events-none"
              }`}>
                {/* Header */}
                <div className="px-4 py-3.5 border-b border-gray-100">
                  <div className="flex items-center gap-2.5 mb-2">
                    <div className="w-7 h-7 rounded-full overflow-hidden ring-1 ring-white/20 flex-shrink-0">
                      {avatarUrl ? (
                        <Image src={avatarUrl} alt="avatar" width={28} height={28} unoptimized className="object-cover w-full h-full" />
                      ) : (
                        <span className="w-full h-full bg-emerald-600 text-white font-bold text-[10px] flex items-center justify-center">
                          {(displayName || user.email || "U").charAt(0).toUpperCase()}
                        </span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-[13px] font-semibold text-gray-900 truncate">{displayName || user.email?.split("@")[0]}</p>
                      <p className="text-[10px] text-gray-500 truncate">{user.email}</p>
                    </div>
                  </div>
                  {isAdmin && (
                    <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-widest text-violet-400 border border-violet-500/30 bg-violet-500/10 px-2 py-0.5 rounded-full">
                      Admin
                    </span>
                  )}
                </div>

                <div className="py-1.5">
                  {[
                    { href: "/profile", label: "My Profile", icon: "M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" },
                    ...(!isAdmin ? [{ href: "/client-dashboard", label: "Dashboard", icon: "M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" }] : []),
                    { href: "/Clients", label: "Shop", icon: "M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" },
                    { href: "/chat", label: "Messages", icon: "M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" },
                    ...(isAdmin ? [{ href: "/dashboard", label: "Admin Dashboard", icon: "M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0H3" }] : []),
                  ].map(({ href, label, icon }) => (
                    <Link
                      key={href}
                      href={href}
                      onClick={() => setDropdownOpen(false)}
                      className="flex items-center gap-3 px-4 py-2 text-[13px] text-gray-600 hover:text-gray-900 hover:bg-gray-50 transition-colors"
                    >
                      <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d={icon} />
                      </svg>
                      {label}
                    </Link>
                  ))}
                </div>

                <div className="border-t border-gray-100 py-1.5">
                  <button
                    onClick={handleSignOut}
                    className="flex items-center gap-3 w-full px-4 py-2 text-[13px] text-red-500 hover:text-red-600 hover:bg-red-50 transition-colors"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
                    </svg>
                    Sign out
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <Link
              href="/login"
              className="text-[12px] font-semibold text-white bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-xl transition-colors active:scale-95"
            >
              Sign in
            </Link>
          )}

          {/* Mobile hamburger */}
          <button
            className="md:hidden w-8 h-8 rounded-lg flex items-center justify-center text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-all"
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              {mobileOpen
                ? <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                : <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />}
            </svg>
          </button>
        </div>
      </div>

      {/* ── Mobile menu ── */}
      {mounted && (
        <div className={`md:hidden overflow-hidden transition-all duration-300 ease-in-out ${mobileOpen ? "max-h-[520px] opacity-100" : "max-h-0 opacity-0"}`}>
          <div className="bg-white/95 backdrop-blur-2xl border-t border-gray-200 px-4 pt-4 pb-6">

            {/* Emerald accent top bar */}
            <div className="h-[1px] w-12 bg-gradient-to-r from-blue-400 to-violet-400 rounded-full mb-5 mx-auto" />

            <div className="flex flex-col gap-0.5 mb-5">
              {navLinks.map(({ href, label }) => (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setMobileOpen(false)}
                  className={`flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                    isActive(href)
                      ? "bg-blue-50 text-blue-600"
                      : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                  }`}
                >
                  {label}
                  {isActive(href) && (
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-600 flex-shrink-0" />
                  )}
                </Link>
              ))}
            </div>

            <div className="border-t border-gray-200 pt-4">
              {user ? (
                <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-gray-50 border border-gray-200">
                  <div className="w-9 h-9 rounded-full overflow-hidden ring-2 ring-blue-500/30 flex-shrink-0">
                    {avatarUrl ? (
                      <Image src={avatarUrl} alt="avatar" width={36} height={36} unoptimized className="object-cover w-full h-full" />
                    ) : (
                      <span className="w-full h-full bg-emerald-600 text-white font-bold text-sm flex items-center justify-center">
                        {(displayName || user.email || "U").charAt(0).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{displayName || user.email?.split("@")[0]}</p>
                    <p className="text-[11px] text-gray-500 truncate">{user.email}</p>
                  </div>
                  <button onClick={handleSignOut} className="text-[11px] text-red-500 font-semibold hover:text-red-600 transition-colors flex-shrink-0">
                    Sign out
                  </button>
                </div>
              ) : (
                <Link
                  href="/login"
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center justify-center w-full bg-blue-600 text-white text-sm font-semibold py-3.5 rounded-xl hover:bg-blue-500 transition-colors active:scale-95"
                >
                  Sign in
                </Link>
              )}
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
