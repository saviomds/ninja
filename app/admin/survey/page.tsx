"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import SurveyDataTable, { type SurveyRow, type LabelType, type SurveyAssignee } from "@/components/SurveyDataTable";

/* ── Supabase row shape ─────────────────────────────────────────────────────── */

interface DbRow {
  id: string;
  submission_ref: string;
  submitted_at: string;
  customer_name: string | null;
  age_range: string | null;
  device_category: string | null;
  satisfaction: number | null;
  nps_score: number | null;
  avg_repair_time: string | null;
  would_recommend: boolean | null;
  experience_note: string | null;
  label: string;
  assignee_initials: string[] | null;
  progress: number;
}

/* ── Assignee colour map (matches SQL seed) ─────────────────────────────────── */

const ASSIGNEE_COLOURS: Record<string, string> = {
  D: "bg-blue-500",
  H: "bg-emerald-500",
  C: "bg-purple-500",
  W: "bg-orange-500",
  N: "bg-pink-500",
};

const ASSIGNEE_NAMES: Record<string, string> = {
  D: "David K.",
  H: "Hannah M.",
  C: "Chris P.",
  W: "Wayne S.",
  N: "Nina T.",
};

function dbToRow(r: DbRow): SurveyRow {
  const assignees: SurveyAssignee[] = (r.assignee_initials ?? []).map((i) => ({
    initials: i,
    bg: ASSIGNEE_COLOURS[i] ?? "bg-slate-500",
    name: ASSIGNEE_NAMES[i] ?? i,
  }));

  return {
    id: r.id,
    submissionRef: r.submission_ref,
    submittedAt: r.submitted_at,
    customerName: r.customer_name ?? "Anonymous",
    ageRange: r.age_range ?? "—",
    deviceCategory: r.device_category ?? "—",
    satisfaction: r.satisfaction ?? 0,
    npsScore: r.nps_score ?? 0,
    wouldRecommend: r.would_recommend ?? false,
    avgRepairTime: r.avg_repair_time ?? "—",
    experienceNote: r.experience_note ?? "",
    label: (r.label as LabelType) ?? "new",
    assignees,
    progress: r.progress ?? 0,
  };
}

/* ── Page ───────────────────────────────────────────────────────────────────── */

export default function AdminSurveyPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [rows, setRows]         = useState<SurveyRow[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);

  /* Admin auth guard */
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const user = data?.user;
      if (!user) { router.replace("/login"); return; }
      const role = user.user_metadata?.role || user.app_metadata?.role;
      if (role !== "admin") { router.replace("/"); return; }
      setChecking(false);
      fetchSubmissions();
    });
  }, [router]);

  const fetchSubmissions = async () => {
    setLoading(true);
    setError(null);
    const { data, error: err } = await supabase
      .from("survey_submissions")
      .select(
        "id, submission_ref, submitted_at, customer_name, age_range, device_category, satisfaction, nps_score, avg_repair_time, would_recommend, experience_note, label, assignee_initials, progress"
      )
      .order("submitted_at", { ascending: false });

    if (err) {
      setError(err.message);
    } else if (data && data.length > 0) {
      setRows((data as DbRow[]).map(dbToRow));
    }
    setLoading(false);
  };

  /* Loading screen (auth check) */
  if (checking) {
    return (
      <div className="min-h-screen bg-[#030712] flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#030712] text-slate-900 dark:text-gray-100 transition-colors duration-200">
      <div className="max-w-screen-xl mx-auto px-4 sm:px-6 py-8">

        {/* ── Page Header ──────────────────────────────────────────────── */}
        <div className="flex items-start justify-between mb-6 gap-4">
          <div>
            <Link
              href="/admin"
              className="inline-flex items-center gap-1 text-xs font-semibold text-cyan-500 hover:text-cyan-400 transition-colors mb-2"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
              Admin Panel
            </Link>
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                Survey Submissions
              </h1>
              <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-cyan-400 border border-cyan-500/25 bg-cyan-500/8 px-2.5 py-1 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                Live
              </span>
            </div>
            <p className="text-slate-500 dark:text-gray-500 text-sm mt-1">
              Customer feedback and survey response tracker
            </p>
          </div>

          <button
            onClick={fetchSubmissions}
            className="flex-shrink-0 flex items-center gap-2 px-4 py-2 rounded-xl bg-white dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.08] text-sm text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white hover:border-slate-300 dark:hover:border-white/20 transition-all"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>
        </div>

        {/* ── Error banner ──────────────────────────────────────────────── */}
        {error && (
          <div className="mb-5 flex items-start gap-3 px-4 py-3 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 text-amber-700 dark:text-amber-300 text-sm">
            <svg className="w-5 h-5 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
            <div>
              <p className="font-semibold">Could not load submissions from database</p>
              <p className="text-xs mt-0.5 opacity-80">{error} — showing built-in demo data below.</p>
            </div>
          </div>
        )}

        {/* ── Loading shimmer ───────────────────────────────────────────── */}
        {loading ? (
          <div className="bg-white dark:bg-slate-950 rounded-2xl border border-slate-200/70 dark:border-slate-800/60 overflow-hidden shadow-sm">
            {/* Fake action bar */}
            <div className="h-[56px] border-b border-slate-100 dark:border-slate-800/70 px-5 flex items-center gap-3">
              <div className="h-4 w-48 rounded-full bg-slate-200 dark:bg-slate-800 shimmer" />
              <div className="h-3 w-28 rounded-full bg-slate-100 dark:bg-slate-800/60 shimmer" />
            </div>
            <div className="h-[40px] border-b border-slate-100 dark:border-slate-800/70 bg-slate-50/60 dark:bg-slate-900/40" />
            {/* Fake rows */}
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="flex items-center gap-4 px-5 py-4 border-b border-slate-50 dark:border-slate-800/50"
                style={{ animationDelay: `${i * 60}ms` }}
              >
                <div className="w-4 h-4 rounded bg-slate-100 dark:bg-slate-800 shimmer" />
                <div className="h-5 w-20 rounded-full bg-slate-100 dark:bg-slate-800 shimmer" />
                <div className="h-3 w-24 rounded bg-slate-100 dark:bg-slate-800 shimmer" />
                <div className="h-3 w-12 rounded bg-slate-100 dark:bg-slate-800 shimmer" />
                <div className="h-3 flex-1 max-w-[180px] rounded bg-slate-100 dark:bg-slate-800 shimmer" />
                <div className="h-3 w-20 rounded bg-slate-100 dark:bg-slate-800 shimmer ml-auto" />
              </div>
            ))}
          </div>
        ) : (
          /* ── Data Table ────────────────────────────────────────────────── */
          <SurveyDataTable
            title="Customer Survey 18.2"
            rows={rows.length > 0 ? rows : undefined}
          />
        )}

      </div>
    </div>
  );
}
