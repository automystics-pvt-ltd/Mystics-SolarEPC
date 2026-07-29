/**
 * ZoomControl — compact three-part zoom widget for the Topbar.
 *
 *   [A⁻]  [100%]  [A⁺]
 *
 * Clicking the percentage label opens a popover with all six presets.
 * Keyboard shortcuts (Ctrl+=, Ctrl+-, Ctrl+0) are wired in ZoomProvider.
 */
import { useState } from "react";
import { cn } from "@/lib/utils";
import { useZoom, ZOOM_LEVELS, ZOOM_LABELS, type ZoomLevel } from "@/lib/zoom";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";

export function ZoomControl() {
  const {
    zoom, zoomLabel, setZoom,
    increase, decrease,
    canIncrease, canDecrease,
  } = useZoom();
  const [open, setOpen] = useState(false);

  return (
    <div
      className="hidden lg:flex items-center rounded-lg border border-gray-200 dark:border-border bg-gray-50/80 dark:bg-muted overflow-hidden shrink-0 select-none"
      role="group"
      aria-label="UI zoom level"
    >
      {/* Decrease */}
      <button
        type="button"
        onClick={decrease}
        disabled={!canDecrease}
        title="Zoom out (Ctrl −)"
        aria-label="Zoom out"
        className={cn(
          "flex items-end justify-center gap-px h-8 w-7 transition-colors",
          canDecrease
            ? "text-gray-500 dark:text-muted-foreground hover:bg-gray-100 dark:hover:bg-muted/80 hover:text-gray-900 dark:hover:text-foreground"
            : "text-gray-300 dark:text-muted-foreground/30 cursor-not-allowed"
        )}
      >
        <span className="text-[12px] font-bold leading-none mb-[3px]">A</span>
        <span className="text-[8px] font-black leading-none mb-[2px]">−</span>
      </button>

      {/* Level selector */}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            title="Zoom level — click to change (Ctrl+0 to reset)"
            aria-label={`Zoom: ${zoomLabel}. Click to change.`}
            aria-haspopup="listbox"
            aria-expanded={open}
            className={cn(
              "flex items-center justify-center h-8 px-2 min-w-[42px]",
              "text-[11px] font-bold tabular-nums",
              "border-x border-gray-200 dark:border-border",
              "text-gray-600 dark:text-muted-foreground",
              "hover:bg-gray-100 dark:hover:bg-muted/80 hover:text-gray-900 dark:hover:text-foreground",
              "transition-colors",
              zoom !== 1.0 && "text-[#EA580C] dark:text-orange-400",
            )}
          >
            {zoomLabel}
          </button>
        </PopoverTrigger>

        <PopoverContent
          align="center"
          sideOffset={8}
          className="w-48 p-2 shadow-popover"
        >
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground px-1 pb-2">
            Zoom level
          </p>
          <div role="listbox" aria-label="Choose zoom level" className="grid grid-cols-3 gap-1">
            {(ZOOM_LEVELS as readonly ZoomLevel[]).map((level) => (
              <button
                key={level}
                role="option"
                aria-selected={zoom === level}
                type="button"
                onClick={() => { setZoom(level); setOpen(false); }}
                className={cn(
                  "h-9 rounded-md text-[11px] font-semibold transition-colors",
                  zoom === level
                    ? "bg-[#EA580C] text-white shadow-sm"
                    : "text-gray-700 dark:text-muted-foreground hover:bg-gray-100 dark:hover:bg-muted hover:text-gray-900 dark:hover:text-foreground"
                )}
              >
                {ZOOM_LABELS[level]}
              </button>
            ))}
          </div>
          <p className="mt-2 text-[9px] text-muted-foreground text-center tracking-wide">
            Ctrl&nbsp;+&nbsp;=&nbsp;&nbsp;·&nbsp;&nbsp;Ctrl&nbsp;−&nbsp;&nbsp;·&nbsp;&nbsp;Ctrl&nbsp;0
          </p>
        </PopoverContent>
      </Popover>

      {/* Increase */}
      <button
        type="button"
        onClick={increase}
        disabled={!canIncrease}
        title="Zoom in (Ctrl =)"
        aria-label="Zoom in"
        className={cn(
          "flex items-end justify-center gap-px h-8 w-7 transition-colors",
          canIncrease
            ? "text-gray-500 dark:text-muted-foreground hover:bg-gray-100 dark:hover:bg-muted/80 hover:text-gray-900 dark:hover:text-foreground"
            : "text-gray-300 dark:text-muted-foreground/30 cursor-not-allowed"
        )}
      >
        <span className="text-[14px] font-bold leading-none mb-[2px]">A</span>
        <span className="text-[9px] font-black leading-none mb-[1px]">+</span>
      </button>
    </div>
  );
}
