"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import Link from "next/link";

const sections = [
  {
    label: "Products",
    description: "Add, edit, and manage your product catalog",
    href: "/admin/products/new",
    icon: "📦",
    color: "from-blue-500/10 to-blue-600/5 border-blue-500/20 hover:border-blue-500/50",
    iconBg: "bg-blue-500/10",
  },
  {
    label: "Updates",
    description: "Post announcements, feature updates and fixes",
    href: "/admin/updates/new",
    icon: "📝",
    color: "from-emerald-500/10 to-emerald-600/5 border-emerald-500/20 hover:border-emerald-500/50",
    iconBg: "bg-emerald-500/10",
  },
  {
    label: "Users",
    description: "View registered users and their profiles",
    href: "/admin/users",
    icon: "👥",
    color: "from-violet-500/10 to-violet-600/5 border-violet-500/20 hover:border-violet-500/50",
    iconBg: "bg-violet-500/10",
  },
  {
    label: "Social Links",
    description: "Manage your social media profiles and links",
    href: "/admin/social",
    icon: "🔗",
    color: "from-pink-500/10 to-pink-600/5 border-pink-500/20 hover:border-pink-500/50",
    iconBg: "bg-pink-500/10",
  },
  {
    label: "Comments",
    description: "Review and moderate user comments",
    href: "/admin/comments",
    icon: "💬",
    color: "from-amber-500/10 to-amber-600/5 border-amber-500/20 hover:border-amber-500/50",
    iconBg: "bg-amber-500/10",
  },
  {
    label: "Dashboard",
    description: "Full admin dashboard with invoices, orders, and more",
    href: "/dashboard",
    icon: "⚙️",
    color: "from-gray-500/10 to-gray-600/5 border-gray-500/20 hover:border-gray-500/50",
    iconBg: "bg-gray-500/10",
  },
];

export default function AdminIndexPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const user = data?.user;
      if (!user) { router.replace("/login"); return; }
      const role = user.user_metadata?.role || user.app_metadata?.role;
      if (role !== "admin") { router.replace("/"); return; }
      setChecking(false);
    });
  }, [router]);

  if (checking) {
    return (
      <div className="min-h-screen bg-[#030712] flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#030712] text-gray-100 p-6 md:p-10">
      <div className="max-w-4xl mx-auto">
        <div className="mb-10">
          <p className="text-xs font-semibold uppercase tracking-widest text-cyan-500 mb-2">Admin Panel</p>
          <h1 className="text-3xl font-bold text-white">Control Center</h1>
          <p className="text-gray-400 mt-1 text-sm">Manage all aspects of the Tech Ninja platform</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {sections.map((s) => (
            <Link
              key={s.href}
              href={s.href}
              className={`bg-gradient-to-br ${s.color} border rounded-2xl p-6 flex flex-col gap-3 transition-all duration-200 hover:scale-[1.02]`}
            >
              <div className={`w-10 h-10 rounded-xl ${s.iconBg} flex items-center justify-center text-xl`}>
                {s.icon}
              </div>
              <div>
                <h2 className="font-bold text-white text-base">{s.label}</h2>
                <p className="text-gray-400 text-xs mt-0.5 leading-relaxed">{s.description}</p>
              </div>
              <span className="text-xs text-cyan-400 font-semibold mt-auto">Open →</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
