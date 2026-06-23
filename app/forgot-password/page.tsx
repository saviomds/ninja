"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [cooldown, setCooldown] = useState(0);

  const startCooldown = (seconds = 60) => {
    setCooldown(seconds);
    const t = setInterval(() => setCooldown((s) => { if (s <= 1) { clearInterval(t); return 0; } return s - 1; }), 1000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) { setError("Enter your email address."); return; }
    if (cooldown > 0) return;
    setLoading(true);
    setError("");
    const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/auth/callback?type=recovery`,
    });
    setLoading(false);
    if (err) {
      if (err.message.toLowerCase().includes("rate limit") || err.message.toLowerCase().includes("too many")) {
        startCooldown(60);
        setSent(true);
      } else {
        setError(err.message);
      }
      return;
    }
    startCooldown(60);
    setSent(true);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-white dark:bg-black px-6 py-16">
      <div className="w-full max-w-sm">
        <Link href="/login" className="flex items-center gap-1.5 text-sm text-zinc-500 hover:text-black dark:hover:text-white transition-colors mb-8">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          Back to sign in
        </Link>

        {sent ? (
          <div className="text-center space-y-6">
            <div className="w-20 h-20 rounded-full bg-amber-50 dark:bg-amber-500/10 border border-amber-100 dark:border-amber-500/20 flex items-center justify-center mx-auto">
              <svg className="w-9 h-9 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
              </svg>
            </div>
            <div>
              <h2 className="text-2xl font-bold text-black dark:text-white tracking-tight">Check your inbox</h2>
              <p className="text-zinc-500 dark:text-zinc-400 mt-3 text-sm leading-relaxed">We sent a password reset link to</p>
              <p className="text-black dark:text-white font-semibold text-sm mt-1">{email}</p>
              <p className="text-zinc-500 dark:text-zinc-400 mt-3 text-sm leading-relaxed">
                Click the link in the email to set a new password. The link expires in 1 hour.
              </p>
            </div>
            <div className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 text-left space-y-2">
              <p className="text-[11px] font-bold uppercase tracking-widest text-zinc-400">Tips</p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">• Check your spam or junk folder if you don&apos;t see it</p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">• The link expires in 1 hour</p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">• Do not share this link with anyone</p>
            </div>
            <div className="space-y-2">
              {cooldown > 0 ? (
                <p className="text-xs text-zinc-400">Resend available in {cooldown}s</p>
              ) : (
                <button
                  onClick={() => { setSent(false); setError(""); }}
                  className="text-sm text-blue-600 dark:text-blue-400 hover:underline font-medium"
                >
                  Try a different email
                </button>
              )}
            </div>
          </div>
        ) : (
          <>
            <div className="mb-8">
              <h2 className="text-3xl font-bold text-black dark:text-white tracking-tight">Reset password</h2>
              <p className="text-zinc-500 dark:text-zinc-400 mt-2 text-sm">
                Enter your email and we&apos;ll send you a reset link.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-2">
                  Email address
                </label>
                <input
                  type="email"
                  required
                  autoFocus
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 rounded-xl px-4 py-3 text-sm text-black dark:text-white placeholder-zinc-400 dark:placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all"
                />
              </div>

              {error && (
                <p className="text-xs text-red-500 bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/20 rounded-lg px-3 py-2">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading || cooldown > 0}
                className="w-full bg-black dark:bg-white text-white dark:text-black py-3 rounded-xl font-bold text-sm hover:bg-zinc-800 dark:hover:bg-zinc-100 transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Sending…
                  </>
                ) : cooldown > 0 ? (
                  `Resend in ${cooldown}s`
                ) : (
                  "Send reset link"
                )}
              </button>
            </form>

            <div className="mt-6 text-center">
              <Link href="/login" className="text-sm text-zinc-400 hover:text-black dark:hover:text-white transition-colors">
                Remember your password? Sign in
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
