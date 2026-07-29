// @refresh reset
import { useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { X, Printer, ZoomIn, ZoomOut, Maximize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { useLocalStorage } from "@/hooks/useLocalStorage";

interface PrintPreviewModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  docType?: string;
  children: React.ReactNode;
}

const ZOOM_STEPS = [0.5, 0.65, 0.75, 0.9, 1.0, 1.1, 1.25, 1.5];
const ZOOM_LABELS: Record<number, string> = {
  0.5: "50%", 0.65: "65%", 0.75: "75%", 0.9: "90%",
  1.0: "100%", 1.1: "110%", 1.25: "125%", 1.5: "150%",
};

/* Portal target — ensures @media print isolation */
function getPrintPortal() {
  let el = document.getElementById("mystics-print-portal");
  if (!el) {
    el = document.createElement("div");
    el.id = "mystics-print-portal";
    document.body.appendChild(el);
  }
  return el;
}

export function PrintPreviewModal({
  open, onClose, title, subtitle, children,
}: PrintPreviewModalProps) {
  const [zoom, setZoom] = useLocalStorage<number>("print-preview-zoom", 0.9);
  const contentRef = useRef<HTMLDivElement>(null);

  /* keyboard: Esc to close, Ctrl+P to print */
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") { onClose(); return; }
      if ((e.ctrlKey || e.metaKey) && e.key === "p") {
        e.preventDefault();
        triggerPrint();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open]);

  const zoomIn  = () => setZoom(prev => ZOOM_STEPS[Math.min(ZOOM_STEPS.indexOf(prev) + 1, ZOOM_STEPS.length - 1)]);
  const zoomOut = () => setZoom(prev => ZOOM_STEPS[Math.max(ZOOM_STEPS.indexOf(prev) - 1, 0)]);
  const fitPage = () => setZoom(0.9);

  const triggerPrint = useCallback(() => {
    window.print();
  }, []);

  if (!open) return null;

  const modal = (
    <AnimatePresence>
      <motion.div
        key="print-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        className="fixed inset-0 z-[9000] flex flex-col bg-[#1a1a2e]"
        style={{ fontFamily: "system-ui, sans-serif" }}
      >
        {/* ── Toolbar ──────────────────────────────────────────────────────── */}
        <div className="flex items-center gap-3 px-4 py-2.5 bg-[#12122a] border-b border-white/10 shrink-0">
          {/* Title */}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white truncate">{title}</p>
            {subtitle && <p className="text-[11px] text-white/50 truncate">{subtitle}</p>}
          </div>

          {/* Zoom controls */}
          <div className="hidden sm:flex items-center gap-1 bg-white/10 rounded-lg p-1">
            <button
              onClick={zoomOut}
              disabled={zoom <= ZOOM_STEPS[0]}
              className="h-7 w-7 rounded flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ZoomOut className="h-3.5 w-3.5" />
            </button>
            <span className="text-[12px] font-mono text-white/80 w-10 text-center select-none">
              {ZOOM_LABELS[zoom] ?? `${Math.round(zoom * 100)}%`}
            </span>
            <button
              onClick={zoomIn}
              disabled={zoom >= ZOOM_STEPS[ZOOM_STEPS.length - 1]}
              className="h-7 w-7 rounded flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ZoomIn className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={fitPage}
              className="h-7 w-7 rounded flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 transition-colors ml-0.5"
              title="Fit to window (90%)"
            >
              <Maximize2 className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Print */}
          <Button
            size="sm"
            onClick={triggerPrint}
            className="gap-2 bg-blue-600 hover:bg-blue-500 text-white border-none h-8 text-sm"
          >
            <Printer className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Print / Save PDF</span>
            <span className="sm:hidden">Print</span>
          </Button>

          {/* Close */}
          <button
            onClick={onClose}
            className="h-8 w-8 rounded-lg flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* ── Hint bar ─────────────────────────────────────────────────────── */}
        <div className="hidden sm:flex items-center justify-center py-1.5 bg-[#0f0f1f] shrink-0">
          <p className="text-[11px] text-white/30">
            Press <kbd className="font-mono bg-white/10 px-1 rounded text-white/50">Ctrl+P</kbd> to print · <kbd className="font-mono bg-white/10 px-1 rounded text-white/50">Esc</kbd> to close
          </p>
        </div>

        {/* ── Scrollable canvas ─────────────────────────────────────────────── */}
        <div className="flex-1 overflow-auto p-6 sm:p-10">
          <div
            ref={contentRef}
            id="print-preview-content"
            className="mx-auto origin-top"
            style={{
              width: 794,
              transform: `scale(${zoom})`,
              transformOrigin: "top center",
              marginBottom: `${(zoom - 1) * 100}%`,
            }}
          >
            {children}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );

  return createPortal(modal, getPrintPortal());
}
