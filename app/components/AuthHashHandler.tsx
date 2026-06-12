"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";

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

    if (type === "recovery" && accessToken && pathname !== "/reset-password") {
      router.replace("/reset-password");
    }
  }, [pathname, router]);

  return null;
}
