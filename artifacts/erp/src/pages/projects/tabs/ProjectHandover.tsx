import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost, apiPatch } from "@/lib/fetch";
import { motion } from "framer-motion";
import { SectionCard, StatusBadge, EmptyState } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import {
  FileCheck, Plus, Trash2, Loader2, CheckCircle2, AlertCircle,
  ClipboardCheck, Pen, Send, XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface HandoverRecord {
  id: number; projectId: number; handoverDate: string | null;
  handoverType: string; preparedBy: number | null;
  clientRepresentative: string | null; clientDesignation: string | null;
  systemDescription: string | null; installedCapacityKwp: number | null;
  panelCount: number | null; inverterCount: number | null;
  warrantyStartDate: string | null; warrantyEndDate: string | null;
  amcStartDate: string | null; amcEndDate: string | null;
  documentsProvided: string[]; trainingProvided: boolean;
  trainingNotes: string | null;
  pendingPunchItems: Array<{ description: string; severity: string; responsible: string }>;
  clientSignedAt: string | null; clientSignedBy: string | null;
  internalSignedAt: string | null; status: string;
  rejectionReason: string | null; createdAt: string;
}

const DOC_CHECKLIST = [
  "As-Built Drawings", "Operation & Maintenance Manual", "Warranty Certificates",
  "Test Reports", "Commissioning Certificate", "Electrical Single Line Diagram",
  "Safety Data Sheets", "Structural Drawings", "Net Metering Agreement",
  "Grid Connection Certificate",
];

const STATUS_COLORS: Record<string, string> = {
  Draft: "bg-gray-100 text-gray-700 border-gray-200",
  PendingClientSignoff: "bg-amber-100 text-amber-700 border-amber-200",
  Signed: "bg-emerald-100 text-emerald-700 border-emerald-200",
  Rejected: "bg-red-100 text-red-700 border-red-200",
};

export function ProjectHandover({ projectId }: { projectId: number }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Partial<HandoverRecord>>({
    handoverType: "Provisional", documentsProvided: [], pendingPunchItems: [], trainingProvided: false,
  });
  const [newPunch, setNewPunch] = useState({ description: "", severity: "Medium", responsible: "" });

  const { data: handover, isPending, isLoading } = useQuery<HandoverRecord | null>({
    queryKey: ["project-handover", projectId],
    queryFn: () => apiGet(`/projects/${projectId}/handover`),
    enabled: !!projectId,
  });

  const createMut = useMutation({
    mutationFn: (d: any) => apiPost(`/projects/${projectId}/handover`, d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["project-handover", projectId] }); setEditing(false); toast.success("Handover certificate created"); },
    onError: () => toast.error("Failed to create handover"),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, d }: { id: number; d: any }) => apiPatch(`/handover/${id}`, d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["project-handover", projectId] }); setEditing(false); toast.success("Handover updated"); },
    onError: () => toast.error("Failed to update handover"),
  });

  const signMut = useMutation({
    mutationFn: ({ id, type }: { id: number; type: string }) =>
      apiPost(`/handover/${id}/sign`, { type, signedBy: "Client Representative" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["project-handover", projectId] }); toast.success("Handover status updated"); },
    onError: () => toast.error("Sign operation failed"),
  });

  const handleSubmit = () => {
    if (handover) {
      updateMut.mutate({ id: handover.id, d: form });
    } else {
      createMut.mutate(form);
    }
  };

  const startEdit = () => {
    setForm(handover ? {
      handoverDate: handover.handoverDate, handoverType: handover.handoverType,
      clientRepresentative: handover.clientRepresentative, clientDesignation: handover.clientDesignation,
      systemDescription: handover.systemDescription, installedCapacityKwp: handover.installedCapacityKwp,
      panelCount: handover.panelCount, inverterCount: handover.inverterCount,
      warrantyStartDate: handover.warrantyStartDate, warrantyEndDate: handover.warrantyEndDate,
      amcStartDate: handover.amcStartDate, amcEndDate: handover.amcEndDate,
      documentsProvided: [...handover.documentsProvided],
      trainingProvided: handover.trainingProvided, trainingNotes: handover.trainingNotes,
      pendingPunchItems: [...handover.pendingPunchItems],
    } : {
      handoverType: "Provisional", documentsProvided: [], pendingPunchItems: [], trainingProvided: false,
    });
    setEditing(true);
  };

  const toggleDoc = (doc: string) => {
    setForm(f => ({
      ...f,
      documentsProvided: f.documentsProvided?.includes(doc)
        ? f.documentsProvided.filter(d => d !== doc)
        : [...(f.documentsProvided ?? []), doc],
    }));
  };

  const addPunchItem = () => {
    if (!newPunch.description) return;
    setForm(f => ({ ...f, pendingPunchItems: [...(f.pendingPunchItems ?? []), { ...newPunch }] }));
    setNewPunch({ description: "", severity: "Medium", responsible: "" });
  };

  const removePunch = (i: number) => {
    setForm(f => ({ ...f, pendingPunchItems: f.pendingPunchItems?.filter((_, idx) => idx !== i) }));
  };

  if (isPending) return <div className="flex items-center justify-center h-40"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5">
      {/* Status banner */}
      {handover && (
        <div className={cn(
          "flex items-center justify-between p-4 rounded-xl border",
          STATUS_COLORS[handover.status] ?? "bg-muted border-border"
        )}>
          <div className="flex items-center gap-3">
            {handover.status === "Signed" ? <CheckCircle2 className="h-5 w-5" /> :
             handover.status === "Rejected" ? <XCircle className="h-5 w-5" /> :
             handover.status === "PendingClientSignoff" ? <Send className="h-5 w-5" /> :
             <ClipboardCheck className="h-5 w-5" />}
            <div>
              <p className="font-bold text-sm">{handover.handoverType} Handover — {handover.status}</p>
              {handover.clientSignedAt && (
                <p className="text-xs opacity-75 mt-0.5">Client: {handover.clientSignedBy} · {new Date(handover.clientSignedAt).toLocaleDateString()}</p>
              )}
              {handover.internalSignedAt && (
                <p className="text-xs opacity-75">Internal sign-off: {new Date(handover.internalSignedAt).toLocaleDateString()}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {handover.status === "Draft" && (
              <Button size="sm" variant="outline" onClick={() => signMut.mutate({ id: handover.id, type: "client" })} disabled={signMut.isPending}>
                <Send className="h-3.5 w-3.5 mr-1.5" /> Submit for Client Sign-off
              </Button>
            )}
            {handover.status === "PendingClientSignoff" && (
              <Button size="sm" onClick={() => signMut.mutate({ id: handover.id, type: "internal" })} disabled={signMut.isPending}
                className="bg-emerald-600 hover:bg-emerald-700 text-white">
                <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" /> Mark Signed
              </Button>
            )}
          </div>
        </div>
      )}

      {/* No handover yet */}
      {!handover && !editing && (
        <EmptyState
          icon={FileCheck}
          title="No handover certificate yet"
          description="Create a handover certificate to begin the client sign-off process."
          action={{ label: "Create Handover Certificate", onClick: startEdit }}
        />
      )}

      {/* Edit / Create Form */}
      {editing && (
        <SectionCard title={handover ? "Edit Handover Certificate" : "New Handover Certificate"} actions={
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setEditing(false)}>Cancel</Button>
            <Button size="sm" onClick={handleSubmit} disabled={createMut.isPending || updateMut.isPending}>
              {(createMut.isPending || updateMut.isPending) ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Save Certificate"}
            </Button>
          </div>
        }>
          <div className="space-y-6">
            {/* Header */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5 block">Handover Type</Label>
                <Select value={form.handoverType ?? "Provisional"} onValueChange={v => setForm(f => ({ ...f, handoverType: v }))}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Provisional">Provisional</SelectItem>
                    <SelectItem value="Final">Final</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5 block">Handover Date</Label>
                <Input type="date" className="h-9" value={form.handoverDate ?? ""} onChange={e => setForm(f => ({ ...f, handoverDate: e.target.value }))} />
              </div>
            </div>

            {/* Client Details */}
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3 pb-1 border-b border-border">Client Details</p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5 block">Client Representative</Label>
                  <Input className="h-9" value={form.clientRepresentative ?? ""} onChange={e => setForm(f => ({ ...f, clientRepresentative: e.target.value }))} />
                </div>
                <div>
                  <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5 block">Designation</Label>
                  <Input className="h-9" value={form.clientDesignation ?? ""} onChange={e => setForm(f => ({ ...f, clientDesignation: e.target.value }))} />
                </div>
              </div>
            </div>

            {/* System Summary */}
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3 pb-1 border-b border-border">System Summary</p>
              <div className="grid grid-cols-3 gap-4 mb-3">
                <div>
                  <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5 block">Capacity (kWp)</Label>
                  <Input type="number" step="0.001" className="h-9" value={form.installedCapacityKwp ?? ""} onChange={e => setForm(f => ({ ...f, installedCapacityKwp: Number(e.target.value) }))} />
                </div>
                <div>
                  <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5 block">Panel Count</Label>
                  <Input type="number" className="h-9" value={form.panelCount ?? ""} onChange={e => setForm(f => ({ ...f, panelCount: Number(e.target.value) }))} />
                </div>
                <div>
                  <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5 block">Inverter Count</Label>
                  <Input type="number" className="h-9" value={form.inverterCount ?? ""} onChange={e => setForm(f => ({ ...f, inverterCount: Number(e.target.value) }))} />
                </div>
              </div>
              <div>
                <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5 block">System Description</Label>
                <Textarea className="resize-none h-16" value={form.systemDescription ?? ""} onChange={e => setForm(f => ({ ...f, systemDescription: e.target.value }))} />
              </div>
            </div>

            {/* Warranty & AMC Dates */}
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3 pb-1 border-b border-border">Warranty & AMC Dates</p>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { label: "Warranty Start", key: "warrantyStartDate" },
                  { label: "Warranty End", key: "warrantyEndDate" },
                  { label: "AMC Start", key: "amcStartDate" },
                  { label: "AMC End", key: "amcEndDate" },
                ].map(({ label, key }) => (
                  <div key={key}>
                    <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5 block">{label}</Label>
                    <Input type="date" className="h-9" value={(form as any)[key] ?? ""} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} />
                  </div>
                ))}
              </div>
            </div>

            {/* Documents Checklist */}
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3 pb-1 border-b border-border">Documents Handed Over</p>
              <div className="grid grid-cols-2 gap-2">
                {DOC_CHECKLIST.map(doc => (
                  <label key={doc} className="flex items-center gap-2.5 cursor-pointer group">
                    <Switch
                      checked={form.documentsProvided?.includes(doc) ?? false}
                      onCheckedChange={() => toggleDoc(doc)}
                    />
                    <span className="text-sm text-foreground group-hover:text-primary transition-colors">{doc}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Training */}
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3 pb-1 border-b border-border">Training</p>
              <label className="flex items-center gap-2.5 cursor-pointer mb-3">
                <Switch checked={form.trainingProvided ?? false} onCheckedChange={v => setForm(f => ({ ...f, trainingProvided: v }))} />
                <span className="text-sm font-medium">O&M Training Provided</span>
              </label>
              {form.trainingProvided && (
                <Textarea className="resize-none h-16" placeholder="Training notes…" value={form.trainingNotes ?? ""} onChange={e => setForm(f => ({ ...f, trainingNotes: e.target.value }))} />
              )}
            </div>

            {/* Punch Items */}
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3 pb-1 border-b border-border">Pending Punch Items</p>
              <div className="space-y-2 mb-3">
                {(form.pendingPunchItems ?? []).map((item, i) => (
                  <div key={i} className="flex items-center gap-2 p-2.5 bg-muted/30 rounded-lg border border-border/60">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{item.description}</p>
                      <p className="text-xs text-muted-foreground">{item.severity} · {item.responsible || "Unassigned"}</p>
                    </div>
                    <button onClick={() => removePunch(i)} className="text-muted-foreground hover:text-red-600 shrink-0">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <Input className="h-8 text-xs flex-1" placeholder="Description…" value={newPunch.description} onChange={e => setNewPunch(p => ({ ...p, description: e.target.value }))} />
                <Select value={newPunch.severity} onValueChange={v => setNewPunch(p => ({ ...p, severity: v }))}>
                  <SelectTrigger className="h-8 w-28 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["Low","Medium","High"].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Input className="h-8 text-xs w-28" placeholder="Responsible" value={newPunch.responsible} onChange={e => setNewPunch(p => ({ ...p, responsible: e.target.value }))} />
                <Button size="sm" variant="outline" className="h-8 px-2" onClick={addPunchItem}><Plus className="h-3.5 w-3.5" /></Button>
              </div>
            </div>
          </div>
        </SectionCard>
      )}

      {/* Read-only view */}
      {handover && !editing && (
        <div className="grid gap-5 md:grid-cols-2">
          <SectionCard title="System Details" actions={
            <Button size="sm" variant="outline" onClick={startEdit}><Pen className="h-3 w-3 mr-1.5" />Edit</Button>
          }>
            <dl className="space-y-3">
              {[
                { label: "Type", value: handover.handoverType },
                { label: "Date", value: handover.handoverDate ?? "—" },
                { label: "Client Rep", value: handover.clientRepresentative ?? "—" },
                { label: "Designation", value: handover.clientDesignation ?? "—" },
                { label: "Capacity", value: handover.installedCapacityKwp ? `${handover.installedCapacityKwp} kWp` : "—" },
                { label: "Panels", value: handover.panelCount ?? "—" },
                { label: "Inverters", value: handover.inverterCount ?? "—" },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{label}</span>
                  <span className="font-medium text-right">{String(value)}</span>
                </div>
              ))}
            </dl>
          </SectionCard>

          <SectionCard title="Documents & Training">
            <div className="space-y-1.5 mb-4">
              {DOC_CHECKLIST.map(doc => (
                <div key={doc} className="flex items-center gap-2 text-sm">
                  {handover.documentsProvided.includes(doc)
                    ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                    : <AlertCircle className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />}
                  <span className={handover.documentsProvided.includes(doc) ? "text-foreground" : "text-muted-foreground line-through"}>{doc}</span>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-2 text-sm pt-3 border-t border-border/60">
              <CheckCircle2 className={cn("h-3.5 w-3.5 shrink-0", handover.trainingProvided ? "text-emerald-500" : "text-muted-foreground/40")} />
              <span>O&M Training {handover.trainingProvided ? "Provided" : "Not Provided"}</span>
            </div>
          </SectionCard>

          {handover.pendingPunchItems.length > 0 && (
            <SectionCard title={`Pending Punch Items (${handover.pendingPunchItems.length})`} className="md:col-span-2">
              <div className="grid gap-2 sm:grid-cols-2">
                {handover.pendingPunchItems.map((item, i) => (
                  <div key={i} className="flex items-start gap-2.5 p-3 bg-amber-50/60 dark:bg-amber-950/20 rounded-lg border border-amber-200/60 dark:border-amber-800/30">
                    <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium">{item.description}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{item.severity} · {item.responsible || "Unassigned"}</p>
                    </div>
                  </div>
                ))}
              </div>
            </SectionCard>
          )}
        </div>
      )}
    </motion.div>
  );
}
