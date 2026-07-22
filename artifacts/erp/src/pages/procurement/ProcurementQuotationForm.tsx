import { useState, useEffect } from "react";
import {
  useGetVendors, useCreateVendor, getGetVendorsQueryKey,
  useGetMaterials, useCreateMaterial, getGetMaterialsQueryKey, getGetMaterialCategoriesQueryKey,
  useCreateProcurementQuotation, useUpdateProcurementQuotation,
  useGetMaterialCategories, useGetProcurementQuotation, getGetProcurementQuotationQueryKey,
  getGetProcurementQuotationsQueryKey,
} from "@workspace/api-client-react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { ArrowLeft, Plus, Trash2, ChevronRight, ChevronLeft, Building2, Package, FileText, Calculator, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/use-toast";

const STEPS = ["Vendor", "Line Items", "Pricing & Terms", "Review"];
const UOM_OPTIONS = ["Nos", "Pcs", "Set", "Kg", "MT", "Mtr", "Sqm", "Sqft", "Ltr", "Box", "Carton", "Bundle", "KWp", "kWh", "KW", "KVA", "Other"];

interface LineItem { materialId?: number | null; materialCode?: string; materialName: string; description?: string; uom: string; hsnSacCode?: string; brand?: string; qty: number; unitPrice: number; discountPct: number; gstRate: number; deliveryDays?: number; remarks?: string; }

const emptyItem = (): LineItem => ({ materialName: "", uom: "Nos", qty: 1, unitPrice: 0, discountPct: 0, gstRate: 18 });

function calcItem(item: LineItem) {
  const gross = item.qty * item.unitPrice;
  const disc = gross * item.discountPct / 100;
  const taxable = gross - disc;
  const gst = taxable * item.gstRate / 100;
  return { gross, disc, taxable, gst, total: taxable + gst };
}

interface Props { editId?: string; }

export default function ProcurementQuotationForm({ editId }: Props) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [step, setStep] = useState(0);
  const [vendorId, setVendorId] = useState<number | null>(null);
  const [vendorSearch, setVendorSearch] = useState("");
  const [newVendorOpen, setNewVendorOpen] = useState(false);
  const [newVendorForm, setNewVendorForm] = useState({ name: "", gstin: "", primaryEmail: "", primaryPhone: "" });
  const [items, setItems] = useState<LineItem[]>([emptyItem()]);
  const [matSearch, setMatSearch] = useState("");
  const [newMatOpen, setNewMatOpen] = useState(false);
  const [newMatForm, setNewMatForm] = useState<any>({ name: "", uom: "Nos", gstRate: 18, isActive: true });
  const [pricing, setPricing] = useState({
    quotationDate: new Date().toISOString().split("T")[0], validityDate: "",
    paymentTerms: "Net 30", deliveryTerms: "Ex-Works", deliveryLeadDays: "",
    warrantyMonths: "", freightCharges: 0, otherCharges: 0, vendorRemarks: "", internalNotes: "",
  });
  const [initialized, setInitialized] = useState(!editId);

  const editIdNum = editId ? Number(editId) : 0;
  const { data: existing, isLoading: existingLoading } = useGetProcurementQuotation(editIdNum, {
    query: { enabled: !!editId && editIdNum > 0, queryKey: getGetProcurementQuotationQueryKey(editIdNum) }
  });

  // Pre-fill state from existing quotation (edit mode)
  useEffect(() => {
    if (!existing || initialized) return;
    if (existing.vendorId) setVendorId(existing.vendorId);
    setPricing({
      quotationDate: existing.quotationDate ?? new Date().toISOString().split("T")[0],
      validityDate: existing.validityDate ?? "",
      paymentTerms: existing.paymentTerms ?? "Net 30",
      deliveryTerms: existing.deliveryTerms ?? "Ex-Works",
      deliveryLeadDays: existing.deliveryLeadDays?.toString() ?? "",
      warrantyMonths: existing.warrantyMonths?.toString() ?? "",
      freightCharges: Number(existing.freightCharges ?? 0),
      otherCharges: Number(existing.otherCharges ?? 0),
      vendorRemarks: existing.vendorRemarks ?? "",
      internalNotes: existing.internalNotes ?? "",
    });
    if (existing.items && existing.items.length > 0) {
      setItems(existing.items.map((it: any) => ({
        materialId: it.materialId ?? null,
        materialCode: it.materialCode ?? "",
        materialName: it.materialName ?? "",
        description: it.description ?? "",
        uom: it.uom ?? "Nos",
        hsnSacCode: it.hsnSacCode ?? "",
        brand: it.brand ?? "",
        qty: Number(it.qty ?? 1),
        unitPrice: Number(it.unitPrice ?? 0),
        discountPct: Number(it.discountPct ?? 0),
        gstRate: Number(it.gstRate ?? 18),
        deliveryDays: it.deliveryDays ?? undefined,
        remarks: it.remarks ?? "",
      })));
    }
    setInitialized(true);
  }, [existing, initialized]);

  const { data: vendors = [] } = useGetVendors();
  const { data: materials = [] } = useGetMaterials();
  const { data: _categories = [] } = useGetMaterialCategories();
  const createVendorMut = useCreateVendor();
  const createMatMut = useCreateMaterial();
  const createQMut = useCreateProcurementQuotation();
  const updateQMut = useUpdateProcurementQuotation();

  const user = (() => { try { return JSON.parse(localStorage.getItem("mystics_user") ?? "{}"); } catch { return {}; } })();

  const selectedVendor = vendors.find(v => v.id === vendorId);
  const filteredVendors = vendors.filter(v => !vendorSearch || v.name?.toLowerCase().includes(vendorSearch.toLowerCase()) || v.gstin?.includes(vendorSearch));
  const filteredMats = materials.filter(m => !matSearch || m.name?.toLowerCase().includes(matSearch.toLowerCase()) || m.code?.includes(matSearch));

  const totals = items.reduce((acc, item) => {
    const c = calcItem(item);
    return { subtotal: acc.subtotal + c.gross, disc: acc.disc + c.disc, gst: acc.gst + c.gst, total: acc.total + c.total };
  }, { subtotal: 0, disc: 0, gst: 0, total: 0 });

  const createVendor = () => {
    createVendorMut.mutate({ data: newVendorForm }, {
      onSuccess: (v) => {
        qc.invalidateQueries({ queryKey: getGetVendorsQueryKey() });
        setVendorId(v.id!);
        setNewVendorOpen(false);
      }
    });
  };

  const applyMaterial = (item: LineItem, mat: any): LineItem => ({
    ...item, materialId: mat.id, materialCode: mat.code, materialName: mat.name,
    uom: mat.uom ?? item.uom, hsnSacCode: mat.hsnSacCode ?? "", brand: mat.brand ?? "",
    gstRate: Number(mat.gstRate ?? 18), unitPrice: Number(mat.basePrice ?? 0),
  });

  const createMat = (idx: number) => {
    createMatMut.mutate({ data: newMatForm }, {
      onSuccess: (m) => {
        qc.invalidateQueries({ queryKey: getGetMaterialsQueryKey() });
        qc.invalidateQueries({ queryKey: getGetMaterialCategoriesQueryKey() });
        setItems(prev => prev.map((it, i) => i === idx ? applyMaterial(it, m) : it));
        setNewMatOpen(false);
        setNewMatForm({ name: "", uom: "Nos", gstRate: 18, isActive: true });
      }
    });
  };

  const getItemsPayload = () => items.map(it => ({
    ...it, qty: Number(it.qty), unitPrice: Number(it.unitPrice),
    discountPct: Number(it.discountPct), gstRate: Number(it.gstRate),
  }));

  const submit = () => {
    if (!vendorId) { toast({ title: "Select a vendor", variant: "destructive" }); return; }
    if (items.length === 0 || !items[0].materialName) { toast({ title: "Add at least one line item", variant: "destructive" }); return; }

    const payload = {
      vendorId, vendorSnapshotName: selectedVendor?.name, ...pricing,
      freightCharges: Number(pricing.freightCharges), otherCharges: Number(pricing.otherCharges),
      deliveryLeadDays: pricing.deliveryLeadDays ? Number(pricing.deliveryLeadDays) : undefined,
      warrantyMonths: pricing.warrantyMonths ? Number(pricing.warrantyMonths) : undefined,
      userName: user.name, userId: user.id, userRole: user.role,
      items: getItemsPayload(),
    };

    if (editId && editIdNum > 0) {
      updateQMut.mutate({ id: editIdNum, data: payload as any }, {
        onSuccess: (q: any) => {
          qc.invalidateQueries({ queryKey: getGetProcurementQuotationsQueryKey() });
          qc.invalidateQueries({ queryKey: getGetProcurementQuotationQueryKey(editIdNum) });
          toast({ title: "Quotation updated" });
          setLocation(`/procurement/quotations/${q.id ?? editIdNum}`);
        }
      });
    } else {
      createQMut.mutate({ data: payload as any }, {
        onSuccess: (q: any) => {
          qc.invalidateQueries({ queryKey: getGetProcurementQuotationsQueryKey() });
          toast({ title: "Quotation created" });
          setLocation(`/procurement/quotations/${q.id}`);
        }
      });
    }
  };

  const isPending = createQMut.isPending || updateQMut.isPending;

  if (editId && (existingLoading || !initialized)) {
    return (
      <div className="flex items-center justify-center h-64 gap-3 text-slate-500">
        <Loader2 className="w-5 h-5 animate-spin" />
        <span>Loading quotation…</span>
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 pb-10 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="outline" size="icon" onClick={() => setLocation(editId ? `/procurement/quotations/${editId}` : "/procurement/quotations")} className="h-9 w-9"><ArrowLeft className="w-4 h-4" /></Button>
        <div>
          <h1 className="text-xl font-bold text-slate-900">{editId ? `Edit Quotation` : "New Vendor Quotation"}</h1>
          <p className="text-sm text-slate-500">{editId ? `Editing ${existing?.referenceId ?? "…"} — changes saved as a new version` : "Fill in all steps to create a procurement quotation"}</p>
        </div>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-0">
        {STEPS.map((s, i) => (
          <div key={s} className="flex items-center">
            <button onClick={() => i < step && setStep(i)} disabled={i > step}
              className={cn("flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all",
                i === step ? "bg-orange-500 text-white" : i < step ? "bg-orange-100 text-orange-700 cursor-pointer hover:bg-orange-200" : "bg-slate-100 text-slate-400")}>
              <span className="w-5 h-5 rounded-full flex items-center justify-center text-xs border-2 border-current">{i + 1}</span>
              {s}
            </button>
            {i < STEPS.length - 1 && <ChevronRight className="w-4 h-4 text-slate-300 mx-1" />}
          </div>
        ))}
      </div>

      {/* STEP 0: Vendor */}
      {step === 0 && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <Building2 className="w-5 h-5 text-orange-500" />
            <h2 className="font-bold text-slate-800">Select Vendor</h2>
          </div>
          <Input value={vendorSearch} onChange={e => setVendorSearch(e.target.value)} placeholder="Search vendor by name or GSTIN…" />
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {filteredVendors.map(v => (
              <div key={v.id} onClick={() => setVendorId(v.id!)}
                className={cn("p-3 rounded-lg border cursor-pointer transition-all", vendorId === v.id ? "border-orange-400 bg-orange-50" : "border-slate-200 hover:border-slate-300")}>
                <p className="font-semibold text-sm text-slate-900">{v.name}</p>
                <p className="text-xs text-slate-500">{v.code} {v.gstin ? `· GSTIN: ${v.gstin}` : ""} · {v.status}</p>
              </div>
            ))}
            {filteredVendors.length === 0 && <p className="text-sm text-slate-400 py-4 text-center">No vendors found</p>}
          </div>
          <Button variant="outline" size="sm" className="gap-1.5 w-full" onClick={() => setNewVendorOpen(true)}><Plus className="w-3.5 h-3.5" /> Create New Vendor Inline</Button>
          {selectedVendor && <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-sm text-emerald-800 font-medium">✓ Selected: {selectedVendor.name}</div>}
        </div>
      )}

      {/* STEP 1: Line items */}
      {step === 1 && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2"><Package className="w-5 h-5 text-orange-500" /><h2 className="font-bold text-slate-800">Line Items</h2></div>
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setItems(prev => [...prev, emptyItem()])}><Plus className="w-3.5 h-3.5" /> Add Row</Button>
          </div>
          <div className="space-y-3">
            {items.map((item, idx) => {
              const c = calcItem(item);
              return (
                <div key={idx} className="border border-slate-200 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-500">LINE {idx + 1}</span>
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-400 hover:text-red-500" onClick={() => setItems(prev => prev.filter((_, i) => i !== idx))}><Trash2 className="w-3.5 h-3.5" /></Button>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="col-span-2">
                      <Label className="text-xs">Material *</Label>
                      <div className="flex gap-1 mt-1">
                        <Select value={item.materialId?.toString() ?? ""} onValueChange={v => {
                          const mat = materials.find(m => m.id === Number(v));
                          if (mat) setItems(prev => prev.map((it, i) => i === idx ? applyMaterial(it, mat) : it));
                        }}>
                          <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Select material…" /></SelectTrigger>
                          <SelectContent>{filteredMats.map(m => <SelectItem key={m.id} value={m.id!.toString()}>{m.name}</SelectItem>)}</SelectContent>
                        </Select>
                        <Button variant="outline" size="icon" className="h-9 w-9 shrink-0" onClick={() => setNewMatOpen(true)}><Plus className="w-3.5 h-3.5" /></Button>
                      </div>
                      {!item.materialId && <Input className="mt-1 h-9" placeholder="Or type material name" value={item.materialName} onChange={e => setItems(prev => prev.map((it, i) => i === idx ? { ...it, materialName: e.target.value } : it))} />}
                    </div>
                    <div><Label className="text-xs">HSN/SAC</Label><Input className="mt-1 h-9" value={item.hsnSacCode ?? ""} onChange={e => setItems(prev => prev.map((it, i) => i === idx ? { ...it, hsnSacCode: e.target.value } : it))} /></div>
                    <div><Label className="text-xs">Brand</Label><Input className="mt-1 h-9" value={item.brand ?? ""} onChange={e => setItems(prev => prev.map((it, i) => i === idx ? { ...it, brand: e.target.value } : it))} /></div>
                    <div><Label className="text-xs">Qty *</Label><Input type="number" className="mt-1 h-9" value={item.qty} onChange={e => setItems(prev => prev.map((it, i) => i === idx ? { ...it, qty: Number(e.target.value) } : it))} /></div>
                    <div><Label className="text-xs">UoM</Label><Select value={item.uom} onValueChange={v => setItems(prev => prev.map((it, i) => i === idx ? { ...it, uom: v } : it))}><SelectTrigger className="mt-1 h-9"><SelectValue /></SelectTrigger><SelectContent>{UOM_OPTIONS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent></Select></div>
                    <div><Label className="text-xs">Unit Price (₹)</Label><Input type="number" className="mt-1 h-9" value={item.unitPrice} onChange={e => setItems(prev => prev.map((it, i) => i === idx ? { ...it, unitPrice: Number(e.target.value) } : it))} /></div>
                    <div><Label className="text-xs">Discount %</Label><Input type="number" className="mt-1 h-9" value={item.discountPct} onChange={e => setItems(prev => prev.map((it, i) => i === idx ? { ...it, discountPct: Number(e.target.value) } : it))} /></div>
                    <div><Label className="text-xs">GST %</Label><Input type="number" className="mt-1 h-9" value={item.gstRate} onChange={e => setItems(prev => prev.map((it, i) => i === idx ? { ...it, gstRate: Number(e.target.value) } : it))} /></div>
                    <div><Label className="text-xs">Lead (days)</Label><Input type="number" className="mt-1 h-9" value={item.deliveryDays ?? ""} onChange={e => setItems(prev => prev.map((it, i) => i === idx ? { ...it, deliveryDays: Number(e.target.value) } : it))} /></div>
                  </div>
                  <div className="flex justify-end gap-4 text-xs text-slate-500 bg-slate-50 rounded-lg p-2">
                    <span>Taxable: <strong className="text-slate-800">₹{c.taxable.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</strong></span>
                    <span>GST: <strong className="text-slate-800">₹{c.gst.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</strong></span>
                    <span className="text-base font-bold text-slate-900">Line Total: ₹{c.total.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="bg-slate-900 text-white rounded-xl p-4 flex justify-between items-center">
            <span className="text-sm opacity-70">Grand Total ({items.length} item{items.length !== 1 ? "s" : ""})</span>
            <span className="text-xl font-bold font-mono">₹{totals.total.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
          </div>
        </div>
      )}

      {/* STEP 2: Pricing & Terms */}
      {step === 2 && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
          <div className="flex items-center gap-2"><Calculator className="w-5 h-5 text-orange-500" /><h2 className="font-bold text-slate-800">Pricing & Terms</h2></div>
          <div className="grid grid-cols-2 gap-4">
            <div><Label>Quotation Date</Label><Input type="date" value={pricing.quotationDate} onChange={e => setPricing(p => ({ ...p, quotationDate: e.target.value }))} className="mt-1" /></div>
            <div><Label>Validity Date</Label><Input type="date" value={pricing.validityDate} onChange={e => setPricing(p => ({ ...p, validityDate: e.target.value }))} className="mt-1" /></div>
            <div><Label>Payment Terms</Label><Input value={pricing.paymentTerms} onChange={e => setPricing(p => ({ ...p, paymentTerms: e.target.value }))} placeholder="e.g. Net 30" className="mt-1" /></div>
            <div><Label>Delivery Terms</Label><Input value={pricing.deliveryTerms} onChange={e => setPricing(p => ({ ...p, deliveryTerms: e.target.value }))} placeholder="Ex-Works / CIF etc." className="mt-1" /></div>
            <div><Label>Delivery Lead Days</Label><Input type="number" value={pricing.deliveryLeadDays} onChange={e => setPricing(p => ({ ...p, deliveryLeadDays: e.target.value }))} className="mt-1" /></div>
            <div><Label>Warranty (months)</Label><Input type="number" value={pricing.warrantyMonths} onChange={e => setPricing(p => ({ ...p, warrantyMonths: e.target.value }))} className="mt-1" /></div>
            <div><Label>Freight Charges (₹)</Label><Input type="number" value={pricing.freightCharges} onChange={e => setPricing(p => ({ ...p, freightCharges: Number(e.target.value) }))} className="mt-1" /></div>
            <div><Label>Other Charges (₹)</Label><Input type="number" value={pricing.otherCharges} onChange={e => setPricing(p => ({ ...p, otherCharges: Number(e.target.value) }))} className="mt-1" /></div>
            <div className="col-span-2"><Label>Vendor Remarks</Label><Textarea value={pricing.vendorRemarks} onChange={e => setPricing(p => ({ ...p, vendorRemarks: e.target.value }))} className="mt-1" rows={2} /></div>
            <div className="col-span-2"><Label>Internal Notes</Label><Textarea value={pricing.internalNotes} onChange={e => setPricing(p => ({ ...p, internalNotes: e.target.value }))} className="mt-1" rows={2} /></div>
          </div>
        </div>
      )}

      {/* STEP 3: Review */}
      {step === 3 && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
          <div className="flex items-center gap-2"><FileText className="w-5 h-5 text-orange-500" /><h2 className="font-bold text-slate-800">Review & {editId ? "Save Changes" : "Create"}</h2></div>
          <div className="space-y-3">
            <div className="bg-slate-50 rounded-xl p-4 grid grid-cols-2 gap-3 text-sm">
              <div><span className="text-slate-500">Vendor</span><p className="font-semibold">{selectedVendor?.name ?? "None selected"}</p></div>
              <div><span className="text-slate-500">Items</span><p className="font-semibold">{items.length} line item{items.length !== 1 ? "s" : ""}</p></div>
              <div><span className="text-slate-500">Subtotal</span><p className="font-semibold font-mono">₹{totals.subtotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</p></div>
              <div><span className="text-slate-500">Total GST</span><p className="font-semibold font-mono">₹{totals.gst.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</p></div>
              <div><span className="text-slate-500">Freight</span><p className="font-semibold font-mono">₹{Number(pricing.freightCharges).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</p></div>
              <div className="col-span-2 border-t border-slate-200 pt-3 flex justify-between">
                <span className="text-slate-700 font-bold text-base">Grand Total</span>
                <span className="font-bold font-mono text-lg">₹{(totals.total + Number(pricing.freightCharges) + Number(pricing.otherCharges)).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
              </div>
            </div>
            {editId
              ? <p className="text-sm text-slate-500">Saving will create a new version of this quotation and update all line items.</p>
              : <p className="text-sm text-slate-500">The quotation will be created in <strong>Draft</strong> status. You can edit it and submit for approval.</p>
            }
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="flex justify-between pt-2">
        <Button variant="outline" onClick={() => step === 0 ? setLocation(editId ? `/procurement/quotations/${editId}` : "/procurement/quotations") : setStep(s => s - 1)} className="gap-1.5">
          <ChevronLeft className="w-4 h-4" />{step === 0 ? "Cancel" : "Back"}
        </Button>
        <Button onClick={() => step < STEPS.length - 1 ? setStep(s => s + 1) : submit()} disabled={isPending} className="gap-1.5">
          {step < STEPS.length - 1 ? "Next" : isPending ? (editId ? "Saving…" : "Creating…") : (editId ? "Save Changes" : "Create Quotation")}<ChevronRight className="w-4 h-4" />
        </Button>
      </div>

      {/* Inline vendor create */}
      <Dialog open={newVendorOpen} onOpenChange={setNewVendorOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Create New Vendor</DialogTitle></DialogHeader>
          <div className="space-y-3 pt-2">
            <div><Label>Name *</Label><Input value={newVendorForm.name} onChange={e => setNewVendorForm(f => ({ ...f, name: e.target.value }))} className="mt-1" /></div>
            <div><Label>GSTIN</Label><Input value={newVendorForm.gstin} onChange={e => setNewVendorForm(f => ({ ...f, gstin: e.target.value }))} className="mt-1" /></div>
            <div><Label>Email</Label><Input type="email" value={newVendorForm.primaryEmail} onChange={e => setNewVendorForm(f => ({ ...f, primaryEmail: e.target.value }))} className="mt-1" /></div>
            <div><Label>Phone</Label><Input value={newVendorForm.primaryPhone} onChange={e => setNewVendorForm(f => ({ ...f, primaryPhone: e.target.value }))} className="mt-1" /></div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setNewVendorOpen(false)}>Cancel</Button>
              <Button onClick={createVendor} disabled={!newVendorForm.name || createVendorMut.isPending}>{createVendorMut.isPending ? "Creating…" : "Create & Select"}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Inline material create */}
      <Dialog open={newMatOpen} onOpenChange={setNewMatOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Create New Material</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3 pt-2">
            <div className="col-span-2"><Label>Name *</Label><Input value={newMatForm.name} onChange={e => setNewMatForm((f: any) => ({ ...f, name: e.target.value }))} className="mt-1" /></div>
            <div><Label>HSN Code</Label><Input value={newMatForm.hsnSacCode ?? ""} onChange={e => setNewMatForm((f: any) => ({ ...f, hsnSacCode: e.target.value }))} className="mt-1" /></div>
            <div><Label>GST %</Label><Input type="number" value={newMatForm.gstRate} onChange={e => setNewMatForm((f: any) => ({ ...f, gstRate: Number(e.target.value) }))} className="mt-1" /></div>
            <div><Label>UoM</Label><Select value={newMatForm.uom} onValueChange={v => setNewMatForm((f: any) => ({ ...f, uom: v }))}><SelectTrigger className="mt-1"><SelectValue /></SelectTrigger><SelectContent>{UOM_OPTIONS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent></Select></div>
            <div><Label>Base Price</Label><Input type="number" value={newMatForm.basePrice ?? ""} onChange={e => setNewMatForm((f: any) => ({ ...f, basePrice: Number(e.target.value) }))} className="mt-1" /></div>
            <div className="col-span-2 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setNewMatOpen(false)}>Cancel</Button>
              <Button onClick={() => createMat(0)} disabled={!newMatForm.name || createMatMut.isPending}>{createMatMut.isPending ? "Creating…" : "Create & Add"}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
