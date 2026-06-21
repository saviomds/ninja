"use client";
import { useState } from "react";
import { supabase } from "@/lib/supabase";
import Navbar from "@/components/Navbar";
import Link from "next/link";

const SERVICES = [
  { id: "screen_repair",       label: "Screen Repair",       icon: "📱", desc: "Cracked or shattered display",          price: "From Rs 1,500", time: "1–2 hrs"  },
  { id: "battery_replacement", label: "Battery Replacement", icon: "🔋", desc: "Poor battery life or swelling",          price: "From Rs 800",   time: "30 min"   },
  { id: "water_damage",        label: "Water Damage",        icon: "💧", desc: "Device got wet",                        price: "From Rs 2,000", time: "24–48 hrs" },
  { id: "charging_port",       label: "Charging Port",       icon: "⚡", desc: "Loose or broken charging port",         price: "From Rs 900",   time: "1–2 hrs"  },
  { id: "camera_repair",       label: "Camera Repair",       icon: "📷", desc: "Blurry, black, or cracked camera",      price: "From Rs 1,200", time: "1–3 hrs"  },
  { id: "laptop_repair",       label: "Laptop Repair",       icon: "💻", desc: "Screen, keyboard, SSD, fan and more",   price: "From Rs 1,500", time: "Same day" },
  { id: "data_recovery",       label: "Data Recovery",       icon: "💾", desc: "Retrieve lost photos, contacts, files", price: "From Rs 600",   time: "1–4 hrs"  },
  { id: "general_diagnosis",   label: "Free Diagnosis",      icon: "🔬", desc: "Not sure what's wrong? We'll check",    price: "Free",          time: "30 min"   },
];

const TIME_SLOTS = [
  "09:00", "09:30", "10:00", "10:30", "11:00", "11:30",
  "13:00", "13:30", "14:00", "14:30", "15:00", "15:30", "16:00", "16:30", "17:00",
];

interface Form {
  service_type: string;
  device_brand: string;
  device_model: string;
  issue_description: string;
  customer_name: string;
  customer_phone: string;
  customer_email: string;
  preferred_date: string;
  preferred_time: string;
}

const empty = (): Form => ({
  service_type: "", device_brand: "", device_model: "",
  issue_description: "", customer_name: "", customer_phone: "",
  customer_email: "", preferred_date: "", preferred_time: "",
});

const inputCls = "w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3.5 py-3 text-[14px] text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/20 transition-all";

export default function BookPage() {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<Form>(empty());
  const [submitting, setSubmitting] = useState(false);
  const [ref, setRef] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const set = (f: keyof Form) => (v: string) => setForm(p => ({ ...p, [f]: v }));

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const minDate = tomorrow.toISOString().split("T")[0];

  const svc = SERVICES.find(s => s.id === form.service_type);

  const submit = async () => {
    if (!form.customer_name.trim() || !form.customer_phone.trim() || !form.preferred_date || !form.preferred_time) {
      setError("Please fill in all required fields."); return;
    }
    setSubmitting(true);
    setError(null);
    const { data, error: err } = await supabase
      .from("appointments")
      .insert({
        service_type:      form.service_type,
        device_brand:      form.device_brand  || null,
        device_model:      form.device_model  || null,
        issue_description: form.issue_description || null,
        customer_name:     form.customer_name.trim(),
        customer_phone:    form.customer_phone.trim(),
        customer_email:    form.customer_email.trim() || null,
        preferred_date:    form.preferred_date,
        preferred_time:    form.preferred_time,
      })
      .select("ref")
      .single();
    setSubmitting(false);
    if (err) { setError("Booking failed: " + err.message); return; }
    setRef(data.ref);
  };

  // ── Success ──────────────────────────────────────────────────────────────────
  if (ref) return (
    <main className="min-h-screen bg-white dark:bg-gray-950 pt-[60px]">
      <Navbar />
      <div className="max-w-lg mx-auto px-6 py-24 text-center">
        <div className="w-20 h-20 rounded-full bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-100 dark:border-emerald-500/20 flex items-center justify-center text-4xl mx-auto mb-6">✅</div>
        <h1 className="text-[28px] font-bold text-gray-900 dark:text-white mb-3">Appointment Booked!</h1>
        <p className="text-[15px] text-gray-500 dark:text-gray-400 mb-8 max-w-sm mx-auto">
          We'll confirm within 30 minutes during business hours. Keep your reference number safe.
        </p>
        <div className="bg-[#F5F7FA] dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-6 mb-8">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-2">Booking Reference</p>
          <p className="font-mono text-[24px] font-bold text-[#2563EB] mb-3">{ref}</p>
          <p className="text-[13px] text-gray-500 dark:text-gray-400">
            {new Date(form.preferred_date + "T12:00").toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })} · {form.preferred_time}
          </p>
          {svc && <p className="text-[12px] text-gray-400 mt-1">{svc.label}</p>}
        </div>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link href="/track"
            className="inline-flex items-center justify-center gap-2 bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-[14px] font-semibold px-6 py-3 rounded-xl transition-colors">
            Track your repair
          </Link>
          <Link href="/"
            className="inline-flex items-center justify-center border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 text-[14px] font-semibold px-6 py-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
            Back to Home
          </Link>
        </div>
      </div>
    </main>
  );

  const STEPS = ["Service", "Device", "Contact", "Date & Time"];

  return (
    <main className="min-h-screen bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 pt-[60px] overflow-x-hidden">
      <Navbar />

      {/* Header */}
      <section className="bg-[#F5F7FA] dark:bg-gray-900 py-12 px-6 sm:px-10">
        <div className="max-w-2xl mx-auto text-center">
          <h1 className="text-[36px] sm:text-[44px] font-bold tracking-tight text-gray-900 dark:text-white mb-3">
            Book an Appointment
          </h1>
          <p className="text-[15px] text-gray-500 dark:text-gray-400 mb-7">
            Reserve your slot and skip the wait. Free diagnosis included.
          </p>

          {/* Step indicator */}
          <div className="flex items-center justify-center gap-0">
            {STEPS.map((label, i) => {
              const s = i + 1;
              const done = step > s;
              const current = step === s;
              return (
                <div key={s} className="flex items-center">
                  <div className="flex flex-col items-center gap-1">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[12px] font-bold transition-all border-2 ${
                      done ? "bg-[#2563EB] border-[#2563EB] text-white" :
                      current ? "bg-[#2563EB] border-[#2563EB] text-white shadow-[0_0_0_3px_rgba(37,99,235,0.2)]" :
                      "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-400"
                    }`}>
                      {done ? "✓" : s}
                    </div>
                    <p className={`text-[10px] font-semibold hidden sm:block ${current ? "text-[#2563EB]" : done ? "text-gray-400" : "text-gray-300 dark:text-gray-600"}`}>
                      {label}
                    </p>
                  </div>
                  {i < STEPS.length - 1 && (
                    <div className={`w-10 sm:w-16 h-0.5 mb-4 mx-1 sm:mx-2 transition-all ${step > s ? "bg-[#2563EB]" : "bg-gray-200 dark:bg-gray-700"}`} />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <div className="max-w-2xl mx-auto px-6 sm:px-10 py-10">

        {/* ── Step 1: Service ──────────────────────────────────────────────────── */}
        {step === 1 && (
          <div>
            <h2 className="text-[18px] font-bold mb-5">What service do you need?</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {SERVICES.map(s => (
                <button key={s.id} onClick={() => { set("service_type")(s.id); setStep(2); }}
                  className={`text-left p-4 rounded-xl border transition-all ${
                    form.service_type === s.id
                      ? "border-[#2563EB] bg-[#2563EB]/5 ring-2 ring-[#2563EB]/20"
                      : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/60 hover:border-[#2563EB]/50 hover:bg-gray-50 dark:hover:bg-gray-800/50"
                  }`}>
                  <span className="text-2xl mb-2 block">{s.icon}</span>
                  <p className="font-semibold text-[14px] mb-0.5">{s.label}</p>
                  <p className="text-[12px] text-gray-500 dark:text-gray-400 mb-2.5">{s.desc}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-[12px] font-bold text-[#2563EB]">{s.price}</span>
                    <span className="text-[11px] text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-full">{s.time}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Step 2: Device ───────────────────────────────────────────────────── */}
        {step === 2 && (
          <div>
            <h2 className="text-[18px] font-bold mb-1">Tell us about your device</h2>
            <p className="text-[13px] text-gray-400 dark:text-gray-500 mb-6">
              Service: <span className="font-semibold text-gray-700 dark:text-gray-300">{svc?.label}</span>
            </p>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[12px] font-semibold text-gray-500 dark:text-gray-400 mb-1.5">Brand</label>
                  <input value={form.device_brand} onChange={e => set("device_brand")(e.target.value)} placeholder="Apple, Samsung…" className={inputCls} />
                </div>
                <div>
                  <label className="block text-[12px] font-semibold text-gray-500 dark:text-gray-400 mb-1.5">Model</label>
                  <input value={form.device_model} onChange={e => set("device_model")(e.target.value)} placeholder="iPhone 15 Pro…" className={inputCls} />
                </div>
              </div>
              <div>
                <label className="block text-[12px] font-semibold text-gray-500 dark:text-gray-400 mb-1.5">Describe the issue (optional)</label>
                <textarea value={form.issue_description} onChange={e => set("issue_description")(e.target.value)} rows={3}
                  placeholder="Tell us more about the problem…"
                  className={`${inputCls} resize-none`} />
              </div>
            </div>
            <div className="flex justify-between mt-8">
              <button onClick={() => setStep(1)} className="text-[14px] text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors">← Back</button>
              <button onClick={() => setStep(3)} className="px-6 py-2.5 bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-[14px] font-semibold rounded-xl transition-colors">Continue →</button>
            </div>
          </div>
        )}

        {/* ── Step 3: Contact ──────────────────────────────────────────────────── */}
        {step === 3 && (
          <div>
            <h2 className="text-[18px] font-bold mb-6">Your contact details</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-[12px] font-semibold text-gray-500 dark:text-gray-400 mb-1.5">Full Name *</label>
                <input value={form.customer_name} onChange={e => set("customer_name")(e.target.value)} placeholder="John Doe" className={inputCls} />
              </div>
              <div>
                <label className="block text-[12px] font-semibold text-gray-500 dark:text-gray-400 mb-1.5">Phone Number *</label>
                <input type="tel" value={form.customer_phone} onChange={e => set("customer_phone")(e.target.value)} placeholder="+230 5XXX XXXX" className={inputCls} />
              </div>
              <div>
                <label className="block text-[12px] font-semibold text-gray-500 dark:text-gray-400 mb-1.5">Email (optional)</label>
                <input type="email" value={form.customer_email} onChange={e => set("customer_email")(e.target.value)} placeholder="you@email.com" className={inputCls} />
              </div>
            </div>
            {error && <p className="text-[13px] text-rose-500 mt-3">{error}</p>}
            <div className="flex justify-between mt-8">
              <button onClick={() => setStep(2)} className="text-[14px] text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors">← Back</button>
              <button onClick={() => {
                if (!form.customer_name.trim() || !form.customer_phone.trim()) { setError("Name and phone are required."); return; }
                setError(null); setStep(4);
              }} className="px-6 py-2.5 bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-[14px] font-semibold rounded-xl transition-colors">Continue →</button>
            </div>
          </div>
        )}

        {/* ── Step 4: Date + Confirm ───────────────────────────────────────────── */}
        {step === 4 && (
          <div>
            <h2 className="text-[18px] font-bold mb-6">Choose your preferred time</h2>
            <div className="space-y-5">
              <div>
                <label className="block text-[12px] font-semibold text-gray-500 dark:text-gray-400 mb-1.5">Preferred Date *</label>
                <input type="date" value={form.preferred_date} min={minDate}
                  onChange={e => set("preferred_date")(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="block text-[12px] font-semibold text-gray-500 dark:text-gray-400 mb-2">Preferred Time *</label>
                <div className="grid grid-cols-5 gap-2">
                  {TIME_SLOTS.map(t => (
                    <button key={t} onClick={() => set("preferred_time")(t)}
                      className={`py-2 rounded-lg text-[12px] font-semibold border transition-all ${
                        form.preferred_time === t
                          ? "bg-[#2563EB] text-white border-[#2563EB]"
                          : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-[#2563EB]/50 hover:bg-gray-50 dark:hover:bg-gray-700/50"
                      }`}>{t}</button>
                  ))}
                </div>
              </div>

              {/* Summary */}
              <div className="bg-[#F5F7FA] dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-5">
                <h3 className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-3">Booking Summary</h3>
                <div className="space-y-2">
                  {[
                    { label: "Service", value: svc?.label },
                    form.device_brand ? { label: "Device", value: `${form.device_brand} ${form.device_model}`.trim() } : null,
                    { label: "Name", value: form.customer_name },
                    { label: "Phone", value: form.customer_phone },
                    form.preferred_date ? { label: "Date", value: new Date(form.preferred_date + "T12:00").toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" }) } : null,
                    form.preferred_time ? { label: "Time", value: form.preferred_time } : null,
                  ].filter(Boolean).map(row => (
                    <div key={row!.label} className="flex justify-between text-[13px]">
                      <span className="text-gray-500">{row!.label}</span>
                      <span className="font-semibold text-gray-900 dark:text-white">{row!.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {error && <p className="text-[13px] text-rose-500 mt-3">{error}</p>}

            <div className="flex justify-between mt-8">
              <button onClick={() => setStep(3)} className="text-[14px] text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors">← Back</button>
              <button onClick={submit} disabled={submitting || !form.preferred_date || !form.preferred_time}
                className="px-8 py-3 bg-[#2563EB] hover:bg-[#1D4ED8] disabled:opacity-50 text-white text-[14px] font-semibold rounded-xl transition-colors shadow-sm">
                {submitting ? "Booking…" : "Confirm Booking"}
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
