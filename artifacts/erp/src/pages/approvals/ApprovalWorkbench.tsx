/**
 * Approval Workbench — Centralized cross-module approval management
 * Inspired by: SAP Fiori My Inbox, ServiceNow, Microsoft Dynamics 365 Approvals
 */
import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { CanApprove } from "@/lib/permissions";
import { useToast } from "@/components/ui/use-toast";
import { apiGet, apiPost, apiPatch, apiDelete } from "@/lib/fetch";
import { ExternalLink } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip, TooltipContent, TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip as ReTooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import {
  CheckCircle2, XCircle, Clock, AlertTriangle, ChevronRight, Search,
  Plus, Filter, MoreHorizontal, Inbox, Send, History,
  BarChart3, Workflow, Users, ArrowRightLeft, Bell, Paperclip,
  MessageSquare, Star, CheckSquare, RefreshCw, Download, Zap,
  AlertCircle, Timer, Building2, ShoppingCart, DollarSign, FolderKanban,
  Warehouse, Wrench, Settings2, HardHat, LayoutDashboard, Check, X,
  ChevronDown, UserCheck, Undo2, GitBranch, Layers, Info,
  FileText, ThumbsUp, ThumbsDown, RotateCcw, Eye,
  Play, Pause, TrendingUp, Award, Calendar,
} from "lucide-react";

/* ─── Types ─────────────────────────────────────────────────────────────── */
interface ApprovalStep {
  id: number; requestId: number; stepOrder: number; name: string;
  stepType: string; approverRole: string | null; approverUserId: number | null;
  status: string; actedById: number | null; actedByName: string | null;
  delegatedToId: number | null; delegatedToName: string | null;
  actedAt: string | null; slaDeadline: string | null;
  isEscalated: boolean; escalatedAt: string | null; comment: string | null;
}
interface ApprovalAction {
  id: number; requestId: number; stepId: number | null;
  actorId: number | null; actorName: string | null; actionType: string;
  comment: string | null; createdAt: string;
}
interface ApprovalRequest {
  id: number; refNumber: string; title: string; description: string | null;
  module: string; entityType: string | null; entityRef: string | null;
  entityUrl: string | null; requesterId: number; requesterName: string;
  priority: string; status: string; currentStep: number; totalSteps: number;
  slaDeadline: string | null; createdAt: string; updatedAt: string;
  resolvedAt: string | null; steps: ApprovalStep[]; actions: ApprovalAction[];
}
interface Workflow {
  id: number; name: string; description: string | null; module: string;
  isActive: boolean; createdByName: string | null; createdAt: string;
  steps: { id: number; stepOrder: number; name: string; approverRole: string | null; slaHours: number | null }[];
}

/* ─── Constants ─────────────────────────────────────────────────────────── */
const MODULE_META: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  procurement: { label: "Procurement",  icon: ShoppingCart, color: "bg-blue-100 text-blue-700 border-blue-200"    },
  finance:     { label: "Finance",      icon: DollarSign,   color: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  hr:          { label: "HR",           icon: Users,        color: "bg-violet-100 text-violet-700 border-violet-200"   },
  projects:    { label: "Projects",     icon: FolderKanban, color: "bg-cyan-100 text-cyan-700 border-cyan-200"     },
  inventory:   { label: "Inventory",    icon: Warehouse,    color: "bg-amber-100 text-amber-700 border-amber-200"  },
  sales:       { label: "Sales",        icon: TrendingUp,   color: "bg-indigo-100 text-indigo-700 border-indigo-200"   },
  engineering: { label: "Engineering",  icon: Layers,       color: "bg-slate-100 text-slate-700 border-slate-200"  },
  admin:       { label: "Admin",        icon: Settings2,    color: "bg-rose-100 text-rose-700 border-rose-200"     },
  other:       { label: "General",      icon: FileText,     color: "bg-gray-100 text-gray-600 border-gray-200"     },
};
const PRIORITY_META: Record<string, { label: string; color: string; dot: string }> = {
  critical: { label: "Critical", color: "bg-red-100 text-red-700 border-red-200",       dot: "bg-red-500"    },
  high:     { label: "High",     color: "bg-orange-100 text-orange-700 border-orange-200", dot: "bg-orange-500" },
  medium:   { label: "Medium",   color: "bg-amber-100 text-amber-700 border-amber-200",  dot: "bg-amber-400"  },
  low:      { label: "Low",      color: "bg-slate-100 text-slate-600 border-slate-200",  dot: "bg-slate-400"  },
};
const STATUS_META: Record<string, { label: string; icon: React.ElementType; color: string; bg: string }> = {
  pending:   { label: "Pending",   icon: Clock,        color: "text-amber-600",   bg: "bg-amber-50 text-amber-700 border-amber-200"    },
  approved:  { label: "Approved",  icon: CheckCircle2, color: "text-emerald-600", bg: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  rejected:  { label: "Rejected",  icon: XCircle,      color: "text-red-600",     bg: "bg-red-50 text-red-700 border-red-200"          },
  recalled:  { label: "Recalled",  icon: RotateCcw,    color: "text-slate-600",   bg: "bg-slate-100 text-slate-600 border-slate-200"   },
  cancelled: { label: "Cancelled", icon: X,            color: "text-slate-500",   bg: "bg-slate-100 text-slate-500 border-slate-200"   },
};
const ACTION_META: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  submitted: { label: "Submitted",  icon: Send,         color: "text-blue-600"    },
  approved:  { label: "Approved",   icon: ThumbsUp,     color: "text-emerald-600" },
  rejected:  { label: "Rejected",   icon: ThumbsDown,   color: "text-red-600"     },
  recalled:  { label: "Recalled",   icon: RotateCcw,    color: "text-slate-500"   },
  delegated: { label: "Delegated",  icon: ArrowRightLeft, color: "text-violet-600" },
  escalated: { label: "Escalated",  icon: AlertTriangle, color: "text-orange-600" },
  commented: { label: "Commented",  icon: MessageSquare, color: "text-blue-500"   },
  cancelled: { label: "Cancelled",  icon: X,            color: "text-slate-500"   },
};
const MODULES = ["procurement","finance","hr","projects","inventory","sales","engineering","admin","other"];
const APPROVER_ROLES = [
  { value: "admin",     label: "Admin"     },
  { value: "director",  label: "Director"  },
  { value: "pm",        label: "PM"        },
  { value: "finance",   label: "Finance"   },
  { value: "warehouse", label: "Warehouse" },
  { value: "sales",     label: "Sales"     },
];
const DONUT_COLORS = ["#f97316","#10b981","#ef4444","#94a3b8","#6366f1"];

/* ─── Small helpers ──────────────────────────────────────────────────────── */
function relTime(iso: string | null) {
  if (!iso) return "—";
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60)     return "just now";
  if (s < 3600)   return `${Math.floor(s / 60)}m ago`;
  if (s < 86400)  return `${Math.floor(s / 3600)}h ago`;
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}
function slaStatus(deadline: string | null, status: string) {
  if (!deadline || status !== "pending") return null;
  const hrs = (new Date(deadline).getTime() - Date.now()) / 3_600_000;
  if (hrs < 0)  return { label: `${Math.abs(Math.ceil(hrs))}h overdue`, cls: "text-red-600 bg-red-50 border-red-200" };
  if (hrs < 8)  return { label: `${Math.ceil(hrs)}h left`,    cls: "text-orange-600 bg-orange-50 border-orange-200" };
  if (hrs < 24) return { label: `${Math.ceil(hrs)}h left`,    cls: "text-amber-600 bg-amber-50 border-amber-200"   };
  return { label: `${Math.floor(hrs / 24)}d left`, cls: "text-emerald-600 bg-emerald-50 border-emerald-200" };
}

/* ─── Micro-components ───────────────────────────────────────────────────── */
function ModuleBadge({ module }: { module: string }) {
  const m = MODULE_META[module] ?? MODULE_META.other!;
  const Icon = m.icon;
  return (
    <span className={cn("inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border", m.color)}>
      <Icon className="h-2.5 w-2.5" />{m.label}
    </span>
  );
}
function PriorityBadge({ priority }: { priority: string }) {
  const p = PRIORITY_META[priority] ?? PRIORITY_META.medium!;
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border", p.color)}>
      <span className={cn("h-1.5 w-1.5 rounded-full", p.dot)} />{p.label}
    </span>
  );
}
function StatusBadge_({ status }: { status: string }) {
  const s = STATUS_META[status] ?? STATUS_META.pending!;
  const Icon = s.icon;
  return (
    <span className={cn("inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border", s.bg)}>
      <Icon className="h-2.5 w-2.5" />{s.label}
    </span>
  );
}
function SLAChip({ deadline, status }: { deadline: string | null; status: string }) {
  const s = slaStatus(deadline, status);
  if (!s) return null;
  return <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded border", s.cls)}>{s.label}</span>;
}
function StepTimeline({ steps, currentStep }: { steps: ApprovalStep[]; currentStep: number }) {
  return (
    <div className="space-y-0">
      {steps.map((step, i) => {
        const isActive = step.stepOrder === currentStep && step.status === "pending";
        const isDone   = step.status === "approved";
        const isRej    = step.status === "rejected";
        const isSkip   = step.status === "skipped" || step.status === "delegated";
        return (
          <div key={step.id} className="flex gap-3">
            <div className="flex flex-col items-center">
              <div className={cn(
                "h-7 w-7 rounded-full border-2 flex items-center justify-center shrink-0 z-10",
                isDone   ? "bg-emerald-500 border-emerald-500 text-white"    :
                isRej    ? "bg-red-500 border-red-500 text-white"             :
                isActive ? "bg-primary border-primary text-white animate-pulse" :
                isSkip   ? "bg-slate-200 border-slate-300 text-slate-400"    :
                           "bg-muted border-border text-muted-foreground"
              )}>
                {isDone   ? <Check className="h-3.5 w-3.5" />  :
                 isRej    ? <X className="h-3.5 w-3.5" />       :
                 isActive ? <Clock className="h-3 w-3" />       :
                            <span className="text-[10px] font-bold">{step.stepOrder}</span>}
              </div>
              {i < steps.length - 1 && (
                <div className={cn("w-0.5 h-8 mt-0.5", isDone ? "bg-emerald-400" : "bg-border/60")} />
              )}
            </div>
            <div className="pb-6 flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <p className={cn("text-[12px] font-semibold", isActive ? "text-foreground" : isDone ? "text-emerald-700" : "text-muted-foreground")}>{step.name}</p>
                {isActive && <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-bold">In Progress</span>}
                {isDone   && <span className="text-[10px] bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded font-bold border border-emerald-200">Done</span>}
                {isRej    && <span className="text-[10px] bg-red-50 text-red-600 px-1.5 py-0.5 rounded font-bold border border-red-200">Rejected</span>}
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {step.approverRole ? `Approver: ${step.approverRole}` : "Any approver"}
                {step.actedByName && ` · ${step.actedByName}`}
                {step.actedAt && <> · <span className="tabular-nums">{relTime(step.actedAt)}</span></>}
              </p>
              {step.comment && (
                <p className="mt-1 text-[11px] text-muted-foreground italic bg-muted/40 rounded px-2 py-1 border border-border/40">"{step.comment}"</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
function ActivityFeed({ actions }: { actions: ApprovalAction[] }) {
  if (!actions.length) return <p className="text-sm text-muted-foreground py-4 text-center">No activity yet</p>;
  return (
    <div className="space-y-0">
      {actions.map((a, i) => {
        const m = ACTION_META[a.actionType] ?? ACTION_META.commented!;
        const Icon = m.icon;
        return (
          <div key={a.id} className="flex gap-3 group">
            <div className="flex flex-col items-center">
              <div className={cn("h-7 w-7 rounded-full bg-muted flex items-center justify-center shrink-0", m.color)}>
                <Icon className="h-3.5 w-3.5" />
              </div>
              {i < actions.length - 1 && <div className="w-0.5 flex-1 bg-border/40 mt-0.5 group-last:hidden min-h-[20px]" />}
            </div>
            <div className="pb-5 flex-1 min-w-0">
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-[12px] font-semibold text-foreground">{a.actorName ?? "System"} <span className="font-normal text-muted-foreground">{m.label.toLowerCase()}</span></p>
                <span className="text-[10px] text-muted-foreground/60 tabular-nums shrink-0">{relTime(a.createdAt)}</span>
              </div>
              {a.comment && <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">{a.comment}</p>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ─── Request Row ────────────────────────────────────────────────────────── */
function RequestRow({ req, selected, onSelect, onClick, canAct, onApprove, onReject }: {
  req: ApprovalRequest; selected: boolean;
  onSelect: (v: boolean) => void; onClick: () => void;
  canAct: boolean; onApprove: () => void; onReject: () => void;
}) {
  const prio = PRIORITY_META[req.priority] ?? PRIORITY_META.medium!;
  const slaBreached = !!(req.slaDeadline && new Date(req.slaDeadline) < new Date() && req.status === "pending");
  return (
    <div className={cn(
      "flex items-center gap-3 px-4 py-3 border-b border-border/40 hover:bg-muted/20 transition-colors group",
      selected && "bg-primary/5 border-l-[3px] border-l-primary",
      slaBreached && !selected && "bg-amber-50/50 border-l-[3px] border-l-amber-400"
    )}>
      <Checkbox checked={selected} onCheckedChange={onSelect} className="shrink-0" />
      <div className={cn("h-2.5 w-2.5 rounded-full shrink-0", prio.dot)} />
      <div className="flex-1 min-w-0 cursor-pointer" onClick={onClick}>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[13px] font-semibold text-foreground truncate">{req.title}</span>
          <ModuleBadge module={req.module} />
          {req.entityType === "quotation" && req.entityRef && (
            <span className="text-[10px] font-mono font-bold bg-blue-50 text-blue-700 border border-blue-200 px-1.5 py-0.5 rounded">{req.entityRef}</span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          <span className="font-mono text-[11px] text-muted-foreground">{req.refNumber}</span>
          <span className="text-muted-foreground/30 text-[10px]">·</span>
          <span className="text-[11px] text-muted-foreground">{req.requesterName}</span>
          <span className="text-muted-foreground/30 text-[10px]">·</span>
          <span className="text-[11px] text-muted-foreground tabular-nums">{relTime(req.createdAt)}</span>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <SLAChip deadline={req.slaDeadline} status={req.status} />
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-muted-foreground tabular-nums">{req.currentStep}/{req.totalSteps}</span>
        </div>
        <StatusBadge_ status={req.status} />
        {canAct && req.status === "pending" && (
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button size="sm" onClick={(e) => { e.stopPropagation(); onApprove(); }}
              className="h-7 px-2.5 text-[11px] bg-emerald-600 hover:bg-emerald-700 text-white gap-1">
              <Check className="h-3 w-3" />Approve
            </Button>
            <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); onReject(); }}
              className="h-7 px-2.5 text-[11px] border-red-300 text-red-600 hover:bg-red-50 gap-1">
              <X className="h-3 w-3" />Reject
            </Button>
          </div>
        )}
        <Button size="icon" variant="ghost" className="h-7 w-7 opacity-0 group-hover:opacity-100" onClick={onClick}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

/* ─── Detail Sheet ───────────────────────────────────────────────────────── */
function DetailSheet({ req, open, onClose, canAct, onApprove, onReject, onRecall, onComment }: {
  req: ApprovalRequest | null; open: boolean; onClose: () => void;
  canAct: boolean;
  onApprove: (comment: string) => void;
  onReject:  (reason: string)  => void;
  onRecall:  () => void;
  onComment: (comment: string) => void;
}) {
  const [activeTab, setActiveTab] = useState<"timeline"|"activity">("timeline");
  const [comment, setComment] = useState("");
  const [, setLocation] = useLocation();

  if (!req) return null;
  const st = STATUS_META[req.status] ?? STATUS_META.pending!;
  const StatusIcon = st.icon;

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto" side="right">
        <SheetHeader className="pb-4 border-b border-border/60">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className="font-mono text-[11px] text-muted-foreground">{req.refNumber}</span>
                <ModuleBadge module={req.module} />
                <PriorityBadge priority={req.priority} />
              </div>
              <SheetTitle className="text-base font-bold text-foreground leading-tight">{req.title}</SheetTitle>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <StatusBadge_ status={req.status} />
                <SLAChip deadline={req.slaDeadline} status={req.status} />
                {req.entityRef && <span className="text-[10px] font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{req.entityRef}</span>}
                {req.entityType === "quotation" && req.entityUrl && (
                  <button
                    className="flex items-center gap-1 text-[10px] font-semibold text-primary hover:underline"
                    onClick={() => { setLocation(req.entityUrl!); onClose(); }}
                  >
                    <ExternalLink className="h-3 w-3" /> View Quotation
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Quick info row */}
          <div className="grid grid-cols-3 gap-3 mt-3">
            {[
              { label: "Submitted by", value: req.requesterName },
              { label: "Submitted",    value: relTime(req.createdAt) },
              { label: "Step",         value: `${req.currentStep} of ${req.totalSteps}` },
            ].map(({ label, value }) => (
              <div key={label} className="bg-muted/30 rounded-lg px-3 py-2 border border-border/40">
                <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{label}</p>
                <p className="text-[12px] font-semibold text-foreground mt-0.5">{value}</p>
              </div>
            ))}
          </div>
        </SheetHeader>

        <div className="mt-5 space-y-5">
          {/* Description */}
          {req.description && (
            <div className="bg-muted/20 rounded-xl px-4 py-3 border border-border/40">
              <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground mb-1">Description</p>
              <p className="text-[13px] text-foreground leading-relaxed">{req.description}</p>
            </div>
          )}

          {/* Tabs: Timeline | Activity */}
          <div>
            <div className="flex border-b border-border">
              {(["timeline","activity"] as const).map(t => (
                <button key={t} onClick={() => setActiveTab(t)} className={cn(
                  "px-4 py-2 text-[12px] font-semibold capitalize border-b-2 transition-colors",
                  activeTab === t ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
                )}>{t === "timeline" ? "Workflow Timeline" : "Activity Feed"}</button>
              ))}
            </div>
            <div className="mt-4">
              {activeTab === "timeline" && <StepTimeline steps={req.steps} currentStep={req.currentStep} />}
              {activeTab === "activity" && <ActivityFeed actions={req.actions} />}
            </div>
          </div>

          {/* Action buttons */}
          {(canAct && req.status === "pending") && (
            <div className="border-t border-border/60 pt-4 space-y-3">
              <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Your Action</p>
              <Textarea
                value={comment} onChange={e => setComment(e.target.value)}
                placeholder="Add a comment (required for rejection)…"
                className="text-sm min-h-[80px] resize-none"
              />
              <div className="flex gap-2">
                <Button className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
                  onClick={() => { onApprove(comment); setComment(""); }}>
                  <ThumbsUp className="h-4 w-4" />Approve
                </Button>
                <Button variant="outline" className="flex-1 border-red-300 text-red-600 hover:bg-red-50 gap-2"
                  onClick={() => { if (!comment.trim()) return; onReject(comment); setComment(""); }}>
                  <ThumbsDown className="h-4 w-4" />Reject
                </Button>
              </div>
              {!comment && <p className="text-[10px] text-muted-foreground">Comment required to reject. Optional for approval.</p>}
            </div>
          )}

          {/* Recall (submitter or admin) */}
          {req.status === "pending" && (
            <div className="flex gap-2 pt-2">
              <Button size="sm" variant="ghost" className="text-xs text-muted-foreground gap-1.5" onClick={onRecall}>
                <RotateCcw className="h-3.5 w-3.5" />Recall Request
              </Button>
              <Button size="sm" variant="ghost" className="text-xs text-muted-foreground gap-1.5"
                onClick={() => { if (!comment.trim()) return; onComment(comment); setComment(""); }}>
                <MessageSquare className="h-3.5 w-3.5" />Add Comment Only
              </Button>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

/* ─── New Request Dialog ─────────────────────────────────────────────────── */
function NewRequestDialog({ open, onClose, workflows, onSubmit }: {
  open: boolean; onClose: () => void;
  workflows: Workflow[];
  onSubmit: (data: any) => void;
}) {
  const [form, setForm] = useState({ title: "", description: "", module: "procurement", priority: "medium", workflowId: "", approverRole: "director", entityRef: "", notes: "" });
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));
  const selectedWf = workflows.find(w => String(w.id) === form.workflowId);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><Send className="h-4 w-4 text-primary" />New Approval Request</DialogTitle></DialogHeader>
        <div className="space-y-4 pt-1">
          <div>
            <Label>Title <span className="text-red-500">*</span></Label>
            <Input value={form.title} onChange={e => set("title", e.target.value)} placeholder="e.g. PO Approval for Solar Panels Q4" className="mt-1" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Module</Label>
              <Select value={form.module} onValueChange={v => set("module", v)}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>{MODULES.map(m => <SelectItem key={m} value={m}>{MODULE_META[m]?.label ?? m}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Priority</Label>
              <Select value={form.priority} onValueChange={v => set("priority", v)}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(PRIORITY_META).map(([v, m]) => <SelectItem key={v} value={v}>{m.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Workflow Template</Label>
            <Select value={form.workflowId} onValueChange={v => set("workflowId", v)}>
              <SelectTrigger className="mt-1"><SelectValue placeholder="Select a workflow or leave blank for ad-hoc" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="">Ad-hoc (single approver)</SelectItem>
                {workflows.filter(w => w.isActive).map(w => (
                  <SelectItem key={w.id} value={String(w.id)}>{w.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedWf && (
              <div className="mt-2 bg-muted/30 rounded-lg px-3 py-2 border border-border/40 space-y-1">
                <p className="text-[11px] font-semibold text-muted-foreground">{selectedWf.steps.length} steps:</p>
                {selectedWf.steps.map((s, i) => (
                  <p key={s.id} className="text-[11px] text-foreground">{i+1}. {s.name} → <span className="font-semibold capitalize">{s.approverRole}</span> ({s.slaHours}h SLA)</p>
                ))}
              </div>
            )}
            {!form.workflowId && (
              <div className="mt-2">
                <Label className="text-xs">Approver Role</Label>
                <Select value={form.approverRole} onValueChange={v => set("approverRole", v)}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>{APPROVER_ROLES.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
          </div>
          <div>
            <Label>Entity Reference</Label>
            <Input value={form.entityRef} onChange={e => set("entityRef", e.target.value)} placeholder="e.g. PO-0042, INV-1122" className="mt-1" />
          </div>
          <div>
            <Label>Description / Notes</Label>
            <Textarea value={form.description} onChange={e => set("description", e.target.value)} placeholder="Provide context for approvers…" className="mt-1 min-h-[80px] resize-none" />
          </div>
        </div>
        <DialogFooter className="mt-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => { if (!form.title.trim()) return; onSubmit(form); onClose(); setForm({ title: "", description: "", module: "procurement", priority: "medium", workflowId: "", approverRole: "director", entityRef: "", notes: "" }); }} disabled={!form.title.trim()} className="gap-2">
            <Send className="h-4 w-4" />Submit Request
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Workflow Builder ───────────────────────────────────────────────────── */
function WorkflowBuilder({ workflows, onRefresh }: { workflows: Workflow[]; onRefresh: () => void }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [editWf, setEditWf] = useState<Workflow | null>(null);
  const [form, setForm] = useState({ name: "", description: "", module: "procurement", isActive: true });
  const [steps, setSteps] = useState<{ name: string; approverRole: string; slaHours: number; stepType: string }[]>([]);

  const createMut = useMutation({
    mutationFn: (data: any) => apiPost("/approval-workflows", data),
    onSuccess: () => { toast({ title: "Workflow created" }); onRefresh(); setOpen(false); },
    onError: () => toast({ title: "Failed to create workflow", variant: "destructive" }),
  });
  const toggleMut = useMutation({
    mutationFn: ({ id, isActive }: { id: number; isActive: boolean }) =>
      apiPatch(`/approval-workflows/${id}`, { isActive }),
    onSuccess: () => { onRefresh(); },
  });

  const openNew = () => {
    setEditWf(null);
    setForm({ name: "", description: "", module: "procurement", isActive: true });
    setSteps([{ name: "Manager Approval", approverRole: "director", slaHours: 24, stepType: "sequential" }]);
    setOpen(true);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-[13px] font-bold text-foreground">Approval Workflows</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">{workflows.length} configured · {workflows.filter(w => w.isActive).length} active</p>
        </div>
        <Button size="sm" className="gap-1.5" onClick={openNew}><Plus className="h-3.5 w-3.5" />New Workflow</Button>
      </div>

      <div className="space-y-2">
        {workflows.length === 0 && (
          <div className="py-16 text-center border-2 border-dashed border-border rounded-xl">
            <GitBranch className="h-8 w-8 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm font-semibold text-muted-foreground">No workflows configured</p>
            <p className="text-xs text-muted-foreground/60 mt-1">Create your first workflow to route approvals automatically</p>
            <Button size="sm" className="mt-4 gap-1.5" onClick={openNew}><Plus className="h-3.5 w-3.5" />Create Workflow</Button>
          </div>
        )}
        {workflows.map(w => (
          <div key={w.id} className={cn("border rounded-xl p-4 transition-all", w.isActive ? "bg-card border-border" : "bg-muted/20 border-dashed border-border/60")}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className={cn("text-[13px] font-bold", !w.isActive && "text-muted-foreground")}>{w.name}</p>
                  <ModuleBadge module={w.module} />
                  {!w.isActive && <span className="text-[10px] font-bold uppercase text-muted-foreground/60 bg-muted border border-border/60 px-1.5 py-0.5 rounded">Inactive</span>}
                </div>
                {w.description && <p className="text-[11px] text-muted-foreground mt-0.5">{w.description}</p>}
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  {w.steps.map((s, i) => (
                    <div key={s.id} className="flex items-center gap-1">
                      <span className="text-[10px] font-semibold bg-muted border border-border/60 rounded px-1.5 py-0.5 text-muted-foreground">
                        {i+1}. {s.name} <span className="text-primary capitalize">({s.approverRole})</span>
                      </span>
                      {i < w.steps.length - 1 && <ChevronRight className="h-2.5 w-2.5 text-muted-foreground/30" />}
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button size="sm" variant="ghost" className="h-7 px-2 text-[11px] text-muted-foreground"
                  onClick={() => toggleMut.mutate({ id: w.id, isActive: !w.isActive })}>
                  {w.isActive ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                  {w.isActive ? "Disable" : "Enable"}
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Create workflow dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><GitBranch className="h-4 w-4 text-primary" />New Approval Workflow</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Workflow Name <span className="text-red-500">*</span></Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Purchase Order Approval" className="mt-1" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Module</Label>
                <Select value={form.module} onValueChange={v => setForm(f => ({ ...f, module: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>{MODULES.map(m => <SelectItem key={m} value={m}>{MODULE_META[m]?.label ?? m}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div><Label>Description</Label>
              <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className="mt-1 resize-none min-h-[60px]" /></div>

            {/* Steps builder */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>Approval Steps</Label>
                <Button type="button" size="sm" variant="outline" className="h-7 text-xs gap-1"
                  onClick={() => setSteps(ss => [...ss, { name: "Step " + (ss.length + 1), approverRole: "director", slaHours: 24, stepType: "sequential" }])}>
                  <Plus className="h-3 w-3" />Add Step
                </Button>
              </div>
              <div className="space-y-2">
                {steps.map((step, i) => (
                  <div key={i} className="flex items-center gap-2 bg-muted/30 rounded-lg p-2.5 border border-border/60">
                    <span className="text-[11px] font-bold text-muted-foreground w-4 shrink-0">{i+1}.</span>
                    <Input value={step.name} onChange={e => setSteps(ss => ss.map((s, j) => j === i ? { ...s, name: e.target.value } : s))}
                      className="h-7 text-xs flex-1" placeholder="Step name" />
                    <Select value={step.approverRole} onValueChange={v => setSteps(ss => ss.map((s, j) => j === i ? { ...s, approverRole: v } : s))}>
                      <SelectTrigger className="h-7 text-xs w-28"><SelectValue /></SelectTrigger>
                      <SelectContent>{APPROVER_ROLES.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}</SelectContent>
                    </Select>
                    <Input value={String(step.slaHours)} onChange={e => setSteps(ss => ss.map((s, j) => j === i ? { ...s, slaHours: Number(e.target.value) || 24 } : s))}
                      className="h-7 text-xs w-16" type="number" min={1} />
                    <span className="text-[10px] text-muted-foreground shrink-0">h SLA</span>
                    {steps.length > 1 && <Button type="button" size="icon" variant="ghost" className="h-6 w-6 shrink-0 hover:text-red-500"
                      onClick={() => setSteps(ss => ss.filter((_, j) => j !== i))}><X className="h-3 w-3" /></Button>}
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button disabled={!form.name.trim() || steps.length === 0 || createMut.isPending}
              onClick={() => createMut.mutate({ ...form, steps })}>
              {createMut.isPending ? "Creating…" : "Create Workflow"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ─── Analytics Tab ──────────────────────────────────────────────────────── */
function AnalyticsPanel({ analytics }: { analytics: any }) {
  if (!analytics) return null;
  const t = analytics.totals ?? {};
  const kpis = [
    { label: "Total Requests", value: t.total ?? 0,                        icon: FileText,    accent: "text-blue-600",    bg: "bg-blue-50 border-blue-200"    },
    { label: "Pending",        value: t.pending ?? 0,                       icon: Clock,       accent: "text-amber-600",   bg: "bg-amber-50 border-amber-200"  },
    { label: "Approved",       value: t.approved ?? 0,                      icon: CheckCircle2,accent: "text-emerald-600", bg: "bg-emerald-50 border-emerald-200" },
    { label: "Rejected",       value: t.rejected ?? 0,                      icon: XCircle,     accent: "text-red-600",     bg: "bg-red-50 border-red-200"      },
    { label: "Avg Resolution", value: `${t.avgResolutionHours ?? 0}h`,      icon: Timer,       accent: "text-violet-600",  bg: "bg-violet-50 border-violet-200" },
    { label: "SLA Overdue",    value: t.overdueSla ?? 0,                    icon: AlertTriangle,accent: "text-orange-600", bg: "bg-orange-50 border-orange-200" },
  ];
  const byModule   = analytics.byModule   ?? [];
  const byStatus   = analytics.byStatus   ?? [];
  const daily      = analytics.daily      ?? [];
  const byRole     = analytics.byApproverRole ?? [];
  return (
    <div className="space-y-5">
      {/* KPI row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {kpis.map(k => {
          const Icon = k.icon;
          return (
            <div key={k.label} className={cn("border rounded-xl p-3 flex flex-col gap-2", k.bg)}>
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{k.label}</p>
                <Icon className={cn("h-4 w-4", k.accent)} />
              </div>
              <p className={cn("text-2xl font-bold tabular-nums", k.accent)}>{k.value}</p>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Daily trend */}
        <div className="bg-card border border-border rounded-xl p-4 lg:col-span-2">
          <p className="text-[12px] font-bold mb-3 text-foreground">Request Volume — Last 30 Days</p>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={daily.slice(-30)} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="ag" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#f97316" stopOpacity={0.2} />
                  <stop offset="100%" stopColor="#f97316" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} tickFormatter={v => v.slice(5)} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} width={24} allowDecimals={false} />
              <ReTooltip contentStyle={{ fontSize: 11 }} />
              <Area type="monotone" dataKey="count" stroke="#f97316" strokeWidth={2} fill="url(#ag)"
                dot={false} activeDot={{ r: 4, fill: "#f97316" }} name="Requests" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* By status donut */}
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-[12px] font-bold mb-3 text-foreground">Status Distribution</p>
          <ResponsiveContainer width="100%" height={140}>
            <PieChart>
              <Pie data={byStatus} cx="50%" cy="50%" innerRadius={36} outerRadius={56}
                paddingAngle={2} dataKey="count" nameKey="status">
                {byStatus.map((_: any, i: number) => <Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />)}
              </Pie>
              <ReTooltip contentStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-1 mt-1">
            {byStatus.map((b: any, i: number) => (
              <div key={b.status} className="flex items-center justify-between">
                <div className="flex items-center gap-1.5"><div className="h-2 w-2 rounded-full" style={{ backgroundColor: DONUT_COLORS[i % DONUT_COLORS.length] }} /><span className="text-[10px] text-muted-foreground capitalize">{b.status}</span></div>
                <span className="text-[10px] font-bold tabular-nums">{b.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* By module bar chart */}
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-[12px] font-bold mb-3 text-foreground">Requests by Module</p>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={byModule} barSize={18}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="module" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} width={24} allowDecimals={false} />
              <ReTooltip contentStyle={{ fontSize: 11 }} />
              <Bar dataKey="count" fill="#f97316" radius={[3,3,0,0]} name="Requests" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Bottleneck — pending by approver role */}
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-[12px] font-bold mb-3 text-foreground">Pending by Approver Role</p>
          {byRole.length === 0
            ? <p className="text-sm text-muted-foreground py-8 text-center">No pending items</p>
            : <div className="space-y-3 pt-1">
                {byRole.sort((a: any, b: any) => b.count - a.count).map((r: any) => {
                  const pct = byRole[0]?.count > 0 ? Math.round((r.count / byRole[0].count) * 100) : 0;
                  return (
                    <div key={r.role}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[11px] font-semibold capitalize text-foreground">{r.role}</span>
                        <span className="text-[11px] font-bold tabular-nums text-foreground">{r.count}</span>
                      </div>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-primary rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
          }
        </div>
      </div>
    </div>
  );
}

/* ─── My Delegates Panel ─────────────────────────────────────────────────── */
interface DelegateRule {
  id: number; fromUserId: number; toUserId: number; toUserName: string;
  module: string | null; startDate: string; endDate: string | null;
  isActive: boolean; createdAt: string;
}
interface UserOption { id: number; name: string; role: string; }

function DelegatesPanel({ currentUserId }: { currentUserId: number }) {
  const qc = useQueryClient();
  const { toast } = useToast();

  const delegatesQ = useQuery<DelegateRule[]>({
    queryKey: ["approvals", "my-delegates"],
    queryFn: () => apiGet<DelegateRule[]>("/approvals/my-delegates"),
  });
  const usersQ = useQuery<UserOption[]>({
    queryKey: ["approvals", "users-for-delegate"],
    queryFn: () => apiGet<UserOption[]>("/approvals/users-for-delegate"),
  });

  const [form, setForm] = useState({
    toUserId: "",
    module: "__all__",
    startDate: new Date().toISOString().split("T")[0]!,
    endDate: "",
  });
  const setF = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const addMut = useMutation({
    mutationFn: () => apiPost("/approvals/delegate", {
      toUserId:  Number(form.toUserId),
      module:    form.module === "__all__" ? null : form.module,
      startDate: form.startDate || new Date().toISOString(),
      endDate:   form.endDate   || null,
    }),
    onSuccess: () => {
      toast({ title: "Delegation rule added ✓" });
      qc.invalidateQueries({ queryKey: ["approvals", "my-delegates"] });
      setForm({ toUserId: "", module: "__all__", startDate: new Date().toISOString().split("T")[0]!, endDate: "" });
    },
    onError: () => toast({ title: "Failed to add delegation rule", variant: "destructive" }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => apiDelete(`/approvals/delegate/${id}`),
    onSuccess: () => {
      toast({ title: "Delegation rule removed" });
      qc.invalidateQueries({ queryKey: ["approvals", "my-delegates"] });
    },
    onError: () => toast({ title: "Failed to remove delegation rule", variant: "destructive" }),
  });

  const otherUsers = (usersQ.data ?? []).filter(u => u.id !== currentUserId);
  const rules = delegatesQ.data ?? [];

  const fmtDate = (iso: string | null) => {
    if (!iso) return "—";
    return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  };

  return (
    <div className="max-w-2xl space-y-6">

      {/* Info banner */}
      <div className="flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
        <Info className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
        <div>
          <p className="text-[12px] font-semibold text-blue-800">About approval delegation</p>
          <p className="text-[11px] text-blue-700 mt-0.5 leading-relaxed">
            Delegation rules automatically forward approval tasks to another person for a specified period.
            Useful when you're on leave or unavailable. Rules apply to new approval requests; existing steps
            must be manually re-delegated.
          </p>
        </div>
      </div>

      {/* Add new rule form */}
      <div className="bg-card border border-border rounded-xl p-5 space-y-4">
        <p className="text-[13px] font-bold text-foreground flex items-center gap-2">
          <Plus className="h-4 w-4 text-primary" />Add Delegation Rule
        </p>

        <div className="space-y-3">
          <div>
            <Label className="text-xs font-semibold">Delegate to <span className="text-red-500">*</span></Label>
            <Select value={form.toUserId} onValueChange={v => setF("toUserId", v)}>
              <SelectTrigger className="mt-1 h-9 text-sm">
                <SelectValue placeholder={usersQ.isLoading ? "Loading users…" : "Select a person"} />
              </SelectTrigger>
              <SelectContent>
                {otherUsers.map(u => (
                  <SelectItem key={u.id} value={String(u.id)}>
                    {u.name} <span className="text-muted-foreground capitalize ml-1">({u.role})</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs font-semibold">Module scope</Label>
            <Select value={form.module} onValueChange={v => setF("module", v)}>
              <SelectTrigger className="mt-1 h-9 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All modules</SelectItem>
                {MODULES.map(m => (
                  <SelectItem key={m} value={m}>{MODULE_META[m]?.label ?? m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[10px] text-muted-foreground mt-1">Leave as "All modules" to delegate everything</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-semibold">Start date <span className="text-red-500">*</span></Label>
              <Input type="date" value={form.startDate} onChange={e => setF("startDate", e.target.value)}
                className="mt-1 h-9 text-sm" />
            </div>
            <div>
              <Label className="text-xs font-semibold">End date <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Input type="date" value={form.endDate} onChange={e => setF("endDate", e.target.value)}
                min={form.startDate} className="mt-1 h-9 text-sm" />
            </div>
          </div>
        </div>

        <Button
          onClick={() => addMut.mutate()}
          disabled={!form.toUserId || !form.startDate || addMut.isPending}
          className="gap-2 h-9"
        >
          <UserCheck className="h-3.5 w-3.5" />
          {addMut.isPending ? "Adding…" : "Add Delegation Rule"}
        </Button>
      </div>

      {/* Existing rules list */}
      <div>
        <p className="text-[12px] font-bold text-foreground mb-3 flex items-center gap-2">
          <ArrowRightLeft className="h-3.5 w-3.5 text-muted-foreground" />
          Active Delegation Rules
          {rules.length > 0 && (
            <span className="text-[10px] font-bold bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">{rules.length}</span>
          )}
        </p>

        {delegatesQ.isLoading ? (
          <div className="space-y-2">
            {[1, 2].map(i => <div key={i} className="h-16 bg-muted/50 rounded-xl animate-pulse" />)}
          </div>
        ) : rules.length === 0 ? (
          <div className="py-12 text-center border-2 border-dashed border-border rounded-xl">
            <UserCheck className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-sm font-semibold text-muted-foreground">No delegation rules yet</p>
            <p className="text-xs text-muted-foreground/60 mt-1">Add a rule above to automatically forward approvals</p>
          </div>
        ) : (
          <div className="space-y-2">
            {rules.map(rule => {
              const now = new Date();
              const start = new Date(rule.startDate);
              const end = rule.endDate ? new Date(rule.endDate) : null;
              const isExpired = end && end < now;
              const isUpcoming = start > now;
              const isActive = rule.isActive && !isExpired && !isUpcoming;

              return (
                <div key={rule.id} className={cn(
                  "flex items-start justify-between gap-3 border rounded-xl px-4 py-3",
                  isExpired  ? "bg-muted/30 border-border/50 opacity-60" :
                  isUpcoming ? "bg-amber-50/60 border-amber-200" :
                               "bg-card border-border"
                )}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[13px] font-semibold text-foreground">{rule.toUserName}</span>
                      {rule.module
                        ? <ModuleBadge module={rule.module} />
                        : <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border bg-gray-100 text-gray-600 border-gray-200">All Modules</span>
                      }
                      {isExpired  && <span className="text-[10px] font-bold text-muted-foreground bg-muted border border-border/60 px-1.5 py-0.5 rounded uppercase">Expired</span>}
                      {isUpcoming && <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded uppercase">Upcoming</span>}
                      {isActive   && <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded uppercase">Active</span>}
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-1">
                      <span className="font-semibold">From:</span> {fmtDate(rule.startDate)}
                      {rule.endDate
                        ? <> · <span className="font-semibold">Until:</span> {fmtDate(rule.endDate)}</>
                        : " · No end date (indefinite)"
                      }
                    </p>
                  </div>
                  <Button
                    size="sm" variant="ghost"
                    className="h-7 w-7 p-0 text-muted-foreground hover:text-red-600 hover:bg-red-50 shrink-0"
                    onClick={() => deleteMut.mutate(rule.id)}
                    disabled={deleteMut.isPending}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Tabs & list panel ──────────────────────────────────────────────────── */
const TABS = [
  { key: "pending",   label: "My Inbox",      icon: Inbox      },
  { key: "requests",  label: "My Requests",   icon: Send       },
  { key: "queue",     label: "All Queue",     icon: Layers     },
  { key: "delegated", label: "Delegated",     icon: ArrowRightLeft },
  { key: "history",   label: "History",       icon: History    },
  { key: "analytics", label: "Analytics",     icon: BarChart3  },
  { key: "workflows", label: "Workflows",     icon: GitBranch  },
  { key: "delegates", label: "My Delegates",  icon: UserCheck  },
] as const;
type Tab = typeof TABS[number]["key"];

function RequestList({ items, loading, tab, user, onOpen, onApprove, onReject, onBulkApprove, onBulkReject }: {
  items: ApprovalRequest[]; loading: boolean; tab: Tab;
  user: any; onOpen: (r: ApprovalRequest) => void;
  onApprove: (r: ApprovalRequest) => void;
  onReject:  (r: ApprovalRequest) => void;
  onBulkApprove: (ids: number[]) => void;
  onBulkReject:  (ids: number[]) => void;
}) {
  const [search, setSearch]   = useState("");
  const [modFilter, setModFilter] = useState("all");
  const [priFilter, setPriFilter] = useState("all");
  const [entityFilter, setEntityFilter] = useState("all");
  const [selected, setSelected]  = useState<Set<number>>(new Set());

  const filtered = useMemo(() => {
    let r = items;
    if (search)                  r = r.filter(i => i.title.toLowerCase().includes(search.toLowerCase()) || i.refNumber.includes(search) || i.requesterName.toLowerCase().includes(search.toLowerCase()) || (i.entityRef ?? "").toLowerCase().includes(search.toLowerCase()));
    if (modFilter !== "all")     r = r.filter(i => i.module === modFilter);
    if (priFilter !== "all")     r = r.filter(i => i.priority === priFilter);
    if (entityFilter !== "all")  r = r.filter(i => i.entityType === entityFilter);
    return r;
  }, [items, search, modFilter, priFilter, entityFilter]);

  const toggleAll  = (v: boolean) => setSelected(v ? new Set(filtered.map(r => r.id)) : new Set());
  const toggle     = (id: number) => setSelected(s => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const allChecked = filtered.length > 0 && filtered.every(r => selected.has(r.id));
  const someChecked = selected.size > 0;

  const userCanAct = (req: ApprovalRequest) => {
    if (req.status !== "pending") return false;
    const curSteps = req.steps.filter(s => s.stepOrder === req.currentStep && s.status === "pending");
    return curSteps.some(s =>
      (s.approverRole && s.approverRole === user?.role) ||
      (s.approverUserId && s.approverUserId === user?.id) ||
      (s.delegatedToId && s.delegatedToId === user?.id)
    );
  };

  if (loading) return (
    <div className="space-y-2 p-4">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="h-14 bg-muted/50 rounded-lg animate-pulse" />
      ))}
    </div>
  );

  return (
    <div>
      {/* Filters */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border/60 bg-muted/10">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search…" className="pl-8 h-8 text-xs" />
        </div>
        <Select value={modFilter} onValueChange={setModFilter}>
          <SelectTrigger className="h-8 text-xs w-36"><Filter className="h-3 w-3 mr-1" /><SelectValue placeholder="Module" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All modules</SelectItem>
            {MODULES.map(m => <SelectItem key={m} value={m}>{MODULE_META[m]?.label ?? m}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={priFilter} onValueChange={setPriFilter}>
          <SelectTrigger className="h-8 text-xs w-32"><SelectValue placeholder="Priority" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All priorities</SelectItem>
            {Object.entries(PRIORITY_META).map(([v, m]) => <SelectItem key={v} value={v}>{m.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={entityFilter} onValueChange={setEntityFilter}>
          <SelectTrigger className="h-8 text-xs w-32"><SelectValue placeholder="Type" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            <SelectItem value="quotation">Quotations</SelectItem>
            <SelectItem value="purchase_order">Purchase Orders</SelectItem>
            <SelectItem value="invoice">Invoices</SelectItem>
            <SelectItem value="grn">GRN</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-[11px] text-muted-foreground ml-auto">{filtered.length} {filtered.length === 1 ? "item" : "items"}</span>
      </div>

      {/* Bulk action bar */}
      <AnimatePresence>
        {someChecked && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden">
            <div className="flex items-center gap-3 px-4 py-2.5 bg-primary/5 border-b border-primary/20">
              <span className="text-[12px] font-semibold text-primary">{selected.size} selected</span>
              <div className="flex gap-2 ml-auto">
                <CanApprove module="approvals">
                  <Button size="sm" className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
                    onClick={() => { onBulkApprove([...selected]); setSelected(new Set()); }}>
                    <Check className="h-3 w-3" />Approve All
                  </Button>
                </CanApprove>
                <CanApprove module="approvals">
                  <Button size="sm" variant="outline" className="h-7 text-xs border-red-300 text-red-600 hover:bg-red-50 gap-1.5"
                    onClick={() => { onBulkReject([...selected]); setSelected(new Set()); }}>
                    <X className="h-3 w-3" />Reject All
                  </Button>
                </CanApprove>
                <Button size="sm" variant="ghost" className="h-7 text-xs text-muted-foreground"
                  onClick={() => setSelected(new Set())}>Clear</Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Column header */}
      <div className="flex items-center gap-3 px-4 py-2 bg-muted/30 border-b border-border/60">
        <Checkbox checked={allChecked} onCheckedChange={toggleAll} className="shrink-0" />
        <div className="w-2.5 shrink-0" />
        <span className="flex-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Title / Reference</span>
        <span className="w-32 hidden sm:block text-[10px] font-bold uppercase tracking-wide text-muted-foreground">SLA</span>
        <span className="w-20 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Step</span>
        <span className="w-24 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Status</span>
        <span className="w-32 hidden lg:block" />
      </div>

      {filtered.length === 0 ? (
        <div className="py-20 text-center">
          <Inbox className="h-10 w-10 text-muted-foreground/20 mx-auto mb-3" />
          <p className="text-sm font-semibold text-muted-foreground">
            {tab === "pending" ? "Your inbox is clear ✓" : "Nothing here yet"}
          </p>
          <p className="text-xs text-muted-foreground/60 mt-1">
            {tab === "pending" ? "No approvals waiting for your action" : "Items will appear here as they're created"}
          </p>
        </div>
      ) : (
        <div className="divide-y divide-border/30">
          {filtered.map(req => (
            <RequestRow key={req.id} req={req}
              selected={selected.has(req.id)}
              onSelect={v => toggle(req.id)}
              onClick={() => onOpen(req)}
              canAct={userCanAct(req)}
              onApprove={() => onApprove(req)}
              onReject={() => onReject(req)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN WORKBENCH
═══════════════════════════════════════════════════════════════════════════ */
export default function ApprovalWorkbench() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [activeTab, setActiveTab]   = useState<Tab>("pending");
  const [selectedReq, setSelectedReq] = useState<ApprovalRequest | null>(null);
  const [sheetOpen, setSheetOpen]   = useState(false);
  const [newOpen, setNewOpen]        = useState(false);

  // Reject dialog state
  const [rejectTarget, setRejectTarget] = useState<ApprovalRequest | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  /* Queries */
  const pendingQ   = useQuery({ queryKey: ["approvals","pending"],   queryFn: () => apiGet<ApprovalRequest[]>("/approvals/my-pending"),  enabled: activeTab === "pending"   });
  const requestsQ  = useQuery({ queryKey: ["approvals","requests"],  queryFn: () => apiGet<ApprovalRequest[]>("/approvals/my-requests"), enabled: activeTab === "requests"  });
  const queueQ     = useQuery({ queryKey: ["approvals","queue"],     queryFn: () => apiGet<ApprovalRequest[]>("/approvals/queue"),       enabled: activeTab === "queue"     });
  const delegatedQ = useQuery({ queryKey: ["approvals","delegated"], queryFn: () => apiGet<ApprovalRequest[]>("/approvals/delegated"),   enabled: activeTab === "delegated" });
  const historyQ   = useQuery({ queryKey: ["approvals","history"],   queryFn: () => apiGet<ApprovalRequest[]>("/approvals/history"),     enabled: activeTab === "history"   });
  const analyticsQ = useQuery({ queryKey: ["approvals","analytics"], queryFn: () => apiGet<any>("/approvals/analytics"),                 enabled: activeTab === "analytics" });
  const workflowsQ = useQuery({ queryKey: ["approval-workflows"],    queryFn: () => apiGet<Workflow[]>("/approval-workflows") });

  const tabData: Record<Tab, ApprovalRequest[]> = {
    pending:   (pendingQ.data   ?? []) as ApprovalRequest[],
    requests:  (requestsQ.data  ?? []) as ApprovalRequest[],
    queue:     (queueQ.data     ?? []) as ApprovalRequest[],
    delegated: (delegatedQ.data ?? []) as ApprovalRequest[],
    history:   (historyQ.data   ?? []) as ApprovalRequest[],
    analytics: [],
    workflows: [],
    delegates: [],
  };
  const tabLoading: Record<Tab, boolean> = {
    pending:   pendingQ.isLoading,   requests:  requestsQ.isLoading,
    queue:     queueQ.isLoading,     delegated: delegatedQ.isLoading,
    history:   historyQ.isLoading,   analytics: analyticsQ.isLoading,
    workflows: workflowsQ.isLoading, delegates: false,
  };

  const invalidateAll = () => qc.invalidateQueries({ queryKey: ["approvals"] });

  /* Mutations */
  const approveMut = useMutation({
    mutationFn: ({ id, comment }: { id: number; comment: string }) =>
      apiPatch(`/approvals/${id}/approve`, { comment }),
    onSuccess: () => { toast({ title: "Approved ✓", description: "The request has been approved." }); invalidateAll(); setSheetOpen(false); },
    onError: () => toast({ title: "Failed to approve", variant: "destructive" }),
  });
  const rejectMut = useMutation({
    mutationFn: ({ id, comment }: { id: number; comment: string }) =>
      apiPatch(`/approvals/${id}/reject`, { comment }),
    onSuccess: () => { toast({ title: "Rejected", description: "The request has been returned." }); invalidateAll(); setSheetOpen(false); setRejectTarget(null); setRejectReason(""); },
    onError: () => toast({ title: "Failed to reject", variant: "destructive" }),
  });
  const recallMut = useMutation({
    mutationFn: (id: number) => apiPatch(`/approvals/${id}/recall`, {}),
    onSuccess: () => { toast({ title: "Recalled" }); invalidateAll(); setSheetOpen(false); },
    onError: () => toast({ title: "Failed to recall", variant: "destructive" }),
  });
  const commentMut = useMutation({
    mutationFn: ({ id, comment }: { id: number; comment: string }) =>
      apiPost(`/approvals/${id}/comment`, { comment }),
    onSuccess: () => { toast({ title: "Comment added" }); invalidateAll(); },
    onError: () => toast({ title: "Failed to add comment", variant: "destructive" }),
  });
  const submitMut = useMutation({
    mutationFn: (data: any) => apiPost("/approvals", data),
    onSuccess: () => { toast({ title: "Request submitted ✓" }); invalidateAll(); },
    onError: () => toast({ title: "Failed to submit request", variant: "destructive" }),
  });
  const seedMut = useMutation({
    mutationFn: () => apiPost("/approvals/seed", {}),
    onSuccess: (r: any) => {
      toast({ title: "Demo data loaded", description: `${r.workflows} workflows · ${r.requests} requests` });
      invalidateAll();
      qc.invalidateQueries({ queryKey: ["approval-workflows"] });
    },
    onError: () => toast({ title: "Seed failed", variant: "destructive" }),
  });

  const bulkApprove = (ids: number[]) => {
    ids.forEach(id => approveMut.mutate({ id, comment: "Bulk approved" }));
  };
  const bulkReject = (ids: number[]) => {
    ids.forEach(id => rejectMut.mutate({ id, comment: "Bulk rejected" }));
  };

  const [, setLocation] = useLocation();

  const openDetail = (req: ApprovalRequest) => {
    // Navigate directly to the entity detail page for known entity types
    if (req.entityType === "quotation" && req.entityRef) {
      // Find the quotation by entityRef — navigate to the list and rely on entityUrl if set
      if (req.entityUrl) { setLocation(req.entityUrl); return; }
      // Fallback: open in sheet
    }
    setSelectedReq(req); setSheetOpen(true);
  };

  // Header stats
  const pendingCount   = (pendingQ.data?.length   ?? 0) as number;
  const queueCount     = (queueQ.data?.length     ?? 0) as number;
  const overdueCount   = ((tabData.pending) as ApprovalRequest[])
    .filter(r => r.slaDeadline && new Date(r.slaDeadline) < new Date()).length;

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }} className="flex flex-col h-full pb-8">

      {/* ── Page header ─────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <CheckSquare className="h-5 w-5 text-primary" />Approval Workbench
          </h1>
          <p className="text-[12px] text-muted-foreground mt-0.5">Centralized approval management across all modules</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {pendingCount > 0 && (
            <div className="flex items-center gap-1.5 bg-amber-50 border border-amber-200 text-amber-700 px-3 py-1.5 rounded-lg text-[12px] font-semibold">
              <Clock className="h-3.5 w-3.5" />{pendingCount} awaiting your action
            </div>
          )}
          {overdueCount > 0 && (
            <div className="flex items-center gap-1.5 bg-red-50 border border-red-200 text-red-700 px-3 py-1.5 rounded-lg text-[12px] font-semibold">
              <AlertTriangle className="h-3.5 w-3.5" />{overdueCount} SLA overdue
            </div>
          )}
          {workflowsQ.data?.length === 0 && (
            <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5 text-muted-foreground" onClick={() => seedMut.mutate()} disabled={seedMut.isPending}>
              <Zap className="h-3.5 w-3.5" />{seedMut.isPending ? "Loading…" : "Load demo data"}
            </Button>
          )}
          <Button size="sm" className="h-8 text-xs gap-1.5" onClick={() => setNewOpen(true)}>
            <Plus className="h-3.5 w-3.5" />New Request
          </Button>
        </div>
      </div>

      {/* ── Tab bar ─────────────────────────────────────────────────── */}
      <div className="flex items-end gap-0 border-b border-border overflow-x-auto">
        {TABS.map(t => {
          const count = t.key === "pending" ? pendingQ.data?.length
                      : t.key === "queue"   ? queueQ.data?.length
                      : undefined;
          const Icon = t.icon;
          return (
            <button key={t.key} onClick={() => setActiveTab(t.key)} className={cn(
              "flex items-center gap-1.5 px-4 py-2.5 text-[12px] font-semibold border-b-2 transition-all whitespace-nowrap shrink-0",
              activeTab === t.key
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
            )}>
              <Icon className="h-3.5 w-3.5" />
              {t.label}
              {count != null && count > 0 && (
                <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none",
                  activeTab === t.key ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"
                )}>{count}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Tab content ─────────────────────────────────────────────── */}
      <div className="mt-5 flex-1 min-h-0">
        {activeTab === "analytics" ? (
          <AnalyticsPanel analytics={analyticsQ.data} />
        ) : activeTab === "workflows" ? (
          <WorkflowBuilder
            workflows={workflowsQ.data ?? []}
            onRefresh={() => qc.invalidateQueries({ queryKey: ["approval-workflows"] })}
          />
        ) : activeTab === "delegates" ? (
          <DelegatesPanel currentUserId={(user as any)?.id ?? 0} />
        ) : (
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <RequestList
              items={tabData[activeTab]}
              loading={tabLoading[activeTab]}
              tab={activeTab}
              user={user}
              onOpen={openDetail}
              onApprove={req => approveMut.mutate({ id: req.id, comment: "" })}
              onReject={req => { setRejectTarget(req); setRejectReason(""); }}
              onBulkApprove={bulkApprove}
              onBulkReject={bulkReject}
            />
          </div>
        )}
      </div>

      {/* ── Detail Sheet ─────────────────────────────────────────────── */}
      <DetailSheet
        req={selectedReq} open={sheetOpen} onClose={() => setSheetOpen(false)}
        canAct={(() => {
          if (!selectedReq || selectedReq.status !== "pending") return false;
          const curSteps = selectedReq.steps.filter(s => s.stepOrder === selectedReq.currentStep && s.status === "pending");
          return curSteps.some(s =>
            (s.approverRole && s.approverRole === user?.role) ||
            (s.approverUserId && s.approverUserId === (user as any)?.id)
          );
        })()}
        onApprove={comment => selectedReq && approveMut.mutate({ id: selectedReq.id, comment })}
        onReject={reason => selectedReq && setRejectTarget(selectedReq)}
        onRecall={() => selectedReq && recallMut.mutate(selectedReq.id)}
        onComment={comment => selectedReq && commentMut.mutate({ id: selectedReq.id, comment })}
      />

      {/* ── Reject dialog ───────────────────────────────────────────── */}
      <Dialog open={!!rejectTarget} onOpenChange={v => !v && setRejectTarget(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle className="flex items-center gap-2 text-red-600"><XCircle className="h-4 w-4" />Reject Request</DialogTitle></DialogHeader>
          <div className="space-y-3 pt-1">
            <p className="text-[13px] text-foreground font-medium">{rejectTarget?.title}</p>
            <div>
              <Label>Reason <span className="text-red-500">*</span></Label>
              <Textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)}
                placeholder="Provide a clear reason for rejection…"
                className="mt-1 min-h-[80px] resize-none" autoFocus />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectTarget(null)}>Cancel</Button>
            <Button variant="destructive" disabled={!rejectReason.trim() || rejectMut.isPending}
              onClick={() => rejectTarget && rejectMut.mutate({ id: rejectTarget.id, comment: rejectReason })}>
              {rejectMut.isPending ? "Rejecting…" : "Reject Request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── New Request Dialog ───────────────────────────────────────── */}
      <NewRequestDialog
        open={newOpen} onClose={() => setNewOpen(false)}
        workflows={workflowsQ.data ?? []}
        onSubmit={data => submitMut.mutate(data)}
      />
    </motion.div>
  );
}
