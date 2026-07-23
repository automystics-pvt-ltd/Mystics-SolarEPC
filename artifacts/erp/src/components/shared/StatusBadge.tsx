import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

// ── Complete status union ─────────────────────────────────────────────────────

type Status =
  // Leads / CRM
  | "New" | "Contacted" | "Qualified" | "Proposal" | "Negotiation" | "Won" | "Lost"
  // Projects
  | "Active" | "On Hold" | "Completed" | "Cancelled" | "Planning" | "Archived"
  // PO lifecycle
  | "Draft" | "Submitted" | "Issued" | "Acknowledged" | "Approved" | "Rejected"
  | "PartiallyReceived" | "FullyReceived" | "Closed" | "Dispatched"
  // GRN / QC
  | "Accepted" | "PartiallyAccepted" | "PartiallyDelivered"
  // Invoice / payment
  | "Pending" | "PendingApproval" | "PendingL1" | "PendingL2" | "MismatchFlagged"
  | "Paid" | "PartiallyPaid" | "CreditNoteIssued"
  // Quotations
  | "RevisionRequested" | "Expired"
  // O&M
  | "Open" | "InProgress" | "Resolved" | "Overdue" | "Scheduled"
  | "Terminated" | "PendingClientSignoff"
  // Engineering
  | "InternalApproved" | "ClientApproved"
  // Commissioning
  | "PendingClientSignoff"
  // GRN Returns
  | "RTV" | "ReturnDispatched" | "CreditPending"
  // Users
  | "Inactive" | "Suspended"
  // Priority
  | "Critical" | "High" | "Medium" | "Low"
  // Generic
  | "Success" | "Failed" | "Error" | "Warning" | "Info";

interface StatusBadgeProps {
  status: Status | string;
  size?: "sm" | "md" | "lg";
  dot?: boolean;
  className?: string;
}

// ── Colour palette ────────────────────────────────────────────────────────────

const E = "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800/60";
const B = "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-800/60";
const A = "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800/60";
const O = "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/40 dark:text-orange-400 dark:border-orange-800/60";
const R = "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-800/60";
const S = "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800/50 dark:text-slate-400 dark:border-slate-700";
const V = "bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/40 dark:text-violet-400 dark:border-violet-800/60";

// ── Master map ────────────────────────────────────────────────────────────────

const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  // Positive / green
  Won:                  { label: "Won",                   cls: E },
  Active:               { label: "Active",                cls: E },
  Completed:            { label: "Completed",             cls: E },
  Approved:             { label: "Approved",              cls: E },
  Paid:                 { label: "Paid",                  cls: E },
  Accepted:             { label: "Accepted",              cls: E },
  FullyReceived:        { label: "Fully Received",        cls: E },
  Resolved:             { label: "Resolved",              cls: E },
  Success:              { label: "Success",               cls: E },
  ClientApproved:       { label: "Client Approved",       cls: E },
  CreditNoteIssued:     { label: "Credit Note Issued",    cls: E },
  // Info / blue
  New:                  { label: "New",                   cls: B },
  Contacted:            { label: "Contacted",             cls: B },
  Qualified:            { label: "Qualified",             cls: B },
  Submitted:            { label: "Submitted",             cls: B },
  Issued:               { label: "Issued",                cls: B },
  Acknowledged:         { label: "Acknowledged",          cls: B },
  Open:                 { label: "Open",                  cls: B },
  Scheduled:            { label: "Scheduled",             cls: B },
  InternalApproved:     { label: "Internal Approved",     cls: B },
  Info:                 { label: "Info",                  cls: B },
  // Pending / amber
  Pending:              { label: "Pending",               cls: A },
  PendingApproval:      { label: "Pending Approval",      cls: A },
  PendingL1:            { label: "Pending L1",            cls: A },
  PendingL2:            { label: "Pending L2",            cls: A },
  RevisionRequested:    { label: "Revision Requested",    cls: A },
  InProgress:           { label: "In Progress",           cls: A },
  "On Hold":            { label: "On Hold",               cls: A },
  Warning:              { label: "Warning",               cls: A },
  PendingClientSignoff: { label: "Pending Sign-off",      cls: A },
  Dispatched:           { label: "Dispatched",            cls: A },
  ReturnDispatched:     { label: "Return Dispatched",     cls: A },
  CreditPending:        { label: "Credit Pending",        cls: A },
  // Orange / partial
  MismatchFlagged:      { label: "Mismatch",              cls: O },
  PartiallyReceived:    { label: "Partially Received",    cls: O },
  PartiallyAccepted:    { label: "Partial",               cls: O },
  PartiallyDelivered:   { label: "Partially Delivered",   cls: O },
  PartiallyPaid:        { label: "Partially Paid",        cls: O },
  Negotiation:          { label: "Negotiation",           cls: O },
  Proposal:             { label: "Proposal",              cls: O },
  RTV:                  { label: "Return to Vendor",      cls: O },
  // Red / critical
  Rejected:             { label: "Rejected",              cls: R },
  Cancelled:            { label: "Cancelled",             cls: R },
  Lost:                 { label: "Lost",                  cls: R },
  Overdue:              { label: "Overdue",               cls: R },
  Error:                { label: "Error",                 cls: R },
  Failed:               { label: "Failed",                cls: R },
  Suspended:            { label: "Suspended",             cls: R },
  Expired:              { label: "Expired",               cls: R },
  Terminated:           { label: "Terminated",            cls: R },
  Critical:             { label: "Critical",              cls: R },
  High:                 { label: "High",                  cls: R },
  // Neutral / slate
  Draft:                { label: "Draft",                 cls: S },
  Inactive:             { label: "Inactive",              cls: S },
  Planning:             { label: "Planning",              cls: S },
  Closed:               { label: "Closed",                cls: S },
  Archived:             { label: "Archived",              cls: S },
  Low:                  { label: "Low",                   cls: S },
  // Violet
  Medium:               { label: "Medium",                cls: V },
};

// ── Dot colour map (matches badge colour) ─────────────────────────────────────

const DOT_CLS: Record<string, string> = {
  [E]: "bg-emerald-500",
  [B]: "bg-blue-500",
  [A]: "bg-amber-500",
  [O]: "bg-orange-500",
  [R]: "bg-red-500",
  [S]: "bg-slate-400",
  [V]: "bg-violet-500",
};

// ── Component ─────────────────────────────────────────────────────────────────

/** Centralised status badge — use everywhere instead of ad-hoc Badge styling */
export function StatusBadge({ status, size = "md", dot, className }: StatusBadgeProps) {
  const cfg = STATUS_MAP[status] ?? {
    label: status.replace(/([A-Z])/g, " $1").trim(),
    cls: S,
  };

  return (
    <Badge
      variant="outline"
      className={cn(
        "font-semibold border whitespace-nowrap inline-flex items-center gap-1",
        size === "sm" && "text-[10px] px-1.5 py-0 h-[18px]",
        size === "md" && "text-[11px] px-2 py-0.5",
        size === "lg" && "text-[12px] px-2.5 py-1",
        cfg.cls,
        className,
      )}
    >
      {dot && (
        <span
          className={cn("h-1.5 w-1.5 rounded-full shrink-0", DOT_CLS[cfg.cls] ?? "bg-slate-400")}
        />
      )}
      {cfg.label}
    </Badge>
  );
}
