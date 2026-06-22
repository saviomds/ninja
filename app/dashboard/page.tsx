"use client";
import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { User, RealtimeChannel } from "@supabase/supabase-js";
import Image from "next/image";
import Link from "next/link";
import UpdateUsername from "./UpdateUsername";
import * as XLSX from "xlsx";
import { useTheme } from "@/components/ThemeProvider";

// ─── Types ───────────────────────────────────────────────────────────────────

interface Product {
  id: string;
  name: string;
  description: string;
  image: string;
  price: number;
  stock: number;
  category?: string;
  created_at?: string;
  is_public?: boolean;
  sku?: string;
  cost_price?: number;
  low_stock_threshold?: number;
  tags?: string;
}

interface Profile {
  id: string;
  username: string | null;
  avatar_url: string | null;
  full_name: string | null;
}

interface SocialProfile {
  id: string;
  platform_name: string;
  platform_icon: string;
  profile_link: string;
  username: string;
  email: string;
  password?: string;
  description?: string;
  is_active?: boolean;
  followers?: number;
}

interface AppUpdate {
  id: string;
  info: string;
  content: string;
  link: string;
  created_at?: string;
  priority?: "low" | "medium" | "high";
  type?: "feature" | "fix" | "announcement";
}

interface ActivityLog {
  id: string;
  action: string;
  target: string;
  timestamp: Date;
  type: "create" | "update" | "delete" | "info";
}

interface ServiceRow {
  id: string;
  description: string;
  qty: string;
  unit: string;
}

interface PartRow {
  id: string;
  description: string;
  partNo: string;
  qty: string;
  unit: string;
}

interface LabourRow {
  id: string;
  description: string;
  hours: string;
  rate: string;
}

interface InvoiceData {
  id?: string;
  version?: number;
  invoiceNo: string;
  date: string;
  due: string;
  customerTitle: string;
  customerName: string;
  address: string;
  tel: string;
  email: string;
  device: string;
  serial: string;
  tech: string;
  wo: string;
  done: string;
  services: ServiceRow[];
  parts: PartRow[];
  labour: LabourRow[];
  terms: string;
  juice: string;
  cash: string;
  themeColor?: string;
  notes?: string;
  discount?: string;
}

interface ClientOrder {
  id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  price: number;
  client_name: string;
  client_email: string;
  client_phone?: string;
  notes?: string;
  status: "pending" | "confirmed" | "completed" | "cancelled";
  created_at: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const ITEMS_PER_PAGE = 6;

const priorityColors: Record<string, string> = {
  high: "text-rose-400 bg-rose-500/10 border-rose-500/30",
  medium: "text-amber-400 bg-amber-500/10 border-amber-500/30",
  low: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30",
};

const updateTypeIcons: Record<string, string> = {
  feature: "✨",
  fix: "🔧",
  announcement: "📣",
};

const logTypeColors: Record<string, string> = {
  create: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
  update: "text-indigo-400 bg-indigo-500/10 border-indigo-500/20",
  delete: "text-rose-400 bg-rose-500/10 border-rose-500/20",
  info: "text-gray-400 bg-gray-500/10 border-gray-500/20",
};

// ─── Excel helpers ────────────────────────────────────────────────────────────

/** Build a styled cell object for SheetJS */
function sc(
  v: string | number,
  {
    bold = false,
    color = "000000",
    bgColor = "FFFFFF",
    fontSize = 11,
    italic = false,
    hAlign = "center" as "center" | "left" | "right",
    wrapText = false,
    numFmt = "",
    border = false,
    thick = false,
  } = {}
) {
  const borderStyle = thick
    ? { style: "medium", color: { rgb: "94A3B8" } }
    : { style: "thin", color: { rgb: "CBD5E1" } };
  return {
    v,
    t: typeof v === "number" ? "n" : "s",
    s: {
      font: { name: "Arial", bold, color: { rgb: color }, sz: fontSize, italic },
      fill: { patternType: "solid", fgColor: { rgb: bgColor } },
      alignment: { horizontal: hAlign, vertical: "center", wrapText },
      numFmt,
      ...(border && {
        border: {
          top: borderStyle,
          bottom: borderStyle,
          left: borderStyle,
          right: borderStyle,
        },
      }),
    },
  };
}

function getStockStatus(stock: number): { label: string; bg: string; fg: string } {
  if (stock === 0) return { label: "Out of Stock", bg: "FEE2E2", fg: "991B1B" };
  if (stock <= 5)  return { label: "Low Stock",    bg: "FEF9C3", fg: "854D0E" };
  return                  { label: "In Stock",     bg: "DCFCE7", fg: "166534" };
}

/** Set column widths on a worksheet */
function setCols(ws: XLSX.WorkSheet, widths: number[]) {
  ws["!cols"] = widths.map((w) => ({ wch: w }));
}

/** Helper to encode a cell address */
const addr = (r: number, c: number) => XLSX.utils.encode_cell({ r, c });

/** Write a cell directly into the worksheet */
function writeCell(ws: XLSX.WorkSheet, r: number, c: number, cell: object) {
  ws[addr(r, c)] = cell;
}

/** Merge cells in a worksheet */
function merge(ws: XLSX.WorkSheet, r1: number, c1: number, r2: number, c2: number) {
  if (!ws["!merges"]) ws["!merges"] = [];
  ws["!merges"].push({ s: { r: r1, c: c1 }, e: { r: r2, c: c2 } });
}

const extractFileName = (url: string) => {
  try {
    const urlObj = new URL(url);
    const parts = urlObj.pathname.split('/product-images/');
    return parts.length > 1 ? parts[1] : null;
  } catch {
    return url.split('/').pop() ?? null;
  }
};

// ─── Invoice Helpers & Components ─────────────────────────────────────────────

const uid = () => Math.random().toString(36).slice(2, 9);

const emptyService = (): ServiceRow => ({ id: uid(), description: "", qty: "", unit: "" });
const emptyPart = (): PartRow => ({ id: uid(), description: "", partNo: "", qty: "", unit: "" });
const emptyLabour = (): LabourRow => ({ id: uid(), description: "", hours: "", rate: "" });

const defaultInvoiceData = (): InvoiceData => ({
  version: 1,
  invoiceNo: "",
  date: new Date().toISOString().slice(0, 10),
  due: "",
  customerTitle: "Mr",
  customerName: "",
  address: "",
  tel: "",
  email: "",
  device: "",
  serial: "",
  tech: "",
  wo: "",
  done: "",
  services: [emptyService(), emptyService(), emptyService(), emptyService()],
  parts: [emptyPart(), emptyPart(), emptyPart(), emptyPart()],
  labour: [emptyLabour(), emptyLabour(), emptyLabour(), emptyLabour()],
  terms: "",
  juice: "",
  cash: "",
  themeColor: "#0a0a0a",
  notes: "",
  discount: "",
});

const fmt = (v: string) => {
  const n = parseFloat(v);
  return isNaN(n) ? "" : `Rs ${n.toLocaleString("en-MU", { minimumFractionDigits: 2 })}`;
};

const calcTotal = (qty: string, unit: string) => {
  const q = parseFloat(qty);
  const u = parseFloat(unit);
  if (isNaN(q) || isNaN(u)) return "";
  return (q * u).toFixed(2);
};

const calcLabourTotal = (hours: string, rate: string) => {
  const h = parseFloat(hours);
  const r = parseFloat(rate);
  if (isNaN(h) || isNaN(r)) return "";
  return (h * r).toFixed(2);
};

const sumRows = (rows: { qty: string; unit: string }[]) =>
  rows.reduce((acc, r) => {
    const t = parseFloat(calcTotal(r.qty, r.unit));
    return acc + (isNaN(t) ? 0 : t);
  }, 0);

const sumLabour = (rows: LabourRow[]) =>
  rows.reduce((acc, r) => {
    const t = parseFloat(calcLabourTotal(r.hours, r.rate));
    return acc + (isNaN(t) ? 0 : t);
  }, 0);

const InputField = ({
  label,
  value,
  onChange,
  type = "text",
  placeholder = "",
  className = "",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  className?: string;
}) => (
  <div className={`flex flex-col gap-1.5 ${className}`}>
    <label className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-widest">{label}</label>
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="bg-white dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 rounded-xl px-3.5 py-2.5 text-sm text-gray-900 dark:text-white placeholder-gray-300 dark:placeholder-gray-600 focus:outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/15 transition-all shadow-sm hover:border-gray-300 dark:hover:border-gray-600"
    />
  </div>
);

function InvoicePreview({ data }: { data: InvoiceData }) {
  const partsSubtotal = sumRows(data.parts);
  const labourSubtotal = sumLabour(data.labour);
  const servicesSubtotal = sumRows(data.services);
  const subtotal = partsSubtotal + labourSubtotal + servicesSubtotal;
  const discountAmount = parseFloat(data.discount || '0');
  const subtotalAfterDiscount = subtotal - discountAmount;
  const vat = subtotalAfterDiscount * 0.15;
  const total = subtotalAfterDiscount + vat;

  const totalsRows: (string | number | boolean)[][] = [
    ['Services Subtotal', servicesSubtotal, false],
    ['Parts Subtotal', partsSubtotal, false],
    ['Labour Subtotal', labourSubtotal, false],
    ['Subtotal', subtotal, true],
  ];
  if (discountAmount > 0) {
    totalsRows.push(['Discount', -discountAmount, false]);
    totalsRows.push(['Subtotal after Discount', subtotalAfterDiscount, true]);
  }
  totalsRows.push(['VAT (15%)', vat, false]);
  const Cell = ({ children, className = "" }: { children?: React.ReactNode; className?: string }) => (
    <td className={`border border-gray-600 px-2 py-1.5 text-xs ${className}`}>{children}</td>
  );

  const Th = ({ children, className = "" }: { children?: React.ReactNode; className?: string }) => (
    <th className={`border border-gray-600 px-2 py-1.5 text-xs font-semibold text-center bg-gray-900 text-white ${className}`}>{children}</th>
  );

  return (
    <div
      id="invoice-preview"
      className="bg-white text-black font-sans relative"
      style={{ fontFamily: "'Arial', sans-serif", fontSize: "11px", minWidth: "700px" }}
    >
      {/* Background Watermark */}
      <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", opacity: 0.03, pointerEvents: "none", zIndex: 0 }}>
        <Image
          src="/logo.png"
          alt="Watermark"
          width={550}
          height={550}
          unoptimized
          style={{ objectFit: "contain", filter: "brightness(0)" }}
        />
      </div>

      {/* Header */}
      <div style={{ padding: "32px 24px 24px", display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: `4px solid ${data.themeColor || "#0a0a0a"}` }}>
        <div>
          {/* Logo & Company Info */}
          <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "18px" }}>
            <div style={{ backgroundColor: data.themeColor || "#0a0a0a", padding: "12px", borderRadius: "14px", boxShadow: "0 4px 10px rgba(0,0,0,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Image
                src="/logo.png"
                alt="TechNinja Logo"
                width={56}
                height={56}
                unoptimized
                style={{ objectFit: "contain" }}
              />
            </div>
            <div>
              <div style={{ fontSize: "28px", fontWeight: "900", color: data.themeColor || "#0a0a0a", letterSpacing: "-0.5px", lineHeight: "1.1" }}>TechNinja</div>
              <div style={{ fontSize: "10px", fontWeight: "800", color: "#64748b", textTransform: "uppercase", letterSpacing: "1.5px", marginTop: "2px" }}>Premium Tech Services</div>
            </div>
          </div>
          <div style={{ color: "#475569", fontSize: "10px", lineHeight: "1.6" }}>
            <div style={{ fontWeight: "800", color: "#1e293b", fontSize: "11px", marginBottom: "4px" }}>Coromandel, Mauritius</div>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}><span style={{ color: data.themeColor || "#0a0a0a" }}>📞</span> +230 5809 8080</div>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}><span style={{ color: data.themeColor || "#0a0a0a" }}>✉️</span> info@techninja.mu</div>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}><span style={{ color: data.themeColor || "#0a0a0a" }}>🌐</span> www.techninja.mu</div>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}><span style={{ color: data.themeColor || "#0a0a0a" }}>📸</span> @techninja.mu</div>
            <div style={{ display: "inline-flex", alignItems: "center", gap: "6px", marginTop: "6px", fontWeight: "700", color: "#1e293b", background: "#f1f5f9", padding: "4px 8px", borderRadius: "6px", border: "1px solid #e2e8f0" }}>
              <span style={{ color: data.themeColor || "#0a0a0a" }}>🏢</span> BRN: MU-2020-00123
            </div>
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ color: data.themeColor || "#0a0a0a", fontWeight: "900", fontSize: "36px", letterSpacing: "4px", textTransform: "uppercase", marginBottom: "16px" }}>INVOICE</div>
          <div style={{ display: "flex", flexDirection: "column", gap: "6px", alignItems: "flex-end" }}>
            {[
              ["Invoice No", data.invoiceNo || "—"],
              ["Date", data.date ? new Date(data.date).toLocaleDateString("en-MU") : "—"],
              ["Due Date", data.due ? new Date(data.due).toLocaleDateString("en-MU") : "—"],
            ].map(([label, val]) => (
              <div key={label as string} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "24px", background: "#f8fafc", padding: "6px 12px", borderRadius: "6px", minWidth: "220px", border: "1px solid #e2e8f0", borderLeft: `4px solid ${data.themeColor || "#0a0a0a"}` }}>
                <span style={{ color: "#64748b", fontSize: "10px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.5px" }}>{label}</span>
                <span style={{ color: "#0f172a", fontSize: "11px", fontWeight: "800" }}>{val}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ padding: "16px 24px" }}>
        {/* Bill To + Service Details */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "20px" }}>
          {/* Bill To */}
          <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "8px", padding: "12px 16px", borderTop: `3px solid ${data.themeColor || "#0a0a0a"}` }}>
            <div style={{ color: data.themeColor || "#0a0a0a", fontWeight: "800", fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "8px" }}>BILL TO</div>
            <div style={{ fontWeight: "700", fontSize: "12px", color: "#1e293b", marginBottom: "4px" }}>{data.customerTitle} {data.customerName || "—"}</div>
            <div style={{ color: "#475569", marginBottom: "8px", lineHeight: "1.4" }}>{data.address || "—"}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: "4px", color: "#475569" }}>
              <span style={{ display: "flex", gap: "6px" }}><strong style={{ color: "#1e293b" }}>Tel:</strong> {data.tel || "—"}</span>
              <span style={{ display: "flex", gap: "6px" }}><strong style={{ color: "#1e293b" }}>Email:</strong> {data.email || "—"}</span>
            </div>
          </div>
          {/* Service Details */}
          <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "8px", padding: "12px 16px", borderTop: `3px solid ${data.themeColor || "#0a0a0a"}` }}>
            <div style={{ color: data.themeColor || "#0a0a0a", fontWeight: "800", fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "8px" }}>SERVICE DETAILS</div>
            <div style={{ fontWeight: "700", fontSize: "12px", color: "#1e293b", marginBottom: "4px" }}>{data.device || "—"}</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", color: "#475569", marginTop: "8px", lineHeight: "1.4" }}>
              <span style={{ display: "flex", flexDirection: "column" }}><strong style={{ color: "#1e293b", fontSize: "9px", textTransform: "uppercase" }}>Serial</strong> {data.serial || "—"}</span>
              <span style={{ display: "flex", flexDirection: "column" }}><strong style={{ color: "#1e293b", fontSize: "9px", textTransform: "uppercase" }}>Tech</strong> {data.tech || "—"}</span>
              <span style={{ display: "flex", flexDirection: "column" }}><strong style={{ color: "#1e293b", fontSize: "9px", textTransform: "uppercase" }}>Work Order</strong> {data.wo || "—"}</span>
              <span style={{ display: "flex", flexDirection: "column" }}><strong style={{ color: "#1e293b", fontSize: "9px", textTransform: "uppercase" }}>Done</strong> {data.done || "—"}</span>
            </div>
          </div>
        </div>

        {/* Services Performed */}
        <div style={{ marginBottom: "14px" }}>
          <div style={{ background: data.themeColor || "#0a0a0a", color: "#fff", padding: "6px 12px", fontSize: "10px", fontWeight: "800", letterSpacing: "0.5px", textTransform: "uppercase" }}>SERVICES PERFORMED</div>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#f8fafc" }}>
                {["#", "Description", "Qty", "Unit (Rs)", "Total (Rs)"].map((h) => (
                  <th key={h} style={{ border: "1px solid #e2e8f0", padding: "6px 8px", color: data.themeColor || "#0a0a0a", fontWeight: "700", textAlign: "center", fontSize: "9px", textTransform: "uppercase", letterSpacing: "0.5px" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.services.map((s, i) => (
                <tr key={s.id} style={{ background: i % 2 === 0 ? "#fff" : "#f8fafc" }}>
                  <td style={{ border: "1px solid #e2e8f0", padding: "6px 8px", textAlign: "center", width: "30px", color: "#475569" }}>{i + 1}</td>
                  <td style={{ border: "1px solid #e2e8f0", padding: "6px 8px", color: "#1e293b", fontWeight: "500" }}>{s.description}</td>
                  <td style={{ border: "1px solid #e2e8f0", padding: "6px 8px", textAlign: "center", width: "60px", color: "#475569" }}>{s.qty}</td>
                  <td style={{ border: "1px solid #e2e8f0", padding: "6px 8px", textAlign: "center", width: "80px", color: "#475569" }}>{s.unit}</td>
                  <td style={{ border: "1px solid #e2e8f0", padding: "6px 8px", textAlign: "center", width: "90px", color: "#1e293b", fontWeight: "600" }}>
                    {calcTotal(s.qty, s.unit) ? `Rs ${parseFloat(calcTotal(s.qty, s.unit)).toLocaleString("en-MU", { minimumFractionDigits: 2 })}` : ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Parts Used */}
        <div style={{ marginBottom: "14px" }}>
          <div style={{ background: data.themeColor || "#0a0a0a", color: "#fff", padding: "6px 12px", fontSize: "10px", fontWeight: "800", letterSpacing: "0.5px", textTransform: "uppercase" }}>PARTS USED</div>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#f8fafc" }}>
                {["#", "Part Description", "Part No", "Qty", "Unit (Rs)", "Total (Rs)"].map((h) => (
                  <th key={h} style={{ border: "1px solid #e2e8f0", padding: "6px 8px", color: data.themeColor || "#0a0a0a", fontWeight: "700", textAlign: "center", fontSize: "9px", textTransform: "uppercase", letterSpacing: "0.5px" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.parts.map((p, i) => (
                <tr key={p.id} style={{ background: i % 2 === 0 ? "#fff" : "#f8fafc" }}>
                  <td style={{ border: "1px solid #e2e8f0", padding: "6px 8px", textAlign: "center", width: "30px", color: "#475569" }}>{i + 1}</td>
                  <td style={{ border: "1px solid #e2e8f0", padding: "6px 8px", color: "#1e293b", fontWeight: "500" }}>{p.description}</td>
                  <td style={{ border: "1px solid #e2e8f0", padding: "6px 8px", textAlign: "center", width: "70px", color: "#475569" }}>{p.partNo}</td>
                  <td style={{ border: "1px solid #e2e8f0", padding: "6px 8px", textAlign: "center", width: "50px", color: "#475569" }}>{p.qty}</td>
                  <td style={{ border: "1px solid #e2e8f0", padding: "6px 8px", textAlign: "center", width: "80px", color: "#475569" }}>{p.unit}</td>
                  <td style={{ border: "1px solid #e2e8f0", padding: "6px 8px", textAlign: "center", width: "90px", color: "#1e293b", fontWeight: "600" }}>
                    {calcTotal(p.qty, p.unit) ? `Rs ${parseFloat(calcTotal(p.qty, p.unit)).toLocaleString("en-MU", { minimumFractionDigits: 2 })}` : ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Labour Charges */}
        <div style={{ marginBottom: "14px" }}>
          <div style={{ background: data.themeColor || "#0a0a0a", color: "#fff", padding: "6px 12px", fontSize: "10px", fontWeight: "800", letterSpacing: "0.5px", textTransform: "uppercase" }}>LABOUR CHARGES</div>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#f8fafc" }}>
                {["#", "Description", "Hours", "Rate/Hr (Rs)", "Total (Rs)"].map((h) => (
                  <th key={h} style={{ border: "1px solid #e2e8f0", padding: "6px 8px", color: data.themeColor || "#0a0a0a", fontWeight: "700", textAlign: "center", fontSize: "9px", textTransform: "uppercase", letterSpacing: "0.5px" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.labour.map((l, i) => (
                <tr key={l.id} style={{ background: i % 2 === 0 ? "#fff" : "#f8fafc" }}>
                  <td style={{ border: "1px solid #e2e8f0", padding: "6px 8px", textAlign: "center", width: "30px", color: "#475569" }}>{i + 1}</td>
                  <td style={{ border: "1px solid #e2e8f0", padding: "6px 8px", color: "#1e293b", fontWeight: "500" }}>{l.description}</td>
                  <td style={{ border: "1px solid #e2e8f0", padding: "6px 8px", textAlign: "center", width: "60px", color: "#475569" }}>{l.hours}</td>
                  <td style={{ border: "1px solid #e2e8f0", padding: "6px 8px", textAlign: "center", width: "90px", color: "#475569" }}>{l.rate}</td>
                  <td style={{ border: "1px solid #e2e8f0", padding: "6px 8px", textAlign: "center", width: "90px", color: "#1e293b", fontWeight: "600" }}>
                    {calcLabourTotal(l.hours, l.rate) ? `Rs ${parseFloat(calcLabourTotal(l.hours, l.rate)).toLocaleString("en-MU", { minimumFractionDigits: 2 })}` : ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Bottom: Payment + Totals */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
          {/* Payment Terms */}
          <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "8px", padding: "12px 16px", borderTop: `3px solid ${data.themeColor || "#0a0a0a"}` }}>
            <div style={{ color: data.themeColor || "#0a0a0a", fontWeight: "800", fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "8px" }}>PAYMENT TERMS</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "6px", color: "#475569", lineHeight: "1.4" }}>
              <span style={{ display: "flex", justifyContent: "space-between" }}><strong style={{ color: "#1e293b" }}>Terms:</strong> <span>{data.terms || "—"}</span></span>
              <span style={{ display: "flex", justifyContent: "space-between" }}><strong style={{ color: "#1e293b" }}>Juice Payment:</strong> <span>{data.juice || "—"}</span></span>
              <span style={{ display: "flex", justifyContent: "space-between" }}><strong style={{ color: "#1e293b" }}>Cash:</strong> <span>{data.cash || "—"}</span></span>
            </div>
          </div>

          {/* Totals */}
          <div style={{ border: "1px solid #e2e8f0", borderRadius: "8px", overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <tbody>
                {totalsRows.map(([label, val, bold]) => (
                  <tr key={String(label)}>
                    <td style={{ padding: "8px 12px", fontSize: "11px", color: bold ? "#1e293b" : "#475569", fontWeight: bold ? "700" : "500", borderBottom: "1px solid #e2e8f0" }}>{String(label)}</td>
                    <td style={{ padding: "8px 12px", fontSize: "11px", color: (val as number) < 0 ? '#ef4444' : '#1e293b', fontWeight: bold ? "700" : "600", textAlign: "right", borderBottom: "1px solid #e2e8f0" }}>
                      Rs {(val as number).toLocaleString("en-MU", { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))}
                <tr style={{ background: data.themeColor || "#0a0a0a" }}>
                  <td style={{ padding: "10px 12px", color: "#fff", fontWeight: "900", fontSize: "12px" }}>TOTAL DUE</td>
                  <td style={{ padding: "10px 12px", color: "#FFD700", fontWeight: "900", fontSize: "14px", textAlign: "right" }}>
                    Rs {total.toLocaleString("en-MU", { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Notes / Remarks */}
        {data.notes && (
          <div style={{ marginTop: "16px", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "8px", padding: "12px 16px" }}>
            <div style={{ color: data.themeColor || "#0a0a0a", fontWeight: "800", fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "4px" }}>NOTES / REMARKS</div>
            <div style={{ color: "#475569", fontSize: "11px", lineHeight: "1.5", whiteSpace: "pre-wrap" }}>{data.notes}</div>
          </div>
        )}

        {/* Footer */}
        <div style={{ textAlign: "center", marginTop: "24px", paddingTop: "16px", borderTop: `2px solid ${data.themeColor || "#0a0a0a"}` }}>
          <div style={{ color: data.themeColor || "#0a0a0a", fontWeight: "800", fontSize: "13px", marginBottom: "8px" }}>Thank You for Choosing TechNinja!</div>
          <div style={{ display: "flex", justifyContent: "center", flexWrap: "wrap", gap: "16px", color: "#475569", fontSize: "10px", marginBottom: "12px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "4px" }}><span style={{ color: data.themeColor || "#0a0a0a" }}>📞</span> +230 5809 8080</div>
            <div style={{ display: "flex", alignItems: "center", gap: "4px" }}><span style={{ color: data.themeColor || "#0a0a0a" }}>✉️</span> info@techninja.mu</div>
            <div style={{ display: "flex", alignItems: "center", gap: "4px" }}><span style={{ color: data.themeColor || "#0a0a0a" }}>🌐</span> www.techninja.mu</div>
            <div style={{ display: "flex", alignItems: "center", gap: "4px" }}><span style={{ color: data.themeColor || "#0a0a0a" }}>📸</span> @techninja.mu</div>
          </div>
          <div style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontWeight: "700", color: "#1e293b", background: "#f1f5f9", padding: "6px 12px", borderRadius: "6px", border: "1px solid #e2e8f0", fontSize: "10px" }}>
            <span style={{ color: data.themeColor || "#0a0a0a" }}>🏢</span> TechNinja • Coromandel, Mauritius • BRN: MU-2020-00123
          </div>
        </div>
      </div>
    </div>
  );
}

function InvoiceFormModal({
  data,
  onChange,
  onClose,
  onExport,
  isExporting,
  onSave,
  isSaving,
}: {
  data: InvoiceData;
  onChange: (d: InvoiceData) => void;
  onClose: () => void;
  onExport: () => void;
  onSave: (d: InvoiceData) => void;
  isExporting: boolean;
  isSaving: boolean;
  activeEditors?: string[];
}) {
  const set = useCallback(
    (key: keyof InvoiceData, val: string) => onChange({ ...data, [key]: val }),
    [data, onChange]
  );

  const updateService = (i: number, key: keyof ServiceRow, val: string) => {
    const rows = [...data.services];
    rows[i] = { ...rows[i], [key]: val };
    onChange({ ...data, services: rows });
  };

  const updatePart = (i: number, key: keyof PartRow, val: string) => {
    const rows = [...data.parts];
    rows[i] = { ...rows[i], [key]: val };
    onChange({ ...data, parts: rows });
  };

  const updateLabour = (i: number, key: keyof LabourRow, val: string) => {
    const rows = [...data.labour];
    rows[i] = { ...rows[i], [key]: val };
    onChange({ ...data, labour: rows });
  };

  const addRow = (section: "services" | "parts" | "labour") => {
    if (section === "services") onChange({ ...data, services: [...data.services, emptyService()] });
    if (section === "parts") onChange({ ...data, parts: [...data.parts, emptyPart()] });
    if (section === "labour") onChange({ ...data, labour: [...data.labour, emptyLabour()] });
  };

  const removeRow = (section: "services" | "parts" | "labour", i: number) => {
    if (section === "services") onChange({ ...data, services: data.services.filter((_, idx) => idx !== i) });
    if (section === "parts") onChange({ ...data, parts: data.parts.filter((_, idx) => idx !== i) });
    if (section === "labour") onChange({ ...data, labour: data.labour.filter((_, idx) => idx !== i) });
  };

  const sectionHeader = (title: string, icon: string) => (
    <div className="flex items-center gap-3 pt-6 pb-3">
      <div className="w-7 h-7 rounded-lg bg-cyan-500/10 dark:bg-cyan-500/20 border border-cyan-500/20 flex items-center justify-center text-sm flex-shrink-0">{icon}</div>
      <span className="text-xs font-bold uppercase tracking-widest text-cyan-600 dark:text-cyan-400">{title}</span>
      <div className="h-px flex-1 bg-gray-100 dark:bg-gray-800" />
    </div>
  );

  const selectCls = "bg-white dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 rounded-xl px-3.5 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/15 transition-all shadow-sm hover:border-gray-300 dark:hover:border-gray-600 w-full";

  const tableInput = (value: string, onChange: (v: string) => void, type = "text", placeholder = "") => (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 rounded-lg px-2.5 py-1.5 text-xs text-gray-900 dark:text-white placeholder-gray-300 dark:placeholder-gray-600 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/20 transition-all"
    />
  );

  return (
    <div className="fixed inset-0 bg-black/60 z-[100] backdrop-blur-sm flex items-start justify-center overflow-y-auto p-4 py-8">
      <div className="bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden">

        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-white dark:bg-gray-900/80 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
              <svg className="w-4 h-4 text-cyan-500 dark:text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <h2 className="font-bold text-gray-900 dark:text-white text-base leading-tight">Invoice Details</h2>
              <p className="text-xs text-gray-400">Fill in all sections then export as PDF</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 transition-all">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6">
          {/* ── Invoice Info ─────────────────────────────────────────────── */}
          {sectionHeader("Invoice Info", "🧾")}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <InputField label="Invoice No" value={data.invoiceNo} onChange={(v) => set("invoiceNo", v)} placeholder="INV-001" />
            <InputField label="Date" value={data.date} onChange={(v) => set("date", v)} type="date" />
            <InputField label="Due Date" value={data.due} onChange={(v) => set("due", v)} type="date" />
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-widest">Theme Color</label>
              <select value={data.themeColor || "#0a0a0a"} onChange={(e) => set("themeColor", e.target.value)} className={selectCls}>
                <option value="#0a0a0a">Dark</option>
                <option value="#1f2937">Navy</option>
                <option value="#374151">Slate</option>
                <option value="#4b5563">Gray</option>
              </select>
            </div>
          </div>

          {/* ── Bill To ──────────────────────────────────────────────────── */}
          {sectionHeader("Bill To", "👤")}
          <div className="bg-white dark:bg-gray-900/50 rounded-2xl border border-gray-100 dark:border-gray-800 p-4 space-y-4">
            <div className="grid grid-cols-4 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-widest">Title</label>
                <select value={data.customerTitle} onChange={(e) => set("customerTitle", e.target.value)} className={selectCls}>
                  {["Mr", "Mrs", "Miss", "Dr", "Prof"].map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="col-span-3">
                <InputField label="Full Name" value={data.customerName} onChange={(v) => set("customerName", v)} placeholder="John Doe" />
              </div>
            </div>
            <InputField label="Address" value={data.address} onChange={(v) => set("address", v)} placeholder="123 Main Street, Port Louis" />
            <div className="grid grid-cols-2 gap-4">
              <InputField label="Tel" value={data.tel} onChange={(v) => set("tel", v)} placeholder="+230 5XXX XXXX" />
              <InputField label="Email" value={data.email} onChange={(v) => set("email", v)} type="email" placeholder="customer@email.com" />
            </div>
          </div>

          {/* ── Service Details ───────────────────────────────────────────── */}
          {sectionHeader("Service Details", "🔧")}
          <div className="bg-white dark:bg-gray-900/50 rounded-2xl border border-gray-100 dark:border-gray-800 p-4">
            <div className="grid grid-cols-2 gap-4">
              <InputField label="Device" value={data.device} onChange={(v) => set("device", v)} placeholder="iPhone 14 Pro" />
              <InputField label="Serial No" value={data.serial} onChange={(v) => set("serial", v)} placeholder="SN123456789" />
              <InputField label="Technician" value={data.tech} onChange={(v) => set("tech", v)} placeholder="Technician name" />
              <InputField label="Work Order (WO)" value={data.wo} onChange={(v) => set("wo", v)} placeholder="WO-2024-001" />
              <InputField label="Status / Done" value={data.done} onChange={(v) => set("done", v)} placeholder="Completion status" />
            </div>
          </div>

          {/* ── Services Performed ────────────────────────────────────────── */}
          {sectionHeader("Services Performed", "⚙️")}
          <div className="bg-white dark:bg-gray-900/50 rounded-2xl border border-gray-100 dark:border-gray-800 overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-800/80 border-b border-gray-100 dark:border-gray-700">
                  <th className="text-left px-3 py-2.5 text-gray-400 font-semibold w-7">#</th>
                  <th className="text-left px-3 py-2.5 text-gray-500 dark:text-gray-400 font-semibold">Description</th>
                  <th className="text-left px-3 py-2.5 text-gray-500 dark:text-gray-400 font-semibold w-16">Qty</th>
                  <th className="text-left px-3 py-2.5 text-gray-500 dark:text-gray-400 font-semibold w-24">Unit (Rs)</th>
                  <th className="text-left px-3 py-2.5 text-gray-500 dark:text-gray-400 font-semibold w-24">Total</th>
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody>
                {data.services.map((s, i) => (
                  <tr key={s.id} className={`border-t border-gray-100 dark:border-gray-800 ${i % 2 === 1 ? "bg-gray-50/60 dark:bg-gray-800/20" : ""}`}>
                    <td className="px-3 py-2 text-gray-400 text-center font-medium">{i + 1}</td>
                    <td className="px-2 py-2">{tableInput(s.description, (v) => updateService(i, "description", v), "text", "Service description")}</td>
                    <td className="px-2 py-2">{tableInput(s.qty, (v) => updateService(i, "qty", v), "number", "0")}</td>
                    <td className="px-2 py-2">{tableInput(s.unit, (v) => updateService(i, "unit", v), "number", "0.00")}</td>
                    <td className="px-3 py-2 text-emerald-600 dark:text-emerald-400 font-semibold whitespace-nowrap">
                      {calcTotal(s.qty, s.unit) ? `Rs ${parseFloat(calcTotal(s.qty, s.unit)).toLocaleString()}` : <span className="text-gray-300 dark:text-gray-700">—</span>}
                    </td>
                    <td className="px-2 py-2">
                      <button onClick={() => removeRow("services", i)} className="w-6 h-6 rounded-md flex items-center justify-center text-gray-300 dark:text-gray-700 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-all">×</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="px-3 py-2.5 border-t border-gray-100 dark:border-gray-800">
              <button onClick={() => addRow("services")} className="flex items-center gap-1.5 text-xs font-semibold text-cyan-600 dark:text-cyan-400 hover:text-cyan-700 dark:hover:text-cyan-300 transition-colors">
                <span className="w-5 h-5 rounded-full bg-cyan-500/10 flex items-center justify-center text-sm leading-none">+</span> Add Row
              </button>
            </div>
          </div>

          {/* ── Parts Used ────────────────────────────────────────────────── */}
          {sectionHeader("Parts Used", "🔩")}
          <div className="bg-white dark:bg-gray-900/50 rounded-2xl border border-gray-100 dark:border-gray-800 overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-800/80 border-b border-gray-100 dark:border-gray-700">
                  <th className="text-left px-3 py-2.5 text-gray-400 font-semibold w-7">#</th>
                  <th className="text-left px-3 py-2.5 text-gray-500 dark:text-gray-400 font-semibold">Description</th>
                  <th className="text-left px-3 py-2.5 text-gray-500 dark:text-gray-400 font-semibold w-24">Part No</th>
                  <th className="text-left px-3 py-2.5 text-gray-500 dark:text-gray-400 font-semibold w-16">Qty</th>
                  <th className="text-left px-3 py-2.5 text-gray-500 dark:text-gray-400 font-semibold w-24">Unit (Rs)</th>
                  <th className="text-left px-3 py-2.5 text-gray-500 dark:text-gray-400 font-semibold w-24">Total</th>
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody>
                {data.parts.map((p, i) => (
                  <tr key={p.id} className={`border-t border-gray-100 dark:border-gray-800 ${i % 2 === 1 ? "bg-gray-50/60 dark:bg-gray-800/20" : ""}`}>
                    <td className="px-3 py-2 text-gray-400 text-center font-medium">{i + 1}</td>
                    <td className="px-2 py-2">{tableInput(p.description, (v) => updatePart(i, "description", v), "text", "Part name")}</td>
                    <td className="px-2 py-2">{tableInput(p.partNo, (v) => updatePart(i, "partNo", v), "text", "PN-001")}</td>
                    <td className="px-2 py-2">{tableInput(p.qty, (v) => updatePart(i, "qty", v), "number", "0")}</td>
                    <td className="px-2 py-2">{tableInput(p.unit, (v) => updatePart(i, "unit", v), "number", "0.00")}</td>
                    <td className="px-3 py-2 text-emerald-600 dark:text-emerald-400 font-semibold whitespace-nowrap">
                      {calcTotal(p.qty, p.unit) ? `Rs ${parseFloat(calcTotal(p.qty, p.unit)).toLocaleString()}` : <span className="text-gray-300 dark:text-gray-700">—</span>}
                    </td>
                    <td className="px-2 py-2">
                      <button onClick={() => removeRow("parts", i)} className="w-6 h-6 rounded-md flex items-center justify-center text-gray-300 dark:text-gray-700 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-all">×</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="px-3 py-2.5 border-t border-gray-100 dark:border-gray-800">
              <button onClick={() => addRow("parts")} className="flex items-center gap-1.5 text-xs font-semibold text-cyan-600 dark:text-cyan-400 hover:text-cyan-700 dark:hover:text-cyan-300 transition-colors">
                <span className="w-5 h-5 rounded-full bg-cyan-500/10 flex items-center justify-center text-sm leading-none">+</span> Add Row
              </button>
            </div>
          </div>

          {/* ── Labour Charges ────────────────────────────────────────────── */}
          {sectionHeader("Labour Charges", "🧑‍🔧")}
          <div className="bg-white dark:bg-gray-900/50 rounded-2xl border border-gray-100 dark:border-gray-800 overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-800/80 border-b border-gray-100 dark:border-gray-700">
                  <th className="text-left px-3 py-2.5 text-gray-400 font-semibold w-7">#</th>
                  <th className="text-left px-3 py-2.5 text-gray-500 dark:text-gray-400 font-semibold">Description</th>
                  <th className="text-left px-3 py-2.5 text-gray-500 dark:text-gray-400 font-semibold w-20">Hours</th>
                  <th className="text-left px-3 py-2.5 text-gray-500 dark:text-gray-400 font-semibold w-28">Rate/Hr (Rs)</th>
                  <th className="text-left px-3 py-2.5 text-gray-500 dark:text-gray-400 font-semibold w-24">Total</th>
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody>
                {data.labour.map((l, i) => (
                  <tr key={l.id} className={`border-t border-gray-100 dark:border-gray-800 ${i % 2 === 1 ? "bg-gray-50/60 dark:bg-gray-800/20" : ""}`}>
                    <td className="px-3 py-2 text-gray-400 text-center font-medium">{i + 1}</td>
                    <td className="px-2 py-2">{tableInput(l.description, (v) => updateLabour(i, "description", v), "text", "Labour description")}</td>
                    <td className="px-2 py-2">{tableInput(l.hours, (v) => updateLabour(i, "hours", v), "number", "0")}</td>
                    <td className="px-2 py-2">{tableInput(l.rate, (v) => updateLabour(i, "rate", v), "number", "0.00")}</td>
                    <td className="px-3 py-2 text-emerald-600 dark:text-emerald-400 font-semibold whitespace-nowrap">
                      {calcLabourTotal(l.hours, l.rate) ? `Rs ${parseFloat(calcLabourTotal(l.hours, l.rate)).toLocaleString()}` : <span className="text-gray-300 dark:text-gray-700">—</span>}
                    </td>
                    <td className="px-2 py-2">
                      <button onClick={() => removeRow("labour", i)} className="w-6 h-6 rounded-md flex items-center justify-center text-gray-300 dark:text-gray-700 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-all">×</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="px-3 py-2.5 border-t border-gray-100 dark:border-gray-800">
              <button onClick={() => addRow("labour")} className="flex items-center gap-1.5 text-xs font-semibold text-cyan-600 dark:text-cyan-400 hover:text-cyan-700 dark:hover:text-cyan-300 transition-colors">
                <span className="w-5 h-5 rounded-full bg-cyan-500/10 flex items-center justify-center text-sm leading-none">+</span> Add Row
              </button>
            </div>
          </div>

          {/* ── Payment & Notes ────────────────────────────────────────────── */}
          {sectionHeader("Payment & Notes", "💳")}
          <div className="bg-white dark:bg-gray-900/50 rounded-2xl border border-gray-100 dark:border-gray-800 p-4 space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <InputField label="Discount (Rs)" value={data.discount || ''} onChange={(v) => set("discount", v)} type="number" placeholder="0.00" />
              <InputField label="Terms" value={data.terms} onChange={(v) => set("terms", v)} placeholder="Net 30" />
              <InputField label="Juice / Mobile Pay" value={data.juice} onChange={(v) => set("juice", v)} placeholder="Phone / Account" />
              <InputField label="Cash" value={data.cash} onChange={(v) => set("cash", v)} placeholder="Accepted" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-widest">Notes / Remarks</label>
              <textarea
                value={data.notes || ""}
                onChange={(e) => set("notes", e.target.value)}
                placeholder="Additional notes, payment instructions, warranty info, or a thank you message..."
                rows={3}
                className="w-full bg-white dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 rounded-xl px-3.5 py-2.5 text-sm text-gray-900 dark:text-white placeholder-gray-300 dark:placeholder-gray-600 focus:outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/15 transition-all shadow-sm resize-y"
              />
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-6 py-4 bg-white dark:bg-gray-900/80 border-t border-gray-100 dark:border-gray-800">
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 rounded-xl text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white text-sm border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 transition-all">
              Cancel
            </button>
            <button
              onClick={() => { if (window.confirm("Clear the entire form?")) onChange(defaultInvoiceData()); }}
              className="px-4 py-2 rounded-xl text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 border border-transparent hover:border-rose-200 dark:hover:border-rose-500/20 text-sm transition-all"
            >
              Clear
            </button>
          </div>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-white text-sm font-medium border border-gray-200 dark:border-gray-700 transition-all"
            >
              Preview
            </button>
            <button
              onClick={() => onSave(data)}
              disabled={isSaving}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold border border-indigo-700 transition-all disabled:opacity-50 flex items-center gap-1.5"
            >
              {isSaving && <svg className="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>}
              {isSaving ? "Saving…" : "Save"}
            </button>
            <button
              onClick={onExport}
              disabled={isExporting}
              className="flex items-center gap-2 px-5 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black text-sm font-bold transition-all disabled:opacity-50 shadow-sm"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              {isExporting ? "Generating…" : "Export PDF"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const router = useRouter();

  // Auth
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);

  // Data
  const [products, setProducts] = useState<Product[]>([]);
  const [socialProfiles, setSocialProfiles] = useState<SocialProfile[]>([]);
  const [updates, setUpdates] = useState<AppUpdate[]>([]);
  const [activityLog, setActivityLog] = useState<ActivityLog[]>([]);
  const [invoices, setInvoices] = useState<InvoiceData[]>([]);

  // UI state
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [activeSection, setActiveSection] = useState<"home" | "products" | "social" | "updates" | "settings" | "log" | "invoice" | "orders" | "tools">("home");
  const [repairStats, setRepairStats] = useState({ active: 0, urgent: 0, ready: 0, total: 0 });

  // Invoice state
  const [invoiceData, setInvoiceData] = useState<InvoiceData>(defaultInvoiceData());
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
  const [isExportingInvoice, setIsExportingInvoice] = useState(false);
  const [isSavingInvoice, setIsSavingInvoice] = useState(false);
  const [invoiceToDelete, setInvoiceToDelete] = useState<string | null>(null);
  const [activeEditors, setActiveEditors] = useState<string[]>([]);
  const [invoiceSearch,   setInvoiceSearch]   = useState("");
  const [invoiceSort,     setInvoiceSort]     = useState<"date_desc"|"date_asc"|"name"|"total_desc"|"total_asc"|"invno">("date_desc");
  const [invoiceDateFrom, setInvoiceDateFrom] = useState("");
  const [invoiceDateTo,   setInvoiceDateTo]   = useState("");
  const [invoiceStatusF,  setInvoiceStatusF]  = useState<"all"|"paid"|"draft">("all");

  // Orders
  const [orders, setOrders] = useState<ClientOrder[]>([]);
  const [unreadOrders, setUnreadOrders] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);
  const [orderToDelete, setOrderToDelete] = useState<string | null>(null);
  const [isDeletingOrder, setIsDeletingOrder] = useState(false);
  const [orderStatusFilter, setOrderStatusFilter] = useState<"all" | "pending" | "confirmed" | "completed" | "cancelled">("all");

  // Notifications
  const [notifPermission, setNotifPermission] = useState<NotificationPermission>("default");
  const [notifTab, setNotifTab] = useState<"orders" | "stock">("orders");
  const { dark, toggle: toggleTheme } = useTheme();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Site settings
  const [siteSettings, setSiteSettings] = useState({
    contact_address: "Port Louis, Mauritius",
    contact_phone:   "+230 5800 0000",
    contact_email:   "hello@techninja.mu",
    contact_hours:   "Mon–Sat: 9am – 7pm",
    brand_tagline:   "Premium electronics and smart gadgets for the modern lifestyle in Mauritius. Your tech, elevated.",
  });
  const [siteSettingsSaving, setSiteSettingsSaving] = useState(false);
  const [siteSettingsMsg, setSiteSettingsMsg] = useState<{ text: string; ok: boolean } | null>(null);

  const [viewMode, setViewMode] = useState<"card" | "excel">("card");
  // Products
  const productsRef = useRef<HTMLDivElement>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [productToDelete, setProductToDelete] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [expandedDesc, setExpandedDesc] = useState<Record<string, boolean>>({});
  const [sortBy, setSortBy] = useState<"newest" | "price_asc" | "price_desc" | "stock_asc" | "stock_desc">("newest");
  const [stockFilter, setStockFilter] = useState<"all" | "in_stock" | "low" | "out">("all");
  const [prevProductFilters, setPrevProductFilters] = useState({ searchQuery: "", sortBy: "newest", stockFilter: "all" });
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [showBulkConfirm, setShowBulkConfirm] = useState(false);
  const [adjustingStockId, setAdjustingStockId] = useState<string | null>(null);
  const [imageInputType, setImageInputType] = useState<"link" | "upload">("link");
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [newProduct, setNewProduct] = useState({
    name: "", image: "", description: "", price: "", stock: "", category: "", is_public: true,
    sku: "", cost_price: "", low_stock_threshold: "5", tags: "",
  });

  // Social
  const [isSocialModalOpen, setIsSocialModalOpen] = useState(false);
  const [isSavingSocial, setIsSavingSocial] = useState(false);
  const [editingSocialId, setEditingSocialId] = useState<string | null>(null);
  const [socialToDelete, setSocialToDelete] = useState<string | null>(null);
  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({});
  const [newSocial, setNewSocial] = useState({
    platform_name: "", platform_icon: "", profile_link: "",
    username: "", email: "", password: "", description: "", is_active: true, followers: "",
  });

  // Updates
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);
  const [isSavingUpdate, setIsSavingUpdate] = useState(false);
  const [editingUpdateId, setEditingUpdateId] = useState<string | null>(null);
  const [updateToDelete, setUpdateToDelete] = useState<string | null>(null);
  const [newUpdate, setNewUpdate] = useState({
    info: "", content: "", link: "",
    priority: "low" as "low" | "medium" | "high",
    type: "announcement" as "feature" | "fix" | "announcement",
  });

  // ─── Helpers ───────────────────────────────────────────────────────────────

  const logActivity = useCallback((action: string, target: string, type: ActivityLog["type"]) => {
    setActivityLog(prev => [{
      id: Math.random().toString(36).slice(2),
      action, target, type,
      timestamp: new Date(),
    }, ...prev].slice(0, 50));
  }, []);

  const showToast = useCallback((message: string, type: "success" | "error") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  }, []);

  // ─── Fetch helpers ─────────────────────────────────────────────────────────

  const fetchProducts = useCallback(async () => {
    const { data } = await supabase.from("products").select("*").order("created_at", { ascending: false });
    setProducts(data || []);
  }, []);

  const fetchSocialProfiles = useCallback(async () => {
    const { data } = await supabase.from("social_profiles").select("*").order("created_at", { ascending: false });
    setSocialProfiles(data || []);
  }, []);

  const fetchUpdates = useCallback(async () => {
    const { data } = await supabase.from("updates").select("*").order("created_at", { ascending: false });
    setUpdates(data || []);
  }, []);

  const fetchUserProfile = useCallback(async (uid: string) => {
    const { data, error } = await supabase.from("profiles").select("id, username, avatar_url, full_name").eq("id", uid).single();
    if (!error) setProfile(data);
  }, []);

  const fetchSiteSettings = useCallback(async () => {
    const { data } = await supabase.from("site_settings").select("key, value");
    if (data && data.length > 0) {
      const map = Object.fromEntries(data.map((r: { key: string; value: string }) => [r.key, r.value]));
      setSiteSettings(prev => ({ ...prev, ...map }));
    }
  }, []);

  const saveSiteSettings = async () => {
    setSiteSettingsSaving(true);
    setSiteSettingsMsg(null);
    const rows = Object.entries(siteSettings).map(([key, value]) => ({ key, value }));
    const { error } = await supabase.from("site_settings").upsert(rows, { onConflict: "key" });
    setSiteSettingsSaving(false);
    if (error) {
      setSiteSettingsMsg({ text: "Failed to save: " + error.message, ok: false });
    } else {
      setSiteSettingsMsg({ text: "Saved! Changes will appear on the site after the next page load.", ok: true });
      setTimeout(() => setSiteSettingsMsg(null), 4000);
    }
  };

  const fetchInvoices = useCallback(async () => {
    const { data } = await supabase.from("invoices").select("*").order("created_at", { ascending: false });
    if (data) {
      const mapped = data.map(inv => ({
        id: inv.id,
        version: inv.version || 1,
        invoiceNo: inv.invoice_no || "",
        date: inv.date || "",
        due: inv.due || "",
        customerTitle: inv.customer_title || "Mr",
        customerName: inv.customer_name || "",
        address: inv.address || "",
        tel: inv.tel || "",
        email: inv.email || "",
        device: inv.device || "",
        serial: inv.serial || "",
        tech: inv.tech || "",
        wo: inv.wo || "",
        done: inv.done || "",
        services: inv.services || [],
        parts: inv.parts || [],
        labour: inv.labour || [],
        terms: inv.terms || "",
        cash: inv.cash || "",
        juice: inv.juice || "",
        themeColor: inv.theme_color || "#0a0a0a",
        notes: inv.notes || "",
        discount: String(inv.discount ?? ''),
      }));
      setInvoices(mapped);
    }
  }, []);

  const fetchOrders = useCallback(async () => {
    const { data } = await supabase.from("orders").select("*").order("created_at", { ascending: false });
    setOrders((data as ClientOrder[]) || []);
  }, []);

  const fetchRepairStats = useCallback(async () => {
    const { data } = await supabase
      .from("repair_tickets")
      .select("status, priority")
      .not("status", "in", '("delivered","cancelled")');
    if (data) {
      setRepairStats({
        active: data.length,
        urgent: data.filter(t => t.priority === "urgent").length,
        ready: data.filter(t => t.status === "ready").length,
        total: data.length,
      });
    }
  }, []);

  const loadAllData = useCallback(async (showRefreshToast = false, uid?: string) => {
    const targetUid = uid || user?.id;
    if (!targetUid) return;
    showRefreshToast ? setIsRefreshing(true) : setLoading(true);
    await Promise.all([fetchProducts(), fetchSocialProfiles(), fetchUpdates(), fetchUserProfile(targetUid), fetchInvoices(), fetchOrders(), fetchRepairStats(), fetchSiteSettings()]);
    showRefreshToast ? setIsRefreshing(false) : setLoading(false);
    if (showRefreshToast) {
      showToast("Dashboard refreshed!", "success");
      logActivity("Refreshed dashboard data", "All sections", "info");
    }
  }, [user?.id, fetchProducts, fetchSocialProfiles, fetchUpdates, fetchUserProfile, fetchInvoices, fetchOrders, fetchRepairStats, fetchSiteSettings, showToast, logActivity]);

  // ─── Auth ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { router.push("/login"); return; }
      setUser(data.user);
      // Load data asynchronously directly after user resolution to bypass chained render delays
      loadAllData(false, data.user.id);
    });
  }, [router, loadAllData]);

  // ─── Realtime Presence for Invoices ────────────────────────────────────────
  if (!(isInvoiceModalOpen && invoiceData.id && user) && activeEditors.length > 0) {
    setActiveEditors([]);
  }

  useEffect(() => {
    let channel: RealtimeChannel | null = null;

    if (isInvoiceModalOpen && invoiceData.id && user) {
      // Subscribe to a unique channel for this specific invoice
      channel = supabase.channel(`invoice-${invoiceData.id}`, {
        config: { presence: { key: user.id } },
      });

      channel
        .on("presence", { event: "sync" }, () => {
          const state = channel!.presenceState();
          // Extract emails of other users currently in the channel
          const editors = Object.values(state)
            .flat()
            .map((p: any) => p.email)
            .filter((email: string) => email !== user.email);
            
          setActiveEditors(editors);
        })
        .subscribe(async (status) => {
          if (status === "SUBSCRIBED") {
            // Broadcast that we are viewing/editing
            await channel!.track({ email: user.email, status: "editing" });
          }
        });
    }

    return () => {
      if (channel) {
        channel.untrack();
        supabase.removeChannel(channel);
      }
    };
  }, [isInvoiceModalOpen, invoiceData.id, user]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "r" && !e.ctrlKey && !e.metaKey && !(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLTextAreaElement)) {
        loadAllData(true);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [loadAllData]);

  // ─── Realtime Orders ───────────────────────────────────────────────────────

  useEffect(() => {
    const channel = supabase
      .channel("orders-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "orders" },
        (payload) => {
          const newOrder = payload.new as ClientOrder;
          setOrders((prev) => [newOrder, ...prev]);
          setUnreadOrders((n) => n + 1);
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "orders" },
        (payload) => {
          setOrders((prev) =>
            prev.map((o) => (o.id === payload.new.id ? (payload.new as ClientOrder) : o))
          );
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  // ─── Products ──────────────────────────────────────────────────────────────

  if (searchQuery !== prevProductFilters.searchQuery || sortBy !== prevProductFilters.sortBy || stockFilter !== prevProductFilters.stockFilter) {
    setPrevProductFilters({ searchQuery, sortBy, stockFilter });
    setCurrentPage(1);
  }

  const filteredProducts = useMemo(() => {
    return products
      .filter(p => {
        const q = searchQuery.toLowerCase();
        const matchSearch = p.name.toLowerCase().includes(q) || (p.description || "").toLowerCase().includes(q) || (p.category || "").toLowerCase().includes(q);
        const matchStock =
          stockFilter === "all" ? true :
          stockFilter === "in_stock" ? p.stock > 5 :
          stockFilter === "low" ? p.stock > 0 && p.stock <= 5 :
          p.stock === 0;
        return matchSearch && matchStock;
      })
      .sort((a, b) => {
        if (sortBy === "price_asc") return a.price - b.price;
        if (sortBy === "price_desc") return b.price - a.price;
        if (sortBy === "stock_asc") return a.stock - b.stock;
        if (sortBy === "stock_desc") return b.stock - a.stock;
        return 0;
      });
  }, [products, searchQuery, sortBy, stockFilter]);

  const totalPages = Math.ceil(filteredProducts.length / ITEMS_PER_PAGE);
  const paginatedProducts = useMemo(() => {
    return filteredProducts.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);
  }, [filteredProducts, currentPage]);

  const { outOfStockCount, lowStockCount, inventoryValue } = useMemo(() => {
    return products.reduce(
      (acc, p) => {
        if (p.stock === 0) acc.outOfStockCount++;
        else if (p.stock <= 5) acc.lowStockCount++;
        acc.inventoryValue += p.price * p.stock;
        return acc;
      },
      { outOfStockCount: 0, lowStockCount: 0, inventoryValue: 0 }
    );
  }, [products]);

  const handleSaveProduct = async () => {
    if (!newProduct.name.trim()) { showToast("Product name is required", "error"); return; }
    setIsSaving(true);
    const productData = {
      name: newProduct.name,
      image: newProduct.image,
      description: newProduct.description,
      price: parseFloat(newProduct.price) || 0,
      stock: parseInt(newProduct.stock, 10) || 0,
      category: newProduct.category,
      is_public: newProduct.is_public,
      sku: newProduct.sku || null,
      cost_price: newProduct.cost_price ? parseFloat(newProduct.cost_price) : null,
      low_stock_threshold: parseInt(newProduct.low_stock_threshold, 10) || 5,
      tags: newProduct.tags || null,
    };
    let error;
    if (editingProductId) {
      ({ error } = await supabase.from("products").update(productData).eq("id", editingProductId));
    } else {
      ({ error } = await supabase.from("products").insert([productData]));
    }
    setIsSaving(false);
    if (error) { showToast("Error: " + error.message, "error"); return; }
    setIsModalOpen(false);
    setNewProduct({ name: "", image: "", description: "", price: "", stock: "", category: "", is_public: true, sku: "", cost_price: "", low_stock_threshold: "5", tags: "" });
    setEditingProductId(null);
    setImageInputType("link");
    showToast(editingProductId ? "Product updated!" : "Product added!", "success");
    logActivity(editingProductId ? "Updated product" : "Added product", newProduct.name, editingProductId ? "update" : "create");
    fetchProducts();
  };

  const handleInlineUpdate = async (id: string, field: keyof Product, value: string | number) => {
    setProducts(prev => prev.map(p => p.id === id ? { ...p, [field]: value as never } : p));
    const { error } = await supabase.from("products").update({ [field]: value }).eq("id", id);
    if (error) {
      showToast("Update failed: " + error.message, "error");
      fetchProducts();
    } else {
      logActivity(`Updated ${field}`, id, "update");
    }
  };

  const handleTogglePublic = async (product: Product) => {
    const next = !(product.is_public ?? true);
    setProducts(prev => prev.map(p => p.id === product.id ? { ...p, is_public: next } : p));
    const { error } = await supabase.from("products").update({ is_public: next }).eq("id", product.id);
    if (error) {
      showToast("Failed to update visibility: " + error.message, "error");
      setProducts(prev => prev.map(p => p.id === product.id ? { ...p, is_public: product.is_public } : p));
    } else {
      showToast(next ? "Product is now public" : "Product is now private", "success");
    }
  };

  const sendOrderNotification = (order: ClientOrder) => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (Notification.permission !== "granted") return;
    if ("serviceWorker" in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: "SHOW_NOTIFICATION",
        title: "New Order Received!",
        body: `${order.client_name} ordered ${order.product_name} (qty ${order.quantity}) · Rs ${order.price.toLocaleString()}`,
      });
    } else {
      new Notification("New Order Received!", {
        body: `${order.client_name} ordered ${order.product_name} (qty ${order.quantity}) · Rs ${order.price.toLocaleString()}`,
        icon: "/android-chrome-192x192.png",
      });
    }
  };

  const handleDeleteOrder = async () => {
    if (!orderToDelete) return;
    setIsDeletingOrder(true);
    const ord = orders.find(o => o.id === orderToDelete);
    const { error } = await supabase.from("orders").delete().eq("id", orderToDelete);
    setIsDeletingOrder(false);
    setOrderToDelete(null);
    if (error) { showToast("Failed to delete order: " + error.message, "error"); return; }
    setOrders(prev => prev.filter(o => o.id !== orderToDelete));
    showToast("Order deleted", "success");
    logActivity("Deleted order", ord?.product_name || "Unknown", "delete");
  };

  const requestNotifPermission = async () => {
    if (!("Notification" in window)) { showToast("Notifications not supported", "error"); return; }
    const perm = await Notification.requestPermission();
    setNotifPermission(perm);
    if (perm === "granted") showToast("Notifications enabled!", "success");
    else showToast("Notification permission denied", "error");
  };

  const handleEditClick = (product: Product) => {
    setNewProduct({
      name: product.name, image: product.image || "", description: product.description || "",
      price: product.price.toString(), stock: product.stock.toString(), category: product.category || "",
      is_public: product.is_public ?? true, sku: product.sku || "",
      cost_price: product.cost_price?.toString() || "", low_stock_threshold: (product.low_stock_threshold ?? 5).toString(),
      tags: product.tags || "",
    });
    setEditingProductId(product.id);
    setImageInputType(product.image?.includes('product-images') ? "upload" : "link");
    setIsModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!productToDelete) return;
    setIsDeleting(true);
    const prod = products.find(p => p.id === productToDelete);

    if (prod?.image && prod.image.includes('product-images')) {
      const fileName = extractFileName(prod.image);
      if (fileName) {
        await supabase.storage.from('product-images').remove([fileName]);
      }
    }

    const { error } = await supabase.from("products").delete().eq("id", productToDelete);
    setIsDeleting(false);
    setProductToDelete(null);
    if (error) { showToast("Error: " + error.message, "error"); return; }
    showToast("Product deleted!", "success");
    logActivity("Deleted product", prod?.name || "Unknown", "delete");
    fetchProducts();
  };

  const handleBulkDelete = async () => {
    if (!selectedProducts.size) return;
    setIsBulkDeleting(true);
    const ids = Array.from(selectedProducts);

    const fileNames = products
      .filter(p => selectedProducts.has(p.id) && p.image?.includes('product-images'))
      .map(p => extractFileName(p.image))
      .filter(Boolean) as string[];

    if (fileNames.length > 0) {
      await supabase.storage.from('product-images').remove(fileNames);
    }

    const { error } = await supabase.from("products").delete().in("id", ids);
    setIsBulkDeleting(false);
    setShowBulkConfirm(false);
    setSelectedProducts(new Set());
    if (error) { showToast("Bulk delete failed: " + error.message, "error"); return; }
    showToast(`Deleted ${ids.length} products`, "success");
    logActivity(`Bulk deleted ${ids.length} products`, "Multiple products", "delete");
    fetchProducts();
  };

  const toggleSelectProduct = (id: string) => {
    setSelectedProducts(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedProducts.size === paginatedProducts.length) {
      setSelectedProducts(new Set());
    } else {
      setSelectedProducts(new Set(paginatedProducts.map(p => p.id)));
    }
  };

  const handleStockAdjust = async (product: Product, delta: number) => {
    const newStock = Math.max(0, product.stock + delta);
    setAdjustingStockId(product.id);
    const { error } = await supabase.from("products").update({ stock: newStock }).eq("id", product.id);
    setAdjustingStockId(null);
    if (error) { showToast("Stock update failed", "error"); return; }
    logActivity(`Adjusted stock ${delta > 0 ? "+" : ""}${delta}`, product.name, "update");
    fetchProducts();
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingImage(true);
    const fileExt = file.name.split('.').pop();
    const fileName = `${Math.random().toString(36).slice(2)}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from('product-images')
      .upload(fileName, file);

    if (uploadError) {
      showToast("Image upload failed: " + uploadError.message, "error");
      setIsUploadingImage(false);
      return;
    }

    const { data } = supabase.storage.from('product-images').getPublicUrl(fileName);
    console.log('Uploaded image public URL:', data.publicUrl);
    setNewProduct(prev => ({ ...prev, image: data.publicUrl }));
    setIsUploadingImage(false);
    showToast("Image uploaded successfully!", "success");
  };

  // ─── ✨ BEAUTIFUL EXCEL EXPORT ─────────────────────────────────────────────
  const handleDownloadExcel = () => {
    if (!products.length) { showToast("No products to export", "error"); return; }

    const wb = XLSX.utils.book_new();
    const now = new Date().toLocaleDateString("en-US", { day: "numeric", month: "long", year: "numeric" });

    // ── SHEET 1: Inventory ──────────────────────────────────────────────────
    const ws1: XLSX.WorkSheet = {};

    // Title banner (row 0)
    merge(ws1, 0, 0, 0, 7);
    writeCell(ws1, 0, 0, sc(`  PRODUCT INVENTORY REPORT`, {
      bold: true, fontSize: 16, color: "FFFFFF", bgColor: "6366F1", hAlign: "left", border: false,
    }));

    // Subtitle (row 1)
    merge(ws1, 1, 0, 1, 7);
    writeCell(ws1, 1, 0, sc(`  Generated: ${now}   |   Total Products: ${products.length}`, {
      fontSize: 10, color: "94A3B8", bgColor: "334155", hAlign: "left", italic: true,
    }));

    // Spacer (row 2) — empty
    for (let c = 0; c < 8; c++) writeCell(ws1, 2, c, sc("", { bgColor: "1E293B" }));

    // Headers (row 3)
    const headers = ["ID", "Product Name", "Category", "Price (Rs)", "Stock Qty", "Stock Value (Rs)", "Status", "Description"];
    headers.forEach((h, c) => writeCell(ws1, 3, c, sc(h, {
      bold: true, fontSize: 11, color: "FFFFFF", bgColor: "1E293B", border: true, thick: true,
    })));

    // Data rows
    products.forEach((p, i) => {
      const row = 4 + i;
      const { label, bg, fg } = getStockStatus(p.stock);
      const rowBg = i % 2 === 0 ? "FFFFFF" : "F8FAFC";
      const stockValue = p.price * p.stock;

      const rowData: [string | number, Partial<Parameters<typeof sc>[1]>][] = [
        [p.id,                   { hAlign: "center", bgColor: rowBg }],
        [p.name,                 { hAlign: "left",   bgColor: rowBg, bold: false }],
        [p.category || "",       { hAlign: "center", bgColor: rowBg }],
        [p.price,                { hAlign: "center", bgColor: rowBg, bold: true, numFmt: "#,##0" }],
        [p.stock,                { hAlign: "center", bgColor: rowBg, numFmt: "#,##0" }],
        [stockValue,             { hAlign: "center", bgColor: "F0FDF4", color: "166534", numFmt: "#,##0" }],
        [label,                  { hAlign: "center", bgColor: bg, color: fg, bold: true }],
        [p.description || "",    { hAlign: "left",   bgColor: rowBg, wrapText: true }],
      ];
      rowData.forEach(([v, opts], c) =>
        writeCell(ws1, row, c, sc(v, { fontSize: 10, border: true, ...opts }))
      );
    });

    // Summary section
    const sr = 4 + products.length + 1;
    const summaries: [string, number | string, string][] = [
      ["TOTAL PRODUCTS",       products.length,                                                     "6366F1"],
      ["TOTAL INVENTORY VALUE", `Rs ${inventoryValue.toLocaleString()}`,                            "10B981"],
      ["OUT OF STOCK",         products.filter(p => p.stock === 0).length,                         "EF4444"],
      ["LOW STOCK (≤5)",       products.filter(p => p.stock > 0 && p.stock <= 5).length,           "F59E0B"],
      ["CATEGORIES",           [...new Set(products.map(p => p.category).filter(Boolean))].length,  "0EA5E9"],
    ];
    summaries.forEach(([label, value, accent], j) => {
      const r = sr + j;
      merge(ws1, r, 0, r, 2);
      writeCell(ws1, r, 0, sc(label,        { bold: true, fontSize: 10, color: "FFFFFF", bgColor: accent, border: true }));
      merge(ws1, r, 3, r, 5);
      writeCell(ws1, r, 3, sc(String(value), { bold: true, fontSize: 13, color: accent, bgColor: "F8FAFC", border: true }));
    });

    // Range & col widths
    const lastRow = sr + summaries.length;
    ws1["!ref"] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: lastRow, c: 7 } });
    setCols(ws1, [10, 28, 16, 14, 12, 20, 14, 36]);
    ws1["!rows"] = [{ hpt: 36 }, { hpt: 22 }, { hpt: 8 }, { hpt: 28 }];

    XLSX.utils.book_append_sheet(wb, ws1, "📦 Inventory");

    // ── SHEET 2: Dashboard KPIs ─────────────────────────────────────────────
    const ws2: XLSX.WorkSheet = {};

    // Title
    merge(ws2, 0, 0, 0, 5);
    writeCell(ws2, 0, 0, sc("  INVENTORY DASHBOARD", {
      bold: true, fontSize: 16, color: "FFFFFF", bgColor: "1E293B", hAlign: "left",
    }));

    // KPI cards (rows 2-4)
    const kpis = [
      { label: "Total Products",     value: products.length,                                             accent: "6366F1", bg: "EEF2FF" },
      { label: "In Stock",           value: products.filter(p => p.stock > 5).length,                   accent: "10B981", bg: "DCFCE7" },
      { label: "Low Stock",          value: products.filter(p => p.stock > 0 && p.stock <= 5).length,   accent: "F59E0B", bg: "FEF9C3" },
      { label: "Out of Stock",       value: products.filter(p => p.stock === 0).length,                 accent: "EF4444", bg: "FEE2E2" },
      { label: "Inventory Value",    value: `Rs ${inventoryValue.toLocaleString()}`,                    accent: "0EA5E9", bg: "E0F2FE" },
      { label: "Unique Categories",  value: [...new Set(products.map(p => p.category).filter(Boolean))].length, accent: "A855F7", bg: "FAF5FF" },
    ];
    kpis.forEach(({ label, value, accent, bg }, col) => {
      // color bar (row 2)
      writeCell(ws2, 2, col, sc("", { bgColor: accent }));
      // value (row 3)
      writeCell(ws2, 3, col, sc(String(value), { bold: true, fontSize: 18, color: accent, bgColor: bg, border: true }));
      // label (row 4)
      writeCell(ws2, 4, col, sc(label, { fontSize: 9, bold: true, color: "64748B", bgColor: bg, border: true }));
    });

    // Category breakdown table
    const cats: Record<string, { count: number; value: number; inStock: number; outStock: number; lowStock: number }> = {};
    products.forEach(p => {
      const cat = p.category || "Uncategorized";
      if (!cats[cat]) cats[cat] = { count: 0, value: 0, inStock: 0, outStock: 0, lowStock: 0 };
      cats[cat].count++;
      cats[cat].value += p.price * p.stock;
      if (p.stock === 0) cats[cat].outStock++;
      else if (p.stock <= 5) cats[cat].lowStock++;
      else cats[cat].inStock++;
    });

    const catHeaders = ["Category", "Products", "In Stock", "Low Stock", "Out of Stock", "Total Value (Rs)"];
    catHeaders.forEach((h, c) => writeCell(ws2, 6, c, sc(h, {
      bold: true, fontSize: 10, color: "FFFFFF", bgColor: "334155", border: true,
    })));

    Object.entries(cats).forEach(([cat, data], i) => {
      const r = 7 + i;
      const bg = i % 2 === 0 ? "FFFFFF" : "F8FAFC";
      const row: [string | number, Partial<Parameters<typeof sc>[1]>][] = [
        [cat,            { hAlign: "left",   bold: true }],
        [data.count,     { hAlign: "center" }],
        [data.inStock,   { hAlign: "center", color: "166534", bgColor: i % 2 === 0 ? "F0FDF4" : "DCFCE7" }],
        [data.lowStock,  { hAlign: "center", color: "854D0E", bgColor: i % 2 === 0 ? "FEFCE8" : "FEF9C3" }],
        [data.outStock,  { hAlign: "center", color: "991B1B", bgColor: i % 2 === 0 ? "FFF1F2" : "FEE2E2" }],
        [data.value,     { hAlign: "center", color: "166534", numFmt: "#,##0" }],
      ];
      row.forEach(([v, opts], c) =>
        writeCell(ws2, r, c, sc(v, { fontSize: 10, border: true, bgColor: bg, ...opts }))
      );
    });

    ws2["!ref"] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: 7 + Object.keys(cats).length, c: 5 } });
    setCols(ws2, [22, 14, 12, 12, 14, 20]);
    ws2["!rows"] = [{ hpt: 36 }, { hpt: 8 }, { hpt: 8 }, { hpt: 40 }, { hpt: 22 }, { hpt: 10 }, { hpt: 24 }];

    XLSX.utils.book_append_sheet(wb, ws2, "📊 Dashboard");

    // ── SHEET 3: By Category ────────────────────────────────────────────────
    const ws3: XLSX.WorkSheet = {};
    merge(ws3, 0, 0, 0, 6);
    writeCell(ws3, 0, 0, sc("  PRODUCTS BY CATEGORY", {
      bold: true, fontSize: 15, color: "FFFFFF", bgColor: "6366F1", hAlign: "left",
    }));

    const catAccents: Record<string, { bg: string; accent: string }> = {};
    const palette = [
      { bg: "EEF2FF", accent: "6366F1" },
      { bg: "FDF4FF", accent: "A855F7" },
      { bg: "FFF7ED", accent: "F97316" },
      { bg: "F0FDF4", accent: "22C55E" },
      { bg: "E0F2FE", accent: "0EA5E9" },
      { bg: "FFF1F2", accent: "F43F5E" },
    ];
    Object.keys(cats).forEach((cat, i) => { catAccents[cat] = palette[i % palette.length]; });

    const colHeaders = ["ID", "Name", "Category", "Price (Rs)", "Stock", "Status", "Description"];
    const colWidths3 = [10, 26, 16, 14, 10, 14, 36];

    let row3 = 2;
    Object.entries(cats).forEach(([cat, _data]) => {
      const catProds = products.filter(p => (p.category || "Uncategorized") === cat);
      const { accent, bg } = catAccents[cat];

      // Category header
      merge(ws3, row3, 0, row3, 6);
      writeCell(ws3, row3, 0, sc(`  ${cat}  (${catProds.length} products)`, {
        bold: true, fontSize: 12, color: "FFFFFF", bgColor: accent, hAlign: "left",
      }));
      row3++;

      // Column headers
      colHeaders.forEach((h, c) => writeCell(ws3, row3, c, sc(h, {
        bold: true, fontSize: 10, color: "374151", bgColor: bg, border: true,
      })));
      row3++;

      // Product rows
      catProds.forEach((p, i) => {
        const { label, bg: sBg, fg: sFg } = getStockStatus(p.stock);
        const rowBg = i % 2 === 0 ? "FFFFFF" : "F8FAFC";
        const cells: [string | number, Partial<Parameters<typeof sc>[1]>][] = [
          [p.id,              { hAlign: "center" }],
          [p.name,            { hAlign: "left"   }],
          [p.category || "",  { hAlign: "center" }],
          [p.price,           { hAlign: "center", bold: true, numFmt: "#,##0" }],
          [p.stock,           { hAlign: "center", numFmt: "#,##0" }],
          [label,             { hAlign: "center", color: sFg, bgColor: sBg, bold: true }],
          [p.description||"", { hAlign: "left", wrapText: true }],
        ];
        cells.forEach(([v, opts], c) =>
          writeCell(ws3, row3, c, sc(v, { fontSize: 10, border: true, bgColor: rowBg, ...opts }))
        );
        row3++;
      });
      row3++; // spacer
    });

    ws3["!ref"] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: row3, c: 6 } });
    setCols(ws3, colWidths3);

    XLSX.utils.book_append_sheet(wb, ws3, "🗂️ By Category");

    // ── Write & download ───────────────────────────────────────────────────
    XLSX.writeFile(wb, `Products_Inventory_${new Date().toISOString().slice(0, 10)}.xlsx`, { cellStyles: true });
    showToast("Exported beautiful Excel!", "success");
    logActivity("Exported product inventory (styled)", `${products.length} products`, "info");
  };

  // ─── Social ────────────────────────────────────────────────────────────────

  const handleSaveSocial = async () => {
    if (!newSocial.platform_name || !newSocial.profile_link) { showToast("Platform name and link required", "error"); return; }
    setIsSavingSocial(true);
    const socialData = { ...newSocial, followers: newSocial.followers ? parseInt(newSocial.followers) : null };
    let error;
    if (editingSocialId) {
      ({ error } = await supabase.from("social_profiles").update(socialData).eq("id", editingSocialId));
    } else {
      ({ error } = await supabase.from("social_profiles").insert([socialData]));
    }
    setIsSavingSocial(false);
    if (error) { showToast("Error: " + error.message, "error"); return; }
    setIsSocialModalOpen(false);
    setNewSocial({ platform_name: "", platform_icon: "", profile_link: "", username: "", email: "", password: "", description: "", is_active: true, followers: "" });
    setEditingSocialId(null);
    showToast(editingSocialId ? "Profile updated!" : "Profile added!", "success");
    logActivity(editingSocialId ? "Updated social profile" : "Added social profile", newSocial.platform_name, editingSocialId ? "update" : "create");
    fetchSocialProfiles();
  };

  const handleEditSocial = (p: SocialProfile) => {
    setNewSocial({ platform_name: p.platform_name || "", platform_icon: p.platform_icon || "", profile_link: p.profile_link || "", username: p.username || "", email: p.email || "", password: p.password || "", description: p.description || "", is_active: p.is_active ?? true, followers: p.followers?.toString() || "" });
    setEditingSocialId(p.id);
    setIsSocialModalOpen(true);
  };

  const confirmDeleteSocial = async () => {
    if (!socialToDelete) return;
    setIsDeleting(true);
    const prof = socialProfiles.find(p => p.id === socialToDelete);
    const { error } = await supabase.from("social_profiles").delete().eq("id", socialToDelete);
    setIsDeleting(false);
    setSocialToDelete(null);
    if (error) { showToast("Error: " + error.message, "error"); return; }
    showToast("Profile deleted!", "success");
    logActivity("Deleted social profile", prof?.platform_name || "Unknown", "delete");
    fetchSocialProfiles();
  };

  const handleToggleActive = async (p: SocialProfile) => {
    const newStatus = !p.is_active;
    const { error } = await supabase.from("social_profiles").update({ is_active: newStatus }).eq("id", p.id);
    if (error) { 
      console.dir(error);
      showToast("Toggle failed: " + (error.message || "Missing is_active column in DB"), "error"); 
      return; 
    }
    logActivity(`Marked ${p.platform_name} as ${newStatus ? "active" : "inactive"}`, p.platform_name, "update");
    fetchSocialProfiles();
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    showToast(`${label} copied!`, "success");
  };

  // ─── Updates ───────────────────────────────────────────────────────────────

  const handleSaveUpdate = async () => {
    if (!newUpdate.info || !newUpdate.content) { showToast("Title and content required", "error"); return; }
    setIsSavingUpdate(true);
    const updateData = {
      info: newUpdate.info,
      content: newUpdate.content,
      link: newUpdate.link || null,
      priority: newUpdate.priority,
      type: newUpdate.type,
    };
    let error;
    if (editingUpdateId) {
      ({ error } = await supabase.from("updates").update(updateData).eq("id", editingUpdateId));
    } else {
      ({ error } = await supabase.from("updates").insert(updateData));
    }
    setIsSavingUpdate(false);
    if (error) { showToast("Error: " + error.message, "error"); return; }
    setIsUpdateModalOpen(false);
    setNewUpdate({ info: "", content: "", link: "", priority: "low", type: "announcement" });
    setEditingUpdateId(null);
    showToast(editingUpdateId ? "Update saved!" : "Update posted!", "success");
    logActivity(editingUpdateId ? "Edited update" : "Posted update", newUpdate.info, editingUpdateId ? "update" : "create");
    fetchUpdates();
  };

  const handleEditUpdate = (u: AppUpdate) => {
    setNewUpdate({ info: u.info || "", content: u.content || "", link: u.link || "", priority: u.priority || "low", type: u.type || "announcement" });
    setEditingUpdateId(u.id);
    setIsUpdateModalOpen(true);
  };

  const confirmDeleteUpdate = async () => {
    if (!updateToDelete) return;
    setIsDeleting(true);
    const upd = updates.find(u => u.id === updateToDelete);
    const { error } = await supabase.from("updates").delete().eq("id", updateToDelete);
    setIsDeleting(false);
    setUpdateToDelete(null);
    if (error) { showToast("Error: " + error.message, "error"); return; }
    showToast("Update deleted!", "success");
    logActivity("Deleted update", upd?.info || "Unknown", "delete");
    fetchUpdates();
  };

  const confirmLogout = async () => {
    setIsLoggingOut(true);
    await supabase.auth.signOut();
    router.push("/login");
  };

  const handleExportInvoice = async () => {
    setIsExportingInvoice(true);
    try {
      const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
        import("html2canvas"),
        import("jspdf"),
      ]);

      const el = document.getElementById("invoice-preview");
      if (!el) throw new Error("Preview element not found");

      const canvas = await html2canvas(el, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#fff",
      });

      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pdfW = pdf.internal.pageSize.getWidth();
      const pdfH = (canvas.height * pdfW) / canvas.width;

      pdf.addImage(imgData, "PNG", 0, 0, pdfW, pdfH);
      pdf.save(`TechNinja_Invoice_${invoiceData.invoiceNo || "draft"}.pdf`);

      showToast("Invoice PDF exported successfully!", "success");
      setIsInvoiceModalOpen(false);
      logActivity("Exported Invoice", `Invoice No: ${invoiceData.invoiceNo || "draft"}`, "info");
    } catch (err) {
      console.error(err);
      window.print();
      showToast("Opened print dialog as fallback", "success");
    } finally {
      setIsExportingInvoice(false);
    }
  };

  const handleSaveInvoice = async (invoiceToSave: InvoiceData) => {
    setIsSavingInvoice(true);
    try {
      // Only consume a sequence number when actually saving a brand-new invoice
      let invoiceNo = invoiceToSave.invoiceNo;
      if (!invoiceToSave.id && !invoiceNo) {
        const { data: nextNo } = await supabase.rpc("next_invoice_no");
        invoiceNo = nextNo || "";
        setInvoiceData(prev => ({ ...prev, invoiceNo }));
      }
      const payload = {
        invoice_no: invoiceNo,
        date: invoiceToSave.date || null,
        due: invoiceToSave.due || null,
        customer_title: invoiceToSave.customerTitle,
        customer_name: invoiceToSave.customerName,
        address: invoiceToSave.address,
        tel: invoiceToSave.tel,
        email: invoiceToSave.email,
        device: invoiceToSave.device,
        serial: invoiceToSave.serial,
        tech: invoiceToSave.tech,
        wo: invoiceToSave.wo,
        done: invoiceToSave.done,
        services: invoiceToSave.services,
        parts: invoiceToSave.parts,
        labour: invoiceToSave.labour,
        terms: invoiceToSave.terms,
        cash: invoiceToSave.cash,
        user_id: user?.id,
        version: (invoiceToSave.version || 1) + 1,
      };

      if (invoiceToSave.id) {
        // Using optimistic concurrency control: Only update if the version matches what we originally loaded
        const { data, error } = await supabase
          .from("invoices")
          .update(payload)
          .eq("id", invoiceToSave.id)
          .eq("version", invoiceToSave.version || 1)
          .select();
          
        if (error) throw error;
        
        // If no rows were returned, it means the version didn't match (someone else updated it)
        if (!data || data.length === 0) {
          throw new Error("Concurrency error: The invoice was modified elsewhere. Please refresh to see the latest changes.");
        }
        
        setInvoiceData(prev => ({ ...prev, version: payload.version }));
        showToast("Invoice updated in database!", "success");
        logActivity("Updated Invoice", `Invoice No: ${invoiceToSave.invoiceNo}`, "update");
      } else {
        const { data, error } = await supabase.from("invoices").insert([payload]).select().single();
        if (error) throw error;
        setInvoiceData(prev => ({ ...prev, id: data.id, version: data.version }));
        showToast("Invoice saved to database!", "success");
        logActivity("Saved Invoice", `Invoice No: ${invoiceToSave.invoiceNo}`, "create");
      }
      fetchInvoices();
    } catch (error: any) {
      // Map properties explicitly into a POJO so Next.js's stringifier doesn't swallow them
      const errorDetails = {
        message: error?.message,
        details: error?.details,
        hint: error?.hint,
        code: error?.code,
        name: error?.name,
        fallback: error ? String(error) : "unknown error",
      };
      console.error("Invoice Save Error Details:", errorDetails);
      
      const msg = error?.message || error?.details || "An unexpected error occurred while saving.";
      showToast(msg === "[object Object]" ? "Network error or unhandled exception." : msg, "error");
    } finally {
      setIsSavingInvoice(false);
    }
  };

  const confirmDeleteInvoice = async () => {
    if (!invoiceToDelete) return;
    setIsDeleting(true);
    const inv = invoices.find(i => i.id === invoiceToDelete);
    const { error } = await supabase.from("invoices").delete().eq("id", invoiceToDelete);
    setIsDeleting(false);
    setInvoiceToDelete(null);
    if (error) { showToast("Error: " + error.message, "error"); return; }
    showToast("Invoice deleted!", "success");
    logActivity("Deleted Invoice", `Invoice No: ${inv?.invoiceNo || "Unknown"}`, "delete");
    fetchInvoices();
    if (invoiceData.id === invoiceToDelete) {
      setInvoiceData(defaultInvoiceData());
    }
  };

  const handleDuplicateInvoice = (inv: InvoiceData, e: React.MouseEvent) => {
    e.stopPropagation();
    const duplicated: InvoiceData = {
      ...inv,
      id: undefined,
      version: 1,
      invoiceNo: "",  // assigned by sequence at save time
      date: new Date().toISOString().slice(0, 10),
      services: inv.services.map(s => ({ ...s, id: uid() })),
      parts: inv.parts.map(p => ({ ...p, id: uid() })),
      labour: inv.labour.map(l => ({ ...l, id: uid() }))
    };
    setInvoiceData(duplicated);
    setIsInvoiceModalOpen(true);
    showToast("Invoice duplicated!", "success");
    logActivity("Duplicated Invoice", `From ${inv.invoiceNo || "Unknown"}`, "create");
  };

  // ─── Nav sections ─────────────────────────────────────────────────────────

  const navSections = [
    { key: "home",     label: "Overview",  count: null,                       icon: "⊞" },
    { key: "products", label: "Products",  count: products.length,            icon: "📦" },
    { key: "orders",   label: "Orders",    count: orders.filter(o => o.status === "pending").length || null, icon: "🛒" },
    { key: "invoice",  label: "Invoices",  count: invoices.length || null,    icon: "📄" },
    { key: "tools",    label: "Tools",     count: null,                       icon: "🛠️" },
    { key: "social",   label: "Social",    count: socialProfiles.length || null, icon: "🔗" },
    { key: "updates",  label: "Updates",   count: updates.length || null,     icon: "📣" },
    { key: "settings", label: "Settings",  count: null,                       icon: "⚙️" },
    { key: "log",      label: "Activity",  count: activityLog.length || null, icon: "🕐" },
  ] as const;

  const invoiceCounter = 0; // unused — invoice numbers come from next_invoice_no() RPC

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-white flex flex-col">

      {/* ── Top Bar ──────────────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-30 bg-white/95 dark:bg-gray-900/95 backdrop-blur-md border-b border-gray-200 dark:border-gray-800 px-3 md:px-4 h-14 flex items-center justify-between gap-3">
        {/* Left: sidebar toggle + breadcrumb */}
        <div className="flex items-center gap-2 min-w-0">
          <button
            onClick={() => setSidebarCollapsed(c => !c)}
            className="hidden md:flex items-center justify-center w-8 h-8 rounded-lg text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 transition-all flex-shrink-0"
            title="Toggle sidebar"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
            </svg>
          </button>
          <div className="flex items-center gap-1.5 text-sm min-w-0">
            <Link href="/" className="text-gray-400 dark:text-gray-500 hover:text-gray-900 dark:hover:text-white transition-colors font-medium hidden sm:block flex-shrink-0">Home</Link>
            <svg className="w-3 h-3 text-gray-300 dark:text-gray-700 hidden sm:block flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            <span className="text-gray-700 dark:text-gray-200 font-semibold truncate">
              {navSections.find(n => n.key === activeSection)?.label ?? "Dashboard"}
            </span>
          </div>
        </div>

        {/* Center: Search trigger */}
        <button className="hidden md:flex items-center gap-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700/80 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-1.5 text-xs text-gray-400 transition-all w-48 lg:w-64 flex-shrink-0">
          <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" /></svg>
          <span className="flex-1 text-left">Search...</span>
          <kbd className="text-[10px] bg-gray-200 dark:bg-gray-700 px-1.5 py-0.5 rounded font-mono text-gray-400">⌘K</kbd>
        </button>

        {/* Right: action icons */}
        <div className="flex items-center gap-1">
          {/* Stock alerts compact pill */}
          {outOfStockCount > 0 && (
            <span className="hidden lg:inline-flex text-xs font-semibold px-2 py-1 rounded-full bg-rose-500/10 text-rose-500 border border-rose-500/20 flex-shrink-0">
              {outOfStockCount} OOS
            </span>
          )}
          {lowStockCount > 0 && (
            <span className="hidden lg:inline-flex text-xs font-semibold px-2 py-1 rounded-full bg-amber-500/10 text-amber-500 border border-amber-500/20 flex-shrink-0">
              {lowStockCount} low
            </span>
          )}

          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            className="flex items-center justify-center w-8 h-8 rounded-lg text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 transition-all"
            title="Toggle theme"
          >
            {dark ? (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" /></svg>
            ) : (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" /></svg>
            )}
          </button>

          {/* Refresh */}
          <button
            onClick={() => loadAllData(true)}
            disabled={isRefreshing}
            title="Refresh (R)"
            className="flex items-center justify-center w-8 h-8 rounded-lg text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 transition-all disabled:opacity-40"
          >
            <svg className={`w-4 h-4 ${isRefreshing ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0011.664 0M2.985 19.644A8.25 8.25 0 013 12a8.25 8.25 0 0115.023-5.455" /></svg>
          </button>

          {/* Notification bell */}
          <div className="relative">
            <button
              onClick={() => { setShowNotifications(!showNotifications); setUnreadOrders(0); }}
              className="relative flex items-center justify-center w-8 h-8 rounded-lg text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 transition-all"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" /></svg>
              {unreadOrders > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center">
                  {unreadOrders > 9 ? "9+" : unreadOrders}
                </span>
              )}
            </button>
            {showNotifications && (
              <div className="absolute right-0 top-11 w-96 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-2xl z-50 overflow-hidden">
                {/* Panel header */}
                <div className="px-4 pt-4 pb-3 border-b border-gray-100 dark:border-gray-800">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-bold text-gray-900 dark:text-white">Notifications</span>
                    <div className="flex items-center gap-2">
                      {notifPermission !== "granted" && (
                        <button
                          onClick={requestNotifPermission}
                          className="text-[10px] font-semibold px-2 py-1 rounded-lg bg-indigo-500/10 text-indigo-500 dark:text-indigo-400 border border-indigo-500/20 hover:bg-indigo-500/20 transition-colors"
                        >
                          Enable push
                        </button>
                      )}
                      {notifPermission === "granted" && (
                        <span className="text-[10px] font-semibold px-2 py-1 rounded-lg bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                          ✓ Push on
                        </span>
                      )}
                      <button
                        onClick={() => setShowNotifications(false)}
                        className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                    </div>
                  </div>
                  {/* Tabs */}
                  <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5">
                    {([["orders", "📦 Orders", orders.length], ["stock", "⚠️ Stock", products.filter(p => p.stock <= (p.low_stock_threshold ?? 5)).length]] as const).map(([tab, label, count]) => (
                      <button
                        key={tab}
                        onClick={() => setNotifTab(tab)}
                        className={`flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold py-1.5 rounded-md transition-all ${notifTab === tab ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm" : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"}`}
                      >
                        {label}
                        {(count as number) > 0 && (
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${notifTab === tab ? "bg-indigo-500/20 text-indigo-500 dark:text-indigo-400" : "bg-gray-200 dark:bg-gray-700 text-gray-500"}`}>{count}</span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Orders tab */}
                {notifTab === "orders" && (
                  <div className="max-h-80 overflow-y-auto">
                    {orders.length === 0 ? (
                      <div className="text-center py-10">
                        <p className="text-2xl mb-2">📭</p>
                        <p className="text-sm text-gray-500">No orders yet</p>
                      </div>
                    ) : (
                      orders.slice(0, 10).map((order) => (
                        <div key={order.id} className="px-4 py-3 border-b border-gray-100 dark:border-gray-800/60 hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-start gap-2.5 min-w-0">
                              <div className={`mt-0.5 w-2 h-2 rounded-full flex-shrink-0 ${order.status === "pending" ? "bg-amber-400" : order.status === "confirmed" ? "bg-indigo-400" : order.status === "completed" ? "bg-emerald-400" : "bg-red-400"}`} />
                              <div className="min-w-0">
                                <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{order.product_name}</p>
                                <p className="text-xs text-gray-500 mt-0.5">{order.client_name} · qty {order.quantity}</p>
                              </div>
                            </div>
                            <div className="flex-shrink-0 text-right">
                              <p className="text-xs font-bold text-emerald-500 dark:text-emerald-400">Rs {order.price.toLocaleString()}</p>
                              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full mt-1 inline-block ${
                                order.status === "pending" ? "bg-amber-500/15 text-amber-600 dark:text-amber-400" :
                                order.status === "confirmed" ? "bg-indigo-500/15 text-indigo-600 dark:text-indigo-400" :
                                order.status === "completed" ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" :
                                "bg-red-500/15 text-red-500"
                              }`}>{order.status}</span>
                            </div>
                          </div>
                          {order.status === "pending" && (
                            <button
                              onClick={async () => {
                                await supabase.from("orders").update({ status: "confirmed" }).eq("id", order.id);
                                setOrders(prev => prev.map(o => o.id === order.id ? { ...o, status: "confirmed" } : o));
                                showToast("Order confirmed", "success");
                              }}
                              className="mt-2 text-[10px] font-semibold px-2.5 py-1 rounded-lg bg-indigo-500/10 text-indigo-500 dark:text-indigo-400 border border-indigo-500/20 hover:bg-indigo-500/20 transition-colors"
                            >
                              ✓ Confirm order
                            </button>
                          )}
                        </div>
                      ))
                    )}
                    <div className="px-4 py-2.5 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between">
                      <button onClick={() => { setActiveSection("orders"); setShowNotifications(false); }} className="text-xs text-indigo-500 dark:text-indigo-400 font-semibold hover:underline">View all orders →</button>
                    </div>
                  </div>
                )}

                {/* Stock alerts tab */}
                {notifTab === "stock" && (
                  <div className="max-h-80 overflow-y-auto">
                    {(() => {
                      const alertItems = products.filter(p => p.stock <= (p.low_stock_threshold ?? 5)).sort((a, b) => a.stock - b.stock);
                      return alertItems.length === 0 ? (
                        <div className="text-center py-10">
                          <p className="text-2xl mb-2">✅</p>
                          <p className="text-sm text-gray-500">All stock levels are healthy</p>
                        </div>
                      ) : alertItems.map(p => (
                        <div key={p.id} className="px-4 py-3 border-b border-gray-100 dark:border-gray-800/60 hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors">
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{p.name}</p>
                              <p className="text-xs text-gray-500 mt-0.5">{p.category || "Uncategorised"}</p>
                            </div>
                            <div className="flex-shrink-0 text-right">
                              {p.stock === 0 ? (
                                <span className="text-xs font-bold px-2 py-1 rounded-lg bg-red-500/10 text-red-500 border border-red-500/20">Out of stock</span>
                              ) : (
                                <span className="text-xs font-bold px-2 py-1 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">{p.stock} left</span>
                              )}
                            </div>
                          </div>
                        </div>
                      ));
                    })()}
                    <div className="px-4 py-2.5 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between">
                      <button onClick={() => { setActiveSection("products"); setShowNotifications(false); }} className="text-xs text-amber-500 font-semibold hover:underline">Manage inventory →</button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* User avatar + settings link */}
          <div className="h-8 w-px bg-gray-200 dark:bg-gray-700 mx-1" />
          <button
            onClick={() => setActiveSection("settings")}
            className="flex items-center gap-2 group"
            title="Account settings"
          >
            {profile?.avatar_url ? (
              <Image
                src={profile.avatar_url}
                alt={profile?.username || "avatar"}
                width={32}
                height={32}
                unoptimized
                className="w-8 h-8 rounded-full object-cover flex-shrink-0 ring-2 ring-transparent group-hover:ring-indigo-500/30 transition-all"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0 ring-2 ring-transparent group-hover:ring-indigo-500/30 transition-all">
                {(profile?.username || user?.email?.split("@")[0] || "U")[0].toUpperCase()}
              </div>
            )}
            <div className="hidden lg:block text-left">
              <p className="text-xs font-semibold text-gray-900 dark:text-white leading-none">{profile?.username || user?.email?.split("@")[0]}</p>
              <p className="text-[10px] text-gray-400 truncate max-w-[100px] mt-0.5">{user?.email}</p>
            </div>
          </button>

          {/* Logout icon */}
          <button
            onClick={() => setIsLogoutModalOpen(true)}
            className="flex items-center justify-center w-8 h-8 rounded-lg text-gray-400 hover:text-rose-500 hover:bg-rose-500/10 transition-all hidden md:flex"
            title="Logout"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" /></svg>
          </button>

          {/* Mobile hamburger */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="md:hidden flex items-center justify-center w-8 h-8 rounded-lg text-gray-500 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 transition-all"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" /></svg>
          </button>
        </div>

        {/* Mobile dropdown menu */}
        {isMobileMenuOpen && (
          <div className="absolute top-14 left-0 w-full bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 p-4 flex flex-col gap-2 md:hidden shadow-2xl z-40">
            <div className="flex items-center gap-3 pb-3 mb-1 border-b border-gray-100 dark:border-gray-800">
              {profile?.avatar_url ? (
                <Image
                  src={profile.avatar_url}
                  alt={profile?.username || "avatar"}
                  width={40}
                  height={40}
                  unoptimized
                  className="w-10 h-10 rounded-full object-cover flex-shrink-0"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                  {(profile?.username || user?.email?.split("@")[0] || "U")[0].toUpperCase()}
                </div>
              )}
              <div>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">{profile?.username || user?.email?.split("@")[0]}</p>
                <p className="text-xs text-gray-400 break-all">{user?.email}</p>
              </div>
            </div>
            <button onClick={() => { loadAllData(true); setIsMobileMenuOpen(false); }} disabled={isRefreshing} className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 w-full disabled:opacity-50 transition-colors">
              <svg className={`w-4 h-4 flex-shrink-0 ${isRefreshing ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0011.664 0M2.985 19.644A8.25 8.25 0 013 12a8.25 8.25 0 0115.023-5.455" /></svg>
              {isRefreshing ? "Refreshing…" : "Refresh"}
            </button>
            <button onClick={() => { setActiveSection("settings"); setIsMobileMenuOpen(false); }} className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 w-full transition-colors">
              <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 010 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 010-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
              Settings
            </button>
            <button onClick={() => { setIsLogoutModalOpen(true); setIsMobileMenuOpen(false); }} className="flex items-center gap-2 text-sm text-rose-500 px-3 py-2 rounded-lg hover:bg-rose-500/10 w-full transition-colors">
              <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" /></svg>
              Logout
            </button>
          </div>
        )}
      </div>

      {/* ── Body: Sidebar + Content ──────────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0">

        {/* ── Left Sidebar ─────────────────────────────────────────────────── */}
        <aside className={`hidden md:flex flex-col flex-shrink-0 bg-white dark:bg-gray-900/60 border-r border-gray-200 dark:border-gray-800 sticky top-14 self-start h-[calc(100vh-56px)] overflow-y-auto overflow-x-hidden transition-all duration-200 ${sidebarCollapsed ? "w-14" : "w-52"}`}>
          {/* Nav items */}
          <nav className="flex-1 p-2 space-y-0.5 pt-3">
            {navSections.map(s => {
              const isActive = activeSection === s.key;
              const svgIcons: Record<string, React.ReactNode> = {
                home:     <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" /></svg>,
                products: <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" /></svg>,
                orders:   <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" /></svg>,
                invoice:  <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>,
                tools:    <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-6.336l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L3 3.5 4.5 3l3.5 1.5v1.409l.002.002 5.302 4.786m-1.745 1.437l1.745-1.437" /></svg>,
                social:   <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" /></svg>,
                updates:  <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M10.34 15.84c-.688-.06-1.386-.09-2.09-.09H7.5a4.5 4.5 0 110-9h.75c.704 0 1.402-.03 2.09-.09m0 9.18c.253.962.584 1.892.985 2.783.247.55.06 1.21-.463 1.511l-.657.38c-.551.318-1.26.117-1.527-.461a20.845 20.845 0 01-1.44-4.282m3.102.069a18.03 18.03 0 01-.59-4.59c0-1.586.205-3.124.59-4.59m0 9.18a23.848 23.848 0 018.835 2.535M10.34 6.66a23.847 23.847 0 008.835-2.535m0 0A23.74 23.74 0 0018.795 3m.38 1.125a23.91 23.91 0 011.014 5.395m-1.014 8.855c-.118.38-.245.754-.38 1.125m.38-1.125a23.91 23.91 0 001.014-5.395m0-3.46c.495.413.811 1.035.811 1.73 0 .695-.316 1.317-.811 1.73m0-3.46a24.347 24.347 0 010 3.46" /></svg>,
                settings: <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 010 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 010-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
                log:      <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
              };
              return (
                <button
                  key={s.key}
                  onClick={() => setActiveSection(s.key)}
                  title={sidebarCollapsed ? s.label : undefined}
                  className={`w-full flex items-center gap-3 px-2.5 py-2 rounded-lg text-sm font-medium transition-all text-left group relative ${
                    isActive
                      ? "bg-indigo-50 dark:bg-indigo-500/15 text-indigo-600 dark:text-indigo-400"
                      : "text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800/80 hover:text-gray-900 dark:hover:text-white"
                  }`}
                >
                  {isActive && <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-indigo-500 rounded-r-full" />}
                  <span className={isActive ? "text-indigo-500" : ""}>{svgIcons[s.key]}</span>
                  {!sidebarCollapsed && (
                    <>
                      <span className="flex-1 truncate">{s.label}</span>
                      {s.count != null && s.count > 0 && (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold flex-shrink-0 ${
                          isActive ? "bg-indigo-100 dark:bg-indigo-500/25 text-indigo-600 dark:text-indigo-300" : "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400"
                        }`}>
                          {s.count}
                        </span>
                      )}
                    </>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Sidebar footer */}
          {!loading && !sidebarCollapsed && (
            <div className="p-3 border-t border-gray-200 dark:border-gray-800/80">
              <p className="text-[9px] font-bold text-gray-400 dark:text-gray-600 uppercase tracking-widest px-1 mb-2">Quick Stats</p>
              <div className="space-y-1.5">
                <div className="flex justify-between items-center px-1 text-xs">
                  <span className="text-gray-500">Inventory</span>
                  <span className="text-emerald-500 dark:text-emerald-400 font-semibold">Rs {inventoryValue.toLocaleString()}</span>
                </div>
                {outOfStockCount > 0 && (
                  <div className="flex justify-between items-center px-1 text-xs">
                    <span className="text-gray-500">Out of stock</span>
                    <span className="text-rose-500 dark:text-rose-400 font-semibold">{outOfStockCount}</span>
                  </div>
                )}
                {lowStockCount > 0 && (
                  <div className="flex justify-between items-center px-1 text-xs">
                    <span className="text-gray-500">Low stock</span>
                    <span className="text-amber-500 dark:text-amber-400 font-semibold">{lowStockCount}</span>
                  </div>
                )}
                {repairStats.active > 0 && (
                  <div className="flex justify-between items-center px-1 text-xs">
                    <span className="text-gray-500">Open repairs</span>
                    <span className="text-cyan-500 dark:text-cyan-400 font-semibold">{repairStats.active}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </aside>

        {/* ── Mobile Bottom Nav ────────────────────────────────────────────── */}
        <div className="md:hidden fixed bottom-0 left-0 right-0 z-20 bg-white/98 dark:bg-gray-900/98 backdrop-blur-md border-t border-gray-200 dark:border-gray-800 px-2 py-1 flex justify-around">
          {([
            { key: "home",     label: "Home",     icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" /></svg> },
            { key: "products", label: "Products", icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" /></svg> },
            { key: "orders",   label: "Orders",   icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" /></svg> },
            { key: "invoice",  label: "Invoices", icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg> },
            { key: "tools",    label: "Tools",    icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-6.336l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L3 3.5 4.5 3l3.5 1.5v1.409l.002.002 5.302 4.786m-1.745 1.437l1.745-1.437" /></svg> },
          ] as const).map(s => (
            <button
              key={s.key}
              onClick={() => setActiveSection(s.key as typeof activeSection)}
              className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg text-[10px] font-semibold transition-all ${
                activeSection === s.key
                  ? "text-indigo-600 dark:text-indigo-400"
                  : "text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              }`}
            >
              {s.icon}
              {s.label}
            </button>
          ))}
        </div>

        {/* ── Main Content ─────────────────────────────────────────────────── */}
        <main className="flex-1 min-w-0">
          <div className="p-4 md:p-6 pb-24 md:pb-8 max-w-6xl">

        {/* ══ HOME / OVERVIEW TAB ════════════════════════════════════════════════ */}
        {activeSection === "home" && (
          <div className="pt-2 space-y-8">
            {/* Welcome */}
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">Good day, {profile?.username || user?.email?.split("@")[0]}</h1>
                <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Here's your TechNinja business overview</p>
              </div>
              <div className="hidden sm:flex items-center gap-2 text-xs text-gray-400 bg-gray-100 dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700 px-3 py-1.5 rounded-lg flex-shrink-0">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" /></svg>
                {new Date().toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
              </div>
            </div>

            {/* ─ Big Stats Cards ──────────────────────────────────────────── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5 hover:border-indigo-500/40 hover:shadow-md dark:hover:shadow-indigo-500/5 transition-all group">
                <div className="flex items-start justify-between mb-4">
                  <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-500/15 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                    <svg className="w-4.5 h-4.5 text-indigo-600 dark:text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" /></svg>
                  </div>
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Products</span>
                </div>
                <p className="text-3xl font-bold text-gray-900 dark:text-white tabular-nums">{products.length}</p>
                <p className="text-xs mt-1.5">{outOfStockCount > 0 ? <span className="text-rose-500 dark:text-rose-400 font-medium">{outOfStockCount} out of stock</span> : <span className="text-gray-400">All in stock</span>}</p>
              </div>

              <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5 hover:border-amber-500/40 hover:shadow-md dark:hover:shadow-amber-500/5 transition-all group">
                <div className="flex items-start justify-between mb-4">
                  <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-500/15 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                    <svg className="w-4.5 h-4.5 text-amber-600 dark:text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" /></svg>
                  </div>
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Orders</span>
                </div>
                <p className="text-3xl font-bold text-gray-900 dark:text-white tabular-nums">{orders.length}</p>
                <p className="text-xs mt-1.5">
                  {orders.filter(o => o.status === "pending").length > 0
                    ? <span className="text-amber-600 dark:text-amber-400 font-medium">{orders.filter(o => o.status === "pending").length} pending</span>
                    : <span className="text-gray-400">No pending orders</span>}
                </p>
              </div>

              <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5 hover:border-cyan-500/40 hover:shadow-md dark:hover:shadow-cyan-500/5 transition-all group">
                <div className="flex items-start justify-between mb-4">
                  <div className="w-9 h-9 rounded-xl bg-cyan-50 dark:bg-cyan-500/15 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                    <svg className="w-4.5 h-4.5 text-cyan-600 dark:text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-6.336l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L3 3.5 4.5 3l3.5 1.5v1.409l.002.002 5.302 4.786m-1.745 1.437l1.745-1.437" /></svg>
                  </div>
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Repairs</span>
                </div>
                <p className="text-3xl font-bold text-gray-900 dark:text-white tabular-nums">{repairStats.active}</p>
                <p className="text-xs mt-1.5">
                  {repairStats.urgent > 0 ? <span className="text-rose-500 dark:text-rose-400 font-medium">{repairStats.urgent} urgent</span> : repairStats.ready > 0 ? <span className="text-emerald-600 dark:text-emerald-400 font-medium">{repairStats.ready} ready</span> : <span className="text-gray-400">All on track</span>}
                </p>
              </div>

              <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5 hover:border-emerald-500/40 hover:shadow-md dark:hover:shadow-emerald-500/5 transition-all group">
                <div className="flex items-start justify-between mb-4">
                  <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-500/15 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                    <svg className="w-4.5 h-4.5 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  </div>
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Stock Value</span>
                </div>
                <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">Rs {inventoryValue.toLocaleString()}</p>
                <p className="text-xs mt-1.5">{lowStockCount > 0 ? <span className="text-amber-600 dark:text-amber-400 font-medium">{lowStockCount} low stock</span> : <span className="text-gray-400">Healthy inventory</span>}</p>
              </div>
            </div>

            {/* ─ Alerts ───────────────────────────────────────────────────── */}
            {(outOfStockCount > 0 || lowStockCount > 0 || repairStats.urgent > 0) && (
              <div className="flex flex-wrap gap-3">
                {outOfStockCount > 0 && (
                  <div className="flex items-center gap-2 bg-rose-500/10 border border-rose-500/25 rounded-xl px-4 py-2.5 text-sm text-rose-400">
                    <span>⚠</span>
                    <span><b>{outOfStockCount}</b> product{outOfStockCount > 1 ? "s" : ""} out of stock</span>
                    <button onClick={() => setActiveSection("products")} className="ml-1 underline text-xs hover:no-underline">View</button>
                  </div>
                )}
                {lowStockCount > 0 && (
                  <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/25 rounded-xl px-4 py-2.5 text-sm text-amber-400">
                    <span>📉</span>
                    <span><b>{lowStockCount}</b> item{lowStockCount > 1 ? "s" : ""} running low</span>
                    <button onClick={() => setActiveSection("products")} className="ml-1 underline text-xs hover:no-underline">View</button>
                  </div>
                )}
                {repairStats.urgent > 0 && (
                  <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/25 rounded-xl px-4 py-2.5 text-sm text-red-400">
                    <span>🚨</span>
                    <span><b>{repairStats.urgent}</b> urgent repair ticket{repairStats.urgent > 1 ? "s" : ""}</span>
                    <Link href="/dashboard/repairs" className="ml-1 underline text-xs hover:no-underline">Open</Link>
                  </div>
                )}
              </div>
            )}

            {/* ─ Quick Actions ────────────────────────────────────────────── */}
            <div>
              <h2 className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-3">Quick Actions</h2>
              <div className="flex flex-wrap gap-2">
                <button onClick={() => { setNewProduct({ name: "", image: "", description: "", price: "", stock: "", category: "", is_public: true, sku: "", cost_price: "", low_stock_threshold: "5", tags: "" }); setEditingProductId(null); setImageInputType("link"); setIsModalOpen(true); setActiveSection("products"); }}
                  className="flex items-center gap-2 bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 text-gray-700 dark:text-gray-200 px-4 py-2 rounded-xl text-sm font-medium transition-all shadow-sm hover:shadow">
                  <svg className="w-4 h-4 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" /></svg>
                  New Product
                </button>
                <button onClick={() => { setInvoiceData(defaultInvoiceData()); setIsInvoiceModalOpen(true); setActiveSection("invoice"); }}
                  className="flex items-center gap-2 bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 text-gray-700 dark:text-gray-200 px-4 py-2 rounded-xl text-sm font-medium transition-all shadow-sm hover:shadow">
                  <svg className="w-4 h-4 text-violet-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>
                  New Invoice
                </button>
                <Link href="/dashboard/repairs"
                  className="flex items-center gap-2 bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 text-gray-700 dark:text-gray-200 px-4 py-2 rounded-xl text-sm font-medium transition-all shadow-sm hover:shadow">
                  <svg className="w-4 h-4 text-cyan-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-6.336l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L3 3.5 4.5 3l3.5 1.5v1.409l.002.002 5.302 4.786m-1.745 1.437l1.745-1.437" /></svg>
                  Repair Ticket
                </Link>
                <Link href="/dashboard/grading"
                  className="flex items-center gap-2 bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 text-gray-700 dark:text-gray-200 px-4 py-2 rounded-xl text-sm font-medium transition-all shadow-sm hover:shadow">
                  <svg className="w-4 h-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 8.25h3m-3 3h3m-3 3h3" /></svg>
                  Grade Phone
                </Link>
                <Link href="/dashboard/loyalty"
                  className="flex items-center gap-2 bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 text-gray-700 dark:text-gray-200 px-4 py-2 rounded-xl text-sm font-medium transition-all shadow-sm hover:shadow">
                  <svg className="w-4 h-4 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 01-.982-3.172M9.497 14.25a7.454 7.454 0 00.981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 007.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M7.73 9.728a6.726 6.726 0 002.748 1.35m8.272-6.842V4.5c0 2.108-.966 3.99-2.48 5.228m2.48-5.492a46.32 46.32 0 012.916.52 6.003 6.003 0 01-5.395 4.972m0 0a6.726 6.726 0 01-2.749 1.35m0 0a6.772 6.772 0 01-3.044 0" /></svg>
                  Loyalty
                </Link>
              </div>
            </div>

            {/* ─ Recent Orders + Repair pipeline ──────────────────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Recent Orders */}
              <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Recent Orders</h3>
                  <button onClick={() => setActiveSection("orders")} className="text-xs text-indigo-400 hover:underline">View all</button>
                </div>
                <div className="divide-y divide-gray-800/60">
                  {orders.length === 0 ? (
                    <p className="text-sm text-gray-500 text-center py-8">No orders yet</p>
                  ) : orders.slice(0, 5).map(order => (
                    <div key={order.id} className="flex items-center justify-between px-5 py-3 hover:bg-gray-800/40 transition-colors">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{order.product_name}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{order.client_name} · qty {order.quantity}</p>
                      </div>
                      <div className="flex-shrink-0 text-right ml-4">
                        <p className="text-sm font-semibold text-emerald-400">Rs {order.price.toLocaleString()}</p>
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full mt-0.5 inline-block ${
                          order.status === "pending" ? "bg-amber-500/20 text-amber-400" :
                          order.status === "confirmed" ? "bg-indigo-500/20 text-indigo-400" :
                          order.status === "completed" ? "bg-emerald-500/20 text-emerald-400" :
                          "bg-red-500/20 text-red-400"
                        }`}>{order.status}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Repair Status Widget */}
              <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Repair Tickets</h3>
                  <Link href="/dashboard/repairs" className="text-xs text-indigo-400 hover:underline">Manage</Link>
                </div>
                <div className="p-5 space-y-3">
                  {[
                    { label: "Active Jobs", value: repairStats.active, color: "text-cyan-400", bar: "bg-cyan-500" },
                    { label: "Urgent",      value: repairStats.urgent, color: "text-rose-400", bar: "bg-rose-500" },
                    { label: "Ready to Collect", value: repairStats.ready, color: "text-emerald-400", bar: "bg-emerald-500" },
                  ].map(row => (
                    <div key={row.label} className="flex items-center gap-3">
                      <div className="w-32 flex-shrink-0">
                        <p className="text-xs text-gray-500">{row.label}</p>
                      </div>
                      <div className="flex-1 bg-gray-200 dark:bg-gray-800 rounded-full h-2">
                        <div className={`h-2 rounded-full ${row.bar} transition-all`}
                          style={{ width: repairStats.active > 0 ? `${Math.min((row.value / Math.max(repairStats.active, 1)) * 100, 100)}%` : "0%" }} />
                      </div>
                      <span className={`text-sm font-bold w-6 text-right flex-shrink-0 ${row.color}`}>{row.value}</span>
                    </div>
                  ))}
                  {repairStats.active === 0 && (
                    <div className="text-center py-4">
                      <p className="text-sm text-gray-500">No open repair tickets</p>
                      <Link href="/dashboard/repairs" className="text-xs text-indigo-400 hover:underline mt-1 inline-block">Create first ticket →</Link>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* ─ Tools / Modules ──────────────────────────────────────────── */}
            <div>
              <h2 className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-3">Modules</h2>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {[
                  { href: "/dashboard/repairs",   label: "Repairs",   sub: "Ticket pipeline",  badge: repairStats.active > 0 ? `${repairStats.active} open` : null, badgeColor: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400",
                    icon: <svg className="w-5 h-5 text-cyan-600 dark:text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}><path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-6.336l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L3 3.5 4.5 3l3.5 1.5v1.409l.002.002 5.302 4.786m-1.745 1.437l1.745-1.437" /></svg>,
                    bg: "bg-cyan-50 dark:bg-cyan-500/10", border: "border-cyan-500/20 hover:border-cyan-500/40" },
                  { href: "/dashboard/grading",   label: "Grading",   sub: "Trade-in scoring", badge: null, badgeColor: "",
                    icon: <svg className="w-5 h-5 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}><path strokeLinecap="round" strokeLinejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 8.25h3m-3 3h3m-3 3h3" /></svg>,
                    bg: "bg-emerald-50 dark:bg-emerald-500/10", border: "border-emerald-500/20 hover:border-emerald-500/40" },
                  { href: "/dashboard/loyalty",   label: "Loyalty",   sub: "Points & tiers",   badge: null, badgeColor: "",
                    icon: <svg className="w-5 h-5 text-yellow-600 dark:text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 01-.982-3.172M9.497 14.25a7.454 7.454 0 00.981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 007.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M7.73 9.728a6.726 6.726 0 002.748 1.35m8.272-6.842V4.5c0 2.108-.966 3.99-2.48 5.228m2.48-5.492a46.32 46.32 0 012.916.52 6.003 6.003 0 01-5.395 4.972m0 0a6.726 6.726 0 01-2.749 1.35m0 0a6.772 6.772 0 01-3.044 0" /></svg>,
                    bg: "bg-yellow-50 dark:bg-yellow-500/10", border: "border-yellow-500/20 hover:border-yellow-500/40" },
                  { href: "/dashboard/inventory", label: "Inventory", sub: "Stock management",  badge: outOfStockCount > 0 ? `${outOfStockCount} OOS` : null, badgeColor: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
                    icon: <svg className="w-5 h-5 text-purple-600 dark:text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z" /></svg>,
                    bg: "bg-purple-50 dark:bg-purple-500/10", border: "border-purple-500/20 hover:border-purple-500/40" },
                ].map(m => (
                  <Link key={m.href} href={m.href}
                    className={`bg-white dark:bg-gray-900 border ${m.border} rounded-xl p-4 transition-all hover:shadow-sm group block`}>
                    <div className="flex items-start justify-between mb-3">
                      <div className={`w-9 h-9 rounded-xl ${m.bg} flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform`}>
                        {m.icon}
                      </div>
                      {m.badge && <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${m.badgeColor}`}>{m.badge}</span>}
                    </div>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">{m.label}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{m.sub}</p>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ══ PRODUCTS TAB ═══════════════════════════════════════════════════════ */}
        {activeSection === "products" && (
          <div ref={productsRef} className="scroll-mt-32">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4 pt-2">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Products</h2>
                <p className="text-gray-500 text-sm mt-0.5">{filteredProducts.length} of {products.length} shown</p>
              </div>
              <div className="flex flex-wrap gap-2 w-full md:w-auto">
                <button onClick={handleDownloadExcel} className="flex items-center gap-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-900 dark:text-white px-4 py-2.5 rounded-xl text-sm font-medium border border-gray-200 dark:border-gray-700 transition-all">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 text-emerald-400">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m.75 12l3 3m0 0l3-3m-3 3v-6m-1.5-9H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                  </svg>
                  Export
                </button>
                {selectedProducts.size > 0 && (
                  <button onClick={() => setShowBulkConfirm(true)} className="flex items-center gap-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 px-4 py-2.5 rounded-xl text-sm font-medium border border-rose-500/20 transition-all">
                    🗑 Delete {selectedProducts.size} selected
                  </button>
                )}
                <button onClick={() => { setNewProduct({ name: "", image: "", description: "", price: "", stock: "", category: "", is_public: true, sku: "", cost_price: "", low_stock_threshold: "5", tags: "" }); setEditingProductId(null); setImageInputType("link"); setIsModalOpen(true); }} className="flex items-center gap-2 bg-white text-black px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-gray-200 transition-all shadow-[0_0_15px_rgba(255,255,255,0.1)]">
                  + New Product
                </button>
                <button onClick={() => setViewMode(v => v === "card" ? "excel" : "card")} className="flex items-center gap-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-900 dark:text-white px-4 py-2.5 rounded-xl text-sm font-medium border border-gray-200 dark:border-gray-700 transition-all">
                  {viewMode === "card" ? "🗃️ Excel Mode" : "🃏 Card Mode"}
                </button>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 mb-6">
              <div className="relative flex-1">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                <input type="text" placeholder="Search by name, description, category…" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl pl-10 pr-4 py-2.5 text-base md:text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:border-gray-400 dark:focus:border-gray-600 transition-colors" />
              </div>
              <div className="flex gap-2 flex-wrap">
                {(["all", "in_stock", "low", "out"] as const).map(f => (
                  <button key={f} onClick={() => setStockFilter(f)} className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-all whitespace-nowrap ${stockFilter === f ? "bg-indigo-500/15 text-indigo-600 dark:text-indigo-300 border-indigo-500/30" : "bg-gray-100 dark:bg-gray-900 text-gray-500 border-gray-200 dark:border-gray-800 hover:border-gray-400 dark:hover:border-gray-600"}`}>
                    {f === "all" ? "All" : f === "in_stock" ? "✅ In Stock" : f === "low" ? "⚠️ Low" : "❌ Out"}
                  </button>
                ))}
              </div>
              <select value={sortBy} onChange={e => setSortBy(e.target.value as typeof sortBy)} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl px-3 py-2.5 text-base md:text-sm text-gray-600 dark:text-gray-400 focus:outline-none focus:border-gray-400 dark:focus:border-gray-600 cursor-pointer">
                <option value="newest">Newest</option>
                <option value="price_asc">Price ↑</option>
                <option value="price_desc">Price ↓</option>
                <option value="stock_asc">Stock ↑</option>
                <option value="stock_desc">Stock ↓</option>
              </select>
            </div>

            {filteredProducts.length > 0 && (
              <div className="flex items-center gap-3 mb-4 px-1">
                <input type="checkbox" checked={selectedProducts.size > 0 && selectedProducts.size === paginatedProducts.length} onChange={toggleSelectAll} className="w-4 h-4 rounded accent-white cursor-pointer" />
                <span className="text-xs text-gray-500">
                  {selectedProducts.size > 0 ? `${selectedProducts.size} selected` : "Select all on page"}
                </span>
              </div>
            )}

            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[1, 2, 3].map(n => <div key={n} className="h-80 bg-gray-100 dark:bg-gray-900/50 rounded-2xl animate-pulse border border-gray-200 dark:border-gray-800" />)}
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="text-center py-20 bg-gray-50 dark:bg-gray-900/50 rounded-2xl border border-gray-200 dark:border-gray-800">
                <p className="text-4xl mb-3">🔍</p>
                <p className="text-gray-400">No products found.</p>
              </div>
            ) : (
              <>
                {viewMode === "excel" ? (
                  <div className="overflow-x-auto bg-white/80 dark:bg-gray-900/40 backdrop-blur-md border border-gray-200 dark:border-gray-800 rounded-2xl">
                    <table className="w-full text-sm text-left">
                      <thead className="text-xs text-gray-500 dark:text-gray-400 uppercase bg-gray-100 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-800">
                        <tr>
                          <th className="px-4 py-3 w-10">
                            <input type="checkbox" checked={selectedProducts.size > 0 && selectedProducts.size === paginatedProducts.length} onChange={toggleSelectAll} className="w-4 h-4 rounded accent-indigo-500 cursor-pointer" />
                          </th>
                          <th className="px-4 py-3 w-16">Img</th>
                          <th className="px-4 py-3">Name</th>
                          <th className="px-4 py-3">Category</th>
                          <th className="px-4 py-3 min-w-[200px]">Description</th>
                          <th className="px-4 py-3 w-24">Price</th>
                          <th className="px-4 py-3 w-24">Stock</th>
                          <th className="px-4 py-3 w-24">Visibility</th>
                          <th className="px-4 py-3 w-20">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedProducts.map((product) => (
                          <tr key={product.id} className={`border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors ${selectedProducts.has(product.id) ? "bg-indigo-500/5" : ""}`}>
                            <td className="px-4 py-3">
                              <input type="checkbox" checked={selectedProducts.has(product.id)} onChange={() => toggleSelectProduct(product.id)} className="w-4 h-4 rounded accent-indigo-500 cursor-pointer" />
                            </td>
                            <td className="px-4 py-3">
                              {product.image ? (
                                <div className="w-8 h-8 rounded relative overflow-hidden bg-gray-800">
                                  <Image src={product.image.replace('/object/public/', '/render/image/public/')} alt="" fill className="object-cover" unoptimized />
                                </div>
                              ) : <div className="w-8 h-8 rounded bg-gray-800 text-[10px] flex items-center justify-center text-gray-500">N/A</div>}
                            </td>
                            <td className="px-4 py-3">
                              <input
                                type="text"
                                defaultValue={product.name}
                                onBlur={(e) => e.target.value !== product.name && handleInlineUpdate(product.id, "name", e.target.value)}
                                className="bg-transparent border border-transparent hover:border-gray-300 dark:hover:border-gray-700 focus:border-indigo-500 focus:bg-gray-50 dark:focus:bg-gray-900 rounded px-2 py-1 w-full text-base md:text-sm text-gray-900 dark:text-white outline-none transition-all"
                              />
                            </td>
                            <td className="px-4 py-3">
                              <input
                                type="text"
                                defaultValue={product.category || ""}
                                onBlur={(e) => e.target.value !== (product.category || "") && handleInlineUpdate(product.id, "category", e.target.value)}
                                className="bg-transparent border border-transparent hover:border-gray-300 dark:hover:border-gray-700 focus:border-indigo-500 focus:bg-gray-50 dark:focus:bg-gray-900 rounded px-2 py-1 w-full text-base md:text-sm text-gray-900 dark:text-white outline-none transition-all"
                              />
                            </td>
                            <td className="px-4 py-3">
                              <textarea
                                rows={expandedDesc[`excel_${product.id}`] ? 4 : 1}
                                onClick={() => setExpandedDesc(prev => ({ ...prev, [`excel_${product.id}`]: true }))}
                                onBlur={(e) => {
                                  setExpandedDesc(prev => ({ ...prev, [`excel_${product.id}`]: false }));
                                  if (e.target.value !== (product.description || "")) {
                                    handleInlineUpdate(product.id, "description", e.target.value);
                                  }
                                }}
                                defaultValue={product.description || ""}
                                className="bg-transparent border border-transparent hover:border-gray-300 dark:hover:border-gray-700 focus:border-indigo-500 focus:bg-gray-50 dark:focus:bg-gray-900 rounded px-2 py-1 w-full text-base md:text-sm text-gray-900 dark:text-white outline-none transition-all resize-none block align-middle [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-gray-700 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-gray-600"
                              />
                            </td>
                            <td className="px-4 py-3">
                              <input
                                type="number"
                                defaultValue={product.price}
                                onBlur={(e) => parseFloat(e.target.value) !== product.price && handleInlineUpdate(product.id, "price", parseFloat(e.target.value) || 0)}
                                className="bg-transparent border border-transparent hover:border-gray-300 dark:hover:border-gray-700 focus:border-indigo-500 focus:bg-gray-50 dark:focus:bg-gray-900 rounded px-2 py-1 w-full text-base md:text-sm text-gray-900 dark:text-white outline-none transition-all"
                              />
                            </td>
                            <td className="px-4 py-3">
                              <input
                                type="number"
                                defaultValue={product.stock}
                                onBlur={(e) => parseInt(e.target.value, 10) !== product.stock && handleInlineUpdate(product.id, "stock", parseInt(e.target.value, 10) || 0)}
                                className="bg-transparent border border-transparent hover:border-gray-300 dark:hover:border-gray-700 focus:border-indigo-500 focus:bg-gray-50 dark:focus:bg-gray-900 rounded px-2 py-1 w-full text-base md:text-sm text-gray-900 dark:text-white outline-none transition-all"
                              />
                            </td>
                            <td className="px-4 py-3">
                              <button onClick={() => handleTogglePublic(product)}
                                className={`relative w-10 h-5 rounded-full transition-colors ${(product.is_public ?? true) ? "bg-emerald-500" : "bg-gray-600"}`}>
                                <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${(product.is_public ?? true) ? "translate-x-5" : "translate-x-0"}`} />
                              </button>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <button onClick={() => setProductToDelete(product.id)} className="text-rose-400 hover:text-rose-300 p-1">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {paginatedProducts.map(product => (
                      <div key={product.id} className={`group bg-white dark:bg-gray-900/40 backdrop-blur-md border rounded-2xl overflow-hidden transition-all duration-300 hover:shadow-2xl hover:shadow-black/10 dark:hover:shadow-black/50 flex flex-col ${selectedProducts.has(product.id) ? "border-indigo-500/50 ring-1 ring-indigo-500/30" : "border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700"}`}>
                        <div className="aspect-[4/3] w-full bg-gray-100 dark:bg-gray-800 relative overflow-hidden">
                        <div className="absolute top-3 left-3 z-10">
                          <input type="checkbox" checked={selectedProducts.has(product.id)} onChange={() => toggleSelectProduct(product.id)} className="w-4 h-4 rounded accent-indigo-500 cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()} />
                        </div>
                        {product.image ? (
                          <Image
                            key={product.image}
                            src={product.image.replace('/object/public/', '/render/image/public/')}
                            alt={product.name} 
                            fill
                            unoptimized
                            className="object-cover group-hover:scale-105 transition-transform duration-500" 
                            onError={(e) => { 
                              console.error('Image failed to load:', product.image);
                              (e.target as HTMLImageElement).src = "https://placehold.co/400x300/1f2937/9ca3af?text=Image+Not+Found"; 
                            }}
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-600 text-sm">No Image</div>
                        )}
                        {product.stock === 0 && (
                          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                            <span className="bg-rose-600/90 text-white text-xs font-bold px-3 py-1.5 rounded-full uppercase tracking-wider">Out of Stock</span>
                          </div>
                        )}
                        <div className="absolute top-3 right-3 bg-black/70 backdrop-blur-md text-white px-3 py-1 rounded-full text-sm font-bold border border-gray-700">
                          Rs {product.price.toLocaleString()}
                        </div>
                      </div>

                      <div className="p-5 flex flex-col flex-1">
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <h3 className="text-base font-bold text-gray-900 dark:text-white line-clamp-1">{product.name}</h3>
                          {product.category && (
                            <span className="text-[10px] shrink-0 font-semibold bg-indigo-500/10 text-indigo-400 px-2 py-0.5 rounded border border-indigo-500/20">{product.category}</span>
                          )}
                        </div>

                        {product.created_at && (
                          <p className="text-xs text-gray-500 mb-2 font-medium">
                            Added {new Date(product.created_at).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" })}
                          </p>
                        )}

                        <div className="mb-3 flex-1">
                          <p className={`text-sm text-gray-400 ${expandedDesc[product.id] ? "" : "line-clamp-2"}`}>
                            {product.description || "No description."}
                          </p>
                          {(product.description?.length || 0) > 80 && (
                            <button onClick={() => setExpandedDesc(prev => ({ ...prev, [product.id]: !prev[product.id] }))} className="text-xs text-indigo-400 hover:text-indigo-300 mt-1 transition-colors">
                              {expandedDesc[product.id] ? "Show less" : "Read more"}
                            </button>
                          )}
                        </div>

                        <div className="flex items-center gap-2 mb-4">
                          <button onClick={() => handleStockAdjust(product, -1)} disabled={product.stock === 0 || adjustingStockId === product.id} className="w-7 h-7 rounded-lg bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white flex items-center justify-center text-lg hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-30 transition-all">−</button>
                          <span className={`text-sm font-semibold min-w-[60px] text-center px-2 py-1 rounded-lg border ${product.stock === 0 ? "text-rose-400 bg-rose-500/10 border-rose-500/20" : product.stock <= 5 ? "text-amber-400 bg-amber-500/10 border-amber-500/20" : "text-emerald-400 bg-emerald-500/10 border-emerald-500/20"}`}>
                            {adjustingStockId === product.id ? "…" : `${product.stock} left`}
                          </span>
                          <button onClick={() => handleStockAdjust(product, 1)} disabled={adjustingStockId === product.id} className="w-7 h-7 rounded-lg bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white flex items-center justify-center text-lg hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-30 transition-all">+</button>
                        </div>

                        <div className="flex gap-2 pt-4 border-t border-gray-200 dark:border-gray-800/60">
                          <button onClick={() => handleTogglePublic(product)}
                            className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-all ${(product.is_public ?? true) ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20" : "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"}`}>
                            {(product.is_public ?? true) ? "Public" : "Private"}
                          </button>
                          <button onClick={() => handleEditClick(product)} className="flex-1 bg-gray-100 dark:bg-gray-800/80 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-900 dark:text-white py-2 rounded-xl text-sm font-medium transition-all border border-gray-200 dark:border-gray-700/50">Edit</button>
                          <button onClick={() => setProductToDelete(product.id)} className="flex-1 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 py-2 rounded-xl text-sm font-medium transition-all border border-rose-500/10">Delete</button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                )}

                {totalPages > 1 && (
                  <div className="flex justify-center items-center mt-10 gap-2 flex-wrap">
                    <button disabled={currentPage === 1} onClick={() => { setCurrentPage(p => p - 1); productsRef.current?.scrollIntoView({ behavior: "smooth" }); }} className="px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-800 text-sm text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-40 transition-all">Prev</button>
                    <div className="flex flex-wrap justify-center gap-1">
                      {(totalPages <= 5
                        ? Array.from({ length: totalPages }, (_, i) => i + 1)
                        : currentPage <= 3
                        ? [1, 2, 3, "...", totalPages]
                        : currentPage >= totalPages - 2
                        ? [1, "...", totalPages - 2, totalPages - 1, totalPages]
                        : [1, "...", currentPage, "...", totalPages]
                      ).map((page, index) => (
                        <button
                          key={index}
                          onClick={() => {
                            if (typeof page === "number") {
                              setCurrentPage(page);
                              productsRef.current?.scrollIntoView({ behavior: "smooth" });
                            }
                          }}
                          disabled={page === "..."}
                          className={`w-9 h-9 rounded-xl text-sm font-semibold transition-all ${
                            page === "..."
                              ? "text-gray-500 cursor-default"
                              : currentPage === page
                              ? "bg-gray-900 dark:bg-white text-white dark:text-black"
                              : "text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 border border-transparent hover:border-gray-200 dark:hover:border-gray-700"
                          }`}
                        >
                          {page}
                        </button>
                      ))}
                    </div>
                    <button disabled={currentPage === totalPages} onClick={() => { setCurrentPage(p => p + 1); productsRef.current?.scrollIntoView({ behavior: "smooth" }); }} className="px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-800 text-sm text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-40 transition-all">Next</button>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ══ ORDERS TAB ══════════════════════════════════════════════════════════ */}
        {activeSection === "orders" && (
          <div className="pt-2">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Client Orders</h2>
                <p className="text-gray-500 text-sm mt-0.5">{orders.length} total · {orders.filter(o => o.status === "pending").length} pending</p>
              </div>
              <button
                onClick={fetchOrders}
                className="flex items-center gap-2 text-sm bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-900 dark:text-white px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 transition-all"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0011.664 0M2.985 19.644A8.25 8.25 0 013 12a8.25 8.25 0 0115.023-5.455" />
                </svg>
                Refresh orders
              </button>
            </div>

            {/* Status summary chips */}
            <div className="flex flex-wrap gap-3 mb-6">
              {(["pending", "confirmed", "completed", "cancelled"] as const).map((s) => {
                const cnt = orders.filter(o => o.status === s).length;
                const colors: Record<string, string> = {
                  pending: "bg-amber-500/10 text-amber-400 border-amber-500/30",
                  confirmed: "bg-indigo-500/10 text-indigo-400 border-indigo-500/30",
                  completed: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
                  cancelled: "bg-rose-500/10 text-rose-400 border-rose-500/30",
                };
                return (
                  <div key={s} className={`px-4 py-2 rounded-xl border text-sm font-semibold capitalize ${colors[s]}`}>
                    {s} <span className="ml-1 opacity-70">{cnt}</span>
                  </div>
                );
              })}
            </div>

            {orders.length === 0 ? (
              <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-16 text-center">
                <p className="text-4xl mb-4">🛒</p>
                <p className="text-gray-400">No orders yet. They&apos;ll appear here in real time.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {orders.map((order, idx) => {
                  const statusColors: Record<string, string> = {
                    pending: "bg-amber-500/10 text-amber-400 border-amber-500/30",
                    confirmed: "bg-indigo-500/10 text-indigo-400 border-indigo-500/30",
                    completed: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
                    cancelled: "bg-rose-500/10 text-rose-400 border-rose-500/30",
                  };
                  const updateStatus = async (newStatus: ClientOrder["status"]) => {
                    setUpdatingOrderId(order.id);
                    const { error } = await supabase.from("orders").update({ status: newStatus }).eq("id", order.id);
                    if (!error) {
                      setOrders((prev) => prev.map((o) => o.id === order.id ? { ...o, status: newStatus } : o));
                      logActivity(`Order ${newStatus}`, order.product_name, "update");
                    } else {
                      showToast("Failed to update status", "error");
                    }
                    setUpdatingOrderId(null);
                  };
                  const isBusy = updatingOrderId === order.id;
                  return (
                    <div key={order.id} className={`bg-white dark:bg-gray-900 rounded-2xl border p-5 transition-all ${order.status === "pending" ? "border-amber-500/40" : "border-gray-200 dark:border-gray-800"}`}>
                      {/* Header row */}
                      <div className="flex items-start justify-between gap-3 mb-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-xs font-bold text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700 flex-shrink-0">
                            #{orders.length - idx}
                          </div>
                          <div>
                            <p className="font-bold text-gray-900 dark:text-white text-sm leading-tight">{order.product_name}</p>
                            <p className="text-xs text-gray-500 mt-0.5">{new Date(order.created_at).toLocaleString()}</p>
                          </div>
                        </div>
                        <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border capitalize flex-shrink-0 ${statusColors[order.status]}`}>
                          {order.status}
                        </span>
                      </div>

                      {/* Client info */}
                      <div className="bg-gray-100 dark:bg-gray-800/50 rounded-xl p-3 mb-4 grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <div>
                          <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-0.5">Name</p>
                          <p className="text-sm font-semibold text-gray-900 dark:text-white">{order.client_name}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-0.5">Email</p>
                          <p className="text-sm text-gray-600 dark:text-gray-300 truncate">{order.client_email}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-0.5">Phone</p>
                          <p className="text-sm text-gray-600 dark:text-gray-300">{order.client_phone || "—"}</p>
                        </div>
                      </div>

                      {/* Order details + actions */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-4">
                          <div>
                            <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-0.5">Amount</p>
                            <p className="text-base font-bold text-emerald-400">Rs {order.price.toLocaleString()}</p>
                          </div>
                          <div>
                            <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-0.5">Qty</p>
                            <p className="text-base font-bold text-gray-900 dark:text-white">{order.quantity}</p>
                          </div>
                          {order.notes && (
                            <div className="hidden sm:block">
                              <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-0.5">Notes</p>
                              <p className="text-xs text-gray-400 italic max-w-xs truncate">{order.notes}</p>
                            </div>
                          )}
                        </div>

                        {/* Action buttons */}
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {order.status === "pending" && (
                            <>
                              <button
                                onClick={() => updateStatus("confirmed")}
                                disabled={isBusy}
                                className="flex items-center gap-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-4 py-2 rounded-xl text-xs font-semibold transition-all disabled:opacity-50"
                              >
                                {isBusy ? <svg className="animate-spin w-3 h-3" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg> : "✓"} Confirm
                              </button>
                              <button
                                onClick={() => updateStatus("cancelled")}
                                disabled={isBusy}
                                className="flex items-center gap-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 px-4 py-2 rounded-xl text-xs font-semibold transition-all disabled:opacity-50"
                              >
                                ✕ Decline
                              </button>
                            </>
                          )}
                          {order.status === "confirmed" && (
                            <button
                              onClick={() => updateStatus("completed")}
                              disabled={isBusy}
                              className="flex items-center gap-1.5 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 px-4 py-2 rounded-xl text-xs font-semibold transition-all disabled:opacity-50"
                            >
                              {isBusy ? <svg className="animate-spin w-3 h-3" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg> : "✓"} Mark completed
                            </button>
                          )}
                          <button
                            onClick={() => setOrderToDelete(order.id)}
                            disabled={isBusy}
                            title="Delete order"
                            className="flex items-center justify-center w-8 h-8 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 transition-all disabled:opacity-40 flex-shrink-0"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="w-4 h-4">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                            </svg>
                          </button>
                        </div>
                      </div>

                      {order.notes && (
                        <p className="sm:hidden text-xs text-gray-400 italic mt-3 pt-3 border-t border-gray-800">{order.notes}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ══ SOCIAL TAB ══════════════════════════════════════════════════════════ */}
        {activeSection === "social" && (
          <div>
            <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4 pt-2">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Social Media Profiles</h2>
                <p className="text-gray-500 text-sm mt-0.5">Manage platform accounts and credentials</p>
              </div>
              <button onClick={() => { setNewSocial({ platform_name: "", platform_icon: "", profile_link: "", username: "", email: "", password: "", description: "", is_active: true, followers: "" }); setEditingSocialId(null); setIsSocialModalOpen(true); }} className="w-full md:w-auto bg-gradient-to-r from-indigo-500 to-purple-600 text-white px-6 py-3 rounded-xl font-semibold hover:opacity-90 hover:-translate-y-0.5 transition-all duration-200 shadow-[0_0_15px_rgba(99,102,241,0.2)]">
                + Add Social Info
              </button>
            </div>

            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-pulse">
                {[1, 2, 3].map(n => <div key={n} className="h-64 bg-gray-900/40 rounded-2xl border border-gray-800" />)}
              </div>
            ) : socialProfiles.length === 0 ? (
              <div className="text-center py-20 bg-gray-50 dark:bg-gray-900/50 rounded-2xl border border-gray-200 dark:border-gray-800">
                <p className="text-gray-400">No social media profiles added yet.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {socialProfiles.map(profile => (
                  <div key={profile.id} className="group bg-white/80 dark:bg-gray-900/40 backdrop-blur-md border border-gray-200 dark:border-gray-800 rounded-2xl p-5 hover:border-gray-700 transition-all duration-300 flex flex-col relative">
                    <button
                      onClick={() => handleToggleActive(profile)}
                      title={profile.is_active ? "Mark as inactive" : "Mark as active"}
                      className={`absolute top-4 right-4 w-5 h-5 rounded-full border-2 transition-all ${profile.is_active ? "bg-emerald-500 border-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.6)]" : "bg-gray-700 border-gray-600"}`}
                    />

                    <div className="flex items-center gap-4 mb-4 pr-8">
                      {profile.platform_icon ? (
                        <Image 
                          src={profile.platform_icon} 
                          alt={profile.platform_name} 
                          width={48} 
                          height={48} 
                          unoptimized 
                          className="rounded-xl object-cover bg-gray-800 border border-gray-700" 
                          onError={(e) => {
                            console.error('Social icon failed to load:', profile.platform_icon);
                            (e.target as HTMLImageElement).src = `https://placehold.co/48x48/1f2937/9ca3af?text=${profile.platform_name.charAt(0).toUpperCase()}`;
                          }}
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-gray-800 to-gray-700 border border-gray-600 flex items-center justify-center text-xl font-bold text-gray-300">{profile.platform_name.charAt(0).toUpperCase()}</div>
                      )}
                      <div className="overflow-hidden">
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white truncate">{profile.platform_name}</h3>
                        <a href={profile.profile_link?.startsWith("http") ? profile.profile_link : `https://${profile.profile_link}`} target="_blank" rel="noopener noreferrer" className="text-sm text-indigo-400 hover:text-indigo-300 truncate block transition-colors">Visit ↗</a>
                      </div>
                    </div>

                    {profile.description && <p className="text-sm text-gray-400 mb-3 line-clamp-2">{profile.description}</p>}

                    <div className="space-y-2 mb-4 flex-1 text-sm text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-950/50 p-3.5 rounded-xl border border-gray-200 dark:border-gray-800/50">
                      {profile.username && (
                        <div className="flex justify-between items-center gap-2">
                          <span className="text-gray-500 shrink-0">Username</span>
                          <div className="flex items-center gap-1.5 overflow-hidden">
                            <span className="font-medium truncate max-w-[100px]">{profile.username}</span>
                            <button onClick={() => copyToClipboard(profile.username, "Username")} className="text-gray-600 hover:text-white transition-colors text-xs shrink-0">📋</button>
                          </div>
                        </div>
                      )}
                      {profile.email && (
                        <div className="flex justify-between items-center gap-2">
                          <span className="text-gray-500 shrink-0">Email</span>
                          <div className="flex items-center gap-1.5 overflow-hidden">
                            <span className="font-medium truncate max-w-[100px]" title={profile.email}>{profile.email}</span>
                            <button onClick={() => copyToClipboard(profile.email, "Email")} className="text-gray-600 hover:text-white transition-colors text-xs shrink-0">📋</button>
                          </div>
                        </div>
                      )}
                      {profile.password !== undefined && (
                        <div className="flex justify-between items-center gap-2">
                          <span className="text-gray-500 shrink-0">Password</span>
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono bg-gray-900 px-2 py-0.5 rounded text-gray-400 max-w-[80px] overflow-hidden truncate">
                              {visiblePasswords[profile.id] ? profile.password || "—" : "••••••••"}
                            </span>
                            <button onClick={() => setVisiblePasswords(prev => ({ ...prev, [profile.id]: !prev[profile.id] }))} className="text-gray-500 hover:text-white text-xs transition-colors">
                              {visiblePasswords[profile.id] ? "🙈" : "👁️"}
                            </button>
                            {profile.password && <button onClick={() => copyToClipboard(profile.password!, "Password")} className="text-gray-600 hover:text-white text-xs transition-colors">📋</button>}
                          </div>
                        </div>
                      )}
                      {profile.followers != null && profile.followers > 0 && (
                        <div className="flex justify-between items-center">
                          <span className="text-gray-500">Followers</span>
                          <span className="font-semibold text-gray-200">{profile.followers.toLocaleString()}</span>
                        </div>
                      )}
                    </div>

                    <div className="flex gap-2 mt-auto">
                      <button onClick={() => copyToClipboard(`Email: ${profile.email}\nUsername: ${profile.username}\nPassword: ${profile.password}`, "All credentials")} className="flex-1 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-900 dark:text-white py-2 rounded-lg text-xs font-medium border border-gray-200 dark:border-gray-700 transition-all">Copy All</button>
                      <button onClick={() => handleEditSocial(profile)} className="flex-1 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-900 dark:text-white py-2 rounded-lg text-xs font-medium border border-gray-200 dark:border-gray-700 transition-all">Edit</button>
                      <button onClick={() => setSocialToDelete(profile.id)} className="flex-1 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 py-2 rounded-lg text-xs font-medium border border-rose-500/20 transition-all">Delete</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ══ UPDATES TAB ═════════════════════════════════════════════════════════ */}
        {activeSection === "updates" && (
          <div>
            <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4 pt-2">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Latest Updates</h2>
                <p className="text-gray-500 text-sm mt-0.5">Announcements, snippets, and important links</p>
              </div>
              <button onClick={() => { setNewUpdate({ info: "", content: "", link: "", priority: "low", type: "announcement" }); setEditingUpdateId(null); setIsUpdateModalOpen(true); }} className="w-full md:w-auto bg-gradient-to-r from-emerald-500 to-teal-600 text-white px-6 py-3 rounded-xl font-semibold hover:opacity-90 hover:-translate-y-0.5 transition-all duration-200 shadow-[0_0_15px_rgba(16,185,129,0.2)]">
                + Post Update
              </button>
            </div>

            {loading ? (
              <div className="space-y-4 animate-pulse">{[1, 2].map(n => <div key={n} className="h-32 bg-gray-900/40 rounded-2xl border border-gray-800" />)}</div>
            ) : updates.length === 0 ? (
              <div className="text-center py-20 bg-gray-50 dark:bg-gray-900/50 rounded-2xl border border-gray-200 dark:border-gray-800">
                <p className="text-gray-400">No updates posted yet.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {updates.map(update => (
                  <div key={update.id} className="group bg-white/80 dark:bg-gray-900/40 backdrop-blur-md border border-gray-200 dark:border-gray-800 rounded-2xl p-5 hover:border-gray-300 dark:hover:border-gray-700 transition-all relative flex flex-col md:flex-row gap-4">
                    {update.priority && (
                      <div className={`absolute top-0 right-0 text-[10px] font-bold uppercase px-2.5 py-1 rounded-bl-xl rounded-tr-xl border-l border-b ${priorityColors[update.priority]}`}>
                        {update.priority}
                      </div>
                    )}
                    <div className="flex-1 pr-12">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-base">{updateTypeIcons[update.type || "announcement"] || "📣"}</span>
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white">{update.info}</h3>
                        {update.type && (
                          <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded bg-gray-800 text-gray-400 border border-gray-700">{update.type}</span>
                        )}
                      </div>
                      {update.created_at && <p className="text-xs text-gray-600 mb-2">{new Date(update.created_at).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" })}</p>}
                      <p className="text-gray-300 whitespace-pre-wrap text-sm leading-relaxed mb-3">{update.content}</p>
                      {update.link && (
                        <a href={update.link.startsWith("http") ? update.link : `https://${update.link}`} target="_blank" rel="noopener noreferrer" className="text-emerald-400 hover:text-emerald-300 text-sm font-medium inline-flex items-center gap-1 bg-emerald-500/10 px-3 py-1.5 rounded-lg border border-emerald-500/20 w-fit transition-colors">
                          View Link ↗
                        </a>
                      )}
                    </div>
                    <div className="flex md:flex-col gap-2 justify-end items-end shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-gray-800">
                      <button onClick={() => handleEditUpdate(update)} className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 px-4 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 transition-all">Edit</button>
                      <button onClick={() => setUpdateToDelete(update.id)} className="text-sm text-rose-500 bg-rose-500/10 hover:bg-rose-500/20 px-4 py-1.5 rounded-lg border border-rose-500/20 transition-all">Delete</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ══ INVOICE TAB ═════════════════════════════════════════════════════════ */}
        {activeSection === "invoice" && (() => {
          // helper: compute invoice total
          const invTotal = (inv: InvoiceData) => {
            const sub  = sumRows(inv.parts) + sumLabour(inv.labour) + sumRows(inv.services);
            const disc = parseFloat(inv.discount || "0");
            const net  = sub - disc;
            return net + net * 0.15;
          };
          const isPaid = (inv: InvoiceData) => !!(inv.cash || inv.juice);

          // filters + sort
          const q = invoiceSearch.toLowerCase();
          let filtered = invoices.filter(inv => {
            const matchQ  = !q || inv.invoiceNo.toLowerCase().includes(q) || inv.customerName.toLowerCase().includes(q) || inv.tel.includes(q);
            const matchSt = invoiceStatusF === "all" || (invoiceStatusF === "paid" ? isPaid(inv) : !isPaid(inv));
            const d       = inv.date ? new Date(inv.date) : null;
            const matchF  = !invoiceDateFrom || (d && d >= new Date(invoiceDateFrom));
            const matchT  = !invoiceDateTo   || (d && d <= new Date(invoiceDateTo + "T23:59:59"));
            return matchQ && matchSt && matchF && matchT;
          });
          filtered = [...filtered].sort((a, b) => {
            if (invoiceSort === "date_desc") return new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime();
            if (invoiceSort === "date_asc")  return new Date(a.date || 0).getTime() - new Date(b.date || 0).getTime();
            if (invoiceSort === "name")      return a.customerName.localeCompare(b.customerName);
            if (invoiceSort === "total_desc") return invTotal(b) - invTotal(a);
            if (invoiceSort === "total_asc")  return invTotal(a) - invTotal(b);
            if (invoiceSort === "invno")     return a.invoiceNo.localeCompare(b.invoiceNo);
            return 0;
          });

          const totalRevenue  = invoices.reduce((s, inv) => s + invTotal(inv), 0);
          const paidCount     = invoices.filter(isPaid).length;
          const draftCount    = invoices.length - paidCount;

          // current preview totals
          const curSub   = sumRows(invoiceData.parts) + sumLabour(invoiceData.labour) + sumRows(invoiceData.services);
          const curDisc  = parseFloat(invoiceData.discount || "0");
          const curNet   = curSub - curDisc;
          const curTotal = curNet + curNet * 0.15;

          return (
            <div className="space-y-6">
              <style>{`
                @media print {
                  body > *:not(#print-root) { display: none !important; }
                  #print-root { display: block !important; }
                  #invoice-preview { width: 100%; }
                }
              `}</style>

              {/* ── Header ──────────────────────────────────────────────────── */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Invoices</h2>
                  <p className="text-gray-500 text-sm mt-0.5">Manage, search and export all invoices</p>
                </div>
                <button
                  onClick={() => { setInvoiceData(defaultInvoiceData()); setIsInvoiceModalOpen(true); }}
                  className="flex items-center gap-2 bg-cyan-500 hover:bg-cyan-400 text-black px-5 py-2.5 rounded-xl font-bold text-sm transition-all shadow-[0_0_16px_rgba(0,212,255,0.25)]">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
                  New Invoice
                </button>
              </div>

              {/* ── Aggregate stats ──────────────────────────────────────────── */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: "Total Invoices", val: invoices.length,                                                                   color: "text-cyan-600 dark:text-cyan-400",    bg: "bg-cyan-50 dark:bg-cyan-500/10 border-cyan-200 dark:border-cyan-500/20"       },
                  { label: "Total Revenue",  val: `Rs ${totalRevenue.toLocaleString("en-MU", { minimumFractionDigits: 0 })}`,        color: "text-emerald-600 dark:text-emerald-400",bg:"bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20"},
                  { label: "Paid",           val: paidCount,                                                                          color: "text-indigo-600 dark:text-indigo-400",  bg: "bg-indigo-50 dark:bg-indigo-500/10 border-indigo-200 dark:border-indigo-500/20"  },
                  { label: "Draft / Unpaid", val: draftCount,                                                                         color: "text-amber-600 dark:text-amber-400",  bg: "bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/20"    },
                ].map(s => (
                  <div key={s.label} className={`rounded-xl border p-4 ${s.bg}`}>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{s.label}</p>
                    <p className={`text-xl font-bold ${s.color}`}>{s.val}</p>
                  </div>
                ))}
              </div>

              {/* ── Invoice List ─────────────────────────────────────────────── */}
              <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden">
                {/* Toolbar */}
                <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 flex flex-wrap gap-2 items-center">
                  {/* Search */}
                  <div className="relative flex-1 min-w-[180px]">
                    <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                    <input
                      value={invoiceSearch} onChange={e => setInvoiceSearch(e.target.value)}
                      placeholder="Search by name, INV#, phone…"
                      className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl pl-9 pr-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/10 transition-all"
                    />
                  </div>
                  {/* Status filter */}
                  <div className="flex gap-1">
                    {(["all","paid","draft"] as const).map(s => (
                      <button key={s} onClick={() => setInvoiceStatusF(s)}
                        className={`px-3 py-2 text-xs font-medium rounded-lg border transition-all capitalize ${
                          invoiceStatusF === s
                            ? s === "paid"  ? "bg-emerald-50 dark:bg-emerald-500/10 border-emerald-300 dark:border-emerald-500/40 text-emerald-700 dark:text-emerald-400"
                            : s === "draft" ? "bg-amber-50 dark:bg-amber-500/10 border-amber-300 dark:border-amber-500/40 text-amber-700 dark:text-amber-400"
                            : "bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300"
                            : "bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                        }`}>{s}</button>
                    ))}
                  </div>
                  {/* Date range */}
                  <div className="flex items-center gap-1">
                    <input type="date" value={invoiceDateFrom} onChange={e => setInvoiceDateFrom(e.target.value)} title="From"
                      className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-2.5 py-2 text-xs text-gray-900 dark:text-white focus:outline-none focus:border-cyan-500 transition-all" />
                    <span className="text-gray-400 text-xs">→</span>
                    <input type="date" value={invoiceDateTo} onChange={e => setInvoiceDateTo(e.target.value)} title="To"
                      className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-2.5 py-2 text-xs text-gray-900 dark:text-white focus:outline-none focus:border-cyan-500 transition-all" />
                  </div>
                  {/* Sort */}
                  <select value={invoiceSort} onChange={e => setInvoiceSort(e.target.value as typeof invoiceSort)}
                    className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 text-xs text-gray-900 dark:text-white focus:outline-none focus:border-cyan-500 transition-all">
                    <option value="date_desc">Newest first</option>
                    <option value="date_asc">Oldest first</option>
                    <option value="name">Customer A–Z</option>
                    <option value="invno">INV# A–Z</option>
                    <option value="total_desc">Highest total</option>
                    <option value="total_asc">Lowest total</option>
                  </select>
                  {(invoiceSearch || invoiceStatusF !== "all" || invoiceDateFrom || invoiceDateTo) && (
                    <button onClick={() => { setInvoiceSearch(""); setInvoiceStatusF("all"); setInvoiceDateFrom(""); setInvoiceDateTo(""); }}
                      className="px-3 py-2 text-xs text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-900 transition-all">
                      Clear
                    </button>
                  )}
                  <p className="text-xs text-gray-400 ml-1">{filtered.length} result{filtered.length !== 1 ? "s" : ""}</p>
                </div>

                {/* Table */}
                {filtered.length === 0 ? (
                  <div className="py-16 text-center">
                    <p className="text-3xl mb-3">📄</p>
                    <p className="text-sm text-gray-400 mb-4">{invoices.length === 0 ? "No invoices yet" : "No results match your filters"}</p>
                    {invoices.length === 0 && (
                      <button onClick={() => setIsInvoiceModalOpen(true)}
                        className="px-5 py-2 text-sm bg-cyan-500 hover:bg-cyan-400 text-black font-bold rounded-xl transition-all">
                        Create First Invoice
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/60">
                          {["INV #","Date","Due","Customer","Phone","Device","Total","Status","Actions"].map(h => (
                            <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {filtered.map((inv, i) => {
                          const paid  = isPaid(inv);
                          const total = invTotal(inv);
                          const isLoaded = invoiceData.id === inv.id;
                          return (
                            <tr key={inv.id}
                              className={`border-b border-gray-50 dark:border-gray-800/40 transition-colors cursor-pointer ${
                                isLoaded
                                  ? "bg-cyan-50 dark:bg-cyan-500/5 hover:bg-cyan-50 dark:hover:bg-cyan-500/10"
                                  : i % 2 === 1 ? "bg-gray-50/40 dark:bg-gray-900/20 hover:bg-gray-100 dark:hover:bg-gray-800/40"
                                               : "hover:bg-gray-50 dark:hover:bg-gray-800/30"
                              }`}
                              onClick={() => { setInvoiceData(inv); showToast(`Loaded ${inv.invoiceNo || "invoice"}`, "success"); }}>
                              <td className="px-4 py-3 whitespace-nowrap">
                                <span className={`font-bold text-sm ${isLoaded ? "text-cyan-600 dark:text-cyan-400" : "text-gray-900 dark:text-white"}`}>
                                  {inv.invoiceNo || <span className="text-gray-400 font-normal italic">—</span>}
                                </span>
                                {isLoaded && <span className="ml-1.5 text-[9px] font-bold text-cyan-500 bg-cyan-100 dark:bg-cyan-500/20 px-1.5 py-0.5 rounded-full uppercase">loaded</span>}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-xs text-gray-600 dark:text-gray-300">
                                {inv.date ? new Date(inv.date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "2-digit" }) : <span className="text-gray-400">—</span>}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-xs text-gray-500">
                                {inv.due ? new Date(inv.due).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "2-digit" }) : <span className="text-gray-400">—</span>}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap">
                                <p className="font-medium text-gray-900 dark:text-white text-sm">{inv.customerName || <span className="text-gray-400 italic font-normal">Unknown</span>}</p>
                                {inv.email && <p className="text-[10px] text-gray-400 truncate max-w-[140px]">{inv.email}</p>}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-xs text-gray-500 font-mono">{inv.tel || "—"}</td>
                              <td className="px-4 py-3 whitespace-nowrap">
                                <p className="text-sm text-cyan-600 dark:text-cyan-400">{inv.device || <span className="text-gray-400 italic font-normal">—</span>}</p>
                                {inv.serial && <p className="text-[10px] text-gray-400 font-mono">{inv.serial}</p>}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap font-bold text-gray-900 dark:text-white">
                                Rs {total.toLocaleString("en-MU", { minimumFractionDigits: 0 })}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap">
                                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${
                                  paid
                                    ? "bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/40 text-emerald-700 dark:text-emerald-400"
                                    : "bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/40 text-amber-700 dark:text-amber-400"
                                }`}>{paid ? "Paid" : "Draft"}</span>
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap">
                                <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
                                  {/* Edit */}
                                  <button title="Edit invoice"
                                    onClick={() => { setInvoiceData(inv); setIsInvoiceModalOpen(true); }}
                                    className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 transition-all">
                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                  </button>
                                  {/* Duplicate */}
                                  <button title="Duplicate"
                                    onClick={e => handleDuplicateInvoice(inv, e)}
                                    className="p-1.5 rounded-lg text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-500/10 transition-all">
                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                                  </button>
                                  {/* Export PDF */}
                                  <button title="Export PDF"
                                    onClick={async () => { setInvoiceData(inv); await new Promise(r => setTimeout(r, 80)); handleExportInvoice(); }}
                                    className="p-1.5 rounded-lg text-gray-400 hover:text-cyan-600 dark:hover:text-cyan-400 hover:bg-cyan-50 dark:hover:bg-cyan-500/10 transition-all">
                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                                  </button>
                                  {/* Delete */}
                                  <button title="Delete"
                                    onClick={() => setInvoiceToDelete(inv.id!)}
                                    className="p-1.5 rounded-lg text-gray-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-all">
                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                  </button>
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

              {/* ── Invoice Preview (only when data loaded) ──────────────────── */}
              {(invoiceData.customerName || invoiceData.device) && (
                <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden">
                  <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/40">
                    <div className="flex items-center gap-2.5">
                      <svg className="w-4 h-4 text-cyan-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                      <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                        Preview — {invoiceData.invoiceNo || "Draft"}
                        {invoiceData.customerName && <span className="text-gray-400 font-normal"> · {invoiceData.customerName}</span>}
                      </span>
                      <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">Rs {curTotal.toLocaleString("en-MU", { minimumFractionDigits: 0 })}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => setIsInvoiceModalOpen(true)}
                        className="text-xs text-gray-500 hover:text-gray-900 dark:hover:text-white border border-gray-200 dark:border-gray-700 px-3 py-1.5 rounded-lg transition-all hover:bg-gray-100 dark:hover:bg-gray-800">
                        Edit
                      </button>
                      <button onClick={() => { setInvoiceData(defaultInvoiceData()); showToast("Invoice cleared", "success"); }}
                        className="text-xs text-gray-500 hover:text-rose-400 border border-gray-200 dark:border-gray-700 hover:border-rose-400/40 px-3 py-1.5 rounded-lg transition-all">
                        Clear
                      </button>
                      <button onClick={handleExportInvoice} disabled={isExportingInvoice}
                        className="flex items-center gap-1.5 text-xs bg-cyan-500 hover:bg-cyan-400 text-black font-bold px-3.5 py-1.5 rounded-lg transition-all disabled:opacity-50">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                        {isExportingInvoice ? "Exporting…" : "Export PDF"}
                      </button>
                    </div>
                  </div>
                  <div className="overflow-x-auto bg-white p-4">
                    <div id="print-root"><InvoicePreview data={invoiceData} /></div>
                  </div>
                </div>
              )}
            </div>
          );
        })()}

        {/* ══ SETTINGS TAB ════════════════════════════════════════════════════════ */}
        {activeSection === "settings" && (
          <div className="pt-2 max-w-2xl space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">Account Settings</h2>
              <p className="text-gray-500 text-sm">Manage your profile and account details.</p>
            </div>

            {/* Profile card */}
            {loading ? (
              <div className="h-32 bg-gray-100 dark:bg-gray-900/40 rounded-2xl border border-gray-200 dark:border-gray-800 animate-pulse" />
            ) : user ? (
              <div className="bg-white dark:bg-gray-900/40 border border-gray-200 dark:border-gray-800 rounded-2xl p-5">
                <div className="flex items-center gap-5">
                  {/* Avatar */}
                  <div className="relative flex-shrink-0">
                    {profile?.avatar_url ? (
                      <Image
                        src={profile.avatar_url}
                        alt={profile?.username || "Avatar"}
                        width={80}
                        height={80}
                        unoptimized
                        className="w-20 h-20 rounded-2xl object-cover ring-2 ring-gray-200 dark:ring-gray-700"
                      />
                    ) : (
                      <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white text-3xl font-bold ring-2 ring-gray-200 dark:ring-gray-700">
                        {(profile?.username || user?.email?.split("@")[0] || "U")[0].toUpperCase()}
                      </div>
                    )}
                    <a
                      href="/profile"
                      className="absolute -bottom-1.5 -right-1.5 w-6 h-6 bg-indigo-600 hover:bg-indigo-700 rounded-full flex items-center justify-center shadow-sm transition-colors"
                      title="Edit avatar"
                    >
                      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" /></svg>
                    </a>
                  </div>
                  {/* Info */}
                  <div className="min-w-0 flex-1">
                    <p className="text-lg font-bold text-gray-900 dark:text-white truncate">{profile?.full_name || profile?.username || user?.email?.split("@")[0]}</p>
                    <p className="text-sm text-gray-500 truncate">{user?.email}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-xs font-medium px-2.5 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-500/30">Admin</span>
                      {profile?.username && <span className="text-xs text-gray-400">@{profile.username}</span>}
                    </div>
                  </div>
                  {/* Visit public profile link */}
                  <a href="/profile" className="hidden sm:flex items-center gap-1.5 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex-shrink-0">
                    Edit full profile
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" /></svg>
                  </a>
                </div>
              </div>
            ) : null}

            {/* Username form */}
            {user && (
              <UpdateUsername userId={user.id} currentUsername={profile?.username || null} onUpdate={() => fetchUserProfile(user.id)} />
            )}

            {/* Account info */}
            <div className="bg-white dark:bg-gray-900/40 border border-gray-200 dark:border-gray-800 rounded-2xl divide-y divide-gray-100 dark:divide-gray-800">
              {[
                { label: "Email", value: user?.email || "—" },
                { label: "User ID", value: user?.id?.slice(0, 16) + "…" || "—" },
                { label: "Account Created", value: user?.created_at ? new Date(user.created_at).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }) : "—" },
                { label: "Last Sign In", value: user?.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" }) : "—" },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-center justify-between px-5 py-3.5">
                  <span className="text-sm text-gray-500">{label}</span>
                  <span className="text-sm font-medium text-gray-900 dark:text-white font-mono text-right max-w-[60%] truncate">{value}</span>
                </div>
              ))}
            </div>

            {/* ── Site Settings ─────────────────────────────────────────────── */}
            <div>
              <h3 className="text-base font-bold text-gray-900 dark:text-white mb-1">Site Settings</h3>
              <p className="text-sm text-gray-500 mb-4">These values appear live in the public footer and contact section.</p>
              <div className="bg-white dark:bg-gray-900/40 border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden">
                {/* Header */}
                <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/40">
                  <svg className="w-4 h-4 text-indigo-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" /></svg>
                  <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">Contact Info</span>
                  <span className="ml-auto text-xs text-gray-400">Saved to Supabase · reflects on next page load</span>
                </div>
                <div className="p-5 space-y-4">
                  {([
                    { key: "contact_address", label: "Address",  icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" /></svg>, placeholder: "Port Louis, Mauritius" },
                    { key: "contact_phone",   label: "Phone",    icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" /></svg>, placeholder: "+230 5800 0000" },
                    { key: "contact_email",   label: "Email",    icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" /></svg>, placeholder: "hello@techninja.mu" },
                    { key: "contact_hours",   label: "Hours",    icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>, placeholder: "Mon–Sat: 9am – 7pm" },
                    { key: "brand_tagline",   label: "Tagline",  icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" /></svg>, placeholder: "Premium electronics…" },
                  ] as const).map(({ key, label, icon, placeholder }) => (
                    <div key={key}>
                      <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">
                        <span className="text-indigo-400">{icon}</span>
                        {label}
                      </label>
                      {key === "brand_tagline" ? (
                        <textarea
                          rows={2}
                          value={siteSettings[key]}
                          onChange={e => setSiteSettings(prev => ({ ...prev, [key]: e.target.value }))}
                          placeholder={placeholder}
                          className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3.5 py-2.5 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 transition-all resize-none"
                        />
                      ) : (
                        <input
                          type="text"
                          value={siteSettings[key]}
                          onChange={e => setSiteSettings(prev => ({ ...prev, [key]: e.target.value }))}
                          placeholder={placeholder}
                          className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3.5 py-2.5 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 transition-all"
                        />
                      )}
                    </div>
                  ))}
                </div>
                {/* Footer */}
                <div className="px-5 py-3.5 border-t border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/40 flex items-center justify-between gap-3">
                  {siteSettingsMsg ? (
                    <p className={`text-xs font-medium ${siteSettingsMsg.ok ? "text-emerald-600 dark:text-emerald-400" : "text-rose-500"}`}>{siteSettingsMsg.text}</p>
                  ) : (
                    <p className="text-xs text-gray-400">Changes go live on next visitor page load.</p>
                  )}
                  <button
                    onClick={saveSiteSettings}
                    disabled={siteSettingsSaving}
                    className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-all flex-shrink-0"
                  >
                    {siteSettingsSaving ? (
                      <>
                        <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
                        Saving…
                      </>
                    ) : "Save Changes"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ══ ACTIVITY LOG TAB ════════════════════════════════════════════════════ */}
        {activeSection === "log" && (
          <div className="pt-2">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Activity Log</h2>
                <p className="text-gray-500 text-sm mt-0.5">In-session action trail (resets on page reload)</p>
              </div>
              {activityLog.length > 0 && (
                <button onClick={() => setActivityLog([])} className="text-sm text-gray-500 hover:text-rose-400 px-3 py-1.5 rounded-lg border border-gray-800 hover:border-rose-500/30 transition-all">Clear log</button>
              )}
            </div>
            {activityLog.length === 0 ? (
              <div className="text-center py-20 bg-gray-50 dark:bg-gray-900/50 rounded-2xl border border-gray-200 dark:border-gray-800">
                <p className="text-3xl mb-3">🕐</p>
                <p className="text-gray-400">No activity yet. Start managing your data!</p>
              </div>
            ) : (
              <div className="space-y-2">
                {activityLog.map(entry => (
                  <div key={entry.id} className="flex items-start gap-4 bg-white dark:bg-gray-900/40 border border-gray-200 dark:border-gray-800 rounded-xl px-4 py-3 hover:border-gray-300 dark:hover:border-gray-700 transition-colors">
                    <span className={`text-xs font-bold uppercase px-2 py-0.5 rounded border mt-0.5 shrink-0 ${logTypeColors[entry.type]}`}>{entry.type}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-900 dark:text-white font-medium">{entry.action}</p>
                      <p className="text-xs text-gray-500 truncate">{entry.target}</p>
                    </div>
                    <span className="text-xs text-gray-600 shrink-0 mt-0.5">{entry.timestamp.toLocaleTimeString()}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ══ TOOLS TAB ══════════════════════════════════════════════════════════ */}
        {activeSection === "tools" && (
          <div className="pt-2">
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Tools & Modules</h2>
              <p className="text-gray-500 text-sm mt-0.5">Specialist systems connected to TechNinja</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {/* Repair Tickets */}
              <Link href="/dashboard/repairs"
                className="group bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 hover:border-cyan-500/40 rounded-2xl p-6 transition-all hover:shadow-[0_0_30px_rgba(6,182,212,0.08)] cursor-pointer block">
                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-2xl">🔧</div>
                  <svg className="w-4 h-4 text-gray-600 group-hover:text-cyan-500 transition-colors mt-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">Repair Tickets</h3>
                <p className="text-sm text-gray-400 mb-4">Create and manage device repair jobs with a full Kanban pipeline tracker — Received → Diagnosed → In Repair → Ready → Delivered.</p>
                <div className="flex flex-wrap gap-2">
                  {["Pipeline view", "Status history", "Priority flags", "Cost tracking"].map(f => (
                    <span key={f} className="text-xs px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">{f}</span>
                  ))}
                </div>
              </Link>

              {/* Phone Grading */}
              <Link href="/dashboard/grading"
                className="group bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 hover:border-emerald-500/40 rounded-2xl p-6 transition-all hover:shadow-[0_0_30px_rgba(16,185,129,0.08)] cursor-pointer block">
                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-2xl">📱</div>
                  <svg className="w-4 h-4 text-gray-600 group-hover:text-emerald-500 transition-colors mt-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">Phone Grading</h3>
                <p className="text-sm text-gray-400 mb-4">Grade trade-in phones with a structured checklist covering cosmetics, battery health and all functional tests. Auto-calculates A+ to F grade.</p>
                <div className="flex flex-wrap gap-2">
                  {["Auto-grade score", "Battery health", "Functional checks", "Trade-in value"].map(f => (
                    <span key={f} className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">{f}</span>
                  ))}
                </div>
              </Link>

              {/* Loyalty Program */}
              <Link href="/dashboard/loyalty"
                className="group bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 hover:border-yellow-500/40 rounded-2xl p-6 transition-all hover:shadow-[0_0_30px_rgba(234,179,8,0.08)] cursor-pointer block">
                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 rounded-xl bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center text-2xl">🏆</div>
                  <svg className="w-4 h-4 text-gray-600 group-hover:text-yellow-500 transition-colors mt-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">Loyalty Program</h3>
                <p className="text-sm text-gray-400 mb-4">Reward repeat customers with points. Bronze → Silver → Gold → Platinum tiers with full transaction history and point management.</p>
                <div className="flex flex-wrap gap-2">
                  {["4 tier levels", "Earn & redeem", "Transaction log", "Member cards"].map(f => (
                    <span key={f} className="text-xs px-2 py-0.5 rounded-full bg-yellow-500/10 text-yellow-400 border border-yellow-500/20">{f}</span>
                  ))}
                </div>
              </Link>

              {/* Inventory */}
              <Link href="/dashboard/inventory"
                className="group bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 hover:border-purple-500/40 rounded-2xl p-6 transition-all hover:shadow-[0_0_30px_rgba(168,85,247,0.08)] cursor-pointer block">
                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-2xl">🗃️</div>
                  <svg className="w-4 h-4 text-gray-600 group-hover:text-purple-500 transition-colors mt-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">Inventory Management</h3>
                <p className="text-sm text-gray-400 mb-4">Full inventory control with stock level alerts, category filtering, quick adjustments, grid and table views, and total stock value reporting.</p>
                <div className="flex flex-wrap gap-2">
                  {["Stock alerts", "Quick adjust", "Category filter", "Value tracking"].map(f => (
                    <span key={f} className="text-xs px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20">{f}</span>
                  ))}
                </div>
              </Link>
            </div>
          </div>
        )}
          </div>
        </main>
      </div>

      {/* ══ MODALS ══════════════════════════════════════════════════════════════ */}

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/75 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl w-full max-w-lg shadow-2xl max-h-[92vh] overflow-y-auto flex flex-col">
            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800 sticky top-0 bg-white dark:bg-gray-900 z-10 rounded-t-2xl">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-base">📦</div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">{editingProductId ? "Edit Product" : "Add New Product"}</h2>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-700 dark:hover:text-white transition-colors">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="p-6 space-y-5">
              {/* Basic info */}
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2.5">Basic Info</p>
                <div className="space-y-3">
                  <input type="text" placeholder="Product Name *" value={newProduct.name} onChange={e => setNewProduct({ ...newProduct, name: e.target.value })} className="w-full border border-gray-200 dark:border-gray-700 px-3 py-2.5 rounded-xl text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-800 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-colors text-sm" />
                  <div className="grid grid-cols-2 gap-3">
                    <input type="text" placeholder="Category" value={newProduct.category} onChange={e => setNewProduct({ ...newProduct, category: e.target.value })} className="w-full border border-gray-200 dark:border-gray-700 px-3 py-2.5 rounded-xl text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-800 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-colors text-sm" />
                    <input type="text" placeholder="SKU / Product Code" value={newProduct.sku} onChange={e => setNewProduct({ ...newProduct, sku: e.target.value })} className="w-full border border-gray-200 dark:border-gray-700 px-3 py-2.5 rounded-xl text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-800 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-colors text-sm" />
                  </div>
                  <textarea placeholder="Description" rows={2} className="w-full border border-gray-200 dark:border-gray-700 px-3 py-2.5 rounded-xl text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-800 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-colors text-sm resize-none" value={newProduct.description} onChange={e => setNewProduct({ ...newProduct, description: e.target.value })} />
                  <input type="text" placeholder="Tags (comma-separated, e.g. iphone, apple, used)" value={newProduct.tags} onChange={e => setNewProduct({ ...newProduct, tags: e.target.value })} className="w-full border border-gray-200 dark:border-gray-700 px-3 py-2.5 rounded-xl text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-800 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-colors text-sm" />
                  {newProduct.tags && (
                    <div className="flex flex-wrap gap-1.5 px-1">
                      {newProduct.tags.split(",").map(t => t.trim()).filter(Boolean).map(tag => (
                        <span key={tag} className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-500 dark:text-indigo-400 border border-indigo-500/20">{tag}</span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Image */}
              <div>
                <div className="flex items-center justify-between mb-2.5">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Product Image</p>
                  <div className="flex gap-1 bg-gray-100 dark:bg-gray-800/50 p-0.5 rounded-lg border border-gray-200 dark:border-gray-700/50">
                    <button type="button" onClick={() => setImageInputType("link")} className={`text-xs px-2.5 py-1 rounded-md transition-colors ${imageInputType === "link" ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm" : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"}`}>Link</button>
                    <button type="button" onClick={() => setImageInputType("upload")} className={`text-xs px-2.5 py-1 rounded-md transition-colors ${imageInputType === "upload" ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm" : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"}`}>Upload</button>
                  </div>
                </div>
                {imageInputType === "link" ? (
                  <input type="text" placeholder="Image URL" value={newProduct.image} onChange={e => setNewProduct({ ...newProduct, image: e.target.value })} className="w-full border border-gray-200 dark:border-gray-700 px-3 py-2.5 rounded-xl text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-800 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-colors text-sm" />
                ) : (
                  <div className="relative">
                    <input type="file" accept="image/*" onChange={handleImageUpload} disabled={isUploadingImage} className="w-full border border-gray-200 dark:border-gray-700 px-3 py-2 rounded-xl text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-colors text-sm file:mr-4 file:py-1.5 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-indigo-500/10 file:text-indigo-400 hover:file:bg-indigo-500/20 disabled:opacity-50 cursor-pointer" />
                    {isUploadingImage && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-indigo-400 font-medium flex items-center gap-1.5">
                        <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25"></circle><path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" className="opacity-75"></path></svg>
                        Uploading...
                      </div>
                    )}
                  </div>
                )}
                {imageInputType === "upload" && newProduct.image && !isUploadingImage && (
                  <p className="text-xs text-emerald-500 mt-1.5 font-medium">✓ Image uploaded</p>
                )}
                {newProduct.image && (
                  <div className="relative w-full h-36 mt-2 bg-gray-100 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                    <Image src={newProduct.image.replace('/object/public/', '/render/image/public/')} alt="Preview" fill unoptimized className="object-contain" onError={(e) => { (e.target as HTMLImageElement).src = "https://placehold.co/400x300/1f2937/9ca3af?text=Broken+Link"; }} />
                    <button onClick={() => setNewProduct({ ...newProduct, image: "" })} className="absolute top-2 right-2 w-6 h-6 bg-black/60 hover:bg-black/80 text-white rounded-full flex items-center justify-center text-xs transition-colors">✕</button>
                  </div>
                )}
              </div>

              {/* Pricing */}
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2.5">Pricing</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Selling Price (Rs) *</label>
                    <input type="number" placeholder="0" value={newProduct.price} onChange={e => setNewProduct({ ...newProduct, price: e.target.value })} className="w-full border border-gray-200 dark:border-gray-700 px-3 py-2.5 rounded-xl text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-800 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-colors text-sm" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Cost Price (Rs)</label>
                    <input type="number" placeholder="0" value={newProduct.cost_price} onChange={e => setNewProduct({ ...newProduct, cost_price: e.target.value })} className="w-full border border-gray-200 dark:border-gray-700 px-3 py-2.5 rounded-xl text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-800 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-colors text-sm" />
                  </div>
                </div>
                {newProduct.price && newProduct.cost_price && parseFloat(newProduct.price) > 0 && parseFloat(newProduct.cost_price) > 0 && (() => {
                  const profit = parseFloat(newProduct.price) - parseFloat(newProduct.cost_price);
                  const margin = (profit / parseFloat(newProduct.price)) * 100;
                  return (
                    <div className={`mt-2 flex items-center gap-3 px-3 py-2 rounded-lg ${profit >= 0 ? "bg-emerald-500/8 border border-emerald-500/15" : "bg-red-500/8 border border-red-500/15"}`}>
                      <span className={`text-xs font-bold ${profit >= 0 ? "text-emerald-500 dark:text-emerald-400" : "text-red-500"}`}>{profit >= 0 ? "↑" : "↓"} Rs {Math.abs(profit).toLocaleString()} profit</span>
                      <span className="text-xs text-gray-500">{margin.toFixed(1)}% margin</span>
                    </div>
                  );
                })()}
              </div>

              {/* Stock */}
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2.5">Stock</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Current Stock</label>
                    <input type="number" placeholder="0" value={newProduct.stock} onChange={e => setNewProduct({ ...newProduct, stock: e.target.value })} className="w-full border border-gray-200 dark:border-gray-700 px-3 py-2.5 rounded-xl text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-800 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-colors text-sm" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Low-stock alert at</label>
                    <input type="number" placeholder="5" value={newProduct.low_stock_threshold} onChange={e => setNewProduct({ ...newProduct, low_stock_threshold: e.target.value })} className="w-full border border-gray-200 dark:border-gray-700 px-3 py-2.5 rounded-xl text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-800 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-colors text-sm" />
                  </div>
                </div>
              </div>

              {/* Visibility */}
              <div className={`flex items-center justify-between gap-4 p-3.5 rounded-xl border transition-colors ${newProduct.is_public ? "bg-emerald-500/5 border-emerald-500/20" : "bg-gray-100 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700"}`}>
                <div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">{newProduct.is_public ? "Public" : "Private"}</p>
                  <p className="text-xs text-gray-500">{newProduct.is_public ? "Visible to all clients" : "Hidden from clients"}</p>
                </div>
                <button type="button" onClick={() => setNewProduct({ ...newProduct, is_public: !newProduct.is_public })}
                  className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${newProduct.is_public ? "bg-emerald-500" : "bg-gray-300 dark:bg-gray-600"}`}>
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${newProduct.is_public ? "translate-x-5" : "translate-x-0"}`} />
                </button>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-800 flex justify-end gap-3 sticky bottom-0 bg-white dark:bg-gray-900 rounded-b-2xl">
              <button onClick={() => setIsModalOpen(false)} className="px-4 py-2 rounded-xl text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white border border-gray-200 dark:border-gray-700 transition-colors text-sm">Cancel</button>
              <button onClick={handleSaveProduct} disabled={isSaving || isUploadingImage} className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2 rounded-xl font-semibold transition-colors disabled:opacity-50 text-sm flex items-center gap-2">
                {isSaving && <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25"></circle><path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" className="opacity-75"></path></svg>}
                {isSaving ? "Saving…" : editingProductId ? "Update Product" : "Add Product"}
              </button>
            </div>
          </div>
        </div>
      )}

      {orderToDelete && (
        <div className="fixed inset-0 bg-black/75 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-6 rounded-2xl w-full max-w-sm shadow-2xl text-center">
            <div className="text-4xl mb-3">🗑️</div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Delete Order</h2>
            <p className="text-gray-500 mb-1 text-sm font-medium">{orders.find(o => o.id === orderToDelete)?.product_name}</p>
            <p className="text-gray-400 mb-6 text-sm">This cannot be undone.</p>
            <div className="flex justify-center gap-3">
              <button onClick={() => setOrderToDelete(null)} className="px-4 py-2 rounded-xl text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white border border-gray-200 dark:border-gray-700 transition-colors text-sm">Cancel</button>
              <button onClick={handleDeleteOrder} disabled={isDeletingOrder} className="bg-rose-600 hover:bg-rose-700 text-white px-5 py-2 rounded-xl font-semibold transition-colors disabled:opacity-50 text-sm">
                {isDeletingOrder ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {productToDelete && (
        <div className="fixed inset-0 bg-black/75 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-6 rounded-2xl w-full max-w-sm shadow-2xl text-center">
            <div className="text-4xl mb-3">🗑️</div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Delete Product</h2>
            <p className="text-gray-400 mb-6 text-sm">This action cannot be undone.</p>
            <div className="flex justify-center gap-3">
              <button onClick={() => setProductToDelete(null)} className="px-4 py-2 rounded-xl text-gray-400 hover:text-white transition-colors text-sm">Cancel</button>
              <button onClick={confirmDelete} disabled={isDeleting} className="bg-rose-600 hover:bg-rose-700 text-white px-5 py-2 rounded-xl font-semibold transition-colors disabled:opacity-50 text-sm">
                {isDeleting ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showBulkConfirm && (
        <div className="fixed inset-0 bg-black/75 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-6 rounded-2xl w-full max-w-sm shadow-2xl text-center">
            <div className="text-4xl mb-3">⚠️</div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Delete {selectedProducts.size} products?</h2>
            <p className="text-gray-400 mb-6 text-sm">This cannot be undone.</p>
            <div className="flex justify-center gap-3">
              <button onClick={() => setShowBulkConfirm(false)} className="px-4 py-2 rounded-xl text-gray-400 hover:text-white transition-colors text-sm">Cancel</button>
              <button onClick={handleBulkDelete} disabled={isBulkDeleting} className="bg-rose-600 hover:bg-rose-700 text-white px-5 py-2 rounded-xl font-semibold transition-colors disabled:opacity-50 text-sm">
                {isBulkDeleting ? "Deleting…" : "Delete All"}
              </button>
            </div>
          </div>
        </div>
      )}

      {isSocialModalOpen && (
        <div className="fixed inset-0 bg-black/75 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-6 rounded-2xl w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-5">{editingSocialId ? "Edit Social Profile" : "Add Social Info"}</h2>
            <div className="space-y-3">
              {[
                { placeholder: "Platform Name * (e.g. Instagram)", key: "platform_name", type: "text" },
                { placeholder: "Icon / Logo URL", key: "platform_icon", type: "text" },
                { placeholder: "Profile Link * (URL)", key: "profile_link", type: "text" },
                { placeholder: "Username", key: "username", type: "text" },
                { placeholder: "Email", key: "email", type: "email" },
                { placeholder: "Password", key: "password", type: "password" },
                { placeholder: "Followers count", key: "followers", type: "number" },
              ].map(f => (
                <input key={f.key} type={f.type} placeholder={f.placeholder} value={(newSocial as any)[f.key]} onChange={e => setNewSocial({ ...newSocial, [f.key]: e.target.value })} className="w-full border border-gray-200 dark:border-gray-700 px-3 py-2.5 rounded-xl text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-800 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-colors text-base md:text-sm" />
              ))}
              <textarea placeholder="Description or extra info" rows={2} className="w-full border border-gray-200 dark:border-gray-700 px-3 py-2.5 rounded-xl text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-800 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-colors text-base md:text-sm resize-y [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-gray-700 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-gray-600" value={newSocial.description} onChange={e => setNewSocial({ ...newSocial, description: e.target.value })} />
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" checked={newSocial.is_active} onChange={e => setNewSocial({ ...newSocial, is_active: e.target.checked })} className="w-4 h-4 appearance-none border border-gray-600 bg-transparent checked:bg-emerald-500 checked:border-emerald-500 cursor-pointer transition-all rounded flex items-center justify-center relative after:content-['✓'] after:text-white after:text-[10px] after:font-bold after:absolute after:top-1/2 after:left-1/2 after:-translate-x-1/2 after:-translate-y-1/2 after:opacity-0 checked:after:opacity-100" />
                <span className="text-sm text-gray-300">Mark as active</span>
              </label>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => setIsSocialModalOpen(false)} className="px-4 py-2 rounded-xl text-gray-400 hover:text-white transition-colors text-sm">Cancel</button>
              <button onClick={handleSaveSocial} disabled={isSavingSocial || !newSocial.platform_name || !newSocial.profile_link} className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2 rounded-xl font-semibold transition-colors disabled:opacity-50 text-sm">
                {isSavingSocial ? "Saving…" : "Save Info"}
              </button>
            </div>
          </div>
        </div>
      )}

      {socialToDelete && (
        <div className="fixed inset-0 bg-black/75 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-6 rounded-2xl w-full max-w-sm shadow-2xl text-center">
            <div className="text-4xl mb-3">🗑️</div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Delete Profile</h2>
            <p className="text-gray-400 mb-6 text-sm">This action cannot be undone.</p>
            <div className="flex justify-center gap-3">
              <button onClick={() => setSocialToDelete(null)} className="px-4 py-2 rounded-xl text-gray-400 hover:text-white transition-colors text-sm">Cancel</button>
              <button onClick={confirmDeleteSocial} disabled={isDeleting} className="bg-rose-600 hover:bg-rose-700 text-white px-5 py-2 rounded-xl font-semibold transition-colors disabled:opacity-50 text-sm">
                {isDeleting ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {isUpdateModalOpen && (
        <div className="fixed inset-0 bg-black/75 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-6 rounded-2xl w-full max-w-xl shadow-2xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-5">{editingUpdateId ? "Edit Update" : "Post New Update"}</h2>
            <div className="space-y-3">
              <input type="text" placeholder="Title / Info *" className="w-full border border-gray-200 dark:border-gray-700 px-3 py-2.5 rounded-xl text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-800 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-colors text-base md:text-sm" value={newUpdate.info} onChange={e => setNewUpdate({ ...newUpdate, info: e.target.value })} />
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="text-xs text-gray-500 mb-1 block uppercase tracking-wider">Type</label>
                  <div className="flex gap-2 flex-wrap">
                    {(["announcement", "feature", "fix"] as const).map(t => (
                      <button key={t} type="button" onClick={() => setNewUpdate({ ...newUpdate, type: t })} className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${newUpdate.type === t ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border-emerald-500/30" : "bg-gray-100 dark:bg-gray-800 text-gray-500 border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"}`}>
                        {updateTypeIcons[t]} {t}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex-1">
                  <label className="text-xs text-gray-500 mb-1 block uppercase tracking-wider">Priority</label>
                  <div className="flex gap-2 flex-wrap">
                    {(["low", "medium", "high"] as const).map(p => (
                      <button key={p} type="button" onClick={() => setNewUpdate({ ...newUpdate, priority: p })} className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all capitalize ${newUpdate.priority === p ? priorityColors[p] : "bg-gray-100 dark:bg-gray-800 text-gray-500 border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"}`}>
                        {p}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <textarea placeholder="Content / Snippets *" rows={6} className="w-full border border-gray-200 dark:border-gray-700 px-3 py-2.5 rounded-xl text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-800 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-colors text-base md:text-sm resize-y [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-gray-700 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-gray-600" value={newUpdate.content} onChange={e => setNewUpdate({ ...newUpdate, content: e.target.value })} />
              <input type="text" placeholder="Relevant Link (optional)" className="w-full border border-gray-200 dark:border-gray-700 px-3 py-2.5 rounded-xl text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-800 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-colors text-base md:text-sm" value={newUpdate.link} onChange={e => setNewUpdate({ ...newUpdate, link: e.target.value })} />
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => setIsUpdateModalOpen(false)} className="px-4 py-2 rounded-xl text-gray-400 hover:text-white transition-colors text-sm">Cancel</button>
              <button onClick={handleSaveUpdate} disabled={isSavingUpdate || !newUpdate.info || !newUpdate.content} className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2 rounded-xl font-semibold transition-colors disabled:opacity-50 text-sm">
                {isSavingUpdate ? "Saving…" : "Post Update"}
              </button>
            </div>
          </div>
        </div>
      )}

      {updateToDelete && (
        <div className="fixed inset-0 bg-black/75 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-6 rounded-2xl w-full max-w-sm shadow-2xl text-center">
            <div className="text-4xl mb-3">🗑️</div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Delete Update</h2>
            <p className="text-gray-400 mb-6 text-sm">This action cannot be undone.</p>
            <div className="flex justify-center gap-3">
              <button onClick={() => setUpdateToDelete(null)} className="px-4 py-2 rounded-xl text-gray-400 hover:text-white transition-colors text-sm">Cancel</button>
              <button onClick={confirmDeleteUpdate} disabled={isDeleting} className="bg-rose-600 hover:bg-rose-700 text-white px-5 py-2 rounded-xl font-semibold transition-colors disabled:opacity-50 text-sm">
                {isDeleting ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {invoiceToDelete && (
        <div className="fixed inset-0 bg-black/75 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-6 rounded-2xl w-full max-w-sm shadow-2xl text-center">
            <div className="text-4xl mb-3">🗑️</div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Delete Invoice</h2>
            <p className="text-gray-400 mb-6 text-sm">This action cannot be undone.</p>
            <div className="flex justify-center gap-3">
              <button onClick={() => setInvoiceToDelete(null)} className="px-4 py-2 rounded-xl text-gray-400 hover:text-white transition-colors text-sm">Cancel</button>
              <button onClick={confirmDeleteInvoice} disabled={isDeleting} className="bg-rose-600 hover:bg-rose-700 text-white px-5 py-2 rounded-xl font-semibold transition-colors disabled:opacity-50 text-sm">
                {isDeleting ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {isLogoutModalOpen && (
        <div className="fixed inset-0 bg-black/75 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-6 rounded-2xl w-full max-w-sm shadow-2xl text-center">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Confirm Logout</h2>
            <p className="text-gray-400 mb-6 text-sm">Are you sure you want to log out?</p>
            <div className="flex justify-center gap-3">
              <button onClick={() => setIsLogoutModalOpen(false)} disabled={isLoggingOut} className="px-4 py-2 rounded-xl text-gray-400 hover:text-white transition-colors text-sm disabled:opacity-50">Cancel</button>
              <button onClick={confirmLogout} disabled={isLoggingOut} className="bg-rose-600 hover:bg-rose-700 text-white px-5 py-2 rounded-xl font-semibold transition-colors disabled:opacity-50 text-sm">
                {isLoggingOut ? "Logging out…" : "Logout"}
              </button>
            </div>
          </div>
        </div>
      )}

      {isInvoiceModalOpen && (
        <InvoiceFormModal
          data={invoiceData}
          onChange={setInvoiceData}
          onClose={() => setIsInvoiceModalOpen(false)}
          onExport={handleExportInvoice}
        onSave={handleSaveInvoice}
          isExporting={isExportingInvoice}
        isSaving={isSavingInvoice}
        activeEditors={activeEditors}
        />
      )}

      {toast && (
        <div className={`fixed bottom-6 right-6 z-[110] flex items-center gap-3 px-5 py-3.5 rounded-xl shadow-2xl transition-all duration-300 animate-in slide-in-from-bottom-5 ${toast.type === "success" ? "bg-emerald-50 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-500/30" : "bg-rose-50 dark:bg-rose-500/20 text-rose-700 dark:text-rose-200 border border-rose-300 dark:border-rose-500/30"}`}>
          <span className="text-xl">{toast.type === "success" ? "✅" : "❌"}</span>
          <span className="text-sm font-semibold">{toast.message}</span>
        </div>
      )}
    </div>
  );
}
