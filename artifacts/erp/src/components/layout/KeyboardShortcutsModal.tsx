import { SHORTCUT_GROUPS } from "@/lib/useGlobalShortcuts";
import { cn } from "@/lib/utils";
import { X, Keyboard } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useEffect } from "react";

interface Props { open: boolean; onClose: () => void }

export function KeyboardShortcutsModal({ open, onClose }: Props) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
            className="relative z-10 w-full max-w-lg bg-card border border-border rounded-2xl shadow-2xl overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center gap-3 px-5 py-4 border-b border-border">
              <div className="h-8 w-8 rounded-lg bg-orange-100 flex items-center justify-center">
                <Keyboard className="h-4 w-4 text-orange-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[14px] font-bold text-foreground">Keyboard Shortcuts</p>
                <p className="text-[11px] text-muted-foreground">Navigate faster without the mouse</p>
              </div>
              <button
                onClick={onClose}
                className="h-7 w-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Shortcut groups */}
            <div className="p-5 space-y-5 max-h-[60vh] overflow-y-auto scrollbar-thin">
              {SHORTCUT_GROUPS.map(group => (
                <div key={group.label}>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2.5">
                    {group.label}
                  </p>
                  <div className="space-y-1">
                    {group.shortcuts.map(s => (
                      <div key={s.description} className="flex items-center justify-between gap-4 py-1.5">
                        <span className="text-[13px] text-foreground">{s.description}</span>
                        <div className="flex items-center gap-1 shrink-0">
                          {s.keys.map((k, i) => (
                            <kbd
                              key={i}
                              className={cn(
                                "inline-flex items-center justify-center rounded-[5px] border border-border/80",
                                "bg-muted text-foreground font-mono font-bold shadow-sm",
                                k.length === 1 ? "h-6 min-w-[1.5rem] px-1.5 text-[11px]" : "h-6 px-2 text-[10px]"
                              )}
                            >
                              {k}
                            </kbd>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Footer hint */}
            <div className="px-5 py-3 border-t border-border bg-muted/30">
              <p className="text-[11px] text-muted-foreground text-center">
                Press <kbd className="px-1 py-0.5 rounded-[4px] bg-muted border border-border/70 font-mono text-[10px]">?</kbd> anywhere to toggle this guide
              </p>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
