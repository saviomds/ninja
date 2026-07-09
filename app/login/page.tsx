"use client";

import { useState, useEffect, Suspense } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

type Mode = "signin" | "signup" | "forgot";

// Feature flags (spec #13) — either method can be disabled independently.
// NEXT_PUBLIC_* is inlined at build time so it is readable in this client page.
const MAGIC_ENABLED = process.env.NEXT_PUBLIC_ENABLE_MAGIC_LINK !== "false";
const PASSWORD_ENABLED = process.env.NEXT_PUBLIC_ENABLE_PASSWORD_LOGIN !== "false";

export default function LoginPage() {
  return (
    <Suspense>
      <LoginContent />
    </Suspense>
  );
}

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const hasAuthError = searchParams.get("error") === "auth_failed";

  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [magicLoading, setMagicLoading] = useState(false);
  const [error, setError] = useState("");
  const [magicSent, setMagicSent] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [magicCooldown, setMagicCooldown] = useState(0);
  const [resetCooldown, setResetCooldown] = useState(0);
  const [signupSuccess, setSignupSuccess] = useState(false);
  const [alreadyExists, setAlreadyExists] = useState(false);
  const [alreadyLoggedIn, setAlreadyLoggedIn] = useState(false);
  const [sessionRole, setSessionRole] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        const role = session.user.app_metadata?.role || session.user.user_metadata?.role;
        setSessionRole(role || "client");
        setAlreadyLoggedIn(true);
        if (!hasAuthError) {
          router.replace(role === "admin" ? "/dashboard" : "/client-dashboard");
        }
      }
    });
  }, [router, hasAuthError]);

  const go = (m: Mode) => { setMode(m); setError(""); setMagicSent(false); setResetSent(false); setSignupSuccess(false); setAlreadyExists(false); };

  const startCooldown = (setter: React.Dispatch<React.SetStateAction<number>>, seconds = 60) => {
    setter(seconds);
    const t = setInterval(() => setter((s) => { if (s <= 1) { clearInterval(t); return 0; } return s - 1; }), 1000);
  };

  // ── Send magic link email ────────────────────────────────────────────────
  // Uses our Resend-backed /api/magic-link route. Note: until a domain is
  // verified at resend.com/domains, Resend only delivers to the account-owner
  // address; other recipients get a surfaced "can only send to owner" error.
  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) { setError("Enter your email address."); return; }
    if (magicCooldown > 0) return;
    setMagicLoading(true);
    setError("");
    try {
      const res = await fetch("/api/magic-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), origin: window.location.origin }),
      });
      const text = await res.text();
      let result: { error?: string } = {};
      try { result = JSON.parse(text); } catch { /* ignore */ }
      setMagicLoading(false);
      if (!res.ok) {
        const msg = result.error || "Couldn't send the magic link. Please try again.";
        if (msg.toLowerCase().includes("rate limit") || msg.toLowerCase().includes("too many")) {
          startCooldown(setMagicCooldown, 60);
          setMagicSent(true);
        } else {
          setError(msg);
        }
        return;
      }
      startCooldown(setMagicCooldown, 60);
      setMagicSent(true);
    } catch {
      setMagicLoading(false);
      setError("Network error. Please check your connection and try again.");
    }
  };

  // ── Password sign-in ─────────────────────────────────────────────────────
  // Goes through /api/admin/password-login, which verifies the password with
  // Supabase (same session as magic link), then adds rate-limiting, per-admin
  // gating and audit logging around it. Errors stay generic (spec #12).
  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) { setError("Enter your email address."); return; }
    if (!password) { setError("Enter your password."); return; }
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/password-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password, rememberMe }),
      });
      const data: { ok?: boolean; role?: string; error?: string } = await res.json().catch(() => ({}));
      setLoading(false);
      if (!res.ok || !data.ok) {
        setError(data.error || "Invalid email or password.");
        return;
      }
      router.push(data.role === "admin" ? "/dashboard" : "/client-dashboard");
      router.refresh();
    } catch {
      setLoading(false);
      setError("Network error. Please try again.");
    }
  };

  // ── Sign up ──────────────────────────────────────────────────────────────
  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) { setError("Username is required."); return; }
    if (password.length < 6) { setError("Password must be at least 6 characters."); return; }
    setLoading(true);
    setError("");
    const res = await fetch("/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.trim(), password, username: username.trim() }),
    });
    const text = await res.text();
    let result: { error?: string } = {};
    try { result = JSON.parse(text); } catch { /* ignore */ }
    if (!res.ok) {
      setLoading(false);
      const msg = result.error || "Registration failed.";
      if (msg.toLowerCase().includes("already") || msg.toLowerCase().includes("registered") || msg.toLowerCase().includes("exists")) {
        setAlreadyExists(true);
      } else {
        setError(msg);
      }
      return;
    }
    setLoading(false);
    setSignupSuccess(true);
  };

  // ── Forgot password ──────────────────────────────────────────────────────
  // Uses our Resend-backed /api/forgot-password route (never reveals whether an
  // account exists). Delivery limited to the Resend owner until a domain is set.
  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) { setError("Enter your email address."); return; }
    if (resetCooldown > 0) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), origin: window.location.origin }),
      });
      const data: { ok?: boolean; error?: string } = await res.json().catch(() => ({}));
      setLoading(false);
      if (!res.ok) {
        if ((data.error || "").toLowerCase().includes("rate limit") || (data.error || "").toLowerCase().includes("too many")) {
          startCooldown(setResetCooldown, 60);
          setResetSent(true);
        } else {
          setError(data.error || "Couldn't send the reset link. Please try again.");
        }
        return;
      }
      startCooldown(setResetCooldown, 60);
      setResetSent(true);
    } catch {
      setLoading(false);
      setError("Network error. Please try again.");
    }
  };

  const Spinner = () => (
    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );

  const inputCls =
    "w-full border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 rounded-xl px-4 py-3 text-sm text-black dark:text-white placeholder-zinc-400 dark:placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all";

  if (alreadyLoggedIn && hasAuthError) {
    const dest = sessionRole === "admin" ? "/dashboard" : "/client-dashboard";
    // Auto-redirect after 2 s
    setTimeout(() => router.replace(dest), 2000);
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-black px-6">
        <div className="w-full max-w-sm text-center space-y-6">
          <div className="w-20 h-20 rounded-full bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-100 dark:border-emerald-500/20 flex items-center justify-center mx-auto">
            <svg className="w-9 h-9 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <h2 className="text-2xl font-bold text-black dark:text-white tracking-tight">You&apos;re already signed in</h2>
            <p className="text-zinc-500 dark:text-zinc-400 mt-3 text-sm leading-relaxed">
              That link has expired or was already used — but you&apos;re already logged in. Redirecting you now…
            </p>
          </div>
          <button
            onClick={() => router.replace(dest)}
            className="w-full bg-blue-600 hover:bg-blue-500 text-white py-3.5 rounded-xl font-bold text-sm transition-colors shadow-lg shadow-blue-600/20"
          >
            Go to dashboard →
          </button>
          <Link href="/" className="block text-sm text-zinc-400 hover:text-black dark:hover:text-white transition-colors">
            Back to home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-white dark:bg-black">

      {/* ── Left brand panel ─────────────────────────────────────── */}
      <div className="hidden lg:flex flex-col justify-between w-[44%] bg-zinc-950 p-12 relative overflow-hidden">
        <div className="absolute -top-40 -left-40 w-[500px] h-[500px] bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-violet-600/10 rounded-full blur-3xl pointer-events-none" />

        <Link href="/Clients" className="relative z-10">
          <img src="/logo.png" alt="Tech Ninja" width={64} height={64} className="rounded-2xl border border-white/10" />
        </Link>

        <div className="relative z-10 space-y-8">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-blue-400 mb-4">Tech Ninja · Mauritius</p>
            <h1 className="text-4xl font-bold text-white leading-tight tracking-tight">
              Your command centre
              <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-violet-400">
                for your business.
              </span>
            </h1>
            <p className="text-zinc-400 mt-4 text-base leading-relaxed max-w-sm">
              Manage products, track orders, generate invoices — all from one elegant dashboard.
            </p>
          </div>

          <div className="space-y-3">
            {[
              { icon: "📦", label: "Product & inventory management" },
              { icon: "🔔", label: "Real-time client order notifications" },
              { icon: "📄", label: "One-click invoice generation" },
              { icon: "⚡", label: "Magic link or password — your choice" },
            ].map(({ icon, label }) => (
              <div key={label} className="flex items-center gap-3 text-sm text-zinc-400">
                <span>{icon}</span>
                <span>{label}</span>
              </div>
            ))}
          </div>
        </div>

        <p className="relative z-10 text-xs text-zinc-700">© {new Date().getFullYear()} Tech Ninja.</p>
      </div>

      {/* ── Right form panel ─────────────────────────────────────── */}
      <div className="flex-1 flex flex-col justify-center items-center px-6 py-16">

        {/* Mobile logo */}
        <Link href="/Clients" className="lg:hidden mb-10">
          <img src="/logo.png" alt="Tech Ninja" width={56} height={56} className="rounded-2xl border border-zinc-200 dark:border-zinc-800" />
        </Link>

        <div className="w-full max-w-sm">

          {/* ══ MAGIC LINK SENT SUCCESS ══════════════════════════════ */}
          {magicSent ? (
            <div className="text-center space-y-6">
              <div className="w-20 h-20 rounded-full bg-blue-50 dark:bg-blue-500/10 border border-blue-100 dark:border-blue-500/20 flex items-center justify-center mx-auto">
                <svg className="w-9 h-9 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                </svg>
              </div>

              <div>
                <h2 className="text-2xl font-bold text-black dark:text-white tracking-tight">Check your inbox</h2>
                <p className="text-zinc-500 dark:text-zinc-400 mt-3 text-sm leading-relaxed">
                  We sent a magic link to
                </p>
                <p className="text-black dark:text-white font-semibold text-sm mt-1">{email}</p>
                <p className="text-zinc-500 dark:text-zinc-400 mt-3 text-sm leading-relaxed">
                  Click the link in the email to sign in instantly — no password needed.
                </p>
              </div>

              <div className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 text-left space-y-2">
                <p className="text-[11px] font-bold uppercase tracking-widest text-zinc-400">Tips</p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">• Check your spam or junk folder if you don&apos;t see it</p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">• The link expires in 1 hour</p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">• Only the latest link will work if you request multiple</p>
              </div>

              <div className="flex flex-col items-center gap-2">
                {magicCooldown > 0 ? (
                  <p className="text-xs text-zinc-400">Resend available in {magicCooldown}s</p>
                ) : (
                  <button
                    onClick={(e) => { setMagicSent(false); handleMagicLink(e as unknown as React.FormEvent); }}
                    disabled={magicLoading}
                    className="text-sm text-blue-600 dark:text-blue-400 hover:underline font-medium disabled:opacity-40"
                  >
                    Resend link
                  </button>
                )}
                <button
                  onClick={() => { setMagicSent(false); setError(""); }}
                  className="text-sm text-zinc-400 hover:text-black dark:hover:text-white transition-colors"
                >
                  ← Use a different email
                </button>
              </div>
            </div>

          ) : mode === "forgot" ? (

            /* ══ FORGOT PASSWORD ════════════════════════════════════ */
            <>
              {resetSent ? (
                <div className="text-center space-y-6">
                  <div className="w-20 h-20 rounded-full bg-amber-50 dark:bg-amber-500/10 border border-amber-100 dark:border-amber-500/20 flex items-center justify-center mx-auto">
                    <svg className="w-9 h-9 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-black dark:text-white tracking-tight">Check your inbox</h2>
                    <p className="text-zinc-500 dark:text-zinc-400 mt-3 text-sm leading-relaxed">If an account exists, we sent a password reset link to</p>
                    <p className="text-black dark:text-white font-semibold text-sm mt-1">{email}</p>
                    <p className="text-zinc-500 dark:text-zinc-400 mt-3 text-sm leading-relaxed">
                      Click the link in the email to set a new password.
                    </p>
                  </div>
                  <div className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 text-left space-y-2">
                    <p className="text-[11px] font-bold uppercase tracking-widest text-zinc-400">Tips</p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">• Check your spam or junk folder if you don&apos;t see it</p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">• The link expires in 1 hour</p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">• Do not share this link with anyone</p>
                  </div>
                  <button onClick={() => { setResetSent(false); setError(""); }} className="text-sm text-blue-600 dark:text-blue-400 hover:underline font-medium">
                    ← Try a different email
                  </button>
                </div>
              ) : (
                <>
                  <button onClick={() => go("signin")} className="flex items-center gap-1.5 text-sm text-zinc-500 hover:text-black dark:hover:text-white transition-colors mb-8">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                    Back
                  </button>

                  <div className="mb-8">
                    <h2 className="text-3xl font-bold text-black dark:text-white tracking-tight">Reset password</h2>
                    <p className="text-zinc-500 dark:text-zinc-400 mt-2 text-sm">
                      Enter your email and we&apos;ll send you a reset link.
                    </p>
                  </div>

                  <form onSubmit={handleForgot} className="space-y-4">
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-2">Email address</label>
                      <input
                        type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@example.com"
                        className={inputCls}
                      />
                    </div>
                    {error && <p className="text-xs text-red-500 bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/20 rounded-lg px-3 py-2">{error}</p>}
                    <button type="submit" disabled={loading || resetCooldown > 0} className="w-full bg-black dark:bg-white text-white dark:text-black py-3 rounded-xl font-bold text-sm hover:bg-zinc-800 dark:hover:bg-zinc-100 transition-colors flex items-center justify-center gap-2 disabled:opacity-60">
                      {loading ? <><Spinner />Sending…</> : resetCooldown > 0 ? `Resend in ${resetCooldown}s` : "Send reset link"}
                    </button>
                  </form>
                </>
              )}
            </>

          ) : (

            /* ══ MAIN LOGIN FORMS ════════════════════════════════════ */
            <>
              {/* Mode tabs */}
              <div className="flex bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-1 mb-8 gap-1">
                {(["signin", "signup"] as Mode[]).map((m) => (
                  <button
                    key={m}
                    onClick={() => go(m)}
                    className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition-all tracking-wide ${
                      mode === m
                        ? "bg-white dark:bg-zinc-800 shadow text-black dark:text-white"
                        : "text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300"
                    }`}
                  >
                    {m === "signin" ? "Sign in" : "Sign up"}
                  </button>
                ))}
              </div>

              {/* ── SIGN IN (Magic Link + OR + Password) ── */}
              {mode === "signin" && (
                <>
                  <div className="mb-8">
                    <h2 className="text-3xl font-bold text-black dark:text-white tracking-tight">Sign in</h2>
                    <p className="text-zinc-500 dark:text-zinc-400 mt-2 text-sm">
                      Use a one-click magic link, or your email and password.
                    </p>
                  </div>

                  {/* Shared email address (used by both methods) */}
                  <div className="mb-4">
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-2">Email address</label>
                    <input
                      type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      autoFocus
                      className={inputCls}
                    />
                  </div>

                  {/* Magic link — primary method */}
                  {MAGIC_ENABLED && (
                    <button
                      type="button"
                      onClick={handleMagicLink}
                      disabled={magicLoading || magicCooldown > 0}
                      className="w-full bg-blue-600 hover:bg-blue-500 text-white py-3.5 rounded-xl font-bold text-sm transition-colors flex items-center justify-center gap-2.5 disabled:opacity-60 shadow-lg shadow-blue-600/20"
                    >
                      {magicLoading ? (
                        <><Spinner />Sending link…</>
                      ) : magicCooldown > 0 ? (
                        `Resend available in ${magicCooldown}s`
                      ) : (
                        <>
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                          </svg>
                          Continue with Magic Link
                        </>
                      )}
                    </button>
                  )}

                  {/* OR divider — only when both methods are available */}
                  {MAGIC_ENABLED && PASSWORD_ENABLED && (
                    <div className="flex items-center gap-3 my-6">
                      <span className="flex-1 h-px bg-zinc-200 dark:bg-zinc-800" />
                      <span className="text-[11px] font-bold uppercase tracking-widest text-zinc-400">or</span>
                      <span className="flex-1 h-px bg-zinc-200 dark:bg-zinc-800" />
                    </div>
                  )}

                  {/* Password sign-in — secondary method */}
                  {PASSWORD_ENABLED && (
                    <form onSubmit={handleSignIn} className="space-y-4">
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <label className="block text-[10px] font-bold uppercase tracking-widest text-zinc-500">Password</label>
                          <button type="button" onClick={() => go("forgot")} className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-medium">
                            Forgot password?
                          </button>
                        </div>
                        <div className="relative">
                          <input
                            type={showPass ? "text" : "password"} value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="••••••••"
                            className={`${inputCls} pr-16`}
                          />
                          <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors text-xs font-medium">
                            {showPass ? "Hide" : "Show"}
                          </button>
                        </div>
                      </div>

                      <label className="flex items-center gap-2.5 cursor-pointer select-none">
                        <input type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} className="w-4 h-4 accent-blue-600" />
                        <span className="text-xs text-zinc-500 dark:text-zinc-400">Remember me on this device</span>
                      </label>

                      {error && <p className="text-xs text-red-500 bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/20 rounded-lg px-3 py-2">{error}</p>}

                      <button type="submit" disabled={loading} className="w-full bg-black dark:bg-white text-white dark:text-black py-3.5 rounded-xl font-bold text-sm hover:bg-zinc-800 dark:hover:bg-zinc-100 transition-colors flex items-center justify-center gap-2 disabled:opacity-40">
                        {loading ? <><Spinner />Signing in…</> : "Login with Password"}
                      </button>
                    </form>
                  )}

                  {/* If only magic link is on, still surface errors */}
                  {!PASSWORD_ENABLED && error && (
                    <p className="mt-4 text-xs text-red-500 bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/20 rounded-lg px-3 py-2">{error}</p>
                  )}
                </>
              )}

              {/* ── SIGN UP ── */}
              {mode === "signup" && (
                <>
                  {/* ── Account created success screen ── */}
                  {signupSuccess ? (
                    <div className="text-center space-y-6">
                      <div className="w-20 h-20 rounded-full bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-100 dark:border-emerald-500/20 flex items-center justify-center mx-auto">
                        <svg className="w-9 h-9 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <div>
                        <h2 className="text-2xl font-bold text-black dark:text-white tracking-tight">Account created!</h2>
                        <p className="text-zinc-500 dark:text-zinc-400 mt-3 text-sm leading-relaxed">
                          Welcome aboard. Your account for
                        </p>
                        <p className="text-black dark:text-white font-semibold text-sm mt-1">{email}</p>
                        <p className="text-zinc-500 dark:text-zinc-400 mt-3 text-sm leading-relaxed">
                          is ready. Sign in to access your dashboard.
                        </p>
                      </div>
                      <button
                        onClick={() => go("signin")}
                        className="w-full bg-blue-600 hover:bg-blue-500 text-white py-3.5 rounded-xl font-bold text-sm transition-colors flex items-center justify-center gap-2.5 shadow-lg shadow-blue-600/20"
                      >
                        Go to sign in →
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="mb-8">
                        <h2 className="text-3xl font-bold text-black dark:text-white tracking-tight">Create account</h2>
                        <p className="text-zinc-500 dark:text-zinc-400 mt-2 text-sm">Get started in seconds.</p>
                      </div>

                      {/* Already exists banner */}
                      {alreadyExists && (
                        <div className="mb-4 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-2xl p-4 flex items-start gap-3">
                          <svg className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                          </svg>
                          <div>
                            <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">Account already exists</p>
                            <p className="text-xs text-amber-600 dark:text-amber-500 mt-0.5">An account with this email is already registered.</p>
                            <div className="flex gap-3 mt-3">
                              <button onClick={() => go("signin")} className="text-xs font-bold text-amber-700 dark:text-amber-400 underline hover:no-underline">
                                Go to sign in
                              </button>
                            </div>
                          </div>
                        </div>
                      )}

                      <form onSubmit={handleSignUp} className="space-y-4">
                        <div>
                          <label className="block text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-2">Username</label>
                          <input
                            type="text" required value={username} onChange={(e) => { setUsername(e.target.value); setAlreadyExists(false); }}
                            placeholder="johndoe"
                            className={inputCls}
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-2">Email address</label>
                          <input
                            type="email" required value={email} onChange={(e) => { setEmail(e.target.value); setAlreadyExists(false); }}
                            placeholder="you@example.com"
                            className={inputCls}
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-2">Password</label>
                          <div className="relative">
                            <input
                              type={showPass ? "text" : "password"} required value={password}
                              onChange={(e) => setPassword(e.target.value)}
                              placeholder="At least 6 characters"
                              className={`${inputCls} pr-16`}
                            />
                            <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors text-xs font-medium">
                              {showPass ? "Hide" : "Show"}
                            </button>
                          </div>
                        </div>

                        {error && <p className="text-xs text-red-500 bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/20 rounded-lg px-3 py-2">{error}</p>}

                        <button type="submit" disabled={loading} className="w-full bg-black dark:bg-white text-white dark:text-black py-3.5 rounded-xl font-bold text-sm hover:bg-zinc-800 dark:hover:bg-zinc-100 transition-colors flex items-center justify-center gap-2 disabled:opacity-40">
                          {loading ? <><Spinner />Creating account…</> : "Create account"}
                        </button>
                      </form>
                    </>
                  )}
                </>
              )}

              <div className="mt-8 pt-6 border-t border-zinc-100 dark:border-zinc-800 text-center">
                <Link href="/Clients" className="text-sm text-zinc-400 hover:text-black dark:hover:text-white transition-colors">
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
