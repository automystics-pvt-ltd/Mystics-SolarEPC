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
import { ArrowLeft, Package, Save, Loader2 } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";

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
        deliveredQty: item.deliveredQty ?? 0,  // already delivered on prior GRNs
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
      // Auto-compute rejectedQty
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
    const po = poData as any;
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
  // Only POs that are eligible to receive goods; FullyReceived is excluded (backend also enforces this)
  const activePOs = (allPOs as any[]).filter(p => ["Issued","Acknowledged","PartiallyReceived"].includes(p.status));
  const { isLoading: posLoading } = useGetProcurementPOs({});
  const selectedPO = activePOs.find(p => String(p.id) === selectedPoId);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 pb-10">
      <div className="flex items-center gap-3">
        <Button variant="outline" size="icon" onClick={() => setLocation("/procurement/grns")} className="h-9 w-9 shrink-0"><ArrowLeft className="w-4 h-4" /></Button>
        <div>
          <h1 className="text-xl font-bold text-slate-900">New Goods Receipt Note</h1>
          <p className="text-sm text-slate-500">Record delivery against a Purchase Order</p>
        </div>
      </div>

      {/* PO Selection */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <h2 className="font-bold text-slate-900">Purchase Order</h2>
        <div>
          <Label className="text-xs font-semibold text-slate-600 mb-1.5 block">Select PO *</Label>
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
          <div className="bg-slate-50 rounded-lg p-3 text-sm grid grid-cols-2 gap-2">
            <div><span className="text-slate-500">Vendor:</span> <span className="font-medium">{(poData as any).vendorName}</span></div>
            <div><span className="text-slate-500">PO Date:</span> <span className="font-medium">{(poData as any).poDate}</span></div>
            <div><span className="text-slate-500">Delivery Deadline:</span> <span className="font-medium">{(poData as any).deliveryDeadline ?? "—"}</span></div>
            <div><span className="text-slate-500">Status:</span> <span className="font-medium">{(poData as any).status}</span></div>
          </div>
        )}
      </div>

      {/* Delivery Details */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <h2 className="font-bold text-slate-900">Delivery Details</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <Label className="text-xs font-semibold text-slate-600 mb-1.5 block">Delivery Date</Label>
            <Input type="date" value={deliveryDate} onChange={e => setDeliveryDate(e.target.value)} className="h-9" />
          </div>
          <div>
            <Label className="text-xs font-semibold text-slate-600 mb-1.5 block">Vehicle Number</Label>
            <Input value={vehicleNumber} onChange={e => setVehicleNumber(e.target.value)} placeholder="MH12AB1234" className="h-9" />
          </div>
          <div>
            <Label className="text-xs font-semibold text-slate-600 mb-1.5 block">DC Number</Label>
            <Input value={dcNumber} onChange={e => setDcNumber(e.target.value)} placeholder="Delivery challan no." className="h-9" />
          </div>
          <div>
            <Label className="text-xs font-semibold text-slate-600 mb-1.5 block">DC Date</Label>
            <Input type="date" value={dcDate} onChange={e => setDcDate(e.target.value)} className="h-9" />
          </div>
        </div>
        <div>
          <Label className="text-xs font-semibold text-slate-600 mb-1.5 block">Remarks</Label>
          <Textarea value={remarks} onChange={e => setRemarks(e.target.value)} placeholder="General delivery remarks…" className="min-h-16 resize-none" />
        </div>
      </div>

      {/* Task 29: Fully-delivered banner — block GRN creation when every line is already fully received */}
      {lineItems.length > 0 && lineItems.every(it => Number(it.deliveredQty) >= Number(it.orderedQty)) && (
        <div className="flex items-start gap-3 bg-amber-50 border border-amber-300 rounded-xl px-5 py-4">
          <span className="text-amber-600 text-lg leading-none">⚠️</span>
          <div>
            <p className="font-bold text-amber-800">All items on this PO are fully delivered</p>
            <p className="text-sm text-amber-700 mt-0.5">Every line item has already met or exceeded its ordered quantity. No additional GRN can be created for this PO.</p>
          </div>
        </div>
      )}

      {/* Line Items QC */}
      {lineItems.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="bg-slate-50 border-b border-slate-200 px-5 py-3">
            <h2 className="font-bold text-slate-900">Item-wise Inspection</h2>
            <p className="text-xs text-slate-500 mt-0.5">Record received, accepted, and rejected quantities per item</p>
          </div>

          {/* Desktop table — hidden on small screens */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-sm min-w-max">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  {["Material", "UOM", "Ordered", "Delivered", "Remaining", "Received Qty", "Accepted Qty", "Rejected", "Damaged", "Rejection Reason", "Remarks"].map(h => (
                    <th key={h} className="text-left px-4 py-2.5 text-xs font-bold text-slate-500 uppercase whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {lineItems.map((item, idx) => {
                  const remaining = Number(item.orderedQty) - Number(item.deliveredQty);
                  const accepted = Number(item.acceptedQty) || 0;
                  const isOverDelivery = accepted > remaining + 0.001;
                  return (
                    <tr key={idx} className={isOverDelivery ? "bg-red-50" : "hover:bg-slate-50"}>
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-900 max-w-48 truncate">{item.materialName}</p>
                        {item.materialCode && <p className="text-xs text-slate-400">{item.materialCode}</p>}
                      </td>
                      <td className="px-4 py-3 text-slate-600">{item.uom}</td>
                      <td className="px-4 py-3 font-mono text-slate-700">{item.orderedQty}</td>
                      <td className="px-4 py-3 font-mono text-slate-500">{Number(item.deliveredQty) || 0}</td>
                      <td className="px-4 py-3">
                        <span className={`font-mono font-bold ${remaining <= 0 ? "text-slate-400 line-through" : "text-emerald-700"}`}>
                          {Math.max(0, remaining)}
                        </span>
                      </td>
                      <td className="px-4 py-3"><Input type="number" min="0" max={remaining} value={item.receivedQty} onChange={e => updateItem(idx, "receivedQty", e.target.value)} className="h-8 w-24 font-mono" /></td>
                      <td className="px-4 py-3">
                        <div>
                          <Input type="number" min="0" max={remaining} value={item.acceptedQty} onChange={e => updateItem(idx, "acceptedQty", e.target.value)} className={`h-8 w-24 font-mono ${isOverDelivery ? "border-red-400 focus-visible:ring-red-400" : ""}`} />
                          {isOverDelivery && (
                            <p className="text-xs text-red-600 mt-0.5 whitespace-nowrap">Exceeds remaining ({remaining})</p>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono text-red-600">{item.rejectedQty || 0}</td>
                      <td className="px-4 py-3"><Input type="number" min="0" value={item.damagedQty} onChange={e => updateItem(idx, "damagedQty", e.target.value)} className="h-8 w-24 font-mono" /></td>
                      <td className="px-4 py-3"><Input value={item.rejectionReason} onChange={e => updateItem(idx, "rejectionReason", e.target.value)} placeholder="Reason…" className="h-8 w-36" /></td>
                      <td className="px-4 py-3"><Input value={item.itemRemarks} onChange={e => updateItem(idx, "itemRemarks", e.target.value)} placeholder="Notes…" className="h-8 w-36" /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Task 10: Mobile card view — shown only on small screens */}
          <div className="sm:hidden divide-y divide-slate-100">
            {lineItems.map((item, idx) => {
              const remaining = Number(item.orderedQty) - Number(item.deliveredQty);
              const accepted = Number(item.acceptedQty) || 0;
              const isOverDelivery = accepted > remaining + 0.001;
              return (
                <div key={idx} className={`p-4 space-y-3 ${isOverDelivery ? "bg-red-50" : ""}`}>
                  <div>
                    <p className="font-bold text-slate-900">{item.materialName}</p>
                    {item.materialCode && <p className="text-xs text-slate-400">{item.materialCode}</p>}
                    <div className="flex flex-wrap gap-3 mt-1.5 text-xs">
                      <span className="text-slate-500">Ordered: <strong className="text-slate-800">{item.orderedQty} {item.uom}</strong></span>
                      <span className="text-slate-500">Delivered: <strong className="text-slate-800">{Number(item.deliveredQty) || 0}</strong></span>
                      <span className="text-slate-500">Remaining: <strong className={remaining <= 0 ? "text-slate-400 line-through" : "text-emerald-700"}>{Math.max(0, remaining)}</strong></span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs text-slate-500 mb-1 block">Received Qty</Label>
                      <Input type="number" min="0" max={remaining} value={item.receivedQty} onChange={e => updateItem(idx, "receivedQty", e.target.value)} className="h-9 font-mono" />
                    </div>
                    <div>
                      <Label className="text-xs text-slate-500 mb-1 block">Accepted Qty</Label>
                      <Input type="number" min="0" max={remaining} value={item.acceptedQty} onChange={e => updateItem(idx, "acceptedQty", e.target.value)} className={`h-9 font-mono ${isOverDelivery ? "border-red-400" : ""}`} />
                      {isOverDelivery && <p className="text-xs text-red-600 mt-0.5">Exceeds remaining ({remaining})</p>}
                    </div>
                    <div>
                      <Label className="text-xs text-slate-500 mb-1 block">Damaged Qty</Label>
                      <Input type="number" min="0" value={item.damagedQty} onChange={e => updateItem(idx, "damagedQty", e.target.value)} className="h-9 font-mono" />
                    </div>
                    <div>
                      <Label className="text-xs text-slate-500 mb-1 block">Rejected: {item.rejectedQty || 0}</Label>
                      <Input value={item.rejectionReason} onChange={e => updateItem(idx, "rejectionReason", e.target.value)} placeholder="Rejection reason…" className="h-9" />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs text-slate-500 mb-1 block">Item Remarks</Label>
                    <Input value={item.itemRemarks} onChange={e => updateItem(idx, "itemRemarks", e.target.value)} placeholder="Notes…" className="h-9" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {!selectedPoId && (
        <div className="flex flex-col items-center justify-center py-12 text-slate-400 bg-white border border-dashed border-slate-200 rounded-xl">
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
            // Task 29: Disable submit when every PO line is already fully delivered
            (lineItems.length > 0 && lineItems.every(it => Number(it.deliveredQty) >= Number(it.orderedQty))) ||
            // Task 25: Disable submit if any line has an over-delivery entry
            lineItems.some(it => {
              const remaining = Number(it.orderedQty) - Number(it.deliveredQty);
              return Number(it.acceptedQty) > remaining + 0.001;
            })
          }
        >
          <Save className="w-4 h-4" /> {createMut.isPending ? "Saving…" : "Create GRN"}
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
