"use client";

import { usePathname } from "next/navigation";
import LoadingScreen from "./LoadingScreen";

// LoadingScreen is SSR-safe: its first render is deterministic and every browser
// API (Date.now, requestAnimationFrame, window) is confined to useEffect. Import
// it statically rather than via dynamic(..., { ssr: false }) — an ssr:false
// dynamic renders as a lazy/Suspense boundary that streams a placeholder <script>
// on the server but nothing during client hydration, shifting sibling node counts
// and causing the ContactFAB hydration mismatch on dashboard routes.
const DASHBOARD_PREFIXES = ["/dashboard", "/client-dashboard", "/admin"];

export default function ClientLoadingScreen() {
  const pathname = usePathname();
  const isDashboard = DASHBOARD_PREFIXES.some((p) => pathname?.startsWith(p));
  if (!isDashboard) return null;
  return <LoadingScreen />;
}
