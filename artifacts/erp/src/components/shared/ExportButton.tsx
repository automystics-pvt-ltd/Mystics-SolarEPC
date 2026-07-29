/**
 * ExportButton — a trigger button that opens the full-format ExportDialog.
 * Supports CSV, XLSX, JSON, XML, PDF, and Print.
 * Heavy libraries are loaded on demand inside runExport (no bundle impact).
 */
import { useState } from "react";
import {
  Download, FileSpreadsheet, FileText, FileCode2, Printer,
  Braces, AlignLeft, Loader2, Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { runExport, type ExportColumn, type ExportFormat } from "@/lib/export";
import { toast } from "sonner";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ExportConfig {
  /** Report title shown in headers / dialogs */
  title: string;
  /** ERP module name (e.g. "procurement") — used in metadata */
  module: string;
  /**
   * Base filename without extension or date.
   * Convention: "Module_ReportName"  →  saved as "Module_ReportName_YYYY-MM-DD.ext"
   */
  filename: string;
  columns: ExportColumn[];
  /** Called at export time so the config always gets the latest filtered rows */
  getRows: () => Record<string, unknown>[];
  /** Optional human-readable filter summary rendered in headers */
  filters?: string;
}

// ── Format catalogue ──────────────────────────────────────────────────────────

interface FormatMeta {
  id: ExportFormat;
  label: string;
  desc: string;
  ext: string;
  icon: React.ElementType;
  color: string;
}

const FORMATS: FormatMeta[] = [
  {
    id: "pdf",
    label: "PDF",
    desc: "Branded, print-ready report",
    ext: ".pdf",
    icon: FileText,
    color: "text-red-500",
  },
  {
    id: "xlsx",
    label: "Excel",
    desc: "Multi-sheet workbook with metadata",
    ext: ".xlsx",
    icon: FileSpreadsheet,
    color: "text-emerald-500",
  },
  {
    id: "csv",
    label: "CSV",
    desc: "Plain text, import-ready",
    ext: ".csv",
    icon: AlignLeft,
    color: "text-blue-500",
  },
  {
    id: "json",
    label: "JSON",
    desc: "Structured data with metadata envelope",
    ext: ".json",
    icon: Braces,
    color: "text-purple-500",
  },
  {
    id: "xml",
    label: "XML",
    desc: "Tagged records with metadata block",
    ext: ".xml",
    icon: FileCode2,
    color: "text-orange-500",
  },
  {
    id: "print",
    label: "Print",
    desc: "Opens a print-optimised preview",
    ext: "",
    icon: Printer,
    color: "text-slate-500",
  },
];

// ── ExportDialog ──────────────────────────────────────────────────────────────

function ExportDialog({
  open,
  onClose,
  config,
}: {
  open: boolean;
  onClose: () => void;
  config: ExportConfig;
}) {
  const [format, setFormat]     = useState<ExportFormat>("csv");
  const [progress, setProgress] = useState(0);
  const [busy, setBusy]         = useState(false);
  const [done, setDone]         = useState(false);

  const reset = () => {
    setFormat("csv");
    setProgress(0);
    setBusy(false);
    setDone(false);
  };

  const handleClose = () => {
    if (busy) return;
    reset();
    onClose();
  };

  const handleExport = async () => {
    const rows = config.getRows();
    if (!rows.length) {
      toast.error("No data to export — apply fewer filters or load more records.");
      return;
    }
    setBusy(true);
    setProgress(0);
    setDone(false);
    try {
      await runExport({
        title:    config.title,
        module:   config.module,
        filename: config.filename,
        columns:  config.columns,
        rows,
        filters:  config.filters,
        format,
        onProgress: setProgress,
      });
      setDone(true);
      if (format !== "print") {
        setTimeout(() => {
          reset();
          onClose();
        }, 900);
      } else {
        setBusy(false);
      }
    } catch (err) {
      toast.error(`Export failed: ${(err as Error).message}`);
      setBusy(false);
      setProgress(0);
    }
  };

  const today = new Date().toISOString().slice(0, 10);
  const selectedMeta = FORMATS.find((f) => f.id === format)!;
  const previewName = format === "print"
    ? `Print preview`
    : `${config.filename}_${today}${selectedMeta.ext}`;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Download className="h-4 w-4 text-[#E85C0D]" />
            Export — {config.title}
          </DialogTitle>
          <DialogDescription className="text-xs">
            Choose a format. The file will be saved to your downloads folder.
          </DialogDescription>
        </DialogHeader>

        {/* Format picker */}
        <div className="grid grid-cols-2 gap-2 mt-1">
          {FORMATS.map((f) => {
            const Icon    = f.icon;
            const active  = format === f.id;
            return (
              <button
                key={f.id}
                onClick={() => !busy && setFormat(f.id)}
                disabled={busy}
                className={cn(
                  "flex items-start gap-2.5 rounded-lg border p-3 text-left transition-all",
                  active
                    ? "border-[#E85C0D] bg-[#E85C0D]/5 ring-1 ring-[#E85C0D]/30"
                    : "border-border bg-card hover:border-border/80 hover:bg-accent/40",
                  busy && "opacity-60 cursor-not-allowed"
                )}
              >
                <Icon className={cn("h-4 w-4 mt-0.5 shrink-0", active ? "text-[#E85C0D]" : f.color)} />
                <div className="min-w-0">
                  <p className="text-xs font-semibold leading-tight">
                    {f.label}
                    {f.ext && (
                      <span className="ml-1 text-[10px] text-muted-foreground font-mono">{f.ext}</span>
                    )}
                  </p>
                  <p className="text-[10.5px] text-muted-foreground leading-tight mt-0.5 line-clamp-1">
                    {f.desc}
                  </p>
                </div>
              </button>
            );
          })}
        </div>

        {/* Output preview */}
        <div className="mt-1 rounded-md bg-muted/40 border border-border/50 px-3 py-2">
          <p className="text-[10.5px] text-muted-foreground">Output file</p>
          <p className="text-xs font-mono font-medium text-foreground mt-0.5 break-all">{previewName}</p>
        </div>

        {/* Progress */}
        {busy && (
          <div className="space-y-1.5">
            <Progress value={progress} className="h-1.5" />
            <p className="text-[10.5px] text-muted-foreground text-center">
              {progress < 100 ? `Generating… ${progress}%` : "Finalising…"}
            </p>
          </div>
        )}

        {/* Action row */}
        <div className="flex gap-2 mt-1">
          <Button
            variant="outline"
            size="sm"
            onClick={handleClose}
            disabled={busy}
            className="flex-1 h-9"
          >
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleExport}
            disabled={busy}
            className="flex-1 h-9 gap-2 bg-[#E85C0D] hover:bg-[#E85C0D]/90 text-white"
          >
            {done ? (
              <><Check className="h-4 w-4" /> Done</>
            ) : busy ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Exporting…</>
            ) : (
              <><Download className="h-4 w-4" /> Export</>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── ExportButton ──────────────────────────────────────────────────────────────

interface ExportButtonProps {
  config: ExportConfig;
  /** Button variant — default "outline" */
  variant?: "outline" | "ghost" | "default" | "secondary";
  size?: "sm" | "default" | "lg" | "icon";
  className?: string;
  /** Override button label. Default: "Export" */
  label?: string;
}

export function ExportButton({
  config,
  variant = "outline",
  size = "sm",
  className,
  label = "Export",
}: ExportButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        variant={variant}
        size={size}
        onClick={() => setOpen(true)}
        className={cn("gap-1.5", className)}
        aria-label={`Export ${config.title}`}
      >
        <Download className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">{label}</span>
      </Button>

      <ExportDialog
        open={open}
        onClose={() => setOpen(false)}
        config={config}
      />
    </>
  );
}
