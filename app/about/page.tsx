import type { Metadata } from "next";
import Navbar from "@/components/Navbar";
import Link from "next/link";

export const metadata: Metadata = {
  title: "About Us",
  description: "Learn about Tech Ninja — Mauritius's trusted tech repair, retail and trade-in experts.",
};

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100">
      <Navbar />
      <div className="max-w-4xl mx-auto px-5 lg:px-8 pt-28 pb-20">

        <p className="text-[11px] font-semibold tracking-[0.2em] uppercase text-[#2563EB] mb-4">Who we are</p>
        <h1 className="text-4xl sm:text-5xl font-black tracking-tight text-gray-900 dark:text-white mb-6">
          About <span className="text-[#2563EB]">Tech Ninja</span>
        </h1>
        <p className="text-lg text-gray-500 dark:text-gray-400 leading-relaxed mb-12 max-w-2xl">
          Tech Ninja is Mauritius&apos;s go-to destination for professional device repair, premium tech retail,
          and hassle-free trade-ins. Founded with a mission to make quality technology accessible to everyone
          on the island, we combine expert technicians with genuine parts and transparent pricing.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
          {[
            { icon: "🔧", title: "Expert Repair", body: "Screen replacements, battery swaps, water-damage recovery and more — backed by a 2-year warranty on all repairs." },
            { icon: "🛒", title: "Premium Retail", body: "Handpicked smartphones, laptops, accessories and gadgets at competitive prices with genuine warranties." },
            { icon: "♻️", title: "Trade-In Program", body: "Get fair cash offers for your old devices. Upgrade without the hassle — we handle the valuation on the spot." },
          ].map(({ icon, title, body }) => (
            <div key={title} className="bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-6">
              <div className="text-3xl mb-4">{icon}</div>
              <h3 className="text-[15px] font-bold text-gray-900 dark:text-white mb-2">{title}</h3>
              <p className="text-[13px] text-gray-500 dark:text-gray-400 leading-relaxed">{body}</p>
            </div>
          ))}
        </div>

        <div className="bg-[#2563EB]/5 dark:bg-[#2563EB]/10 border border-[#2563EB]/20 rounded-2xl p-8 mb-12">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Our Promise</h2>
          <ul className="space-y-3">
            {[
              "Same-day repairs on most common issues",
              "2-year warranty on all repair work",
              "Genuine parts — no third-party compromises",
              "Transparent pricing with no hidden fees",
              "Free diagnosis on all devices",
            ].map((item) => (
              <li key={item} className="flex items-center gap-3 text-[14px] text-gray-700 dark:text-gray-300">
                <svg className="w-4 h-4 text-[#2563EB] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
                {item}
              </li>
            ))}
          </ul>
        </div>

        <div className="flex flex-wrap gap-4">
          <Link href="/repair" className="inline-flex items-center gap-2 bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-semibold px-6 py-3 rounded-xl transition-colors">
            Book a Repair
          </Link>
          <Link href="/contact" className="inline-flex items-center gap-2 border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 text-gray-700 dark:text-gray-300 font-semibold px-6 py-3 rounded-xl transition-colors">
            Contact Us
          </Link>
        </div>
      </div>
    </div>
  );
}
