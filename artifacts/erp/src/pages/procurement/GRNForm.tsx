import { useState, useEffect } from "react";
import { useGetProcurementPOs, useGetProcurementPO, useCreateProcGrn, getGetProcGrnsQueryKey, getGetProcurementPOQueryKey } from "@workspace/api-client-react";
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
import { Package, Save, Loader2 } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";
import { PageHeader, SectionCard } from "@/components/shared";

const QC_STATUSES = ["Accepted", "PartiallyAccepted", "Rejected"] as const;

export default function GRNForm({ poId: initPoId }: { poId?: string }) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const user = (() => { try { return JSON.parse(localStorage.getItem("mystics_user") ?? "{}"); } catch { return {}; } })();

  const urlPoId = typeof window !== "undefined"
    ? new URLSearchParams(window.location.search).get("poId") ?? undefined
    : undefined;
  const [selectedPoId, setSelectedPoId] = useState<string>(initPoId ?? urlPoId ?? "");
  const [deliveryDate, setDeliveryDate] = useState("");
  const [vehicleNumber, setVehicleNumber] = useState("");
  const [dcNumber, setDcNumber] = useState("");
  const [dcDate, setDcDate] = useState("");
  const [remarks, setRemarks] = useState("");
  const [lineItems, setLineItems] = useState<any[]>([]);

  const { data: allPOs = [] } = useGetProcurementPOs({});
  const { data: poData } = useGetProcurementPO(Number(selectedPoId), {
    query: { enabled: !!selectedPoId, queryKey: getGetProcurementPOQueryKey(Number(selectedPoId)) },
  });

  // When PO selected, pre-fill line items from PO items
  useEffect(() => {
    if (!poData) return;
    const po = poData as any;
    if (po.items?.length) {
      setLineItems(po.items.map((item: any) => ({
        poItemId: item.id,
        materialName: item.materialName,
        materialCode: item.materialCode,
        uom: item.uom,
        hsnSacCode: item.hsnSacCode,
        unitPrice: item.unitPrice,
        orderedQty: item.qty,
        deliveredQty: item.deliveredQty ?? 0,
        receivedQty: "",
        acceptedQty: "",
        rejectedQty: "0",
        damagedQty: "0",
        qcStatus: "Accepted",
        rejectionReason: "",
        itemRemarks: "",
      })));
    }
  }, [poData]);

  const createMut = useCreateProcGrn();

  const updateItem = (idx: number, field: string, value: string) => {
    setLineItems(prev => prev.map((item, i) => {
      if (i !== idx) return item;
      const updated = { ...item, [field]: value };
      if (field === "receivedQty" || field === "acceptedQty") {
        const rec = Number(field === "receivedQty" ? value : updated.receivedQty) || 0;
        const acc = Number(field === "acceptedQty" ? value : updated.acceptedQty) || 0;
        updated.rejectedQty = Math.max(0, rec - acc).toString();
      }
      return updated;
    }));
  };

  const handleSubmit = () => {
    if (!selectedPoId) { toast({ title: "Select a PO", variant: "destructive" }); return; }
    if (lineItems.some(i => !i.receivedQty || !i.acceptedQty)) {
      toast({ title: "Enter received & accepted quantities for all items", variant: "destructive" }); return;
    }
    createMut.mutate({
      data: {
        poId: Number(selectedPoId),
        deliveryDate: deliveryDate || undefined,
        vehicleNumber: vehicleNumber || undefined,
        dcNumber: dcNumber || undefined,
        dcDate: dcDate || undefined,
        remarks: remarks || undefined,
        userName: user.name, userId: user.id,
        items: lineItems.map(item => ({
          poItemId: item.poItemId,
          materialName: item.materialName,
          materialCode: item.materialCode,
          uom: item.uom,
          hsnSacCode: item.hsnSacCode,
          unitPrice: item.unitPrice,
          orderedQty: item.orderedQty,
          receivedQty: Number(item.receivedQty),
          acceptedQty: Number(item.acceptedQty),
          rejectedQty: Number(item.rejectedQty) || 0,
          damagedQty: Number(item.damagedQty) || 0,
          rejectionReason: item.rejectionReason || undefined,
          itemRemarks: item.itemRemarks || undefined,
        })),
      } as any,
    }, {
      onSuccess: (grn: any) => {
        qc.invalidateQueries({ queryKey: getGetProcGrnsQueryKey() });
        toast({ title: `GRN ${grn.grnNumber} created` });
        setLocation(`/procurement/grns/${grn.id}`);
      },
      onError: (e: any) => toast({ title: "Failed to create GRN", description: e?.message, variant: "destructive" }),
    });
  };

  const [showConfirm, setShowConfirm] = useState(false);
  const activePOs = (allPOs as any[]).filter(p => ["Issued","Acknowledged","PartiallyReceived"].includes(p.status));
  const selectedPO = activePOs.find(p => String(p.id) === selectedPoId);
  const allFullyDelivered = lineItems.length > 0 && lineItems.every(it => Number(it.deliveredQty) >= Number(it.orderedQty));
  const hasOverDelivery = lineItems.some(it => {
    const remaining = Number(it.orderedQty) - Number(it.deliveredQty);
    return Number(it.acceptedQty) > remaining + 0.001;
  });

  return (
    <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }} className="space-y-6 pb-10">
      <PageHeader
        title="New Goods Receipt"
        subtitle="Record received goods against a purchase order"
        backHref="/procurement/grns"
      />

      {/* Select Purchase Order */}
      <SectionCard title="Select Purchase Order">
        <div className="space-y-4">
          <div>
            <Label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Select PO *</Label>
            <Select value={selectedPoId} onValueChange={setSelectedPoId}>
              <SelectTrigger><SelectValue placeholder="Choose a Purchase Order…" /></SelectTrigger>
              <SelectContent>
                {activePOs.map((po: any) => (
                  <SelectItem key={po.id} value={String(po.id)}>
                    {po.poNumber} — {po.vendorName} ({po.status})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {poData && (
            <div className="bg-muted/30 rounded-lg p-3 text-sm grid grid-cols-2 gap-2 border border-border">
              <div><span className="text-muted-foreground">Vendor:</span> <span className="font-medium">{(poData as any).vendorName}</span></div>
              <div><span className="text-muted-foreground">PO Date:</span> <span className="font-medium">{(poData as any).poDate}</span></div>
              <div><span className="text-muted-foreground">Delivery Deadline:</span> <span className="font-medium">{(poData as any).deliveryDeadline ?? "—"}</span></div>
              <div><span className="text-muted-foreground">Status:</span> <span className="font-medium">{(poData as any).status}</span></div>
            </div>
          )}
        </div>
      </SectionCard>

      {/* Receipt Details */}
      <SectionCard title="Receipt Details">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <Label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Delivery Date</Label>
            <Input type="date" value={deliveryDate} onChange={e => setDeliveryDate(e.target.value)} className="h-9" />
          </div>
          <div>
            <Label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Vehicle Number</Label>
            <Input value={vehicleNumber} onChange={e => setVehicleNumber(e.target.value)} placeholder="MH12AB1234" className="h-9" />
          </div>
          <div>
            <Label className="text-xs font-semibold text-muted-foreground mb-1.5 block">DC Number</Label>
            <Input value={dcNumber} onChange={e => setDcNumber(e.target.value)} placeholder="Delivery challan no." className="h-9" />
          </div>
          <div>
            <Label className="text-xs font-semibold text-muted-foreground mb-1.5 block">DC Date</Label>
            <Input type="date" value={dcDate} onChange={e => setDcDate(e.target.value)} className="h-9" />
          </div>
        </div>
        <div className="mt-4">
          <Label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Remarks</Label>
          <Textarea value={remarks} onChange={e => setRemarks(e.target.value)} placeholder="General delivery remarks…" className="min-h-16 resize-none" />
        </div>
      </SectionCard>

      {/* Fully-delivered banner */}
      {allFullyDelivered && (
        <div className="flex items-start gap-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-300 dark:border-amber-700 rounded-xl px-5 py-4">
          <span className="text-amber-600 text-lg leading-none">⚠️</span>
          <div>
            <p className="font-bold text-amber-800 dark:text-amber-300">All items on this PO are fully delivered</p>
            <p className="text-sm text-amber-700 dark:text-amber-400 mt-0.5">Every line item has already met or exceeded its ordered quantity. No additional GRN can be created for this PO.</p>
          </div>
        </div>
      )}

      {/* Line Items & QC */}
      {lineItems.length > 0 && (
        <SectionCard title="Line Items & QC" subtitle="Record received, accepted, and rejected quantities per item" noPadding>
          {/* Desktop table */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-sm min-w-max">
              <thead className="bg-muted/40 border-b border-border">
                <tr>
                  {["Material", "UOM", "Ordered", "Delivered", "Remaining", "Received Qty", "Accepted Qty", "Rejected", "Damaged", "Rejection Reason", "Remarks"].map(h => (
                    <th key={h} className="text-left px-4 py-2.5 text-[11px] font-bold text-muted-foreground uppercase tracking-[0.08em] whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {lineItems.map((item, idx) => {
                  const remaining = Number(item.orderedQty) - Number(item.deliveredQty);
                  const accepted = Number(item.acceptedQty) || 0;
                  const isOverDelivery = accepted > remaining + 0.001;
                  return (
                    <tr key={idx} className={isOverDelivery ? "bg-red-50 dark:bg-red-950/20" : "hover:bg-muted/20"}>
                      <td className="px-4 py-3">
                        <p className="font-medium text-foreground max-w-48 truncate">{item.materialName}</p>
                        {item.materialCode && <p className="text-xs text-muted-foreground">{item.materialCode}</p>}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{item.uom}</td>
                      <td className="px-4 py-3 font-mono text-foreground">{item.orderedQty}</td>
                      <td className="px-4 py-3 font-mono text-muted-foreground">{Number(item.deliveredQty) || 0}</td>
                      <td className="px-4 py-3">
                        <span className={cn("font-mono font-bold", remaining <= 0 ? "text-muted-foreground line-through" : "text-emerald-700 dark:text-emerald-400")}>
                          {Math.max(0, remaining)}
                        </span>
                      </td>
                      <td className="px-4 py-3"><Input type="number" inputMode="numeric" min="0" max={remaining} value={item.receivedQty} onChange={e => updateItem(idx, "receivedQty", e.target.value)} className="h-8 w-24 font-mono" /></td>
                      <td className="px-4 py-3">
                        <div>
                          <Input type="number" inputMode="numeric" min="0" max={remaining} value={item.acceptedQty} onChange={e => updateItem(idx, "acceptedQty", e.target.value)} className={cn("h-8 w-24 font-mono", isOverDelivery && "border-red-400 focus-visible:ring-red-400")} />
                          {isOverDelivery && (
                            <p className="text-xs text-red-600 dark:text-red-400 mt-0.5 whitespace-nowrap">Exceeds remaining ({remaining})</p>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono text-red-600 dark:text-red-400">{item.rejectedQty || 0}</td>
                      <td className="px-4 py-3"><Input type="number" inputMode="numeric" min="0" value={item.damagedQty} onChange={e => updateItem(idx, "damagedQty", e.target.value)} className="h-8 w-24 font-mono" /></td>
                      <td className="px-4 py-3"><Input value={item.rejectionReason} onChange={e => updateItem(idx, "rejectionReason", e.target.value)} placeholder="Reason…" className="h-8 w-36" /></td>
                      <td className="px-4 py-3"><Input value={item.itemRemarks} onChange={e => updateItem(idx, "itemRemarks", e.target.value)} placeholder="Notes…" className="h-8 w-36" /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile card view */}
          <div className="sm:hidden divide-y divide-border">
            {lineItems.map((item, idx) => {
              const remaining = Number(item.orderedQty) - Number(item.deliveredQty);
              const accepted = Number(item.acceptedQty) || 0;
              const isOverDelivery = accepted > remaining + 0.001;
              return (
                <div key={idx} className={cn("p-4 space-y-3", isOverDelivery && "bg-red-50 dark:bg-red-950/20")}>
                  <div>
                    <p className="font-bold text-foreground">{item.materialName}</p>
                    {item.materialCode && <p className="text-xs text-muted-foreground">{item.materialCode}</p>}
                    <div className="flex flex-wrap gap-3 mt-1.5 text-xs">
                      <span className="text-muted-foreground">Ordered: <strong className="text-foreground">{item.orderedQty} {item.uom}</strong></span>
                      <span className="text-muted-foreground">Delivered: <strong className="text-foreground">{Number(item.deliveredQty) || 0}</strong></span>
                      <span className="text-muted-foreground">Remaining: <strong className={cn(remaining <= 0 ? "text-muted-foreground line-through" : "text-emerald-700 dark:text-emerald-400")}>{Math.max(0, remaining)}</strong></span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs text-muted-foreground mb-1 block">Received Qty</Label>
                      <Input type="number" inputMode="numeric" min="0" max={remaining} value={item.receivedQty} onChange={e => updateItem(idx, "receivedQty", e.target.value)} className="h-9 font-mono" />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground mb-1 block">Accepted Qty</Label>
                      <Input type="number" inputMode="numeric" min="0" max={remaining} value={item.acceptedQty} onChange={e => updateItem(idx, "acceptedQty", e.target.value)} className={cn("h-9 font-mono", isOverDelivery && "border-red-400")} />
                      {isOverDelivery && <p className="text-xs text-red-600 dark:text-red-400 mt-0.5">Exceeds remaining ({remaining})</p>}
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground mb-1 block">Damaged Qty</Label>
                      <Input type="number" inputMode="numeric" min="0" value={item.damagedQty} onChange={e => updateItem(idx, "damagedQty", e.target.value)} className="h-9 font-mono" />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground mb-1 block">Rejected: {item.rejectedQty || 0}</Label>
                      <Input value={item.rejectionReason} onChange={e => updateItem(idx, "rejectionReason", e.target.value)} placeholder="Rejection reason…" className="h-9" />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1 block">Item Remarks</Label>
                    <Input value={item.itemRemarks} onChange={e => updateItem(idx, "itemRemarks", e.target.value)} placeholder="Notes…" className="h-9" />
                  </div>
                </div>
              );
            })}
          </div>
        </SectionCard>
      )}

      {!selectedPoId && (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground bg-card border border-dashed border-border rounded-xl">
          <Package className="w-10 h-10 mb-3 opacity-40" />
          <p className="font-medium">Select a PO to load items</p>
        </div>
      )}

      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={() => setLocation("/procurement/grns")}>Cancel</Button>
        <Button
          className="gap-2 bg-orange-500 hover:bg-orange-600"
          onClick={() => setShowConfirm(true)}
          disabled={
            createMut.isPending ||
            !selectedPoId ||
            allFullyDelivered ||
            hasOverDelivery
          }
        >
          {createMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {createMut.isPending ? "Saving…" : "Create GRN"}
        </Button>
      </div>

      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm GRN Creation</AlertDialogTitle>
            <AlertDialogDescription>
              You are about to record a Goods Receipt against{" "}
              <strong>{selectedPO?.poNumber ?? `PO #${selectedPoId}`}</strong> for{" "}
              <strong>{lineItems.length} item{lineItems.length !== 1 ? "s" : ""}</strong>.
              This action will update the PO delivery quantities and cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Review Again</AlertDialogCancel>
            <AlertDialogAction
              className="bg-orange-500 hover:bg-orange-600 text-white"
              onClick={() => { setShowConfirm(false); handleSubmit(); }}
            >
              {createMut.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Confirm &amp; Create GRN
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.div>
  );
}
