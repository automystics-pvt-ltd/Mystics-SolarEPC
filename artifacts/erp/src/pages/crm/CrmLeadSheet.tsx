// @refresh reset
import { useState, useEffect, useMemo } from "react";
import {
  useGetLead, useUpdateLead, useGetQuotations, useCreateQuotation, useApproveQuotation,
  getGetLeadQueryKey, getGetQuotationsQueryKey, getGetLeadsQueryKey, getGetLeadsPipelineSummaryQueryKey,
} from "@workspace/api-client-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useLocation } from "wouter";
import { useToast } from "@/components/ui/use-toast";
import { usePermissions } from "@/lib/permissions";
import { apiGet } from "@/lib/fetch";
import {
  ArrowUpRight, X, Mail, Phone, Edit2, Save, Plus, FileText, Layers,
  StickyNote, Loader2, Check, ThumbsUp, ThumbsDown, Trash2, Calculator,
  ChevronDown, ChevronRight, ExternalLink, Clock, TrendingUp, Building2,
  MapPin, Star, AlertCircle,
} from "lucide-react";
import { Sheet, SheetContent, SheetHeader } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge } from "@/components/shared";
import { LeadSurvey } from "./tabs/LeadSurvey";

/* ── Types ─────────────────────────────────────────────────────────────── */
interface BOQItem {
  description: string;
  qty: number;
  unit: string;
  unitPrice: number;
  gstPct: number;
  amount: number;
}

/* ── Helpers ─────────────────────────────────────────────────────────────── */
function fmt(d?: string | null) {
  if (!d) return "—";
  try { return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "2-digit" }).format(new Date(d)); }
  catch { return d; }
}

function InfoRow({ label, value, mono }: { label: string; value?: string | null; mono?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5 py-2.5 border-b border-gray-50 last:border-0">
      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{label}</p>
      <p className={cn("text-[13px] font-semibold text-gray-900", mono && "font-mono")}>{value ?? "—"}</p>
    </div>
  );
}

function ScoreBar({ score }: { score?: number | null }) {
  const s = Math.min(100, score ?? 0);
  const color = s > 70 ? "bg-emerald-500" : s > 40 ? "bg-amber-400" : "bg-gray-300";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className={cn("h-full rounded-full", color)} style={{ width: `${s}%` }} />
      </div>
      <span className="text-[11px] font-bold font-mono text-gray-500 tabular-nums w-7 text-right">{s}/100</span>
    </div>
  );
}

/* ── Inline Quotation Creator ─────────────────────────────────────────── */
function QuotationCreator({ leadId, onDone, onCancel }: {
  leadId: number; onDone: () => void; onCancel: () => void;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [markupPct, setMarkupPct] = useState(15);
  const [validTill, setValidTill] = useState(
    new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10)
  );
  const [rows, setRows] = useState<BOQItem[]>([
    { description: "", qty: 1, unit: "nos", unitPrice: 0, gstPct: 18, amount: 0 },
  ]);

  const createMut = useCreateQuotation({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetQuotationsQueryKey({ leadId }) });
        queryClient.invalidateQueries({ queryKey: getGetQuotationsQueryKey({}) });
        toast({ title: "Quotation created", description: "The proposal has been saved as a draft." });
        onDone();
      },
      onError: (e: any) => toast({ title: "Failed", description: e?.message ?? "Could not create quotation", variant: "destructive" }),
    },
  });

  const updateRow = (i: number, field: keyof BOQItem, val: any) => {
    setRows(prev => prev.map((r, idx) => {
      if (idx !== i) return r;
      const updated = { ...r, [field]: val };
      updated.amount = updated.qty * updated.unitPrice;
      return updated;
    }));
  };

  const baseTotal = rows.reduce((s, r) => s + r.amount, 0);
  const markupAmount = baseTotal * (markupPct / 100);
  const gstTotal = rows.reduce((s, r) => s + r.amount * (r.gstPct / 100), 0);
  const grandTotal = baseTotal + markupAmount + gstTotal;

  const handleSave = () => {
    if (!rows.some(r => r.description.trim())) {
      toast({ title: "Add at least one line item", variant: "destructive" }); return;
    }
    createMut.mutate({
      data: {
        leadId,
        markupPct,
        validTill,
        boqItems: rows.map(r => ({ ...r, amount: r.qty * r.unitPrice })),
      },
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 4 }}
      className="border border-gray-200 rounded-xl overflow-hidden bg-white shadow-sm mt-4"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <Calculator className="h-4 w-4 text-[#EA580C]" />
          <span className="font-bold text-[13px] text-gray-800">New Quotation</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wide">Markup</label>
            <div className="flex items-center">
              <Input
                type="number" min={0} max={200} value={markupPct}
                onChange={e => setMarkupPct(Number(e.target.value))}
                className="h-7 w-16 text-sm font-mono text-center border-gray-200"
              />
              <span className="text-[12px] text-gray-500 ml-1">%</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wide">Valid Till</label>
            <Input
              type="date" value={validTill} onChange={e => setValidTill(e.target.value)}
              className="h-7 text-sm border-gray-200 w-36"
            />
          </div>
        </div>
      </div>

      {/* BOQ table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50/50">
              <th className="text-left px-3 py-2 text-[10px] font-bold text-gray-500 uppercase tracking-wider w-[35%]">Description</th>
              <th className="text-center px-2 py-2 text-[10px] font-bold text-gray-500 uppercase tracking-wider w-[8%]">Qty</th>
              <th className="text-left px-2 py-2 text-[10px] font-bold text-gray-500 uppercase tracking-wider w-[10%]">Unit</th>
              <th className="text-right px-2 py-2 text-[10px] font-bold text-gray-500 uppercase tracking-wider w-[15%]">Unit Price (₹)</th>
              <th className="text-center px-2 py-2 text-[10px] font-bold text-gray-500 uppercase tracking-wider w-[8%]">GST%</th>
              <th className="text-right px-2 py-2 text-[10px] font-bold text-gray-500 uppercase tracking-wider w-[14%]">Amount (₹)</th>
              <th className="w-[5%]" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className="border-b border-gray-50 group">
                <td className="px-3 py-1.5">
                  <Input
                    value={row.description} placeholder="Item description…"
                    onChange={e => updateRow(i, "description", e.target.value)}
                    className="h-8 text-sm border-transparent focus:border-gray-200 bg-transparent focus:bg-white px-2"
                  />
                </td>
                <td className="px-2 py-1.5">
                  <Input
                    type="number" min={0} value={row.qty}
                    onChange={e => updateRow(i, "qty", Number(e.target.value))}
                    className="h-8 text-sm text-center font-mono border-transparent focus:border-gray-200 bg-transparent focus:bg-white px-1"
                  />
                </td>
                <td className="px-2 py-1.5">
                  <Select value={row.unit} onValueChange={v => updateRow(i, "unit", v)}>
                    <SelectTrigger className="h-8 text-sm border-transparent focus:border-gray-200 bg-transparent min-w-[64px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {["nos","kWp","m²","m","kg","lot","set","hr"].map(u => (
                        <SelectItem key={u} value={u} className="text-sm">{u}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </td>
                <td className="px-2 py-1.5">
                  <Input
                    type="number" min={0} value={row.unitPrice}
                    onChange={e => updateRow(i, "unitPrice", Number(e.target.value))}
                    className="h-8 text-sm text-right font-mono border-transparent focus:border-gray-200 bg-transparent focus:bg-white px-2"
                  />
                </td>
                <td className="px-2 py-1.5">
                  <Input
                    type="number" min={0} max={100} value={row.gstPct}
                    onChange={e => updateRow(i, "gstPct", Number(e.target.value))}
                    className="h-8 text-sm text-center font-mono border-transparent focus:border-gray-200 bg-transparent focus:bg-white px-1"
                  />
                </td>
                <td className="px-2 py-1.5 text-right">
                  <span className="font-mono text-[13px] font-semibold text-gray-700 tabular-nums">
                    {row.amount.toLocaleString("en-IN")}
                  </span>
                </td>
                <td className="px-2 py-1.5">
                  {rows.length > 1 && (
                    <button
                      onClick={() => setRows(prev => prev.filter((_, idx) => idx !== i))}
                      className="h-6 w-6 flex items-center justify-center rounded text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add row */}
      <button
        onClick={() => setRows(prev => [...prev, { description: "", qty: 1, unit: "nos", unitPrice: 0, gstPct: 18, amount: 0 }])}
        className="w-full flex items-center gap-2 px-4 py-2.5 text-[12px] font-semibold text-gray-400 hover:text-[#EA580C] hover:bg-orange-50 border-t border-gray-50 transition-colors"
      >
        <Plus className="h-3.5 w-3.5" /> Add line item
      </button>

      {/* Totals */}
      <div className="border-t border-gray-100 bg-gray-50 px-4 py-3 flex flex-col gap-1">
        <div className="flex justify-between text-[12px] text-gray-500">
          <span>Base Total</span>
          <span className="font-mono">₹{baseTotal.toLocaleString("en-IN")}</span>
        </div>
        <div className="flex justify-between text-[12px] text-gray-500">
          <span>Markup ({markupPct}%)</span>
          <span className="font-mono">₹{markupAmount.toLocaleString("en-IN")}</span>
        </div>
        <div className="flex justify-between text-[12px] text-gray-500">
          <span>GST</span>
          <span className="font-mono">₹{gstTotal.toLocaleString("en-IN")}</span>
        </div>
        <div className="flex justify-between text-[13px] font-bold text-gray-900 border-t border-gray-200 mt-1 pt-1.5">
          <span>Grand Total</span>
          <span className="font-mono">₹{grandTotal.toLocaleString("en-IN")}</span>
        </div>
      </div>

      {/* Actions */}
      <div className="border-t border-gray-100 px-4 py-3 flex justify-end gap-2 bg-white">
        <Button variant="ghost" size="sm" onClick={onCancel} className="h-8 text-[12px]">Cancel</Button>
        <Button size="sm" onClick={handleSave} disabled={createMut.isPending}
          className="h-8 bg-[#EA580C] hover:bg-[#C2410C] text-white font-bold gap-1.5 text-[12px]">
          {createMut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
          {createMut.isPending ? "Saving…" : "Save Quotation"}
        </Button>
      </div>
    </motion.div>
  );
}

/* ── Quotations Tab ──────────────────────────────────────────────────────── */
function QuotationsTab({ leadId }: { leadId: number }) {
  const [, setLocation] = useLocation();
  const [showCreate, setShowCreate] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { canEdit: isAdmin } = usePermissions("crm");

  const { data: quotations = [], isPending } = useGetQuotations(
    { leadId },
    { query: { queryKey: getGetQuotationsQueryKey({ leadId }) } }
  );

  const approveMut = useApproveQuotation({
    mutation: {
      onSuccess: (_, vars) => {
        queryClient.invalidateQueries({ queryKey: getGetQuotationsQueryKey({ leadId }) });
        queryClient.invalidateQueries({ queryKey: getGetQuotationsQueryKey({}) });
        toast({ title: (vars.data as any).action === "approve" ? "Quotation approved" : "Quotation rejected" });
      },
    },
  });

  if (isPending) return (
    <div className="space-y-2 pt-2">
      {[1,2].map(i => <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />)}
    </div>
  );

  return (
    <div className="pt-2 space-y-3">
      {/* Create button */}
      <div className="flex justify-between items-center">
        <p className="text-[12px] font-bold text-gray-500 uppercase tracking-wider">
          {(quotations as any[]).length} Proposal{(quotations as any[]).length !== 1 ? "s" : ""}
        </p>
        <Button size="sm" variant="outline" className="h-7 text-[11px] gap-1.5"
          onClick={() => setShowCreate(v => !v)}>
          <Plus className="h-3.5 w-3.5" />
          {showCreate ? "Cancel" : "New Quotation"}
        </Button>
      </div>

      {/* Inline creator */}
      <AnimatePresence>
        {showCreate && (
          <QuotationCreator
            leadId={leadId}
            onDone={() => setShowCreate(false)}
            onCancel={() => setShowCreate(false)}
          />
        )}
      </AnimatePresence>

      {/* Quotation list */}
      {(quotations as any[]).length === 0 && !showCreate ? (
        <div className="border-2 border-dashed border-gray-100 rounded-xl h-36 flex flex-col items-center justify-center text-center p-5">
          <FileText className="h-7 w-7 text-gray-200 mb-2" />
          <p className="text-[13px] font-semibold text-gray-400">No proposals yet</p>
          <button onClick={() => setShowCreate(true)} className="text-[12px] text-[#EA580C] font-semibold mt-1 hover:underline">
            Create the first proposal →
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {(quotations as any[]).map((q: any) => (
            <div key={q.id} className="border border-gray-100 rounded-xl overflow-hidden hover:border-gray-200 transition-all bg-white group">
              {/* Main row */}
              <div className="flex items-center justify-between px-4 py-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-[13px] text-gray-900">
                      QTN-{String(q.id).padStart(4,"0")}
                    </span>
                    <StatusBadge status={q.approvalStatus} size="sm" />
                    <span className="text-[10px] text-gray-400 font-medium">v{q.version}</span>
                  </div>
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    Created {fmt(q.createdAt)}
                    {q.validTill && ` · Valid till ${fmt(q.validTill)}`}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="font-mono font-bold text-[15px] text-gray-900">
                      ₹{Number(q.totalAmount || 0).toLocaleString("en-IN")}
                    </p>
                    <p className="text-[10px] text-gray-400">incl. markup</p>
                  </div>
                  <Button
                    variant="ghost" size="sm"
                    onClick={() => setLocation(`/crm/quotations/${q.id}`)}
                    className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <ExternalLink className="h-3.5 w-3.5 text-gray-400" />
                  </Button>
                </div>
              </div>

              {/* Approval actions for Pending quotations */}
              {q.approvalStatus === "Pending" && isAdmin && (
                <div className="border-t border-gray-50 px-4 py-2.5 flex items-center gap-2 bg-amber-50/60">
                  <AlertCircle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                  <span className="text-[11px] text-amber-700 font-medium flex-1">Awaiting your approval</span>
                  <Button size="sm" variant="outline"
                    disabled={approveMut.isPending}
                    onClick={() => approveMut.mutate({ id: q.id, data: { action: "reject", remarks: "" } })}
                    className="h-6 text-[11px] px-2 border-red-200 text-red-600 hover:bg-red-50 gap-1">
                    <ThumbsDown className="h-3 w-3" /> Reject
                  </Button>
                  <Button size="sm"
                    disabled={approveMut.isPending}
                    onClick={() => approveMut.mutate({ id: q.id, data: { action: "approve", remarks: "" } })}
                    className="h-6 text-[11px] px-2 bg-emerald-600 hover:bg-emerald-700 text-white gap-1">
                    <ThumbsUp className="h-3 w-3" /> Approve
                  </Button>
                </div>
              )}

              {/* BOQ preview (collapsed by default, show if approved) */}
              {q.approvalStatus === "Approved" && q.boqItems?.length > 0 && (
                <div className="border-t border-gray-50 px-4 py-2 bg-gray-50/40">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">BOQ Summary</p>
                  {q.boqItems.slice(0, 3).map((item: any, i: number) => (
                    <div key={i} className="flex justify-between text-[11px] text-gray-600 py-0.5">
                      <span className="truncate mr-4">{item.description || "Unnamed item"}</span>
                      <span className="font-mono text-gray-700 shrink-0">₹{Number(item.amount || item.qty * item.unitPrice || 0).toLocaleString("en-IN")}</span>
                    </div>
                  ))}
                  {q.boqItems.length > 3 && (
                    <p className="text-[10px] text-gray-400 mt-1">+{q.boqItems.length - 3} more items · <button onClick={() => setLocation(`/crm/quotations/${q.id}`)} className="text-[#EA580C] hover:underline">Open full editor</button></p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Projects Tab ──────────────────────────────────────────────────────── */
function ProjectsTab({ leadId }: { leadId: number }) {
  const [, setLocation] = useLocation();
  const { data: projects = [], isPending } = useQuery<any[]>({
    queryKey: ["lead-projects", leadId],
    queryFn: () => apiGet<any[]>(`/leads/${leadId}/projects`),
    enabled: !!leadId,
  });

  if (isPending) return <div className="h-24 bg-gray-100 rounded-xl animate-pulse mt-2" />;

  if (!projects.length) return (
    <div className="border-2 border-dashed border-gray-100 rounded-xl h-36 flex flex-col items-center justify-center mt-2 text-center p-5">
      <Layers className="h-7 w-7 text-gray-200 mb-2" />
      <p className="text-[13px] font-semibold text-gray-400">No linked projects</p>
      <p className="text-[11px] text-gray-400 mt-1">Projects appear once a quotation is approved and converted.</p>
    </div>
  );

  return (
    <div className="pt-2 space-y-2">
      {projects.map(proj => (
        <div
          key={proj.id}
          onClick={() => setLocation(`/projects/${proj.id}`)}
          className="border border-gray-100 rounded-xl p-4 cursor-pointer hover:border-gray-200 hover:bg-gray-50 transition-all group"
        >
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-mono font-bold text-[12px] text-gray-600">
                  PRJ-{String(proj.id).padStart(4,"0")}
                </span>
                <StatusBadge status={proj.status} size="sm" />
              </div>
              <p className="text-[13px] font-semibold text-gray-900 group-hover:text-[#EA580C] transition-colors truncate">{proj.name}</p>
            </div>
            <ChevronRight className="h-4 w-4 text-gray-300 group-hover:text-[#EA580C] transition-colors shrink-0 mt-0.5" />
          </div>
          <div className="flex items-center gap-3 mt-2.5">
            {proj.contractValue && (
              <span className="font-mono font-bold text-[13px] text-gray-800">
                ₹{Number(proj.contractValue).toLocaleString("en-IN")}
              </span>
            )}
            <div className="flex items-center gap-1.5 flex-1">
              <div className="h-1.5 flex-1 bg-gray-100 rounded-full overflow-hidden max-w-[80px]">
                <div className="h-full bg-[#EA580C] rounded-full" style={{ width: `${proj.percentComplete ?? 0}%` }} />
              </div>
              <span className="text-[11px] text-gray-400">{proj.percentComplete ?? 0}%</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── Main Sheet Component ─────────────────────────────────────────────── */
interface Props {
  leadId: number | null;
  open: boolean;
  onClose: () => void;
}

export function CrmLeadSheet({ leadId, open, onClose }: Props) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { canEdit: isAdmin } = usePermissions("crm");
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<any>({});
  const [activeTab, setActiveTab] = useState("overview");

  const { data: lead, isPending } = useGetLead(leadId!, {
    query: { enabled: !!leadId, queryKey: getGetLeadQueryKey(leadId!) },
  });

  const updateMut = useUpdateLead({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetLeadQueryKey(leadId!) });
        queryClient.invalidateQueries({ queryKey: getGetLeadsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetLeadsPipelineSummaryQueryKey() });
        setIsEditing(false);
        toast({ title: "Lead updated" });
      },
      onError: (e: any) => toast({ title: "Update failed", description: e?.message, variant: "destructive" }),
    },
  });

  useEffect(() => {
    if (lead && !isEditing) {
      setEditForm({
        companyName:    lead.companyName    ?? "",
        contactName:    lead.contactName    ?? "",
        contactEmail:   lead.contactEmail   ?? "",
        contactPhone:   lead.contactPhone   ?? "",
        status:         lead.status         ?? "New",
        estimatedValue: lead.estimatedValue ?? 0,
        notes:          lead.notes          ?? "",
      });
    }
  }, [lead, isEditing]);

  // Reset state when a new lead is opened
  useEffect(() => {
    setIsEditing(false);
    setActiveTab("overview");
  }, [leadId]);

  const stageConfig = useMemo(() => {
    const configs: Record<string, { color: string; bg: string }> = {
      "New":          { color: "text-blue-700",    bg: "bg-blue-50 border-blue-200"    },
      "Contacted":    { color: "text-indigo-700",  bg: "bg-indigo-50 border-indigo-200"  },
      "Qualified":    { color: "text-violet-700",  bg: "bg-violet-50 border-violet-200"  },
      "Proposal":     { color: "text-amber-700",   bg: "bg-amber-50 border-amber-200"   },
      "Negotiation":  { color: "text-orange-700",  bg: "bg-orange-50 border-orange-200"  },
      "Closed Won":   { color: "text-emerald-700", bg: "bg-emerald-50 border-emerald-200" },
      "Closed Lost":  { color: "text-rose-600",    bg: "bg-rose-50 border-rose-200"    },
    };
    return configs[lead?.status ?? "New"] ?? { color: "text-gray-700", bg: "bg-gray-50 border-gray-200" };
  }, [lead?.status]);

  const handleSave = () => {
    updateMut.mutate({
      id: leadId!,
      data: { ...editForm, estimatedValue: Number(editForm.estimatedValue) },
    });
  };

  return (
    <Sheet open={open} onOpenChange={o => { if (!o) onClose(); }}>
      <SheetContent
        side="right"
        className="w-full sm:w-[580px] sm:max-w-[90vw] p-0 flex flex-col overflow-hidden border-l border-gray-100 shadow-2xl"
      >
        {/* Loading state */}
        {isPending ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-gray-300" />
          </div>
        ) : !lead ? (
          <div className="flex-1 flex items-center justify-center p-8 text-center">
            <div>
              <AlertCircle className="h-10 w-10 text-gray-200 mx-auto mb-3" />
              <p className="font-semibold text-gray-400">Lead not found</p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col h-full overflow-hidden">

            {/* ── Sheet Header ──────────────────────────────────────────── */}
            <div className="px-5 pt-5 pb-4 border-b border-gray-100 bg-white shrink-0">
              {/* Top row: close + actions */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className={cn("text-[11px] font-bold px-2.5 py-1 rounded-full border uppercase tracking-wide", stageConfig.bg, stageConfig.color)}>
                    {lead.status}
                  </span>
                  <span className="font-mono text-[11px] text-gray-400 font-semibold">
                    LD-{String(lead.id).padStart(4,"0")}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  {isEditing ? (
                    <>
                      <Button variant="ghost" size="sm" className="h-7 text-[12px]" onClick={() => setIsEditing(false)} disabled={updateMut.isPending}>
                        Cancel
                      </Button>
                      <Button size="sm" className="h-7 bg-[#EA580C] hover:bg-[#C2410C] text-white font-bold gap-1.5 text-[12px]"
                        onClick={handleSave} disabled={updateMut.isPending}>
                        {updateMut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                        Save
                      </Button>
                    </>
                  ) : isAdmin ? (
                    <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-[12px]" onClick={() => setIsEditing(true)}>
                      <Edit2 className="h-3.5 w-3.5" /> Edit
                    </Button>
                  ) : null}
                  <button onClick={onClose} className="h-7 w-7 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Company name */}
              {isEditing ? (
                <Input
                  value={editForm.companyName}
                  onChange={e => setEditForm({ ...editForm, companyName: e.target.value })}
                  className="text-xl font-bold h-10 border-gray-200 mb-2"
                />
              ) : (
                <h2 className="text-xl font-bold text-gray-900 leading-tight mb-1">{lead.companyName}</h2>
              )}

              {/* Contact + value row */}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mb-3">
                {isEditing ? (
                  <Input
                    value={editForm.contactName}
                    onChange={e => setEditForm({ ...editForm, contactName: e.target.value })}
                    placeholder="Contact name" className="h-8 text-sm border-gray-200 w-48"
                  />
                ) : (
                  <span className="text-[13px] font-semibold text-gray-600 flex items-center gap-1">
                    <Building2 className="h-3.5 w-3.5 text-gray-400" />{lead.contactName}
                  </span>
                )}
                {lead.estimatedValue && !isEditing && (
                  <span className="font-mono font-bold text-[15px] text-gray-900">
                    ₹{Number(lead.estimatedValue).toLocaleString("en-IN")}
                  </span>
                )}
                {isEditing && (
                  <div className="flex items-center gap-1">
                    <span className="text-[12px] text-gray-500">₹</span>
                    <Input
                      type="number" value={editForm.estimatedValue}
                      onChange={e => setEditForm({ ...editForm, estimatedValue: e.target.value })}
                      placeholder="Est. value" className="h-8 text-sm font-mono border-gray-200 w-36"
                    />
                  </div>
                )}
              </div>

              {/* Quick action buttons */}
              <div className="flex items-center gap-2 flex-wrap">
                {lead.contactEmail && (
                  <a href={`mailto:${lead.contactEmail}`}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-[12px] font-semibold text-gray-600 hover:border-[#EA580C] hover:text-[#EA580C] hover:bg-orange-50 transition-all">
                    <Mail className="h-3.5 w-3.5" /> Email
                  </a>
                )}
                {lead.contactPhone && (
                  <a href={`tel:${lead.contactPhone}`}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-[12px] font-semibold text-gray-600 hover:border-[#EA580C] hover:text-[#EA580C] hover:bg-orange-50 transition-all">
                    <Phone className="h-3.5 w-3.5" /> Call
                  </a>
                )}
                {isAdmin && isEditing && (
                  <Select
                    value={editForm.status}
                    onValueChange={val => setEditForm({ ...editForm, status: val })}
                  >
                    <SelectTrigger className="h-8 text-[12px] font-semibold border-gray-200 w-auto min-w-[130px] gap-2">
                      <TrendingUp className="h-3.5 w-3.5 text-gray-400" />
                      <SelectValue placeholder="Move stage" />
                    </SelectTrigger>
                    <SelectContent>
                      {["New","Contacted","Qualified","Proposal","Negotiation","Closed Won","Closed Lost"].map(s => (
                        <SelectItem key={s} value={s} className="text-sm">{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                {/* Lead score */}
                {lead.score != null && (
                  <div className="flex items-center gap-2 ml-auto">
                    <Star className={cn("h-3.5 w-3.5", lead.score > 70 ? "text-amber-400" : "text-gray-300")} />
                    <div className="flex items-center gap-1.5">
                      <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className={cn("h-full rounded-full", lead.score > 70 ? "bg-emerald-500" : lead.score > 40 ? "bg-amber-400" : "bg-gray-300")}
                          style={{ width: `${lead.score}%` }} />
                      </div>
                      <span className="text-[11px] font-bold font-mono text-gray-500">{lead.score}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* ── Tabs ─────────────────────────────────────────────────── */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col flex-1 overflow-hidden">
              <TabsList className="bg-transparent h-10 p-0 gap-1 px-5 border-b border-gray-100 shrink-0 justify-start rounded-none">
                {[
                  { value: "overview",   label: "Overview",   icon: Building2 },
                  { value: "quotations", label: "Quotations", icon: FileText   },
                  { value: "survey",     label: "Survey",     icon: MapPin     },
                  { value: "projects",   label: "Projects",   icon: Layers     },
                ].map(tab => (
                  <TabsTrigger
                    key={tab.value}
                    value={tab.value}
                    className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-[#EA580C] rounded-none px-3 h-10 text-[12px] font-semibold text-gray-500 data-[state=active]:text-gray-900 transition-colors flex items-center gap-1.5"
                  >
                    <tab.icon className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">{tab.label}</span>
                  </TabsTrigger>
                ))}
              </TabsList>

              {/* Scrollable content area */}
              <div className="flex-1 overflow-y-auto">

                {/* ── Overview Tab ───────────────────────────────────── */}
                <TabsContent value="overview" className="p-5 m-0 outline-none space-y-4">
                  {/* Contact details */}
                  <div className="bg-white rounded-xl border border-gray-100 divide-y divide-gray-50 overflow-hidden">
                    <div className="px-4 py-2.5 bg-gray-50/60">
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Contact</p>
                    </div>
                    <div className="px-4">
                      {isEditing ? (
                        <div className="space-y-3 py-3">
                          <div>
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Email</p>
                            <Input value={editForm.contactEmail} onChange={e => setEditForm({ ...editForm, contactEmail: e.target.value })}
                              type="email" placeholder="contact@company.com" className="h-9 text-sm border-gray-200" />
                          </div>
                          <div>
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Phone</p>
                            <Input value={editForm.contactPhone} onChange={e => setEditForm({ ...editForm, contactPhone: e.target.value })}
                              placeholder="+91 98765 43210" className="h-9 text-sm border-gray-200" />
                          </div>
                        </div>
                      ) : (
                        <div className="py-1">
                          {lead.contactEmail && (
                            <div className="flex items-center gap-2 py-2.5 border-b border-gray-50">
                              <Mail className="h-4 w-4 text-gray-300 shrink-0" />
                              <a href={`mailto:${lead.contactEmail}`}
                                className="text-[13px] font-semibold text-[#EA580C] hover:underline truncate">
                                {lead.contactEmail}
                              </a>
                            </div>
                          )}
                          {lead.contactPhone && (
                            <div className="flex items-center gap-2 py-2.5">
                              <Phone className="h-4 w-4 text-gray-300 shrink-0" />
                              <a href={`tel:${lead.contactPhone}`} className="text-[13px] font-semibold text-gray-700">
                                {lead.contactPhone}
                              </a>
                            </div>
                          )}
                          {!lead.contactEmail && !lead.contactPhone && (
                            <p className="text-[12px] text-gray-400 py-3 italic">No contact details recorded</p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Lead meta */}
                  <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                    <div className="px-4 py-2.5 bg-gray-50/60 border-b border-gray-50">
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Lead Details</p>
                    </div>
                    <div className="px-4 divide-y divide-gray-50">
                      <InfoRow label="Owner" value={(lead as any).ownerName ?? "Unassigned"} />
                      <InfoRow label="Source" value={(lead as any).source} />
                      <InfoRow label="Territory" value={(lead as any).territory} />
                      <InfoRow label="Product Interest" value={(lead as any).productInterest} />
                      <InfoRow label="Created" value={fmt(lead.createdAt as string)} />
                      {(lead as any).updatedAt && <InfoRow label="Last Updated" value={fmt((lead as any).updatedAt)} />}
                    </div>
                  </div>

                  {/* Notes */}
                  <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                    <div className="px-4 py-2.5 bg-gray-50/60 border-b border-gray-50 flex items-center justify-between">
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Notes</p>
                      {!isEditing && isAdmin && (
                        <button onClick={() => setIsEditing(true)} className="text-[10px] text-[#EA580C] font-semibold hover:underline">
                          Edit
                        </button>
                      )}
                    </div>
                    <div className="px-4 py-3">
                      {isEditing ? (
                        <Textarea
                          value={editForm.notes}
                          onChange={e => setEditForm({ ...editForm, notes: e.target.value })}
                          placeholder="Add meeting notes, call summaries, next steps…"
                          className="min-h-[100px] text-sm border-gray-200 resize-none focus-visible:ring-[#EA580C]"
                        />
                      ) : (
                        <p className="text-[13px] text-gray-700 leading-relaxed whitespace-pre-wrap">
                          {lead.notes || <span className="text-gray-400 italic">No notes recorded</span>}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Score */}
                  {lead.score != null && (
                    <div className="bg-white rounded-xl border border-gray-100 px-4 py-3.5">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1">
                          <TrendingUp className="h-3 w-3" /> Lead Score
                        </p>
                        <span className="font-mono text-[13px] font-bold text-gray-900">{lead.score}/100</span>
                      </div>
                      <ScoreBar score={lead.score} />
                    </div>
                  )}
                </TabsContent>

                {/* ── Quotations Tab ─────────────────────────────────── */}
                <TabsContent value="quotations" className="px-5 pb-5 m-0 outline-none">
                  <QuotationsTab leadId={lead.id} />
                </TabsContent>

                {/* ── Survey Tab ─────────────────────────────────────── */}
                <TabsContent value="survey" className="px-5 pb-5 m-0 outline-none">
                  <LeadSurvey leadId={lead.id} />
                </TabsContent>

                {/* ── Projects Tab ───────────────────────────────────── */}
                <TabsContent value="projects" className="px-5 pb-5 m-0 outline-none">
                  <ProjectsTab leadId={lead.id} />
                </TabsContent>
              </div>
            </Tabs>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
