"use client";

import Navbar from "@/components/Navbar";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import Image from "next/image";
import { User } from "@supabase/supabase-js";

interface Product {
  id: string;
  name: string;
  description: string;
  image: string;
  price: number;
  stock: number;
}

interface SocialProfile {
  id: string;
  platform_name: string;
  platform_icon: string;
  profile_link: string;
  username: string;
  description?: string;
}

interface AppUpdate {
  id: string;
  info: string;
  content: string;
  link: string;
  created_at?: string;
}

export default function Home() {
  const [products, setProducts] = useState<Product[]>([]);
  const [socialProfiles, setSocialProfiles] = useState<SocialProfile[]>([]);
  const [updates, setUpdates] = useState<AppUpdate[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAllData = async () => {
      const [productsRes, socialRes, updatesRes, authRes] = await Promise.all([
        supabase.from("products").select("*").order("created_at", { ascending: false }),
        // Only fetch safe fields—excluding email and password!
        supabase.from("social_profiles").select("id, platform_name, platform_icon, profile_link, username, description").order("created_at", { ascending: false }),
        supabase.from("updates").select("*").order("created_at", { ascending: false }),
        supabase.auth.getUser(),
      ]);

      setProducts(productsRes.data || []);
      setSocialProfiles(socialRes.data || []);
      setUpdates(updatesRes.data || []);
      setUser(authRes.data?.user || null);
      setLoading(false);
    };

    fetchAllData();

    // Listen for auth changes (e.g., if they log out via the Navbar)
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user || null);
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  return (
    <main className="min-h-screen bg-gray-950 text-white">
      <Navbar />

      {/* Hero Section */}
      <section className="relative py-24 flex flex-col items-center justify-center text-center px-4 overflow-hidden border-b border-gray-800/50">
        <div className="absolute inset-0 bg-gradient-to-b from-indigo-500/10 to-transparent pointer-events-none" />
        <h1 className="text-5xl md:text-6xl font-extrabold mb-6 text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-400 tracking-tight relative z-10">
          Join. Connect. Earn.
        </h1>
        <p className="text-lg text-gray-400 mb-8 max-w-2xl relative z-10">
          A simple platform to manage projects, share work, and stay updated with the latest announcements.
        </p>
        <Link href={user ? "/dashboard" : "/login"} className="relative z-10 bg-white text-black px-8 py-3 rounded-full font-semibold hover:bg-gray-200 hover:scale-105 transition-all duration-200 shadow-[0_0_20px_rgba(255,255,255,0.2)]">
          {user ? "Jump In" : "Get Started"}
        </Link>
      </section>

      {loading ? (
        <div className="max-w-6xl mx-auto px-6 py-20 flex justify-center">
          <div className="animate-pulse flex flex-col items-center gap-4">
            <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-gray-400 font-medium">Loading platform data...</p>
          </div>
        </div>
      ) : (
        <div className="max-w-6xl mx-auto px-6 py-16 space-y-24">
          
          {/* Updates Section */}
          {updates.length > 0 && (
            <section>
              <div className="mb-8 border-b border-gray-800 pb-4">
                <h2 className="text-3xl font-bold text-white">Latest Updates</h2>
                <p className="text-gray-400 mt-2">Platform announcements and snippets</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {updates.map((update) => (
                  <div key={update.id} className="bg-gray-900/40 backdrop-blur-md border border-gray-800 rounded-2xl p-6 hover:border-emerald-500/50 transition-colors">
                    <div className="flex items-start justify-between mb-4">
                      <h3 className="text-xl font-bold text-white">{update.info}</h3>
                      {update.created_at && (
                        <span className="text-xs text-gray-500 bg-gray-900 px-2 py-1 rounded-md border border-gray-800">
                          {new Date(update.created_at).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                    <p className="text-gray-300 text-sm leading-relaxed whitespace-pre-wrap mb-4">{update.content}</p>
                    {update.link && (
                      <a href={update.link.startsWith('http') ? update.link : `https://${update.link}`} target="_blank" rel="noopener noreferrer" className="text-emerald-400 hover:text-emerald-300 text-sm font-medium inline-flex items-center gap-1 transition-colors">
                        Read more ↗
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Social Profiles Section */}
          {socialProfiles.length > 0 && (
            <section>
              <div className="mb-8 border-b border-gray-800 pb-4">
                <h2 className="text-3xl font-bold text-white">Connect With Us</h2>
                <p className="text-gray-400 mt-2">Find us across different platforms</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {socialProfiles.map((profile) => (
                  <div key={profile.id} className="group bg-gray-900/40 backdrop-blur-md border border-gray-800 rounded-2xl p-5 hover:border-indigo-500/50 transition-all duration-300 flex flex-col">
                    <div className="flex items-center gap-4 mb-4">
                      {profile.platform_icon ? (
                        <Image src={profile.platform_icon} alt={profile.platform_name} width={48} height={48} unoptimized className="w-12 h-12 rounded-xl object-cover bg-gray-800 border border-gray-700" />
                      ) : (
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-gray-800 to-gray-700 border border-gray-600 flex items-center justify-center text-xl font-bold text-gray-300">
                          {profile.platform_name.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className="overflow-hidden">
                        <h3 className="text-lg font-bold text-white truncate">{profile.platform_name}</h3>
                        {profile.username && <p className="text-sm text-gray-400 truncate">@{profile.username}</p>}
                      </div>
                    </div>
                    {profile.description && (
                      <p className="text-sm text-gray-400 mb-6 line-clamp-3 flex-1">{profile.description}</p>
                    )}
                    <a href={profile.profile_link.startsWith('http') ? profile.profile_link : `https://${profile.profile_link}`} target="_blank" rel="noopener noreferrer" className="mt-auto w-full block text-center bg-gray-800 hover:bg-indigo-600 text-white py-2.5 rounded-xl text-sm font-medium transition-all border border-gray-700 hover:border-indigo-500">
                      Visit Profile
                    </a>
                  </div>
                ))}
              </div>
            </section>
          )}
          {/* Products Section */}
          {products.length > 0 && (
            <section>
              <div className="mb-8 border-b border-gray-800 pb-4">
                <h2 className="text-3xl font-bold text-white">Featured Products</h2>
                <p className="text-gray-400 mt-2">Explore our latest available items</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {products.map((product) => (
                  <div key={product.id} className="group bg-gray-900/40 backdrop-blur-md border border-gray-800 rounded-2xl overflow-hidden hover:border-gray-700 transition-all duration-300 hover:shadow-2xl hover:shadow-black/50 flex flex-col">
                    <div className="aspect-[4/3] w-full bg-gray-800 relative overflow-hidden">
                      {product.image ? (
                        <Image src={product.image} alt={product.name} fill unoptimized className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-500" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-600">No Image</div>
                      )}
                      <div className="absolute top-3 right-3 bg-black/70 backdrop-blur-md text-white px-3 py-1 rounded-full text-sm font-bold border border-gray-700 shadow-lg">
                        Rs {product.price}
                      </div>
                    </div>
                    <div className="p-5 flex flex-col flex-1">
                      <h3 className="text-lg font-bold text-white mb-2 line-clamp-1">{product.name}</h3>
                      <p className="text-sm text-gray-400 line-clamp-2 mb-4 flex-1">
                        {product.description || "No description provided."}
                      </p>
                      <div className="flex items-center text-xs text-gray-400 bg-gray-950/50 w-fit px-2.5 py-1.5 rounded-md border border-gray-800/50">
                        <span className={`w-2 h-2 rounded-full mr-2 ${product.stock > 0 ? 'bg-green-500' : 'bg-red-500'}`}></span>
                        {product.stock > 0 ? `${product.stock} in stock` : 'Out of stock'}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

        </div>
      )}
    </main>
  );
}