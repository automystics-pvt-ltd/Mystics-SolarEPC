/**
 * Materials Catalogue — comprehensive material master data management.
 * Replaces the basic list with full CRUD, suppliers, audit trail,
 * advanced filters, bulk operations, import/export.
 */
import { useState, useEffect, useCallback, useRef, memo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  Package, Plus, Search, Filter, Download, Upload, X, ChevronDown,
  CheckSquare, Trash2, ToggleLeft, ToggleRight, Edit, Star, StarOff,
  ChevronRight, Clock, Tag, BarChart2, AlertTriangle, Building2,
  Hash, Info, Layers, DollarSign, List, LayoutGrid, FileText,
  ArrowUpDown, ArrowUp, ArrowDown, SlidersHorizontal, RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/use-toast";
import { PageHeader, SectionCard, EmptyState, StatusBadge } from "@/components/shared";
import { apiGet, apiPost, apiPatch, apiDelete } from "@/lib/fetch";
import { usePermissions } from "@/lib/permissions";
import { cn } from "@/lib/utils";

/* ── Types ──────────────────────────────────────────────────────────────── */
interface Category { id: number; name: string; code: string | null; description: string | null; }
interface Material {
  id: number; code: string | null; name: string; description: string | null;
  categoryId: number | null; categoryName: string | null; uom: string;
  hsnSacCode: string | null; gstRate: number; cessRate: number;
  basePrice: number | null; lastPurchasePrice: number | null; currency: string;
  brand: string | null; model: string | null; specifications: string | null;
  minOrderQty: number | null; leadTimeDays: number | null;
  minStockLevel: number | null; maxStockLevel: number | null; reorderPoint: number | null;
  isActive: boolean; createdAt: string; updatedAt: string;
}
interface Supplier {
  id: number; materialId: number; vendorId: number | null; vendorName: string;
  supplierPartCode: string | null; unitPrice: number | null; currency: string;
  leadTimeDays: number | null; minOrderQty: number | null; isPreferred: boolean;
  notes: string | null; createdAt: string;
}
interface AuditEntry {
  id: number; action: string; fieldChanged: string | null;
  oldValue: string | null; newValue: string | null;
  performedByName: string | null; notes: string | null; createdAt: string;
}
interface Filters { categoryId: string; uom: string; status: "all" | "active" | "inactive"; }

/* ── Constants ──────────────────────────────────────────────────────────── */
const UOM_OPTIONS = ["Nos","Pcs","Set","Pair","Kg","MT","Gm","Mtr","Cm","Mm","Ft","Inch","Sqm","Sqft","Ltr","ML","Box","Carton","Bundle","Roll","Bag","Drum","KVA","KW","KWp","kWh","VA","Other"];

const BLANK_MAT = { name: "", uom: "Nos", gstRate: 18, cessRate: 0, currency: "INR", isActive: true };

const ACTION_LABELS: Record<string, string> = {
  created: "Material created", updated: "Field updated", status_changed: "Status changed",
  supplier_added: "Supplier added", supplier_updated: "Supplier updated", supplier_removed: "Supplier removed",
};

/* ── Utilities ──────────────────────────────────────────────────────────── */
function fmtCurrency(v: number | null | undefined, currency = "INR") {
  if (v == null) return "—";
  return currency === "INR" ? `₹${v.toLocaleString("en-IN")}` : `${currency} ${v.toLocaleString()}`;
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}
function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

/* ── Stats Strip ─────────────────────────────────────────────────────────── */
const StatsStrip = memo(function StatsStrip({ materials, categories }: { materials: Material[]; categories: Category[] }) {
  const active   = materials.filter(m => m.isActive).length;
  const withPrice = materials.filter(m => m.basePrice != null).length;
  const lowStock  = materials.filter(m => m.reorderPoint != null && m.minStockLevel != null && m.reorderPoint <= m.minStockLevel).length;
  const stats = [
    { label: "Total Materials", value: materials.length, icon: Package, color: "text-blue-500", bg: "bg-blue-500/10" },
    { label: "Active",          value: active,           icon: ToggleRight, color: "text-emerald-500", bg: "bg-emerald-500/10" },
    { label: "Inactive",        value: materials.length - active, icon: ToggleLeft, color: "text-amber-500", bg: "bg-amber-500/10" },
    { label: "Categories",      value: categories.length, icon: Layers, color: "text-violet-500", bg: "bg-violet-500/10" },
    { label: "Priced",          value: withPrice,        icon: DollarSign, color: "text-cyan-500", bg: "bg-cyan-500/10" },
    { label: "Low Stock",       value: lowStock,         icon: AlertTriangle, color: "text-red-500", bg: "bg-red-500/10" },
  ];
  return (
    <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
      {stats.map(s => (
        <div key={s.label} className="bg-card border border-border/60 rounded-xl p-3 flex items-center gap-3">
          <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center shrink-0", s.bg)}>
            <s.icon className={cn("w-4.5 h-4.5", s.color)} />
          </div>
          <div className="min-w-0">
            <p className="text-xl font-bold text-foreground leading-none">{s.value}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{s.label}</p>
          </div>
        </div>
      ))}
    </div>
  );
});

/* ── Filter Panel ────────────────────────────────────────────────────────── */
function FilterPanel({ filters, categories, onChange, onClose }: {
  filters: Filters; categories: Category[];
  onChange: (f: Partial<Filters>) => void; onClose: () => void;
}) {
  return (
    <div className="bg-card border border-border/60 rounded-xl p-4 space-y-4 shadow-lg">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold">Filters</span>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors"><X className="w-4 h-4" /></button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <Label className="text-xs text-muted-foreground mb-1.5 block">Category</Label>
          <Select value={filters.categoryId || "__all"} onValueChange={v => onChange({ categoryId: v === "__all" ? "" : v })}>
            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="All categories" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all">All categories</SelectItem>
              {categories.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs text-muted-foreground mb-1.5 block">Unit of Measure</Label>
          <Select value={filters.uom || "__all"} onValueChange={v => onChange({ uom: v === "__all" ? "" : v })}>
            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="All UoMs" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all">All UoMs</SelectItem>
              {UOM_OPTIONS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs text-muted-foreground mb-1.5 block">Status</Label>
          <Select value={filters.status} onValueChange={v => onChange({ status: v as any })}>
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="active">Active only</SelectItem>
              <SelectItem value="inactive">Inactive only</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="flex justify-end">
        <button onClick={() => onChange({ categoryId: "", uom: "", status: "all" })}
          className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2">
          Clear all filters
        </button>
      </div>
    </div>
  );
}

/* ── Suppliers Tab ───────────────────────────────────────────────────────── */
function SuppliersTab({ materialId }: { materialId: number }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState<any>({ vendorName: "", currency: "INR", isPreferred: false });

  const { data: suppliers = [], isPending, isLoading } = useQuery<Supplier[]>({
    queryKey: ["material-suppliers", materialId],
    queryFn: () => apiGet(`/materials/${materialId}/suppliers`),
  });

  const addMut = useMutation({
    mutationFn: (d: any) => apiPost(`/materials/${materialId}/suppliers`, d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["material-suppliers", materialId] }); setAdding(false); setForm({ vendorName: "", currency: "INR", isPreferred: false }); toast({ title: "Supplier added" }); },
  });
  const deleteMut = useMutation({
    mutationFn: (sid: number) => apiDelete(`/materials/${materialId}/suppliers/${sid}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["material-suppliers", materialId] }); toast({ title: "Supplier removed" }); },
  });
  const preferMut = useMutation({
    mutationFn: ({ sid, isPreferred }: any) => apiPatch(`/materials/${materialId}/suppliers/${sid}`, { isPreferred }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["material-suppliers", materialId] }),
  });

  if (isPending) return <div className="py-8 text-center text-muted-foreground text-sm">Loading suppliers…</div>;

  return (
    <div className="space-y-4">
      {suppliers.length > 0 ? (
        <div className="divide-y divide-border/40">
          {suppliers.map(s => (
            <div key={s.id} className="py-3 flex items-start gap-3">
              <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5", s.isPreferred ? "bg-amber-500/15" : "bg-muted/50")}>
                <Building2 className={cn("w-4 h-4", s.isPreferred ? "text-amber-500" : "text-muted-foreground")} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-sm text-foreground">{s.vendorName}</span>
                  {s.isPreferred && <Badge className="bg-amber-500/15 text-amber-600 border-amber-500/30 text-[10px] h-4">Preferred</Badge>}
                  {s.supplierPartCode && <span className="font-mono text-[10px] text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded">{s.supplierPartCode}</span>}
                </div>
                <div className="flex items-center gap-4 mt-1 flex-wrap">
                  {s.unitPrice != null && <span className="text-xs text-muted-foreground">Price: <span className="font-medium text-foreground">{fmtCurrency(s.unitPrice, s.currency)}</span></span>}
                  {s.leadTimeDays != null && <span className="text-xs text-muted-foreground">Lead: <span className="font-medium">{s.leadTimeDays}d</span></span>}
                  {s.minOrderQty != null && <span className="text-xs text-muted-foreground">MOQ: <span className="font-medium">{s.minOrderQty}</span></span>}
                </div>
                {s.notes && <p className="text-xs text-muted-foreground mt-1 italic">{s.notes}</p>}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button onClick={() => preferMut.mutate({ sid: s.id, isPreferred: !s.isPreferred })} className="p-1.5 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-amber-500">
                  {s.isPreferred ? <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" /> : <StarOff className="w-3.5 h-3.5" />}
                </button>
                <button onClick={() => deleteMut.mutate(s.id)} className="p-1.5 rounded hover:bg-red-500/10 transition-colors text-muted-foreground hover:text-red-500">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-6 text-muted-foreground text-sm">No suppliers linked yet.</div>
      )}

      {adding ? (
        <div className="border border-border/60 rounded-lg p-4 space-y-3 bg-muted/20">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">New Supplier</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2"><Label className="text-xs">Vendor Name *</Label><Input value={form.vendorName} onChange={e => setForm({ ...form, vendorName: e.target.value })} className="mt-1 h-8 text-sm" /></div>
            <div><Label className="text-xs">Supplier Part Code</Label><Input value={form.supplierPartCode ?? ""} onChange={e => setForm({ ...form, supplierPartCode: e.target.value })} className="mt-1 h-8 text-sm" /></div>
            <div><Label className="text-xs">Unit Price</Label><Input type="number" value={form.unitPrice ?? ""} onChange={e => setForm({ ...form, unitPrice: e.target.value ? Number(e.target.value) : null })} className="mt-1 h-8 text-sm" /></div>
            <div><Label className="text-xs">Lead Time (days)</Label><Input type="number" value={form.leadTimeDays ?? ""} onChange={e => setForm({ ...form, leadTimeDays: e.target.value ? Number(e.target.value) : null })} className="mt-1 h-8 text-sm" /></div>
            <div><Label className="text-xs">Min Order Qty</Label><Input type="number" value={form.minOrderQty ?? ""} onChange={e => setForm({ ...form, minOrderQty: e.target.value ? Number(e.target.value) : null })} className="mt-1 h-8 text-sm" /></div>
            <div className="col-span-2"><Label className="text-xs">Notes</Label><Input value={form.notes ?? ""} onChange={e => setForm({ ...form, notes: e.target.value })} className="mt-1 h-8 text-sm" /></div>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox checked={form.isPreferred} onCheckedChange={v => setForm({ ...form, isPreferred: !!v })} id="preferred" />
            <label htmlFor="preferred" className="text-xs text-muted-foreground cursor-pointer">Mark as preferred supplier</label>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setAdding(false)}>Cancel</Button>
            <Button size="sm" disabled={!form.vendorName || addMut.isPending} onClick={() => addMut.mutate(form)}>
              {addMut.isPending ? "Adding…" : "Add Supplier"}
            </Button>
          </div>
        </div>
      ) : (
        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setAdding(true)}>
          <Plus className="w-3.5 h-3.5" /> Add Supplier
        </Button>
      )}
    </div>
  );
}

/* ── Audit Trail Tab ─────────────────────────────────────────────────────── */
function AuditTab({ materialId }: { materialId: number }) {
  const { data: logs = [], isPending, isLoading } = useQuery<AuditEntry[]>({
    queryKey: ["material-audit", materialId],
    queryFn: () => apiGet(`/materials/${materialId}/audit`),
  });

  if (isPending) return <div className="py-8 text-center text-muted-foreground text-sm">Loading history…</div>;
  if (!logs.length) return <div className="py-8 text-center text-muted-foreground text-sm">No history yet.</div>;

  const actionColor: Record<string, string> = {
    created: "bg-emerald-500", updated: "bg-blue-500", status_changed: "bg-amber-500",
    supplier_added: "bg-violet-500", supplier_updated: "bg-cyan-500", supplier_removed: "bg-red-500",
  };

  return (
    <div className="relative space-y-0">
      <div className="absolute left-3 top-2 bottom-2 w-px bg-border/60" />
      {logs.map((log, i) => (
        <div key={log.id} className="relative flex gap-4 pb-5 last:pb-0">
          <div className={cn("w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 z-10 ring-2 ring-background", actionColor[log.action] ?? "bg-muted")}>
            <Clock className="w-3 h-3 text-white" />
          </div>
          <div className="flex-1 min-w-0 pt-0.5">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className="text-sm font-medium text-foreground">{ACTION_LABELS[log.action] ?? log.action}</span>
              <span className="text-[10px] text-muted-foreground">{fmtDateTime(log.createdAt)}</span>
            </div>
            {log.fieldChanged && (
              <p className="text-xs text-muted-foreground mt-0.5">
                <span className="font-medium">{log.fieldChanged}</span>: <span className="line-through opacity-60">{log.oldValue || "—"}</span> → <span className="text-foreground">{log.newValue || "—"}</span>
              </p>
            )}
            {(log.newValue && !log.fieldChanged) && <p className="text-xs text-muted-foreground mt-0.5">{log.newValue}</p>}
            {log.notes && <p className="text-xs text-muted-foreground italic mt-0.5">{log.notes}</p>}
            {log.performedByName && <p className="text-[10px] text-muted-foreground mt-1">by {log.performedByName}</p>}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── Detail Slide-Over ───────────────────────────────────────────────────── */
function DetailPanel({ materialId, categories, onClose, onEdit }: {
  materialId: number; categories: Category[];
  onClose: () => void; onEdit: (m: Material) => void;
}) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [tab, setTab] = useState("overview");

  const { data: material, isLoading } = useQuery<Material>({
    queryKey: ["material", materialId],
    queryFn: () => apiGet(`/materials/${materialId}`),
    enabled: !!materialId,
  });

  const toggleMut = useMutation({
    mutationFn: (isActive: boolean) => apiPatch(`/materials/${materialId}`, { isActive }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["materials"] });
      qc.invalidateQueries({ queryKey: ["material", materialId] });
      toast({ title: material?.isActive ? "Material deactivated" : "Material activated" });
    },
  });

  if (isLoading || !material) return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="w-full max-w-[700px] bg-background border-l border-border flex items-center justify-center shadow-2xl">
        <div className="text-muted-foreground text-sm">Loading…</div>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <motion.div initial={{ x: 80, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 80, opacity: 0 }}
        transition={{ type: "spring", stiffness: 340, damping: 30 }}
        className="w-full max-w-[700px] bg-background border-l border-border flex flex-col shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="px-6 pt-5 pb-4 border-b border-border/60 bg-muted/20 shrink-0">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span className="font-mono text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">{material.code ?? "—"}</span>
                <Badge variant={material.isActive ? "default" : "secondary"} className={cn("text-[10px] h-4", material.isActive ? "bg-emerald-500/15 text-emerald-600 border-emerald-500/30" : "")}>
                  {material.isActive ? "Active" : "Inactive"}
                </Badge>
                {material.categoryName && <Badge variant="outline" className="text-[10px] h-4">{material.categoryName}</Badge>}
              </div>
              <h2 className="text-lg font-bold text-foreground leading-tight">{material.name}</h2>
              {material.brand && <p className="text-sm text-muted-foreground mt-0.5">{material.brand}{material.model ? ` · ${material.model}` : ""}</p>}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button variant="outline" size="sm" className="gap-1.5 h-8 text-xs" onClick={() => toggleMut.mutate(!material.isActive)} disabled={toggleMut.isPending}>
                {material.isActive ? <ToggleLeft className="w-3.5 h-3.5" /> : <ToggleRight className="w-3.5 h-3.5" />}
                {material.isActive ? "Deactivate" : "Activate"}
              </Button>
              <Button size="sm" className="gap-1.5 h-8 text-xs" onClick={() => onEdit(material)}>
                <Edit className="w-3.5 h-3.5" /> Edit
              </Button>
              <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={tab} onValueChange={setTab} className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="px-6 pt-3 pb-0 bg-transparent justify-start border-b border-border/60 rounded-none gap-1 h-auto shrink-0">
            {[
              { key: "overview", label: "Overview", icon: Info },
              { key: "specs", label: "Specifications", icon: FileText },
              { key: "pricing", label: "Pricing & Tax", icon: DollarSign },
              { key: "suppliers", label: "Suppliers", icon: Building2 },
              { key: "history", label: "History", icon: Clock },
            ].map(t => (
              <TabsTrigger key={t.key} value={t.key} className={cn(
                "text-xs px-3 py-2 rounded-none border-b-2 -mb-px data-[state=active]:border-primary data-[state=inactive]:border-transparent gap-1.5",
                "data-[state=active]:text-primary data-[state=inactive]:text-muted-foreground"
              )}>
                <t.icon className="w-3.5 h-3.5" /> {t.label}
              </TabsTrigger>
            ))}
          </TabsList>

          <div className="flex-1 overflow-y-auto px-6 py-5">
            <TabsContent value="overview" className="mt-0 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                {[
                  ["Category", material.categoryName ?? "—"],
                  ["Unit of Measure", material.uom],
                  ["Lead Time", material.leadTimeDays != null ? `${material.leadTimeDays} days` : "—"],
                  ["Min. Order Qty", material.minOrderQty != null ? `${material.minOrderQty} ${material.uom}` : "—"],
                ].map(([label, value]) => (
                  <div key={label} className="bg-muted/30 rounded-lg p-3">
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">{label}</p>
                    <p className="text-sm font-medium text-foreground">{value}</p>
                  </div>
                ))}
              </div>
              {material.description && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Description</p>
                  <p className="text-sm text-foreground leading-relaxed">{material.description}</p>
                </div>
              )}
              {(material.minStockLevel != null || material.maxStockLevel != null || material.reorderPoint != null) && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Inventory Levels</p>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      ["Min Stock", material.minStockLevel],
                      ["Max Stock", material.maxStockLevel],
                      ["Reorder Point", material.reorderPoint],
                    ].map(([label, val]) => (
                      <div key={label as string} className={cn("rounded-lg p-3 border", val != null && material.reorderPoint != null && material.minStockLevel != null && material.reorderPoint <= material.minStockLevel && label === "Reorder Point" ? "border-red-500/40 bg-red-500/5" : "border-border/50 bg-muted/20")}>
                        <p className="text-[10px] text-muted-foreground mb-1">{label as string}</p>
                        <p className="text-sm font-bold text-foreground">{val != null ? `${val} ${material.uom}` : "—"}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="pt-2 border-t border-border/40 flex items-center gap-6 text-xs text-muted-foreground">
                <span>Created {fmtDate(material.createdAt)}</span>
                <span>Updated {fmtDate(material.updatedAt)}</span>
              </div>
            </TabsContent>

            <TabsContent value="specs" className="mt-0">
              {material.specifications ? (
                <div className="bg-muted/30 rounded-xl p-4">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Technical Specifications</p>
                  <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{material.specifications}</p>
                </div>
              ) : (
                <div className="py-10 text-center text-muted-foreground text-sm">No specifications recorded.</div>
              )}
              {(material.brand || material.model) && (
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div className="bg-muted/30 rounded-lg p-3">
                    <p className="text-[10px] text-muted-foreground mb-1">Brand</p>
                    <p className="text-sm font-medium">{material.brand ?? "—"}</p>
                  </div>
                  <div className="bg-muted/30 rounded-lg p-3">
                    <p className="text-[10px] text-muted-foreground mb-1">Model</p>
                    <p className="text-sm font-medium">{material.model ?? "—"}</p>
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="pricing" className="mt-0 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                {[
                  { label: "Base Price", value: fmtCurrency(material.basePrice, material.currency), highlight: true },
                  { label: "Last Purchase Price", value: fmtCurrency(material.lastPurchasePrice, material.currency), highlight: false },
                  { label: "Currency", value: material.currency, highlight: false },
                  { label: "HSN / SAC Code", value: material.hsnSacCode ?? "—", mono: true },
                  { label: "GST Rate", value: material.gstRate != null ? `${material.gstRate}%` : "—", highlight: false },
                  { label: "Cess Rate", value: material.cessRate != null ? `${material.cessRate}%` : "—", highlight: false },
                ].map(f => (
                  <div key={f.label} className={cn("rounded-lg p-3", f.highlight ? "bg-primary/5 border border-primary/20" : "bg-muted/30")}>
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">{f.label}</p>
                    <p className={cn("text-sm font-bold text-foreground", (f as any).mono && "font-mono")}>{f.value}</p>
                  </div>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="suppliers" className="mt-0">
              <SuppliersTab materialId={materialId} />
            </TabsContent>

            <TabsContent value="history" className="mt-0">
              <AuditTab materialId={materialId} />
            </TabsContent>
          </div>
        </Tabs>
      </motion.div>
    </div>
  );
}

/* ── Material Form Dialog ────────────────────────────────────────────────── */
function MaterialFormDialog({ material, categories, onClose }: {
  material: Material | null; categories: Category[]; onClose: () => void;
}) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [tab, setTab] = useState("basic");
  const [form, setForm] = useState<any>(material ? { ...material } : { ...BLANK_MAT });
  const isEdit = !!material;

  const upd = (patch: any) => setForm((f: any) => ({ ...f, ...patch }));

  const saveMut = useMutation({
    mutationFn: (data: any) => isEdit
      ? apiPatch(`/materials/${material!.id}`, data)
      : apiPost("/materials", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["materials"] });
      if (isEdit) qc.invalidateQueries({ queryKey: ["material", material!.id] });
      toast({ title: isEdit ? "Material updated" : "Material created" });
      onClose();
    },
    onError: () => toast({ title: "Save failed", variant: "destructive" }),
  });

  const f = (key: string) => ({ value: form[key] ?? "", onChange: (e: any) => upd({ [key]: e.target.value }) });
  const fn = (key: string) => ({ value: form[key] ?? "", onChange: (e: any) => upd({ [key]: e.target.value === "" ? null : Number(e.target.value) }) });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? `Edit — ${material!.name}` : "New Material"}</DialogTitle>
        </DialogHeader>

        <Tabs value={tab} onValueChange={setTab} className="mt-1">
          <TabsList className="w-full">
            <TabsTrigger value="basic" className="flex-1 text-xs">Basic Info</TabsTrigger>
            <TabsTrigger value="pricing" className="flex-1 text-xs">Pricing & Tax</TabsTrigger>
            <TabsTrigger value="inventory" className="flex-1 text-xs">Inventory</TabsTrigger>
          </TabsList>

          <TabsContent value="basic" className="space-y-4 mt-4">
            <div>
              <Label className="text-xs">Name *</Label>
              <Input {...f("name")} className="mt-1" placeholder="e.g. 540Wp Mono PERC Module" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs">Category</Label>
                <Select value={form.categoryId?.toString() ?? "__none"} onValueChange={v => upd({ categoryId: v === "__none" ? null : Number(v) })}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Select category" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">— No category —</SelectItem>
                    {categories.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Unit of Measure *</Label>
                <Select value={form.uom ?? "Nos"} onValueChange={v => upd({ uom: v })}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>{UOM_OPTIONS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Brand</Label>
                <Input {...f("brand")} className="mt-1" placeholder="e.g. Waaree" />
              </div>
              <div>
                <Label className="text-xs">Model</Label>
                <Input {...f("model")} className="mt-1" placeholder="e.g. WS-540" />
              </div>
            </div>
            <div>
              <Label className="text-xs">Description</Label>
              <Textarea value={form.description ?? ""} onChange={e => upd({ description: e.target.value })} className="mt-1" rows={2} />
            </div>
            <div>
              <Label className="text-xs">Technical Specifications</Label>
              <Textarea value={form.specifications ?? ""} onChange={e => upd({ specifications: e.target.value })} className="mt-1" rows={3} placeholder="Voc, Isc, efficiency, certifications…" />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={!!form.isActive} onCheckedChange={v => upd({ isActive: v })} id="isActive" />
              <label htmlFor="isActive" className="text-sm cursor-pointer">Active in catalogue</label>
            </div>
          </TabsContent>

          <TabsContent value="pricing" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs">Base Price</Label>
                <Input type="number" {...fn("basePrice")} className="mt-1" placeholder="0.00" />
              </div>
              <div>
                <Label className="text-xs">Last Purchase Price</Label>
                <Input type="number" {...fn("lastPurchasePrice")} className="mt-1" placeholder="0.00" />
              </div>
              <div>
                <Label className="text-xs">Currency</Label>
                <Select value={form.currency ?? "INR"} onValueChange={v => upd({ currency: v })}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="INR">INR — ₹ Rupee</SelectItem>
                    <SelectItem value="USD">USD — $ Dollar</SelectItem>
                    <SelectItem value="EUR">EUR — € Euro</SelectItem>
                    <SelectItem value="GBP">GBP — £ Pound</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">HSN / SAC Code</Label>
                <Input {...f("hsnSacCode")} className="mt-1" placeholder="e.g. 85414011" />
              </div>
              <div>
                <Label className="text-xs">GST Rate (%)</Label>
                <Input type="number" {...fn("gstRate")} className="mt-1" placeholder="18" />
              </div>
              <div>
                <Label className="text-xs">Cess Rate (%)</Label>
                <Input type="number" {...fn("cessRate")} className="mt-1" placeholder="0" />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="inventory" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs">Min. Order Quantity</Label>
                <Input type="number" {...fn("minOrderQty")} className="mt-1" />
              </div>
              <div>
                <Label className="text-xs">Lead Time (days)</Label>
                <Input type="number" value={form.leadTimeDays ?? ""} onChange={e => upd({ leadTimeDays: e.target.value === "" ? null : Number(e.target.value) })} className="mt-1" />
              </div>
              <div>
                <Label className="text-xs">Min. Stock Level</Label>
                <Input type="number" {...fn("minStockLevel")} className="mt-1" />
              </div>
              <div>
                <Label className="text-xs">Max. Stock Level</Label>
                <Input type="number" {...fn("maxStockLevel")} className="mt-1" />
              </div>
              <div className="col-span-2">
                <Label className="text-xs">Reorder Point</Label>
                <Input type="number" {...fn("reorderPoint")} className="mt-1" />
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <div className="flex justify-end gap-2 pt-2 border-t border-border/40 mt-4">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={!form.name || saveMut.isPending} onClick={() => saveMut.mutate(form)}>
            {saveMut.isPending ? "Saving…" : isEdit ? "Save Changes" : "Create Material"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ── Import Dialog ───────────────────────────────────────────────────────── */
function ImportDialog({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<any[]>([]);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function parseCSV(text: string) {
    const lines = text.split("\n").filter(l => l.trim());
    const headers = lines[0].split(",").map(h => h.trim().replace(/^"|"$/g, ""));
    return lines.slice(1).map(line => {
      const vals = line.match(/(".*?"|[^,]+)(?=,|$)/g) ?? line.split(",");
      const row: any = {};
      headers.forEach((h, i) => { row[h] = (vals[i] ?? "").replace(/^"|"$/g, "").trim(); });
      return row;
    }).filter(r => r.name);
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    const reader = new FileReader();
    reader.onload = ev => setPreview(parseCSV(ev.target?.result as string).slice(0, 5));
    reader.readAsText(f);
  }

  async function doImport() {
    if (!file) return;
    setImporting(true);
    const text = await file.text();
    const items = parseCSV(text);
    try {
      const result: any = await apiPost("/materials/import", { items });
      qc.invalidateQueries({ queryKey: ["materials"] });
      toast({ title: `Imported ${result.inserted} materials successfully` });
      onClose();
    } catch {
      toast({ title: "Import failed", variant: "destructive" });
    } finally { setImporting(false); }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Import Materials from CSV</DialogTitle></DialogHeader>
        <div className="space-y-4 mt-2">
          <div className="bg-muted/30 rounded-lg p-3 text-xs text-muted-foreground">
            <p className="font-semibold text-foreground mb-1">Expected CSV format:</p>
            <code className="text-[10px] block overflow-x-auto whitespace-nowrap">name,category,uom,brand,model,hsnSacCode,gstRate,basePrice,currency,minOrderQty,leadTimeDays</code>
            <a href="/api/materials/export" download className="mt-2 inline-flex items-center gap-1 text-primary hover:underline">
              <Download className="w-3 h-3" /> Download existing catalogue as template
            </a>
          </div>
          <div className="border-2 border-dashed border-border rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 transition-colors" onClick={() => fileRef.current?.click()}>
            <Upload className="w-6 h-6 mx-auto mb-2 text-muted-foreground" />
            <p className="text-sm font-medium">{file ? file.name : "Click to upload CSV"}</p>
            <p className="text-xs text-muted-foreground mt-1">{file ? `${preview.length} rows (preview)` : "Supports .csv files"}</p>
            <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={onFileChange} />
          </div>
          {preview.length > 0 && (
            <div className="border border-border/50 rounded-lg overflow-hidden">
              <div className="bg-muted/30 px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Preview (first {preview.length} rows)</div>
              <div className="divide-y divide-border/30">
                {preview.map((row, i) => (
                  <div key={i} className="px-3 py-2 flex items-center gap-3 text-xs">
                    <span className="font-medium text-foreground">{row.name}</span>
                    {row.category && <span className="text-muted-foreground">{row.category}</span>}
                    {row.uom && <Badge variant="outline" className="text-[10px] h-4">{row.uom}</Badge>}
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button disabled={!file || importing} onClick={doImport}>
              {importing ? "Importing…" : "Import Materials"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ── Category Manager ────────────────────────────────────────────────────── */
function CategoryManager({ categories }: { categories: Category[] }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ name: "", code: "", description: "" });

  const addMut = useMutation({
    mutationFn: (d: any) => apiPost("/material-categories", d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["material-categories"] }); setAdding(false); setForm({ name: "", code: "", description: "" }); toast({ title: "Category created" }); },
  });

  return (
    <div className="space-y-3">
      <div className="border border-border/50 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/30 border-b border-border/60">
            <tr>{["Code", "Name", "Description"].map(h => <th key={h} className="text-left px-4 py-2.5 text-xs font-bold text-muted-foreground uppercase tracking-wider">{h}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-border/30">
            {categories.map(c => (
              <tr key={c.id} className="hover:bg-muted/30 transition-colors">
                <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground w-20">{c.code ?? "—"}</td>
                <td className="px-4 py-2.5 font-semibold text-foreground">{c.name}</td>
                <td className="px-4 py-2.5 text-muted-foreground text-xs">{c.description ?? "—"}</td>
              </tr>
            ))}
            {categories.length === 0 && <tr><td colSpan={3} className="text-center py-8 text-muted-foreground text-sm">No categories yet</td></tr>}
          </tbody>
        </table>
      </div>

      {adding ? (
        <div className="border border-border/60 rounded-xl p-4 space-y-3 bg-muted/10">
          <div className="grid grid-cols-3 gap-3">
            <div><Label className="text-xs">Name *</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="mt-1 h-8 text-sm" /></div>
            <div><Label className="text-xs">Code</Label><Input value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} className="mt-1 h-8 text-sm" placeholder="e.g. SOL" /></div>
            <div><Label className="text-xs">Description</Label><Input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className="mt-1 h-8 text-sm" /></div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setAdding(false)}>Cancel</Button>
            <Button size="sm" disabled={!form.name || addMut.isPending} onClick={() => addMut.mutate(form)}>{addMut.isPending ? "Creating…" : "Create"}</Button>
          </div>
        </div>
      ) : (
        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setAdding(true)}><Plus className="w-3.5 h-3.5" /> Add Category</Button>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   MAIN PAGE
════════════════════════════════════════════════════════════════════════ */
export default function MaterialsList() {
  const qc = useQueryClient();
  const { toast } = useToast();

  /* ── RBAC ───────────────────────────────────────────────────────────── */
  const perms = usePermissions("materials");

  /* ── State ──────────────────────────────────────────────────────────── */
  const [search, setSearch]           = useState("");
  const [dSearch, setDSearch]         = useState("");
  const [filters, setFilters]         = useState<Filters>({ categoryId: "", uom: "", status: "all" });
  const [showFilters, setShowFilters] = useState(false);
  const [viewMode, setViewMode]       = useState<"table" | "card">("table");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [detailId, setDetailId]       = useState<number | null>(null);
  const [formOpen, setFormOpen]       = useState(false);
  const [editMaterial, setEditMaterial] = useState<Material | null>(null);
  const [showImport, setShowImport]   = useState(false);
  const [mainTab, setMainTab]         = useState<"materials" | "categories">("materials");
  const [sort, setSort]               = useState<{ key: string; dir: "asc" | "desc" }>({ key: "name", dir: "asc" });

  /* Debounce search */
  useEffect(() => {
    const t = setTimeout(() => setDSearch(search), 280);
    return () => clearTimeout(t);
  }, [search]);

  /* ── Queries ────────────────────────────────────────────────────────── */
  const { data: categories = [], isLoading: catLoading } = useQuery<Category[]>({
    queryKey: ["material-categories"],
    queryFn: () => apiGet("/material-categories"),
    staleTime: 5 * 60_000,
  });

  const { data: materials = [], isLoading } = useQuery<Material[]>({
    queryKey: ["materials", dSearch, filters.categoryId, filters.uom, filters.status],
    queryFn: () => apiGet("/materials", {
      search: dSearch || undefined,
      categoryId: filters.categoryId || undefined,
      uom: filters.uom || undefined,
      isActive: filters.status === "all" ? undefined : filters.status === "active",
    }),
    staleTime: 60_000,
    placeholderData: (prev: any) => prev,
  });

  /* ── Sorting ────────────────────────────────────────────────────────── */
  const sorted = [...materials].sort((a, b) => {
    const dir = sort.dir === "asc" ? 1 : -1;
    const va = (a as any)[sort.key] ?? "";
    const vb = (b as any)[sort.key] ?? "";
    if (typeof va === "number") return (va - vb) * dir;
    return String(va).localeCompare(String(vb)) * dir;
  });

  const toggleSort = (key: string) => setSort(s => s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" });
  const SortIcon = ({ column }: { column: string }) => {
    if (sort.key !== column) return <ArrowUpDown className="w-3 h-3 text-muted-foreground/50" />;
    return sort.dir === "asc" ? <ArrowUp className="w-3 h-3 text-primary" /> : <ArrowDown className="w-3 h-3 text-primary" />;
  };

  /* ── Mutations ──────────────────────────────────────────────────────── */
  const deleteMut = useMutation({
    mutationFn: (id: number) => apiDelete(`/materials/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["materials"] }); setDetailId(null); toast({ title: "Material deleted" }); },
  });

  const bulkMut = useMutation({
    mutationFn: ({ action, ids }: { action: string; ids: number[] }) => apiPost("/materials/bulk", { action, ids }),
    onSuccess: (_, { action, ids }) => {
      qc.invalidateQueries({ queryKey: ["materials"] });
      setSelectedIds(new Set());
      toast({ title: `${ids.length} material${ids.length !== 1 ? "s" : ""} ${action === "activate" ? "activated" : action === "deactivate" ? "deactivated" : "deleted"}` });
    },
  });

  const seedMut = useMutation({
    mutationFn: () => apiPost("/materials/seed"),
    onSuccess: (data: any) => { qc.invalidateQueries({ queryKey: ["materials"] }); qc.invalidateQueries({ queryKey: ["material-categories"] }); toast({ title: `Seeded ${data.materials} materials across ${data.categories} categories` }); },
  });

  /* ── Selection helpers ──────────────────────────────────────────────── */
  const allSelected = sorted.length > 0 && sorted.every(m => selectedIds.has(m.id));
  const toggleAll = () => setSelectedIds(allSelected ? new Set() : new Set(sorted.map(m => m.id)));
  const toggleOne = (id: number) => setSelectedIds(prev => { const s = new Set(prev); if (s.has(id)) s.delete(id); else s.add(id); return s; });

  /* ── Export CSV ─────────────────────────────────────────────────────── */
  const exportCSV = () => {
    const params = new URLSearchParams();
    if (filters.categoryId) params.set("categoryId", filters.categoryId);
    if (filters.status !== "all") params.set("status", filters.status);
    const token = localStorage.getItem("mystics_token");
    const url = `/api/materials/export${params.size ? `?${params}` : ""}`;
    const a = document.createElement("a");
    a.href = url; a.download = "materials.csv"; a.click();
  };

  const activeFilters = [
    filters.categoryId && { key: "categoryId", label: `Category: ${categories.find(c => String(c.id) === filters.categoryId)?.name ?? "?"}` },
    filters.uom && { key: "uom", label: `UoM: ${filters.uom}` },
    filters.status !== "all" && { key: "status", label: `Status: ${filters.status}` },
  ].filter(Boolean) as { key: keyof Filters; label: string }[];

  /* ── Render ─────────────────────────────────────────────────────────── */
  return (
    <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }} className="space-y-5 pb-16">
      <PageHeader
        title="Materials Catalogue"
        subtitle={`Master material data · ${materials.length} items`}
        actions={
          <div className="flex items-center gap-2">
            {materials.length === 0 && !isLoading && perms.canCreate && (
              <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => seedMut.mutate()} disabled={seedMut.isPending}>
                <RefreshCw className={cn("w-3.5 h-3.5", seedMut.isPending && "animate-spin")} />
                {seedMut.isPending ? "Seeding…" : "Load Demo Data"}
              </Button>
            )}
            {perms.canImport && (
              <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => setShowImport(true)}>
                <Upload className="w-3.5 h-3.5" /> Import
              </Button>
            )}
            {perms.canExport && (
              <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={exportCSV}>
                <Download className="w-3.5 h-3.5" /> Export
              </Button>
            )}
            {perms.canCreate && (
              <Button size="sm" className="gap-1.5" onClick={() => { setEditMaterial(null); setFormOpen(true); }}>
                <Plus className="w-4 h-4" /> Add Material
              </Button>
            )}
          </div>
        }
      />

      {/* Stats */}
      <StatsStrip materials={materials} categories={categories} />

      {/* Main tabs */}
      <Tabs value={mainTab} onValueChange={v => setMainTab(v as any)}>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <TabsList>
            <TabsTrigger value="materials" className="gap-1.5">
              <Package className="w-3.5 h-3.5" /> Materials ({materials.length})
            </TabsTrigger>
            <TabsTrigger value="categories" className="gap-1.5">
              <Layers className="w-3.5 h-3.5" /> Categories ({categories.length})
            </TabsTrigger>
          </TabsList>

          {mainTab === "materials" && (
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name, code, brand…"
                  className="pl-8 h-8 w-56 text-xs" />
                {search && <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"><X className="w-3 h-3" /></button>}
              </div>
              <Button variant={showFilters ? "default" : "outline"} size="sm" className="gap-1.5 text-xs h-8" onClick={() => setShowFilters(o => !o)}>
                <SlidersHorizontal className="w-3.5 h-3.5" />
                Filters {activeFilters.length > 0 && <span className="bg-primary text-primary-foreground rounded-full w-4 h-4 flex items-center justify-center text-[10px] leading-none">{activeFilters.length}</span>}
              </Button>
              <div className="flex items-center border border-border rounded-lg overflow-hidden">
                <button onClick={() => setViewMode("table")} className={cn("p-1.5 transition-colors", viewMode === "table" ? "bg-primary text-primary-foreground" : "hover:bg-muted")}>
                  <List className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => setViewMode("card")} className={cn("p-1.5 transition-colors", viewMode === "card" ? "bg-primary text-primary-foreground" : "hover:bg-muted")}>
                  <LayoutGrid className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>

        <TabsContent value="materials" className="mt-4 space-y-3">
          {/* Filter panel */}
          <AnimatePresence>
            {showFilters && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.18 }}>
                <FilterPanel filters={filters} categories={categories}
                  onChange={patch => setFilters(f => ({ ...f, ...patch }))}
                  onClose={() => setShowFilters(false)} />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Active filter chips */}
          {activeFilters.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-muted-foreground">Filtered by:</span>
              {activeFilters.map(af => (
                <button key={af.key} onClick={() => setFilters(f => ({ ...f, [af.key]: af.key === "status" ? "all" : "" }))}
                  className="inline-flex items-center gap-1 text-xs bg-primary/10 text-primary border border-primary/20 rounded-full px-2.5 py-0.5 hover:bg-primary/20 transition-colors">
                  {af.label} <X className="w-3 h-3" />
                </button>
              ))}
            </div>
          )}

          {/* Bulk action bar */}
          <AnimatePresence>
            {selectedIds.size > 0 && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}
                className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-card border border-border/60 rounded-2xl shadow-2xl px-4 py-3 flex items-center gap-3">
                <span className="text-sm font-semibold text-foreground">{selectedIds.size} selected</span>
                <div className="w-px h-5 bg-border" />
                <button onClick={() => bulkMut.mutate({ action: "activate", ids: [...selectedIds] })} disabled={bulkMut.isPending}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 transition-colors font-medium">
                  <ToggleRight className="w-3.5 h-3.5" /> Activate
                </button>
                <button onClick={() => bulkMut.mutate({ action: "deactivate", ids: [...selectedIds] })} disabled={bulkMut.isPending}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-amber-500/10 text-amber-600 hover:bg-amber-500/20 transition-colors font-medium">
                  <ToggleLeft className="w-3.5 h-3.5" /> Deactivate
                </button>
                <button onClick={() => { if (confirm(`Delete ${selectedIds.size} materials?`)) bulkMut.mutate({ action: "delete", ids: [...selectedIds] }); }} disabled={bulkMut.isPending}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-red-500/10 text-red-600 hover:bg-red-500/20 transition-colors font-medium">
                  <Trash2 className="w-3.5 h-3.5" /> Delete
                </button>
                <button onClick={() => setSelectedIds(new Set())} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Table view */}
          {viewMode === "table" ? (
            <SectionCard noPadding>
              {isLoading ? (
                <div className="divide-y divide-border/30">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} className="px-4 py-3.5 flex items-center gap-4">
                      <div className="w-4 h-4 rounded bg-muted/50 shrink-0" />
                      <div className="w-8 h-8 rounded-lg bg-muted/50 shrink-0" />
                      <div className="flex-1 space-y-1.5">
                        <div className="h-3.5 w-48 bg-muted/50 rounded animate-pulse" />
                        <div className="h-2.5 w-32 bg-muted/30 rounded animate-pulse" />
                      </div>
                      <div className="h-3 w-20 bg-muted/40 rounded animate-pulse" />
                      <div className="h-5 w-12 bg-muted/30 rounded-full animate-pulse" />
                      <div className="h-3 w-16 bg-muted/40 rounded animate-pulse" />
                      <div className="h-5 w-14 bg-muted/30 rounded animate-pulse" />
                    </div>
                  ))}
                </div>
              ) : sorted.length === 0 ? (
                <EmptyState icon={Package} heading="No materials found" message={dSearch || activeFilters.length ? "Try adjusting your search or filters." : "Add materials to get started, or load demo data."}
                  action={materials.length === 0 ? { label: "Add first material", onClick: () => { setEditMaterial(null); setFormOpen(true); } } : undefined} />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-[800px]">
                    <thead className="bg-muted/30 border-b border-border/60 sticky top-0">
                      <tr>
                        <th className="w-10 px-4 py-3">
                          <Checkbox checked={allSelected} onCheckedChange={toggleAll} aria-label="Select all" />
                        </th>
                        {[
                          { key: "name", label: "Material" },
                          { key: "categoryName", label: "Category" },
                          { key: "uom", label: "UoM" },
                          { key: "basePrice", label: "Base Price" },
                          { key: "hsnSacCode", label: "HSN Code" },
                          { key: "isActive", label: "Status" },
                        ].map(col => (
                          <th key={col.key} className="text-left px-3 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider cursor-pointer hover:text-foreground transition-colors select-none" onClick={() => toggleSort(col.key)}>
                            <span className="flex items-center gap-1.5">{col.label} <SortIcon column={col.key} /></span>
                          </th>
                        ))}
                        <th className="w-16 px-3 py-3" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/30">
                      {sorted.map(m => (
                        <tr key={m.id} className={cn("group hover:bg-muted/30 transition-colors cursor-pointer", selectedIds.has(m.id) && "bg-primary/5")}
                          onClick={() => setDetailId(m.id)}>
                          <td className="px-4 py-3.5" onClick={e => e.stopPropagation()}>
                            <Checkbox checked={selectedIds.has(m.id)} onCheckedChange={() => toggleOne(m.id)} aria-label="Select row" />
                          </td>
                          <td className="px-3 py-3.5">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                                <Package className="w-4 h-4 text-primary" />
                              </div>
                              <div className="min-w-0">
                                <p className="font-semibold text-foreground truncate max-w-[220px]">{m.name}</p>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                  <span className="font-mono text-[10px] text-muted-foreground">{m.code ?? "—"}</span>
                                  {m.brand && <span className="text-[10px] text-muted-foreground">· {m.brand}{m.model ? ` ${m.model}` : ""}</span>}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-3 py-3.5">
                            <span className="text-xs text-muted-foreground">{m.categoryName ?? "—"}</span>
                          </td>
                          <td className="px-3 py-3.5">
                            <Badge variant="outline" className="text-[10px] font-mono">{m.uom}</Badge>
                          </td>
                          <td className="px-3 py-3.5">
                            <span className="text-sm font-medium text-foreground">{fmtCurrency(m.basePrice, m.currency)}</span>
                            {m.lastPurchasePrice && m.basePrice && m.lastPurchasePrice !== m.basePrice && (
                              <p className="text-[10px] text-muted-foreground">Last: {fmtCurrency(m.lastPurchasePrice, m.currency)}</p>
                            )}
                          </td>
                          <td className="px-3 py-3.5">
                            <span className="font-mono text-xs text-muted-foreground">{m.hsnSacCode ?? "—"}</span>
                          </td>
                          <td className="px-3 py-3.5">
                            <Badge className={cn("text-[10px] h-5", m.isActive ? "bg-emerald-500/15 text-emerald-600 border-emerald-500/25 hover:bg-emerald-500/20" : "bg-muted text-muted-foreground border-border")}>
                              {m.isActive ? "Active" : "Inactive"}
                            </Badge>
                          </td>
                          <td className="px-3 py-3.5" onClick={e => e.stopPropagation()}>
                            <button onClick={() => { setEditMaterial(m); setFormOpen(true); }}
                              className="p-1.5 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100">
                              <Edit className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </SectionCard>
          ) : (
            /* Card view */
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {sorted.map(m => (
                <div key={m.id} className={cn("bg-card border border-border/60 rounded-xl p-4 hover:border-primary/40 hover:shadow-md transition-all cursor-pointer group relative", selectedIds.has(m.id) && "border-primary/50 bg-primary/5")}
                  onClick={() => setDetailId(m.id)}>
                  <div className="absolute top-3 left-3" onClick={e => e.stopPropagation()}>
                    <Checkbox checked={selectedIds.has(m.id)} onCheckedChange={() => toggleOne(m.id)} />
                  </div>
                  <div className="flex items-start justify-between gap-2 mb-3 pl-7">
                    <div className="min-w-0">
                      <p className="font-semibold text-sm text-foreground truncate leading-tight">{m.name}</p>
                      <p className="font-mono text-[10px] text-muted-foreground mt-0.5">{m.code ?? "—"}</p>
                    </div>
                    <Badge className={cn("text-[10px] h-4 shrink-0", m.isActive ? "bg-emerald-500/15 text-emerald-600 border-emerald-500/25" : "bg-muted text-muted-foreground")}>
                      {m.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                  <div className="space-y-1.5 text-xs">
                    {m.categoryName && <div className="flex items-center gap-1.5 text-muted-foreground"><Tag className="w-3 h-3" />{m.categoryName}</div>}
                    <div className="flex items-center gap-1.5 text-muted-foreground"><Hash className="w-3 h-3" />{m.uom}</div>
                    {m.basePrice != null && <div className="flex items-center gap-1.5 font-semibold text-foreground"><DollarSign className="w-3 h-3 text-muted-foreground" />{fmtCurrency(m.basePrice, m.currency)}</div>}
                    {m.brand && <div className="text-muted-foreground truncate">{m.brand}{m.model ? ` · ${m.model}` : ""}</div>}
                  </div>
                  <button onClick={e => { e.stopPropagation(); setEditMaterial(m); setFormOpen(true); }}
                    className="absolute top-3 right-3 p-1 rounded hover:bg-muted transition-colors text-muted-foreground opacity-0 group-hover:opacity-100">
                    <Edit className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
              {!isLoading && sorted.length === 0 && (
                <div className="col-span-full">
                  <EmptyState icon={Package} heading="No materials found" message="Try adjusting your search or filters." />
                </div>
              )}
            </div>
          )}
        </TabsContent>

        <TabsContent value="categories" className="mt-4">
          <SectionCard>
            <CategoryManager categories={categories} />
          </SectionCard>
        </TabsContent>
      </Tabs>

      {/* Detail slide-over */}
      <AnimatePresence>
        {detailId != null && (
          <DetailPanel
            key={detailId}
            materialId={detailId}
            categories={categories}
            onClose={() => setDetailId(null)}
            onEdit={m => { setEditMaterial(m); setFormOpen(true); setDetailId(null); }}
          />
        )}
      </AnimatePresence>

      {/* Create/Edit form */}
      {formOpen && (
        <MaterialFormDialog
          material={editMaterial}
          categories={categories}
          onClose={() => { setFormOpen(false); setEditMaterial(null); }}
        />
      )}

      {/* Import dialog */}
      {showImport && <ImportDialog onClose={() => setShowImport(false)} />}
    </motion.div>
  );
}
