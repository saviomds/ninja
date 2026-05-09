"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";

type Mode = "signin" | "signup" | "forgot";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [resetSent, setResetSent] = useState(false);

  const switchMode = (m: Mode) => { setMode(m); setError(""); setResetSent(false); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      if (mode === "signin") {
        const { data, error: authError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (authError) throw authError;
        const role = data.user?.app_metadata?.role || data.user?.user_metadata?.role;
        router.push(role === "admin" ? "/dashboard" : "/client-dashboard");

      } else if (mode === "signup") {
        if (!username.trim()) throw new Error("Username is required");
        if (password.length < 6) throw new Error("Password must be at least 6 characters");

        const res = await fetch("/api/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: email.trim(), password, username: username.trim() }),
        });
        const result = await res.json();
        if (!res.ok) throw new Error(result.error || "Registration failed");

        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (signInError) throw signInError;
        const role = signInData.user?.app_metadata?.role || signInData.user?.user_metadata?.role;
        router.push(role === "admin" ? "/dashboard" : "/client-dashboard");

      } else {
        // Forgot password — generate link server-side (bypasses Supabase email rate limit)
        const res = await fetch("/api/forgot-password", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: email.trim(), origin: window.location.origin }),
        });
        const result = await res.json();
        if (!res.ok) throw new Error(result.error || "Failed to generate reset link");
        window.location.href = result.actionLink;
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    }
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen flex">

      {/* ── Left brand panel ─────────────────────────────────────────────────── */}
      <div className="hidden lg:flex flex-col justify-between w-[45%] bg-[#0a0a0a] p-12 relative overflow-hidden">
        <div className="absolute -top-32 -left-32 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 right-0 w-80 h-80 bg-violet-600/15 rounded-full blur-3xl pointer-events-none" />

        <Link href="/Clients" className="relative z-10">
          <Image src="/logo.png" alt="Tech Ninja" width={48} height={48} unoptimized className="object-contain" />
        </Link>

        <div className="relative z-10 space-y-6">
          <div>
            <h1 className="text-4xl font-bold text-white leading-tight tracking-tight">
              The command centre
              <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-violet-400">
                for your business.
              </span>
            </h1>
            <p className="text-gray-400 mt-4 text-lg leading-relaxed max-w-sm">
              Manage products, track orders, and serve clients — all from one elegant dashboard.
            </p>
          </div>
          <div className="flex flex-col gap-3">
            {[
              { icon: "📦", label: "Product & inventory management" },
              { icon: "🔔", label: "Real-time client order notifications" },
              { icon: "📄", label: "One-click invoice generation" },
            ].map(({ icon, label }) => (
              <div key={label} className="flex items-center gap-3 text-sm text-gray-300">
                <span className="text-base">{icon}</span>
                <span>{label}</span>
              </div>
            ))}
          </div>
        </div>

        <p className="relative z-10 text-xs text-gray-600">
          © {new Date().getFullYear()} Tech Ninja. Mauritius.
        </p>
      </div>

      {/* ── Right form panel ──────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col justify-center items-center px-6 py-12 bg-white">
        <div className="lg:hidden mb-8">
          <Image src="/logo.png" alt="Tech Ninja" width={44} height={44} unoptimized className="object-contain" />
        </div>

        <div className="w-full max-w-sm">

          {/* ── Forgot password view ─────────────────────────────────────────── */}
          {mode === "forgot" ? (
            <>
              <button
                onClick={() => switchMode("signin")}
                className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors mb-8"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Back to sign in
              </button>

              <div className="mb-8">
                <h2 className="text-3xl font-bold text-gray-900 tracking-tight">Reset password</h2>
                <p className="text-gray-500 mt-2 text-sm">
                  Enter your email and you&apos;ll be taken directly to reset your password.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2">
                    Email address
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-all"
                  />
                </div>

                {error && (
                  <p className="text-xs text-red-500 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>
                )}

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-gray-900 text-white py-3 rounded-xl font-semibold text-sm hover:bg-gray-800 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? (
                    <><svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>Redirecting…</>
                  ) : "Reset password"}
                </button>
              </form>
            </>
          ) : (
<>
              {/* ── Sign in / Sign up toggle ──────────────────────────────────── */}
              <div className="flex bg-gray-100 rounded-xl p-1 mb-8">
                <button
                  onClick={() => switchMode("signin")}
                  className={`flex-1 py-2.5 text-sm font-semibold rounded-lg transition-all ${
                    mode === "signin" ? "bg-white shadow text-gray-900" : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  Sign in
                </button>
                <button
                  onClick={() => switchMode("signup")}
                  className={`flex-1 py-2.5 text-sm font-semibold rounded-lg transition-all ${
                    mode === "signup" ? "bg-white shadow text-gray-900" : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  Create account
                </button>
              </div>

              <div className="mb-8">
                <h2 className="text-3xl font-bold text-gray-900 tracking-tight">
                  {mode === "signin" ? "Welcome back" : "Get started"}
                </h2>
                <p className="text-gray-500 mt-2 text-sm">
                  {mode === "signin" ? "Sign in with your email and password." : "Create your account in seconds."}
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {mode === "signup" && (
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2">Username</label>
                    <input
                      type="text"
                      required
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="johndoe"
                      className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-all"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2">Email address</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-all"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider">Password</label>
                    {mode === "signin" && (
                      <button
                        type="button"
                        onClick={() => switchMode("forgot")}
                        className="text-xs text-indigo-600 hover:underline font-medium"
                      >
                        Forgot password?
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <input
                      type={showPass ? "text" : "password"}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full border border-gray-200 rounded-xl px-4 py-3 pr-16 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPass(!showPass)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 transition-colors text-xs font-medium"
                    >
                      {showPass ? "Hide" : "Show"}
                    </button>
                  </div>
                </div>

                {error && (
                  <p className="text-xs text-red-500 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>
                )}

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-gray-900 text-white py-3 rounded-xl font-semibold text-sm hover:bg-gray-800 active:bg-black transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed mt-1"
                >
                  {isLoading ? (
                    <><svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>{mode === "signin" ? "Signing in…" : "Creating account…"}</>
                  ) : mode === "signin" ? "Sign in" : "Create account"}
                </button>
              </form>

              <div className="mt-8 pt-6 border-t border-gray-100 text-center">
                <Link href="/Clients" className="text-sm text-indigo-600 hover:underline font-medium">
                  Browse products without signing in →
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
