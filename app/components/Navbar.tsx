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
    ...(!isAdmin && user ? [{ href: "/client-dashboard", label: "Dashboard" }] : []),
    ...(user ? [{ href: "/chat", label: "Chat" }] : []),
    ...(isAdmin ? [{ href: "/dashboard", label: "Admin" }] : []),
  ];

  const isActive = (href: string) => pathname === href;


  const navBg = "bg-black border-b border-white/[0.08]";

  const textColor = "text-white";
  const mutedColor = "text-zinc-400";
  const hoverBg = "hover:bg-white/[0.08]";

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${navBg}`}>
      <div className="max-w-6xl mx-auto px-5 h-14 flex items-center justify-between gap-4">

        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 flex-shrink-0 group">
          <div className="w-8 h-8 rounded-lg overflow-hidden flex items-center justify-center bg-white/10 group-hover:bg-white/15 transition-colors">
            <Image
              src="/logo.png"
              alt="Tech Ninja"
              width={24}
              height={24}
              unoptimized
              className="object-contain"
            />
          </div>
          <span className={`text-sm font-semibold tracking-tight ${textColor}`}>Tech Ninja</span>
        </Link>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-1 flex-1 justify-center">
          {navLinks.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                isActive(href)
                  ? "bg-white/10 text-white"
                  : `${mutedColor} ${hoverBg} hover:text-white`
              }`}
            >
              {label}
            </Link>
          ))}
        </div>

        {/* Right: theme + auth */}
        <div className="flex items-center gap-2 flex-shrink-0">

          {/* Dark mode toggle */}
          <button
            onClick={toggle}
            title={dark ? "Switch to light mode" : "Switch to dark mode"}
            className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${mutedColor} ${hoverBg} hover:text-white`}
          >
            {dark ? (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
            )}
          </button>

          {/* Auth */}
          {user ? (
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="w-8 h-8 rounded-full overflow-hidden ring-2 ring-white/20 hover:ring-white/40 transition-all flex-shrink-0"
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
              <div className={`absolute right-0 mt-3 w-52 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl overflow-hidden transition-all duration-150 origin-top-right z-50 ${dropdownOpen ? "opacity-100 scale-100 pointer-events-auto" : "opacity-0 scale-95 pointer-events-none"}`}>
                <div className="px-4 py-3 border-b border-zinc-100 dark:border-zinc-800">
                  <p className="text-[11px] font-medium text-zinc-400 uppercase tracking-wide">Signed in as</p>
                  <p className="text-sm font-semibold text-zinc-900 dark:text-white truncate mt-0.5">{displayName || user.email?.split("@")[0]}</p>
                  <p className="text-[11px] text-zinc-400 truncate">{user.email}</p>
                </div>
                {[
                  { href: "/profile", label: "My Profile" },
                  ...(!isAdmin ? [{ href: "/client-dashboard", label: "My Dashboard" }] : []),
                  { href: "/Clients", label: "Shop" },
                  { href: "/chat", label: "Messages" },
                  ...(isAdmin ? [{ href: "/dashboard", label: "Admin Dashboard" }] : []),
                ].map(({ href, label }) => (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setDropdownOpen(false)}
                    className="flex items-center px-4 py-2.5 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                  >
                    {label}
                  </Link>
                ))}
                <div className="border-t border-zinc-100 dark:border-zinc-800">
                  <button
                    onClick={handleSignOut}
                    className="flex items-center w-full px-4 py-2.5 text-sm text-red-500 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                  >
                    Sign out
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <Link
              href="/login"
              className="text-xs font-semibold text-black bg-white px-4 py-2 rounded-full hover:bg-zinc-100 transition-colors"
            >
              Sign in
            </Link>
          )}

          {/* Mobile hamburger */}
          <button
            className={`md:hidden w-8 h-8 rounded-full flex items-center justify-center transition-all ${mutedColor} ${hoverBg}`}
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              {mobileOpen
                ? <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                : <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />}
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mounted && (
        <div className={`md:hidden overflow-hidden transition-all duration-300 ease-in-out ${mobileOpen ? "max-h-[500px] opacity-100" : "max-h-0 opacity-0"}`}>
          <div className="bg-black/95 backdrop-blur-xl border-t border-white/[0.06] px-4 pt-3 pb-5">
            <div className="flex flex-col gap-0.5 mb-4">
              {navLinks.map(({ href, label }) => (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setMobileOpen(false)}
                  className={`px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                    isActive(href)
                      ? "bg-white/10 text-white"
                      : "text-zinc-400 hover:text-white hover:bg-white/[0.06]"
                  }`}
                >
                  {label}
                </Link>
              ))}
            </div>

            <div className="border-t border-white/[0.06] pt-4">
              {user ? (
                <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/[0.04]">
                  <div className="w-8 h-8 rounded-full overflow-hidden ring-2 ring-white/20 flex-shrink-0">
                    {avatarUrl ? (
                      <Image src={avatarUrl} alt="avatar" width={32} height={32} unoptimized className="object-cover w-full h-full" />
                    ) : (
                      <span className="w-full h-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center">
                        {(displayName || user.email || "U").charAt(0).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{displayName || user.email?.split("@")[0]}</p>
                    <p className="text-[11px] text-zinc-500 truncate">{user.email}</p>
                  </div>
                  <button onClick={handleSignOut} className="text-xs text-red-400 font-medium hover:text-red-300 transition-colors flex-shrink-0">
                    Sign out
                  </button>
                </div>
              ) : (
                <Link
                  href="/login"
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center justify-center w-full bg-white text-black text-sm font-semibold py-3.5 rounded-xl hover:bg-zinc-100 transition-colors"
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
