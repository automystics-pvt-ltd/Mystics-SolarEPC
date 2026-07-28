import { useState, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { Download, Upload, FileText, CheckCircle2, AlertTriangle, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiPost } from "@/lib/fetch";
import { useToast } from "@/hooks/use-toast";

interface Props { table: string }

interface ImportPreview {
  dryRun: true;
  rowCount: number;
  columns: string[];
}

interface ImportResult {
  success: true;
  inserted: number;
}

function parseCsv(text: string): { columns: string[]; rows: Record<string, string>[] } {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 1) return { columns: [], rows: [] };
  const columns = lines[0].split(",").map(c => c.replace(/^"|"$/g, "").trim());
  const rows = lines.slice(1).map(line => {
    const parts = line.split(",").map(p => p.replace(/^"|"$/g, ""));
    const obj: Record<string, string> = {};
    columns.forEach((col, i) => { obj[col] = parts[i] ?? ""; });
    return obj;
  });
  return { columns, rows };
}

export default function ImportExportTab({ table }: Props) {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<{ columns: string[]; rows: Record<string, string>[]; parsed: Record<string, string>[] } | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [dryRunResult, setDryRunResult] = useState<ImportPreview | null>(null);

  // Export
  const handleExport = () => {
    const token = localStorage.getItem("mystics_token") ?? "";
    const url = `/api/db-admin/tables/${encodeURIComponent(table)}/export`;
    const a = document.createElement("a");
    a.href = url;
    a.download = `${table}.csv`;
    // Need auth header — fetch as blob
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.blob())
      .then(blob => {
        const blobUrl = URL.createObjectURL(blob);
        a.href = blobUrl;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(blobUrl);
        toast({ title: `Exported ${table}.csv` });
      })
      .catch(e => toast({ variant: "destructive", title: "Export failed", description: e.message }));
  };

  // File picked
  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const text = ev.target?.result as string;
      const { columns, rows } = parseCsv(text);
      setPreview({ columns, rows: rows.slice(0, 5), parsed: rows });
      setDryRunResult(null);
      setImportResult(null);
    };
    reader.readAsText(file);
  };

  // Dry run
  const handleDryRun = async () => {
    if (!preview) return;
    try {
      const result = await apiPost<ImportPreview>(`/db-admin/tables/${encodeURIComponent(table)}/import`, {
        rows: preview.parsed,
        dryRun: true,
      });
      setDryRunResult(result);
    } catch (e: any) {
      toast({ variant: "destructive", title: "Dry run failed", description: e.message });
    }
  };

  // Actual import
  const handleImport = async () => {
    if (!preview) return;
    setImporting(true);
    try {
      const result = await apiPost<ImportResult>(`/db-admin/tables/${encodeURIComponent(table)}/import`, {
        rows: preview.parsed,
        dryRun: false,
      });
      setImportResult(result);
      setPreview(null);
      setDryRunResult(null);
      toast({ title: `Imported ${result.inserted} rows into ${table}` });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Import failed", description: e.message });
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="p-6 space-y-8 overflow-y-auto h-full">
      {/* Export */}
      <section className="space-y-3">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Download className="h-4 w-4 text-blue-500" /> Export CSV
        </h3>
        <p className="text-xs text-muted-foreground">Download all rows from <strong>{table}</strong> as a CSV file (max 10,000 rows).</p>
        <Button size="sm" variant="outline" className="gap-2" onClick={handleExport}>
          <Download className="h-4 w-4" /> Export {table}.csv
        </Button>
      </section>

      <div className="border-t border-border/60" />

      {/* Import */}
      <section className="space-y-3">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Upload className="h-4 w-4 text-green-500" /> Import CSV
        </h3>
        <p className="text-xs text-muted-foreground">
          Upload a CSV file to insert rows into <strong>{table}</strong>. The first row must be column names.
        </p>

        <div
          className="border-2 border-dashed border-border rounded-xl p-6 text-center cursor-pointer hover:border-orange-300 hover:bg-orange-50/30 dark:hover:bg-orange-950/10 transition-colors"
          onClick={() => fileRef.current?.click()}
        >
          <FileText className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Click to select a CSV file</p>
          <p className="text-xs text-muted-foreground/60 mt-0.5">or drag and drop</p>
          <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleFile} />
        </div>

        {/* Preview */}
        {preview && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-muted-foreground">
                Preview (first 5 of {preview.parsed.length} rows)
              </p>
              <button onClick={() => { setPreview(null); setDryRunResult(null); if (fileRef.current) fileRef.current.value = ""; }} className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="rounded-lg border border-border overflow-auto max-h-40">
              <table className="w-full text-xs">
                <thead className="bg-muted/50 border-b border-border">
                  <tr>
                    {preview.columns.map(c => (
                      <th key={c} className="px-3 py-2 text-left font-semibold text-muted-foreground whitespace-nowrap">{c}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.map((row, i) => (
                    <tr key={i} className="border-b border-border/40 last:border-0">
                      {preview.columns.map(c => (
                        <td key={c} className="px-3 py-2 text-muted-foreground truncate max-w-[150px]">{row[c]}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Column mapping info */}
            <div className="text-xs text-muted-foreground">
              <span className="font-semibold">Columns detected:</span>{" "}
              {preview.columns.join(", ")}
            </div>

            {dryRunResult && (
              <div className="flex items-center gap-2 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 px-3 py-2.5 text-sm text-blue-700 dark:text-blue-400">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                Dry run: <strong>{dryRunResult.rowCount}</strong> rows would be inserted.
              </div>
            )}

            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" className="gap-2" onClick={handleDryRun}>
                <AlertTriangle className="h-3.5 w-3.5" /> Dry Run
              </Button>
              <Button
                size="sm"
                className="gap-2 bg-green-700 hover:bg-green-600 text-white"
                onClick={handleImport}
                disabled={importing}
              >
                {importing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                Import {preview.parsed.length} Rows
              </Button>
            </div>
          </div>
        )}

        {/* Result */}
        {importResult && (
          <div className="flex items-center gap-2 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 px-3 py-2.5 text-sm text-green-700 dark:text-green-400">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            Successfully imported <strong>{importResult.inserted}</strong> rows into <strong>{table}</strong>.
          </div>
        )}
      </section>
    </div>
  );
}
