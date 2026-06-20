"use client";

import { useState } from "react";
import { useTheme } from "@/components/ThemeProvider";

/* ── Types ─────────────────────────────────────────────────────────────────── */

export type LabelType = "new" | "working" | "done" | "pending" | "flagged";

export interface SurveyAssignee {
  initials: string;
  bg: string;   // tailwind bg class e.g. "bg-blue-500"
  name: string;
}

export interface SurveyRow {
  id: string;
  submissionRef: string;
  submittedAt: string;       // ISO string
  customerName: string;
  ageRange: string;
  deviceCategory: string;
  satisfaction: number;      // 1–5
  npsScore: number;          // 0–10
  wouldRecommend: boolean;
  avgRepairTime: string;
  experienceNote: string;
  label: LabelType;
  assignees: SurveyAssignee[];
  progress: number;          // 0–5
}

interface Props {
  title?: string;
  rows?: SurveyRow[];
}

/* ── Config ─────────────────────────────────────────────────────────────────── */

const LABEL_CFG: Record<
  LabelType,
  { dot: string; pill: string; label: string; tooltip: string }
> = {
  new:     { dot: "bg-blue-500",    pill: "bg-blue-50 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300",       label: "New",     tooltip: "Just received"     },
  working: { dot: "bg-amber-500",   pill: "bg-amber-50 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300",   label: "Working", tooltip: "Working on it"     },
  done:    { dot: "bg-emerald-500", pill: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300", label: "Done", tooltip: "Completed"     },
  pending: { dot: "bg-violet-500",  pill: "bg-violet-50 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300", label: "Pending", tooltip: "Waiting for info" },
  flagged: { dot: "bg-red-500",     pill: "bg-red-50 text-red-700 dark:bg-red-500/20 dark:text-red-300",           label: "Flagged", tooltip: "Needs attention"   },
};

const A_POOL: Record<string, SurveyAssignee> = {
  D: { initials: "D", bg: "bg-blue-500",    name: "David K."   },
  H: { initials: "H", bg: "bg-emerald-500", name: "Hannah M."  },
  C: { initials: "C", bg: "bg-purple-500",  name: "Chris P."   },
  W: { initials: "W", bg: "bg-orange-500",  name: "Wayne S."   },
  N: { initials: "N", bg: "bg-pink-500",    name: "Nina T."    },
};

const PAGE_SIZE = 10;

/* ── Mock Data ──────────────────────────────────────────────────────────────── */

const MOCK_ROWS: SurveyRow[] = [
  { id:"1",  submissionRef:"SUB-A1B2C3D4", submittedAt:"2024-06-01T09:12:00Z", customerName:"James Muthoni",   ageRange:"25-34", deviceCategory:"Smartphone", satisfaction:4, npsScore:8,  wouldRecommend:true,  avgRepairTime:"Same day", experienceNote:"The repair was done very quickly and staff were extremely professional throughout.", label:"done",    assignees:[A_POOL.D,A_POOL.H], progress:5 },
  { id:"2",  submissionRef:"SUB-C3D4E5F6", submittedAt:"2024-06-02T11:30:00Z", customerName:"Sophie Oduya",    ageRange:"18-24", deviceCategory:"Laptop",     satisfaction:5, npsScore:10, wouldRecommend:true,  avgRepairTime:"2 hours",  experienceNote:"Incredible service. My laptop screen was replaced in record time with quality parts.", label:"done",    assignees:[A_POOL.W],          progress:5 },
  { id:"3",  submissionRef:"SUB-E5F6G7H8", submittedAt:"2024-06-03T14:05:00Z", customerName:"Kevin Njenga",    ageRange:"35-44", deviceCategory:"Tablet",     satisfaction:3, npsScore:6,  wouldRecommend:false, avgRepairTime:"3 days",   experienceNote:"Took a bit longer than expected but the quality of repair was acceptable overall.", label:"pending", assignees:[A_POOL.C],          progress:3 },
  { id:"4",  submissionRef:"SUB-G7H8I9J0", submittedAt:"2024-06-04T08:45:00Z", customerName:"Amara Diallo",    ageRange:"25-34", deviceCategory:"Smartphone", satisfaction:5, npsScore:9,  wouldRecommend:true,  avgRepairTime:"Same day", experienceNote:"Very happy! Screen replacement done perfectly. Will definitely come back next time.", label:"done",    assignees:[A_POOL.D,A_POOL.N], progress:5 },
  { id:"5",  submissionRef:"SUB-I9J0K1L2", submittedAt:"2024-06-05T16:20:00Z", customerName:"Liam Ochieng",    ageRange:"45-54", deviceCategory:"Desktop",    satisfaction:2, npsScore:4,  wouldRecommend:false, avgRepairTime:"1 week",   experienceNote:"The repair took too long and I was not kept informed about any progress or delays.", label:"flagged", assignees:[A_POOL.H],          progress:2 },
  { id:"6",  submissionRef:"SUB-K1L2M3N4", submittedAt:"2024-06-06T10:00:00Z", customerName:"Fatima Hassan",   ageRange:"18-24", deviceCategory:"Smartphone", satisfaction:4, npsScore:7,  wouldRecommend:true,  avgRepairTime:"4 hours",  experienceNote:"Good service overall, though communication could be improved. Tech was very knowledgeable.", label:"working", assignees:[A_POOL.C,A_POOL.W], progress:3 },
  { id:"7",  submissionRef:"SUB-M3N4O5P6", submittedAt:"2024-06-07T13:15:00Z", customerName:"Daniel Kimura",   ageRange:"25-34", deviceCategory:"Laptop",     satisfaction:5, npsScore:10, wouldRecommend:true,  avgRepairTime:"Same day", experienceNote:"Best tech repair experience I have ever had. Fast, affordable, and excellent quality.", label:"done",    assignees:[A_POOL.D],          progress:5 },
  { id:"8",  submissionRef:"SUB-O5P6Q7R8", submittedAt:"2024-06-08T09:30:00Z", customerName:"Chloe Mensah",    ageRange:"35-44", deviceCategory:"Tablet",     satisfaction:3, npsScore:5,  wouldRecommend:false, avgRepairTime:"2 days",   experienceNote:"Average experience. The part replacement worked but my issue was not fully explained.", label:"pending", assignees:[A_POOL.N],          progress:2 },
  { id:"9",  submissionRef:"SUB-Q7R8S9T0", submittedAt:"2024-06-09T15:45:00Z", customerName:"Marcus Adebayo",  ageRange:"18-24", deviceCategory:"Smartphone", satisfaction:5, npsScore:9,  wouldRecommend:true,  avgRepairTime:"3 hours",  experienceNote:"Staff were super helpful and even gave me tips on how to avoid future screen damage.", label:"done",    assignees:[A_POOL.W,A_POOL.H], progress:5 },
  { id:"10", submissionRef:"SUB-S9T0U1V2", submittedAt:"2024-06-10T11:00:00Z", customerName:"Priya Gupta",     ageRange:"25-34", deviceCategory:"Laptop",     satisfaction:4, npsScore:8,  wouldRecommend:true,  avgRepairTime:"Next day", experienceNote:"Keyboard replacement was clean and the laptop feels brand new. Price was very competitive.", label:"working", assignees:[A_POOL.C],          progress:4 },
  { id:"11", submissionRef:"SUB-U1V2W3X4", submittedAt:"2024-06-11T08:00:00Z", customerName:"Owen Kariuki",    ageRange:"45-54", deviceCategory:"Smartphone", satisfaction:1, npsScore:2,  wouldRecommend:false, avgRepairTime:"5 days",   experienceNote:"Very disappointed. Phone was returned with a different issue than it went in with.", label:"flagged", assignees:[A_POOL.D,A_POOL.C], progress:1 },
  { id:"12", submissionRef:"SUB-W3X4Y5Z6", submittedAt:"2024-06-12T14:30:00Z", customerName:"Zoe Nakamura",    ageRange:"18-24", deviceCategory:"Laptop",     satisfaction:5, npsScore:10, wouldRecommend:true,  avgRepairTime:"Same day", experienceNote:"Came in with a broken charger port and left with a fully working laptop. Superb service.", label:"new",     assignees:[A_POOL.N],          progress:1 },
  { id:"13", submissionRef:"SUB-Y5Z6A7B8", submittedAt:"2024-06-13T10:45:00Z", customerName:"Isaac Nkosi",     ageRange:"35-44", deviceCategory:"Smartphone", satisfaction:4, npsScore:7,  wouldRecommend:true,  avgRepairTime:"2 hours",  experienceNote:"Impressed with the speed. Drop-off and collection was seamless. Highly recommended to all.", label:"working", assignees:[A_POOL.W],          progress:3 },
  { id:"14", submissionRef:"SUB-A7B8C9D0", submittedAt:"2024-06-14T16:00:00Z", customerName:"Layla Osei",      ageRange:"25-34", deviceCategory:"Desktop",    satisfaction:3, npsScore:6,  wouldRecommend:false, avgRepairTime:"3 days",   experienceNote:"Repair was okay but expected a follow-up call that never came. Communication was lacking.", label:"pending", assignees:[A_POOL.H,A_POOL.N], progress:2 },
  { id:"15", submissionRef:"SUB-C9D0E1F2", submittedAt:"2024-06-15T12:00:00Z", customerName:"Ethan Boateng",   ageRange:"55+",   deviceCategory:"Tablet",     satisfaction:5, npsScore:9,  wouldRecommend:true,  avgRepairTime:"Same day", experienceNote:"Such a relief to find a team that actually knows what they are doing. Excellent job done.", label:"new",     assignees:[A_POOL.D,A_POOL.C], progress:0 },
];

/* ── Helpers ────────────────────────────────────────────────────────────────── */

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

/* ── Sub-components ─────────────────────────────────────────────────────────── */

function LabelBadge({ label }: { label: LabelType }) {
  const cfg = LABEL_CFG[label];
  return (
    <div className="relative group/lbl inline-flex">
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold select-none ${cfg.pill}`}>
        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${cfg.dot}`} />
        {cfg.label}
      </span>
      <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover/lbl:flex z-50 flex-col items-center">
        <div className="bg-slate-900 dark:bg-slate-700 text-white text-[11px] font-medium px-2.5 py-1 rounded-lg shadow-xl whitespace-nowrap">
          {cfg.tooltip}
        </div>
        <div className="border-4 border-transparent border-t-slate-900 dark:border-t-slate-700 -mt-px" />
      </div>
    </div>
  );
}

function AssigneeBadge({ a }: { a: SurveyAssignee }) {
  return (
    <div className="relative group/ag inline-flex">
      <div className={`w-7 h-7 rounded-full ${a.bg} text-white text-[11px] font-bold flex items-center justify-center ring-2 ring-white dark:ring-slate-900 cursor-default select-none`}>
        {a.initials}
      </div>
      <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover/ag:flex z-50 flex-col items-center">
        <div className="bg-slate-900 dark:bg-slate-700 text-white text-[11px] font-medium px-2.5 py-1 rounded-lg shadow-xl whitespace-nowrap">
          {a.name}
        </div>
        <div className="border-4 border-transparent border-t-slate-900 dark:border-t-slate-700 -mt-px" />
      </div>
    </div>
  );
}

function ProgressDots({ value, max = 5 }: { value: number; max?: number }) {
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: max }).map((_, i) => (
        <div
          key={i}
          className={`w-3 h-3 rounded-full border-2 transition-colors ${
            i < value
              ? "bg-blue-500 border-blue-500 dark:bg-blue-400 dark:border-blue-400"
              : "bg-transparent border-slate-300 dark:border-slate-600"
          }`}
        />
      ))}
      <span className="ml-1 text-[11px] text-slate-400 dark:text-slate-500 font-medium tabular-nums">
        {value}/{max}
      </span>
    </div>
  );
}

function StarRating({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <svg
          key={i}
          viewBox="0 0 24 24"
          className={`w-3.5 h-3.5 ${i < value ? "fill-amber-400 text-amber-400" : "fill-transparent text-slate-300 dark:text-slate-600"}`}
          stroke="currentColor"
          strokeWidth={i < value ? 0 : 1.5}
        >
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
        </svg>
      ))}
    </div>
  );
}

/* ── Icon primitives ────────────────────────────────────────────────────────── */

function IconChevronDown() {
  return <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>;
}
function IconSearch() {
  return <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><circle cx="11" cy="11" r="6" /><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35" /></svg>;
}
function IconShare() {
  return <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>;
}
function IconClock() {
  return <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="12" r="9" /><path strokeLinecap="round" strokeLinejoin="round" d="M12 7v5l3 3" /></svg>;
}
function IconEye() {
  return <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>;
}
function IconFilter() {
  return <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" /></svg>;
}
function IconDownload() {
  return <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>;
}
function IconSort() {
  return <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" /></svg>;
}
function IconPrint() {
  return <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>;
}
function IconTag() {
  return <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" /></svg>;
}
function IconTrash() {
  return <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>;
}
function IconEdit() {
  return <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>;
}
function IconChevLeft() {
  return <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>;
}
function IconChevRight() {
  return <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>;
}
function IconSun() {
  return <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="12" r="4" /><path strokeLinecap="round" strokeLinejoin="round" d="M12 2v2m0 16v2M4.22 4.22l1.42 1.42m12.72 12.72l1.42 1.42M2 12h2m16 0h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" /></svg>;
}
function IconMoon() {
  return <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>;
}
function IconCheck() {
  return <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>;
}

/* ── Toolbar button ─────────────────────────────────────────────────────────── */

const TOOLBAR_BTNS = [
  { label: "Hide Fields", Icon: IconEye },
  { label: "Filter",      Icon: IconFilter },
  { label: "Download",    Icon: IconDownload },
  { label: "Sort",        Icon: IconSort },
  { label: "Print",       Icon: IconPrint },
  { label: "Label",       Icon: IconTag },
] as const;

/* ── NPS color helper ───────────────────────────────────────────────────────── */

function npsClass(n: number): string {
  if (n >= 9) return "text-emerald-700 bg-emerald-50 dark:text-emerald-300 dark:bg-emerald-500/15";
  if (n >= 7) return "text-blue-700 bg-blue-50 dark:text-blue-300 dark:bg-blue-500/15";
  if (n >= 5) return "text-amber-700 bg-amber-50 dark:text-amber-300 dark:bg-amber-500/15";
  return "text-red-700 bg-red-50 dark:text-red-300 dark:bg-red-500/15";
}

/* ── Main component ─────────────────────────────────────────────────────────── */

export default function SurveyDataTable({ title = "Customer Survey 18.2", rows: propRows }: Props) {
  const { dark, toggle } = useTheme();
  const rows = propRows ?? MOCK_ROWS;

  const [search, setSearch]   = useState("");
  const [page, setPage]       = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  /* Filter */
  const filtered = rows.filter((r) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      r.customerName.toLowerCase().includes(q)   ||
      r.ageRange.toLowerCase().includes(q)        ||
      r.deviceCategory.toLowerCase().includes(q)  ||
      r.experienceNote.toLowerCase().includes(q)  ||
      r.label.includes(q)                         ||
      r.submissionRef.toLowerCase().includes(q)
    );
  });

  const totalPages  = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const curPage     = Math.min(page, totalPages);
  const pageRows    = filtered.slice((curPage - 1) * PAGE_SIZE, curPage * PAGE_SIZE);
  const newCount    = rows.filter((r) => r.label === "new").length;
  const allSelected = pageRows.length > 0 && pageRows.every((r) => selected.has(r.id));

  /* Selection */
  const toggleRow = (id: string) =>
    setSelected((prev) => {
      const s = new Set(prev);
      s.has(id) ? s.delete(id) : s.add(id);
      return s;
    });

  const toggleAll = () =>
    setSelected(allSelected ? new Set() : new Set(pageRows.map((r) => r.id)));

  /* Checkbox cell */
  const CheckCell = ({ checked, onClick }: { checked: boolean; onClick: () => void }) => (
    <button
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
        checked
          ? "bg-blue-600 border-blue-600 dark:bg-blue-500 dark:border-blue-500"
          : "border-slate-300 dark:border-slate-600 hover:border-blue-400"
      }`}
    >
      {checked && <span className="text-white"><IconCheck /></span>}
    </button>
  );

  return (
    <div className="flex flex-col bg-white dark:bg-slate-950 rounded-2xl overflow-hidden border border-slate-200/70 dark:border-slate-800/60 shadow-sm">

      {/* ── Action Bar ───────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4 px-5 py-3.5 border-b border-slate-100 dark:border-slate-800/70">
        {/* Left: title + count */}
        <div className="flex items-center gap-3 min-w-0">
          <button className="flex items-center gap-1.5 group min-w-0">
            <h2 className="text-[15px] font-semibold text-slate-900 dark:text-slate-50 truncate leading-none">
              {title}
            </h2>
            <span className="text-slate-400 dark:text-slate-500 group-hover:text-slate-600 dark:group-hover:text-slate-300 transition-colors flex-shrink-0">
              <IconChevronDown />
            </span>
          </button>
          <span className="hidden sm:inline text-xs text-slate-400 dark:text-slate-500 font-medium whitespace-nowrap">
            {filtered.length} Submissions
            {newCount > 0 && (
              <>, <span className="text-blue-500 dark:text-blue-400">{newCount} New</span></>
            )}
          </span>
        </div>

        {/* Right: search + actions */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {/* Search */}
          <div className="relative hidden md:flex items-center">
            <span className="absolute left-3 text-slate-400 dark:text-slate-500 pointer-events-none">
              <IconSearch />
            </span>
            <input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search…"
              className="pl-9 pr-4 py-1.5 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 dark:focus:border-blue-400 transition-all w-44"
            />
          </div>

          <button className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors">
            <IconShare />
            <span className="hidden sm:inline">Share</span>
          </button>

          <button className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors">
            <IconClock />
            <span className="hidden sm:inline">History</span>
          </button>

          <button
            onClick={toggle}
            className="p-1.5 rounded-lg text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title={dark ? "Light mode" : "Dark mode"}
          >
            {dark ? <IconSun /> : <IconMoon />}
          </button>
        </div>
      </div>

      {/* ── Toolbar ──────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-2 px-5 py-2 border-b border-slate-100 dark:border-slate-800/70 bg-slate-50/60 dark:bg-slate-900/40">
        {/* Left tools */}
        <div className="flex items-center gap-0.5 flex-wrap">
          {TOOLBAR_BTNS.map(({ label, Icon }) => (
            <button
              key={label}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-md transition-colors whitespace-nowrap"
            >
              <Icon />
              <span className="hidden sm:inline">{label}</span>
            </button>
          ))}
        </div>

        {/* Right actions */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {selected.size > 0 && (
            <span className="text-xs text-slate-400 dark:text-slate-500 mr-2 whitespace-nowrap">
              {selected.size} selected
            </span>
          )}
          <button className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-md transition-colors">
            <IconTrash />
            <span className="hidden sm:inline">Delete</span>
          </button>
          <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white rounded-md transition-colors shadow-sm shadow-blue-500/20">
            <IconEdit />
            <span className="hidden sm:inline">Edit</span>
          </button>
        </div>
      </div>

      {/* ── Table ─────────────────────────────────────────────────────────── */}
      <div className="overflow-x-auto scrollbar-none flex-1">
        <table className="w-full min-w-[960px] text-sm">
          <thead>
            <tr className="border-b border-slate-100 dark:border-slate-800">
              {/* Select-all checkbox */}
              <th className="w-10 px-3 py-3 text-left">
                <CheckCell checked={allSelected} onClick={toggleAll} />
              </th>
              {(
                ["Labels", "Submission Date", "What's your age?", "When you think about our service…", "Device", "Satisfaction", "NPS", "Assignees", "Progress"] as const
              ).map((h) => (
                <th
                  key={h}
                  className="px-4 py-3 text-left text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider whitespace-nowrap"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
            {pageRows.length === 0 ? (
              <tr>
                <td colSpan={10} className="text-center py-16 text-slate-400 dark:text-slate-500 text-sm">
                  No submissions match your search.
                </td>
              </tr>
            ) : (
              pageRows.map((row) => {
                const isSel = selected.has(row.id);
                return (
                  <tr
                    key={row.id}
                    onClick={() => toggleRow(row.id)}
                    className={`group cursor-pointer transition-colors ${
                      isSel
                        ? "bg-blue-50/70 dark:bg-blue-500/[0.06]"
                        : "hover:bg-slate-50 dark:hover:bg-slate-800/40"
                    }`}
                  >
                    {/* Checkbox */}
                    <td className="px-3 py-3.5 w-10">
                      <div
                        className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${
                          isSel
                            ? "bg-blue-600 border-blue-600 dark:bg-blue-500 dark:border-blue-500"
                            : "border-transparent group-hover:border-slate-300 dark:group-hover:border-slate-600"
                        }`}
                      >
                        {isSel && <span className="text-white"><IconCheck /></span>}
                      </div>
                    </td>

                    {/* Label */}
                    <td className="px-4 py-3.5" onClick={(e) => e.stopPropagation()}>
                      <LabelBadge label={row.label} />
                    </td>

                    {/* Date */}
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <span className="text-xs text-slate-500 dark:text-slate-400">{fmtDate(row.submittedAt)}</span>
                    </td>

                    {/* Age */}
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <span className="text-xs font-medium text-slate-700 dark:text-slate-300">{row.ageRange}</span>
                    </td>

                    {/* Experience note (truncated + hover tooltip) */}
                    <td className="px-4 py-3.5">
                      <div className="relative group/note max-w-[200px]">
                        <p className="text-xs text-slate-500 dark:text-slate-400 truncate leading-relaxed">
                          {row.experienceNote}
                        </p>
                        <div className="pointer-events-none absolute left-0 top-full mt-1.5 hidden group-hover/note:block z-50 w-72">
                          <div className="bg-slate-900 dark:bg-slate-800 text-slate-100 text-xs px-3.5 py-2.5 rounded-xl shadow-2xl leading-relaxed border border-slate-700/50">
                            {row.experienceNote}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Device */}
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <span className="text-xs text-slate-600 dark:text-slate-400 font-medium">{row.deviceCategory}</span>
                    </td>

                    {/* Satisfaction */}
                    <td className="px-4 py-3.5">
                      <StarRating value={row.satisfaction} />
                    </td>

                    {/* NPS */}
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md tabular-nums ${npsClass(row.npsScore)}`}>
                        {row.npsScore}/10
                      </span>
                    </td>

                    {/* Assignees */}
                    <td className="px-4 py-3.5" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center -space-x-2">
                        {row.assignees.map((a) => (
                          <AssigneeBadge key={a.initials + row.id} a={a} />
                        ))}
                      </div>
                    </td>

                    {/* Progress */}
                    <td className="px-4 py-3.5">
                      <ProgressDots value={row.progress} />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* ── Pagination Footer ─────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100 dark:border-slate-800/70 bg-white dark:bg-slate-950">
        <span className="text-xs text-slate-400 dark:text-slate-500">
          {filtered.length} total
          {selected.size > 0 && (
            <> · <span className="text-blue-500">{selected.size} selected</span></>
          )}
        </span>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={curPage === 1}
            className="p-1.5 rounded-md text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <IconChevLeft />
          </button>
          <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 tabular-nums px-1">
            {curPage} of {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={curPage === totalPages}
            className="p-1.5 rounded-md text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <IconChevRight />
          </button>
        </div>
      </div>

    </div>
  );
}
