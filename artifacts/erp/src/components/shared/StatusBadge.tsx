import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

// All status strings across every module
type Status =
  // Leads
  | "New" | "Contacted" | "Qualified" | "Proposal" | "Negotiation" | "Won" | "Lost"
  // Projects
  | "Active" | "On Hold" | "Completed" | "Cancelled" | "Planning"
  // POs / GRNs / Invoices / Quotations
  | "Draft" | "Submitted" | "Approved" | "Rejected" | "Pending" | "Paid"
  | "PendingApproval" | "MismatchFlagged" | "PartiallyReceived" | "FullyReceived"
  | "PartiallyAccepted" | "Accepted" | "RevisionRequested" | "PendingL1"
  // O&M
  | "Open" | "InProgress" | "Resolved" | "Closed" | "Overdue"
  // Users
  | "Inactive" | "Suspended"
  // Generic
  | "Expired" | "Success" | "Failed" | "Error" | "Warning" | "Info";

interface StatusBadgeProps {
  status: Status | string;
  size?: "sm" | "md";
  className?: string;
}

const STATUS_MAP: Record<string, { label: string; className: string }> = {
  // ── Success / Positive
  Won:               { label: "Won",                className: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800/60" },
  Active:            { label: "Active",             className: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800/60" },
  Completed:         { label: "Completed",          className: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800/60" },
  Approved:          { label: "Approved",           className: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800/60" },
  Paid:              { label: "Paid",               className: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800/60" },
  Accepted:          { label: "Accepted",           className: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800/60" },
  FullyReceived:     { label: "Fully Received",     className: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800/60" },
  Resolved:          { label: "Resolved",           className: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800/60" },
  Success:           { label: "Success",            className: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800/60" },
  // ── Info / Blue
  New:               { label: "New",                className: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-800/60" },
  Qualified:         { label: "Qualified",          className: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-800/60" },
  Contacted:         { label: "Contacted",          className: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-800/60" },
  Submitted:         { label: "Submitted",          className: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-800/60" },
  Info:              { label: "Info",               className: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-800/60" },
  Open:              { label: "Open",               className: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-800/60" },
  // ── Pending / Amber
  Pending:           { label: "Pending",            className: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800/60" },
  PendingApproval:   { label: "Pending Approval",   className: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800/60" },
  PendingL1:         { label: "Pending L1",         className: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800/60" },
  RevisionRequested: { label: "Revision Requested", className: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800/60" },
  InProgress:        { label: "In Progress",        className: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800/60" },
  "On Hold":         { label: "On Hold",            className: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800/60" },
  Warning:           { label: "Warning",            className: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800/60" },
  // ── Orange / Partial
  MismatchFlagged:   { label: "Mismatch",           className: "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/40 dark:text-orange-400 dark:border-orange-800/60" },
  PartiallyReceived: { label: "Partially Received", className: "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/40 dark:text-orange-400 dark:border-orange-800/60" },
  PartiallyAccepted: { label: "Partial",            className: "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/40 dark:text-orange-400 dark:border-orange-800/60" },
  Negotiation:       { label: "Negotiation",        className: "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/40 dark:text-orange-400 dark:border-orange-800/60" },
  Proposal:          { label: "Proposal",           className: "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/40 dark:text-orange-400 dark:border-orange-800/60" },
  // ── Red / Critical
  Rejected:          { label: "Rejected",           className: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-800/60" },
  Cancelled:         { label: "Cancelled",          className: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-800/60" },
  Lost:              { label: "Lost",               className: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-800/60" },
  Overdue:           { label: "Overdue",            className: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-800/60" },
  Error:             { label: "Error",              className: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-800/60" },
  Failed:            { label: "Failed",             className: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-800/60" },
  Suspended:         { label: "Suspended",          className: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-800/60" },
  Expired:           { label: "Expired",            className: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-800/60" },
  Closed:            { label: "Closed",             className: "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800/50 dark:text-slate-400 dark:border-slate-700" },
  // ── Neutral / Draft
  Draft:             { label: "Draft",              className: "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800/50 dark:text-slate-400 dark:border-slate-700" },
  Inactive:          { label: "Inactive",           className: "bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800/50 dark:text-slate-400 dark:border-slate-700" },
  Planning:          { label: "Planning",           className: "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800/50 dark:text-slate-400 dark:border-slate-700" },
};

/** Centralized status badge — use everywhere instead of ad-hoc Badge styling */
export function StatusBadge({ status, size = "md", className }: StatusBadgeProps) {
  const config = STATUS_MAP[status] ?? {
    label: status,
    className: "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800/50 dark:text-slate-400 dark:border-slate-700",
  };
  return (
    <Badge
      variant="outline"
      className={cn(
        "font-semibold border whitespace-nowrap",
        size === "sm" ? "text-[10px] px-1.5 py-0" : "text-[11px] px-2 py-0.5",
        config.className,
        className
      )}
    >
      {config.label}
    </Badge>
  );
}
