"use client";

import Link from "next/link";
import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter, usePathname } from "next/navigation";
import { User } from "@supabase/supabase-js";

export default function Navbar() {
  const [user, setUser] = useState<User | null>(null);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const mobileMenuRef = useRef<HTMLElement>(null);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // Initial fetch
    const getUser = async () => {
      const { data } = await supabase.auth.getUser();
      setUser(data?.user || null);
    };
    getUser();

    // Listen for auth changes (login, logout, token refresh)
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user || null);
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsProfileOpen(false);
      }
      if (mobileMenuRef.current && !mobileMenuRef.current.contains(event.target as Node)) {
        setIsMobileMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Close mobile menu on scroll
  useEffect(() => {
    const handleScroll = () => {
      if (isMobileMenuOpen) setIsMobileMenuOpen(false);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [isMobileMenuOpen]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setIsProfileOpen(false);
    router.push("/login");
  };

  return (
    <nav ref={mobileMenuRef} className="w-full border-b bg-gray-950 border-gray-800 relative z-20">
      <div className="max-w-6xl mx-auto px-4 py-3 flex justify-between items-center">
        
        {/* Logo */}
        <h1 className="font-bold text-xl text-white tracking-tight">Tech Ninja</h1>

        {/* Desktop Links */}
        <div className="hidden md:flex items-center gap-2">
          <Link href="/" className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${pathname === '/' ? 'bg-gray-800 text-white' : 'text-gray-300 hover:text-white hover:bg-gray-800/50'}`}>
            Home
          </Link>
          <Link href="/explore" className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${pathname === '/explore' ? 'bg-gray-800 text-white' : 'text-gray-300 hover:text-white hover:bg-gray-800/50'}`}>
            Explore
          </Link>
          <Link href="/how-it-works" className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${pathname === '/how-it-works' ? 'bg-gray-800 text-white' : 'text-gray-300 hover:text-white hover:bg-gray-800/50'}`}>
            How it works
          </Link>
        </div>

        {/* Desktop Auth */}
        <div className="hidden md:flex items-center gap-3">
          {user ? (
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setIsProfileOpen(!isProfileOpen)}
                className="w-9 h-9 flex items-center justify-center bg-indigo-600 text-white rounded-full font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-gray-950 transition-all hover:bg-indigo-700"
              >
                {user.email?.charAt(0).toUpperCase() || "U"}
              </button>

              {/* Dropdown Menu */}
              <div 
                className={`absolute right-0 mt-2 w-48 bg-gray-900 border border-gray-800 rounded-xl shadow-2xl py-1 z-50 transition-all duration-200 ease-out origin-top-right ${
                  isProfileOpen ? "opacity-100 scale-100 pointer-events-auto" : "opacity-0 scale-95 pointer-events-none"
                }`}
              >
                  <div className="px-4 py-3 border-b border-gray-800 mb-1">
                    <p className="text-xs text-gray-400">Signed in as</p>
                    <p className="text-sm font-medium text-white truncate">{user.email}</p>
                  </div>
                  <Link
                    href="/"
                    onClick={() => setIsProfileOpen(false)}
                    className="block px-4 py-2 text-sm text-gray-300 hover:bg-gray-800 hover:text-white transition-colors"
                  >
                    Home
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="block w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-gray-800 hover:text-red-300 transition-colors"
                  >
                    Logout
                  </button>
              </div>
            </div>
          ) : (
            <>
              <Link href="/login" className="text-sm font-medium text-white hover:text-gray-300 transition-colors">Login</Link>
              <Link href="/login" className="bg-white text-black px-4 py-1.5 rounded-md text-sm hover:bg-gray-200 transition-colors">
                Sign Up
              </Link>
            </>
          )}
        </div>

        {/* Mobile Hamburger Button */}
        <button 
          className="md:hidden text-gray-400 hover:text-white focus:outline-none p-1"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        >
          {isMobileMenuOpen ? (
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-7 h-7">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-7 h-7">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
            </svg>
          )}
        </button>
      </div>

      {/* Mobile Dropdown Menu */}
      {isMobileMenuOpen && (
        <div className="md:hidden absolute top-full left-0 w-full bg-gray-900 border-b border-gray-800 flex flex-col shadow-2xl z-50">
          <div className="flex flex-col p-6 gap-2">
            <Link href="/" onClick={() => setIsMobileMenuOpen(false)} className={`px-4 py-2 rounded-md text-base font-medium transition-colors ${pathname === '/' ? 'bg-gray-800 text-white' : 'text-gray-300 hover:text-white hover:bg-gray-800/50'}`}>Home</Link>
            <Link href="/explore" onClick={() => setIsMobileMenuOpen(false)} className={`px-4 py-2 rounded-md text-base font-medium transition-colors ${pathname === '/explore' ? 'bg-gray-800 text-white' : 'text-gray-300 hover:text-white hover:bg-gray-800/50'}`}>Explore</Link>
            <Link href="/how-it-works" onClick={() => setIsMobileMenuOpen(false)} className={`px-4 py-2 rounded-md text-base font-medium transition-colors ${pathname === '/how-it-works' ? 'bg-gray-800 text-white' : 'text-gray-300 hover:text-white hover:bg-gray-800/50'}`}>How it works</Link>
            
            <hr className="border-gray-800 my-3" />
            
            {user ? (
              <div className="flex flex-col gap-4">
                <p className="text-sm text-gray-400 truncate">Signed in as <span className="text-white font-medium">{user.email}</span></p>
                <Link href="/dashboard" onClick={() => setIsMobileMenuOpen(false)} className="text-base font-medium text-indigo-400 hover:text-indigo-300 transition-colors">Dashboard</Link>
                <button onClick={() => { handleLogout(); setIsMobileMenuOpen(false); }} className="w-full text-left text-base font-medium text-red-400 hover:text-red-300 transition-colors">Logout</button>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                <Link href="/login" onClick={() => setIsMobileMenuOpen(false)} className="text-base font-medium text-gray-300 hover:text-white transition-colors">Login</Link>
                <Link href="/login" onClick={() => setIsMobileMenuOpen(false)} className="bg-white text-black px-4 py-2.5 rounded-md text-base font-medium text-center hover:bg-gray-200 transition-colors">Sign Up</Link>
              </div>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}