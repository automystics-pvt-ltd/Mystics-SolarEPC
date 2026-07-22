import { useState, useRef, useEffect } from "react";
import {
  useGetQuotation, useCreateQuotation, useUpdateQuotation,
  useApproveQuotation, useLogClientPO,
  useGetLeads, useGetMaterials, useCreateMaterial,
  getGetQuotationQueryKey, getGetMaterialsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  Loader2, ArrowLeft, Plus, Trash2, Save, FileCheck, CheckCircle, Printer,
  FileText, Calculator, ChevronsUpDown, Search, PlusCircle, Check,
} from "lucide-react";
import { useLocation } from "wouter";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/components/ui/use-toast";
import { format } from "date-fns";
import { motion } from "framer-motion";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

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
            "w-full h-10 px-3 text-left text-sm bg-gray-50 border border-gray-200 rounded-[6px] flex items-center justify-between gap-2 hover:border-gray-300 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#EA580C]",
            disabled && "opacity-50 cursor-not-allowed"
          )}
        >
          <span className={cn("truncate flex-1", !value && "text-gray-400")}>
            {value || "Select or type item…"}
          </span>
          <ChevronsUpDown className="h-3.5 w-3.5 text-gray-400 shrink-0" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[340px] p-0 shadow-xl border border-gray-200 rounded-[10px]" align="start">
        <div className="flex items-center gap-2 px-3 py-2.5 border-b border-gray-100">
          <Search className="h-3.5 w-3.5 text-gray-400 shrink-0" />
          <input
            ref={inputRef}
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search items from master list…"
            className="flex-1 text-sm bg-transparent outline-none placeholder:text-gray-400"
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
                  <p className="font-semibold text-gray-900">{m.name}</p>
                  {m.uom && <p className="text-[11px] text-gray-400">{m.uom}{m.basePrice ? ` · ₹${Number(m.basePrice).toLocaleString("en-IN")}` : ""}</p>}
                </div>
                {value === m.name && <Check className="h-3.5 w-3.5 text-[#EA580C]" />}
              </button>
            ))
          ) : (
            <p className="px-4 py-3 text-sm text-gray-400 italic">No items found</p>
          )}
        </div>
        {search.trim() && !exactMatch && (
          <div className="border-t border-gray-100 px-3 py-2">
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
  const { data: quote, isLoading } = useGetQuotation(quoteId, {
    query: { enabled: !isNew, queryKey: getGetQuotationQueryKey(quoteId) },
  });
  const { data: leads = [] } = useGetLeads({});
  const { data: materials = [] } = useGetMaterials();

  // ── mutations ──
  const createMut = useCreateQuotation({
    mutation: { onSuccess: (d) => { toast({ title: "Quotation created" }); navigate(`/crm/quotations/${d.id}`); } },
  });
  const updateMut = useUpdateQuotation({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetQuotationQueryKey(quoteId) });
        setIsEditing(false);
        toast({ title: "Quotation saved" });
      },
    },
  });
  const approveMut = useApproveQuotation({
    mutation: { onSuccess: () => { queryClient.invalidateQueries({ queryKey: getGetQuotationQueryKey(quoteId) }); toast({ title: "Quotation approved" }); } },
  });
  const logPoMut = useLogClientPO({
    mutation: { onSuccess: () => { toast({ title: "Client PO logged — Project created!" }); navigate("/crm/client-pos"); } },
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

  // ── dialog state — must be above early returns ──
  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [showConvertDialog, setShowConvertDialog] = useState(false);
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

  if (!isNew && isLoading) {
    return <div className="flex h-[60vh] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-gray-300" /></div>;
  }

  const selectedLead = (leads as any[]).find(l => String(l.id) === String(leadId));
  const isSaving = createMut.isPending || updateMut.isPending;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 pb-10">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-[12px] premium-shadow border border-gray-100">
        <div className="flex items-center gap-5">
          <Button variant="outline" size="icon" onClick={() => navigate("/crm/quotations")} className="h-10 w-10 rounded-[8px] border-gray-200 text-gray-500 hover:text-gray-900 shrink-0">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl font-bold tracking-tight text-gray-900 font-mono">
                {isNew ? "New Quotation" : `QTN-${quoteId.toString().padStart(4, "0")}`}
              </h1>
              {!isNew && (
                <Badge variant="outline" className={`font-bold text-[10px] uppercase tracking-wide border px-2 py-0.5 rounded-[4px] ${quote?.approvalStatus === "Approved" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-gray-100 text-gray-600 border-gray-200"}`}>
                  {quote?.approvalStatus}
                </Badge>
              )}
            </div>
            {!isNew && (
              <div className="flex items-center gap-3 text-sm font-medium text-gray-500">
                <span className="font-bold">Version {quote?.version}</span>
                <span className="text-gray-300">•</span>
                <span className="text-xs text-gray-400">Lead: {(leads as any[]).find(l => l.id === quote?.leadId)?.companyName || `LD-${String(quote?.leadId).padStart(4, "0")}`}</span>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          {!isNew && (
            <Button variant="outline" className="h-10 gap-2 print:hidden" onClick={() => window.print()}>
              <Printer className="h-4 w-4" /> Print
            </Button>
          )}
          {!isNew && quote?.approvalStatus === "Draft" && !isEditing && (
            <Button onClick={() => setShowApproveDialog(true)} disabled={approveMut.isPending} className="h-10 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-[8px] print:hidden">
              <CheckCircle className="h-4 w-4 mr-2" /> Approve Quote
            </Button>
          )}
          {!isNew && quote?.approvalStatus === "Approved" && (
            <Button onClick={() => { setClientPoNum(""); setShowConvertDialog(true); }} disabled={logPoMut.isPending} className="h-10 bg-[#0C1445] hover:bg-[#0A0F2C] text-white font-bold rounded-[8px]">
              <FileCheck className="h-4 w-4 mr-2" /> Convert to Project
            </Button>
          )}
          {isEditing ? (
            <>
              {!isNew && <Button variant="ghost" onClick={() => setIsEditing(false)} className="h-10 font-bold text-gray-500">Cancel</Button>}
              <Button onClick={handleSave} disabled={isSaving} className="h-10 bg-gray-900 hover:bg-black text-white font-bold rounded-[8px] px-6">
                {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                {isNew ? "Create Quotation" : "Save Changes"}
              </Button>
            </>
          ) : (
            <Button onClick={() => setIsEditing(true)} className="w-full sm:w-auto h-10 bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 font-bold rounded-[8px] shadow-sm">
              Edit Configuration
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-4">

        {/* ── Settings Panel ── */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-white rounded-[12px] premium-shadow border border-gray-100 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-50 bg-gray-50/50 flex items-center gap-2">
              <Calculator className="h-4 w-4 text-gray-400" />
              <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">Pricing Config</h3>
            </div>
            <div className="p-5 space-y-5">

              {/* Lead selector */}
              <div>
                <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1.5 block">Lead</label>
                {isEditing && isNew ? (
                  <Select value={leadId} onValueChange={setLeadId}>
                    <SelectTrigger className="h-10 bg-gray-50 font-semibold text-sm rounded-[8px]">
                      <SelectValue placeholder="Select a lead…" />
                    </SelectTrigger>
                    <SelectContent>
                      {(leads as any[]).map(l => (
                        <SelectItem key={l.id} value={String(l.id)}>
                          <span className="font-mono text-xs text-gray-400 mr-2">LD-{String(l.id).padStart(4, "0")}</span>
                          {l.companyName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <p className="font-bold text-sm text-gray-900">
                    {selectedLead?.companyName || (quote?.leadId ? `LD-${String(quote.leadId).padStart(4, "0")}` : "—")}
                  </p>
                )}
              </div>

              {/* Markup % */}
              <div>
                <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1.5 flex justify-between">
                  <span>Markup / Margin</span>
                  {isEditing && <span className="text-[#EA580C]">%</span>}
                </label>
                {isEditing ? (
                  <Input value={markupPct} onChange={e => setMarkupPct(Number(e.target.value))} type="number" min={0} className="h-10 bg-gray-50 font-mono font-bold text-sm" />
                ) : (
                  <p className="font-bold text-gray-900 text-lg">{markupPct}%<span className="text-xs text-gray-400 font-medium ml-1">on base</span></p>
                )}
              </div>

              {/* GST % */}
              <div>
                <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1.5 flex justify-between">
                  <span>GST Rate</span>
                  {isEditing && <span className="text-[#EA580C]">%</span>}
                </label>
                {isEditing ? (
                  <Select value={String(gstPct)} onValueChange={v => setGstPct(Number(v))}>
                    <SelectTrigger className="h-10 bg-gray-50 font-semibold text-sm rounded-[8px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[0, 5, 12, 18, 28].map(r => (
                        <SelectItem key={r} value={String(r)}>{r}%</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <p className="font-bold text-gray-900 text-lg">{gstPct}%<span className="text-xs text-gray-400 font-medium ml-1">GST</span></p>
                )}
              </div>

              {/* Valid Till */}
              <div>
                <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1.5 block">Valid Until</label>
                {isEditing ? (
                  <Input value={validTill} onChange={e => setValidTill(e.target.value)} type="date" className="h-10 bg-gray-50 font-bold text-sm" />
                ) : (
                  <p className="font-bold text-gray-900 text-sm">{quote?.validTill ? format(new Date(quote.validTill), "MMM d, yyyy") : "No expiry"}</p>
                )}
              </div>

              {/* Pricing summary */}
              <div className="pt-4 border-t border-gray-100 space-y-2">
                <div className="flex justify-between text-xs text-gray-500">
                  <span>Base subtotal</span>
                  <span className="font-mono font-bold">{fmtINR(baseSubtotal)}</span>
                </div>
                <div className="flex justify-between text-xs text-gray-500">
                  <span>Markup ({markupPct}%)</span>
                  <span className="font-mono font-bold">+ {fmtINR(markupAmount)}</span>
                </div>
                <div className="flex justify-between text-xs font-bold text-gray-700 border-t border-gray-100 pt-2">
                  <span>Pre-GST total</span>
                  <span className="font-mono">{fmtINR(preGstTotal)}</span>
                </div>
                <div className="flex justify-between text-xs text-gray-500">
                  <span>GST ({gstPct}%)</span>
                  <span className="font-mono font-bold">+ {fmtINR(gstAmount)}</span>
                </div>
                <div className="mt-1 pt-3 border-t border-gray-200">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">Grand Total (incl. GST)</p>
                  <p className="text-2xl font-bold tracking-tight text-[#EA580C] font-mono">{fmtINR(grandTotal)}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── BOQ Table ── */}
        <div className="lg:col-span-3">
          <div className="bg-white rounded-[12px] premium-shadow border border-gray-100 overflow-hidden flex flex-col h-full">
            <div className="px-5 py-4 border-b border-gray-50 bg-gray-50/50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-gray-400" />
                <div>
                  <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">Bill of Quantities (BOQ)</h3>
                  <p className="text-[11px] font-medium text-gray-500 mt-0.5">Select items from master list or create inline</p>
                </div>
              </div>
              {isEditing && (
                <Button size="sm" onClick={addLine} className="h-8 bg-gray-100 hover:bg-gray-200 text-gray-900 font-bold rounded-[6px] shadow-none w-full sm:w-auto">
                  <Plus className="h-4 w-4 mr-1.5" /> Add Row
                </Button>
              )}
            </div>

            <div className="p-0 overflow-x-auto flex-1">
              <Table>
                <TableHeader>
                  <TableRow className="border-b border-gray-100 bg-white hover:bg-white">
                    <TableHead className="h-10 text-[11px] font-bold uppercase tracking-wider text-gray-400 bg-white px-5 w-[34%]">Item Description</TableHead>
                    <TableHead className="h-10 text-[11px] font-bold uppercase tracking-wider text-gray-400 bg-white w-20">Qty</TableHead>
                    <TableHead className="h-10 text-[11px] font-bold uppercase tracking-wider text-gray-400 bg-white w-24">UoM</TableHead>
                    <TableHead className="h-10 text-[11px] font-bold uppercase tracking-wider text-gray-400 bg-white text-right w-32">Unit Rate (₹)</TableHead>
                    <TableHead className="h-10 text-[11px] font-bold uppercase tracking-wider text-gray-400 bg-white text-right w-20">GST%</TableHead>
                    <TableHead className="h-10 text-[11px] font-bold uppercase tracking-wider text-gray-400 bg-white text-right px-5 w-32">Amount (₹)</TableHead>
                    {isEditing && <TableHead className="h-10 w-[44px] bg-white" />}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {boqItems.map((item, idx) => {
                    const lineAmt = (Number(item.qty) || 0) * (Number(item.unitPrice) || 0);
                    return (
                      <TableRow key={idx} className="border-b border-gray-50 hover:bg-gray-50/30 transition-colors">
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
                            <span className="text-sm font-semibold text-gray-900 leading-snug block">{item.description || "—"}</span>
                          )}
                        </TableCell>
                        <TableCell className="py-2.5 align-middle">
                          {isEditing ? (
                            <Input type="number" value={item.qty} onChange={e => updateLine(idx, "qty", Number(e.target.value))} className="h-9 bg-gray-50 font-mono font-bold text-sm w-20" min={0} />
                          ) : (
                            <span className="font-mono font-bold text-sm text-gray-900">{item.qty}</span>
                          )}
                        </TableCell>
                        <TableCell className="py-2.5 align-middle">
                          {isEditing ? (
                            <Select value={item.unit || "NOS"} onValueChange={v => updateLine(idx, "unit", v)}>
                              <SelectTrigger className="h-9 bg-gray-50 font-bold text-sm w-24 rounded-[6px]">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {UOM_OPTIONS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          ) : (
                            <span className="text-sm font-bold text-gray-500">{item.unit}</span>
                          )}
                        </TableCell>
                        <TableCell className="py-2.5 align-middle text-right">
                          {isEditing ? (
                            <Input type="number" value={item.unitPrice} onChange={e => updateLine(idx, "unitPrice", Number(e.target.value))} className="h-9 bg-gray-50 font-mono font-bold text-sm text-right ml-auto w-28" min={0} />
                          ) : (
                            <span className="font-mono font-bold text-sm text-gray-900">{Number(item.unitPrice).toLocaleString("en-IN")}</span>
                          )}
                        </TableCell>
                        <TableCell className="py-2.5 align-middle text-right">
                          {isEditing ? (
                            <Select value={String(item.gstPct ?? DEFAULT_GST)} onValueChange={v => updateLine(idx, "gstPct", Number(v))}>
                              <SelectTrigger className="h-9 bg-gray-50 font-bold text-sm w-20 rounded-[6px] ml-auto">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {[0, 5, 12, 18, 28].map(r => <SelectItem key={r} value={String(r)}>{r}%</SelectItem>)}
                              </SelectContent>
                            </Select>
                          ) : (
                            <span className="font-mono font-bold text-sm text-gray-500">{item.gstPct ?? DEFAULT_GST}%</span>
                          )}
                        </TableCell>
                        <TableCell className="px-5 py-2.5 align-middle text-right">
                          <span className="font-mono font-bold text-sm text-[#EA580C]">
                            {lineAmt.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                          </span>
                        </TableCell>
                        {isEditing && (
                          <TableCell className="py-2.5 align-middle pr-3">
                            <Button variant="ghost" size="icon" className="text-gray-400 hover:text-red-500 hover:bg-red-50 h-9 w-9 rounded-[6px]" onClick={() => removeLine(idx)}>
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
                        <div className="flex flex-col items-center justify-center text-gray-400">
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

            {/* Footer totals */}
            {boqItems.length > 0 && (
              <div className="bg-gray-50/80 border-t border-gray-100 px-6 py-4 flex flex-col sm:flex-row justify-end items-end gap-4 mt-auto">
                <div className="text-right space-y-1 text-sm">
                  <div className="flex justify-between gap-8 text-gray-500">
                    <span>Base subtotal</span>
                    <span className="font-mono font-semibold text-gray-700">{fmtINR(baseSubtotal)}</span>
                  </div>
                  <div className="flex justify-between gap-8 text-gray-500">
                    <span>Markup ({markupPct}%)</span>
                    <span className="font-mono font-semibold text-gray-700">+ {fmtINR(markupAmount)}</span>
                  </div>
                  <div className="flex justify-between gap-8 font-bold text-gray-800 border-t border-gray-200 pt-1 mt-1">
                    <span>Pre-GST total</span>
                    <span className="font-mono">{fmtINR(preGstTotal)}</span>
                  </div>
                  <div className="flex justify-between gap-8 text-gray-500">
                    <span>GST ({gstPct}%)</span>
                    <span className="font-mono font-semibold text-gray-700">+ {fmtINR(gstAmount)}</span>
                  </div>
                  <div className="flex justify-between gap-8 text-[#EA580C] font-extrabold text-base border-t border-orange-200 pt-2 mt-2">
                    <span>Grand Total (incl. GST)</span>
                    <span className="font-mono text-xl tracking-tight">{fmtINR(grandTotal)}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
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

      {/* ── Convert to Project Dialog ── */}
      <Dialog open={showConvertDialog} onOpenChange={setShowConvertDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Convert to Project</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-gray-600">
              Enter the Client PO number to log this quotation as a project.
              Contract value will be set to <strong>{fmtINR(grandTotal)}</strong>.
            </p>
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-gray-700 block mb-1.5">
                Client PO Number *
              </label>
              <Input
                value={clientPoNum}
                onChange={e => setClientPoNum(e.target.value)}
                placeholder="e.g. CPO/2024/001"
                className="h-10 bg-gray-50"
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
    </motion.div>
  );
}
