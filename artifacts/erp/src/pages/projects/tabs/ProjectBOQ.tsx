import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost, apiPatch, apiDelete } from "@/lib/fetch";
import { motion } from "framer-motion";
import { useLocation } from "wouter";
import { SectionCard, EmptyState, StatusBadge } from "@/components/shared";
import { usePermissions } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { PackageSearch, Plus, Download, Loader2, Trash2, Check, X, ShoppingCart, Warehouse, ExternalLink } from "lucide-react";
import { useForm, Controller } from "react-hook-form";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface BOQMaterialStatus {
  boqItemId: number; description: string; sourcedFrom: string;
  quantity: number; allocatedQty: number; status: string;
  mrId: number | null; mrNumber: string | null; mrStatus: string | null;
  poId: number | null; poNumber: string | null; poStatus: string | null;
  allocNumber: string | null; allocStatus: string | null;
}

interface BOQItem {
  id: number; projectId: number; activityId: number | null; itemCode: string | null;
  description: string; category: string; unit: string | null;
  quantity: number; unitRate: number; totalAmount: number;
  sourcedFrom: string; materialId: number | null;
  allocatedQty: number; consumedQty: number; status: string;
  notes: string | null; createdAt: string; updatedAt: string;
}

const CATEGORIES = ["Material", "Labor", "Equipment", "Service"];
const SOURCED_FROM = ["Procurement", "Inventory", "External"];
const CAT_COLORS: Record<string, string> = {
  Material: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300",
  Labor: "bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/40 dark:text-violet-300",
  Equipment: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300",
  Service: "bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300",
};

function InlineEdit({ value, type = "number", onSave, disabled = false }: {
  value: number | string; type?: string; onSave: (v: string) => void; disabled?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(String(value));
  const ref = useRef<HTMLInputElement>(null);

  if (disabled) return <span className="text-sm">{value}</span>;

  if (editing) return (
    <div className="flex items-center gap-1">
      <Input
        ref={ref}
        type={type}
        value={val}
        onChange={e => setVal(e.target.value)}
        className="h-7 w-24 text-xs px-2"
        autoFocus
        onKeyDown={e => {
          if (e.key === "Enter") { onSave(val); setEditing(false); }
          if (e.key === "Escape") { setVal(String(value)); setEditing(false); }
        }}
      />
      <button onClick={() => { onSave(val); setEditing(false); }} className="text-emerald-600 hover:text-emerald-700"><Check className="h-3.5 w-3.5" /></button>
      <button onClick={() => { setVal(String(value)); setEditing(false); }} className="text-muted-foreground hover:text-foreground"><X className="h-3.5 w-3.5" /></button>
    </div>
  );

  return (
    <button
      className="text-left hover:underline decoration-dashed underline-offset-2 cursor-pointer"
      onClick={() => { setVal(String(value)); setEditing(true); }}
    >
      {value}
    </button>
  );
}

export function ProjectBOQ({ projectId, clientPoId }: { projectId: number; clientPoId?: number | null }) {
  const { canEdit: canEditProject } = usePermissions("projects");
  const [, navigate] = useLocation();
  const [catFilter, setCatFilter] = useState<string>("All");
  const [addOpen, setAddOpen] = useState(false);
  const [showMaterialStatus, setShowMaterialStatus] = useState(false);
  const qc = useQueryClient();
  const { register, handleSubmit, control, reset } = useForm<any>({
    defaultValues: { category: "Material", sourcedFrom: "Procurement", quantity: 1, unitRate: 0 },
  });

  const { data: items = [], isPending } = useQuery<BOQItem[]>({
    queryKey: ["project-boq", projectId],
    queryFn: () => apiGet(`/projects/${projectId}/boq`),
    enabled: !!projectId,
  });

  const { data: materialStatus = [] } = useQuery<BOQMaterialStatus[]>({
    queryKey: ["project-boq-material-status", projectId],
    queryFn: () => apiGet(`/projects/${projectId}/boq/material-status`),
    enabled: !!projectId && showMaterialStatus,
    staleTime: 30_000,
  });

  const addMut = useMutation({
    mutationFn: (d: any) => apiPost(`/projects/${projectId}/boq`, d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["project-boq", projectId] }); setAddOpen(false); reset(); },
    onError: () => toast.error("Failed to add item"),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => apiPatch(`/boq-items/${id}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["project-boq", projectId] }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => apiDelete(`/boq-items/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["project-boq", projectId] }),
    onError: () => toast.error("Failed to delete item"),
  });

  const importMut = useMutation({
    mutationFn: () => apiPost(`/projects/${projectId}/boq/import-from-quotation`),
    onSuccess: (data: any) => {
      qc.invalidateQueries({ queryKey: ["project-boq", projectId] });
      toast.success(`Imported ${data.imported} items from quotation`);
    },
    onError: (e: any) => toast.error(e?.data?.error ?? "No quotation items found to import"),
  });

  const createMRsMut = useMutation({
    mutationFn: () => apiPost(`/projects/${projectId}/boq/create-material-requests`, {}),
    onSuccess: (data: any) => {
      qc.invalidateQueries({ queryKey: ["project-boq-material-status", projectId] });
      toast.success(data.message ?? `Created ${data.created} material request(s)`);
    },
    onError: () => toast.error("Failed to create material requests"),
  });

  const reserveInvMut = useMutation({
    mutationFn: () => apiPost(`/projects/${projectId}/boq/reserve-inventory`, {}),
    onSuccess: (data: any) => {
      qc.invalidateQueries({ queryKey: ["project-boq", projectId] });
      qc.invalidateQueries({ queryKey: ["project-boq-material-status", projectId] });
      toast.success(data.message ?? `Reserved ${data.reserved} inventory allocation(s)`);
    },
    onError: () => toast.error("Failed to reserve inventory"),
  });

  const filtered = catFilter === "All" ? items : items.filter(i => i.category === catFilter);

  const grandTotal = items.reduce((s, i) => s + i.totalAmount, 0);
  const totalQty = items.reduce((s, i) => s + i.quantity, 0);

  const fmtINR = (n: number) => `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
      <SectionCard
        title="Bill of Quantities (BOQ)"
        noPadding
        isLoading={isPending}
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            {/* Category filter */}
            <Select value={catFilter} onValueChange={setCatFilter}>
              <SelectTrigger className="h-7 w-28 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="All">All</SelectItem>
                {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>

            {/* Import from Quotation — requires edit permission */}
            {canEditProject && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span>
                    <Button
                      size="sm" variant="outline" className="h-7 gap-1 text-xs"
                      onClick={() => importMut.mutate()} disabled={!clientPoId || importMut.isPending}
                    >
                      {importMut.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}
                      Import from Quotation
                    </Button>
                  </span>
                </TooltipTrigger>
                {!clientPoId && (
                  <TooltipContent><p>Project has no linked quotation</p></TooltipContent>
                )}
              </Tooltip>
            )}

            <Button
              size="sm" variant={showMaterialStatus ? "secondary" : "outline"}
              className="h-7 gap-1 text-xs"
              onClick={() => setShowMaterialStatus(v => !v)}
            >
              Material Status
            </Button>

            {canEditProject && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="sm" variant="outline" className="h-7 gap-1 text-xs text-blue-700 border-blue-200 hover:bg-blue-50"
                    onClick={() => createMRsMut.mutate()} disabled={createMRsMut.isPending}
                  >
                    {createMRsMut.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <ShoppingCart className="h-3 w-3" />}
                    Create MRs
                  </Button>
                </TooltipTrigger>
                <TooltipContent><p>Create material requests for Procurement-sourced BOQ lines</p></TooltipContent>
              </Tooltip>
            )}

            {canEditProject && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="sm" variant="outline" className="h-7 gap-1 text-xs text-emerald-700 border-emerald-200 hover:bg-emerald-50"
                    onClick={() => reserveInvMut.mutate()} disabled={reserveInvMut.isPending}
                  >
                    {reserveInvMut.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Warehouse className="h-3 w-3" />}
                    Reserve Inventory
                  </Button>
                </TooltipTrigger>
                <TooltipContent><p>Reserve inventory for Inventory-sourced BOQ lines</p></TooltipContent>
              </Tooltip>
            )}

            {canEditProject && (
              <Button size="sm" className="h-7 gap-1 text-xs" onClick={() => setAddOpen(true)}>
                <Plus className="h-3 w-3" /> Add Item
              </Button>
            )}
          </div>
        }
      >
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30 hover:bg-muted/30">
              <TableHead className="h-9 text-[10px] font-bold uppercase tracking-wider px-4 w-24">Code</TableHead>
              <TableHead className="h-9 text-[10px] font-bold uppercase tracking-wider">Description</TableHead>
              <TableHead className="h-9 text-[10px] font-bold uppercase tracking-wider w-24">Category</TableHead>
              <TableHead className="h-9 text-[10px] font-bold uppercase tracking-wider w-16">Unit</TableHead>
              <TableHead className="h-9 text-[10px] font-bold uppercase tracking-wider w-20 text-right">Qty</TableHead>
              <TableHead className="h-9 text-[10px] font-bold uppercase tracking-wider w-28 text-right">Rate (₹)</TableHead>
              <TableHead className="h-9 text-[10px] font-bold uppercase tracking-wider w-28 text-right">Total (₹)</TableHead>
              <TableHead className="h-9 text-[10px] font-bold uppercase tracking-wider w-24">Source</TableHead>
              <TableHead className="h-9 text-[10px] font-bold uppercase tracking-wider w-32">Allocated</TableHead>
              <TableHead className="h-9 text-[10px] font-bold uppercase tracking-wider w-24">Status</TableHead>
              {showMaterialStatus && <TableHead className="h-9 text-[10px] font-bold uppercase tracking-wider w-36">Procurement Link</TableHead>}
              <TableHead className="h-9 w-10"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map(item => {
              const allocPct = item.quantity > 0 ? Math.min(100, (item.allocatedQty / item.quantity) * 100) : 0;
              return (
                <TableRow key={item.id} className="border-b border-border/40 hover:bg-muted/10 group">
                  <TableCell className="px-4 py-2 text-xs font-mono text-muted-foreground">{item.itemCode || "—"}</TableCell>
                  <TableCell className="py-2 text-sm text-foreground max-w-[200px] truncate">{item.description}</TableCell>
                  <TableCell className="py-2">
                    <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0 border", CAT_COLORS[item.category])}>
                      {item.category}
                    </Badge>
                  </TableCell>
                  <TableCell className="py-2 text-xs text-muted-foreground">{item.unit || "—"}</TableCell>
                  <TableCell className="py-2 text-right text-sm font-mono">
                    <InlineEdit
                      value={item.quantity}
                      onSave={v => updateMut.mutate({ id: item.id, data: { quantity: parseFloat(v) } })}
                      disabled={!canEditProject}
                    />
                  </TableCell>
                  <TableCell className="py-2 text-right text-sm font-mono">
                    <InlineEdit
                      value={item.unitRate}
                      onSave={v => updateMut.mutate({ id: item.id, data: { unitRate: parseFloat(v) } })}
                      disabled={!canEditProject}
                    />
                  </TableCell>
                  <TableCell className="py-2 text-right text-sm font-bold font-mono">
                    {fmtINR(item.totalAmount)}
                  </TableCell>
                  <TableCell className="py-2 text-xs text-muted-foreground">{item.sourcedFrom}</TableCell>
                  <TableCell className="py-2">
                    <div className="flex items-center gap-1.5">
                      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden min-w-[40px]">
                        <div
                          className={cn("h-full rounded-full transition-all", allocPct >= 100 ? "bg-emerald-500" : "bg-primary")}
                          style={{ width: `${allocPct}%` }}
                        />
                      </div>
                      <span className="text-[10px] font-mono text-muted-foreground">{allocPct.toFixed(0)}%</span>
                    </div>
                  </TableCell>
                  <TableCell className="py-2">
                    <StatusBadge status={item.status} size="sm" />
                  </TableCell>
                  {showMaterialStatus && (() => {
                    const ms = materialStatus.find(m => m.boqItemId === item.id);
                    return (
                      <TableCell className="py-2 text-[10px] leading-snug">
                        {!ms ? <span className="text-muted-foreground">—</span> : (
                          <div className="space-y-1">
                            {ms.mrNumber && (
                              <div className="flex items-center gap-1 flex-wrap">
                                <span className="text-muted-foreground">MR:</span>
                                <button
                                  onClick={() => navigate("/procurement/pos")}
                                  className="font-mono font-semibold text-primary hover:underline flex items-center gap-0.5"
                                  title="Open in Procurement"
                                >
                                  {ms.mrNumber}
                                  <ExternalLink className="h-2.5 w-2.5 opacity-60" />
                                </button>
                                <StatusBadge status={ms.mrStatus ?? ""} size="sm" />
                              </div>
                            )}
                            {ms.allocNumber && (
                              <div className="flex items-center gap-1">
                                <span className="text-muted-foreground">Alloc:</span>
                                <span className="font-mono">{ms.allocNumber}</span>
                                <StatusBadge status={ms.allocStatus ?? ""} size="sm" />
                              </div>
                            )}
                            {ms.poNumber && (
                              <div className="flex items-center gap-1">
                                <span className="text-muted-foreground">PO:</span>
                                <button
                                  onClick={() => ms.poId
                                    ? navigate(`/procurement/pos/${ms.poId}`)
                                    : navigate("/procurement/pos")
                                  }
                                  className="font-mono font-semibold text-primary hover:underline flex items-center gap-0.5"
                                  title="Open PO in Procurement"
                                >
                                  {ms.poNumber}
                                  <ExternalLink className="h-2.5 w-2.5 opacity-60" />
                                </button>
                                {ms.poStatus && <StatusBadge status={ms.poStatus} size="sm" />}
                              </div>
                            )}
                            {!ms.mrNumber && !ms.allocNumber && (
                              <span className="text-muted-foreground italic">Not linked</span>
                            )}
                          </div>
                        )}
                      </TableCell>
                    );
                  })()}
                  <TableCell className="py-2 pr-3">
                    {canEditProject && (
                      <button
                        className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-red-600"
                        onClick={() => { if (confirm("Delete this BOQ item?")) deleteMut.mutate(item.id); }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
            {!filtered.length && (
              <TableRow>
                <TableCell colSpan={11} className="p-0">
                  <EmptyState
                    icon={PackageSearch}
                    title={catFilter !== "All" ? `No ${catFilter} items` : "No BOQ items yet"}
                    description='Add items manually or import from a linked quotation.'
                    size="sm"
                  />
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>

        {/* Footer totals */}
        {items.length > 0 && (
          <div className="border-t border-border/60 bg-muted/20 px-4 py-3 flex items-center justify-between text-sm">
            <span className="text-muted-foreground font-medium">{items.length} items · {totalQty.toLocaleString()} total units</span>
            <div className="flex items-center gap-4">
              <span className="text-muted-foreground">Grand Total</span>
              <span className="font-bold font-mono text-foreground text-base">{fmtINR(grandTotal)}</span>
            </div>
          </div>
        )}
      </SectionCard>

      {/* Add Item Sheet */}
      <Sheet open={addOpen} onOpenChange={setAddOpen}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader className="mb-6">
            <SheetTitle>Add BOQ Item</SheetTitle>
          </SheetHeader>
          <form onSubmit={handleSubmit(d => addMut.mutate(d))} className="space-y-4">
            {[
              { label: "Item Code", name: "itemCode", placeholder: "MAT-001" },
              { label: "Description *", name: "description", placeholder: "Solar Panel 540Wp" },
              { label: "Unit", name: "unit", placeholder: "Nos / Kgs / M / etc." },
            ].map(f => (
              <div key={f.name}>
                <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5 block">{f.label}</Label>
                <Input className="h-9" placeholder={f.placeholder} {...register(f.name)} />
              </div>
            ))}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5 block">Quantity</Label>
                <Input type="number" step="0.001" className="h-9" {...register("quantity")} />
              </div>
              <div>
                <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5 block">Unit Rate (₹)</Label>
                <Input type="number" step="0.01" className="h-9" {...register("unitRate")} />
              </div>
            </div>
            <div>
              <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5 block">Category</Label>
              <Controller control={control} name="category" render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              )} />
            </div>
            <div>
              <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5 block">Sourced From</Label>
              <Controller control={control} name="sourcedFrom" render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>{SOURCED_FROM.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              )} />
            </div>
            <div>
              <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5 block">Notes</Label>
              <Textarea className="h-16 resize-none" {...register("notes")} />
            </div>
            <Button type="submit" className="w-full h-10" disabled={addMut.isPending}>
              {addMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add Item"}
            </Button>
          </form>
        </SheetContent>
      </Sheet>
    </motion.div>
  );
}
