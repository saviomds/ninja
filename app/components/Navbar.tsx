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
  const [shopOpen, setShopOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [cartCount] = useState(0);
  const [wishlistCount, setWishlistCount] = useState(0);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const shopRef = useRef<HTMLLIElement>(null);
  const { dark, toggle } = useTheme();
  const router = useRouter();
  const pathname = usePathname();

  const fetchProfile = async (uid: string, email: string) => {
    const { data } = await supabase.from("profiles").select("avatar_url, username").eq("id", uid).single();
    if (data?.avatar_url) setAvatarUrl(data.avatar_url);
    setDisplayName(data?.username || email.split("@")[0]);
  };

  useEffect(() => {
    const readWishlist = () => {
      try {
        const raw = localStorage.getItem("tn-wishlist");
        setWishlistCount(raw ? JSON.parse(raw).length : 0);
      } catch { setWishlistCount(0); }
    };
    readWishlist();
    window.addEventListener("storage", readWishlist);
    return () => window.removeEventListener("storage", readWishlist);
  }, []);

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
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setDropdownOpen(false);
      if (shopRef.current && !shopRef.current.contains(e.target as Node)) setShopOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 12);
      if (mobileOpen) setMobileOpen(false);
    };
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

  const isActive = (href: string) => pathname === href;

  const shopLinks = [
    { href: "/Clients",  label: "All Products" },
    { href: "/repair",   label: "Repair Services" },
    { href: "/#deals",   label: "Deals & Offers" },
  ];

  const navLinks = [
    { href: "/",             label: "Home" },
    { href: "/repair",       label: "Repair" },
    { href: "/#services",    label: "About Us" },
    { href: "/#newsletter",  label: "News" },
    { href: "/#footer",      label: "Contact Us" },
  ];

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 bg-white dark:bg-gray-950 border-b border-gray-100 dark:border-gray-800 transition-shadow duration-300 ${
        scrolled ? "shadow-[0_2px_12px_rgba(0,0,0,0.08)]" : ""
      }`}
    >
      <div className="max-w-7xl mx-auto px-5 lg:px-8">
        <div className="flex items-center justify-between h-16">

          {/* ── Logo ── */}
          <Link href="/" className="flex items-center gap-2.5 flex-shrink-0 group">
            <div className="w-9 h-9 rounded-[10px] bg-black flex items-center justify-center shadow-sm overflow-hidden">
              <Image src="/logo.png" alt="Tech Ninja" width={26} height={26} unoptimized className="object-contain" />
            </div>
            <div className="flex flex-col leading-none">
              <span className="text-[15px] font-black tracking-tight text-gray-900 dark:text-white">
                Tech<span className="text-[#2563EB]">Ninja</span>
              </span>
              <span className="text-[9px] font-semibold tracking-[0.2em] uppercase text-gray-400 mt-[2px]">Mauritius</span>
            </div>
          </Link>

          {/* ── Desktop nav ── */}
          <ul className="hidden md:flex items-center gap-0.5">
            <li>
              <Link
                href="/"
                className={`px-3.5 py-2 rounded-lg text-[13.5px] font-medium transition-all ${
                  isActive("/")
                    ? "text-[#2563EB] bg-blue-50 dark:bg-blue-900/20"
                    : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-800"
                }`}
              >
                Home
              </Link>
            </li>

            {/* Shop dropdown */}
            <li className="relative" ref={shopRef}>
              <button
                onClick={() => setShopOpen((p) => !p)}
                className={`flex items-center gap-1 px-3.5 py-2 rounded-lg text-[13.5px] font-medium transition-all ${
                  isActive("/Clients")
                    ? "text-[#2563EB] bg-blue-50 dark:bg-blue-900/20"
                    : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-800"
                }`}
              >
                Shop
                <svg className={`w-3.5 h-3.5 transition-transform ${shopOpen ? "rotate-180" : ""}`} viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" />
                </svg>
              </button>
              {shopOpen && (
                <div className="absolute top-full left-0 mt-1.5 w-48 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl shadow-[0_8px_24px_rgba(0,0,0,0.10)] py-1.5 z-50">
                  {shopLinks.map((l) => (
                    <Link
                      key={l.href}
                      href={l.href}
                      onClick={() => setShopOpen(false)}
                      className="block px-4 py-2.5 text-[13px] text-gray-600 dark:text-gray-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:text-[#2563EB] transition-colors"
                    >
                      {l.label}
                    </Link>
                  ))}
                </div>
              )}
            </li>

            {[
              { href: "/repair",      label: "Repair" },
              { href: "/#services",   label: "About Us" },
              { href: "/#newsletter", label: "News" },
              { href: "/#footer",     label: "Contact Us" },
            ].map(({ href, label }) => (
              <li key={href}>
                <Link
                  href={href}
                  className="px-3.5 py-2 rounded-lg text-[13.5px] font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-800 transition-all"
                >
                  {label}
                </Link>
              </li>
            ))}

            {user && !isAdmin && (
              <li>
                <Link
                  href="/client-dashboard"
                  className={`px-3.5 py-2 rounded-lg text-[13.5px] font-medium transition-all ${
                    isActive("/client-dashboard")
                      ? "text-[#2563EB] bg-blue-50 dark:bg-blue-900/20"
                      : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-800"
                  }`}
                >
                  Dashboard
                </Link>
              </li>
            )}
            {isAdmin && (
              <li>
                <Link
                  href="/dashboard"
                  className="px-3.5 py-2 rounded-lg text-[13.5px] font-medium text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-all"
                >
                  Admin
                </Link>
              </li>
            )}
          </ul>

          {/* ── Right icons ── */}
          <div className="flex items-center gap-1">

            {/* Search */}
            <button
              className="hidden sm:flex w-9 h-9 items-center justify-center rounded-lg text-gray-500 dark:text-gray-400 hover:text-[#2563EB] hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all"
              title="Search"
            >
              <svg className="w-[17px] h-[17px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <circle cx="11" cy="11" r="8" /><path strokeLinecap="round" strokeLinejoin="round" d="m21 21-4.35-4.35" />
              </svg>
            </button>

            {/* Wishlist */}
            <Link
              href="/wishlist"
              className="relative w-9 h-9 flex items-center justify-center rounded-lg text-gray-500 dark:text-gray-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-all"
              title="My Wishlist"
            >
              <svg className="w-[17px] h-[17px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
              </svg>
              {wishlistCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                  {wishlistCount > 9 ? "9+" : wishlistCount}
                </span>
              )}
            </Link>

            {/* Cart */}
            <Link
              href="/Clients"
              className="relative w-9 h-9 flex items-center justify-center rounded-lg text-gray-500 dark:text-gray-400 hover:text-[#2563EB] hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all"
              title="Shop"
            >
              <svg className="w-[17px] h-[17px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" />
              </svg>
              {cartCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-[#2563EB] text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                  {cartCount}
                </span>
              )}
            </Link>

            {/* Theme toggle */}
            <button
              onClick={toggle}
              title={dark ? "Light mode" : "Dark mode"}
              className="w-9 h-9 rounded-lg flex items-center justify-center text-gray-500 dark:text-gray-400 hover:text-[#2563EB] hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all"
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

            {/* Auth */}
            {user ? (
              <div className="relative ml-1" ref={dropdownRef}>
                <button
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  className="w-8 h-8 rounded-full overflow-hidden ring-2 ring-transparent hover:ring-[#2563EB]/40 transition-all flex-shrink-0"
                >
                  {avatarUrl ? (
                    <Image src={avatarUrl} alt="avatar" width={32} height={32} unoptimized className="object-cover w-full h-full" />
                  ) : (
                    <span className="w-full h-full bg-gradient-to-br from-[#2563EB] to-[#60A5FA] text-white font-bold text-xs flex items-center justify-center">
                      {(displayName || user.email || "U").charAt(0).toUpperCase()}
                    </span>
                  )}
                </button>

                {/* Dropdown */}
                <div
                  className={`absolute right-0 mt-2 w-56 rounded-xl overflow-hidden shadow-[0_8px_32px_rgba(0,0,0,0.12)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.5)] border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 transition-all duration-200 origin-top-right z-50 ${
                    dropdownOpen ? "opacity-100 scale-100 pointer-events-auto" : "opacity-0 scale-95 pointer-events-none"
                  }`}
                >
                  <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800">
                    <p className="text-[13px] font-semibold text-gray-900 dark:text-white truncate">{displayName || user.email?.split("@")[0]}</p>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate">{user.email}</p>
                    {isAdmin && (
                      <span className="inline-flex items-center gap-1 mt-1.5 text-[9px] font-bold uppercase tracking-widest text-purple-600 dark:text-purple-400 border border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-900/20 px-2 py-0.5 rounded-full">
                        ✦ Admin
                      </span>
                    )}
                  </div>
                  <div className="py-1.5">
                    {[
                      { href: "/profile",          label: "My Profile" },
                      ...(!isAdmin ? [{ href: "/profile#orders", label: "My Orders" }] : []),
                      { href: "/wishlist",          label: "My Wishlist" },
                      { href: "/Clients",           label: "Browse Shop" },
                      { href: "/chat",              label: "Messages" },
                      ...(isAdmin ? [{ href: "/dashboard", label: "Admin Dashboard" }] : []),
                    ].map(({ href, label }) => (
                      <Link
                        key={href}
                        href={href}
                        onClick={() => setDropdownOpen(false)}
                        className="block px-4 py-2.5 text-[13px] text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                      >
                        {label}
                      </Link>
                    ))}
                  </div>
                  <div className="border-t border-gray-100 dark:border-gray-800 py-1.5">
                    <button
                      onClick={handleSignOut}
                      className="block w-full text-left px-4 py-2.5 text-[13px] text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors"
                    >
                      Sign out
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <Link
                href="/login"
                className="ml-1 px-4 py-2 text-[13px] font-semibold text-white bg-[#2563EB] hover:bg-[#1D4ED8] rounded-lg transition-all active:scale-95 shadow-sm"
              >
                Log In
              </Link>
            )}

            {/* Mobile hamburger */}
            <button
              className="md:hidden ml-1 w-9 h-9 flex items-center justify-center rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all"
              onClick={() => setMobileOpen(!mobileOpen)}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                {mobileOpen
                  ? <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  : <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />}
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* ── Mobile menu ── */}
      {mounted && (
        <div className={`md:hidden overflow-hidden transition-all duration-300 ease-in-out ${mobileOpen ? "max-h-[500px] opacity-100" : "max-h-0 opacity-0"}`}>
          <div className="bg-white dark:bg-gray-950 border-t border-gray-100 dark:border-gray-800 px-4 pt-3 pb-5">
            <div className="flex flex-col gap-0.5 mb-4">
              {[
                { href: "/",                label: "Home" },
                { href: "/Clients",         label: "Shop" },
                { href: "/wishlist",        label: "Wishlist" },
                { href: "/repair",          label: "Repair" },
                { href: "/#services",       label: "About Us" },
                { href: "/#newsletter",     label: "News" },
                { href: "/#footer",         label: "Contact Us" },
                ...(user && !isAdmin ? [{ href: "/profile", label: "My Orders" }] : []),
                ...(user ? [{ href: "/chat", label: "Messages" }] : []),
                ...(isAdmin ? [{ href: "/dashboard", label: "Admin" }] : []),
              ].map(({ href, label }) => (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setMobileOpen(false)}
                  className={`flex items-center px-3 py-2.5 rounded-lg text-[14px] font-medium transition-all ${
                    isActive(href)
                      ? "bg-blue-50 dark:bg-blue-900/20 text-[#2563EB]"
                      : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-800"
                  }`}
                >
                  {label}
                </Link>
              ))}
            </div>
            <div className="border-t border-gray-100 dark:border-gray-800 pt-3">
              {user ? (
                <div className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0">
                      {avatarUrl ? (
                        <Image src={avatarUrl} alt="avatar" width={32} height={32} unoptimized className="object-cover w-full h-full" />
                      ) : (
                        <span className="w-full h-full bg-gradient-to-br from-[#2563EB] to-[#60A5FA] text-white font-bold text-sm flex items-center justify-center">
                          {(displayName || user.email || "U").charAt(0).toUpperCase()}
                        </span>
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900 dark:text-white truncate max-w-[140px]">{displayName || user.email?.split("@")[0]}</p>
                    </div>
                  </div>
                  <button onClick={handleSignOut} className="text-[12px] text-red-500 font-semibold">
                    Sign out
                  </button>
                </div>
              ) : (
                <Link
                  href="/login"
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center justify-center w-full bg-[#2563EB] text-white text-sm font-semibold py-3 rounded-lg hover:bg-[#1D4ED8] transition-all active:scale-95"
                >
                  Log In
                </Link>
              )}
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
