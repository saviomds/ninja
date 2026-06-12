"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function AuthConfirmPage() {
  const router = useRouter();
  const handled = useRef(false);

  useEffect(() => {
    function redirect(session: { user: { app_metadata?: { role?: string }; user_metadata?: { role?: string } } } | null) {
      if (handled.current) return;
      handled.current = true;
      if (!session) { router.replace("/login?error=auth_failed"); return; }
      const hashParams = new URLSearchParams(window.location.hash.slice(1));
      const queryParams = new URLSearchParams(window.location.search);
      const isRecovery = queryParams.get("type") === "recovery" || hashParams.get("type") === "recovery";
      if (isRecovery) { router.replace("/reset-password"); return; }
      const role = session.user.app_metadata?.role || session.user.user_metadata?.role;
      router.replace(role === "admin" ? "/dashboard" : "/client-dashboard");
    }

    // If there's a PKCE code, hand it to the server-side callback which has
    // access to the code verifier stored in cookies during signInWithOtp().
    const search = new URLSearchParams(window.location.search);
    const code = search.get("code");
    if (code) {
      const type = search.get("type");
      window.location.replace(`/auth/callback?code=${encodeURIComponent(code)}${type ? `&type=${encodeURIComponent(type)}` : ""}`);
      return;
    }

    // Listen for Supabase auth state changes (covers both PKCE and implicit).
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" || event === "PASSWORD_RECOVERY") redirect(session);
    });

    // If we already have a session (e.g. navigated here while logged in), use it.
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session && !handled.current) redirect(session);
    });

    // Last-resort: if nothing fires in 6 s, send to error page.
    const timer = setTimeout(() => { if (!handled.current) redirect(null); }, 6000);

    return () => { subscription.unsubscribe(); clearTimeout(timer); };
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-white dark:bg-black">
      <div className="text-center space-y-4">
        <svg className="animate-spin w-8 h-8 text-blue-600 mx-auto" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        <p className="text-gray-500 dark:text-gray-400 text-sm">Signing you in…</p>
      </div>
    </div>
  );
}
