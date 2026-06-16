"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function ClientRedirect({ productId }: { productId: string }) {
  const router = useRouter();

  useEffect(() => {
    // Instantly replace the URL to the homepage with the query param so the modal opens
    router.replace(`/?product=${productId}`);
  }, [productId, router]);

  // Show a dark loading screen matching your theme while the soft-redirect happens
  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center text-white">
      <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4" />
      <p className="text-gray-400 font-medium">Loading product...</p>
    </div>
  );
}