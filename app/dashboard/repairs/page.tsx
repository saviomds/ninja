"use client";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import Link from "next/link";

// ─── Types ────────────────────────────────────────────────────────────────────

type TicketStatus = "received" | "diagnosed" | "in_repair" | "waiting_parts" | "ready" | "delivered" | "cancelled";
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

const PIPELINE: { key: TicketStatus; label: string; color: string; bg: string; icon: string }[] = [
  { key: "received",       label: "Received",       color: "text-blue-400",    bg: "bg-blue-500/10 border-blue-500/30",    icon: "📥" },
  { key: "diagnosed",      label: "Diagnosed",      color: "text-purple-400",  bg: "bg-purple-500/10 border-purple-500/30", icon: "🔍" },
  { key: "in_repair",      label: "In Repair",      color: "text-amber-400",   bg: "bg-amber-500/10 border-amber-500/30",  icon: "🔧" },
  { key: "waiting_parts",  label: "Waiting Parts",  color: "text-orange-400",  bg: "bg-orange-500/10 border-orange-500/30", icon: "⏳" },
  { key: "ready",          label: "Ready",          color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/30", icon: "✅" },
  { key: "delivered",      label: "Delivered",      color: "text-gray-400",    bg: "bg-gray-500/10 border-gray-500/30",    icon: "📦" },
  { key: "cancelled",      label: "Cancelled",      color: "text-rose-400",    bg: "bg-rose-500/10 border-rose-500/30",    icon: "✗" },
];

const PRIORITY_STYLE: Record<TicketPriority, string> = {
  low:    "text-gray-400 bg-gray-500/10 border-gray-500/30",
  normal: "text-cyan-400 bg-cyan-500/10 border-cyan-500/30",
  high:   "text-amber-400 bg-amber-500/10 border-amber-500/30",
  urgent: "text-rose-400 bg-rose-500/10 border-rose-500/30 animate-pulse",
};

const emptyTicket = () => ({
  customer_name: "", customer_phone: "", customer_email: "",
  device_brand: "", device_model: "", device_serial: "", device_color: "",
  issue_description: "", priority: "normal" as TicketPriority,
  technician: "", estimated_cost: "", final_cost: "",
  estimated_completion: "", notes: "",
});

const uid = () => Math.random().toString(36).slice(2, 9).toUpperCase();

// ─── Component ────────────────────────────────────────────────────────────────

export default function RepairsPage() {
  const router = useRouter();
  const [tickets, setTickets] = useState<RepairTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  // Filters & view
  const [viewMode, setViewMode] = useState<"pipeline" | "list">("pipeline");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<TicketStatus | "all">("all");
  const [priorityFilter, setPriorityFilter] = useState<TicketPriority | "all">("all");

  // Modals
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<RepairTicket | null>(null);
  const [statusHistory, setStatusHistory] = useState<StatusHistory[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [form, setForm] = useState(emptyTicket());

  const showToast = (msg: string, type: "success" | "error") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchTickets = useCallback(async () => {
    const { data, error } = await supabase
      .from("repair_tickets")
      .select("*")
      .order("created_at", { ascending: false });
    if (!error && data) setTickets(data as RepairTicket[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) router.push("/login");
    });
    fetchTickets();
  }, [fetchTickets, router]);

  const handleSave = async () => {
    if (!form.customer_name || !form.device_brand || !form.device_model || !form.issue_description) {
      showToast("Fill in required fields", "error"); return;
    }
    setIsSaving(true);
    const payload = {
      ...form,
      estimated_cost: form.estimated_cost ? parseFloat(form.estimated_cost) : null,
      final_cost: form.final_cost ? parseFloat(form.final_cost) : null,
      estimated_completion: form.estimated_completion || null,
    };

    if (editingId) {
      const { error } = await supabase.from("repair_tickets").update(payload).eq("id", editingId);
      setIsSaving(false);
      if (error) { showToast("Save failed: " + error.message, "error"); return; }
      showToast("Ticket updated!", "success");
    } else {
      const ticket_no = `TN-${new Date().getFullYear()}-${uid()}`;
      const { error } = await supabase.from("repair_tickets").insert({ ...payload, ticket_no, status: "received" });
      setIsSaving(false);
      if (error) { showToast("Save failed: " + error.message, "error"); return; }
      showToast("Ticket created!", "success");
    }
    setIsFormOpen(false);
    setEditingId(null);
    setForm(emptyTicket());
    fetchTickets();
  };

  const handleStatusChange = async (ticket: RepairTicket, newStatus: TicketStatus) => {
    const { error } = await supabase.from("repair_tickets").update({ status: newStatus }).eq("id", ticket.id);
    if (error) { showToast("Status update failed", "error"); return; }
    await supabase.from("repair_status_history").insert({
      ticket_id: ticket.id,
      status: newStatus,
      notes: `Status changed to ${newStatus}`,
      changed_by: "Admin",
    });
    showToast("Status updated!", "success");
    fetchTickets();
    if (selectedTicket?.id === ticket.id) {
      setSelectedTicket({ ...selectedTicket, status: newStatus });
      fetchHistory(ticket.id);
    }
  };

  const fetchHistory = async (ticketId: string) => {
    const { data } = await supabase
      .from("repair_status_history")
      .select("*")
      .eq("ticket_id", ticketId)
      .order("created_at", { ascending: false });
    if (data) setStatusHistory(data as StatusHistory[]);
  };

  const openDetail = async (ticket: RepairTicket) => {
    setSelectedTicket(ticket);
    setIsDetailOpen(true);
    fetchHistory(ticket.id);
  };

  const openEdit = (ticket: RepairTicket) => {
    setForm({
      customer_name: ticket.customer_name,
      customer_phone: ticket.customer_phone || "",
      customer_email: ticket.customer_email || "",
      device_brand: ticket.device_brand,
      device_model: ticket.device_model,
      device_serial: ticket.device_serial || "",
      device_color: ticket.device_color || "",
      issue_description: ticket.issue_description,
      priority: ticket.priority,
      technician: ticket.technician || "",
      estimated_cost: ticket.estimated_cost?.toString() || "",
      final_cost: ticket.final_cost?.toString() || "",
      estimated_completion: ticket.estimated_completion || "",
      notes: ticket.notes || "",
    });
    setEditingId(ticket.id);
    setIsFormOpen(true);
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    setIsDeleting(true);
    await supabase.from("repair_tickets").delete().eq("id", deleteId);
    setIsDeleting(false);
    setDeleteId(null);
    showToast("Ticket deleted", "success");
    fetchTickets();
  };

  // Filter logic
  const filtered = tickets.filter(t => {
    const q = searchQuery.toLowerCase();
    const matchQ = !q || t.ticket_no.toLowerCase().includes(q) || t.customer_name.toLowerCase().includes(q) ||
      t.device_brand.toLowerCase().includes(q) || t.device_model.toLowerCase().includes(q);
    const matchS = statusFilter === "all" || t.status === statusFilter;
    const matchP = priorityFilter === "all" || t.priority === priorityFilter;
    return matchQ && matchS && matchP;
  });

  const getByStatus = (s: TicketStatus) => filtered.filter(t => t.status === s);

  const stats = {
    active: tickets.filter(t => !["delivered","cancelled"].includes(t.status)).length,
    urgent: tickets.filter(t => t.priority === "urgent").length,
    ready: tickets.filter(t => t.status === "ready").length,
    today: tickets.filter(t => t.created_at.slice(0,10) === new Date().toISOString().slice(0,10)).length,
  };

  const f = (field: string) => (v: string) => setForm(prev => ({ ...prev, [field]: v }));

  // ─── Render ───────────────────────────────────────────────────────────────

  if (loading) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-950 text-white">

      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl text-sm font-semibold shadow-2xl border ${
          toast.type === "success" ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40" : "bg-rose-500/20 text-rose-300 border-rose-500/40"
        }`}>{toast.msg}</div>
      )}

      {/* Header */}
      <div className="sticky top-0 z-30 bg-gray-900/95 backdrop-blur-md border-b border-gray-800 px-4 md:px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="text-sm text-gray-400 hover:text-white transition-colors">← Dashboard</Link>
          <span className="text-gray-700">|</span>
          <h1 className="font-bold text-white">Repair Tickets</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setViewMode(v => v === "pipeline" ? "list" : "pipeline"); }}
            className="px-3 py-1.5 text-xs bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg text-gray-300 transition-all"
          >
            {viewMode === "pipeline" ? "List View" : "Pipeline View"}
          </button>
          <button
            onClick={() => { setForm(emptyTicket()); setEditingId(null); setIsFormOpen(true); }}
            className="px-4 py-1.5 text-xs bg-cyan-500 hover:bg-cyan-400 text-black font-bold rounded-lg transition-all"
          >
            + New Ticket
          </button>
        </div>
      </div>

      <div className="max-w-screen-2xl mx-auto px-4 md:px-6 py-6">

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[
            { label: "Active Jobs", value: stats.active, color: "text-cyan-400", bg: "bg-cyan-500/10 border-cyan-500/20" },
            { label: "Urgent", value: stats.urgent, color: "text-rose-400", bg: "bg-rose-500/10 border-rose-500/20" },
            { label: "Ready to Collect", value: stats.ready, color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20" },
            { label: "New Today", value: stats.today, color: "text-purple-400", bg: "bg-purple-500/10 border-purple-500/20" },
          ].map(s => (
            <div key={s.label} className={`rounded-xl border p-4 ${s.bg}`}>
              <p className="text-xs text-gray-400 mb-1">{s.label}</p>
              <p className={`text-3xl font-bold ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2 mb-6">
          <input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search ticket, customer, device..."
            className="flex-1 min-w-[200px] bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500 transition-all"
          />
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
        </div>

        {/* Pipeline View */}
        {viewMode === "pipeline" && (
          <div className="overflow-x-auto pb-4">
            <div className="flex gap-4 min-w-max">
              {PIPELINE.map(stage => {
                const stageTickets = getByStatus(stage.key);
                return (
                  <div key={stage.key} className="w-64 flex-shrink-0">
                    <div className={`flex items-center justify-between px-3 py-2 rounded-t-xl border ${stage.bg} mb-0`}>
                      <span className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
                        <span>{stage.icon}</span>
                        <span className={stage.color}>{stage.label}</span>
                      </span>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${stage.color} bg-gray-900`}>
                        {stageTickets.length}
                      </span>
                    </div>
                    <div className="bg-gray-900/50 border border-t-0 border-gray-800 rounded-b-xl min-h-[200px] p-2 space-y-2">
                      {stageTickets.length === 0 && (
                        <p className="text-xs text-gray-600 text-center py-6">No tickets</p>
                      )}
                      {stageTickets.map(ticket => (
                        <div
                          key={ticket.id}
                          onClick={() => openDetail(ticket)}
                          className="bg-gray-800 hover:bg-gray-750 border border-gray-700 rounded-lg p-3 cursor-pointer transition-all hover:border-gray-600 hover:shadow-lg"
                        >
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <span className="text-xs font-mono text-cyan-400">{ticket.ticket_no}</span>
                            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${PRIORITY_STYLE[ticket.priority]}`}>
                              {ticket.priority}
                            </span>
                          </div>
                          <p className="text-sm font-semibold text-white truncate">{ticket.customer_name}</p>
                          <p className="text-xs text-gray-400 truncate">{ticket.device_brand} {ticket.device_model}</p>
                          <p className="text-xs text-gray-500 mt-1 line-clamp-2">{ticket.issue_description}</p>
                          {ticket.technician && (
                            <p className="text-xs text-indigo-400 mt-1">Tech: {ticket.technician}</p>
                          )}
                          {ticket.estimated_cost && (
                            <p className="text-xs text-emerald-400 mt-1 font-semibold">Est. Rs {ticket.estimated_cost.toLocaleString()}</p>
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

        {/* List View */}
        {viewMode === "list" && (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800 bg-gray-900/80">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase">Ticket</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase">Customer</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase">Device</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase">Priority</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase">Tech</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase">Est. Cost</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase">Created</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr><td colSpan={9} className="px-4 py-12 text-center text-gray-500 text-sm">No tickets found</td></tr>
                )}
                {filtered.map(ticket => {
                  const stage = PIPELINE.find(p => p.key === ticket.status);
                  return (
                    <tr key={ticket.id} className="border-b border-gray-800/50 hover:bg-gray-800/40 transition-colors">
                      <td className="px-4 py-3">
                        <span className="text-xs font-mono text-cyan-400">{ticket.ticket_no}</span>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-white font-medium">{ticket.customer_name}</p>
                        <p className="text-xs text-gray-500">{ticket.customer_phone}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-white">{ticket.device_brand} {ticket.device_model}</p>
                        {ticket.device_serial && <p className="text-xs text-gray-500">{ticket.device_serial}</p>}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${PRIORITY_STYLE[ticket.priority]}`}>
                          {ticket.priority}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${stage?.bg} ${stage?.color}`}>
                          {stage?.icon} {stage?.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-300">{ticket.technician || "—"}</td>
                      <td className="px-4 py-3 text-sm text-emerald-400">
                        {ticket.estimated_cost ? `Rs ${ticket.estimated_cost.toLocaleString()}` : "—"}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">
                        {new Date(ticket.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3">
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

      {/* ── Create/Edit Modal ──────────────────────────────────────────────────── */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 backdrop-blur-sm overflow-y-auto p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-2xl my-4 shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
              <h2 className="font-bold text-lg text-white">{editingId ? "Edit Ticket" : "New Repair Ticket"}</h2>
              <button onClick={() => setIsFormOpen(false)} className="text-gray-500 hover:text-white text-xl transition-colors">✕</button>
            </div>

            <div className="px-6 py-5 space-y-5 max-h-[calc(100vh-200px)] overflow-y-auto">

              {/* Customer */}
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Customer Information</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {[
                    { label: "Full Name *", field: "customer_name", placeholder: "John Doe" },
                    { label: "Phone", field: "customer_phone", placeholder: "+230 5XXX XXXX" },
                    { label: "Email", field: "customer_email", placeholder: "customer@email.com" },
                  ].map(({ label, field, placeholder }) => (
                    <div key={field}>
                      <label className="block text-xs text-gray-400 mb-1">{label}</label>
                      <input value={(form as Record<string, string>)[field]} onChange={e => f(field)(e.target.value)} placeholder={placeholder}
                        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500 transition-all" />
                    </div>
                  ))}
                </div>
              </div>

              {/* Device */}
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Device Information</p>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {[
                    { label: "Brand *", field: "device_brand", placeholder: "Apple / Samsung" },
                    { label: "Model *", field: "device_model", placeholder: "iPhone 15 Pro" },
                    { label: "Serial", field: "device_serial", placeholder: "SN123456" },
                    { label: "Color", field: "device_color", placeholder: "Space Black" },
                  ].map(({ label, field, placeholder }) => (
                    <div key={field}>
                      <label className="block text-xs text-gray-400 mb-1">{label}</label>
                      <input value={(form as Record<string, string>)[field]} onChange={e => f(field)(e.target.value)} placeholder={placeholder}
                        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500 transition-all" />
                    </div>
                  ))}
                </div>
              </div>

              {/* Issue */}
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Issue Details</p>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Issue Description *</label>
                  <textarea value={form.issue_description} onChange={e => f("issue_description")(e.target.value)} rows={3}
                    placeholder="Describe the problem in detail..." className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500 transition-all resize-none" />
                </div>
                <div className="grid grid-cols-2 gap-3 mt-3">
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Priority</label>
                    <select value={form.priority} onChange={e => f("priority")(e.target.value)}
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500 transition-all">
                      <option value="low">Low</option>
                      <option value="normal">Normal</option>
                      <option value="high">High</option>
                      <option value="urgent">Urgent</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Technician</label>
                    <input value={form.technician} onChange={e => f("technician")(e.target.value)} placeholder="Assigned tech"
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500 transition-all" />
                  </div>
                </div>
              </div>

              {/* Pricing */}
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Pricing & Timeline</p>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {[
                    { label: "Est. Cost (Rs)", field: "estimated_cost", placeholder: "0.00" },
                    { label: "Final Cost (Rs)", field: "final_cost", placeholder: "0.00" },
                  ].map(({ label, field, placeholder }) => (
                    <div key={field}>
                      <label className="block text-xs text-gray-400 mb-1">{label}</label>
                      <input type="number" value={(form as Record<string, string>)[field]} onChange={e => f(field)(e.target.value)} placeholder={placeholder}
                        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500 transition-all" />
                    </div>
                  ))}
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Est. Completion</label>
                    <input type="date" value={form.estimated_completion} onChange={e => f("estimated_completion")(e.target.value)}
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500 transition-all" />
                  </div>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs text-gray-400 mb-1">Internal Notes</label>
                <textarea value={form.notes} onChange={e => f("notes")(e.target.value)} rows={2}
                  placeholder="Internal notes..." className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500 transition-all resize-none" />
              </div>
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

      {/* ── Detail Modal ───────────────────────────────────────────────────────── */}
      {isDetailOpen && selectedTicket && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 backdrop-blur-sm overflow-y-auto p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-2xl my-4 shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
              <div>
                <p className="text-xs font-mono text-cyan-400">{selectedTicket.ticket_no}</p>
                <h2 className="font-bold text-lg text-white">{selectedTicket.customer_name}</h2>
              </div>
              <button onClick={() => setIsDetailOpen(false)} className="text-gray-500 hover:text-white text-xl transition-colors">✕</button>
            </div>

            <div className="px-6 py-5 space-y-5 max-h-[calc(100vh-200px)] overflow-y-auto">

              {/* Info grid */}
              <div className="grid grid-cols-2 gap-4">
                <div><p className="text-xs text-gray-500">Device</p><p className="text-sm text-white font-medium">{selectedTicket.device_brand} {selectedTicket.device_model}</p></div>
                <div><p className="text-xs text-gray-500">Serial</p><p className="text-sm text-white">{selectedTicket.device_serial || "—"}</p></div>
                <div><p className="text-xs text-gray-500">Phone</p><p className="text-sm text-white">{selectedTicket.customer_phone || "—"}</p></div>
                <div><p className="text-xs text-gray-500">Email</p><p className="text-sm text-white">{selectedTicket.customer_email || "—"}</p></div>
                <div><p className="text-xs text-gray-500">Technician</p><p className="text-sm text-white">{selectedTicket.technician || "—"}</p></div>
                <div><p className="text-xs text-gray-500">Priority</p>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${PRIORITY_STYLE[selectedTicket.priority]}`}>{selectedTicket.priority}</span>
                </div>
                <div><p className="text-xs text-gray-500">Est. Cost</p><p className="text-sm text-emerald-400 font-semibold">{selectedTicket.estimated_cost ? `Rs ${selectedTicket.estimated_cost.toLocaleString()}` : "—"}</p></div>
                <div><p className="text-xs text-gray-500">Final Cost</p><p className="text-sm text-emerald-400 font-semibold">{selectedTicket.final_cost ? `Rs ${selectedTicket.final_cost.toLocaleString()}` : "—"}</p></div>
              </div>

              <div>
                <p className="text-xs text-gray-500 mb-1">Issue</p>
                <p className="text-sm text-white bg-gray-800 rounded-lg px-3 py-2">{selectedTicket.issue_description}</p>
              </div>
              {selectedTicket.notes && (
                <div>
                  <p className="text-xs text-gray-500 mb-1">Notes</p>
                  <p className="text-sm text-gray-300 bg-gray-800 rounded-lg px-3 py-2">{selectedTicket.notes}</p>
                </div>
              )}

              {/* Status pipeline */}
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Update Status</p>
                <div className="flex flex-wrap gap-2">
                  {PIPELINE.filter(s => s.key !== "cancelled").map(stage => (
                    <button
                      key={stage.key}
                      onClick={() => handleStatusChange(selectedTicket, stage.key)}
                      className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all ${
                        selectedTicket.status === stage.key
                          ? `${stage.bg} ${stage.color} ring-1 ring-current`
                          : "bg-gray-800 text-gray-400 border-gray-700 hover:border-gray-500"
                      }`}
                    >
                      {stage.icon} {stage.label}
                    </button>
                  ))}
                  <button
                    onClick={() => handleStatusChange(selectedTicket, "cancelled")}
                    className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all ${
                      selectedTicket.status === "cancelled"
                        ? "bg-rose-500/10 text-rose-400 border-rose-500/30 ring-1 ring-rose-400"
                        : "bg-gray-800 text-gray-400 border-gray-700 hover:border-gray-500"
                    }`}
                  >
                    ✗ Cancel
                  </button>
                </div>
              </div>

              {/* History */}
              {statusHistory.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Status History</p>
                  <div className="space-y-2">
                    {statusHistory.map(h => {
                      const stage = PIPELINE.find(p => p.key === h.status);
                      return (
                        <div key={h.id} className="flex items-start gap-3 text-xs">
                          <div className="w-1.5 h-1.5 rounded-full bg-gray-500 mt-1.5 flex-shrink-0" />
                          <div>
                            <span className={`font-semibold ${stage?.color || "text-gray-300"}`}>{stage?.label || h.status}</span>
                            <span className="text-gray-500 ml-2">{new Date(h.created_at).toLocaleString()}</span>
                            {h.changed_by && <span className="text-gray-600 ml-2">by {h.changed_by}</span>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-between gap-3 px-6 py-4 border-t border-gray-800">
              <button onClick={() => setDeleteId(selectedTicket.id)} className="px-4 py-2 text-sm text-rose-400 hover:text-rose-300 border border-rose-500/30 rounded-lg transition-all">Delete</button>
              <div className="flex gap-2">
                <button onClick={() => { setIsDetailOpen(false); openEdit(selectedTicket); }} className="px-4 py-2 text-sm bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-all">Edit</button>
                <button onClick={() => setIsDetailOpen(false)} className="px-4 py-2 text-sm bg-cyan-500 hover:bg-cyan-400 text-black font-bold rounded-lg transition-all">Close</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Confirm ─────────────────────────────────────────────────────── */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 max-w-sm w-full shadow-2xl">
            <p className="text-white font-semibold mb-2">Delete this ticket?</p>
            <p className="text-gray-400 text-sm mb-5">This action cannot be undone. All status history will be removed.</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setDeleteId(null)} className="px-4 py-2 text-sm text-gray-400 border border-gray-700 rounded-lg hover:text-white transition-all">Cancel</button>
              <button onClick={confirmDelete} disabled={isDeleting} className="px-4 py-2 text-sm bg-rose-500 hover:bg-rose-400 text-white font-bold rounded-lg transition-all disabled:opacity-50">
                {isDeleting ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
