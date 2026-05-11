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
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { dark, toggle } = useTheme();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data?.user || null));
    const { data: sub } = supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user || null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
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
    { href: "/Clients", label: "Shop" },
    ...(!isAdmin && user ? [{ href: "/client-dashboard", label: "My Dashboard" }] : []),
    ...(isAdmin ? [{ href: "/dashboard", label: "Admin" }] : []),
  ];

  const isActive = (href: string) => pathname === href;

  return (
    <nav className="sticky top-0 z-50 bg-white/90 dark:bg-[#030712]/90 backdrop-blur-xl border-b border-gray-200 dark:border-white/[0.06] shadow-sm dark:shadow-none">
      <div className="max-w-6xl mx-auto px-5 h-16 flex items-center justify-between gap-4">

        {/* Logo */}
        <Link href="/" className="flex items-center gap-3 flex-shrink-0 group">
          <div className="w-9 h-9 bg-gradient-to-br from-[#0b1f3a] to-[#0a1628] border border-blue-500/25 rounded-xl flex items-center justify-center shadow-md group-hover:shadow-blue-900/40 transition-shadow">
            <Image
              src="/logo.png"
              alt="Tech Ninja"
              width={26}
              height={26}
              unoptimized
              className="object-contain"
              style={{ filter: "drop-shadow(0 0 4px rgba(255,255,255,0.2))" }}
            />
          </div>
          <span className="text-base font-bold text-gray-900 dark:text-white tracking-tight">Tech Ninja</span>
        </Link>

        {/* Desktop nav links */}
        <div className="hidden md:flex items-center gap-1 flex-1 justify-center">
          {navLinks.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                isActive(href)
                  ? "bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400"
                  : "text-gray-600 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-white dark:hover:bg-white/[0.06]"
              }`}
            >
              {label}
            </Link>
          ))}
        </div>

        {/* Right side: theme toggle + auth */}
        <div className="flex items-center gap-2 flex-shrink-0">

          {/* Dark mode toggle */}
          <button
            onClick={toggle}
            title={dark ? "Switch to light mode" : "Switch to dark mode"}
            className="w-9 h-9 rounded-lg flex items-center justify-center text-gray-500 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-white dark:hover:bg-white/[0.06] transition-all"
          >
            {dark ? (
              <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            ) : (
              <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
            )}
          </button>

          {/* Auth */}
          {user ? (
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="w-9 h-9 rounded-full bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm flex items-center justify-center transition-colors shadow-sm"
              >
                {user.email?.charAt(0).toUpperCase() || "U"}
              </button>

              {/* Dropdown */}
              <div className={`absolute right-0 mt-2 w-52 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-xl overflow-hidden transition-all duration-150 origin-top-right z-50 ${dropdownOpen ? "opacity-100 scale-100 pointer-events-auto" : "opacity-0 scale-95 pointer-events-none"}`}>
                <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800">
                  <p className="text-[11px] font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide">Signed in as</p>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white truncate mt-0.5">{user.email}</p>
                </div>
                {!isAdmin && (
                  <Link href="/client-dashboard" onClick={() => setDropdownOpen(false)} className="flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                    <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>
                    My Dashboard
                  </Link>
                )}
                <Link href="/Clients" onClick={() => setDropdownOpen(false)} className="flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                  <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" /></svg>
                  Shop
                </Link>
                {isAdmin && (
                  <Link href="/dashboard" onClick={() => setDropdownOpen(false)} className="flex items-center gap-2 px-4 py-2.5 text-sm text-violet-600 dark:text-violet-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                    Admin Dashboard
                  </Link>
                )}
                <div className="border-t border-gray-100 dark:border-gray-800">
                  <button onClick={handleSignOut} className="flex items-center gap-2 w-full px-4 py-2.5 text-sm text-red-500 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                    Sign out
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <Link href="/login" className="text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg transition-colors shadow-sm">
              Sign in
            </Link>
          )}

          {/* Mobile hamburger */}
          <button
            className="md:hidden w-9 h-9 rounded-lg flex items-center justify-center text-gray-500 hover:bg-gray-100 dark:hover:bg-white/[0.06] transition-all"
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              {mobileOpen
                ? <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                : <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />}
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden border-t border-gray-200 dark:border-white/[0.06] bg-white dark:bg-[#030712] px-5 py-4 flex flex-col gap-1">
          {navLinks.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setMobileOpen(false)}
              className={`px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                isActive(href)
                  ? "bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400"
                  : "text-gray-600 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-white/[0.04]"
              }`}
            >
              {label}
            </Link>
          ))}
          <div className="border-t border-gray-100 dark:border-white/[0.06] mt-2 pt-3 flex items-center justify-between">
            {user ? (
              <>
                <p className="text-xs text-gray-400 truncate max-w-[180px]">{user.email}</p>
                <button onClick={handleSignOut} className="text-xs text-red-500 font-medium hover:text-red-600">Sign out</button>
              </>
            ) : (
              <Link href="/login" onClick={() => setMobileOpen(false)} className="w-full text-center bg-blue-600 text-white text-sm font-semibold py-2.5 rounded-lg hover:bg-blue-700 transition-colors">
                Sign in
              </Link>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
