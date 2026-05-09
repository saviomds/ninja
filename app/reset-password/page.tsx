"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }

    setIsLoading(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });

    if (updateError) {
      setIsLoading(false);
      setError(updateError.message);
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    setIsLoading(false);
    setSuccess(true);

    const role = user?.app_metadata?.role || user?.user_metadata?.role;
    const target = role === "admin" ? "/dashboard" : "/client-dashboard";
    setTimeout(() => router.push(target), 2000);
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
        <div className="relative z-10 space-y-4">
          <h1 className="text-4xl font-bold text-white leading-tight tracking-tight">
            Secure your account
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-violet-400">
              with a new password.
            </span>
          </h1>
          <p className="text-gray-400 text-lg leading-relaxed max-w-sm">
            Choose a strong password to keep your account safe.
          </p>
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
          {success ? (
            /* ── Success state ── */
            <div className="text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center mx-auto">
                <svg className="w-8 h-8 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-gray-900">Password updated!</h2>
              <p className="text-gray-500 text-sm leading-relaxed">
                Your password has been changed successfully.
                <br />Redirecting you to sign in…
              </p>
              <Link href="/login" className="inline-block mt-2 text-sm text-indigo-600 hover:underline font-medium">
                Go to sign in now →
              </Link>
            </div>
          ) : (
            /* ── Form state ── */
            <>
              <div className="mb-8">
                <h2 className="text-3xl font-bold text-gray-900 tracking-tight">New password</h2>
                <p className="text-gray-500 mt-2 text-sm">
                  Enter your new password below.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2">
                    New password
                  </label>
                  <div className="relative">
                    <input
                      type={showPass ? "text" : "password"}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="At least 6 characters"
                      className="w-full border border-gray-200 rounded-xl px-4 py-3 pr-16 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPass(!showPass)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 text-xs font-medium transition-colors"
                    >
                      {showPass ? "Hide" : "Show"}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2">
                    Confirm password
                  </label>
                  <input
                    type={showPass ? "text" : "password"}
                    required
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    placeholder="Repeat your password"
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-all"
                  />
                </div>

                {/* Password strength indicator */}
                {password.length > 0 && (
                  <div className="space-y-1">
                    <div className="flex gap-1">
                      {[...Array(4)].map((_, i) => (
                        <div
                          key={i}
                          className={`h-1 flex-1 rounded-full transition-colors ${
                            password.length >= (i + 1) * 3
                              ? password.length >= 12 ? "bg-emerald-500"
                                : password.length >= 8 ? "bg-amber-400"
                                : "bg-red-400"
                              : "bg-gray-100"
                          }`}
                        />
                      ))}
                    </div>
                    <p className="text-xs text-gray-400">
                      {password.length < 6 ? "Too short" : password.length < 8 ? "Weak" : password.length < 12 ? "Good" : "Strong"}
                    </p>
                  </div>
                )}

                {error && (
                  <p className="text-xs text-red-500 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-gray-900 text-white py-3 rounded-xl font-semibold text-sm hover:bg-gray-800 active:bg-black transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed mt-1"
                >
                  {isLoading ? (
                    <><svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>Updating…</>
                  ) : "Update password"}
                </button>
              </form>

              <div className="mt-6 text-center">
                <Link href="/login" className="text-sm text-gray-400 hover:text-gray-700 transition-colors">
                  ← Back to sign in
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
