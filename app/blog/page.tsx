"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import Navbar from "@/components/Navbar";
import Link from "next/link";

interface Post {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  category: string;
  author: string;
  read_time: number;
  published_at: string;
}

const CATEGORIES = ["all", "tips", "repair", "how-to", "tech-news", "maintenance", "product-reviews"];

const CAT_LABEL: Record<string, string> = {
  all: "All Posts", tips: "Tips & Tricks", repair: "Repair Guides",
  "how-to": "How-To", "tech-news": "Tech News", maintenance: "Maintenance", "product-reviews": "Reviews",
};

const CAT_COLOR: Record<string, string> = {
  tips: "bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400",
  repair: "bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400",
  "how-to": "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  "tech-news": "bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400",
  maintenance: "bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400",
  "product-reviews": "bg-cyan-50 dark:bg-cyan-500/10 text-cyan-600 dark:text-cyan-400",
};

export default function BlogPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [cat, setCat] = useState("all");

  useEffect(() => {
    supabase
      .from("blog_posts")
      .select("id,slug,title,excerpt,category,author,read_time,published_at")
      .eq("published", true)
      .order("published_at", { ascending: false })
      .then(({ data }) => { setPosts((data || []) as Post[]); setLoading(false); });
  }, []);

  const filtered = cat === "all" ? posts : posts.filter(p => p.category === cat);
  const [featured, ...rest] = filtered;

  const usedCats = ["all", ...Array.from(new Set(posts.map(p => p.category)))];

  return (
    <main className="min-h-screen bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 pt-[60px] overflow-x-hidden">
      <Navbar />

      {/* Hero */}
      <section className="bg-[#F5F7FA] dark:bg-gray-900 py-20 px-6 sm:px-10 lg:px-20">
        <div className="max-w-7xl mx-auto">
          <span className="text-[12px] font-semibold tracking-[0.14em] text-gray-400 uppercase mb-4 block">Tech Ninja Blog</span>
          <h1 className="text-[40px] sm:text-[56px] font-bold tracking-tight leading-[1.05] text-gray-900 dark:text-white mb-4">
            Tips, guides &<br />tech expertise.
          </h1>
          <p className="text-[16px] text-gray-500 dark:text-gray-400 max-w-lg">
            Practical advice from our certified technicians — helping you get more from your devices and know when to seek help.
          </p>
        </div>
      </section>

      {/* Category filter */}
      <div className="sticky top-[60px] z-20 bg-white/90 dark:bg-gray-950/90 backdrop-blur-md border-b border-gray-100 dark:border-gray-800 px-6 sm:px-10 lg:px-20">
        <div className="max-w-7xl mx-auto overflow-x-auto scrollbar-none">
          <div className="flex gap-1 py-3 w-max">
            {usedCats.map(c => (
              <button key={c} onClick={() => setCat(c)}
                className={`px-4 py-1.5 rounded-full text-[13px] font-semibold whitespace-nowrap transition-all ${
                  cat === c
                    ? "bg-gray-900 dark:bg-white text-white dark:text-gray-900"
                    : "text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800"
                }`}>
                {CAT_LABEL[c] || c}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 sm:px-10 lg:px-20 py-12">
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="rounded-2xl bg-gray-100 dark:bg-gray-800/50 h-64 animate-pulse" />
            ))}
          </div>
        ) : posts.length === 0 ? (
          <div className="text-center py-24">
            <div className="w-16 h-16 rounded-2xl bg-[#2563EB]/10 flex items-center justify-center text-3xl mx-auto mb-4">📝</div>
            <p className="text-[17px] font-semibold text-gray-700 dark:text-gray-300 mb-2">Coming soon</p>
            <p className="text-[14px] text-gray-400">Our first articles are on the way. Check back soon.</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-24">
            <p className="text-[15px] text-gray-400">No posts in this category yet.</p>
          </div>
        ) : (
          <>
            {/* Featured post */}
            {featured && (
              <Link href={`/blog/${featured.slug}`} className="block group mb-10">
                <div className="bg-[#F5F7FA] dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-8 sm:p-10 hover:shadow-[0_8px_30px_rgba(0,0,0,0.07)] dark:hover:shadow-[0_8px_30px_rgba(0,0,0,0.4)] transition-all duration-300">
                  <div className="flex items-center gap-3 mb-5">
                    <span className={`text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full ${CAT_COLOR[featured.category] || "bg-gray-100 dark:bg-gray-800 text-gray-500"}`}>
                      {CAT_LABEL[featured.category] || featured.category}
                    </span>
                    <span className="text-[12px] text-gray-400 font-medium">{featured.read_time} min read</span>
                  </div>
                  <h2 className="text-[24px] sm:text-[30px] font-bold text-gray-900 dark:text-white mb-3 group-hover:text-[#2563EB] transition-colors leading-tight">
                    {featured.title}
                  </h2>
                  <p className="text-[15px] text-gray-500 dark:text-gray-400 leading-relaxed mb-5 max-w-2xl">
                    {featured.excerpt}
                  </p>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-[#2563EB] flex items-center justify-center text-white text-[12px] font-bold">T</div>
                      <span className="text-[13px] font-semibold text-gray-700 dark:text-gray-300">{featured.author}</span>
                      <span className="text-[12px] text-gray-400">
                        {new Date(featured.published_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                      </span>
                    </div>
                    <span className="text-[13px] font-semibold text-[#2563EB] group-hover:underline hidden sm:block">Read article →</span>
                  </div>
                </div>
              </Link>
            )}

            {/* Grid */}
            {rest.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {rest.map(post => (
                  <Link key={post.id} href={`/blog/${post.slug}`}
                    className="group bg-white dark:bg-gray-900/60 border border-gray-100 dark:border-gray-800 rounded-2xl p-6 hover:shadow-[0_4px_24px_rgba(0,0,0,0.07)] dark:hover:shadow-[0_4px_24px_rgba(0,0,0,0.4)] transition-all duration-300 flex flex-col">
                    <div className="flex items-center gap-2 mb-4">
                      <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${CAT_COLOR[post.category] || "bg-gray-100 dark:bg-gray-800 text-gray-500"}`}>
                        {CAT_LABEL[post.category] || post.category}
                      </span>
                      <span className="text-[11px] text-gray-400">{post.read_time} min</span>
                    </div>
                    <h3 className="text-[16px] font-bold text-gray-900 dark:text-white mb-2.5 group-hover:text-[#2563EB] transition-colors leading-snug flex-1">
                      {post.title}
                    </h3>
                    <p className="text-[13px] text-gray-500 dark:text-gray-400 leading-relaxed line-clamp-3 mb-5">
                      {post.excerpt}
                    </p>
                    <div className="flex items-center justify-between mt-auto pt-4 border-t border-gray-100 dark:border-gray-800">
                      <span className="text-[12px] text-gray-400">
                        {new Date(post.published_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                      </span>
                      <span className="text-[12px] font-semibold text-[#2563EB]">Read →</span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </>
        )}

        {/* CTA */}
        {!loading && posts.length > 0 && (
          <div className="mt-16 bg-[#F5F7FA] dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-8 text-center">
            <p className="text-[13px] font-semibold text-gray-400 uppercase tracking-wider mb-3">Need repairs?</p>
            <h3 className="text-[22px] font-bold text-gray-900 dark:text-white mb-4">Put our expertise to work for your device.</h3>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Link href="/book"
                className="inline-flex items-center gap-2 bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-[14px] font-semibold px-6 py-3 rounded-xl transition-colors">
                Book an appointment
              </Link>
              <Link href="/track"
                className="inline-flex items-center gap-2 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 text-[14px] font-semibold px-6 py-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                Track a repair
              </Link>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
