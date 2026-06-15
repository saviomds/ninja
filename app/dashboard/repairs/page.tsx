"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import Link from "next/link";

// ─── Types ────────────────────────────────────────────────────────────────────

type TicketStatus   = "received" | "diagnosed" | "in_repair" | "waiting_parts" | "ready" | "delivered" | "cancelled";
type TicketPriority = "low" | "normal" | "high" | "urgent";

interface RepairTicket {
  id: string;
  ticket_no: string;
  customer_name: string;
  customer_phone: string;
  customer_email: string;
  device_brand: string;
  device_model: string;
  device_serial: string;
  device_color: string;
  issue_description: string;
  priority: TicketPriority;
  status: TicketStatus;
  technician: string;
  estimated_cost: number | null;
  final_cost: number | null;
  estimated_completion: string | null;
  notes: string;
  created_at: string;
  updated_at: string;
}

interface StatusHistory {
  id: string;
  ticket_id: string;
  status: string;
  notes: string;
  changed_by: string;
  created_at: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PIPELINE: { key: TicketStatus; label: string; color: string; bg: string; dot: string }[] = [
  { key: "received",       label: "Received",       color: "text-blue-400",    bg: "bg-blue-500/10 border-blue-500/30",     dot: "bg-blue-400"    },
  { key: "diagnosed",      label: "Diagnosed",      color: "text-purple-400",  bg: "bg-purple-500/10 border-purple-500/30", dot: "bg-purple-400"  },
  { key: "in_repair",      label: "In Repair",      color: "text-amber-400",   bg: "bg-amber-500/10 border-amber-500/30",   dot: "bg-amber-400"   },
  { key: "waiting_parts",  label: "Waiting Parts",  color: "text-orange-400",  bg: "bg-orange-500/10 border-orange-500/30", dot: "bg-orange-400"  },
  { key: "ready",          label: "Ready",          color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/30",dot: "bg-emerald-400"},
  { key: "delivered",      label: "Delivered",      color: "text-gray-400",    bg: "bg-gray-500/10 border-gray-500/30",     dot: "bg-gray-400"    },
  { key: "cancelled",      label: "Cancelled",      color: "text-rose-400",    bg: "bg-rose-500/10 border-rose-500/30",     dot: "bg-rose-400"    },
];

const PRIORITY_STYLE: Record<TicketPriority, string> = {
  low:    "text-gray-400 bg-gray-500/10 border-gray-500/30",
  normal: "text-cyan-400 bg-cyan-500/10 border-cyan-500/30",
  high:   "text-amber-400 bg-amber-500/10 border-amber-500/30",
  urgent: "text-rose-400 bg-rose-500/10 border-rose-500/30",
};

const emptyForm = () => ({
  customer_name: "", customer_phone: "", customer_email: "",
  device_brand: "", device_model: "", device_serial: "", device_color: "",
  issue_description: "", priority: "normal" as TicketPriority,
  technician: "", estimated_cost: "", final_cost: "",
  estimated_completion: "", notes: "",
});

function genTicketNo() {
  const y = new Date().getFullYear();
  const n = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `TN-${y}-${n}`;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function RepairsPage() {
  const router = useRouter();
  const adminEmail = useRef<string | null>(null);

  const [tickets, setTickets]     = useState<RepairTicket[]>([]);
  const [loading, setLoading]     = useState(true);
  const [toast, setToast]         = useState<{ msg: string; type: "success" | "error" } | null>(null);

  // view
  const [viewMode, setViewMode]               = useState<"pipeline" | "list">("pipeline");
  const [searchQuery, setSearchQuery]         = useState("");
  const [statusFilter, setStatusFilter]       = useState<TicketStatus | "all">("all");
  const [priorityFilter, setPriorityFilter]   = useState<TicketPriority | "all">("all");

  // form modal
  const [isFormOpen, setIsFormOpen]   = useState(false);
  const [editingId, setEditingId]     = useState<string | null>(null);
  const [isSaving, setIsSaving]       = useState(false);
  const [form, setForm]               = useState(emptyForm());

  // detail modal
  const [selectedTicket, setSelectedTicket]   = useState<RepairTicket | null>(null);
  const [isDetailOpen, setIsDetailOpen]       = useState(false);
  const [statusHistory, setStatusHistory]     = useState<StatusHistory[]>([]);

  // status-change note modal
  const [pendingStatus, setPendingStatus] = useState<{ ticket: RepairTicket; status: TicketStatus } | null>(null);
  const [statusNote, setStatusNote]       = useState("");
  const [isChangingStatus, setIsChangingStatus] = useState(false);

  // delete modal
  const [deleteId, setDeleteId]     = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const showToast = (msg: string, type: "success" | "error") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  // ─── Auth / boot ──────────────────────────────────────────────────────────

  const fetchTickets = useCallback(async () => {
    const { data } = await supabase.from("repair_tickets").select("*").order("created_at", { ascending: false });
    if (data) setTickets(data as RepairTicket[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.push("/login"); return; }
      const role = user.user_metadata?.role || user.app_metadata?.role;
      if (role !== "admin") { router.push("/"); return; }
      adminEmail.current = user.email ?? null;
    });
    fetchTickets();
  }, [fetchTickets, router]);

  // ─── Realtime ─────────────────────────────────────────────────────────────

  useEffect(() => {
    const ch = supabase
      .channel("repairs-realtime")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "repair_tickets" }, ({ new: row }) => {
        setTickets(prev => [row as RepairTicket, ...prev]);
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "repair_tickets" }, ({ new: row }) => {
        setTickets(prev => prev.map(t => t.id === row.id ? row as RepairTicket : t));
        setSelectedTicket(prev => prev?.id === row.id ? { ...prev, ...(row as RepairTicket) } : prev);
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "repair_tickets" }, ({ old: row }) => {
        setTickets(prev => prev.filter(t => t.id !== row.id));
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  // ─── CRUD ─────────────────────────────────────────────────────────────────

  const handleSave = async () => {
    if (!form.customer_name.trim() || !form.device_brand.trim() || !form.device_model.trim() || !form.issue_description.trim()) {
      showToast("Fill in all required fields", "error"); return;
    }
    setIsSaving(true);
    const payload = {
      ...form,
      estimated_cost:      form.estimated_cost      ? parseFloat(form.estimated_cost)      : null,
      final_cost:          form.final_cost          ? parseFloat(form.final_cost)          : null,
      estimated_completion: form.estimated_completion || null,
    };

    if (editingId) {
      const { error } = await supabase.from("repair_tickets").update(payload).eq("id", editingId);
      if (error) { showToast("Save failed: " + error.message, "error"); setIsSaving(false); return; }
      showToast("Ticket updated!", "success");
    } else {
      const { error } = await supabase.from("repair_tickets").insert({ ...payload, ticket_no: genTicketNo(), status: "received" });
      if (error) { showToast("Save failed: " + error.message, "error"); setIsSaving(false); return; }
      showToast("Ticket created!", "success");
    }
    setIsSaving(false);
    setIsFormOpen(false);
    setEditingId(null);
    setForm(emptyForm());
  };

  const commitStatusChange = async () => {
    if (!pendingStatus) return;
    const { ticket, status } = pendingStatus;
    setIsChangingStatus(true);

    const { error } = await supabase.from("repair_tickets").update({ status }).eq("id", ticket.id);
    if (error) { showToast("Status update failed", "error"); setIsChangingStatus(false); return; }

    await supabase.from("repair_status_history").insert({
      ticket_id:  ticket.id,
      status,
      notes:      statusNote.trim() || `Moved to ${PIPELINE.find(p => p.key === status)?.label ?? status}`,
      changed_by: adminEmail.current ?? "Admin",
    });

    if (isDetailOpen && selectedTicket?.id === ticket.id) {
      fetchHistory(ticket.id);
    }
    showToast("Status updated", "success");
    setIsChangingStatus(false);
    setPendingStatus(null);
    setStatusNote("");
  };

  const requestStatusChange = (ticket: RepairTicket, status: TicketStatus) => {
    if (ticket.status === status) return;
    setPendingStatus({ ticket, status });
    setStatusNote("");
  };

  const fetchHistory = async (ticketId: string) => {
    const { data } = await supabase.from("repair_status_history").select("*").eq("ticket_id", ticketId).order("created_at", { ascending: false });
    if (data) setStatusHistory(data as StatusHistory[]);
  };

  const openDetail = (ticket: RepairTicket) => {
    setSelectedTicket(ticket);
    setIsDetailOpen(true);
    fetchHistory(ticket.id);
  };

  const openEdit = (ticket: RepairTicket) => {
    setForm({
      customer_name:       ticket.customer_name,
      customer_phone:      ticket.customer_phone   || "",
      customer_email:      ticket.customer_email   || "",
      device_brand:        ticket.device_brand,
      device_model:        ticket.device_model,
      device_serial:       ticket.device_serial    || "",
      device_color:        ticket.device_color     || "",
      issue_description:   ticket.issue_description,
      priority:            ticket.priority,
      technician:          ticket.technician        || "",
      estimated_cost:      ticket.estimated_cost?.toString()  || "",
      final_cost:          ticket.final_cost?.toString()      || "",
      estimated_completion:ticket.estimated_completion        || "",
      notes:               ticket.notes             || "",
    });
    setEditingId(ticket.id);
    setIsDetailOpen(false);
    setIsFormOpen(true);
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    setIsDeleting(true);
    await supabase.from("repair_tickets").delete().eq("id", deleteId);
    setIsDeleting(false);
    setDeleteId(null);
    if (isDetailOpen) setIsDetailOpen(false);
    showToast("Ticket deleted", "success");
  };

  // ─── Derived ──────────────────────────────────────────────────────────────

  const filtered = tickets.filter(t => {
    const q = searchQuery.toLowerCase();
    const matchQ = !q ||
      t.ticket_no.toLowerCase().includes(q) ||
      t.customer_name.toLowerCase().includes(q) ||
      (t.customer_phone || "").includes(q) ||
      t.device_brand.toLowerCase().includes(q) ||
      t.device_model.toLowerCase().includes(q);
    return matchQ && (statusFilter === "all" || t.status === statusFilter) && (priorityFilter === "all" || t.priority === priorityFilter);
  });

  const byStatus = (s: TicketStatus) => filtered.filter(t => t.status === s);

  const stats = {
    active: tickets.filter(t => !["delivered","cancelled"].includes(t.status)).length,
    urgent: tickets.filter(t => t.priority === "urgent" && !["delivered","cancelled"].includes(t.status)).length,
    ready:  tickets.filter(t => t.status === "ready").length,
    today:  tickets.filter(t => t.created_at.slice(0,10) === new Date().toISOString().slice(0,10)).length,
  };

  const setField = (f: string) => (v: string) => setForm(p => ({ ...p, [f]: v }));

  // ─── Loading ──────────────────────────────────────────────────────────────

  if (loading) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-950 text-white">

      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-[100] px-4 py-3 rounded-xl text-sm font-semibold shadow-2xl border pointer-events-none ${
          toast.type === "success" ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40" : "bg-rose-500/20 text-rose-300 border-rose-500/40"
        }`}>{toast.msg}</div>
      )}

      {/* Header */}
      <div className="sticky top-0 z-30 bg-gray-900/95 backdrop-blur-md border-b border-gray-800 px-4 md:px-6 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Link href="/dashboard" className="text-sm text-gray-400 hover:text-white transition-colors flex-shrink-0">← Dashboard</Link>
          <span className="text-gray-700 flex-shrink-0">|</span>
          <h1 className="font-bold text-white truncate">Repair Tickets</h1>
          <span className="flex-shrink-0 text-xs font-medium bg-gray-800 text-gray-400 px-2 py-0.5 rounded-full">{tickets.length}</span>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button onClick={() => setViewMode(v => v === "pipeline" ? "list" : "pipeline")}
            className="px-3 py-1.5 text-xs bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg text-gray-300 transition-all hidden sm:block">
            {viewMode === "pipeline" ? "List" : "Pipeline"}
          </button>
          <button onClick={() => { setForm(emptyForm()); setEditingId(null); setIsFormOpen(true); }}
            className="px-4 py-1.5 text-xs bg-cyan-500 hover:bg-cyan-400 text-black font-bold rounded-lg transition-all">
            + New Ticket
          </button>
        </div>
      </div>

      <div className="max-w-screen-2xl mx-auto px-4 md:px-6 py-6">

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {[
            { label: "Active Jobs",       value: stats.active, color: "text-cyan-400",    bg: "bg-cyan-500/10 border-cyan-500/20",    onClick: () => setStatusFilter("all")       },
            { label: "Urgent",            value: stats.urgent, color: "text-rose-400",    bg: "bg-rose-500/10 border-rose-500/20",    onClick: () => setPriorityFilter("urgent")  },
            { label: "Ready to Collect",  value: stats.ready,  color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20", onClick: () => setStatusFilter("ready")  },
            { label: "New Today",         value: stats.today,  color: "text-purple-400",  bg: "bg-purple-500/10 border-purple-500/20", onClick: () => {}                          },
          ].map(s => (
            <button key={s.label} onClick={s.onClick} className={`rounded-xl border p-4 text-left hover:opacity-90 transition-opacity ${s.bg}`}>
              <p className="text-xs text-gray-400 mb-1">{s.label}</p>
              <p className={`text-3xl font-bold ${s.color}`}>{s.value}</p>
            </button>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2 mb-6">
          <div className="relative flex-1 min-w-[180px]">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search ticket, customer, device…"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500 transition-all" />
          </div>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as TicketStatus | "all")}
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500 transition-all">
            <option value="all">All Statuses</option>
            {PIPELINE.map(p => <option key={p.key} value={p.key}>{p.label}</option>)}
          </select>
          <select value={priorityFilter} onChange={e => setPriorityFilter(e.target.value as TicketPriority | "all")}
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500 transition-all">
            <option value="all">All Priorities</option>
            <option value="urgent">Urgent</option>
            <option value="high">High</option>
            <option value="normal">Normal</option>
            <option value="low">Low</option>
          </select>
          {(statusFilter !== "all" || priorityFilter !== "all" || searchQuery) && (
            <button onClick={() => { setStatusFilter("all"); setPriorityFilter("all"); setSearchQuery(""); }}
              className="px-3 py-2 text-xs text-gray-400 hover:text-white border border-gray-700 rounded-lg transition-all">
              Clear filters
            </button>
          )}
        </div>

        {/* View toggle (mobile) */}
        <div className="flex gap-2 mb-4 sm:hidden">
          {(["pipeline","list"] as const).map(v => (
            <button key={v} onClick={() => setViewMode(v)}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-lg border transition-all capitalize ${
                viewMode === v ? "bg-cyan-500/20 border-cyan-500/40 text-cyan-300" : "bg-gray-800 border-gray-700 text-gray-400"
              }`}>{v}</button>
          ))}
        </div>

        {/* ── Pipeline View ──────────────────────────────────────────────────── */}
        {viewMode === "pipeline" && (
          <div className="overflow-x-auto pb-4">
            <div className="flex gap-3 min-w-max">
              {PIPELINE.map(stage => {
                const cols = byStatus(stage.key);
                return (
                  <div key={stage.key} className="w-60 flex-shrink-0">
                    <div className={`flex items-center justify-between px-3 py-2 rounded-t-xl border ${stage.bg}`}>
                      <span className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${stage.dot}`} />
                        <span className={`text-xs font-bold uppercase tracking-wider ${stage.color}`}>{stage.label}</span>
                      </span>
                      <span className={`text-xs font-bold ${stage.color}`}>{cols.length}</span>
                    </div>
                    <div className="bg-gray-900/50 border border-t-0 border-gray-800 rounded-b-xl min-h-[160px] p-2 space-y-2">
                      {cols.length === 0 && (
                        <p className="text-xs text-gray-700 text-center py-8">Empty</p>
                      )}
                      {cols.map(ticket => (
                        <div key={ticket.id} onClick={() => openDetail(ticket)}
                          className="bg-gray-800 border border-gray-700 hover:border-gray-600 rounded-lg p-3 cursor-pointer transition-all hover:shadow-lg">
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <span className="text-[10px] font-mono text-cyan-400">{ticket.ticket_no}</span>
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${PRIORITY_STYLE[ticket.priority]}`}>
                              {ticket.priority}
                            </span>
                          </div>
                          <p className="text-sm font-semibold text-white truncate">{ticket.customer_name}</p>
                          <p className="text-xs text-gray-400 truncate">{ticket.device_brand} {ticket.device_model}</p>
                          <p className="text-xs text-gray-500 mt-1.5 line-clamp-2">{ticket.issue_description}</p>
                          {ticket.technician && (
                            <p className="text-xs text-indigo-400 mt-1.5 truncate">● {ticket.technician}</p>
                          )}
                          {ticket.estimated_cost && (
                            <p className="text-xs text-emerald-400 mt-1 font-semibold">Est. Rs {ticket.estimated_cost.toLocaleString()}</p>
                          )}
                          {ticket.status === "ready" && ticket.customer_phone && (
                            <a href={`https://wa.me/${ticket.customer_phone.replace(/\D/g,"")}`} target="_blank" rel="noopener noreferrer"
                              onClick={e => e.stopPropagation()}
                              className="mt-2 flex items-center gap-1 text-[10px] font-semibold text-green-400 hover:text-green-300 transition-colors">
                              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                              Notify customer
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── List View ──────────────────────────────────────────────────────── */}
        {viewMode === "list" && (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
            {filtered.length === 0 ? (
              <div className="py-16 text-center text-gray-500 text-sm">No tickets found</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-800 bg-gray-900/80">
                      {["Ticket", "Customer", "Device", "Priority", "Status", "Tech", "Est. Cost", "Date", ""].map(h => (
                        <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(ticket => {
                      const stage = PIPELINE.find(p => p.key === ticket.status)!;
                      return (
                        <tr key={ticket.id} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
                          <td className="px-4 py-3 whitespace-nowrap">
                            <button onClick={() => openDetail(ticket)} className="text-xs font-mono text-cyan-400 hover:text-cyan-300 transition-colors">
                              {ticket.ticket_no}
                            </button>
                          </td>
                          <td className="px-4 py-3">
                            <p className="text-white font-medium whitespace-nowrap">{ticket.customer_name}</p>
                            <p className="text-xs text-gray-500">{ticket.customer_phone || "—"}</p>
                          </td>
                          <td className="px-4 py-3">
                            <p className="text-white whitespace-nowrap">{ticket.device_brand} {ticket.device_model}</p>
                            {ticket.device_serial && <p className="text-xs text-gray-500">{ticket.device_serial}</p>}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${PRIORITY_STYLE[ticket.priority]}`}>
                              {ticket.priority}
                            </span>
                          </td>
                          {/* Inline status dropdown */}
                          <td className="px-4 py-3 whitespace-nowrap">
                            <select
                              value={ticket.status}
                              onChange={e => requestStatusChange(ticket, e.target.value as TicketStatus)}
                              onClick={e => e.stopPropagation()}
                              className={`text-xs font-semibold px-2 py-1 rounded-lg border bg-transparent cursor-pointer focus:outline-none focus:ring-1 focus:ring-cyan-500 ${stage.bg} ${stage.color}`}
                            >
                              {PIPELINE.map(p => <option key={p.key} value={p.key} className="bg-gray-900 text-white">{p.label}</option>)}
                            </select>
                          </td>
                          <td className="px-4 py-3 text-gray-300 whitespace-nowrap">{ticket.technician || "—"}</td>
                          <td className="px-4 py-3 text-emerald-400 font-semibold whitespace-nowrap">
                            {ticket.estimated_cost ? `Rs ${ticket.estimated_cost.toLocaleString()}` : "—"}
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                            {new Date(ticket.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <div className="flex items-center gap-1">
                              <button onClick={() => openDetail(ticket)} className="text-xs text-cyan-400 hover:text-cyan-300 px-2 py-1 rounded transition-colors">View</button>
                              <button onClick={() => openEdit(ticket)} className="text-xs text-indigo-400 hover:text-indigo-300 px-2 py-1 rounded transition-colors">Edit</button>
                              <button onClick={() => setDeleteId(ticket.id)} className="text-xs text-rose-400 hover:text-rose-300 px-2 py-1 rounded transition-colors">Del</button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Create / Edit Modal ───────────────────────────────────────────────── */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 backdrop-blur-sm overflow-y-auto p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-2xl my-4 shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
              <h2 className="font-bold text-lg">{editingId ? "Edit Ticket" : "New Repair Ticket"}</h2>
              <button onClick={() => setIsFormOpen(false)} className="text-gray-500 hover:text-white text-xl transition-colors leading-none">✕</button>
            </div>

            <div className="px-6 py-5 space-y-5 max-h-[calc(100vh-180px)] overflow-y-auto">

              {/* Customer */}
              <section>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Customer</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    { label: "Full Name *", field: "customer_name",  placeholder: "John Doe"             },
                    { label: "Phone",       field: "customer_phone", placeholder: "+230 5XXX XXXX"       },
                    { label: "Email",       field: "customer_email", placeholder: "customer@email.com"   },
                  ].map(({ label, field, placeholder }) => (
                    <div key={field} className={field === "customer_name" ? "sm:col-span-1" : ""}>
                      <label className="block text-xs text-gray-400 mb-1">{label}</label>
                      <input value={(form as Record<string,string>)[field]} onChange={e => setField(field)(e.target.value)} placeholder={placeholder}
                        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500 transition-all" />
                    </div>
                  ))}
                </div>
              </section>

              {/* Device */}
              <section>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Device</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {[
                    { label: "Brand *",  field: "device_brand",  placeholder: "Apple / Samsung"  },
                    { label: "Model *",  field: "device_model",  placeholder: "iPhone 15 Pro"     },
                    { label: "Color",    field: "device_color",  placeholder: "Space Black"        },
                    { label: "Serial",   field: "device_serial", placeholder: "SN123456"           },
                  ].map(({ label, field, placeholder }) => (
                    <div key={field}>
                      <label className="block text-xs text-gray-400 mb-1">{label}</label>
                      <input value={(form as Record<string,string>)[field]} onChange={e => setField(field)(e.target.value)} placeholder={placeholder}
                        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500 transition-all" />
                    </div>
                  ))}
                </div>
              </section>

              {/* Issue */}
              <section>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Issue</p>
                <textarea value={form.issue_description} onChange={e => setField("issue_description")(e.target.value)} rows={3}
                  placeholder="Describe the problem in detail…"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500 transition-all resize-none" />
                <div className="grid grid-cols-2 gap-3 mt-3">
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Priority</label>
                    <select value={form.priority} onChange={e => setField("priority")(e.target.value)}
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500 transition-all">
                      <option value="low">Low</option>
                      <option value="normal">Normal</option>
                      <option value="high">High</option>
                      <option value="urgent">Urgent</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Technician</label>
                    <input value={form.technician} onChange={e => setField("technician")(e.target.value)} placeholder="Assigned tech"
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500 transition-all" />
                  </div>
                </div>
              </section>

              {/* Pricing & Timeline */}
              <section>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Pricing & Timeline</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {[
                    { label: "Est. Cost (Rs)", field: "estimated_cost", placeholder: "0.00", type: "number" },
                    { label: "Final Cost (Rs)", field: "final_cost",    placeholder: "0.00", type: "number" },
                  ].map(({ label, field, placeholder, type }) => (
                    <div key={field}>
                      <label className="block text-xs text-gray-400 mb-1">{label}</label>
                      <input type={type} value={(form as Record<string,string>)[field]} onChange={e => setField(field)(e.target.value)} placeholder={placeholder}
                        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500 transition-all" />
                    </div>
                  ))}
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Est. Completion</label>
                    <input type="date" value={form.estimated_completion} onChange={e => setField("estimated_completion")(e.target.value)}
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500 transition-all" />
                  </div>
                </div>
              </section>

              {/* Notes */}
              <section>
                <label className="block text-xs text-gray-400 mb-1">Internal Notes</label>
                <textarea value={form.notes} onChange={e => setField("notes")(e.target.value)} rows={2}
                  placeholder="Internal notes for the team…"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500 transition-all resize-none" />
              </section>
            </div>

            <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-800">
              <button onClick={() => setIsFormOpen(false)} className="px-4 py-2 text-sm text-gray-400 hover:text-white border border-gray-700 rounded-lg transition-all">Cancel</button>
              <button onClick={handleSave} disabled={isSaving}
                className="px-5 py-2 text-sm bg-cyan-500 hover:bg-cyan-400 text-black font-bold rounded-lg transition-all disabled:opacity-50">
                {isSaving ? "Saving…" : editingId ? "Save Changes" : "Create Ticket"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Detail Modal ──────────────────────────────────────────────────────── */}
      {isDetailOpen && selectedTicket && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 backdrop-blur-sm overflow-y-auto p-4" onClick={() => setIsDetailOpen(false)}>
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-2xl my-4 shadow-2xl" onClick={e => e.stopPropagation()}>

            {/* Header */}
            <div className="flex items-start justify-between px-6 py-4 border-b border-gray-800 gap-4">
              <div className="min-w-0">
                <p className="text-xs font-mono text-cyan-400 mb-0.5">{selectedTicket.ticket_no}</p>
                <h2 className="font-bold text-lg truncate">{selectedTicket.customer_name}</h2>
                <p className="text-sm text-gray-400 mt-0.5">{selectedTicket.device_brand} {selectedTicket.device_model}{selectedTicket.device_color ? ` · ${selectedTicket.device_color}` : ""}</p>
              </div>
              <button onClick={() => setIsDetailOpen(false)} className="text-gray-500 hover:text-white text-xl transition-colors leading-none flex-shrink-0">✕</button>
            </div>

            <div className="px-6 py-5 space-y-5 max-h-[calc(100vh-200px)] overflow-y-auto">

              {/* Info grid */}
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "Phone",      value: selectedTicket.customer_phone || "—" },
                  { label: "Email",      value: selectedTicket.customer_email || "—" },
                  { label: "Serial",     value: selectedTicket.device_serial  || "—" },
                  { label: "Technician", value: selectedTicket.technician     || "—" },
                ].map(({ label, value }) => (
                  <div key={label}>
                    <p className="text-xs text-gray-500 mb-0.5">{label}</p>
                    <p className="text-sm text-white font-medium break-all">{value}</p>
                  </div>
                ))}
                <div>
                  <p className="text-xs text-gray-500 mb-0.5">Priority</p>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${PRIORITY_STYLE[selectedTicket.priority]}`}>{selectedTicket.priority}</span>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-0.5">Created</p>
                  <p className="text-sm text-white">{new Date(selectedTicket.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</p>
                </div>
                {selectedTicket.estimated_cost != null && (
                  <div>
                    <p className="text-xs text-gray-500 mb-0.5">Est. Cost</p>
                    <p className="text-sm text-emerald-400 font-semibold">Rs {selectedTicket.estimated_cost.toLocaleString()}</p>
                  </div>
                )}
                {selectedTicket.final_cost != null && (
                  <div>
                    <p className="text-xs text-gray-500 mb-0.5">Final Cost</p>
                    <p className="text-sm text-emerald-400 font-semibold">Rs {selectedTicket.final_cost.toLocaleString()}</p>
                  </div>
                )}
                {selectedTicket.estimated_completion && (
                  <div>
                    <p className="text-xs text-gray-500 mb-0.5">Est. Ready</p>
                    <p className="text-sm text-white">{new Date(selectedTicket.estimated_completion).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</p>
                  </div>
                )}
              </div>

              {/* Issue */}
              <div>
                <p className="text-xs text-gray-500 mb-1">Issue Description</p>
                <p className="text-sm text-white bg-gray-800 rounded-lg px-3 py-2 leading-relaxed">{selectedTicket.issue_description}</p>
              </div>

              {selectedTicket.notes && (
                <div>
                  <p className="text-xs text-gray-500 mb-1">Internal Notes</p>
                  <p className="text-sm text-gray-300 bg-gray-800 rounded-lg px-3 py-2 leading-relaxed">{selectedTicket.notes}</p>
                </div>
              )}

              {/* Quick contact (when ready) */}
              {selectedTicket.status === "ready" && (selectedTicket.customer_phone || selectedTicket.customer_email) && (
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3">
                  <p className="text-xs font-bold text-emerald-400 uppercase tracking-wider mb-2">Device Ready — Notify Customer</p>
                  <div className="flex flex-wrap gap-2">
                    {selectedTicket.customer_phone && (
                      <a href={`https://wa.me/${selectedTicket.customer_phone.replace(/\D/g,"")}`} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500/20 border border-green-500/40 rounded-lg text-xs font-semibold text-green-400 hover:bg-green-500/30 transition-all">
                        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                        WhatsApp
                      </a>
                    )}
                    {selectedTicket.customer_phone && (
                      <a href={`tel:${selectedTicket.customer_phone}`}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500/20 border border-blue-500/40 rounded-lg text-xs font-semibold text-blue-400 hover:bg-blue-500/30 transition-all">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                        Call
                      </a>
                    )}
                    {selectedTicket.customer_email && (
                      <a href={`mailto:${selectedTicket.customer_email}?subject=Your repair (${selectedTicket.ticket_no}) is ready&body=Hi ${selectedTicket.customer_name},%0A%0AGreat news! Your ${selectedTicket.device_brand} ${selectedTicket.device_model} is repaired and ready for collection at TechNinja.%0A%0ATicket: ${selectedTicket.ticket_no}%0A%0AFeel free to call us if you have any questions.%0A%0ATechNinja Team`}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-500/20 border border-purple-500/40 rounded-lg text-xs font-semibold text-purple-400 hover:bg-purple-500/30 transition-all">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                        Email
                      </a>
                    )}
                  </div>
                </div>
              )}

              {/* Status pipeline */}
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Update Status</p>
                <div className="flex flex-wrap gap-2">
                  {PIPELINE.map(stage => (
                    <button key={stage.key}
                      onClick={() => requestStatusChange(selectedTicket, stage.key)}
                      className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all ${
                        selectedTicket.status === stage.key
                          ? `${stage.bg} ${stage.color} ring-1 ring-current`
                          : "bg-gray-800 text-gray-400 border-gray-700 hover:border-gray-500 hover:text-gray-200"
                      }`}
                    >
                      {stage.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Status history */}
              {statusHistory.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">History</p>
                  <div className="space-y-2.5">
                    {statusHistory.map((h, i) => {
                      const stage = PIPELINE.find(p => p.key === h.status);
                      return (
                        <div key={h.id} className="flex items-start gap-3 text-xs">
                          <div className="relative flex flex-col items-center flex-shrink-0">
                            <div className={`w-2 h-2 rounded-full mt-0.5 ${stage?.dot || "bg-gray-500"}`} />
                            {i < statusHistory.length - 1 && <div className="w-px flex-1 bg-gray-800 mt-1" style={{ minHeight: "16px" }} />}
                          </div>
                          <div className="flex-1 min-w-0 pb-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={`font-semibold ${stage?.color || "text-gray-300"}`}>{stage?.label || h.status}</span>
                              <span className="text-gray-600">·</span>
                              <span className="text-gray-500">{new Date(h.created_at).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                              {h.changed_by && <span className="text-gray-600">by {h.changed_by}</span>}
                            </div>
                            {h.notes && h.notes !== `Status changed to ${h.status}` && (
                              <p className="text-gray-400 mt-0.5">{h.notes}</p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-gray-800">
              <button onClick={() => setDeleteId(selectedTicket.id)} className="px-4 py-2 text-sm text-rose-400 hover:text-rose-300 border border-rose-500/30 rounded-lg transition-all">
                Delete
              </button>
              <div className="flex gap-2">
                <button onClick={() => openEdit(selectedTicket)} className="px-4 py-2 text-sm bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-all">Edit</button>
                <button onClick={() => setIsDetailOpen(false)} className="px-5 py-2 text-sm bg-cyan-500 hover:bg-cyan-400 text-black font-bold rounded-lg transition-all">Close</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Status Note Modal ─────────────────────────────────────────────────── */}
      {pendingStatus && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={() => setPendingStatus(null)}>
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 max-w-sm w-full shadow-2xl" onClick={e => e.stopPropagation()}>
            {(() => {
              const stage = PIPELINE.find(p => p.key === pendingStatus.status)!;
              return (
                <>
                  <div className="flex items-center gap-3 mb-4">
                    <div className={`w-2.5 h-2.5 rounded-full ${stage.dot}`} />
                    <h3 className="font-bold text-white">Move to <span className={stage.color}>{stage.label}</span></h3>
                  </div>
                  <p className="text-xs text-gray-400 mb-2">Add a note to the status history (optional)</p>
                  <textarea
                    value={statusNote}
                    onChange={e => setStatusNote(e.target.value)}
                    placeholder={`e.g. "Screen replaced, tested OK" or "Waiting for Samsung part #XZ12"`}
                    rows={3}
                    autoFocus
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500 transition-all resize-none mb-4"
                  />
                  <div className="flex justify-end gap-3">
                    <button onClick={() => setPendingStatus(null)} className="px-4 py-2 text-sm text-gray-400 border border-gray-700 rounded-lg hover:text-white transition-all">Cancel</button>
                    <button onClick={commitStatusChange} disabled={isChangingStatus}
                      className={`px-5 py-2 text-sm font-bold rounded-lg transition-all disabled:opacity-50 ${stage.bg} ${stage.color} border ${stage.bg.replace("bg-","border-")}`}>
                      {isChangingStatus ? "Saving…" : "Confirm"}
                    </button>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* ── Delete Confirm ────────────────────────────────────────────────────── */}
      {deleteId && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={() => setDeleteId(null)}>
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 max-w-sm w-full shadow-2xl" onClick={e => e.stopPropagation()}>
            <p className="font-semibold text-white mb-2">Delete this ticket?</p>
            <p className="text-gray-400 text-sm mb-5">This cannot be undone. All status history will be removed.</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setDeleteId(null)} className="px-4 py-2 text-sm text-gray-400 border border-gray-700 rounded-lg hover:text-white transition-all">Cancel</button>
              <button onClick={confirmDelete} disabled={isDeleting}
                className="px-4 py-2 text-sm bg-rose-500 hover:bg-rose-400 text-white font-bold rounded-lg transition-all disabled:opacity-50">
                {isDeleting ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
