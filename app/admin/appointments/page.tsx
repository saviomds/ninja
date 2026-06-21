"use client";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface Appointment {
  id: string;
  ref: string;
  customer_name: string;
  customer_phone: string;
  customer_email: string | null;
  service_type: string;
  device_brand: string | null;
  device_model: string | null;
  issue_description: string | null;
  preferred_date: string;
  preferred_time: string;
  status: "pending" | "confirmed" | "in_progress" | "completed" | "cancelled";
  notes: string | null;
  created_at: string;
}

const STATUS_CFG = {
  pending:     { label: "Pending",     color: "text-amber-600 dark:text-amber-400",   bg: "bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/30",   dot: "bg-amber-400"   },
  confirmed:   { label: "Confirmed",   color: "text-blue-600 dark:text-blue-400",     bg: "bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/30",       dot: "bg-blue-400"    },
  in_progress: { label: "In Progress", color: "text-purple-600 dark:text-purple-400", bg: "bg-purple-50 dark:bg-purple-500/10 border-purple-200 dark:border-purple-500/30", dot: "bg-purple-400" },
  completed:   { label: "Completed",   color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30", dot: "bg-emerald-400" },
  cancelled:   { label: "Cancelled",   color: "text-rose-600 dark:text-rose-400",     bg: "bg-rose-50 dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/30",       dot: "bg-rose-400"    },
};

const SVC_LABEL: Record<string, string> = {
  screen_repair: "Screen Repair", battery_replacement: "Battery", water_damage: "Water Damage",
  charging_port: "Charging Port", camera_repair: "Camera", laptop_repair: "Laptop Repair",
  data_recovery: "Data Recovery", general_diagnosis: "Free Diagnosis", other: "Other",
};

export default function AdminAppointmentsPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [appts, setAppts] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selected, setSelected] = useState<Appointment | null>(null);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchAppts = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("appointments")
      .select("*")
      .order("preferred_date", { ascending: true })
      .order("preferred_time", { ascending: true });
    setAppts((data || []) as Appointment[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const user = data?.user;
      if (!user) { router.replace("/login"); return; }
      const role = user.user_metadata?.role || user.app_metadata?.role;
      if (role !== "admin") { router.replace("/"); return; }
      setChecking(false);
      fetchAppts();
    });
  }, [router, fetchAppts]);

  const updateStatus = async (id: string, status: string) => {
    setSaving(true);
    const { error } = await supabase.from("appointments").update({ status }).eq("id", id);
    setSaving(false);
    if (error) { showToast("Update failed: " + error.message, false); return; }
    setAppts(prev => prev.map(a => a.id === id ? { ...a, status: status as Appointment["status"] } : a));
    if (selected?.id === id) setSelected(prev => prev ? { ...prev, status: status as Appointment["status"] } : null);
    showToast("Status updated");
  };

  const saveNotes = async () => {
    if (!selected) return;
    setSaving(true);
    const { error } = await supabase.from("appointments").update({ notes }).eq("id", selected.id);
    setSaving(false);
    if (error) { showToast("Save failed: " + error.message, false); return; }
    setAppts(prev => prev.map(a => a.id === selected.id ? { ...a, notes } : a));
    setSelected(prev => prev ? { ...prev, notes } : null);
    showToast("Notes saved");
  };

  const filtered = appts.filter(a => {
    const q = search.toLowerCase();
    const matchQ = !q || a.customer_name.toLowerCase().includes(q) || a.customer_phone.includes(q)
      || a.ref.toLowerCase().includes(q) || (a.device_brand || "").toLowerCase().includes(q);
    return matchQ && (statusFilter === "all" || a.status === statusFilter);
  });

  const stats = {
    total: appts.length,
    pending: appts.filter(a => a.status === "pending").length,
    today: appts.filter(a => a.preferred_date === new Date().toISOString().split("T")[0]).length,
    upcoming: appts.filter(a => a.preferred_date >= new Date().toISOString().split("T")[0] && a.status !== "cancelled").length,
  };

  const inputCls = "bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/30 transition-all";

  if (checking) return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#030712] flex items-center justify-center">
      <div className="w-5 h-5 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#030712] text-gray-900 dark:text-gray-100">

      {/* Header */}
      <div className="sticky top-0 z-30 bg-white/95 dark:bg-gray-900/95 backdrop-blur-md border-b border-gray-200 dark:border-gray-800 px-4 md:px-6 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Link href="/admin" className="text-sm text-gray-400 hover:text-gray-700 dark:hover:text-white transition-colors flex-shrink-0">← Admin</Link>
          <span className="text-gray-300 dark:text-gray-700">|</span>
          <h1 className="font-bold text-gray-900 dark:text-white truncate">Appointments</h1>
          <span className="text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 px-2 py-0.5 rounded-full flex-shrink-0">{appts.length}</span>
        </div>
        <button onClick={fetchAppts} className="text-xs text-cyan-600 dark:text-cyan-400 hover:text-cyan-700 dark:hover:text-cyan-300 font-semibold transition-colors flex-shrink-0">
          Refresh
        </button>
      </div>

      <div className="max-w-screen-xl mx-auto px-4 md:px-6 py-6">

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {[
            { label: "Total",    value: stats.total,    color: "text-gray-700 dark:text-gray-200",      bg: "bg-white dark:bg-gray-900/60 border-gray-200 dark:border-gray-700"         },
            { label: "Pending",  value: stats.pending,  color: "text-amber-600 dark:text-amber-400",    bg: "bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/20"  },
            { label: "Today",    value: stats.today,    color: "text-blue-600 dark:text-blue-400",      bg: "bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/20"      },
            { label: "Upcoming", value: stats.upcoming, color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20" },
          ].map(s => (
            <div key={s.label} className={`rounded-xl border p-4 ${s.bg}`}>
              <p className="text-xs text-gray-400 dark:text-gray-500 mb-1">{s.label}</p>
              <p className={`text-3xl font-bold ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2 mb-5">
          <div className="relative flex-1 min-w-[180px]">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Name, ref, phone…"
              className={`${inputCls} w-full pl-9`} />
          </div>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className={inputCls}>
            <option value="all">All Statuses</option>
            {Object.entries(STATUS_CFG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </div>

        {/* Table */}
        <div className="bg-white dark:bg-gray-900/60 border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden">
          {loading ? (
            <div className="p-10 text-center text-gray-400 dark:text-gray-500">Loading…</div>
          ) : filtered.length === 0 ? (
            <div className="p-10 text-center text-gray-400 dark:text-gray-500">No appointments found</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-gray-800 bg-gray-50/80 dark:bg-gray-800/30">
                    {["Ref", "Customer", "Service", "Date & Time", "Status", ""].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(a => {
                    const sc = STATUS_CFG[a.status];
                    return (
                      <tr key={a.id} className="border-b border-gray-50 dark:border-gray-800/50 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-800/20 transition-colors">
                        <td className="px-4 py-3">
                          <span className="font-mono text-xs text-cyan-600 dark:text-cyan-400 font-semibold">{a.ref}</span>
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-semibold text-gray-900 dark:text-white whitespace-nowrap">{a.customer_name}</p>
                          <p className="text-xs text-gray-400 dark:text-gray-500">{a.customer_phone}</p>
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-gray-700 dark:text-gray-300 whitespace-nowrap">{SVC_LABEL[a.service_type] || a.service_type}</p>
                          {(a.device_brand || a.device_model) && (
                            <p className="text-xs text-gray-400 dark:text-gray-500">{[a.device_brand, a.device_model].filter(Boolean).join(" ")}</p>
                          )}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <p className="font-semibold text-gray-900 dark:text-white text-xs">
                            {new Date(a.preferred_date + "T12:00").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                          </p>
                          <p className="text-xs text-gray-400 dark:text-gray-500">{a.preferred_time}</p>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <select
                            value={a.status}
                            onChange={e => updateStatus(a.id, e.target.value)}
                            className={`text-xs font-semibold px-2 py-1 rounded-lg border bg-transparent cursor-pointer focus:outline-none focus:ring-1 focus:ring-cyan-500 transition-all ${sc.bg} ${sc.color}`}
                          >
                            {Object.entries(STATUS_CFG).map(([k, v]) => (
                              <option key={k} value={k} className="bg-white dark:bg-gray-900 text-gray-900 dark:text-white">{v.label}</option>
                            ))}
                          </select>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <button onClick={() => { setSelected(a); setNotes(a.notes || ""); }}
                            className="text-xs text-cyan-600 dark:text-cyan-400 hover:text-cyan-700 dark:hover:text-cyan-300 font-semibold px-2 py-1 rounded transition-colors">
                            View
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Detail modal */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 dark:bg-black/70 backdrop-blur-sm overflow-y-auto p-4" onClick={() => setSelected(null)}>
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl w-full max-w-lg my-4 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800">
              <div>
                <p className="font-mono text-xs text-cyan-600 dark:text-cyan-400 font-semibold mb-0.5">{selected.ref}</p>
                <h2 className="font-bold text-gray-900 dark:text-white">{selected.customer_name}</h2>
              </div>
              <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-700 dark:hover:text-white text-xl leading-none transition-colors">✕</button>
            </div>

            <div className="px-6 py-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "Phone",   value: selected.customer_phone },
                  { label: "Email",   value: selected.customer_email || "—" },
                  { label: "Service", value: SVC_LABEL[selected.service_type] || selected.service_type },
                  { label: "Device",  value: [selected.device_brand, selected.device_model].filter(Boolean).join(" ") || "—" },
                  { label: "Date",    value: new Date(selected.preferred_date + "T12:00").toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" }) },
                  { label: "Time",    value: selected.preferred_time },
                ].map(({ label, value }) => (
                  <div key={label}>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mb-0.5">{label}</p>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white break-all">{value}</p>
                  </div>
                ))}
              </div>

              {selected.issue_description && (
                <div>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mb-1">Issue</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 rounded-lg px-3 py-2 leading-relaxed">{selected.issue_description}</p>
                </div>
              )}

              <div>
                <p className="text-xs text-gray-400 dark:text-gray-500 mb-2">Status</p>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(STATUS_CFG).map(([k, v]) => (
                    <button key={k} onClick={() => updateStatus(selected.id, k)} disabled={saving}
                      className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all ${
                        selected.status === k ? `${v.bg} ${v.color} ring-1 ring-current` : "bg-gray-50 dark:bg-gray-800 text-gray-400 border-gray-200 dark:border-gray-700 hover:border-gray-400"
                      }`}>
                      {v.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-xs text-gray-400 dark:text-gray-500 mb-1.5">Notes</p>
                <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3}
                  placeholder="Internal notes for this appointment…"
                  className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/30 transition-all resize-none" />
              </div>

              {/* Contact shortcuts */}
              <div className="flex flex-wrap gap-2">
                <a href={`tel:${selected.customer_phone}`}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/30 text-blue-600 dark:text-blue-400 text-xs font-semibold rounded-lg hover:bg-blue-100 dark:hover:bg-blue-500/20 transition-all">
                  📞 Call
                </a>
                <a href={`https://wa.me/${selected.customer_phone.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs font-semibold rounded-lg hover:bg-emerald-100 dark:hover:bg-emerald-500/20 transition-all">
                  💬 WhatsApp
                </a>
                {selected.customer_email && (
                  <a href={`mailto:${selected.customer_email}?subject=Your appointment (${selected.ref}) at Tech Ninja`}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-50 dark:bg-purple-500/10 border border-purple-200 dark:border-purple-500/30 text-purple-600 dark:text-purple-400 text-xs font-semibold rounded-lg hover:bg-purple-100 dark:hover:bg-purple-500/20 transition-all">
                    ✉️ Email
                  </a>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100 dark:border-gray-800">
              <button onClick={() => setSelected(null)} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 border border-gray-200 dark:border-gray-700 rounded-xl transition-all">Cancel</button>
              <button onClick={saveNotes} disabled={saving}
                className="px-5 py-2 text-sm bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-semibold rounded-xl transition-colors">
                {saving ? "Saving…" : "Save Notes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className={`fixed bottom-6 right-6 z-[110] flex items-center gap-3 px-5 py-3 rounded-xl shadow-2xl border text-sm font-semibold
          ${toast.ok ? "bg-emerald-50 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/30" : "bg-red-50 dark:bg-red-500/20 text-red-700 dark:text-red-300 border-red-200 dark:border-red-500/30"}`}>
          {toast.ok ? "✅" : "❌"} {toast.msg}
        </div>
      )}
    </div>
  );
}
