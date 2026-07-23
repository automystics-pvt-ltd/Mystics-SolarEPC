import * as React from "react";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command, CommandEmpty, CommandGroup, CommandInput,
  CommandItem, CommandList,
} from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface SelectOption {
  value: string;
  label: string;
  /** optional secondary line shown beneath the label */
  sub?: string;
}

interface SearchableSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  /** Allow typing a value that isn't in the list */
  allowCustom?: boolean;
  disabled?: boolean;
  error?: boolean;
  clearable?: boolean;
  className?: string;
}

export function SearchableSelect({
  value,
  onChange,
  options,
  placeholder = "Select…",
  searchPlaceholder = "Search…",
  emptyText = "No results found.",
  allowCustom = false,
  disabled = false,
  error = false,
  clearable = true,
  className,
}: SearchableSelectProps) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");

  const selected = options.find(o => o.value === value);
  const displayLabel = selected?.label ?? (value || "");

  const filtered = query
    ? options.filter(o =>
        o.label.toLowerCase().includes(query.toLowerCase()) ||
        o.value.toLowerCase().includes(query.toLowerCase()) ||
        (o.sub ?? "").toLowerCase().includes(query.toLowerCase())
      )
    : options;

  const handleSelect = (val: string) => {
    onChange(val === value ? "" : val);
    setQuery("");
    setOpen(false);
  };

  const handleCustom = () => {
    if (query.trim()) {
      onChange(query.trim());
      setQuery("");
      setOpen(false);
    }
  };

  const showCustomOption =
    allowCustom &&
    query.trim() &&
    !options.some(o => o.label.toLowerCase() === query.toLowerCase() || o.value.toLowerCase() === query.toLowerCase());

  return (
    <Popover open={open} onOpenChange={disabled ? undefined : setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "flex h-9 w-full items-center justify-between rounded-md border bg-background px-3 py-2 text-sm shadow-sm ring-offset-background",
            "transition-colors placeholder:text-muted-foreground",
            "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
            "disabled:cursor-not-allowed disabled:opacity-50",
            !value && "text-muted-foreground",
            error && "border-red-400 focus:ring-red-300",
            !error && "border-input hover:border-ring/50",
            className
          )}
        >
          <span className="truncate">{displayLabel || placeholder}</span>
          <div className="flex items-center gap-1 shrink-0 ml-2">
            {clearable && value && !disabled && (
              <span
                role="button"
                tabIndex={0}
                onClick={e => { e.stopPropagation(); onChange(""); }}
                onKeyDown={e => { if (e.key === "Enter") { e.stopPropagation(); onChange(""); } }}
                className="rounded p-0.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                aria-label="Clear selection"
              >
                <X className="h-3 w-3" />
              </span>
            )}
            <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground/60" />
          </div>
        </button>
      </PopoverTrigger>

      <PopoverContent
        className="p-0 shadow-lg"
        style={{ width: "var(--radix-popover-trigger-width)" }}
        align="start"
        sideOffset={4}
      >
        <Command shouldFilter={false}>
          <CommandInput
            placeholder={searchPlaceholder}
            value={query}
            onValueChange={setQuery}
            className="h-9"
          />
          <CommandList>
            <CommandEmpty>
              {showCustomOption ? (
                <button
                  type="button"
                  onClick={handleCustom}
                  className="w-full px-3 py-2 text-sm text-left hover:bg-accent hover:text-accent-foreground transition-colors"
                >
                  Use &ldquo;<span className="font-medium">{query}</span>&rdquo;
                </button>
              ) : (
                <span className="text-muted-foreground">{emptyText}</span>
              )}
            </CommandEmpty>

            {showCustomOption && (
              <CommandGroup>
                <CommandItem value={`__custom__${query}`} onSelect={handleCustom} className="text-sm">
                  <span className="text-muted-foreground mr-1">Use</span>
                  <span className="font-medium">&ldquo;{query}&rdquo;</span>
                </CommandItem>
              </CommandGroup>
            )}

            <CommandGroup className={showCustomOption ? "border-t border-border pt-1" : ""}>
              {filtered.map(option => (
                <CommandItem
                  key={option.value}
                  value={option.value}
                  onSelect={() => handleSelect(option.value)}
                  className="flex items-start gap-2"
                >
                  <Check
                    className={cn(
                      "h-4 w-4 mt-0.5 shrink-0",
                      value === option.value ? "opacity-100 text-primary" : "opacity-0"
                    )}
                  />
                  <div className="min-w-0">
                    <p className="text-sm leading-snug">{option.label}</p>
                    {option.sub && (
                      <p className="text-xs text-muted-foreground leading-snug">{option.sub}</p>
                    )}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
