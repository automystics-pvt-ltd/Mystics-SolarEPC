import { cn } from "@/lib/utils";
import { format } from "date-fns";

/* ── Company branding ──────────────────────────────────────────────────────── */
const COMPANY = {
  name:    "Automystics Technologies",
  sub:     "Solar EPC Operations",
  address: "Bengaluru, Karnataka · India",
  gstin:   "29AAACA0000A1Z5",
  website: "www.automystics.com",
};

/* ── A4 logo mark ──────────────────────────────────────────────────────────── */
function LogoMark() {
  return (
    <div
      style={{
        width: 44, height: 44, borderRadius: 10,
        background: "linear-gradient(135deg, #f97316, #ea580c)",
        display: "flex", alignItems: "center", justifyContent: "center",
        flexShrink: 0,
      }}
    >
      <svg width="22" height="22" viewBox="0 0 24 24" fill="white">
        <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
      </svg>
    </div>
  );
}

/* ── DocType badge strip ────────────────────────────────────────────────────── */
const DOC_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  "Purchase Order":    { bg: "#eff6ff", border: "#3b82f6", text: "#1d4ed8" },
  "Goods Received Note": { bg: "#f0fdf4", border: "#22c55e", text: "#166534" },
  "Vendor Invoice":    { bg: "#fefce8", border: "#eab308", text: "#854d0e" },
  "Quotation":         { bg: "#fdf4ff", border: "#a855f7", text: "#6b21a8" },
  "Return to Vendor":  { bg: "#fff1f2", border: "#f43f5e", text: "#9f1239" },
};

/* ── Shared table styles ────────────────────────────────────────────────────── */
export const tbl = {
  table:   "w-full border-collapse text-[11px]" as const,
  th:      "text-left font-bold uppercase tracking-wide py-2 px-3 border-b-2 border-gray-800 text-gray-700 bg-gray-100" as const,
  thR:     "text-right font-bold uppercase tracking-wide py-2 px-3 border-b-2 border-gray-800 text-gray-700 bg-gray-100" as const,
  thC:     "text-center font-bold uppercase tracking-wide py-2 px-3 border-b-2 border-gray-800 text-gray-700 bg-gray-100" as const,
  td:      "py-2 px-3 text-gray-800 border-b border-gray-100 align-top" as const,
  tdR:     "py-2 px-3 text-gray-800 border-b border-gray-100 text-right font-mono align-top" as const,
  tdC:     "py-2 px-3 text-gray-800 border-b border-gray-100 text-center align-top" as const,
  tdMono:  "py-2 px-3 text-gray-800 border-b border-gray-100 font-mono align-top" as const,
  stripOdd: "bg-gray-50/60" as const,
};

/* ── Section label ──────────────────────────────────────────────────────────── */
export function PrintSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{
        fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em",
        color: "#6b7280", borderBottom: "1.5px solid #e5e7eb", paddingBottom: 4, marginBottom: 10,
      }}>
        {title}
      </div>
      {children}
    </div>
  );
}

/* ── Meta grid ──────────────────────────────────────────────────────────────── */
export function MetaGrid({ rows }: { rows: { label: string; value: string | number | null | undefined; mono?: boolean; wide?: boolean; }[][] }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px 24px" }}>
      {rows.flat().map((r, i) => r.label ? (
        <div key={i} style={{ gridColumn: r.wide ? "1 / -1" : undefined }}>
          <span style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#9ca3af" }}>
            {r.label}
          </span>
          <p style={{
            fontSize: 11, color: "#111827", marginTop: 1,
            fontFamily: r.mono ? "monospace" : undefined,
          }}>
            {r.value ?? "—"}
          </p>
        </div>
      ) : null)}
    </div>
  );
}

/* ── Totals block ───────────────────────────────────────────────────────────── */
export function TotalsBlock({ rows }: { rows: { label: string; value: string; bold?: boolean; separator?: boolean; }[] }) {
  return (
    <div style={{ marginLeft: "auto", width: 280 }}>
      {rows.map((r, i) => (
        <div key={i}>
          {r.separator && <div style={{ borderTop: "1.5px solid #e5e7eb", marginBottom: 4 }} />}
          <div style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            padding: "3px 0",
          }}>
            <span style={{ fontSize: r.bold ? 12 : 11, fontWeight: r.bold ? 700 : 400, color: r.bold ? "#111827" : "#6b7280" }}>
              {r.label}
            </span>
            <span style={{
              fontSize: r.bold ? 13 : 11, fontWeight: r.bold ? 800 : 500,
              fontFamily: "monospace", color: r.bold ? "#111827" : "#374151",
            }}>
              {r.value}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── Status watermark ────────────────────────────────────────────────────────── */
const WATERMARK_STATUSES = ["Draft", "Cancelled", "Rejected", "OnHold"];
function Watermark({ status }: { status: string }) {
  if (!WATERMARK_STATUSES.includes(status)) return null;
  return (
    <div style={{
      position: "absolute", top: "50%", left: "50%",
      transform: "translate(-50%, -50%) rotate(-35deg)",
      fontSize: 96, fontWeight: 900, letterSpacing: 8,
      color: status === "Cancelled" || status === "Rejected" ? "rgba(239,68,68,0.07)" : "rgba(245,158,11,0.07)",
      pointerEvents: "none", userSelect: "none", whiteSpace: "nowrap",
      zIndex: 0,
    }}>
      {status.toUpperCase()}
    </div>
  );
}

/* ── Main layout ────────────────────────────────────────────────────────────── */
interface PrintDocumentLayoutProps {
  docType: string;
  docNumber: string;
  docStatus?: string;
  children: React.ReactNode;
}

export function PrintDocumentLayout({ docType, docNumber, docStatus = "", children }: PrintDocumentLayoutProps) {
  const colors = DOC_COLORS[docType] ?? DOC_COLORS["Purchase Order"];
  const now = format(new Date(), "dd MMM yyyy, HH:mm");

  return (
    <div
      id="print-document"
      style={{
        width: 794, minHeight: 1123, background: "white",
        fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif",
        color: "#111827", boxShadow: "0 4px 32px rgba(0,0,0,0.18)",
        position: "relative", overflow: "hidden",
        padding: 0,
      }}
    >
      {docStatus && <Watermark status={docStatus} />}

      {/* ── Letterhead ───────────────────────────────────────────────────── */}
      <div style={{
        padding: "24px 36px 20px",
        borderBottom: `3px solid ${colors.border}`,
        display: "flex", justifyContent: "space-between", alignItems: "flex-start",
        background: `linear-gradient(to right, ${colors.bg}, white)`,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <LogoMark />
          <div>
            <p style={{ fontSize: 15, fontWeight: 800, color: "#111827", lineHeight: 1.1 }}>
              {COMPANY.name}
            </p>
            <p style={{ fontSize: 10, color: "#6b7280", marginTop: 2 }}>{COMPANY.sub}</p>
            <p style={{ fontSize: 9, color: "#9ca3af", marginTop: 1 }}>
              GSTIN: {COMPANY.gstin} · {COMPANY.address}
            </p>
          </div>
        </div>

        <div style={{ textAlign: "right" }}>
          <div style={{
            display: "inline-block", padding: "3px 10px", borderRadius: 4,
            background: colors.border, color: "white",
            fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em",
            marginBottom: 6,
          }}>
            {docType}
          </div>
          <p style={{ fontSize: 20, fontWeight: 900, fontFamily: "monospace", color: "#111827" }}>
            {docNumber}
          </p>
          {docStatus && (
            <div style={{
              display: "inline-block", marginTop: 4, padding: "2px 8px",
              borderRadius: 12, fontSize: 9, fontWeight: 700,
              background: colors.bg, color: colors.text, border: `1px solid ${colors.border}`,
              textTransform: "uppercase", letterSpacing: "0.08em",
            }}>
              {docStatus}
            </div>
          )}
        </div>
      </div>

      {/* ── Content ──────────────────────────────────────────────────────── */}
      <div style={{ padding: "24px 36px 80px", position: "relative", zIndex: 1 }}>
        {children}
      </div>

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0,
        padding: "10px 36px", borderTop: "1px solid #f3f4f6",
        display: "flex", justifyContent: "space-between", alignItems: "center",
        background: "white",
      }}>
        <p style={{ fontSize: 9, color: "#9ca3af" }}>
          Generated {now} · {COMPANY.website} · This document is system-generated and valid without signature.
        </p>
        <p style={{ fontSize: 9, color: "#9ca3af" }}>Page 1</p>
      </div>
    </div>
  );
}
