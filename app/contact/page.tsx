"use client";
import { useState, useEffect } from "react";
import Navbar from "@/components/Navbar";
import { supabase } from "@/lib/supabase";

interface Settings {
  address: string;
  phone: string;
  email: string;
  hours: string;
  whatsapp: string;
}

const DEFAULTS: Settings = {
  address:  "Port Louis, Mauritius",
  phone:    "+230 5800 0000",
  email:    "hello@techninja.mu",
  hours:    "Mon–Sat: 9:00 AM – 8:00 PM",
  whatsapp: "2305800000",
};

export default function ContactPage() {
  const [form, setForm] = useState({ name: "", email: "", subject: "", message: "" });
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [settings, setSettings] = useState<Settings>(DEFAULTS);

  useEffect(() => {
    supabase.from("site_settings").select("key, value").then(({ data }) => {
      if (!data) return;
      const map = Object.fromEntries(data.map((r) => [r.key, r.value]));
      setSettings({
        address:  map.contact_address  || DEFAULTS.address,
        phone:    map.contact_phone    || DEFAULTS.phone,
        email:    map.contact_email    || DEFAULTS.email,
        hours:    map.contact_hours    || DEFAULTS.hours,
        whatsapp: map.contact_whatsapp || DEFAULTS.whatsapp,
      });
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("sending");
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      setStatus(res.ok ? "sent" : "error");
    } catch {
      setStatus("error");
    }
  };

  const inputCls = "w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/10 transition-all";

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100">
      <Navbar />
      <div className="max-w-6xl mx-auto px-5 lg:px-8 pt-28 pb-20">

        <p className="text-[11px] font-semibold tracking-[0.2em] uppercase text-[#2563EB] mb-4">Get in touch</p>
        <h1 className="text-4xl sm:text-5xl font-black tracking-tight text-gray-900 dark:text-white mb-3">
          Contact <span className="text-[#2563EB]">Us</span>
        </h1>
        <p className="text-gray-500 dark:text-gray-400 mb-12 max-w-xl">
          Questions about a repair, order, or just want to say hello? We&apos;re here to help.
        </p>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">

          {/* Contact details */}
          <div className="space-y-6">
            {[
              { icon: "📍", label: "Address",       value: settings.address },
              { icon: "📞", label: "Phone",          value: settings.phone   },
              { icon: "✉️", label: "Email",          value: settings.email   },
              { icon: "🕐", label: "Business Hours", value: settings.hours   },
            ].map(({ icon, label, value }) => (
              <div key={label} className="flex items-start gap-4 p-5 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl">
                <span className="text-2xl">{icon}</span>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-0.5">{label}</p>
                  <p className="text-[14px] font-medium text-gray-900 dark:text-white">{value}</p>
                </div>
              </div>
            ))}

            <div className="p-5 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800/40 rounded-2xl">
              <p className="text-[13px] font-semibold text-green-800 dark:text-green-400 mb-1">WhatsApp Support</p>
              <p className="text-[12px] text-green-700 dark:text-green-500 mb-3">Chat with us directly for quick answers.</p>
              <a
                href={`https://wa.me/${settings.whatsapp}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 bg-green-500 hover:bg-green-600 text-white text-[13px] font-semibold px-4 py-2 rounded-lg transition-colors"
              >
                Open WhatsApp
              </a>
            </div>
          </div>

          {/* Contact form */}
          <div>
            {status === "sent" ? (
              <div className="flex flex-col items-center justify-center h-full py-12 text-center">
                <div className="w-16 h-16 rounded-2xl bg-green-50 dark:bg-green-900/20 flex items-center justify-center mb-4">
                  <svg className="w-8 h-8 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Message sent!</h3>
                <p className="text-gray-500 text-sm mb-6">We&apos;ll get back to you within 24 hours.</p>
                <button
                  onClick={() => { setForm({ name: "", email: "", subject: "", message: "" }); setStatus("idle"); }}
                  className="text-[#2563EB] text-sm font-semibold hover:underline"
                >
                  Send another message
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1.5">Name</label>
                    <input required value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="John Doe" className={inputCls} />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1.5">Email</label>
                    <input required type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} placeholder="john@email.com" className={inputCls} />
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1.5">Subject</label>
                  <input required value={form.subject} onChange={e => setForm(p => ({ ...p, subject: e.target.value }))} placeholder="Repair quote, order help, general enquiry…" className={inputCls} />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1.5">Message</label>
                  <textarea required rows={6} value={form.message} onChange={e => setForm(p => ({ ...p, message: e.target.value }))} placeholder="Tell us how we can help…" className={`${inputCls} resize-none`} />
                </div>
                {status === "error" && (
                  <p className="text-red-500 text-sm">Something went wrong. Please email us directly at {settings.email}</p>
                )}
                <button
                  type="submit"
                  disabled={status === "sending"}
                  className="w-full bg-[#2563EB] hover:bg-[#1D4ED8] disabled:opacity-60 text-white font-semibold py-3 rounded-xl transition-colors"
                >
                  {status === "sending" ? "Sending…" : "Send Message"}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
