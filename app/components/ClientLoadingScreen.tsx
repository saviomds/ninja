"use client";

import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";

const LoadingScreen = dynamic(() => import("./LoadingScreen"), { ssr: false });

const DASHBOARD_PREFIXES = ["/dashboard", "/client-dashboard", "/admin"];

export default function ClientLoadingScreen() {
  const pathname = usePathname();
  const isDashboard = DASHBOARD_PREFIXES.some((p) => pathname?.startsWith(p));
  if (!isDashboard) return null;
  return <LoadingScreen />;
}
