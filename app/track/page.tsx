"use client";
import { useState } from "react";
import { supabase } from "@/lib/supabase";
import Navbar from "@/components/Navbar";
import Link from "next/link";

const PIPELINE = [
  { key: "received",      label: "Received",      dot: "bg-blue-400",    color: "text-blue-600 dark:text-blue-400",    bg: "bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/30"     },
  { key: "diagnosed",     label: "Diagnosed",     dot: "bg-purple-400",  color: "text-purple-600 dark:text-purple-400", bg: "bg-purple-50 dark:bg-purple-500/10 border-purple-200 dark:border-purple-500/30" },
  { key: "in_repair",     label: "In Repair",     dot: "bg-amber-400",   color: "text-amber-600 dark:text-amber-400",   bg: "bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/30"    },
  { key: "waiting_parts", label: "Waiting Parts", dot: "bg-orange-400",  color: "text-orange-600 dark:text-orange-400", bg: "bg-orange-50 dark:bg-orange-500/10 border-orange-200 dark:border-orange-500/30"  },
  { key: "ready",         label: "Ready",         dot: "bg-emerald-400", color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30" },
  { key: "delivered",     label: "Delivered",     dot: "bg-gray-400",    color: "text-gray-600 dark:text-gray-400",    bg: "bg-gray-50 dark:bg-gray-500/10 border-gray-200 dark:border-gray-500/30"     },
  { key: "cancelled",     label: "Cancelled",     dot: "bg-rose-400",    color: "text-rose-600 dark:text-rose-400",    bg: "bg-rose-50 dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/30"     },
];

const PROGRESS_STAGES = PIPELINE.filter(p => !["delivered", "cancelled"].includes(p.key));

interface Ticket {
  id: string;
  ticket_no: string;
  customer_name: string;
  device_brand: string;
  device_model: string;
  status: string;
  estimated_cost: number | null;
  final_cost: number | null;
  estimated_completion: string | null;
  created_at: string;
}

interface History {
  id: string;
  status: string;
  notes: string;
  changed_by: string;
  created_at: string;
}

export default function TrackPage() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [history, setHistory] = useState<History[]>([]);
  const [notFound, setNotFound] = useState(false);
  const [searched, setSearched] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    setLoading(true);
    setNotFound(false);
    setTicket(null);
    setHistory([]);
    setSearched(true);

    // Try ticket number (uppercase) then phone number
    const { data: byTicket } = await supabase
      .from("repair_tickets")
      .select("id,ticket_no,customer_name,device_brand,device_model,status,estimated_cost,final_cost,estimated_completion,created_at")
      .eq("ticket_no", q.toUpperCase())
      .maybeSingle();

    let found: Ticket | null = byTicket as Ticket | null;

    if (!found) {
      const { data: byPhone } = await supabase
        .from("repair_tickets")
        .select("id,ticket_no,customer_name,device_brand,device_model,status,estimated_cost,final_cost,estimated_completion,created_at")
        .eq("customer_phone", q)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      found = byPhone as Ticket | null;
    }

    if (found) {
      setTicket(found);
      const { data: hist } = await supabase
        .from("repair_status_history")
        .select("id,status,notes,changed_by,created_at")
        .eq("ticket_id", found.id)
        .order("created_at", { ascending: false });
      setHistory((hist || []) as History[]);
    } else {
      setNotFound(true);
    }
    setLoading(false);
  };

  const stage = ticket ? PIPELINE.find(p => p.key === ticket.status) : null;
  const stageIdx = ticket ? PROGRESS_STAGES.findIndex(p => p.key === ticket.status) : -1;

  return (
    <main className="min-h-screen bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 pt-[60px] overflow-x-hidden">
      <Navbar />

      {/* Hero */}
      <section className="bg-[#F5F7FA] dark:bg-gray-900 py-16 px-6 sm:px-10">
        <div className="max-w-2xl mx-auto text-center">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 rounded-full px-3 py-1 mb-5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Live Repair Tracking
          </span>
          <h1 className="text-[36px] sm:text-[48px] font-bold tracking-tight text-gray-900 dark:text-white mb-4">
            Track your repair
          </h1>
          <p className="text-[15px] text-gray-500 dark:text-gray-400 mb-8 max-w-md mx-auto">
            Enter your ticket number (e.g. TN-2024-ABCDE) or phone number to check your device status.
          </p>
          <form onSubmit={handleSearch} className="flex gap-3">
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="TN-2024-XXXXX  or  +230 5XXX XXXX"
              className="flex-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3.5 text-[14px] text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/20 transition-all shadow-sm"
            />
            <button
              type="submit"
              disabled={loading || !query.trim()}
              className="px-6 py-3.5 bg-[#2563EB] hover:bg-[#1D4ED8] disabled:opacity-50 text-white text-[14px] font-semibold rounded-xl transition-colors shadow-sm whitespace-nowrap"
            >
              {loading ? "Searching…" : "Track"}
            </button>
          </form>
        </div>
      </section>

      <div className="max-w-2xl mx-auto px-6 sm:px-10 py-10 space-y-5">

        {/* Initial state */}
        {!searched && (
          <div className="text-center py-12">
            <div className="w-16 h-16 rounded-2xl bg-[#2563EB]/10 flex items-center justify-center text-3xl mx-auto mb-4">🔧</div>
            <p className="text-[15px] font-semibold text-gray-700 dark:text-gray-300 mb-2">Enter your ticket number above</p>
            <p className="text-[13px] text-gray-400 dark:text-gray-500 max-w-sm mx-auto">
              You received your ticket number when you dropped off your device. Check your SMS or paper receipt.
            </p>
          </div>
        )}

        {/* Not found */}
        {notFound && (
          <div className="bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 rounded-2xl p-6 text-center">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 dark:bg-rose-500/20 flex items-center justify-center text-2xl mx-auto mb-3">🔍</div>
            <p className="font-semibold text-rose-700 dark:text-rose-400 mb-1">No ticket found</p>
            <p className="text-[13px] text-rose-600/80 dark:text-rose-400/70 mb-4">
              Double-check your ticket number or phone number. Contact us if you need help.
            </p>
            <Link href="/repair" className="text-[13px] font-semibold text-rose-600 dark:text-rose-400 hover:underline">
              Contact Tech Ninja →
            </Link>
          </div>
        )}

        {/* Result */}
        {ticket && stage && (
          <>
            {/* Status banner */}
            <div className={`rounded-2xl border p-5 ${stage.bg}`}>
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1">Current Status</p>
                  <div className="flex items-center gap-2">
                    <span className={`w-3 h-3 rounded-full flex-shrink-0 ${stage.dot}`} />
                    <span className={`text-[20px] font-bold ${stage.color}`}>{stage.label}</span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1">Ticket</p>
                  <p className="font-mono font-bold text-gray-900 dark:text-white">{ticket.ticket_no}</p>
                </div>
              </div>
              {ticket.status === "ready" && (
                <div className="mt-3 pt-3 border-t border-emerald-200 dark:border-emerald-500/30">
                  <p className="text-[14px] font-semibold text-emerald-700 dark:text-emerald-400">
                    Your device is ready for collection! Please visit us during opening hours.
                  </p>
                </div>
              )}
              {ticket.status === "cancelled" && (
                <div className="mt-3 pt-3 border-t border-rose-200 dark:border-rose-500/30">
                  <p className="text-[13px] text-rose-700 dark:text-rose-400">
                    This repair was cancelled. Contact us if you have any questions.
                  </p>
                </div>
              )}
            </div>

            {/* Device info */}
            <div className="bg-white dark:bg-gray-900/60 border border-gray-100 dark:border-gray-800 rounded-2xl p-5">
              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-4">Device Details</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-[11px] text-gray-400 dark:text-gray-500 mb-0.5">Customer</p>
                  <p className="text-[14px] font-semibold text-gray-900 dark:text-white">{ticket.customer_name}</p>
                </div>
                <div>
                  <p className="text-[11px] text-gray-400 dark:text-gray-500 mb-0.5">Device</p>
                  <p className="text-[14px] font-semibold text-gray-900 dark:text-white">{ticket.device_brand} {ticket.device_model}</p>
                </div>
                <div>
                  <p className="text-[11px] text-gray-400 dark:text-gray-500 mb-0.5">Dropped Off</p>
                  <p className="text-[14px] font-semibold text-gray-900 dark:text-white">
                    {new Date(ticket.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                  </p>
                </div>
                {ticket.estimated_completion && (
                  <div>
                    <p className="text-[11px] text-gray-400 dark:text-gray-500 mb-0.5">Est. Ready</p>
                    <p className="text-[14px] font-semibold text-gray-900 dark:text-white">
                      {new Date(ticket.estimated_completion).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                    </p>
                  </div>
                )}
                {ticket.estimated_cost != null && (
                  <div>
                    <p className="text-[11px] text-gray-400 dark:text-gray-500 mb-0.5">Est. Cost</p>
                    <p className="text-[14px] font-semibold text-emerald-600 dark:text-emerald-400">Rs {ticket.estimated_cost.toLocaleString()}</p>
                  </div>
                )}
                {ticket.final_cost != null && (
                  <div>
                    <p className="text-[11px] text-gray-400 dark:text-gray-500 mb-0.5">Final Cost</p>
                    <p className="text-[14px] font-semibold text-emerald-600 dark:text-emerald-400">Rs {ticket.final_cost.toLocaleString()}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Progress bar (non-terminal) */}
            {!["delivered", "cancelled"].includes(ticket.status) && (
              <div className="bg-white dark:bg-gray-900/60 border border-gray-100 dark:border-gray-800 rounded-2xl p-5">
                <h3 className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-5">Repair Progress</h3>
                <div className="relative">
                  <div className="absolute top-[11px] left-[11px] right-[11px] h-0.5 bg-gray-100 dark:bg-gray-800" />
                  <div
                    className="absolute top-[11px] left-[11px] h-0.5 bg-[#2563EB] transition-all duration-700"
                    style={{
                      width: stageIdx <= 0 ? "0%" : `${(stageIdx / (PROGRESS_STAGES.length - 1)) * 100}%`,
                      maxWidth: "calc(100% - 22px)",
                    }}
                  />
                  <div className="relative flex justify-between">
                    {PROGRESS_STAGES.map((p, i) => {
                      const done = i <= stageIdx;
                      const current = p.key === ticket.status;
                      return (
                        <div key={p.key} className="flex flex-col items-center gap-2" style={{ width: `${100 / PROGRESS_STAGES.length}%` }}>
                          <div className={`w-[22px] h-[22px] rounded-full flex items-center justify-center border-2 z-10 transition-all duration-300 ${
                            current
                              ? "border-[#2563EB] bg-[#2563EB] shadow-[0_0_0_4px_rgba(37,99,235,0.15)]"
                              : done
                              ? "border-[#2563EB] bg-[#2563EB]"
                              : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900"
                          }`}>
                            {done && (
                              <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </div>
                          <p className={`text-[9px] font-semibold text-center leading-tight hidden sm:block ${
                            current ? "text-[#2563EB]" : done ? "text-gray-400 dark:text-gray-500" : "text-gray-300 dark:text-gray-700"
                          }`}>
                            {p.label}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
                <p className="sm:hidden text-center text-[13px] font-semibold text-[#2563EB] mt-4">{stage.label}</p>
              </div>
            )}

            {/* Status history */}
            {history.length > 0 && (
              <div className="bg-white dark:bg-gray-900/60 border border-gray-100 dark:border-gray-800 rounded-2xl p-5">
                <h3 className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-4">Status History</h3>
                <div className="space-y-0">
                  {history.map((h, i) => {
                    const s = PIPELINE.find(p => p.key === h.status);
                    return (
                      <div key={h.id} className="flex gap-3">
                        <div className="flex flex-col items-center flex-shrink-0">
                          <div className={`w-2 h-2 rounded-full mt-[6px] flex-shrink-0 ${s?.dot || "bg-gray-400"}`} />
                          {i < history.length - 1 && <div className="w-px flex-1 bg-gray-100 dark:bg-gray-800 mt-1 min-h-[28px]" />}
                        </div>
                        <div className="pb-4 flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`text-[13px] font-semibold ${s?.color || "text-gray-500"}`}>{s?.label || h.status}</span>
                            <span className="text-[11px] text-gray-400 dark:text-gray-500">
                              {new Date(h.created_at).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                            </span>
                          </div>
                          {h.notes && (
                            <p className="text-[12px] text-gray-500 dark:text-gray-400 mt-0.5">{h.notes}</p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* CTA */}
            <div className="text-center py-4">
              <p className="text-[13px] text-gray-400 dark:text-gray-500 mb-3">Questions about your repair?</p>
              <Link href="/repair" className="text-[14px] font-semibold text-[#2563EB] hover:text-[#1D4ED8] transition-colors">
                Contact Tech Ninja →
              </Link>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
