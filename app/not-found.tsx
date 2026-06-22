import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Page Not Found" };

export default function NotFound() {
  return (
    <div className="min-h-screen bg-white dark:bg-gray-950 flex flex-col items-center justify-center px-5 text-center">
      <p className="text-8xl font-black text-gray-100 dark:text-gray-800 mb-0 leading-none select-none">404</p>
      <div className="w-16 h-16 rounded-2xl bg-[#2563EB]/10 flex items-center justify-center mb-6 -mt-4">
        <svg className="w-8 h-8 text-[#2563EB]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" />
        </svg>
      </div>
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Page not found</h1>
      <p className="text-gray-500 dark:text-gray-400 mb-8 max-w-sm text-sm">
        The page you&apos;re looking for doesn&apos;t exist or may have moved.
      </p>
      <div className="flex flex-wrap gap-3 justify-center">
        <Link href="/" className="bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-semibold px-6 py-2.5 rounded-xl text-sm transition-colors">
          Go Home
        </Link>
        <Link href="/shop" className="border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 text-gray-700 dark:text-gray-300 font-semibold px-6 py-2.5 rounded-xl text-sm transition-colors">
          Browse Shop
        </Link>
        <Link href="/contact" className="border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 text-gray-700 dark:text-gray-300 font-semibold px-6 py-2.5 rounded-xl text-sm transition-colors">
          Contact Support
        </Link>
      </div>
    </div>
  );
}
