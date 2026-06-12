"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function AuthHashHandler() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (typeof window === "undefined") return;
    const hash = window.location.hash;
    if (!hash) return;

    const params = new URLSearchParams(hash.slice(1));
    const type = params.get("type");
    const accessToken = params.get("access_token");
    const refreshToken = params.get("refresh_token");

    if (type === "recovery" && accessToken && refreshToken && pathname !== "/reset-password") {
      // Establish the session first, then navigate — otherwise reset-password has no auth
      supabase.auth
        .setSession({ access_token: accessToken, refresh_token: refreshToken })
        .then(() => {
          // Clear the hash so tokens don't linger in the URL
          window.history.replaceState(null, "", window.location.pathname + window.location.search);
          router.replace("/reset-password");
        });
    }
  }, [pathname, router]);

  return null;
}
