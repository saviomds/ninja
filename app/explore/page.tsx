import Navbar from "@/components/Navbar";
import Link from "next/link";
import { createClient } from "@/lib/supabase-server";

export const revalidate = 0;

function SmartphoneIcon({ cls }: { cls?: string }) {
  return <svg className={cls ?? "w-6 h-6"} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 8.25h3" /></svg>;
}
function LaptopIcon({ cls }: { cls?: string }) {
  return <svg className={cls ?? "w-6 h-6"} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0H3" /></svg>;
}
function HeadphonesIcon({ cls }: { cls?: string }) {
  return <svg className={cls ?? "w-6 h-6"} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z" /></svg>;
}
function WatchIcon({ cls }: { cls?: string }) {
  return <svg className={cls ?? "w-6 h-6"} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
}
function PlugIcon({ cls }: { cls?: string }) {
  return <svg className={cls ?? "w-6 h-6"} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" /></svg>;
}
function MonitorIcon({ cls }: { cls?: string }) {
  return <svg className={cls ?? "w-6 h-6"} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0H3" /></svg>;
}
function GridIcon({ cls }: { cls?: string }) {
  return <svg className={cls ?? "w-6 h-6"} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" /></svg>;
}

export default async function Explore() {
  const supabase = await createClient();
  const { data: categoriesData, error } = await supabase.from("categories").select("name, description");
  if (error) console.error("Error fetching categories:", error.message);

  const fallbackCategories = [
    { name: "Smartphones & Phones", desc: "Latest flagship phones, budget picks, and refurbished deals." },
    { name: "Laptops & Computing",  desc: "Thin & light laptops, desktops, and accessories for work or play." },
    { name: "Audio & Headphones",   desc: "Wireless earbuds, over-ear headphones, and portable speakers." },
    { name: "Smartwatches",         desc: "Fitness trackers and smartwatches for every lifestyle." },
    { name: "Cables & Chargers",    desc: "Fast-charging cables, wireless pads, and multi-port hubs." },
    { name: "Screens & Displays",   desc: "Monitors, screen protectors, and display accessories." },
  ];

  const getIcon = (name: string) => {
    const n = name.toLowerCase();
    if (n.includes("phone") || n.includes("mobile")) return <SmartphoneIcon />;
    if (n.includes("laptop") || n.includes("comput")) return <LaptopIcon />;
    if (n.includes("audio") || n.includes("head") || n.includes("speaker")) return <HeadphonesIcon />;
    if (n.includes("watch") || n.includes("wear")) return <WatchIcon />;
    if (n.includes("cable") || n.includes("charg")) return <PlugIcon />;
    if (n.includes("screen") || n.includes("display") || n.includes("monitor")) return <MonitorIcon />;
    return <GridIcon />;
  };

  const categories =
    categoriesData && categoriesData.length > 0
      ? categoriesData.map((c) => ({ name: c.name, desc: c.description || `Discover our collection of ${c.name}.` }))
      : fallbackCategories;

  return (
    <main className="min-h-screen bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100">
      <Navbar />

      <div className="max-w-7xl mx-auto px-5 lg:px-8 pt-28 pb-20">

        {/* Header */}
        <div className="text-center mb-14">
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#2563EB]/10 text-[#2563EB] text-[11px] font-semibold uppercase tracking-wider mb-5">
            <GridIcon cls="w-3 h-3" />
            Browse All Categories
          </span>
          <h1 className="text-[40px] sm:text-[52px] font-black tracking-tight text-gray-900 dark:text-white mb-4">
            Shop by Category
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-[16px] max-w-xl mx-auto leading-relaxed">
            Browse our curated selection of premium tech products. Find exactly what you need.
          </p>
        </div>

        {/* Category grid */}
        {categories.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 bg-[#F9FAFB] dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700">
            <GridIcon cls="w-10 h-10 text-gray-300 dark:text-gray-600" />
            <p className="text-gray-400 text-[15px] font-medium mt-4">No categories currently available.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {categories.map((cat) => (
              <div
                key={cat.name}
                className="cat-card-lift group bg-[#F9FAFB] dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl p-7 flex flex-col hover:shadow-[0_8px_24px_rgba(0,0,0,0.08)] dark:hover:shadow-[0_8px_24px_rgba(0,0,0,0.3)] transition-all"
              >
                <div className="w-12 h-12 rounded-xl bg-[#2563EB]/10 flex items-center justify-center text-[#2563EB] mb-5 group-hover:bg-[#2563EB] group-hover:text-white transition-all duration-300">
                  {getIcon(cat.name)}
                </div>
                <h3 className="text-[18px] font-bold text-gray-900 dark:text-white mb-2 group-hover:text-[#2563EB] dark:group-hover:text-blue-400 transition-colors">
                  {cat.name}
                </h3>
                <p className="text-[13px] text-gray-500 dark:text-gray-400 leading-relaxed mb-6 flex-1">{cat.desc}</p>
                <Link
                  href={`/Clients?category=${encodeURIComponent(cat.name)}`}
                  className="inline-flex items-center gap-2 text-[13px] font-semibold text-[#2563EB] hover:gap-3 transition-all"
                >
                  Browse Collection
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
                </Link>
              </div>
            ))}
          </div>
        )}

        {/* CTA */}
        <div className="mt-16 text-center">
          <p className="text-gray-400 text-[14px] mb-4">Can&apos;t find what you need?</p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link href="/Clients" className="inline-flex items-center gap-2 bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-[14px] font-semibold px-6 py-3 rounded-lg transition-all shadow-sm">
              View All Products
            </Link>
            <Link href="/repair" className="inline-flex items-center gap-2 bg-[#F9FAFB] dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 text-[14px] font-semibold px-6 py-3 rounded-lg hover:border-[#2563EB]/40 hover:text-[#2563EB] transition-all">
              Book a Repair
            </Link>
          </div>
        </div>

      </div>
    </main>
  );
}
