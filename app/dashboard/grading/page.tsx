"use client";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import Link from "next/link";

// ─── Types ────────────────────────────────────────────────────────────────────

type GradeLevel = "A+" | "A" | "B" | "C" | "D" | "F";
type ScreenCond = "perfect" | "minor_scratch" | "crack" | "shatter";
type BackCond = "perfect" | "minor_scratch" | "crack" | "shatter";
type FrameCond = "perfect" | "minor_dent" | "bent" | "broken";

interface PhoneGrade {
  id: string;
  grade_ref: string;
  customer_name: string;
  customer_phone: string;
  device_brand: string;
  device_model: string;
  device_serial: string;
  device_imei: string;
  storage_capacity: string;
  color: string;
  screen_condition: ScreenCond;
  back_condition: BackCond;
  frame_condition: FrameCond;
  battery_health: number | null;
  face_id_works: boolean | null;
  fingerprint_works: boolean | null;
  speakers_work: boolean | null;
  microphone_works: boolean | null;
  front_camera_works: boolean | null;
  rear_camera_works: boolean | null;
  charging_works: boolean | null;
  wifi_works: boolean | null;
  cellular_works: boolean | null;
  buttons_work: boolean | null;
  screen_touch_works: boolean | null;
  grade: GradeLevel;
  trade_in_value: number | null;
  notes: string;
  graded_by: string;
  created_at: string;
}

// ─── Grade config ─────────────────────────────────────────────────────────────

const GRADE_CONFIG: Record<GradeLevel, { label: string; desc: string; color: string; bg: string; textColor: string }> = {
  "A+": { label: "A+ Mint",    desc: "Like new, flawless",          color: "border-emerald-400", bg: "bg-emerald-500/10", textColor: "text-emerald-400" },
  "A":  { label: "A  Excellent",desc: "Minor wear, fully functional",color: "border-green-400",   bg: "bg-green-500/10",   textColor: "text-green-400" },
  "B":  { label: "B  Good",    desc: "Visible wear, all functions",  color: "border-cyan-400",    bg: "bg-cyan-500/10",    textColor: "text-cyan-400" },
  "C":  { label: "C  Fair",    desc: "Heavy wear or minor faults",   color: "border-amber-400",   bg: "bg-amber-500/10",   textColor: "text-amber-400" },
  "D":  { label: "D  Poor",    desc: "Major damage or faults",       color: "border-orange-400",  bg: "bg-orange-500/10",  textColor: "text-orange-400" },
  "F":  { label: "F  Faulty",  desc: "Does not power on / scrap",    color: "border-rose-400",    bg: "bg-rose-500/10",    textColor: "text-rose-400" },
};

const COSMETIC_OPTIONS = {
  screen: [
    { value: "perfect",       label: "Perfect",      pts: 30, icon: "✓" },
    { value: "minor_scratch", label: "Minor Scratch", pts: 20, icon: "~" },
    { value: "crack",         label: "Cracked",       pts: 5,  icon: "⚡" },
    { value: "shatter",       label: "Shattered",     pts: 0,  icon: "✕" },
  ],
  back: [
    { value: "perfect",       label: "Perfect",      pts: 20, icon: "✓" },
    { value: "minor_scratch", label: "Minor Scratch", pts: 15, icon: "~" },
    { value: "crack",         label: "Cracked",       pts: 5,  icon: "⚡" },
    { value: "shatter",       label: "Shattered",     pts: 0,  icon: "✕" },
  ],
  frame: [
    { value: "perfect",    label: "Perfect",    pts: 15, icon: "✓" },
    { value: "minor_dent", label: "Minor Dent", pts: 10, icon: "~" },
    { value: "bent",       label: "Bent",       pts: 2,  icon: "⚡" },
    { value: "broken",     label: "Broken",     pts: 0,  icon: "✕" },
  ],
};

const FUNC_CHECKS: { key: keyof PhoneGrade; label: string; pts: number }[] = [
  { key: "battery_health",      label: "Battery (use % field)",    pts: 0 },
  { key: "face_id_works",       label: "Face ID / Face Unlock",    pts: 5 },
  { key: "fingerprint_works",   label: "Fingerprint Sensor",       pts: 5 },
  { key: "speakers_work",       label: "Speakers",                  pts: 5 },
  { key: "microphone_works",    label: "Microphone",                pts: 5 },
  { key: "front_camera_works",  label: "Front Camera",              pts: 5 },
  { key: "rear_camera_works",   label: "Rear Camera",               pts: 5 },
  { key: "charging_works",      label: "Charging Port",             pts: 10 },
  { key: "wifi_works",          label: "Wi-Fi",                     pts: 5 },
  { key: "cellular_works",      label: "Cellular / SIM",            pts: 5 },
  { key: "buttons_work",        label: "Physical Buttons",          pts: 5 },
  { key: "screen_touch_works",  label: "Touchscreen",               pts: 10 },
];

const uid = () => `GR-${new Date().getFullYear()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;

const emptyForm = (): Omit<PhoneGrade, "id" | "grade_ref" | "created_at"> => ({
  customer_name: "", customer_phone: "", device_brand: "", device_model: "",
  device_serial: "", device_imei: "", storage_capacity: "", color: "",
  screen_condition: "perfect", back_condition: "perfect", frame_condition: "perfect",
  battery_health: null, face_id_works: null, fingerprint_works: null, speakers_work: null,
  microphone_works: null, front_camera_works: null, rear_camera_works: null,
  charging_works: null, wifi_works: null, cellular_works: null, buttons_work: null,
  screen_touch_works: null, grade: "A", trade_in_value: null, notes: "", graded_by: "",
});

// ─── Score calculator ─────────────────────────────────────────────────────────

function calculateGrade(form: ReturnType<typeof emptyForm>): { score: number; grade: GradeLevel } {
  let score = 0;

  // Cosmetic
  score += COSMETIC_OPTIONS.screen.find(o => o.value === form.screen_condition)?.pts ?? 0;
  score += COSMETIC_OPTIONS.back.find(o => o.value === form.back_condition)?.pts ?? 0;
  score += COSMETIC_OPTIONS.frame.find(o => o.value === form.frame_condition)?.pts ?? 0;

  // Battery
  const bh = form.battery_health ?? 80;
  if (bh >= 90) score += 15;
  else if (bh >= 80) score += 10;
  else if (bh >= 70) score += 5;
  else score += 0;

  // Functional checks (each worth 5 pts when true, -5 if false and not null)
  const funcKeys = FUNC_CHECKS.filter(c => c.key !== "battery_health");
  for (const { key, pts } of funcKeys) {
    const val = (form as Record<string, unknown>)[key];
    if (val === true) score += pts;
    else if (val === false) score -= pts;
    // null = not tested → neutral
  }

  const grade: GradeLevel =
    score >= 90 ? "A+" :
    score >= 75 ? "A"  :
    score >= 55 ? "B"  :
    score >= 35 ? "C"  :
    score >= 15 ? "D"  : "F";

  return { score, grade };
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function GradingPage() {
  const router = useRouter();
  const [grades, setGrades] = useState<PhoneGrade[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedGradeFilter, setSelectedGradeFilter] = useState<GradeLevel | "all">("all");

  const [form, setForm] = useState(emptyForm());
  const { score, grade: autoGrade } = calculateGrade(form);

  const showToast = (msg: string, type: "success" | "error") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchGrades = useCallback(async () => {
    const { data, error } = await supabase
      .from("phone_grades")
      .select("*")
      .order("created_at", { ascending: false });
    if (!error && data) setGrades(data as PhoneGrade[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => { if (!user) router.push("/login"); });
    fetchGrades();
  }, [fetchGrades, router]);

  const setField = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm(prev => ({ ...prev, [k]: v }));

  const setCheck = (key: string, val: boolean | null) =>
    setForm(prev => ({ ...prev, [key]: val }));

  const handleSave = async () => {
    if (!form.device_brand || !form.device_model) {
      showToast("Device brand and model are required", "error"); return;
    }
    setIsSaving(true);
    const payload = { ...form, grade: autoGrade };

    if (editingId) {
      const { error } = await supabase.from("phone_grades").update(payload).eq("id", editingId);
      setIsSaving(false);
      if (error) { showToast("Save failed: " + error.message, "error"); return; }
      showToast("Grade updated!", "success");
    } else {
      const grade_ref = uid();
      const { error } = await supabase.from("phone_grades").insert({ ...payload, grade_ref });
      setIsSaving(false);
      if (error) { showToast("Save failed: " + error.message, "error"); return; }
      showToast("Grade saved!", "success");
    }
    setIsFormOpen(false);
    setEditingId(null);
    setForm(emptyForm());
    fetchGrades();
  };

  const openEdit = (g: PhoneGrade) => {
    setForm({
      customer_name: g.customer_name, customer_phone: g.customer_phone,
      device_brand: g.device_brand, device_model: g.device_model,
      device_serial: g.device_serial, device_imei: g.device_imei,
      storage_capacity: g.storage_capacity, color: g.color,
      screen_condition: g.screen_condition, back_condition: g.back_condition, frame_condition: g.frame_condition,
      battery_health: g.battery_health, face_id_works: g.face_id_works, fingerprint_works: g.fingerprint_works,
      speakers_work: g.speakers_work, microphone_works: g.microphone_works,
      front_camera_works: g.front_camera_works, rear_camera_works: g.rear_camera_works,
      charging_works: g.charging_works, wifi_works: g.wifi_works, cellular_works: g.cellular_works,
      buttons_work: g.buttons_work, screen_touch_works: g.screen_touch_works,
      grade: g.grade, trade_in_value: g.trade_in_value, notes: g.notes, graded_by: g.graded_by,
    });
    setEditingId(g.id);
    setIsFormOpen(true);
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    setIsDeleting(true);
    await supabase.from("phone_grades").delete().eq("id", deleteId);
    setIsDeleting(false);
    setDeleteId(null);
    showToast("Grade record deleted", "success");
    fetchGrades();
  };

  const filtered = grades.filter(g => {
    const q = searchQuery.toLowerCase();
    const matchQ = !q || g.grade_ref.toLowerCase().includes(q) || g.customer_name.toLowerCase().includes(q) ||
      `${g.device_brand} ${g.device_model}`.toLowerCase().includes(q);
    const matchG = selectedGradeFilter === "all" || g.grade === selectedGradeFilter;
    return matchQ && matchG;
  });

  if (loading) return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const CheckButton = ({ label, value, onChange }: { label: string; value: boolean | null; onChange: (v: boolean | null) => void }) => (
    <div className="flex items-center justify-between py-2 border-b border-gray-200/60 dark:border-gray-800/50">
      <span className="text-sm text-gray-700 dark:text-gray-300">{label}</span>
      <div className="flex gap-1">
        {([true, false, null] as (boolean | null)[]).map(v => (
          <button
            key={String(v)}
            onClick={() => onChange(v)}
            className={`w-10 h-7 rounded-md text-xs font-bold transition-all border ${
              value === v
                ? v === true  ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/50"
                : v === false ? "bg-rose-500/20 text-rose-400 border-rose-500/50"
                :               "bg-gray-700 text-gray-400 border-gray-600"
                : "bg-gray-100 dark:bg-gray-800/50 text-gray-400 dark:text-gray-600 border-gray-200 dark:border-gray-800 hover:border-gray-400 dark:hover:border-gray-600"
            }`}
          >
            {v === true ? "✓" : v === false ? "✕" : "—"}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-white">

      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl text-sm font-semibold shadow-2xl border ${
          toast.type === "success" ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40" : "bg-rose-500/20 text-rose-300 border-rose-500/40"
        }`}>{toast.msg}</div>
      )}

      {/* Header */}
      <div className="sticky top-0 z-30 bg-white/95 dark:bg-gray-900/95 backdrop-blur-md border-b border-gray-200 dark:border-gray-800 px-4 md:px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">← Dashboard</Link>
          <span className="text-gray-700">|</span>
          <h1 className="font-bold text-gray-900 dark:text-white">Phone Grading System</h1>
        </div>
        <button
          onClick={() => { setForm(emptyForm()); setEditingId(null); setIsFormOpen(true); }}
          className="px-4 py-1.5 text-xs bg-cyan-500 hover:bg-cyan-400 text-black font-bold rounded-lg transition-all"
        >
          + Grade a Phone
        </button>
      </div>

      <div className="max-w-screen-xl mx-auto px-4 md:px-6 py-6">

        {/* Grade summary cards */}
        <div className="grid grid-cols-3 md:grid-cols-6 gap-3 mb-6">
          {(Object.entries(GRADE_CONFIG) as [GradeLevel, typeof GRADE_CONFIG["A"]][]).map(([g, cfg]) => {
            const count = grades.filter(r => r.grade === g).length;
            return (
              <button
                key={g}
                onClick={() => setSelectedGradeFilter(selectedGradeFilter === g ? "all" : g)}
                className={`rounded-xl border p-3 text-center transition-all ${cfg.bg} ${cfg.color} ${
                  selectedGradeFilter === g ? "ring-2 ring-current" : "opacity-70 hover:opacity-100"
                }`}
              >
                <p className={`text-2xl font-black ${cfg.textColor}`}>{g}</p>
                <p className="text-xs text-gray-400 mt-1">{count} units</p>
              </button>
            );
          })}
        </div>

        {/* Filters */}
        <div className="flex gap-2 mb-6">
          <input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search by ref, customer, device..."
            className="flex-1 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:border-cyan-500 transition-all"
          />
        </div>

        {/* Records table */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-800 bg-gray-50/80 dark:bg-gray-900/80">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase">Ref</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase">Customer</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase">Device</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase">Storage</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase">Battery</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase">Grade</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase">Trade-in</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase">Date</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={9} className="px-4 py-12 text-center text-gray-500">No grade records found</td></tr>
              )}
              {filtered.map(g => {
                const cfg = GRADE_CONFIG[g.grade];
                return (
                  <tr key={g.id} className="border-b border-gray-200/50 dark:border-gray-800/50 hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors">
                    <td className="px-4 py-3 text-xs font-mono text-cyan-400">{g.grade_ref}</td>
                    <td className="px-4 py-3">
                      <p className="text-gray-900 dark:text-white font-medium">{g.customer_name || "—"}</p>
                      <p className="text-xs text-gray-500">{g.customer_phone || ""}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-gray-900 dark:text-white">{g.device_brand} {g.device_model}</p>
                      {g.color && <p className="text-xs text-gray-500">{g.color}</p>}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">{g.storage_capacity || "—"}</td>
                    <td className="px-4 py-3">
                      {g.battery_health !== null ? (
                        <div className="flex items-center gap-1.5">
                          <div className="w-16 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${g.battery_health >= 80 ? "bg-emerald-500" : g.battery_health >= 60 ? "bg-amber-500" : "bg-rose-500"}`}
                              style={{ width: `${g.battery_health}%` }} />
                          </div>
                          <span className="text-xs text-gray-400">{g.battery_health}%</span>
                        </div>
                      ) : <span className="text-gray-600">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center justify-center w-10 h-10 rounded-xl border ${cfg.color} ${cfg.bg} text-lg font-black ${cfg.textColor}`}>
                        {g.grade}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-emerald-400 font-semibold">
                      {g.trade_in_value ? `Rs ${g.trade_in_value.toLocaleString()}` : "—"}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">{new Date(g.created_at).toLocaleDateString()}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <button onClick={() => openEdit(g)} className="text-xs text-indigo-400 hover:text-indigo-300 px-2 py-1 rounded transition-colors">Edit</button>
                        <button onClick={() => setDeleteId(g.id)} className="text-xs text-rose-400 hover:text-rose-300 px-2 py-1 rounded transition-colors">Del</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Grading Form Modal ─────────────────────────────────────────────────── */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/80 backdrop-blur-sm overflow-y-auto p-4">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl w-full max-w-2xl my-4 shadow-2xl">

            {/* Live grade banner */}
            <div className={`rounded-t-2xl px-6 py-4 flex items-center justify-between border-b border-gray-200 dark:border-gray-800 ${GRADE_CONFIG[autoGrade].bg}`}>
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wider">{editingId ? "Edit Grade" : "New Phone Grade"}</p>
                <p className="text-sm text-gray-600 dark:text-gray-300 mt-0.5">Score: <span className="font-bold text-gray-900 dark:text-white">{score}/165</span></p>
              </div>
              <div className={`w-20 h-20 rounded-2xl border-2 flex items-center justify-center ${GRADE_CONFIG[autoGrade].color} ${GRADE_CONFIG[autoGrade].bg}`}>
                <span className={`text-4xl font-black ${GRADE_CONFIG[autoGrade].textColor}`}>{autoGrade}</span>
              </div>
              <button onClick={() => setIsFormOpen(false)} className="text-gray-500 hover:text-gray-900 dark:hover:text-white text-xl self-start transition-colors">✕</button>
            </div>

            <div className="px-6 py-5 space-y-6 max-h-[calc(100vh-220px)] overflow-y-auto">

              {/* Device & Customer */}
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Device & Customer</p>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: "Brand *", key: "device_brand" as const, placeholder: "Apple" },
                    { label: "Model *", key: "device_model" as const, placeholder: "iPhone 14" },
                    { label: "Storage", key: "storage_capacity" as const, placeholder: "128GB" },
                    { label: "Color",   key: "color" as const,            placeholder: "Midnight" },
                    { label: "Serial",  key: "device_serial" as const,    placeholder: "C7FXX…" },
                    { label: "IMEI",    key: "device_imei" as const,       placeholder: "35XXXX…" },
                    { label: "Customer Name",  key: "customer_name" as const,  placeholder: "John Doe" },
                    { label: "Customer Phone", key: "customer_phone" as const, placeholder: "+230 5XXX" },
                  ].map(({ label, key, placeholder }) => (
                    <div key={key}>
                      <label className="block text-xs text-gray-400 mb-1">{label}</label>
                      <input value={(form[key] as string) ?? ""} onChange={e => setField(key, e.target.value as never)} placeholder={placeholder}
                        className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:border-cyan-500 transition-all" />
                    </div>
                  ))}
                </div>
              </div>

              {/* Cosmetic */}
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Cosmetic Condition</p>
                <div className="space-y-4">
                  {[
                    { label: "Screen",       opts: COSMETIC_OPTIONS.screen, field: "screen_condition" as const },
                    { label: "Back Cover",   opts: COSMETIC_OPTIONS.back,   field: "back_condition" as const },
                    { label: "Frame / Body", opts: COSMETIC_OPTIONS.frame,  field: "frame_condition" as const },
                  ].map(({ label, opts, field }) => (
                    <div key={field}>
                      <p className="text-xs text-gray-400 mb-2">{label}</p>
                      <div className="flex flex-wrap gap-2">
                        {opts.map(o => (
                          <button
                            key={o.value}
                            onClick={() => setField(field, o.value as never)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                              (form[field] as string) === o.value
                                ? "bg-cyan-500/20 text-cyan-400 border-cyan-500/50"
                                : "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-500"
                            }`}
                          >
                            <span>{o.icon}</span>
                            <span>{o.label}</span>
                            <span className="text-gray-500">+{o.pts}pts</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Battery */}
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Battery Health</p>
                <div className="flex items-center gap-4">
                  <input
                    type="range" min={0} max={100}
                    value={form.battery_health ?? 80}
                    onChange={e => setField("battery_health", parseInt(e.target.value))}
                    className="flex-1 accent-cyan-500"
                  />
                  <div className="flex items-center gap-1">
                    <input
                      type="number" min={0} max={100}
                      value={form.battery_health ?? ""}
                      onChange={e => setField("battery_health", e.target.value ? parseInt(e.target.value) : null)}
                      placeholder="80"
                      className="w-16 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1.5 text-sm text-gray-900 dark:text-white text-center focus:outline-none focus:border-cyan-500 transition-all"
                    />
                    <span className="text-sm text-gray-400">%</span>
                  </div>
                </div>
                <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden mt-2">
                  <div
                    className={`h-full rounded-full transition-all ${(form.battery_health ?? 80) >= 80 ? "bg-emerald-500" : (form.battery_health ?? 80) >= 60 ? "bg-amber-500" : "bg-rose-500"}`}
                    style={{ width: `${form.battery_health ?? 80}%` }}
                  />
                </div>
              </div>

              {/* Functional checks */}
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Functional Checks</p>
                <p className="text-xs text-gray-600 mb-3">✓ = Pass  ✕ = Fail  — = Not tested</p>
                <div className="bg-gray-100 dark:bg-gray-800/50 rounded-xl px-4 py-2">
                  {FUNC_CHECKS.filter(c => c.key !== "battery_health").map(c => (
                    <CheckButton
                      key={c.key as string}
                      label={c.label}
                      value={(form as Record<string, unknown>)[c.key as string] as boolean | null}
                      onChange={v => setCheck(c.key as string, v)}
                    />
                  ))}
                </div>
              </div>

              {/* Trade-in & grader */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Trade-in Value (Rs)</label>
                  <input
                    type="number" value={form.trade_in_value ?? ""} placeholder="0.00"
                    onChange={e => setField("trade_in_value", e.target.value ? parseFloat(e.target.value) : null)}
                    className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:border-cyan-500 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Graded By</label>
                  <input value={form.graded_by} onChange={e => setField("graded_by", e.target.value)} placeholder="Technician name"
                    className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:border-cyan-500 transition-all" />
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Notes</label>
                <textarea value={form.notes} onChange={e => setField("notes", e.target.value)} rows={2} placeholder="Additional notes..."
                  className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:border-cyan-500 transition-all resize-none" />
              </div>
            </div>

            <div className="flex justify-between items-center px-6 py-4 border-t border-gray-200 dark:border-gray-800">
              <div className={`flex items-center gap-2 px-4 py-2 rounded-xl border ${GRADE_CONFIG[autoGrade].bg} ${GRADE_CONFIG[autoGrade].color}`}>
                <span className={`text-2xl font-black ${GRADE_CONFIG[autoGrade].textColor}`}>{autoGrade}</span>
                <span className="text-xs text-gray-400">{GRADE_CONFIG[autoGrade].desc}</span>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setIsFormOpen(false)} className="px-4 py-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white border border-gray-200 dark:border-gray-700 rounded-lg transition-all">Cancel</button>
                <button onClick={handleSave} disabled={isSaving}
                  className="px-5 py-2 text-sm bg-cyan-500 hover:bg-cyan-400 text-black font-bold rounded-lg transition-all disabled:opacity-50">
                  {isSaving ? "Saving…" : editingId ? "Save Changes" : "Save Grade"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl p-6 max-w-sm w-full shadow-2xl">
            <p className="text-gray-900 dark:text-white font-semibold mb-2">Delete this grade record?</p>
            <p className="text-gray-500 dark:text-gray-400 text-sm mb-5">This cannot be undone.</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setDeleteId(null)} className="px-4 py-2 text-sm text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700 rounded-lg hover:text-gray-900 dark:hover:text-white transition-all">Cancel</button>
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
