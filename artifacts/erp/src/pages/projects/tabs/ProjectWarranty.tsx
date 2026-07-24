import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost, apiPatch } from "@/lib/fetch";
import { motion } from "framer-motion";
import { SectionCard, EmptyState } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { toast } from "sonner";
import { ShieldCheck, AlertTriangle, XCircle, Plus, Loader2, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { differenceInDays, format, parseISO } from "date-fns";

interface WarrantyRecord {
  id: number; projectId: number; handoverId: number | null;
  componentType: string; manufacturer: string | null; model: string | null;
  serialNumbers: string[]; warrantyYears: number | null;
  warrantyStartDate: string | null; warrantyEndDate: string | null;
  warrantyTerms: string | null; amcContractId: number | null;
  status: string; createdAt: string;
}

const COMPONENT_TYPES = ["Panels","Inverter","Mounting","Cables","BOS","WholeSystem"];

const COMPONENT_ICONS: Record<string, string> = {
  Panels: "☀️", Inverter: "⚡", Mounting: "🔧", Cables: "🔌", BOS: "🔋", WholeSystem: "🏭",
};

function WarrantyCard({ item, onEdit }: { item: WarrantyRecord; onEdit: (item: WarrantyRecord) => void }) {
  const today = new Date();
  const endDate = item.warrantyEndDate ? parseISO(item.warrantyEndDate) : null;
  const daysLeft = endDate ? differenceInDays(endDate, today) : null;

  const statusColor =
    item.status === "Expired" ? "text-red-600 bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-800/30" :
    item.status === "Expiring" ? "text-amber-600 bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800/30" :
    "text-emerald-600 bg-emerald-50 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-800/30";

  const StatusIcon = item.status === "Expired" ? XCircle : item.status === "Expiring" ? AlertTriangle : ShieldCheck;

  // Progress bar: pct of warranty period elapsed
  let pct = 0;
  if (item.warrantyStartDate && endDate) {
    const start = parseISO(item.warrantyStartDate);
    const total = differenceInDays(endDate, start);
    const elapsed = differenceInDays(today, start);
    pct = total > 0 ? Math.min(100, Math.max(0, (elapsed / total) * 100)) : 0;
  }

  return (
    <div className={cn("rounded-xl border p-4 space-y-3", statusColor)}>
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2.5">
          <span className="text-2xl" aria-hidden>{COMPONENT_ICONS[item.componentType] ?? "📦"}</span>
          <div>
            <p className="font-bold text-sm text-foreground">{item.componentType}</p>
            {item.manufacturer && <p className="text-xs text-muted-foreground">{item.manufacturer}{item.model ? ` · ${item.model}` : ""}</p>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className={cn("flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border", statusColor)}>
            <StatusIcon className="h-3 w-3" />
            {item.status}
          </div>
          <Button size="sm" variant="ghost" onClick={() => onEdit(item)} className="h-7 w-7 p-0">✏️</Button>
        </div>
      </div>

      {/* Progress bar */}
      {item.warrantyStartDate && item.warrantyEndDate && (
        <div>
          <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
            <span>{format(parseISO(item.warrantyStartDate), "MMM d, yyyy")}</span>
            <span>{format(parseISO(item.warrantyEndDate), "MMM d, yyyy")}</span>
          </div>
          <div className="h-2 bg-white/60 dark:bg-black/20 rounded-full overflow-hidden border border-current/10">
            <div
              className={cn(
                "h-full rounded-full transition-all",
                item.status === "Expired" ? "bg-red-400" :
                item.status === "Expiring" ? "bg-amber-400" : "bg-emerald-400"
              )}
              style={{ width: `${pct}%` }}
            />
          </div>
          {daysLeft !== null && (
            <p className="text-xs font-bold mt-1 text-right">
              {daysLeft > 0 ? `${daysLeft} days remaining` : `Expired ${Math.abs(daysLeft)} days ago`}
            </p>
          )}
        </div>
      )}

      <div className="flex items-center justify-between pt-1 border-t border-current/10">
        <div className="text-xs text-muted-foreground">
          {item.warrantyYears ? `${item.warrantyYears}yr warranty` : "—"}
          {item.serialNumbers.length > 0 && ` · ${item.serialNumbers.length} serial(s)`}
        </div>
        {item.amcContractId && (
          <Button size="sm" variant="ghost" className="h-6 text-xs gap-1 px-2" onClick={() => window.open(`/oam/amc`, "_self")}>
            <ExternalLink className="h-3 w-3" /> View AMC
          </Button>
        )}
      </div>
    </div>
  );
}

export function ProjectWarranty({ projectId }: { projectId: number }) {
  const qc = useQueryClient();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editItem, setEditItem] = useState<WarrantyRecord | null>(null);
  const [form, setForm] = useState<Record<string, any>>({
    componentType: "Panels", warrantyYears: "", serialNumbers: [],
  });
  const [serialInput, setSerialInput] = useState("");

  const { data: components = [], isPending } = useQuery<WarrantyRecord[]>({
    queryKey: ["project-warranty", projectId],
    queryFn: () => apiGet(`/projects/${projectId}/warranty`),
    enabled: !!projectId,
  });

  const { data: expiring = [] } = useQuery<WarrantyRecord[]>({
    queryKey: ["project-warranty-expiring", projectId],
    queryFn: () => apiGet(`/projects/${projectId}/warranty/expiring`),
    enabled: !!projectId,
    staleTime: 60_000,
  });

  const createMut = useMutation({
    mutationFn: (d: any) => apiPost(`/projects/${projectId}/warranty`, d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project-warranty", projectId] });
      qc.invalidateQueries({ queryKey: ["project-warranty-expiring", projectId] });
      setDrawerOpen(false); toast.success("Component added");
    },
    onError: () => toast.error("Failed to add component"),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, d }: { id: number; d: any }) => apiPatch(`/warranty/${id}`, d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project-warranty", projectId] });
      qc.invalidateQueries({ queryKey: ["project-warranty-expiring", projectId] });
      setDrawerOpen(false); toast.success("Component updated");
    },
    onError: () => toast.error("Failed to update component"),
  });

  const openAdd = () => {
    setEditItem(null);
    setForm({ componentType: "Panels", warrantyYears: "", serialNumbers: [] });
    setSerialInput("");
    setDrawerOpen(true);
  };

  const openEdit = (item: WarrantyRecord) => {
    setEditItem(item);
    setForm({
      componentType: item.componentType, manufacturer: item.manufacturer,
      model: item.model, warrantyYears: item.warrantyYears,
      warrantyStartDate: item.warrantyStartDate, warrantyEndDate: item.warrantyEndDate,
      warrantyTerms: item.warrantyTerms, amcContractId: item.amcContractId,
      status: item.status, serialNumbers: [...item.serialNumbers],
    });
    setSerialInput("");
    setDrawerOpen(true);
  };

  const handleSave = () => {
    const d = { ...form, warrantyYears: Number(form.warrantyYears) || null };
    if (editItem) {
      updateMut.mutate({ id: editItem.id, d });
    } else {
      createMut.mutate(d);
    }
  };

  const addSerial = () => {
    if (!serialInput.trim()) return;
    setForm((f: any) => ({ ...f, serialNumbers: [...(f.serialNumbers ?? []), serialInput.trim()] }));
    setSerialInput("");
  };

  const expiringCount = expiring.length;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5">
      {/* Expiring banner */}
      {expiringCount > 0 && (
        <div className="flex items-center gap-3 p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/30 rounded-xl">
          <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
          <div className="flex-1">
            <p className="font-bold text-sm text-amber-800 dark:text-amber-400">
              {expiringCount} component{expiringCount > 1 ? "s" : ""} expiring within 90 days
            </p>
            <p className="text-xs text-amber-700 dark:text-amber-500 mt-0.5">
              Review warranty coverage and initiate renewal or AMC agreements.
            </p>
          </div>
        </div>
      )}

      <SectionCard
        title="Warranty Components"
        isLoading={isPending}
        actions={
          <Button size="sm" onClick={openAdd} className="h-7 gap-1 text-xs">
            <Plus className="h-3 w-3" /> Add Component
          </Button>
        }
      >
        {components.length === 0 ? (
          <EmptyState
            icon={ShieldCheck}
            title="No warranty components"
            description="Add components after handover to track warranty expiry."
            size="sm"
            action={{ label: "Add Component", onClick: openAdd }}
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {components.map(item => (
              <WarrantyCard key={item.id} item={item} onEdit={openEdit} />
            ))}
          </div>
        )}
      </SectionCard>

      {/* Add / Edit Drawer */}
      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader className="mb-5">
            <SheetTitle>{editItem ? "Edit Component" : "Add Warranty Component"}</SheetTitle>
          </SheetHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5 block">Component Type</Label>
              <Select value={form.componentType ?? "Panels"} onValueChange={v => setForm((f: any) => ({ ...f, componentType: v }))}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>{COMPONENT_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {[
              { label: "Manufacturer", key: "manufacturer", type: "text" },
              { label: "Model", key: "model", type: "text" },
              { label: "Warranty Years", key: "warrantyYears", type: "number" },
              { label: "Warranty Start", key: "warrantyStartDate", type: "date" },
              { label: "Warranty End", key: "warrantyEndDate", type: "date" },
            ].map(({ label, key, type }) => (
              <div key={key}>
                <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5 block">{label}</Label>
                <Input type={type} className="h-9" value={(form as any)[key] ?? ""} onChange={e => setForm((f: any) => ({ ...f, [key]: e.target.value }))} />
              </div>
            ))}
            <div>
              <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5 block">Warranty Terms</Label>
              <Textarea className="resize-none h-16" value={form.warrantyTerms ?? ""} onChange={e => setForm((f: any) => ({ ...f, warrantyTerms: e.target.value }))} />
            </div>
            <div>
              <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5 block">Serial Numbers</Label>
              <div className="flex gap-2 mb-2">
                <Input className="h-8 text-xs" placeholder="Enter serial number…" value={serialInput} onChange={e => setSerialInput(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addSerial(); } }} />
                <Button size="sm" variant="outline" className="h-8 px-2" onClick={addSerial}><Plus className="h-3.5 w-3.5" /></Button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {(form.serialNumbers ?? []).map((s: string, i: number) => (
                  <Badge key={i} variant="secondary" className="gap-1 text-xs">
                    {s}
                    <button onClick={() => setForm((f: any) => ({ ...f, serialNumbers: f.serialNumbers.filter((_: string, idx: number) => idx !== i) }))}>×</button>
                  </Badge>
                ))}
              </div>
            </div>
            {editItem && (
              <div>
                <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5 block">Status</Label>
                <Select value={form.status ?? "Active"} onValueChange={v => setForm((f: any) => ({ ...f, status: v }))}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["Active","Expiring","Expired","Claimed"].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <Button className="w-full h-10" onClick={handleSave} disabled={createMut.isPending || updateMut.isPending}>
              {(createMut.isPending || updateMut.isPending) ? <Loader2 className="h-4 w-4 animate-spin" /> : editItem ? "Update Component" : "Add Component"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </motion.div>
  );
}
