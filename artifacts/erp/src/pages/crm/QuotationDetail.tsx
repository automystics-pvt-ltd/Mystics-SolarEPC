import { useState, useRef, useEffect } from "react";
import {
  useGetQuotation, useCreateQuotation, useUpdateQuotation,
  useApproveQuotation, useLogClientPO,
  useGetLeads, useGetMaterials, useCreateMaterial,
  getGetQuotationQueryKey, getGetQuotationsQueryKey, getGetMaterialsQueryKey,
  getGetLeadsPipelineSummaryQueryKey, getGetLeadQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { apiPost } from "@/lib/fetch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  Loader2, Plus, Trash2, Save, FileCheck, CheckCircle, Printer,
  FileText, Calculator, ChevronsUpDown, Search, PlusCircle, Check, FolderPlus,
} from "lucide-react";
import { useLocation } from "wouter";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/components/ui/use-toast";
import { format } from "date-fns";
import { motion } from "framer-motion";
import { PrintPreviewModal } from "@/components/print/PrintPreviewModal";
import { QuotationPrint } from "@/components/print/documents/QuotationPrint";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { PageHeader, SectionCard, StatusBadge } from "@/components/shared";

const fmtINR = (n?: number | null) =>
  n == null ? "—" : `₹${Number(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const UOM_OPTIONS = ["NOS", "KW", "KWP", "MT", "KG", "SQM", "RMT", "SET", "LOT", "PCS", "HR", "DAY", "LS"];
const DEFAULT_GST = 18;

/* ── per-line material combobox ── */
function MaterialCombobox({
  value,
  onSelect,
  materials,
  onCreate,
  disabled,
}: {
  value: string;
  onSelect: (name: string, uom: string, basePrice: number, gstRate: number) => void;
  onCreate: (name: string) => Promise<void>;
  materials: any[];
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState(value);
  const [creating, setCreating] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setSearch(value); }, [value]);

  const filtered = materials.filter(m =>
    (m.name || "").toLowerCase().includes((search || "").toLowerCase())
  ).slice(0, 10);

  const exactMatch = materials.some(m =>
    (m.name || "").toLowerCase() === (search || "").toLowerCase()
  );

  const handleCreate = async () => {
    if (!search.trim()) return;
    setCreating(true);
    await onCreate(search.trim());
    setCreating(false);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          onClick={() => { setOpen(true); setTimeout(() => inputRef.current?.focus(), 50); }}
          className={cn(
            "w-full h-10 px-3 text-left text-sm bg-muted/40 border border-border rounded-[6px] flex items-center justify-between gap-2 hover:border-border/80 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#EA580C]",
            disabled && "opacity-50 cursor-not-allowed"
          )}
        >
          <span className={cn("truncate flex-1", !value && "text-muted-foreground")}>
            {value || "Select or type item…"}
          </span>
          <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[340px] p-0 shadow-xl border border-border rounded-[10px]" align="start">
        <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border">
          <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <input
            ref={inputRef}
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search items from master list…"
            className="flex-1 text-sm bg-transparent outline-none placeholder:text-muted-foreground"
          />
        </div>
        <div className="max-h-[220px] overflow-y-auto py-1">
          {filtered.length > 0 ? (
            filtered.map(m => (
              <button
                key={m.id}
                type="button"
                onClick={() => {
                  onSelect(m.name, m.uom || "NOS", m.basePrice || 0, m.gstRate ?? DEFAULT_GST);
                  setSearch(m.name);
                  setOpen(false);
                }}
                className="w-full flex items-center justify-between px-4 py-2.5 text-sm hover:bg-orange-50 text-left transition-colors"
              >
                <div>
                  <p className="font-semibold text-foreground">{m.name}</p>
                  {m.uom && <p className="text-[11px] text-muted-foreground">{m.uom}{m.basePrice ? ` · ₹${Number(m.basePrice).toLocaleString("en-IN")}` : ""}</p>}
                </div>
                {value === m.name && <Check className="h-3.5 w-3.5 text-[#EA580C]" />}
              </button>
            ))
          ) : (
            <p className="px-4 py-3 text-sm text-muted-foreground italic">No items found</p>
          )}
        </div>
        {search.trim() && !exactMatch && (
          <div className="border-t border-border px-3 py-2">
            <Button
              size="sm"
              variant="ghost"
              className="w-full justify-start text-[#EA580C] hover:bg-orange-50 font-semibold h-8 text-sm"
              onClick={handleCreate}
              disabled={creating}
            >
              {creating ? <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" /> : <PlusCircle className="h-3.5 w-3.5 mr-2" />}
              Create "{search.trim()}"
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

/* ── main component ── */
export function QuotationDetail({ id }: { id?: string }) {
  const isNew = !id || id === "new";
  const quoteId = !isNew ? parseInt(id, 10) : 0;
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // ── form state ──
  const [leadId, setLeadId] = useState("");
  const [markupPct, setMarkupPct] = useState(10);
  const [gstPct, setGstPct] = useState(DEFAULT_GST);
  const [validTill, setValidTill] = useState("");
  const [boqItems, setBoqItems] = useState<any[]>([]);
  const [isEditing, setIsEditing] = useState(isNew);

  // ── queries ──
  const { data: quote, isPending } = useGetQuotation(quoteId, {
    query: { enabled: !isNew, queryKey: getGetQuotationQueryKey(quoteId) },
  });
  const { data: leads = [] } = useGetLeads({});
  const { data: materials = [] } = useGetMaterials();

  // ── mutations ──
  const createMut = useCreateQuotation({
    mutation: {
      onSuccess: (d) => {
        queryClient.invalidateQueries({ queryKey: getGetQuotationsQueryKey({}) });
        toast({ title: "Quotation created" });
        navigate(`/crm/quotations/${d.id}`);
      },
      onError: (e: any) => toast({ variant: "destructive", title: "Failed to create quotation", description: e?.message }),
    },
  });
  const updateMut = useUpdateQuotation({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetQuotationQueryKey(quoteId) });
        queryClient.invalidateQueries({ queryKey: getGetQuotationsQueryKey({}) });
        setIsEditing(false);
        toast({ title: "Quotation saved" });
      },
      onError: (e: any) => toast({ variant: "destructive", title: "Failed to save quotation", description: e?.message }),
    },
  });
  const approveMut = useApproveQuotation({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetQuotationQueryKey(quoteId) });
        queryClient.invalidateQueries({ queryKey: getGetQuotationsQueryKey({}) });
        queryClient.invalidateQueries({ queryKey: getGetLeadsPipelineSummaryQueryKey() });
        if (quote?.leadId) {
          queryClient.invalidateQueries({ queryKey: getGetLeadQueryKey(quote.leadId) });
        }
        toast({ title: "Quotation approved" });
      },
      onError: (e: any) => toast({ variant: "destructive", title: "Failed to approve quotation", description: e?.message }),
    },
  });
  const logPoMut = useLogClientPO({
    mutation: {
      onSuccess: () => { toast({ title: "Client PO logged — Project created!" }); navigate("/crm/client-pos"); },
      onError: (e: any) => toast({ variant: "destructive", title: "Failed to log client PO", description: e?.message }),
    },
  });
  const createMatMut = useCreateMaterial({
    mutation: {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetMaterialsQueryKey() }),
    },
  });

  // ── initialise from existing quote ──
  const initRef = useRef(false);
  useEffect(() => {
    if (quote && !initRef.current && !isNew) {
      setMarkupPct(quote.markupPct ?? 0);
      setBoqItems((quote.boqItems ?? []).map((i: any) => ({ ...i, gstPct: i.gstPct ?? DEFAULT_GST })));
      if (quote.validTill) setValidTill(quote.validTill.split("T")[0]);
      initRef.current = true;
    }
  }, [quote, isNew]);

  // ── pre-fill leadId from URL ──
  useEffect(() => {
    if (isNew) {
      const params = new URLSearchParams(window.location.search);
      const lid = params.get("leadId");
      if (lid) setLeadId(lid);
    }
  }, [isNew]);

  // ── BOQ helpers ──
  const addLine = () =>
    setBoqItems(prev => [...prev, { description: "", qty: 1, unit: "NOS", unitPrice: 0, gstPct: DEFAULT_GST }]);

  const removeLine = (i: number) => setBoqItems(prev => prev.filter((_, idx) => idx !== i));

  const updateLine = (i: number, field: string, value: any) =>
    setBoqItems(prev => prev.map((item, idx) => idx === i ? { ...item, [field]: value } : item));

  const onMaterialSelect = (i: number, name: string, uom: string, basePrice: number, gstRate: number) => {
    setBoqItems(prev => prev.map((item, idx) =>
      idx === i ? { ...item, description: name, unit: uom, unitPrice: basePrice, gstPct: gstRate } : item
    ));
  };

  const onMaterialCreate = async (name: string) => {
    await createMatMut.mutateAsync({ data: { name, uom: "NOS", gstRate: DEFAULT_GST } });
    updateLine(boqItems.length - 1, "description", name); // caller updates the right row
  };

  // ── pricing totals ──
  const baseSubtotal = boqItems.reduce((s, i) => s + (Number(i.qty) || 0) * (Number(i.unitPrice) || 0), 0);
  const markupAmount = baseSubtotal * markupPct / 100;
  const preGstTotal = baseSubtotal + markupAmount;
  const gstAmount = preGstTotal * gstPct / 100;
  const grandTotal = preGstTotal + gstAmount;

  // ── Create-Project-from-Quotation mutation ──
  const createProjectMut = useMutation({
    mutationFn: (name: string) => apiPost(`/quotations/${quoteId}/create-project`, { projectName: name }),
    onSuccess: (data: any) => {
      toast({ title: "Solar project created!", description: `${data.projectName} — ${data.boqItemsCreated} BOQ items seeded.` });
      navigate(`/projects/${data.projectId}`);
    },
    onError: () => toast({ title: "Failed to create project", variant: "destructive" }),
  });

  // ── dialog state — must be above early returns ──
  const [showPrint, setShowPrint] = useState(false);
  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [showConvertDialog, setShowConvertDialog] = useState(false);
  const [showCreateProjectDialog, setShowCreateProjectDialog] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [clientPoNum, setClientPoNum] = useState("");

  // ── save ──
  const handleSave = () => {
    if (isNew && !leadId) { toast({ title: "Please select a lead", variant: "destructive" }); return; }
    const items = boqItems.map(i => ({ ...i, amount: (Number(i.qty) || 0) * (Number(i.unitPrice) || 0) }));
    if (isNew) {
      createMut.mutate({ data: { leadId: parseInt(leadId, 10), markupPct, validTill: validTill ? new Date(validTill).toISOString() : undefined, boqItems: items } });
    } else {
      updateMut.mutate({ id: quoteId, data: { markupPct, validTill: validTill ? new Date(validTill).toISOString() : undefined, boqItems: items } });
    }
  };

  if (!isNew && isPending) {
    return <div className="flex h-[60vh] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }

  const selectedLead = (leads as any[]).find(l => String(l.id) === String(leadId));
  const isSaving = createMut.isPending || updateMut.isPending;

  const headerActions = (
    <div className="flex items-center gap-3 flex-wrap">
      {!isNew && (
        <Button variant="outline" className="h-10 gap-2 print:hidden" onClick={() => setShowPrint(true)}>
          <Printer className="h-4 w-4" /> Preview &amp; Print
        </Button>
      )}
      {!isNew && quote?.approvalStatus === "Draft" && !isEditing && (
        <Button onClick={() => setShowApproveDialog(true)} disabled={approveMut.isPending} className="h-10 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-[8px] print:hidden">
          <CheckCircle className="h-4 w-4 mr-2" /> Approve Quote
        </Button>
      )}
      {!isNew && quote?.approvalStatus === "Approved" && (
        <>
          <Button
            onClick={() => { setNewProjectName(selectedLead ? `${selectedLead.companyName} — Solar Project` : ""); setShowCreateProjectDialog(true); }}
            disabled={createProjectMut.isPending}
            variant="outline"
            className="h-10 gap-2 border-emerald-300 text-emerald-700 hover:bg-emerald-50 font-bold rounded-[8px]"
          >
            <FolderPlus className="h-4 w-4" /> Create Solar Project
          </Button>
          <Button onClick={() => { setClientPoNum(""); setShowConvertDialog(true); }} disabled={logPoMut.isPending} className="h-10 bg-[#0C1445] hover:bg-[#0A0F2C] text-white font-bold rounded-[8px]">
            <FileCheck className="h-4 w-4 mr-2" /> Log Client PO
          </Button>
        </>
      )}
      {isEditing ? (
        <>
          {!isNew && <Button variant="ghost" onClick={() => setIsEditing(false)} className="h-10 font-bold text-muted-foreground">Cancel</Button>}
          <Button onClick={handleSave} disabled={isSaving} className="h-10 bg-foreground hover:bg-foreground/90 text-background font-bold rounded-[8px] px-6">
            {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            {isNew ? "Create Quotation" : "Save Changes"}
          </Button>
        </>
      ) : (
        <Button onClick={() => setIsEditing(true)} className="h-10 bg-card border border-border text-foreground hover:bg-muted font-bold rounded-[8px] shadow-sm">
          Edit Configuration
        </Button>
      )}
    </div>
  );

  return (
    <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }} className="space-y-6 pb-10">

      <PageHeader
        title={isNew ? "New Quotation" : `QTN-${quoteId.toString().padStart(4, "0")}`}
        subtitle={!isNew ? `Version ${quote?.version} · Lead: ${(leads as any[]).find(l => l.id === quote?.leadId)?.companyName || `LD-${String(quote?.leadId).padStart(4, "0")}`}` : undefined}
        backHref="/crm/quotations"
        badge={!isNew && quote?.approvalStatus ? <StatusBadge status={quote.approvalStatus} /> : undefined}
        actions={headerActions}
      />

      <div className="grid gap-6 lg:grid-cols-4">

        {/* ── Settings Panel ── */}
        <div className="lg:col-span-1">
          <SectionCard title="Pricing Config" badge={<Calculator className="h-4 w-4 text-muted-foreground" />}>
            <div className="space-y-5">

              {/* Lead selector */}
              <div>
                <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5 block">Lead</label>
                {isEditing && isNew ? (
                  <Select value={leadId} onValueChange={setLeadId}>
                    <SelectTrigger className="h-10 bg-muted/50 font-semibold text-sm rounded-[8px]">
                      <SelectValue placeholder="Select a lead…" />
                    </SelectTrigger>
                    <SelectContent>
                      {(leads as any[]).map(l => (
                        <SelectItem key={l.id} value={String(l.id)}>
                          <span className="font-mono text-xs text-muted-foreground mr-2">LD-{String(l.id).padStart(4, "0")}</span>
                          {l.companyName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <p className="font-bold text-sm text-foreground">
                    {selectedLead?.companyName || (quote?.leadId ? `LD-${String(quote.leadId).padStart(4, "0")}` : "—")}
                  </p>
                )}
              </div>

              {/* Markup % */}
              <div>
                <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5 flex justify-between">
                  <span>Markup / Margin</span>
                  {isEditing && <span className="text-[#EA580C]">%</span>}
                </label>
                {isEditing ? (
                  <Input value={markupPct} onChange={e => setMarkupPct(Number(e.target.value))} type="number" min={0} className="h-10 bg-muted/50 font-mono font-bold text-sm" />
                ) : (
                  <p className="font-bold text-foreground text-lg">{markupPct}%<span className="text-xs text-muted-foreground font-medium ml-1">on base</span></p>
                )}
              </div>

              {/* GST % */}
              <div>
                <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5 flex justify-between">
                  <span>GST Rate</span>
                  {isEditing && <span className="text-[#EA580C]">%</span>}
                </label>
                {isEditing ? (
                  <Select value={String(gstPct)} onValueChange={v => setGstPct(Number(v))}>
                    <SelectTrigger className="h-10 bg-muted/50 font-semibold text-sm rounded-[8px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[0, 5, 12, 18, 28].map(r => (
                        <SelectItem key={r} value={String(r)}>{r}%</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <p className="font-bold text-foreground text-lg">{gstPct}%<span className="text-xs text-muted-foreground font-medium ml-1">GST</span></p>
                )}
              </div>

              {/* Valid Till */}
              <div>
                <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5 block">Valid Until</label>
                {isEditing ? (
                  <Input value={validTill} onChange={e => setValidTill(e.target.value)} type="date" className="h-10 bg-muted/50 font-bold text-sm" />
                ) : (
                  <p className="font-bold text-foreground text-sm">{quote?.validTill ? format(new Date(quote.validTill), "MMM d, yyyy") : "No expiry"}</p>
                )}
              </div>

              {/* Pricing summary */}
              <div className="pt-4 border-t border-border space-y-2">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Base subtotal</span>
                  <span className="font-mono font-bold">{fmtINR(baseSubtotal)}</span>
                </div>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Markup ({markupPct}%)</span>
                  <span className="font-mono font-bold">+ {fmtINR(markupAmount)}</span>
                </div>
                <div className="flex justify-between text-xs font-bold text-foreground border-t border-border pt-2">
                  <span>Pre-GST total</span>
                  <span className="font-mono">{fmtINR(preGstTotal)}</span>
                </div>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>GST ({gstPct}%)</span>
                  <span className="font-mono font-bold">+ {fmtINR(gstAmount)}</span>
                </div>
                <div className="mt-1 pt-3 border-t border-border">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-0.5">Grand Total (incl. GST)</p>
                  <p className="text-2xl font-bold tracking-tight text-[#EA580C] font-mono">{fmtINR(grandTotal)}</p>
                </div>
              </div>
            </div>
          </SectionCard>
        </div>

        {/* ── BOQ Table ── */}
        <div className="lg:col-span-3">
          <SectionCard
            title="Bill of Quantities (BOQ)"
            subtitle="Select items from master list or create inline"
            badge={<FileText className="h-4 w-4 text-muted-foreground" />}
            noPadding
            actions={
              isEditing ? (
                <Button size="sm" onClick={addLine} className="h-8 bg-muted hover:bg-muted/80 text-foreground font-bold rounded-[6px] shadow-none">
                  <Plus className="h-4 w-4 mr-1.5" /> Add Row
                </Button>
              ) : undefined
            }
            footer={
              boqItems.length > 0 ? (
                <div className="flex flex-col sm:flex-row justify-end items-end gap-4">
                  <div className="text-right space-y-1 text-sm w-full sm:w-auto">
                    <div className="flex justify-between gap-8 text-muted-foreground">
                      <span>Base subtotal</span>
                      <span className="font-mono font-semibold text-foreground">{fmtINR(baseSubtotal)}</span>
                    </div>
                    <div className="flex justify-between gap-8 text-muted-foreground">
                      <span>Markup ({markupPct}%)</span>
                      <span className="font-mono font-semibold text-foreground">+ {fmtINR(markupAmount)}</span>
                    </div>
                    <div className="flex justify-between gap-8 font-bold text-foreground border-t border-border pt-1 mt-1">
                      <span>Pre-GST total</span>
                      <span className="font-mono">{fmtINR(preGstTotal)}</span>
                    </div>
                    <div className="flex justify-between gap-8 text-muted-foreground">
                      <span>GST ({gstPct}%)</span>
                      <span className="font-mono font-semibold text-foreground">+ {fmtINR(gstAmount)}</span>
                    </div>
                    <div className="flex justify-between gap-8 text-[#EA580C] font-extrabold text-base border-t border-orange-200 pt-2 mt-2">
                      <span>Grand Total (incl. GST)</span>
                      <span className="font-mono text-xl tracking-tight">{fmtINR(grandTotal)}</span>
                    </div>
                  </div>
                </div>
              ) : undefined
            }
          >
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-b border-border bg-muted/40 hover:bg-muted/40">
                    <TableHead className="h-10 text-[11px] font-bold uppercase tracking-wider text-muted-foreground px-5 w-[34%]">Item Description</TableHead>
                    <TableHead className="h-10 text-[11px] font-bold uppercase tracking-wider text-muted-foreground w-20">Qty</TableHead>
                    <TableHead className="h-10 text-[11px] font-bold uppercase tracking-wider text-muted-foreground w-24">UoM</TableHead>
                    <TableHead className="h-10 text-[11px] font-bold uppercase tracking-wider text-muted-foreground text-right w-32">Unit Rate (₹)</TableHead>
                    <TableHead className="h-10 text-[11px] font-bold uppercase tracking-wider text-muted-foreground text-right w-20">GST%</TableHead>
                    <TableHead className="h-10 text-[11px] font-bold uppercase tracking-wider text-muted-foreground text-right px-5 w-32">Amount (₹)</TableHead>
                    {isEditing && <TableHead className="h-10 w-[44px]" />}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {boqItems.map((item, idx) => {
                    const lineAmt = (Number(item.qty) || 0) * (Number(item.unitPrice) || 0);
                    return (
                      <TableRow key={idx} className="border-b border-border hover:bg-muted/20 transition-colors">
                        <TableCell className="px-5 py-2.5 align-middle">
                          {isEditing ? (
                            <MaterialCombobox
                              value={item.description}
                              materials={materials as any[]}
                              onSelect={(name, uom, price, gst) => onMaterialSelect(idx, name, uom, price, gst)}
                              onCreate={async (name) => {
                                await createMatMut.mutateAsync({ data: { name, uom: "NOS", gstRate: DEFAULT_GST } });
                                updateLine(idx, "description", name);
                                await queryClient.invalidateQueries({ queryKey: getGetMaterialsQueryKey() });
                              }}
                            />
                          ) : (
                            <span className="text-sm font-semibold text-foreground leading-snug block">{item.description || "—"}</span>
                          )}
                        </TableCell>
                        <TableCell className="py-2.5 align-middle">
                          {isEditing ? (
                            <Input type="number" value={item.qty} onChange={e => updateLine(idx, "qty", Number(e.target.value))} className="h-9 bg-muted/50 font-mono font-bold text-sm w-20" min={0} />
                          ) : (
                            <span className="font-mono font-bold text-sm text-foreground">{item.qty}</span>
                          )}
                        </TableCell>
                        <TableCell className="py-2.5 align-middle">
                          {isEditing ? (
                            <Select value={item.unit || "NOS"} onValueChange={v => updateLine(idx, "unit", v)}>
                              <SelectTrigger className="h-9 bg-muted/50 font-bold text-sm w-24 rounded-[6px]">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {UOM_OPTIONS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          ) : (
                            <span className="text-sm font-bold text-muted-foreground">{item.unit}</span>
                          )}
                        </TableCell>
                        <TableCell className="py-2.5 align-middle text-right">
                          {isEditing ? (
                            <Input type="number" value={item.unitPrice} onChange={e => updateLine(idx, "unitPrice", Number(e.target.value))} className="h-9 bg-muted/50 font-mono font-bold text-sm text-right ml-auto w-28" min={0} />
                          ) : (
                            <span className="font-mono font-bold text-sm text-foreground">{Number(item.unitPrice).toLocaleString("en-IN")}</span>
                          )}
                        </TableCell>
                        <TableCell className="py-2.5 align-middle text-right">
                          {isEditing ? (
                            <Select value={String(item.gstPct ?? DEFAULT_GST)} onValueChange={v => updateLine(idx, "gstPct", Number(v))}>
                              <SelectTrigger className="h-9 bg-muted/50 font-bold text-sm w-20 rounded-[6px] ml-auto">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {[0, 5, 12, 18, 28].map(r => <SelectItem key={r} value={String(r)}>{r}%</SelectItem>)}
                              </SelectContent>
                            </Select>
                          ) : (
                            <span className="font-mono font-bold text-sm text-muted-foreground">{item.gstPct ?? DEFAULT_GST}%</span>
                          )}
                        </TableCell>
                        <TableCell className="px-5 py-2.5 align-middle text-right">
                          <span className="font-mono font-bold text-sm text-[#EA580C]">
                            {lineAmt.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                          </span>
                        </TableCell>
                        {isEditing && (
                          <TableCell className="py-2.5 align-middle pr-3">
                            <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-red-500 hover:bg-red-50 h-9 w-9 rounded-[6px]" onClick={() => removeLine(idx)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })}
                  {boqItems.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={isEditing ? 7 : 6} className="h-36 text-center">
                        <div className="flex flex-col items-center justify-center text-muted-foreground">
                          <FileText className="h-8 w-8 mb-2 opacity-20" />
                          <p className="text-sm font-medium">BOQ is empty.</p>
                          {isEditing && (
                            <Button variant="link" className="text-[#EA580C] text-sm font-semibold mt-1" onClick={addLine}>
                              Add first line item
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </SectionCard>
        </div>
      </div>

      {/* ── Approve Confirmation ── */}
      <AlertDialog open={showApproveDialog} onOpenChange={setShowApproveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Approve this Quotation?</AlertDialogTitle>
            <AlertDialogDescription>
              You are approving{" "}
              <strong>QTN-{quoteId.toString().padStart(4, "0")}</strong> with a grand total of{" "}
              <strong>{fmtINR(grandTotal)}</strong>. Once approved it cannot be edited.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={() => { setShowApproveDialog(false); approveMut.mutate({ id: quoteId, data: { action: "Approve" } }); }}
            >
              Yes, Approve Quote
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Create Solar Project Dialog ── */}
      <Dialog open={showCreateProjectDialog} onOpenChange={setShowCreateProjectDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create Solar Project</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              This will create a new project pre-seeded with all 12 phases and{" "}
              <strong>{(quote?.boqItems as any[])?.length ?? 0} BOQ items</strong> from this quotation.
            </p>
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-foreground block mb-1.5">
                Project Name *
              </label>
              <Input
                value={newProjectName}
                onChange={e => setNewProjectName(e.target.value)}
                placeholder="e.g. Acme Corp — 100kW Rooftop Solar"
                className="h-10 bg-muted/50"
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateProjectDialog(false)}>Cancel</Button>
            <Button
              disabled={!newProjectName.trim() || createProjectMut.isPending}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={() => { setShowCreateProjectDialog(false); createProjectMut.mutate(newProjectName.trim()); }}
            >
              {createProjectMut.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FolderPlus className="h-4 w-4 mr-2" />}
              Create Project
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Convert to Project Dialog ── */}
      <Dialog open={showConvertDialog} onOpenChange={setShowConvertDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Convert to Project</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Enter the Client PO number to log this quotation as a project.
              Contract value will be set to <strong>{fmtINR(grandTotal)}</strong>.
            </p>
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-foreground block mb-1.5">
                Client PO Number *
              </label>
              <Input
                value={clientPoNum}
                onChange={e => setClientPoNum(e.target.value)}
                placeholder="e.g. CPO/2024/001"
                className="h-10 bg-muted/50"
                autoFocus
                onKeyDown={e => {
                  if (e.key === "Enter" && clientPoNum.trim()) {
                    setShowConvertDialog(false);
                    logPoMut.mutate({ id: quoteId, data: { clientPoNumber: clientPoNum.trim(), contractValue: grandTotal } });
                  }
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConvertDialog(false)}>Cancel</Button>
            <Button
              disabled={!clientPoNum.trim() || logPoMut.isPending}
              className="bg-[#0C1445] hover:bg-[#0A0F2C] text-white"
              onClick={() => {
                if (!clientPoNum.trim()) return;
                setShowConvertDialog(false);
                logPoMut.mutate({ id: quoteId, data: { clientPoNumber: clientPoNum.trim(), contractValue: grandTotal } });
              }}
            >
              <FileCheck className="h-4 w-4 mr-2" />
              {logPoMut.isPending ? "Converting…" : "Confirm & Convert"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {!isNew && quote && (
        <PrintPreviewModal
          open={showPrint}
          onClose={() => setShowPrint(false)}
          title={`QTN-${String(quote.id).padStart(4, "0")}`}
          subtitle={`${selectedLead?.companyName ?? ""} · Quotation v${quote.version ?? 1}`}
        >
          <QuotationPrint
            quote={quote}
            boqItems={boqItems}
            leadName={selectedLead?.companyName}
            markupPct={markupPct}
          />
        </PrintPreviewModal>
      )}
    </motion.div>
  );
}
