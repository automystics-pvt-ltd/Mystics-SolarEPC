import { useState, useEffect } from "react";
import { useGetProcurementPOs, useGetProcurementPO, useGetProcGrns, useGetProcGrn, useCreateProcInvoice, getGetProcInvoicesQueryKey, getGetProcurementPOQueryKey, getGetProcGrnsQueryKey, getGetProcGrnQueryKey } from "@workspace/api-client-react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Save, AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";
import { PageHeader, SectionCard, StatusBadge } from "@/components/shared";

const fmt = (n: number | null | undefined) =>
  n != null ? `₹${Number(n).toLocaleString("en-IN", { minimumFractionDigits: 2 })}` : "—";

export default function InvoiceForm({ poId: initPoId, grnId: initGrnId }: { poId?: string; grnId?: string }) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const user = (() => { try { return JSON.parse(localStorage.getItem("mystics_user") ?? "{}"); } catch { return {}; } })();

  const [selectedPoId, setSelectedPoId] = useState<string>(initPoId ?? "");
  const [selectedGrnId, setSelectedGrnId] = useState<string>(initGrnId ?? "");
  const [vendorInvoiceNumber, setVendorInvoiceNumber] = useState("");
  const [vendorInvoiceDate, setVendorInvoiceDate] = useState("");
  const [freightCharges, setFreightCharges] = useState("0");
  const [otherCharges, setOtherCharges] = useState("0");
  const [tdsAmount, setTdsAmount] = useState("0");
  const [internalNotes, setInternalNotes] = useState("");
  const [lineItems, setLineItems] = useState<any[]>([]);
  const [matchPreview, setMatchPreview] = useState<any[]>([]);

  const { data: allPOs = [] } = useGetProcurementPOs({});
  const { data: poData } = useGetProcurementPO(Number(selectedPoId), { query: { enabled: !!selectedPoId, queryKey: getGetProcurementPOQueryKey(Number(selectedPoId)) } });
  const { data: poGRNs = [] } = useGetProcGrns(
    selectedPoId ? { poId: Number(selectedPoId) } : {},
    { query: { enabled: !!selectedPoId, queryKey: getGetProcGrnsQueryKey(selectedPoId ? { poId: Number(selectedPoId) } : {}) } }
  );
  const hasGrn = !!selectedGrnId && selectedGrnId !== "none";
  const { data: grnData } = useGetProcGrn(Number(selectedGrnId), { query: { enabled: hasGrn, queryKey: getGetProcGrnQueryKey(Number(selectedGrnId)) } });

  useEffect(() => {
    const po = poData as any;
    if (!po?.items?.length) return;
    const grn = grnData as any;
    const items = po.items.map((poItem: any) => {
      const grnItem = grn?.items?.find((g: any) => g.poItemId === poItem.id || g.materialName === poItem.materialName);
      const orderedQty = Number(poItem.qty) || 0;
      const receivedQty = Number(grnItem?.acceptedQty) || 0;
      const invoicedQty = hasGrn ? receivedQty : orderedQty;
      const isMatched = hasGrn ? Math.abs(invoicedQty - receivedQty) < 0.001 : true;
      return {
        poItemId: poItem.id,
        grnItemId: grnItem?.id ?? null,
        materialName: poItem.materialName,
        materialCode: poItem.materialCode,
        uom: poItem.uom,
        hsnSacCode: poItem.hsnSacCode,
        unitPrice: poItem.unitPrice,
        gstRate: poItem.gstRate,
        discountPct: poItem.discountPct ?? 0,
        orderedQty, receivedQty,
        invoicedQty: invoicedQty.toString(),
        isMatched,
      };
    });
    setLineItems(items);
    setMatchPreview(items);
  }, [poData, grnData, selectedPoId, selectedGrnId]);

  const updateItem = (idx: number, field: string, value: string) => {
    setLineItems(prev => prev.map((item, i) => {
      if (i !== idx) return item;
      const updated = { ...item, [field]: value };
      if (field === "invoicedQty") {
        const inv = Number(value) || 0;
        const rec = Number(item.receivedQty) || 0;
        const ord = Number(item.orderedQty) || 0;
        updated.isMatched = hasGrn ? Math.abs(inv - rec) < 0.001 : inv <= ord;
      }
      return updated;
    }));
  };

  const hasMismatch = lineItems.some(i => !i.isMatched);
  const subtotal = lineItems.reduce((s, i) => {
    const taxable = (Number(i.invoicedQty) || 0) * (Number(i.unitPrice) || 0) * (1 - (Number(i.discountPct) || 0) / 100);
    return s + taxable;
  }, 0);
  const totalGst = lineItems.reduce((s, i) => {
    const taxable = (Number(i.invoicedQty) || 0) * (Number(i.unitPrice) || 0) * (1 - (Number(i.discountPct) || 0) / 100);
    return s + taxable * (Number(i.gstRate) || 18) / 100;
  }, 0);
  const totalAmount = subtotal + totalGst + Number(freightCharges) + Number(otherCharges);
  const netPayable = totalAmount - Number(tdsAmount);

  const createMut = useCreateProcInvoice();

  const handleSubmit = () => {
    if (!selectedPoId) { toast({ title: "Select a PO", variant: "destructive" }); return; }
    createMut.mutate({
      data: {
        poId: Number(selectedPoId),
        grnId: hasGrn ? Number(selectedGrnId) : undefined,
        vendorInvoiceNumber: vendorInvoiceNumber || undefined,
        vendorInvoiceDate: vendorInvoiceDate || undefined,
        freightCharges: Number(freightCharges),
        otherCharges: Number(otherCharges),
        tdsAmount: Number(tdsAmount),
        internalNotes: internalNotes || undefined,
        userName: user.name, userId: user.id,
        items: lineItems.map(i => ({
          poItemId: i.poItemId, grnItemId: i.grnItemId,
          materialName: i.materialName, materialCode: i.materialCode,
          uom: i.uom, hsnSacCode: i.hsnSacCode,
          unitPrice: i.unitPrice, gstRate: i.gstRate, discountPct: i.discountPct,
          invoicedQty: Number(i.invoicedQty),
        })),
      } as any,
    }, {
      onSuccess: (inv: any) => {
        qc.invalidateQueries({ queryKey: getGetProcInvoicesQueryKey() });
        toast({ title: `Invoice ${inv.invoiceNumber} created${inv.matchStatus === "MismatchPending" ? " (mismatch flagged)" : ""}` });
        setLocation(`/procurement/invoices/${inv.id}`);
      },
      onError: (e: any) => toast({ title: "Failed", description: e?.message, variant: "destructive" }),
    });
  };

  const [showConfirm, setShowConfirm] = useState(false);
  const acceptedGRNs = (poGRNs as any[]).filter(g => ["Accepted", "PartiallyAccepted"].includes(g.status));
  const selectedPO = (allPOs as any[]).find(p => String(p.id) === selectedPoId);

  return (
    <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }} className="space-y-6 pb-10">
      <PageHeader
        title="New Invoice"
        subtitle="Create invoice against a purchase order and GRN"
        backHref="/procurement/invoices"
      />

      {/* Select References */}
      <SectionCard title="Select References">
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Purchase Order *</Label>
              <Select value={selectedPoId} onValueChange={v => { setSelectedPoId(v); setSelectedGrnId(""); }}>
                <SelectTrigger><SelectValue placeholder="Choose a PO…" /></SelectTrigger>
                <SelectContent>
                  {(allPOs as any[]).filter(p => !["Draft", "Cancelled"].includes(p.status)).map((po: any) => (
                    <SelectItem key={po.id} value={String(po.id)}>{po.poNumber} — {po.vendorName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs font-semibold text-muted-foreground mb-1.5 block">GRN (optional — enables 3-way match)</Label>
              <Select value={selectedGrnId} onValueChange={setSelectedGrnId} disabled={!selectedPoId}>
                <SelectTrigger><SelectValue placeholder={acceptedGRNs.length === 0 ? "No accepted GRNs" : "Select GRN…"} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None — match against PO only</SelectItem>
                  {acceptedGRNs.map((g: any) => (
                    <SelectItem key={g.id} value={String(g.id)}>{g.grnNumber} ({g.status})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {selectedPO && (
            <div className="bg-muted/30 rounded-lg p-3 text-sm grid grid-cols-2 md:grid-cols-4 gap-2 border border-border">
              <div><span className="text-muted-foreground">PO#:</span> <span className="font-mono font-medium">{selectedPO.poNumber}</span></div>
              {hasGrn && <div><span className="text-muted-foreground">GRN#:</span> <span className="font-mono font-medium">{acceptedGRNs.find((g: any) => String(g.id) === selectedGrnId)?.grnNumber ?? "—"}</span></div>}
              <div><span className="text-muted-foreground">Vendor:</span> <span className="font-medium">{selectedPO.vendorName}</span></div>
              <div><span className="text-muted-foreground">PO Value:</span> <span className="font-medium">{fmt(selectedPO.totalAmount)}</span></div>
            </div>
          )}
        </div>
      </SectionCard>

      {/* Invoice Details */}
      <SectionCard title="Invoice Details">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Vendor Invoice Number</Label>
            <Input value={vendorInvoiceNumber} onChange={e => setVendorInvoiceNumber(e.target.value)} placeholder="e.g. VEN/2024/001" className="h-9" />
          </div>
          <div>
            <Label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Vendor Invoice Date</Label>
            <Input type="date" value={vendorInvoiceDate} onChange={e => setVendorInvoiceDate(e.target.value)} className="h-9" />
          </div>
          <div>
            <Label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Freight Charges</Label>
            <Input type="number" min="0" value={freightCharges} onChange={e => setFreightCharges(e.target.value)} className="h-9" />
          </div>
          <div>
            <Label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Other Charges</Label>
            <Input type="number" min="0" value={otherCharges} onChange={e => setOtherCharges(e.target.value)} className="h-9" />
          </div>
          <div>
            <Label className="text-xs font-semibold text-muted-foreground mb-1.5 block">TDS Deduction</Label>
            <Input type="number" min="0" value={tdsAmount} onChange={e => setTdsAmount(e.target.value)} className="h-9" />
          </div>
          <div className="bg-foreground rounded-lg p-3 text-background flex flex-col justify-center">
            <p className="text-xs text-background/60">Net Payable</p>
            <p className="text-xl font-bold font-mono">{fmt(netPayable)}</p>
          </div>
        </div>
      </SectionCard>

      {/* 3-Way Match Verification */}
      {lineItems.length > 0 && (
        <SectionCard
          title="3-Way Match Verification"
          subtitle="PO Ordered → GRN Accepted → Invoiced Qty"
          badge={
            hasMismatch
              ? <StatusBadge status="MismatchFlagged" />
              : <span className="flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold"><CheckCircle2 className="w-3.5 h-3.5" /> All Matched</span>
          }
          noPadding
        >
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-max">
              <thead className="bg-muted/40 border-b border-border">
                <tr>
                  {["Material", "UOM", "PO Ordered", "GRN Accepted", "Invoiced Qty", "Unit Price", "GST%", "Line Total", "Match"].map(h => (
                    <th key={h} className="text-left px-4 py-2.5 text-[11px] font-bold text-muted-foreground uppercase tracking-[0.08em] whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {lineItems.map((item, idx) => {
                  const invoicedQty = Number(item.invoicedQty) || 0;
                  const taxable = invoicedQty * (Number(item.unitPrice) || 0) * (1 - (Number(item.discountPct) || 0) / 100);
                  const gstAmt = taxable * (Number(item.gstRate) || 18) / 100;
                  const lineTotal = taxable + gstAmt;
                  return (
                    <tr key={idx} className={cn(
                      "hover:bg-muted/20",
                      !item.isMatched ? "border-l-2 border-l-red-400" : "border-l-2 border-l-emerald-400"
                    )}>
                      <td className="px-4 py-3"><p className="font-medium text-foreground max-w-40 truncate">{item.materialName}</p></td>
                      <td className="px-4 py-3 text-muted-foreground">{item.uom}</td>
                      <td className="px-4 py-3 font-mono">{item.orderedQty}</td>
                      <td className="px-4 py-3 font-mono text-blue-700 dark:text-blue-400">{item.receivedQty || "—"}</td>
                      <td className="px-4 py-3">
                        <Input type="number" min="0" value={item.invoicedQty} onChange={e => updateItem(idx, "invoicedQty", e.target.value)} className={cn("h-8 w-24 font-mono", !item.isMatched && "border-red-300 bg-red-50 dark:bg-red-950/20")} />
                      </td>
                      <td className="px-4 py-3 font-mono">{fmt(item.unitPrice)}</td>
                      <td className="px-4 py-3">{item.gstRate}%</td>
                      <td className="px-4 py-3 font-mono font-bold">{fmt(lineTotal)}</td>
                      <td className="px-4 py-3 text-center">
                        {item.isMatched ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <AlertTriangle className="w-4 h-4 text-red-500" />}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </SectionCard>
      )}

      {/* Internal Notes */}
      <SectionCard title="Internal Notes">
        <Textarea value={internalNotes} onChange={e => setInternalNotes(e.target.value)} placeholder="Any internal notes…" className="min-h-16" />
      </SectionCard>

      {hasMismatch && (
        <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800/40 rounded-xl p-4 flex gap-3">
          <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-red-800 dark:text-red-300">Quantity Mismatch Detected</p>
            <p className="text-sm text-red-700 dark:text-red-400 mt-0.5">The invoice will be created with a mismatch flag. An approver must approve the mismatch before this invoice can be submitted.</p>
          </div>
        </div>
      )}

      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={() => setLocation("/procurement/invoices")}>Cancel</Button>
        <Button className="gap-2 bg-orange-500 hover:bg-orange-600" onClick={() => setShowConfirm(true)} disabled={createMut.isPending || !selectedPoId}>
          {createMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {createMut.isPending ? "Creating…" : "Create Invoice"}
        </Button>
      </div>

      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className={hasMismatch ? "text-red-700 dark:text-red-400" : undefined}>
              {hasMismatch ? "⚠ Quantity Mismatch — Confirm Invoice" : "Confirm Invoice Creation"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {hasMismatch ? (
                <>
                  One or more line items have quantities that don&apos;t match the GRN.
                  The invoice will be created with a <strong>Mismatch Pending</strong> flag
                  and will require explicit sign-off before it can be approved.
                </>
              ) : (
                <>
                  You are about to create an invoice for{" "}
                  <strong>{fmt(netPayable)}</strong> net payable.
                  This action cannot be undone.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Review Again</AlertDialogCancel>
            <AlertDialogAction
              className={hasMismatch ? "bg-red-600 hover:bg-red-700 text-white" : "bg-orange-500 hover:bg-orange-600 text-white"}
              onClick={() => { setShowConfirm(false); handleSubmit(); }}
            >
              {hasMismatch ? "Create with Mismatch Flag" : "Confirm & Create Invoice"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.div>
  );
}
