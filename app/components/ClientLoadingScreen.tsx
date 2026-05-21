"use client";

import dynamic from "next/dynamic";

const LoadingScreen = dynamic(() => import("./LoadingScreen"), { ssr: false });

export default function ClientLoadingScreen() {
  return <LoadingScreen />;
}
