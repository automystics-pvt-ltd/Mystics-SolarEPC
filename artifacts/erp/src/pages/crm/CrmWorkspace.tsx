// @refresh reset
import { useState, useMemo } from "react";
import {
  useGetLeads, useCreateLead, useGetLeadsPipelineSummary,
  useGetQuotations, useGetClientPOs, useGetCrmInvoices,
  useGetTasks, useGetEscalations,
  getGetLeadsQueryKey, getGetLeadsPipelineSummaryQueryKey, getGetQuotationsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/components/ui/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@/lib/zodResolver";
import { z } from "zod";
import { motion, AnimatePresence } from "framer-motion";
import { format, differenceInDays } from "date-fns";
import { cn } from "@/lib/utils";
import { useLocation } from "wouter";
import {
  Users2, Target, FileText, FileCheck, Receipt, CheckSquare, AlertTriangle,
  Plus, Search, Filter, TrendingUp, DollarSign, Clock, Loader2,
  Building2, Phone, Mail, MoreHorizontal, ChevronRight,
  Zap, ArrowUpRight, Eye, Calendar, Tag,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { SkeletonList, EmptyState, StatusBadge, PageHeader } from "@/components/shared";
import { ExportButton } from "@/components/shared";
import { CanCreate, CanExport } from "@/lib/permissions";
import { CrmLeadSheet } from "./CrmLeadSheet";

/* ── Constants ───────────────────────────────────────────────────────────── */

type Section = "pipeline" | "quotations" | "client-pos" | "invoices" | "tasks" | "escalations";

const SECTIONS: { key: Section; label: string; icon: React.FC<any> }[] = [
  { key: "pipeline",    label: "Pipeline",    icon: Users2 },
  { key: "quotations",  label: "Quotations",  icon: FileText },
  { key: "client-pos",  label: "Client POs",  icon: FileCheck },
  { key: "invoices",    label: "Invoices",    icon: Receipt },
  { key: "tasks",       label: "Tasks",       icon: CheckSquare },
  { key: "escalations", label: "Escalations", icon: AlertTriangle },
];

const PIPELINE_STAGES = [
  { key: "New",         label: "New",          color: "bg-blue-500",    light: "bg-blue-50 border-blue-200 text-blue-700",    dot: "bg-blue-500"    },
  { key: "Contacted",   label: "Contacted",    color: "bg-indigo-500",  light: "bg-indigo-50 border-indigo-200 text-indigo-700",  dot: "bg-indigo-500"  },
  { key: "Qualified",   label: "Qualified",    color: "bg-violet-500",  light: "bg-violet-50 border-violet-200 text-violet-700",  dot: "bg-violet-500"  },
  { key: "Proposal",    label: "Proposal",     color: "bg-amber-500",   light: "bg-amber-50 border-amber-200 text-amber-700",   dot: "bg-amber-500"   },
  { key: "Negotiation", label: "Negotiation",  color: "bg-orange-500",  light: "bg-orange-50 border-orange-200 text-orange-700",  dot: "bg-orange-500"  },
  { key: "Closed Won",  label: "Won",          color: "bg-emerald-500", light: "bg-emerald-50 border-emerald-200 text-emerald-700", dot: "bg-emerald-500" },
  { key: "Closed Lost", label: "Lost",         color: "bg-rose-400",    light: "bg-rose-50 border-rose-200 text-rose-600",    dot: "bg-rose-400"    },
];

const SOURCE_OPTIONS = [
  { value: "Inbound", label: "Inbound" }, { value: "Outbound", label: "Outbound" },
  { value: "Referral", label: "Referral" }, { value: "Website", label: "Website" },
  { value: "IndiaMART", label: "IndiaMART" }, { value: "JustDial", label: "JustDial" },
  { value: "Card-scan", label: "Card Scan / Event" }, { value: "Digital", label: "Digital / Social" },
  { value: "Tender", label: "Tender / Bid" },
];

const STAGE_OPTIONS = [
  { value: "New", label: "New" }, { value: "Contacted", label: "Contacted" },
  { value: "Qualified", label: "Qualified" }, { value: "Proposal", label: "Proposal" },
  { value: "Negotiation", label: "Negotiation" },
];

const TERRITORY_OPTIONS = [
  "Andhra Pradesh","Arunachal Pradesh","Assam","Bihar","Chhattisgarh","Goa","Gujarat",
  "Haryana","Himachal Pradesh","Jharkhand","Karnataka","Kerala","Madhya Pradesh","Maharashtra",
  "Manipur","Meghalaya","Mizoram","Nagaland","Odisha","Punjab","Rajasthan","Sikkim",
  "Tamil Nadu","Telangana","Tripura","Uttar Pradesh","Uttarakhand","West Bengal",
  "Delhi","Jammu & Kashmir","Chandigarh","Puducherry",
].map(s => ({ value: s, label: s }));

/* ── Create Lead Schema ───────────────────────────────────────────────────── */
const createLeadSchema = z.object({
  companyName:    z.string().min(1, "Required"),
  contactName:    z.string().min(1, "Required"),
  contactEmail:   z.string().email().optional().or(z.literal("")),
  contactPhone:   z.string().optional(),
  source:         z.string().min(1, "Required"),
  status:         z.string().min(1),
  territory:      z.string().optional(),
  estimatedValue: z.coerce.number().optional(),
  productInterest:z.string().optional(),
  notes:          z.string().optional(),
});

/* ── Helpers ─────────────────────────────────────────────────────────────── */
function ScoreBar({ score }: { score?: number | null }) {
  const s = Math.min(100, score ?? 0);
  return (
    <div className="flex items-center gap-1.5">
      <div className="h-1 flex-1 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all",
            s > 70 ? "bg-emerald-500" : s > 40 ? "bg-amber-400" : "bg-gray-300")}
          style={{ width: `${s}%` }}
        />
      </div>
      <span className="text-[10px] font-bold font-mono text-gray-500 w-5 text-right">{s}</span>
    </div>
  );
}

function SearchableCombo({ value, onChange, options, placeholder = "Select…" }: {
  value: string; onChange: (v: string) => void;
  options: { value: string; label: string }[]; placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const sel = options.find(o => o.value === value);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" className="h-10 w-full justify-between font-normal text-sm bg-gray-50">
          {sel?.label ?? <span className="text-gray-400">{placeholder}</span>}
          <ChevronRight className="ml-2 h-3.5 w-3.5 opacity-40 rotate-90" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search…" className="h-9 text-sm" />
          <CommandList className="max-h-52">
            <CommandEmpty className="py-4 text-center text-sm text-gray-400">No match</CommandEmpty>
            <CommandGroup>
              {options.map(o => (
                <CommandItem key={o.value} value={o.label} onSelect={() => { onChange(o.value); setOpen(false); }} className="text-sm cursor-pointer">
                  {o.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

/* ── Lead Card (Kanban) ───────────────────────────────────────────────────── */
function LeadCard({ lead, stageColor, onClick }: { lead: any; stageColor: string; onClick: () => void }) {
  const daysOld = differenceInDays(new Date(), new Date(lead.createdAt));
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -1 }}
      onClick={onClick}
      className="group bg-white rounded-xl border border-gray-100 p-3.5 cursor-pointer hover:shadow-md hover:border-gray-200 transition-all relative overflow-hidden"
    >
      {/* Left color accent */}
      <div className={cn("absolute left-0 top-0 bottom-0 w-[3px] rounded-l-xl", stageColor)} />
      <div className="pl-1">
        <div className="flex items-start justify-between gap-2 mb-2">
          <p className="font-bold text-[13px] text-gray-900 leading-tight group-hover:text-[#EA580C] transition-colors line-clamp-1">
            {lead.companyName}
          </p>
          <ArrowUpRight className="h-3.5 w-3.5 text-gray-300 group-hover:text-[#EA580C] shrink-0 transition-colors" />
        </div>
        <p className="text-[11px] text-gray-500 font-medium mb-2.5 flex items-center gap-1">
          <Building2 className="h-3 w-3 shrink-0" />
          <span className="truncate">{lead.contactName}</span>
        </p>
        {lead.estimatedValue ? (
          <p className="font-mono font-bold text-[13px] text-gray-800 mb-2.5">
            ₹{Number(lead.estimatedValue).toLocaleString("en-IN")}
          </p>
        ) : (
          <p className="text-[12px] text-gray-400 mb-2.5">No value set</p>
        )}
        <ScoreBar score={lead.score} />
        <div className="flex items-center justify-between mt-2.5">
          <span className="text-[10px] text-gray-400 font-medium">
            <Clock className="h-3 w-3 inline mr-0.5" />{daysOld}d ago
          </span>
          {lead.source && (
            <span className="text-[10px] font-bold text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded-md border border-gray-100">
              {lead.source}
            </span>
          )}
        </div>
      </div>
    </motion.div>
  );
}

/* ── Pipeline Kanban ─────────────────────────────────────────────────────── */
function PipelineSection({ leads, loading, onLeadClick, search }: {
  leads: any[]; loading: boolean; onLeadClick: (id: number) => void; search: string;
}) {
  const filtered = useMemo(() =>
    leads.filter(l =>
      l.companyName?.toLowerCase().includes(search.toLowerCase()) ||
      l.contactName?.toLowerCase().includes(search.toLowerCase())
    ), [leads, search]);

  if (loading) return <SkeletonList rows={6} />;
  if (!leads.length) return (
    <EmptyState icon={Target} heading="No leads yet" message="Add your first lead to start tracking the pipeline." />
  );

  return (
    <div
      className="flex gap-3 sm:gap-4 overflow-x-auto pb-4 -mx-1 px-1"
      style={{
        scrollbarWidth: "thin",
        scrollSnapType: "x mandatory",
        WebkitOverflowScrolling: "touch",
      }}
    >
      {PIPELINE_STAGES.map(stage => {
        const stageLeads = filtered.filter(l => l.status === stage.key);
        const stageValue = stageLeads.reduce((s, l) => s + Number(l.estimatedValue || 0), 0);
        return (
          <div
            key={stage.key}
            className="flex flex-col shrink-0 w-[82vw] max-w-[268px] sm:w-[268px]"
            style={{ scrollSnapAlign: "start" }}
          >
            {/* Column header */}
            <div className="flex items-center justify-between mb-3 px-0.5">
              <div className="flex items-center gap-2">
                <div className={cn("w-2 h-2 rounded-full", stage.dot)} />
                <span className="font-bold text-[12px] text-gray-700 uppercase tracking-wider">{stage.label}</span>
                <span className="text-[11px] font-bold text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full tabular-nums">
                  {stageLeads.length}
                </span>
              </div>
              {stageValue > 0 && (
                <span className="text-[10px] font-mono font-bold text-gray-400">
                  ₹{(stageValue / 100000).toFixed(1)}L
                </span>
              )}
            </div>
            {/* Stage top bar */}
            <div className={cn("h-[3px] rounded-full mb-3", stage.color)} />
            {/* Cards */}
            <div className="flex flex-col gap-2.5 min-h-[200px]">
              {stageLeads.length === 0 ? (
                <div className="border-2 border-dashed border-gray-100 rounded-xl h-24 flex items-center justify-center">
                  <p className="text-[11px] text-gray-300 font-medium">No leads</p>
                </div>
              ) : (
                stageLeads.map(lead => (
                  <LeadCard
                    key={lead.id}
                    lead={lead}
                    stageColor={stage.color}
                    onClick={() => onLeadClick(lead.id)}
                  />
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ── Quotations Section ──────────────────────────────────────────────────── */
function QuotationsSection({ quotations, loading, search }: {
  quotations: any[]; loading: boolean; search: string;
}) {
  const [, setLocation] = useLocation();
  const [statusFilter, setStatusFilter] = useState("all");
  const filtered = useMemo(() =>
    quotations.filter(q => {
      const matchSearch = search === "" || `QTN-${String(q.id).padStart(4,"0")}`.includes(search.toUpperCase()) || String(q.leadId).includes(search);
      const matchStatus = statusFilter === "all" || q.approvalStatus === statusFilter;
      return matchSearch && matchStatus;
    }), [quotations, search, statusFilter]);

  if (loading) return <SkeletonList rows={8} />;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 items-center">
        {["all","Draft","Pending","Approved","Rejected"].map(s => (
          <button key={s} onClick={() => setStatusFilter(s)}
            className={cn("px-3 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-wide transition-all border",
              statusFilter === s ? "bg-[#0A0F2C] text-white border-[#0A0F2C]" : "bg-white text-gray-500 border-gray-200 hover:border-gray-300"
            )}>
            {s === "all" ? "All" : s}
          </button>
        ))}
      </div>
      {filtered.length === 0 ? (
        <EmptyState icon={FileText} heading="No quotations" message="Create a quotation from a lead's detail panel." />
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm">
          {filtered.map((q, i) => (
            <div
              key={q.id}
              onClick={() => setLocation(`/crm/quotations/${q.id}`)}
              className={cn(
                "flex items-center justify-between px-5 py-3.5 cursor-pointer hover:bg-gray-50 transition-colors group",
                i !== filtered.length - 1 && "border-b border-gray-50"
              )}
            >
              <div className="flex items-center gap-4">
                <div className="h-9 w-9 rounded-lg bg-orange-50 text-[#EA580C] flex items-center justify-center shrink-0">
                  <FileText className="h-4 w-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-sm text-gray-900 group-hover:text-[#EA580C] transition-colors">
                      QTN-{String(q.id).padStart(4,"0")}
                    </span>
                    <StatusBadge status={q.approvalStatus} size="sm" />
                    <span className="text-[11px] text-gray-400">v{q.version}</span>
                  </div>
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    Lead LD-{String(q.leadId).padStart(4,"0")} ·{" "}
                    {q.validTill ? `Valid till ${format(new Date(q.validTill), "MMM d, yyyy")}` : "No expiry set"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <span className="font-mono font-bold text-[15px] text-gray-900">
                  ₹{Number(q.totalAmount || 0).toLocaleString("en-IN")}
                </span>
                <ChevronRight className="h-4 w-4 text-gray-300 group-hover:text-[#EA580C] transition-colors" />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Client POs Section ──────────────────────────────────────────────────── */
function ClientPOsSection({ pos, loading, search }: {
  pos: any[]; loading: boolean; search: string;
}) {
  const [, setLocation] = useLocation();
  const filtered = useMemo(() =>
    pos.filter(p => search === "" || p.clientPoNumber?.toLowerCase().includes(search.toLowerCase())),
    [pos, search]);

  if (loading) return <SkeletonList rows={6} />;
  if (!pos.length) return <EmptyState icon={FileCheck} heading="No client POs" message="Client purchase orders appear here once received." />;

  return (
    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm">
      {filtered.map((p, i) => (
        <div
          key={p.id}
          className={cn("flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors group",
            i !== filtered.length - 1 && "border-b border-gray-50"
          )}
        >
          <div className="flex items-center gap-4">
            <div className="h-9 w-9 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
              <FileCheck className="h-4 w-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono font-bold text-sm text-gray-900">{p.clientPoNumber}</span>
                <StatusBadge status={p.status} size="sm" />
              </div>
              <p className="text-[11px] text-gray-400 mt-0.5">
                {format(new Date(p.createdAt), "MMM d, yyyy")}
                {p.projectId && (
                  <button
                    onClick={e => { e.stopPropagation(); setLocation(`/projects/${p.projectId}`); }}
                    className="ml-2 text-[#EA580C] font-semibold hover:underline"
                  >
                    → PRJ-{String(p.projectId).padStart(4,"0")}
                  </button>
                )}
              </p>
            </div>
          </div>
          <span className="font-mono font-bold text-[15px] text-gray-900">
            ₹{Number(p.contractValue || 0).toLocaleString("en-IN")}
          </span>
        </div>
      ))}
    </div>
  );
}

/* ── Invoices Section ────────────────────────────────────────────────────── */
function InvoicesSection({ invoices, loading, search }: {
  invoices: any[]; loading: boolean; search: string;
}) {
  const filtered = useMemo(() =>
    invoices.filter(inv => search === "" || `INV-${String(inv.id).padStart(4,"0")}`.includes(search.toUpperCase())),
    [invoices, search]);

  if (loading) return <SkeletonList rows={6} />;
  if (!invoices.length) return <EmptyState icon={Receipt} heading="No invoices" message="Client invoices will appear here once created." />;

  return (
    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm">
      {filtered.map((inv, i) => {
        const isOverdue = inv.paymentStatus !== "Paid" && inv.dueDate && new Date(inv.dueDate) < new Date();
        return (
          <div
            key={inv.id}
            className={cn("flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors",
              i !== filtered.length - 1 && "border-b border-gray-50",
              isOverdue && "bg-red-50/40 hover:bg-red-50/60"
            )}
          >
            <div className="flex items-center gap-4">
              <div className={cn("h-9 w-9 rounded-lg flex items-center justify-center shrink-0",
                isOverdue ? "bg-red-100 text-red-600" : "bg-blue-50 text-blue-600"
              )}>
                <DollarSign className="h-4 w-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-sm text-gray-900">
                    INV-{String(inv.id).padStart(4,"0")}
                  </span>
                  <StatusBadge status={inv.paymentStatus} size="sm" />
                  {isOverdue && <span className="text-[10px] font-bold text-red-600 bg-red-100 px-1.5 py-0.5 rounded">OVERDUE</span>}
                </div>
                <p className="text-[11px] text-gray-400 mt-0.5">
                  {inv.type} · Due {inv.dueDate ? format(new Date(inv.dueDate), "MMM d, yyyy") : "—"}
                </p>
              </div>
            </div>
            <span className="font-mono font-bold text-[15px] text-gray-900">
              ₹{Number(inv.amount || 0).toLocaleString("en-IN")}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/* ── Tasks Section ───────────────────────────────────────────────────────── */
function TasksSection({ tasks, loading, search }: {
  tasks: any[]; loading: boolean; search: string;
}) {
  const filtered = useMemo(() =>
    tasks.filter(t => search === "" || t.title?.toLowerCase().includes(search.toLowerCase())),
    [tasks, search]);

  if (loading) return <SkeletonList rows={6} />;
  if (!tasks.length) return <EmptyState icon={CheckSquare} heading="No tasks" message="Tasks and action items will appear here." />;

  const priorityColor: Record<string, string> = {
    High: "text-red-700 bg-red-50 border-red-200",
    Medium: "text-amber-700 bg-amber-50 border-amber-200",
    Low: "text-gray-600 bg-gray-100 border-gray-200",
  };

  return (
    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm">
      {filtered.map((task, i) => {
        const isOverdue = task.status !== "Done" && task.dueDate && new Date(task.dueDate) < new Date();
        return (
          <div
            key={task.id}
            className={cn("flex items-center justify-between px-5 py-3.5",
              i !== filtered.length - 1 && "border-b border-gray-50",
              "hover:bg-gray-50 transition-colors"
            )}
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="h-4 w-4 rounded border-2 border-gray-200 shrink-0 flex items-center justify-center">
                {task.status === "Done" && <div className="h-2 w-2 rounded-full bg-emerald-500" />}
              </div>
              <div className="min-w-0">
                <p className={cn("text-[13px] font-semibold text-gray-900 truncate", task.status === "Done" && "line-through text-gray-400")}>
                  {task.title}
                </p>
                <p className="text-[11px] text-gray-400 mt-0.5">
                  {task.ownerName ?? "Unassigned"} · Due {task.dueDate ? format(new Date(task.dueDate), "MMM d") : "—"}
                  {isOverdue && <span className="ml-1 text-red-500 font-bold">· Overdue</span>}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <StatusBadge status={task.status} size="sm" />
              {task.priority && (
                <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded border uppercase tracking-wide",
                  priorityColor[task.priority] ?? priorityColor.Low)}>
                  {task.priority}
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ── Escalations Section ─────────────────────────────────────────────────── */
function EscalationsSection({ escalations, loading, search }: {
  escalations: any[]; loading: boolean; search: string;
}) {
  const filtered = useMemo(() =>
    escalations.filter(e => search === "" || e.reason?.toLowerCase().includes(search.toLowerCase())),
    [escalations, search]);

  if (loading) return <SkeletonList rows={6} />;
  if (!escalations.length) return <EmptyState icon={AlertTriangle} heading="No escalations" message="All clear — no issues require attention." />;

  return (
    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm">
      {filtered.map((esc, i) => (
        <div
          key={esc.id}
          className={cn("flex items-center justify-between px-5 py-4",
            i !== filtered.length - 1 && "border-b border-gray-50",
            "hover:bg-gray-50 transition-colors"
          )}
        >
          <div className="flex items-center gap-4">
            <div className="h-9 w-9 rounded-lg bg-red-50 text-red-600 flex items-center justify-center shrink-0">
              <AlertTriangle className="h-4 w-4" />
            </div>
            <div>
              <p className="font-semibold text-[13px] text-gray-900">{esc.reason}</p>
              <p className="text-[11px] text-gray-400 mt-0.5">
                {esc.module} · {esc.raisedByName} · {format(new Date(esc.createdAt), "MMM d, yyyy")}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge status={esc.severity} size="sm" />
            <StatusBadge status={esc.status} size="sm" />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── Create Lead Dialog ──────────────────────────────────────────────────── */
function CreateLeadDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const form = useForm<z.infer<typeof createLeadSchema>>({
    resolver: zodResolver(createLeadSchema),
    defaultValues: {
      companyName: "", contactName: "", contactEmail: "", contactPhone: "",
      source: "Inbound", status: "New", territory: "", productInterest: "", notes: "",
    },
  });

  const createMut = useCreateLead({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetLeadsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetLeadsPipelineSummaryQueryKey() });
        toast({ title: "Lead created", description: "New lead added to your pipeline." });
        onClose();
        form.reset();
      },
      onError: (e: any) => toast({ variant: "destructive", title: "Failed to create lead", description: e?.message }),
    },
  });

  return (
    <Dialog open={open} onOpenChange={o => { if (!o) onClose(); }}>
      <DialogContent className="max-w-2xl p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-6 py-5 border-b border-gray-100 bg-gray-50/60">
          <DialogTitle className="text-xl font-bold tracking-tight">New Lead</DialogTitle>
          <p className="text-sm text-gray-500 mt-0.5">Fill in the details to qualify this opportunity.</p>
        </DialogHeader>
        <div className="overflow-y-auto max-h-[75vh] px-6 py-5">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(d => createMut.mutate({ data: d }))} className="space-y-5">
              {/* Company & Contact */}
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Company &amp; Contact</p>
                <div className="space-y-4">
                  <FormField control={form.control} name="companyName" render={({ field }) => (
                    <FormItem><FormLabel className="text-xs font-bold uppercase tracking-wider text-gray-700">Company Name *</FormLabel>
                      <FormControl><Input className="h-10 bg-gray-50" placeholder="e.g. Sunrise Infra Pvt Ltd" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField control={form.control} name="contactName" render={({ field }) => (
                      <FormItem><FormLabel className="text-xs font-bold uppercase tracking-wider text-gray-700">Contact Person *</FormLabel>
                        <FormControl><Input className="h-10 bg-gray-50" placeholder="Full name" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="contactPhone" render={({ field }) => (
                      <FormItem><FormLabel className="text-xs font-bold uppercase tracking-wider text-gray-700">Phone</FormLabel>
                        <FormControl><Input className="h-10 bg-gray-50" placeholder="+91 98765 43210" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>
                  <FormField control={form.control} name="contactEmail" render={({ field }) => (
                    <FormItem><FormLabel className="text-xs font-bold uppercase tracking-wider text-gray-700">Email</FormLabel>
                      <FormControl><Input className="h-10 bg-gray-50" type="email" placeholder="contact@company.com" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
              </div>
              {/* Qualification */}
              <div className="border-t border-gray-100 pt-5">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Qualification</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField control={form.control} name="status" render={({ field }) => (
                    <FormItem><FormLabel className="text-xs font-bold uppercase tracking-wider text-gray-700">Stage</FormLabel>
                      <FormControl>
                        <SearchableCombo value={field.value ?? ""} onChange={field.onChange} options={STAGE_OPTIONS} placeholder="Select stage…" />
                      </FormControl><FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="source" render={({ field }) => (
                    <FormItem><FormLabel className="text-xs font-bold uppercase tracking-wider text-gray-700">Lead Source *</FormLabel>
                      <FormControl>
                        <SearchableCombo value={field.value ?? ""} onChange={field.onChange} options={SOURCE_OPTIONS} placeholder="Select source…" />
                      </FormControl><FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="estimatedValue" render={({ field }) => (
                    <FormItem><FormLabel className="text-xs font-bold uppercase tracking-wider text-gray-700">Est. Value (₹)</FormLabel>
                      <FormControl><Input className="h-10 bg-gray-50 font-mono" type="number" min="0" placeholder="0" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="territory" render={({ field }) => (
                    <FormItem><FormLabel className="text-xs font-bold uppercase tracking-wider text-gray-700">Territory</FormLabel>
                      <FormControl>
                        <SearchableCombo value={field.value ?? ""} onChange={field.onChange} options={TERRITORY_OPTIONS} placeholder="Select state…" />
                      </FormControl><FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="productInterest" render={({ field }) => (
                    <FormItem className="sm:col-span-2">
                      <FormLabel className="text-xs font-bold uppercase tracking-wider text-gray-700">Product / Capacity Interest</FormLabel>
                      <FormControl><Input className="h-10 bg-gray-50" placeholder="e.g. 50 kWp Rooftop Solar" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
              </div>
              {/* Notes */}
              <div className="border-t border-gray-100 pt-5">
                <FormField control={form.control} name="notes" render={({ field }) => (
                  <FormItem><FormLabel className="text-xs font-bold uppercase tracking-wider text-gray-700">Initial Notes</FormLabel>
                    <FormControl>
                      <textarea {...field} rows={3} placeholder="Meeting context, referral background, next steps..."
                        className="w-full px-3 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-[6px] focus:outline-none focus:ring-1 focus:ring-[#EA580C] focus:border-[#EA580C] resize-none"
                      />
                    </FormControl><FormMessage />
                  </FormItem>
                )} />
              </div>
              <Button type="submit" disabled={createMut.isPending}
                className="w-full h-11 bg-[#0A0F2C] hover:bg-[#0A0F2C]/90 text-white font-bold rounded-[8px]">
                {createMut.isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Creating…</> : "Create Lead"}
              </Button>
            </form>
          </Form>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ── Main Workspace ──────────────────────────────────────────────────────── */
export function CrmWorkspace() {
  const [section, setSection]           = useState<Section>("pipeline");
  const [selectedLeadId, setSelectedLeadId] = useState<number | null>(null);
  const [isCreateLeadOpen, setIsCreateLeadOpen] = useState(false);
  const [search, setSearch]             = useState("");

  // Data
  const { data: rawLeads,       isPending: leadsLoading }      = useGetLeads({});
  const { data: summary }                                         = useGetLeadsPipelineSummary();
  const { data: rawQuotations,  isPending: quotationsLoading }  = useGetQuotations({}, { query: { queryKey: getGetQuotationsQueryKey({}) } });
  const { data: rawClientPOs,   isPending: posLoading }         = useGetClientPOs();
  const { data: rawInvoices,    isPending: invoicesLoading }    = useGetCrmInvoices();
  const { data: rawTasks,       isPending: tasksLoading }       = useGetTasks();
  const { data: rawEscalations, isPending: escalationsLoading } = useGetEscalations();
  // Guard against null/non-array responses (data defaults to undefined but
  // placeholderData or null server responses can bypass the = [] fallback).
  const leads      = Array.isArray(rawLeads)       ? rawLeads       : [];
  const quotations = Array.isArray(rawQuotations)  ? rawQuotations  : [];
  const clientPOs  = Array.isArray(rawClientPOs)   ? rawClientPOs   : [];
  const invoices   = Array.isArray(rawInvoices)    ? rawInvoices    : [];
  const tasks      = Array.isArray(rawTasks)       ? rawTasks       : [];
  const escalations = Array.isArray(rawEscalations) ? rawEscalations : [];

  // Computed metrics
  const metrics = useMemo(() => ({
    pipeline:   Number(summary?.totalValue || 0),
    activeLeads: (leads as any[]).filter(l => !["Closed Won","Closed Lost"].includes(l.status)).length,
    pendingQuotations: (quotations as any[]).filter(q => q.approvalStatus === "Pending").length,
    overdueInvoices: (invoices as any[]).filter(inv => inv.paymentStatus !== "Paid" && inv.dueDate && new Date(inv.dueDate) < new Date()).length,
  }), [summary, leads, quotations, invoices]);

  const sectionCounts: Record<Section, number> = {
    pipeline:    (leads as any[]).length,
    quotations:  (quotations as any[]).length,
    "client-pos": (clientPOs as any[]).length,
    invoices:    (invoices as any[]).length,
    tasks:       (tasks as any[]).filter((t: any) => t.status !== "Done").length,
    escalations: (escalations as any[]).filter((e: any) => !["Resolved","Closed"].includes(e.status)).length,
  };

  const sectionTitle: Record<Section, string> = {
    pipeline: "Sales Pipeline", quotations: "Quotations", "client-pos": "Client POs",
    invoices: "Client Invoices", tasks: "Tasks", escalations: "Escalations",
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col h-full space-y-4 pb-10">

      {/* ── Top Stats Bar ────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
            <Zap className="h-6 w-6 text-[#EA580C]" /> Sales &amp; CRM
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Complete revenue lifecycle — pipeline to payment</p>
        </div>
        <CanCreate module="crm">
          <Button
            onClick={() => setIsCreateLeadOpen(true)}
            className="bg-[#EA580C] hover:bg-[#C2410C] text-white font-bold rounded-[8px] h-10 px-5 gap-2 shadow-sm"
          >
            <Plus className="h-4 w-4" /> New Lead
          </Button>
        </CanCreate>
      </div>

      {/* Metric chips */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Pipeline Value",     value: `₹${(metrics.pipeline/100000).toFixed(1)}L`,  icon: TrendingUp, color: "text-violet-600 bg-violet-50"  },
          { label: "Active Leads",       value: metrics.activeLeads,                            icon: Target,     color: "text-blue-600 bg-blue-50"      },
          { label: "Pending Approvals",  value: metrics.pendingQuotations,                      icon: FileText,   color: "text-amber-600 bg-amber-50"    },
          { label: "Overdue Invoices",   value: metrics.overdueInvoices,                        icon: Receipt,    color: metrics.overdueInvoices > 0 ? "text-red-600 bg-red-50" : "text-gray-500 bg-gray-50" },
        ].map(m => (
          <div key={m.label} className="bg-white rounded-xl border border-gray-100 px-4 py-3.5 flex items-center gap-3 shadow-sm">
            <div className={cn("h-9 w-9 rounded-lg flex items-center justify-center shrink-0", m.color)}>
              <m.icon className="h-4 w-4" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider leading-none">{m.label}</p>
              <p className="text-xl font-bold text-gray-900 font-mono tabular-nums mt-0.5">{m.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Section Rail ─────────────────────────────────────────────────── */}
      <div className="flex gap-1 overflow-x-auto scrollbar-none border-b border-gray-100 pb-0 -mb-2">
        {SECTIONS.map(sec => (
          <button
            key={sec.key}
            onClick={() => { setSection(sec.key); setSearch(""); }}
            className={cn(
              "flex items-center gap-1.5 px-4 py-2.5 text-[13px] font-semibold transition-all relative shrink-0 rounded-t-lg",
              section === sec.key
                ? "text-[#EA580C] bg-white border border-b-0 border-gray-100 -mb-px"
                : "text-gray-500 hover:text-gray-800 hover:bg-gray-50"
            )}
          >
            <sec.icon className="h-4 w-4" />
            <span className="hidden sm:inline">{sec.label}</span>
            {sectionCounts[sec.key] > 0 && (
              <span className={cn(
                "text-[10px] font-bold tabular-nums px-1.5 py-0.5 rounded-full min-w-[18px] text-center",
                section === sec.key ? "bg-orange-100 text-[#EA580C]" : "bg-gray-100 text-gray-500"
              )}>
                {sectionCounts[sec.key]}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Content Area ─────────────────────────────────────────────────── */}
      <div className="bg-gray-50/60 rounded-xl border border-gray-100 p-4 sm:p-5 flex-1">
        {/* Section toolbar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <h2 className="font-bold text-[15px] text-gray-900">{sectionTitle[section]}</h2>
          <div className="flex items-center gap-2">
            <div className="relative flex-1 sm:w-[260px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
              <Input
                placeholder={section === "pipeline" ? "Search companies or contacts…" : "Search…"}
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-8 h-9 bg-white border-gray-200 text-sm focus-visible:ring-[#EA580C] rounded-lg shadow-sm"
              />
            </div>
            {section === "pipeline" && (
              <CanExport module="crm">
                <ExportButton
                  config={{
                    title: "Leads Pipeline",
                    module: "crm",
                    filename: "CRM_Leads",
                    columns: [
                      { header: "Company", key: "companyName"    },
                      { header: "Contact", key: "contactName"    },
                      { header: "Stage",   key: "status"         },
                      { header: "Source",  key: "source"         },
                      { header: "Value",   key: "estimatedValue" },
                      { header: "Score",   key: "score"          },
                      { header: "Created", key: "createdAt"      },
                    ],
                    getRows: () => (leads as any[]) as unknown as Record<string, unknown>[],
                  }}
                  size="sm"
                  className="h-9 bg-white"
                />
              </CanExport>
            )}
          </div>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={section}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
          >
            {section === "pipeline"    && <PipelineSection leads={leads as any[]} loading={leadsLoading} onLeadClick={setSelectedLeadId} search={search} />}
            {section === "quotations"  && <QuotationsSection quotations={quotations as any[]} loading={quotationsLoading} search={search} />}
            {section === "client-pos"  && <ClientPOsSection pos={clientPOs as any[]} loading={posLoading} search={search} />}
            {section === "invoices"    && <InvoicesSection invoices={invoices as any[]} loading={invoicesLoading} search={search} />}
            {section === "tasks"       && <TasksSection tasks={tasks as any[]} loading={tasksLoading} search={search} />}
            {section === "escalations" && <EscalationsSection escalations={escalations as any[]} loading={escalationsLoading} search={search} />}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* ── Lead Detail Sheet ─────────────────────────────────────────────── */}
      <CrmLeadSheet
        leadId={selectedLeadId}
        open={selectedLeadId !== null}
        onClose={() => setSelectedLeadId(null)}
      />

      {/* ── Create Lead Dialog ────────────────────────────────────────────── */}
      <CreateLeadDialog open={isCreateLeadOpen} onClose={() => setIsCreateLeadOpen(false)} />
    </motion.div>
  );
}
