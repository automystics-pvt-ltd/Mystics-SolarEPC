/**
 * Unified Export Service — CSV, XLSX, JSON, XML, PDF, Print
 * Heavy libraries (jsPDF, xlsx) are dynamically imported so they don't
 * bloat the initial bundle — they load only when the user first exports.
 */

export type ExportFormat = "csv" | "xlsx" | "json" | "xml" | "pdf" | "print";

export interface ExportColumn {
  header: string;
  key: string;
  /** Approximate column width in characters for xlsx */
  width?: number;
  /** Optional value formatter receives raw cell value and full row */
  formatter?: (value: unknown, row: Record<string, unknown>) => string;
}

export interface ExportOptions {
  title: string;
  module: string;
  /** Base filename without extension or date — e.g. "Procurement_PurchaseOrders" */
  filename: string;
  columns: ExportColumn[];
  rows: Record<string, unknown>[];
  /** Human-readable filter summary shown in headers / metadata */
  filters?: string;
  format: ExportFormat;
  onProgress?: (pct: number) => void;
}

// ── Internal helpers ──────────────────────────────────────────────────────────

const today = () => new Date().toISOString().slice(0, 10);
const tsNow  = () => new Date().toLocaleString("en-IN");

function cellStr(row: Record<string, unknown>, col: ExportColumn): string {
  const raw = row[col.key];
  if (col.formatter) return col.formatter(raw, row);
  if (raw === null || raw === undefined) return "";
  return String(raw);
}

function buildFilename(base: string, ext: string): string {
  return `${base}_${today()}.${ext}`;
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a   = document.createElement("a");
  a.href     = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

// ── CSV ───────────────────────────────────────────────────────────────────────

function runCsv(opts: ExportOptions): void {
  const esc  = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const head = opts.columns.map((c) => esc(c.header)).join(",");
  const body = opts.rows
    .map((r) => opts.columns.map((c) => esc(cellStr(r, c))).join(","))
    .join("\n");
  const blob = new Blob(["\uFEFF" + head + "\n" + body], {
    type: "text/csv;charset=utf-8;",
  });
  triggerDownload(blob, buildFilename(opts.filename, "csv"));
}

// ── JSON ──────────────────────────────────────────────────────────────────────

function runJson(opts: ExportOptions): void {
  const payload = {
    title:        opts.title,
    module:       opts.module,
    generatedAt:  new Date().toISOString(),
    filters:      opts.filters ?? null,
    totalRecords: opts.rows.length,
    records:      opts.rows.map((r) => {
      const rec: Record<string, unknown> = {};
      for (const col of opts.columns) rec[col.key] = r[col.key] ?? null;
      return rec;
    }),
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json",
  });
  triggerDownload(blob, buildFilename(opts.filename, "json"));
}

// ── XML ───────────────────────────────────────────────────────────────────────

function runXml(opts: ExportOptions): void {
  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const safeTag = (s: string) => s.replace(/[^a-zA-Z0-9_]/g, "_") || "Field";

  const records = opts.rows
    .map((r) => {
      const fields = opts.columns
        .map((c) => `    <${safeTag(c.key)}>${esc(cellStr(r, c))}</${safeTag(c.key)}>`)
        .join("\n");
      return `  <Record>\n${fields}\n  </Record>`;
    })
    .join("\n");

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    "<Export>",
    "  <Metadata>",
    `    <Title>${esc(opts.title)}</Title>`,
    `    <Module>${esc(opts.module)}</Module>`,
    `    <GeneratedAt>${new Date().toISOString()}</GeneratedAt>`,
    `    <Filters>${esc(opts.filters ?? "None")}</Filters>`,
    `    <TotalRecords>${opts.rows.length}</TotalRecords>`,
    "  </Metadata>",
    "  <Records>",
    records,
    "  </Records>",
    "</Export>",
  ].join("\n");

  const blob = new Blob([xml], { type: "application/xml;charset=utf-8;" });
  triggerDownload(blob, buildFilename(opts.filename, "xml"));
}

// ── Print ─────────────────────────────────────────────────────────────────────

function runPrint(opts: ExportOptions): void {
  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const headers = opts.columns.map((c) => `<th>${esc(c.header)}</th>`).join("");
  const rows    = opts.rows
    .map((r) => `<tr>${opts.columns.map((c) => `<td>${esc(cellStr(r, c))}</td>`).join("")}</tr>`)
    .join("\n");

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${esc(opts.title)}</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:Arial,sans-serif;font-size:9.5pt;color:#222;padding:16mm 18mm}
    .hdr{border-bottom:2.5px solid #E85C0D;padding-bottom:10px;margin-bottom:14px;display:flex;justify-content:space-between;align-items:flex-end}
    .brand{font-size:15pt;font-weight:900;color:#0A0F2C;letter-spacing:.04em}
    .brand .o{color:#E85C0D}
    .title-wrap{text-align:right}
    .report-title{font-size:11.5pt;font-weight:700;color:#111}
    .meta{font-size:7.5pt;color:#777;margin-top:3px}
    table{width:100%;border-collapse:collapse;margin-top:4px}
    th{background:#0A0F2C;color:#fff;padding:5px 7px;text-align:left;font-size:7pt;font-weight:700;text-transform:uppercase;letter-spacing:.05em;white-space:nowrap}
    td{padding:4px 7px;font-size:8.5pt;border-bottom:1px solid #eee;vertical-align:top}
    tr:nth-child(even) td{background:#f8f9fa}
    .ftr{margin-top:14px;font-size:7pt;color:#bbb;text-align:right;border-top:1px solid #eee;padding-top:6px}
    @media print{@page{margin:10mm 14mm;size:A4 landscape}}
  </style>
</head>
<body>
  <div class="hdr">
    <div class="brand">AUTO<span class="o">MYSTICS</span></div>
    <div class="title-wrap">
      <div class="report-title">${esc(opts.title)}</div>
      <div class="meta">
        Generated: ${tsNow()}
        ${opts.filters ? ` &nbsp;·&nbsp; Filters: ${esc(opts.filters)}` : ""}
        &nbsp;·&nbsp; ${opts.rows.length.toLocaleString("en-IN")} records
      </div>
    </div>
  </div>
  <table>
    <thead><tr>${headers}</tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="ftr">Automystics Technologies &mdash; Confidential &mdash; Do not distribute</div>
</body>
</html>`;

  const win = window.open("", "_blank", "width=1200,height=800");
  if (!win) {
    alert("Please allow pop-ups for this site to use Print export.");
    return;
  }
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 600);
}

// ── XLSX ──────────────────────────────────────────────────────────────────────

async function runXlsx(opts: ExportOptions): Promise<void> {
  opts.onProgress?.(10);
  const XLSX = await import("xlsx");
  opts.onProgress?.(30);

  const ts  = tsNow();
  const pad = (n: number): unknown[] => Array(Math.max(0, n)).fill("");

  const meta: unknown[][] = [
    ["AUTOMYSTICS TECHNOLOGIES", ...pad(opts.columns.length - 1)],
    [opts.title,                 ...pad(opts.columns.length - 1)],
    [
      `Generated: ${ts}${opts.filters ? `  |  Filters: ${opts.filters}` : ""}`,
      ...pad(opts.columns.length - 1),
    ],
    pad(opts.columns.length),
    opts.columns.map((c) => c.header),
  ];

  const data: unknown[][] = opts.rows.map((r) =>
    opts.columns.map((c) => {
      const raw = r[c.key];
      if (c.formatter) return c.formatter(raw, r);
      if (raw === null || raw === undefined) return "";
      if (typeof raw === "number") return raw;
      return String(raw);
    })
  );

  opts.onProgress?.(60);

  const ws = XLSX.utils.aoa_to_sheet([...meta, ...data]);
  ws["!cols"] = opts.columns.map((c) => ({
    wch: Math.max(c.width ?? 0, c.header.length + 3, 10),
  }));
  // Freeze the 4 meta rows + header row (row index 5)
  (ws as any)["!freeze"] = { xSplit: 0, ySplit: 5 };

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Data");

  // Metadata sheet
  const metaWs = XLSX.utils.aoa_to_sheet([
    ["Property", "Value"],
    ["Report Title",    opts.title],
    ["Module",          opts.module],
    ["Generated At",    new Date().toISOString()],
    ["Filters Applied", opts.filters ?? "None"],
    ["Total Records",   opts.rows.length],
  ]);
  metaWs["!cols"] = [{ wch: 22 }, { wch: 55 }];
  XLSX.utils.book_append_sheet(wb, metaWs, "Metadata");

  opts.onProgress?.(85);
  XLSX.writeFile(wb, buildFilename(opts.filename, "xlsx"));
  opts.onProgress?.(100);
}

// ── PDF ───────────────────────────────────────────────────────────────────────

async function runPdf(opts: ExportOptions): Promise<void> {
  opts.onProgress?.(10);
  const { jsPDF }              = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");
  opts.onProgress?.(35);

  const landscape = opts.columns.length > 6;
  const doc  = new jsPDF({ orientation: landscape ? "landscape" : "portrait", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.width;
  const ts    = tsNow();

  // Header bar
  doc.setFillColor(14, 15, 44);
  doc.rect(0, 0, pageW, 18, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(255, 255, 255);
  doc.text("AUTO", 12, 12);
  doc.setTextColor(232, 92, 13);
  doc.text("MYSTICS", 12 + doc.getTextWidth("AUTO"), 12);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(255, 255, 255);
  doc.text(opts.title.toUpperCase(), pageW - 12, 12, { align: "right" });

  // Meta row
  let metaY = 24;
  doc.setFontSize(7.5);
  doc.setTextColor(100, 100, 100);
  doc.text(`Generated: ${ts}`, 12, metaY);
  doc.text(`${opts.rows.length.toLocaleString("en-IN")} records`, pageW - 12, metaY, { align: "right" });
  if (opts.filters) {
    metaY += 5;
    doc.text(`Filters: ${opts.filters}`, 12, metaY);
  }

  opts.onProgress?.(55);

  autoTable(doc, {
    head: [opts.columns.map((c) => c.header)],
    body: opts.rows.map((r) => opts.columns.map((c) => cellStr(r, c))),
    startY: metaY + 8,
    headStyles: { fillColor: [14, 15, 44] as [number, number, number], textColor: 255, fontStyle: "bold", fontSize: 7 },
    bodyStyles: { fontSize: 7.5 },
    alternateRowStyles: { fillColor: [248, 249, 250] as [number, number, number] },
    styles: { cellPadding: 2.5, overflow: "linebreak" },
    didDrawPage: (data: any) => {
      const pages = (doc as any).getNumberOfPages?.() ?? "?";
      doc.setFontSize(6.5);
      doc.setTextColor(160, 160, 160);
      doc.text(
        `Generated: ${ts}  |  Page ${data.pageNumber ?? ""} of ${pages}  |  Automystics Technologies — Confidential`,
        pageW / 2,
        doc.internal.pageSize.height - 5,
        { align: "center" }
      );
    },
  });

  opts.onProgress?.(92);
  doc.save(buildFilename(opts.filename, "pdf"));
  opts.onProgress?.(100);
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function runExport(opts: ExportOptions): Promise<void> {
  if (!opts.rows.length) throw new Error("No data to export.");
  switch (opts.format) {
    case "csv":   return runCsv(opts);
    case "json":  return runJson(opts);
    case "xml":   return runXml(opts);
    case "print": return runPrint(opts);
    case "xlsx":  return runXlsx(opts);
    case "pdf":   return runPdf(opts);
    default:      throw new Error(`Unknown export format: ${opts.format}`);
  }
}

/** Legacy shim — keeps existing callers compiling without changes. */
export function exportToCsv(
  filename: string,
  headers: string[],
  rows: (string | number | null | undefined)[][]
): void {
  const esc = (v: string) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const csv = [headers, ...rows]
    .map((row) => row.map((v) => esc(String(v ?? ""))).join(","))
    .join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
