"use client";

import Image from "next/image";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import { supabase } from "@/lib/supabase";
import { useState, useEffect } from "react";
import { User } from "@supabase/supabase-js";

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

interface OrderForm {
  name: string;
  email: string;
  phone: string;
  notes: string;
  quantity: number;
}

function imgSrc(url: string) {
  return url.replace("/object/public/", "/render/image/public/");
}

function StockBadge({ stock }: { stock: number }) {
  if (stock === 0)
    return (
      <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-red-500 dark:text-red-400">
        <span className="w-2 h-2 rounded-full bg-red-500 dark:bg-red-400" />
        Sold out
      </span>
    );
  if (stock <= 5)
    return (
      <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#ff9500]">
        <span className="w-2 h-2 rounded-full bg-[#ff9500]" />
        Only {stock} left
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#34c759] dark:text-[#30d158]">
      <span className="w-2 h-2 rounded-full bg-[#34c759] dark:bg-[#30d158]" />
      In stock
    </span>
  );
}

export default function ProductDetailClient({ product }: { product: Product }) {
  const [user, setUser] = useState<User | null>(null);
  const [toast, setToast] = useState<{ msg: string; type?: "success" | "error" } | null>(null);
  const [orderOpen, setOrderOpen] = useState(false);
  const [orderForm, setOrderForm] = useState<OrderForm>({
    name: "",
    email: "",
    phone: "",
    notes: "",
    quantity: 1,
  });
  const [orderLoading, setOrderLoading] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(false);
  const [copied, setCopied] = useState(false);

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data?.user ?? null);
      if (data?.user?.email) {
        setOrderForm((f) => ({ ...f, email: data.user!.email! }));
      }
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const handleCopyLink = () => {
    navigator.clipboard
      .writeText(window.location.href)
      .then(() => {
        setCopied(true);
        showToast("Link copied!");
        setTimeout(() => setCopied(false), 2000);
      })
      .catch(() => showToast("Could not copy link", "error"));
  };

  const openOrder = () => {
    setOrderSuccess(false);
    setOrderForm((f) => ({ ...f, quantity: 1 }));
    setOrderOpen(true);
  };

  const handlePlaceOrder = async () => {
    if (!orderForm.name.trim() || !orderForm.email.trim()) {
      showToast("Name and email are required", "error");
      return;
    }
    setOrderLoading(true);
    const { error } = await supabase.from("orders").insert({
      product_id: product.id,
      product_name: product.name,
      quantity: orderForm.quantity,
      price: product.price * orderForm.quantity,
      client_name: orderForm.name.trim(),
      client_email: orderForm.email.trim(),
      client_phone: orderForm.phone.trim() || null,
      notes: orderForm.notes.trim() || null,
      status: "pending",
    });
    setOrderLoading(false);
    if (error) showToast("Failed to place order. Please try again.", "error");
    else setOrderSuccess(true);
  };

  const inputCls =
    "w-full bg-[#f5f5f7] dark:bg-[#2c2c2e] border border-[#d2d2d7] dark:border-[#3a3a3c] rounded-xl px-4 py-2.5 text-[14px] text-[#1d1d1f] dark:text-[#f5f5f7] placeholder-[#b0b0b5] dark:placeholder-[#48484a] focus:outline-none focus:border-[#0071e3] dark:focus:border-[#0a84ff] transition-colors";

  const isNew =
    product.created_at &&
    Date.now() - new Date(product.created_at).getTime() < 7 * 24 * 60 * 60 * 1000;

  // suppress unused-var warning for user; kept for potential auth-gated features
  void user;

  return (
    <div className="min-h-screen bg-white dark:bg-black text-[#1d1d1f] dark:text-[#f5f5f7]">
      <Navbar />

      <main className="max-w-7xl mx-auto px-6 sm:px-10 lg:px-20 pt-28 pb-24">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-[13px] text-[#6e6e73] dark:text-[#98989d] mb-12 flex-wrap">
          <Link href="/" className="hover:text-[#1d1d1f] dark:hover:text-[#f5f5f7] transition-colors">
            Home
          </Link>
          <span>/</span>
          <Link href="/Clients" className="hover:text-[#1d1d1f] dark:hover:text-[#f5f5f7] transition-colors">
            Shop
          </Link>
          <span>/</span>
          <span className="text-[#1d1d1f] dark:text-[#f5f5f7] truncate max-w-[200px]">{product.name}</span>
        </nav>

        <div className="grid lg:grid-cols-2 gap-12 xl:gap-20 items-start">
          {/* ── Image ── */}
          <div className="relative">
            {isNew && (
              <div className="absolute top-4 left-4 z-10">
                <span className="text-[11px] font-semibold bg-[#0071e3] dark:bg-[#0a84ff] text-white px-2.5 py-1 rounded-full">
                  New
                </span>
              </div>
            )}
            <div
              className="relative rounded-3xl overflow-hidden bg-[#f5f5f7] dark:bg-[#1c1c1e] border border-[#e8e8ed] dark:border-[#3a3a3c]"
              style={{ aspectRatio: "1/1" }}
            >
              {product.image ? (
                <Image
                  src={imgSrc(product.image)}
                  alt={product.name}
                  fill
                  unoptimized
                  className="object-contain p-8"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src =
                      "https://placehold.co/600x600/f5f5f7/86868b?text=";
                  }}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-[#6e6e73] dark:text-[#98989d]">
                  No image
                </div>
              )}
            </div>
          </div>

          {/* ── Info ── */}
          <div className="flex flex-col gap-6">
            {product.category && (
              <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#0071e3] dark:text-[#0a84ff] bg-[#e8f0fb] dark:bg-[#0a84ff]/15 px-3 py-1.5 rounded-full self-start">
                {product.category}
              </span>
            )}

            <div>
              <h1 className="text-[32px] sm:text-[40px] font-bold tracking-tight leading-[1.1] text-[#1d1d1f] dark:text-[#f5f5f7] mb-3">
                {product.name}
              </h1>
              <p className="text-[34px] font-bold text-[#1d1d1f] dark:text-[#f5f5f7]">
                Rs {product.price.toLocaleString()}
              </p>
            </div>

            <StockBadge stock={product.stock} />

            {product.description && (
              <p className="text-[15px] text-[#6e6e73] dark:text-[#98989d] leading-relaxed">
                {product.description}
              </p>
            )}

            {/* Details table */}
            <div className="border-t border-[#e8e8ed] dark:border-[#3a3a3c] pt-5 space-y-3">
              {product.category && (
                <div className="flex items-center justify-between text-[13px]">
                  <span className="text-[#6e6e73] dark:text-[#98989d] font-medium">Category</span>
                  <span className="text-[#1d1d1f] dark:text-[#f5f5f7]">{product.category}</span>
                </div>
              )}
              <div className="flex items-center justify-between text-[13px]">
                <span className="text-[#6e6e73] dark:text-[#98989d] font-medium">Stock</span>
                <span className="text-[#1d1d1f] dark:text-[#f5f5f7]">
                  {product.stock === 0 ? "Out of stock" : `${product.stock} units`}
                </span>
              </div>
              {product.created_at && (
                <div className="flex items-center justify-between text-[13px]">
                  <span className="text-[#6e6e73] dark:text-[#98989d] font-medium">Added</span>
                  <span className="text-[#1d1d1f] dark:text-[#f5f5f7]">
                    {new Date(product.created_at).toLocaleDateString("en-US", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                  </span>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-3 pt-1">
              <button
                onClick={openOrder}
                disabled={product.stock === 0}
                className="flex-1 bg-[#0071e3] dark:bg-[#0a84ff] hover:bg-[#0077ed] dark:hover:bg-[#409cff] disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold py-3.5 rounded-2xl text-[15px] transition-colors shadow-sm"
              >
                {product.stock === 0 ? "Sold out" : "Order now"}
              </button>
              <button
                onClick={handleCopyLink}
                className="flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl border border-[#d2d2d7] dark:border-[#3a3a3c] bg-[#f5f5f7] dark:bg-[#1c1c1e] hover:border-[#b0b0b5] dark:hover:border-[#48484a] text-[#1d1d1f] dark:text-[#f5f5f7] font-semibold text-[15px] transition-all"
              >
                {copied ? (
                  <>
                    <svg className="w-4 h-4 text-[#34c759]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    Copied!
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                    </svg>
                    Share link
                  </>
                )}
              </button>
            </div>

            <Link
              href="/Clients"
              className="inline-flex items-center gap-1.5 text-[13px] text-[#6e6e73] dark:text-[#98989d] hover:text-[#0071e3] dark:hover:text-[#0a84ff] transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
              Back to shop
            </Link>
          </div>
        </div>
      </main>

      {/* ══════════════════ ORDER MODAL ══════════════════ */}
      {orderOpen && (
        <div
          className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center p-0 sm:p-6 bg-black/40 dark:bg-black/70 backdrop-blur-md"
          onClick={() => { setOrderOpen(false); setOrderSuccess(false); }}
        >
          <div
            className="bg-white dark:bg-[#2c2c2e] border border-[#e8e8ed] dark:border-[#3a3a3c] w-full sm:max-w-lg sm:rounded-3xl rounded-t-3xl overflow-hidden shadow-2xl max-h-[95vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {orderSuccess ? (
              <div className="p-10 text-center space-y-4">
                <div className="w-16 h-16 rounded-full bg-[#e8f0fb] dark:bg-[#0a84ff]/15 flex items-center justify-center mx-auto">
                  <svg className="w-8 h-8 text-[#0071e3] dark:text-[#0a84ff]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h3 className="text-[24px] font-bold text-[#1d1d1f] dark:text-[#f5f5f7]">Order placed!</h3>
                <p className="text-[#6e6e73] dark:text-[#98989d] text-[15px] leading-relaxed">
                  Thank you, <strong className="text-[#1d1d1f] dark:text-[#f5f5f7]">{orderForm.name}</strong>! We&apos;ve
                  received your order for{" "}
                  <strong className="text-[#1d1d1f] dark:text-[#f5f5f7]">{product.name}</strong> and will be in touch
                  shortly.
                </p>
                <button
                  onClick={() => { setOrderOpen(false); setOrderSuccess(false); }}
                  className="mt-4 bg-[#f5f5f7] dark:bg-[#3a3a3c] border border-[#d2d2d7] dark:border-[#48484a] text-[#1d1d1f] dark:text-[#f5f5f7] font-semibold px-8 py-3 rounded-2xl text-[15px] hover:bg-[#e8e8ed] dark:hover:bg-[#48484a] transition-all"
                >
                  Done
                </button>
              </div>
            ) : (
              <div className="p-6 sm:p-8">
                <div className="flex items-start justify-between mb-6">
                  <div>
                    <h3 className="text-[20px] font-bold text-[#1d1d1f] dark:text-[#f5f5f7]">Place an order</h3>
                    <p className="text-[14px] text-[#6e6e73] dark:text-[#98989d] mt-1">Fill in your details to complete</p>
                  </div>
                  <button
                    onClick={() => { setOrderOpen(false); setOrderSuccess(false); }}
                    className="w-8 h-8 flex items-center justify-center rounded-full bg-[#f5f5f7] dark:bg-[#3a3a3c] hover:bg-[#e8e8ed] dark:hover:bg-[#48484a] text-[#6e6e73] dark:text-[#98989d] transition-all text-sm flex-shrink-0"
                  >
                    ✕
                  </button>
                </div>

                {/* Product summary */}
                <div className="flex items-center gap-4 bg-[#f5f5f7] dark:bg-[#1c1c1e] border border-[#e8e8ed] dark:border-[#3a3a3c] rounded-2xl p-4 mb-6">
                  <div className="relative w-16 h-16 rounded-xl overflow-hidden bg-[#e8e8ed] dark:bg-[#2c2c2e] flex-shrink-0">
                    {product.image ? (
                      <Image
                        src={imgSrc(product.image)}
                        alt={product.name}
                        fill
                        unoptimized
                        className="object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src =
                            "https://placehold.co/64x64/f5f5f7/86868b?text=?";
                        }}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-[#6e6e73] text-xs">?</div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-[#1d1d1f] dark:text-[#f5f5f7] text-[14px] truncate">{product.name}</p>
                    {product.category && (
                      <p className="text-[12px] text-[#0071e3] dark:text-[#0a84ff] mt-0.5">{product.category}</p>
                    )}
                    <p className="text-[14px] font-bold text-[#1d1d1f] dark:text-[#f5f5f7] mt-1">
                      Rs {product.price.toLocaleString()} / unit
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => setOrderForm((f) => ({ ...f, quantity: Math.max(1, f.quantity - 1) }))}
                      className="w-8 h-8 rounded-full border border-[#d2d2d7] dark:border-[#3a3a3c] bg-[#f5f5f7] dark:bg-[#2c2c2e] flex items-center justify-center text-[#6e6e73] dark:text-[#98989d] hover:bg-[#e8e8ed] dark:hover:bg-[#3a3a3c] transition-all font-bold text-lg leading-none"
                    >
                      −
                    </button>
                    <span className="w-6 text-center text-[14px] font-bold text-[#1d1d1f] dark:text-[#f5f5f7]">
                      {orderForm.quantity}
                    </span>
                    <button
                      onClick={() =>
                        setOrderForm((f) => ({ ...f, quantity: Math.min(product.stock || 99, f.quantity + 1) }))
                      }
                      className="w-8 h-8 rounded-full border border-[#d2d2d7] dark:border-[#3a3a3c] bg-[#f5f5f7] dark:bg-[#2c2c2e] flex items-center justify-center text-[#6e6e73] dark:text-[#98989d] hover:bg-[#e8e8ed] dark:hover:bg-[#3a3a3c] transition-all font-bold text-lg leading-none"
                    >
                      +
                    </button>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {[
                      { label: "Full name", key: "name",  type: "text",  placeholder: "Your name",        required: true  },
                      { label: "Email",     key: "email", type: "email", placeholder: "you@example.com",  required: true  },
                    ].map(({ label, key, type, placeholder, required }) => (
                      <div key={key}>
                        <label className="block text-[11px] font-semibold text-[#6e6e73] dark:text-[#98989d] uppercase tracking-wider mb-1.5">
                          {label} {required && <span className="text-red-500">*</span>}
                        </label>
                        <input
                          type={type}
                          value={orderForm[key as keyof OrderForm] as string}
                          onChange={(e) => setOrderForm((f) => ({ ...f, [key]: e.target.value }))}
                          placeholder={placeholder}
                          className={inputCls}
                        />
                      </div>
                    ))}
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-[#6e6e73] dark:text-[#98989d] uppercase tracking-wider mb-1.5">
                      Phone
                    </label>
                    <input
                      type="tel"
                      value={orderForm.phone}
                      onChange={(e) => setOrderForm((f) => ({ ...f, phone: e.target.value }))}
                      placeholder="+230 xxx xxxx"
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-[#6e6e73] dark:text-[#98989d] uppercase tracking-wider mb-1.5">
                      Notes
                    </label>
                    <textarea
                      value={orderForm.notes}
                      onChange={(e) => setOrderForm((f) => ({ ...f, notes: e.target.value }))}
                      placeholder="Delivery address, special instructions…"
                      rows={3}
                      className={inputCls + " resize-none"}
                    />
                  </div>
                </div>

                <div className="mt-6 pt-5 border-t border-[#e8e8ed] dark:border-[#3a3a3c]">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-[14px] text-[#6e6e73] dark:text-[#98989d]">
                      Total ({orderForm.quantity} × Rs {product.price.toLocaleString()})
                    </span>
                    <span className="text-[22px] font-bold text-[#1d1d1f] dark:text-[#f5f5f7]">
                      Rs {(product.price * orderForm.quantity).toLocaleString()}
                    </span>
                  </div>
                  <button
                    onClick={handlePlaceOrder}
                    disabled={orderLoading || !orderForm.name.trim() || !orderForm.email.trim()}
                    className="w-full bg-[#0071e3] dark:bg-[#0a84ff] hover:bg-[#0077ed] disabled:opacity-30 disabled:cursor-not-allowed text-white font-semibold py-3.5 rounded-2xl transition-all text-[15px] flex items-center justify-center gap-2"
                  >
                    {orderLoading ? (
                      <>
                        <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        Placing order…
                      </>
                    ) : (
                      `Place order · Rs ${(product.price * orderForm.quantity).toLocaleString()}`
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div
          className={`fixed bottom-8 left-1/2 -translate-x-1/2 z-[200] text-[14px] font-semibold px-6 py-3 rounded-full shadow-2xl transition-all ${
            toast.type === "error"
              ? "bg-red-500 text-white"
              : "bg-[#1d1d1f] dark:bg-[#f5f5f7] text-white dark:text-[#1d1d1f]"
          }`}
        >
          {toast.msg}
        </div>
      )}
    </div>
  );
}
