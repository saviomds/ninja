"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import Image from "next/image";
import Link from "next/link";
import Navbar from "@/components/Navbar";

interface Product {
  id: string;
  name: string;
  description: string;
  image: string;
  price: number;
  stock: number;
  category?: string;
  created_at?: string;
}

function imgSrc(url: string) {
  return url.replace("/object/public/", "/render/image/public/");
}

function StockPill({ stock }: { stock: number }) {
  if (stock === 0)
    return (
      <span className="text-[11px] font-semibold text-red-500 bg-red-50 dark:bg-red-900/20 px-2.5 py-1 rounded-full">
        Sold out
      </span>
    );
  if (stock <= 5)
    return (
      <span className="text-[11px] font-semibold text-orange-500 bg-orange-50 dark:bg-orange-900/20 px-2.5 py-1 rounded-full">
        Only {stock} left
      </span>
    );
  return (
    <span className="text-[11px] font-semibold text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 px-2.5 py-1 rounded-full">
      In stock
    </span>
  );
}

export default function WishlistPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [wishlistIds, setWishlistIds] = useState<string[]>([]);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      let ids: string[] = [];

      if (user) {
        // Logged in: pull from DB
        const { data: rows } = await supabase.from("wishlists").select("product_id").eq("user_id", user.id);
        ids = (rows || []).map((r: { product_id: string }) => r.product_id);
        localStorage.setItem("tn-wishlist", JSON.stringify(ids));
      } else {
        // Guest: use localStorage
        const raw = localStorage.getItem("tn-wishlist");
        ids = raw ? (JSON.parse(raw) as string[]) : [];
      }

      setWishlistIds(ids);
      if (ids.length === 0) { setLoading(false); return; }

      const { data } = await supabase.from("products").select("*").eq("is_public", true).in("id", ids);
      setProducts((data as Product[]) || []);
      setLoading(false);
    })();
  }, []);

  const removeFromWishlist = async (id: string) => {
    const next = wishlistIds.filter((wid) => wid !== id);
    setWishlistIds(next);
    setProducts((prev) => prev.filter((p) => p.id !== id));
    localStorage.setItem("tn-wishlist", JSON.stringify(next));
    const { data: { user } } = await supabase.auth.getUser();
    if (user) await supabase.from("wishlists").delete().eq("user_id", user.id).eq("product_id", id);
  };

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 pt-16">
      <Navbar />

      <div className="max-w-7xl mx-auto px-5 lg:px-8 py-12">
        {/* Header */}
        <div className="flex items-center gap-4 mb-10">
          <div>
            <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-gray-900 dark:text-white flex items-center gap-3">
              My Wishlist
              {!loading && wishlistIds.length > 0 && (
                <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-[#2563EB] text-white text-sm font-bold">
                  {wishlistIds.length}
                </span>
              )}
            </h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm">
              Products you&apos;ve saved for later
            </p>
          </div>
        </div>

        {/* Loading skeleton */}
        {loading && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
            {[...Array(4)].map((_, i) => (
              <div
                key={i}
                className="bg-gray-100 dark:bg-gray-800 rounded-2xl overflow-hidden animate-pulse"
              >
                <div className="aspect-square bg-gray-200 dark:bg-gray-700" />
                <div className="p-4 space-y-2">
                  <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/3" />
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
                  <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
                  <div className="h-9 bg-gray-200 dark:bg-gray-700 rounded-xl mt-3" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && wishlistIds.length === 0 && (
          <div className="flex flex-col items-center justify-center py-32 text-center">
            <div className="w-24 h-24 rounded-3xl bg-red-50 dark:bg-red-900/20 flex items-center justify-center mb-6">
              <svg
                className="w-12 h-12 text-red-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              Your wishlist is empty
            </h2>
            <p className="text-gray-500 dark:text-gray-400 mb-8 max-w-sm">
              Browse our shop and tap the heart icon on products you love to save
              them here.
            </p>
            <Link
              href="/Clients"
              className="inline-flex items-center gap-2 bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-semibold px-8 py-3 rounded-xl transition-colors shadow-lg shadow-[#2563EB]/20"
            >
              Browse Shop
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M17 8l4 4m0 0l-4 4m4-4H3"
                />
              </svg>
            </Link>
          </div>
        )}

        {/* Product grid */}
        {!loading && products.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
            {products.map((product) => (
              <div
                key={product.id}
                className="group bg-white dark:bg-gray-900 rounded-2xl overflow-hidden border border-gray-100 dark:border-gray-800 shadow-sm hover:shadow-[0_8px_30px_rgba(0,0,0,0.10)] dark:hover:shadow-[0_8px_30px_rgba(0,0,0,0.4)] hover:-translate-y-1 transition-all duration-300 flex flex-col"
              >
                {/* Image */}
                <div className="relative aspect-square bg-gray-50 dark:bg-gray-800 overflow-hidden">
                  {product.image ? (
                    <Image
                      src={imgSrc(product.image)}
                      alt={product.name}
                      fill
                      unoptimized
                      className="object-cover group-hover:scale-[1.06] transition-transform duration-500"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src =
                          "https://placehold.co/400x400/F5F7FA/9CA3AF?text=";
                      }}
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-blue-50 to-blue-100 dark:from-gray-700 dark:to-gray-600">
                      <svg
                        className="w-12 h-12 text-gray-200 dark:text-gray-600"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1}
                          d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                        />
                      </svg>
                    </div>
                  )}

                  {/* Sold out overlay */}
                  {product.stock === 0 && (
                    <div className="absolute inset-0 bg-white/70 dark:bg-gray-900/70 backdrop-blur-[2px] flex items-center justify-center">
                      <span className="text-[12px] font-bold text-gray-500 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 px-3 py-1.5 rounded-full shadow-sm">
                        Sold out
                      </span>
                    </div>
                  )}

                  {/* Remove from wishlist button */}
                  <button
                    onClick={() => removeFromWishlist(product.id)}
                    title="Remove from wishlist"
                    className="absolute top-3 right-3 z-10 w-8 h-8 rounded-full bg-red-500 text-white flex items-center justify-center shadow-lg hover:bg-red-600 transition-all opacity-0 group-hover:opacity-100"
                  >
                    <svg
                      className="w-4 h-4"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                      />
                    </svg>
                  </button>
                </div>

                {/* Info */}
                <div className="p-4 flex flex-col flex-1">
                  {/* Category */}
                  {product.category && (
                    <span className="text-[10px] font-semibold text-[#2563EB] bg-[#2563EB]/10 px-2 py-0.5 rounded-full w-fit mb-2">
                      {product.category}
                    </span>
                  )}

                  {/* Name */}
                  <h3 className="text-[14px] font-bold text-gray-900 dark:text-white leading-snug mb-2 line-clamp-2 flex-1">
                    {product.name}
                  </h3>

                  {/* Price + stock */}
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-[16px] font-black text-gray-900 dark:text-white">
                      Rs {product.price.toLocaleString()}
                    </p>
                    <StockPill stock={product.stock} />
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    <Link
                      href={`/product/${product.id}`}
                      className="flex-1 bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-semibold py-2.5 rounded-xl text-[13px] transition-all text-center shadow-[0_2px_8px_rgba(37,99,235,0.25)]"
                    >
                      Order Now
                    </Link>
                    <button
                      onClick={() => removeFromWishlist(product.id)}
                      title="Remove"
                      className="w-10 h-10 rounded-xl border border-gray-200 dark:border-gray-700 flex items-center justify-center text-gray-400 hover:text-red-500 hover:border-red-200 dark:hover:border-red-500/30 transition-all"
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Footer nav */}
        {!loading && wishlistIds.length > 0 && (
          <div className="mt-12 flex justify-center">
            <Link
              href="/Clients"
              className="inline-flex items-center gap-2 text-[#2563EB] hover:text-[#1D4ED8] font-semibold text-sm transition-colors"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M10 19l-7-7m0 0l7-7m-7 7h18"
                />
              </svg>
              Continue shopping
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
