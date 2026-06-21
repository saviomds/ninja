"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useParams } from "next/navigation";
import Navbar from "@/components/Navbar";
import Link from "next/link";

interface Post {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  category: string;
  author: string;
  read_time: number;
  published_at: string;
}

const CAT_LABEL: Record<string, string> = {
  tips: "Tips & Tricks", repair: "Repair Guides", "how-to": "How-To",
  "tech-news": "Tech News", maintenance: "Maintenance", "product-reviews": "Reviews",
};

const CAT_COLOR: Record<string, string> = {
  tips: "bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400",
  repair: "bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400",
  "how-to": "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  "tech-news": "bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400",
  maintenance: "bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400",
  "product-reviews": "bg-cyan-50 dark:bg-cyan-500/10 text-cyan-600 dark:text-cyan-400",
};

function renderContent(raw: string): string {
  return raw
    .split(/\n\n+/)
    .map(para => {
      const html = para
        .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
        .replace(/\n/g, "<br />");
      return `<p>${html}</p>`;
    })
    .join("");
}

export default function BlogPostPage() {
  const params = useParams();
  const slug = params?.slug as string;
  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!slug) return;
    supabase
      .from("blog_posts")
      .select("*")
      .eq("slug", slug)
      .eq("published", true)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setPost(data as Post);
        else setNotFound(true);
        setLoading(false);
      });
  }, [slug]);

  if (loading) return (
    <main className="min-h-screen bg-white dark:bg-gray-950 pt-[60px]">
      <Navbar />
      <div className="max-w-2xl mx-auto px-6 py-20 space-y-4 animate-pulse">
        <div className="h-4 bg-gray-100 dark:bg-gray-800 rounded-full w-24" />
        <div className="h-10 bg-gray-100 dark:bg-gray-800 rounded-xl w-full" />
        <div className="h-10 bg-gray-100 dark:bg-gray-800 rounded-xl w-4/5" />
        <div className="h-4 bg-gray-100 dark:bg-gray-800 rounded-full w-40 mt-4" />
        <div className="space-y-3 mt-8">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-4 bg-gray-100 dark:bg-gray-800 rounded-full" style={{ width: `${70 + (i % 3) * 10}%` }} />
          ))}
        </div>
      </div>
    </main>
  );

  if (notFound) return (
    <main className="min-h-screen bg-white dark:bg-gray-950 pt-[60px]">
      <Navbar />
      <div className="max-w-2xl mx-auto px-6 py-24 text-center">
        <div className="w-16 h-16 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-3xl mx-auto mb-4">📄</div>
        <h1 className="text-[24px] font-bold text-gray-900 dark:text-white mb-2">Article not found</h1>
        <p className="text-[14px] text-gray-500 dark:text-gray-400 mb-6">This post may have been removed or the URL is incorrect.</p>
        <Link href="/blog" className="inline-flex items-center gap-2 bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-[14px] font-semibold px-6 py-3 rounded-xl transition-colors">
          ← Back to Blog
        </Link>
      </div>
    </main>
  );

  if (!post) return null;

  return (
    <main className="min-h-screen bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 pt-[60px] overflow-x-hidden">
      <Navbar />

      {/* Article header */}
      <section className="bg-[#F5F7FA] dark:bg-gray-900 py-16 px-6 sm:px-10 lg:px-20">
        <div className="max-w-3xl mx-auto">
          <Link href="/blog" className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors mb-6">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Back to Blog
          </Link>

          <div className="flex items-center gap-3 mb-5">
            <span className={`text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full ${CAT_COLOR[post.category] || "bg-gray-100 dark:bg-gray-800 text-gray-500"}`}>
              {CAT_LABEL[post.category] || post.category}
            </span>
            <span className="text-[12px] text-gray-400">{post.read_time} min read</span>
          </div>

          <h1 className="text-[32px] sm:text-[42px] font-bold tracking-tight leading-tight text-gray-900 dark:text-white mb-5">
            {post.title}
          </h1>

          {post.excerpt && (
            <p className="text-[17px] text-gray-500 dark:text-gray-400 leading-relaxed mb-6">
              {post.excerpt}
            </p>
          )}

          <div className="flex items-center gap-3 pt-4 border-t border-gray-200 dark:border-gray-800">
            <div className="w-9 h-9 rounded-full bg-[#2563EB] flex items-center justify-center text-white text-[13px] font-bold flex-shrink-0">T</div>
            <div>
              <p className="text-[13px] font-semibold text-gray-900 dark:text-white">{post.author}</p>
              <p className="text-[11px] text-gray-400">
                {new Date(post.published_at).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Article body */}
      <article className="max-w-3xl mx-auto px-6 sm:px-10 lg:px-20 py-14">
        <div
          className="prose prose-gray dark:prose-invert max-w-none
            [&_p]:text-[16px] [&_p]:text-gray-600 dark:[&_p]:text-gray-400 [&_p]:leading-[1.85] [&_p]:mb-5
            [&_strong]:text-gray-900 dark:[&_strong]:text-white [&_strong]:font-semibold
            [&_p:has(strong:first-child)]:text-[16px] [&_p:has(strong:first-child)]:font-normal"
          dangerouslySetInnerHTML={{ __html: renderContent(post.content) }}
        />
      </article>

      {/* CTA footer */}
      <div className="max-w-3xl mx-auto px-6 sm:px-10 lg:px-20 pb-20">
        <div className="bg-[#F5F7FA] dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-8">
          <p className="text-[12px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Need help?</p>
          <h3 className="text-[20px] font-bold text-gray-900 dark:text-white mb-3">
            Our technicians are ready to help you.
          </h3>
          <p className="text-[14px] text-gray-500 dark:text-gray-400 mb-5">
            Free diagnosis for every device — walk in or book online.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link href="/book"
              className="inline-flex items-center gap-2 bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-[14px] font-semibold px-6 py-2.5 rounded-xl transition-colors">
              Book an appointment
            </Link>
            <Link href="/track"
              className="inline-flex items-center gap-2 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 text-[14px] font-semibold px-6 py-2.5 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
              Track a repair
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
