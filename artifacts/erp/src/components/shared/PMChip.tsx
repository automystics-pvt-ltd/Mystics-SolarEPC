import { Mail, User2 } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface PMChipProps {
  name: string;
  email?: string | null;
  /** Visual size variant */
  size?: "sm" | "xs";
}

/**
 * Displays a PM avatar chip (initials + first name).
 * Tapping/clicking opens a small popover with the full name and email.
 */
export function PMChip({ name, email, size = "sm" }: PMChipProps) {
  const initials = name.charAt(0).toUpperCase();
  const firstName = name.split(" ")[0];

  const avatarSm = "h-5 w-5";
  const avatarXs = "h-4 w-4";
  const avatarSize = size === "xs" ? avatarXs : avatarSm;
  const textSize = size === "xs" ? "text-[8px]" : "text-[9px]";
  const labelSize = size === "xs" ? "text-[11px]" : "text-[11px]";

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-1 min-w-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
          aria-label={`PM: ${name}`}
          onClick={e => e.stopPropagation()}
          onPointerDown={e => e.stopPropagation()}
        >
          <div className={`${avatarSize} rounded-full bg-primary/10 flex items-center justify-center shrink-0`}>
            <span className={`${textSize} font-black text-primary leading-none`}>
              {initials}
            </span>
          </div>
          <span className={`${labelSize} text-muted-foreground truncate`}>
            {firstName}
          </span>
        </button>
      </PopoverTrigger>

      <PopoverContent
        side="bottom"
        align="start"
        sideOffset={6}
        className="w-56 p-0 overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 bg-muted/40 border-b border-border/60">
          <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <span className="text-[15px] font-black text-primary leading-none">
              {initials}
            </span>
          </div>
          <div className="min-w-0">
            <p className="text-[13px] font-bold text-foreground leading-snug truncate">{name}</p>
            <p className="text-[10px] text-muted-foreground font-medium">Project Manager</p>
          </div>
        </div>

        {/* Contact */}
        <div className="px-4 py-3 space-y-2">
          {email ? (
            <a
              href={`mailto:${email}`}
              className="flex items-center gap-2 text-[12px] text-primary hover:underline min-w-0"
              onClick={e => e.stopPropagation()}
            >
              <Mail className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span className="truncate">{email}</span>
            </a>
          ) : (
            <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
              <User2 className="h-3.5 w-3.5 shrink-0" />
              <span>No contact info</span>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
